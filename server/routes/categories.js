const express = require('express');
const pool = require('../db/pool');
const { TYPES, cleanText, parseId } = require('../validation');

// Mounted behind requireLogin in app.js.
// Every query filters by req.session.userId, never by an id from the browser.
const router = express.Router();

const NAME_ERROR = 'Enter a category name (up to 50 characters).';
const DUPLICATE_ERROR = 'You already have a category with this name (it may be archived).';

router.get('/', async (req, res) => {
  const result = await pool.query(
    `SELECT c.id, c.name, c.type, c.is_archived AS "isArchived",
            COUNT(t.id)::int AS "transactionCount"
     FROM categories c
     LEFT JOIN transactions t ON t.category_id = c.id
     WHERE c.user_id = $1
     GROUP BY c.id
     ORDER BY c.type, c.is_archived, c.id`,
    [req.session.userId]
  );
  res.json({ categories: result.rows });
});

router.post('/', async (req, res) => {
  const body = req.body || {};
  const name = cleanText(body.name);

  if (!name || name.length > 50) return res.status(400).json({ error: NAME_ERROR });
  if (!TYPES.includes(body.type)) {
    return res.status(400).json({ error: 'Choose income or expense.' });
  }

  try {
    await pool.query('INSERT INTO categories (user_id, name, type) VALUES ($1, $2, $3)', [
      req.session.userId,
      name,
      body.type,
    ]);
    res.status(201).json({ message: 'Category added.' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: DUPLICATE_ERROR });
    throw err;
  }
});

// Rename, archive or restore. The type cannot change, because existing
// transactions rely on it.
router.patch('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Category not found.' });

  const body = req.body || {};
  let name = null; // null means "keep the current value"
  let isArchived = null;

  if (body.name !== undefined) {
    name = cleanText(body.name);
    if (!name || name.length > 50) return res.status(400).json({ error: NAME_ERROR });
  }
  if (typeof body.isArchived === 'boolean') isArchived = body.isArchived;
  if (name === null && isArchived === null) {
    return res.status(400).json({ error: 'Nothing to update.' });
  }

  try {
    const result = await pool.query(
      `UPDATE categories
       SET name = COALESCE($1, name), is_archived = COALESCE($2, is_archived)
       WHERE id = $3 AND user_id = $4`,
      [name, isArchived, id, req.session.userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Category not found.' });
    res.json({ message: 'Category updated.' });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: DUPLICATE_ERROR });
    throw err;
  }
});

router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(404).json({ error: 'Category not found.' });

  try {
    const result = await pool.query('DELETE FROM categories WHERE id = $1 AND user_id = $2', [
      id,
      req.session.userId,
    ]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Category not found.' });
    res.json({ message: 'Category deleted.' });
  } catch (err) {
    // 23503 = foreign key violation: transactions still use this category
    if (err.code === '23503') {
      return res.status(409).json({
        error: 'This category has transactions. Archive it instead.',
      });
    }
    throw err;
  }
});

module.exports = router;
