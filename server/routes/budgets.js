const express = require('express');
const pool = require('../db/pool');
const { todayInSingapore, isValidMonth, isValidAmount, cleanText, parseId } = require('../validation');
const { getBudgets } = require('../reports');

// Mounted behind requireLogin. Budgets are always filtered by the session user.
const router = express.Router();

const AMOUNT_ERROR = 'Enter an amount above 0 with at most 2 decimal places.';

router.get('/', async (req, res) => {
  const month = req.query.month || todayInSingapore().slice(0, 7);
  if (!isValidMonth(month)) return res.status(400).json({ error: 'Choose a valid month.' });

  res.json(await getBudgets(req.session.userId, month));
});

router.post('/', async (req, res) => {
  const body = req.body || {};
  const { type } = body;
  const amount = cleanText(body.amount);
  let month = null;
  let categoryId = null;

  if (!['daily', 'monthly', 'category'].includes(type)) {
    return res.status(400).json({ error: 'Choose a budget type.' });
  }
  if (!isValidAmount(amount)) return res.status(400).json({ error: AMOUNT_ERROR });

  if (type !== 'daily') {
    if (!isValidMonth(body.month)) return res.status(400).json({ error: 'Choose a valid month.' });
    month = `${body.month}-01`;
  }

  if (type === 'category') {
    categoryId = parseId(body.categoryId);
    const category = await pool.query(
      `SELECT 1 FROM categories
       WHERE id = $1 AND user_id = $2 AND type = 'expense' AND NOT is_archived`,
      [categoryId, req.session.userId]
    );
    if (category.rows.length === 0) {
      return res.status(400).json({ error: 'Choose one of your active expense categories.' });
    }
  }

  try {
    await pool.query(
      `INSERT INTO budgets (user_id, type, month, category_id, amount)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.session.userId, type, month, categoryId, amount]
    );
    res.status(201).json({ message: 'Budget saved.' });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'That budget already exists. Edit it instead.' });
    }
    throw err;
  }
});

// Only the amount can be changed
router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const amount = cleanText(req.body?.amount);
  if (!id) return res.status(404).json({ error: 'Budget not found.' });
  if (!isValidAmount(amount)) return res.status(400).json({ error: AMOUNT_ERROR });

  const result = await pool.query(
    'UPDATE budgets SET amount = $1 WHERE id = $2 AND user_id = $3',
    [amount, id, req.session.userId]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'Budget not found.' });
  res.json({ message: 'Budget updated.' });
});

router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Budget not found.' });

  const result = await pool.query('DELETE FROM budgets WHERE id = $1 AND user_id = $2', [
    id,
    req.session.userId,
  ]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'Budget not found.' });
  res.json({ message: 'Budget deleted.' });
});

module.exports = router;
