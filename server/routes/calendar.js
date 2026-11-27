const express = require('express');
const pool = require('../db/pool');
const { todayInSingapore, isValidMonth } = require('../validation');
const { monthRange } = require('../reports');

const router = express.Router();

// GET /api/calendar?month=2026-11 - totals for each day that has something
router.get('/', async (req, res) => {
  const today = todayInSingapore();
  const month = req.query.month || today.slice(0, 7);
  if (!isValidMonth(month)) return res.status(400).json({ error: 'Choose a valid month.' });

  const { start, end } = monthRange(month);
  const params = [req.session.userId, start, end];

  // "overBudget" compares each day with the current daily limit
  const days = await pool.query(
    `SELECT to_char(t.transaction_date, 'YYYY-MM-DD') AS date,
       COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'income'), 0)::numeric(20,2) AS income,
       COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'expense'), 0)::numeric(20,2) AS expense,
       COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'expense') > b.amount, FALSE) AS "overBudget"
     FROM transactions t
     LEFT JOIN budgets b ON b.user_id = t.user_id AND b.type = 'daily'
     WHERE t.user_id = $1 AND t.transaction_date >= $2 AND t.transaction_date < $3
     GROUP BY t.transaction_date, b.amount`,
    params
  );

  const journal = await pool.query(
    `SELECT to_char(entry_date, 'YYYY-MM-DD') AS date
     FROM journal_entries
     WHERE user_id = $1 AND entry_date >= $2 AND entry_date < $3`,
    params
  );

  const limit = await pool.query(
    "SELECT amount FROM budgets WHERE user_id = $1 AND type = 'daily'",
    [req.session.userId]
  );

  res.json({
    month,
    today,
    dailyLimit: limit.rows[0]?.amount || null,
    days: days.rows,
    journalDates: journal.rows.map((row) => row.date),
  });
});

module.exports = router;
