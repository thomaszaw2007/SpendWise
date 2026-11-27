const express = require('express');
const pool = require('../db/pool');
const { cleanText, todayInSingapore, isValidDate, parseId } = require('../validation');

// Mounted behind requireLogin. Entries are always filtered by the session user.
const router = express.Router();

const PAGE_SIZE = 5;

// Previous entries, newest first
router.get('/', async (req, res) => {
  const count = await pool.query(
    'SELECT COUNT(*)::int AS total FROM journal_entries WHERE user_id = $1',
    [req.session.userId]
  );
  const totalPages = Math.max(1, Math.ceil(count.rows[0].total / PAGE_SIZE));
  const page = Math.min(parseId(req.query.page) || 1, totalPages);

  const result = await pool.query(
    `SELECT to_char(entry_date, 'YYYY-MM-DD') AS date, LEFT(content, 120) AS preview
     FROM journal_entries
     WHERE user_id = $1
     ORDER BY entry_date DESC
     LIMIT $2 OFFSET $3`,
    [req.session.userId, PAGE_SIZE, (page - 1) * PAGE_SIZE]
  );
  res.json({ entries: result.rows, page, totalPages });
});

// Every route below works on one date
router.param('date', (req, res, next, date) => {
  if (!isValidDate(date) || date > todayInSingapore()) {
    return res.status(400).json({ error: 'Choose a valid date that is not in the future.' });
  }
  next();
});

router.get('/:date', async (req, res) => {
  const result = await pool.query(
    'SELECT content FROM journal_entries WHERE user_id = $1 AND entry_date = $2',
    [req.session.userId, req.params.date]
  );
  res.json({ entry: result.rows[0] || null });
});

// Creates the entry, or updates it if this date already has one
router.put('/:date', async (req, res) => {
  const content = cleanText(req.body?.content);
  if (!content || content.length > 5000) {
    return res.status(400).json({ error: 'Write something (up to 5000 characters).' });
  }

  await pool.query(
    `INSERT INTO journal_entries (user_id, entry_date, content)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, entry_date)
     DO UPDATE SET content = EXCLUDED.content, updated_at = now()`,
    [req.session.userId, req.params.date, content]
  );
  res.json({ message: 'Journal entry saved.' });
});

router.delete('/:date', async (req, res) => {
  const result = await pool.query(
    'DELETE FROM journal_entries WHERE user_id = $1 AND entry_date = $2',
    [req.session.userId, req.params.date]
  );
  if (result.rowCount === 0) return res.status(404).json({ error: 'Entry not found.' });
  res.json({ message: 'Journal entry deleted.' });
});

module.exports = router;
