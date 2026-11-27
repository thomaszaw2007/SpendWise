const express = require('express');
const pool = require('../db/pool');
const { changeBalanceSafely } = require('../balance');
const {
  TYPES,
  PAYMENT_METHODS,
  cleanText,
  todayInSingapore,
  isValidDate,
  parseId,
  validateTransaction,
} = require('../validation');

// Mounted behind requireLogin in app.js.
// Every query filters by req.session.userId, never by an id from the browser.
const router = express.Router();

const PAGE_SIZE = 10;

// Dates and times are converted to text in SQL so time zones cannot shift them
const SELECT_TRANSACTIONS = `
  SELECT t.id, t.type, t.description, t.amount, t.notes,
         t.category_id AS "categoryId", c.name AS "categoryName", c.color AS "categoryColor",
         to_char(t.transaction_date, 'YYYY-MM-DD') AS date,
         to_char(t.transaction_time, 'HH24:MI') AS time,
         t.payment_method AS "paymentMethod"
  FROM transactions t
  JOIN categories c ON c.id = t.category_id`;

// Only these fixed strings are ever placed into ORDER BY
const SORT_OPTIONS = {
  date_desc: 't.transaction_date DESC, t.transaction_time DESC NULLS LAST, t.id DESC',
  date_asc: 't.transaction_date ASC, t.transaction_time ASC NULLS LAST, t.id ASC',
  amount_desc: 't.amount DESC, t.id DESC',
  amount_asc: 't.amount ASC, t.id ASC',
};

// Builds the WHERE clause for the history filters. User input only goes into
// the values array; the SQL text just refers to it as $1, $2 and so on.
function buildFilters(userId, query) {
  const values = [userId];
  const conditions = ['t.user_id = $1'];

  function addCondition(sql, value) {
    values.push(value);
    conditions.push(sql.replace('?', `$${values.length}`));
  }

  const search = cleanText(query.search).slice(0, 120);
  if (search) {
    // Escape % and _ so they are searched for literally
    addCondition('t.description ILIKE ?', `%${search.replace(/[\\%_]/g, '\\$&')}%`);
  }
  if (TYPES.includes(query.type)) addCondition('t.type = ?', query.type);
  if (parseId(query.categoryId)) addCondition('t.category_id = ?', parseId(query.categoryId));
  if (PAYMENT_METHODS.includes(query.paymentMethod)) {
    addCondition('t.payment_method = ?', query.paymentMethod);
  }
  if (isValidDate(query.from)) addCondition('t.transaction_date >= ?', query.from);
  if (isValidDate(query.to)) addCondition('t.transaction_date <= ?', query.to);

  return { where: `WHERE ${conditions.join(' AND ')}`, values };
}

// History list with search, filters, sorting and pagination
router.get('/', async (req, res) => {
  const { where, values } = buildFilters(req.session.userId, req.query);
  const orderBy = Object.hasOwn(SORT_OPTIONS, req.query.sort)
    ? SORT_OPTIONS[req.query.sort]
    : SORT_OPTIONS.date_desc;

  const countResult = await pool.query(
    `SELECT COUNT(*)::int AS total FROM transactions t ${where}`,
    values
  );
  const total = countResult.rows[0].total;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(parseId(req.query.page) || 1, totalPages);

  const result = await pool.query(
    `${SELECT_TRANSACTIONS} ${where}
     ORDER BY ${orderBy}
     LIMIT $${values.length + 1} OFFSET $${values.length + 2}`,
    [...values, PAGE_SIZE, (page - 1) * PAGE_SIZE]
  );

  res.json({ transactions: result.rows, total, page, totalPages });
});

// Wraps every CSV value in quotes and doubles any quotes inside it, so commas,
// quotation marks and line breaks stay inside their cell.
// Text that starts with = + - @ (or a tab or carriage return) could be run as a
// formula by Excel, so a ' is put in front of it to keep it plain text.
function csvField(value, isText) {
  let text = value === null || value === undefined ? '' : String(value);
  if (isText && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

// Downloads the transactions that match the same filters as the history list
// (no paging). GET /api/transactions/export?type=expense&from=2026-11-01
router.get('/export', async (req, res) => {
  if (isValidDate(req.query.from) && isValidDate(req.query.to) && req.query.from > req.query.to) {
    return res.status(400).json({ error: 'The "from" date must not be after the "to" date.' });
  }

  const { where, values } = buildFilters(req.session.userId, req.query);
  const orderBy = Object.hasOwn(SORT_OPTIONS, req.query.sort)
    ? SORT_OPTIONS[req.query.sort]
    : SORT_OPTIONS.date_desc;

  const result = await pool.query(
    `SELECT to_char(t.transaction_date, 'YYYY-MM-DD') AS date,
            to_char(t.transaction_time, 'HH24:MI') AS time,
            t.description, initcap(t.type) AS type, c.name AS category,
            t.payment_method AS "paymentMethod", t.amount, t.notes
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     ${where}
     ORDER BY ${orderBy}`,
    values
  );

  const lines = [
    ['Transaction date', 'Transaction time', 'Description', 'Transaction type',
     'Category', 'Payment method', 'Amount', 'Notes'].map((heading) => csvField(heading)),
  ];
  for (const row of result.rows) {
    lines.push([
      csvField(row.date),
      csvField(row.time),
      csvField(row.description, true),
      csvField(row.type),
      csvField(row.category, true),
      csvField(row.paymentMethod),
      csvField(row.amount),
      csvField(row.notes, true),
    ]);
  }

  // The BOM at the start makes Excel read the file as UTF-8
  const csv = '﻿' + lines.map((line) => line.join(',')).join('\r\n') + '\r\n';

  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="spendwise-transactions-${todayInSingapore()}.csv"`,
  });
  res.send(csv);
});

// One day's transactions and totals, for the daily entry page
router.get('/daily', async (req, res) => {
  const today = todayInSingapore();
  const date = req.query.date || today;
  if (!isValidDate(date)) return res.status(400).json({ error: 'Enter a valid date.' });

  const params = [req.session.userId, date];

  const list = await pool.query(
    `${SELECT_TRANSACTIONS}
     WHERE t.user_id = $1 AND t.transaction_date = $2
     ORDER BY ${SORT_OPTIONS.date_desc}`,
    params
  );

  // SQL does the adding so the money stays exact
  const totals = await pool.query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)::numeric(20,2) AS income,
       COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)::numeric(20,2) AS expense,
       COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0)::numeric(20,2) AS net
     FROM transactions
     WHERE user_id = $1 AND transaction_date = $2`,
    params
  );

  res.json({ date, today, transactions: list.rows, totals: totals.rows[0] });
});

// The category must belong to this user and match the transaction type.
// An archived category is only allowed if the transaction already uses it.
async function findCategoryError(userId, data, currentCategoryId) {
  const result = await pool.query(
    'SELECT type, is_archived FROM categories WHERE id = $1 AND user_id = $2',
    [data.categoryId, userId]
  );
  const category = result.rows[0];

  if (!category || category.type !== data.type) {
    return `Choose one of your ${data.type} categories.`;
  }
  if (category.is_archived && data.categoryId !== currentCategoryId) {
    return 'That category is archived.';
  }
  return null;
}

function transactionValues(data) {
  return [
    data.type,
    data.description,
    data.amount,
    data.categoryId,
    data.date,
    data.time,
    data.paymentMethod,
    data.notes,
  ];
}

router.post('/', async (req, res) => {
  const { data, error } = validateTransaction(req.body || {});
  if (error) return res.status(400).json({ error });

  const categoryError = await findCategoryError(req.session.userId, data);
  if (categoryError) return res.status(400).json({ error: categoryError });

  // An expense cannot use money that is reserved for savings goals
  const { error: balanceError } = await changeBalanceSafely(req.session.userId, (client) =>
    client.query(
      `INSERT INTO transactions
         (type, description, amount, category_id, transaction_date,
          transaction_time, payment_method, notes, user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [...transactionValues(data), req.session.userId]
    )
  );
  if (balanceError) return res.status(400).json({ error: balanceError });

  res.status(201).json({ message: 'Transaction added.' });
});

router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Transaction not found.' });

  const existing = await pool.query(
    'SELECT category_id FROM transactions WHERE id = $1 AND user_id = $2',
    [id, req.session.userId]
  );
  if (existing.rows.length === 0) {
    return res.status(404).json({ error: 'Transaction not found.' });
  }

  const { data, error } = validateTransaction(req.body || {});
  if (error) return res.status(400).json({ error });

  const categoryError = await findCategoryError(
    req.session.userId,
    data,
    existing.rows[0].category_id
  );
  if (categoryError) return res.status(400).json({ error: categoryError });

  // The new version cannot leave less money than is reserved for savings goals
  const { error: balanceError, result } = await changeBalanceSafely(req.session.userId, (client) =>
    client.query(
      `UPDATE transactions
       SET type = $1, description = $2, amount = $3, category_id = $4,
           transaction_date = $5, transaction_time = $6, payment_method = $7, notes = $8
       WHERE id = $9 AND user_id = $10`,
      [...transactionValues(data), id, req.session.userId]
    )
  );
  if (balanceError) return res.status(400).json({ error: balanceError });
  if (result.rowCount === 0) return res.status(404).json({ error: 'Transaction not found.' });

  res.json({ message: 'Transaction updated.' });
});

router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Transaction not found.' });

  // Deleting an income lowers the balance, so it is checked against reserved savings too
  const { error: balanceError, result } = await changeBalanceSafely(req.session.userId, (client) =>
    client.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [
      id,
      req.session.userId,
    ])
  );
  if (balanceError) return res.status(400).json({ error: balanceError });
  if (result.rowCount === 0) return res.status(404).json({ error: 'Transaction not found.' });

  res.json({ message: 'Transaction deleted.' });
});

module.exports = router;
module.exports.SELECT_TRANSACTIONS = SELECT_TRANSACTIONS;
module.exports.NEWEST_FIRST = SORT_OPTIONS.date_desc;
module.exports.csvField = csvField;
