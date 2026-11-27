const express = require('express');
const bcrypt = require('bcrypt');

const pool = require('../db/pool');
const { getCsrfToken, requireLogin, createRateLimiter } = require('../middleware');
const { cleanText, validateRegistration } = require('../validation');

const router = express.Router();

const SALT_ROUNDS = 12;
const FIFTEEN_MINUTES = 15 * 60 * 1000;
const loginLimiter = createRateLimiter(10, FIFTEEN_MINUTES);
const registerLimiter = createRateLimiter(10, FIFTEEN_MINUTES);

// Compared against when an email is unknown, so that case takes as long as a
// wrong password and does not reveal which emails are registered.
const dummyHashPromise = bcrypt.hash('no-user-has-this-password', SALT_ROUNDS);

const DEFAULT_COLORS = ['#0d9165', '#0284c7', '#8b5cf6', '#db2777', '#6366f1', '#d97706', '#0891b2', '#dc2626', '#ea580c', '#64748b'];

const DEFAULT_CATEGORIES = {
  expense: [
    'Food & Drinks', 'Transport', 'Groceries', 'Shopping', 'Education',
    'Entertainment', 'Bills & Utilities', 'Healthcare', 'Subscriptions', 'Others',
  ],
  income: ['Salary', 'Allowance', 'Freelance', 'Business', 'Gifts', 'Refunds', 'Others'],
};

router.get('/csrf', (req, res) => {
  res.json({ csrfToken: getCsrfToken(req) });
});

router.post('/register', registerLimiter, async (req, res) => {
  const { data, error } = validateRegistration(req.body || {});
  if (error) return res.status(400).json({ error });

  const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

  // A database transaction: the user and their categories are saved together,
  // or not at all. It needs one dedicated connection from the pool.
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      'INSERT INTO users (full_name, email, password_hash) VALUES ($1, $2, $3) RETURNING id',
      [data.fullName, data.email, passwordHash]
    );
    const userId = result.rows[0].id;

    for (const [type, names] of Object.entries(DEFAULT_CATEGORIES)) {
      await client.query(
        `INSERT INTO categories (user_id, name, type, color)
         SELECT $1, name, $3, color FROM unnest($2::text[], $4::text[]) AS defaults(name, color)`,
        [userId, names, type, names.map((name, i) => DEFAULT_COLORS[i])]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ message: 'Account created. You can now log in.' });
  } catch (err) {
    await client.query('ROLLBACK');
    // 23505 = unique constraint violation
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    throw err;
  } finally {
    client.release();
  }
});

router.post('/login', loginLimiter, async (req, res, next) => {
  const body = req.body || {};
  const email = cleanText(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return res.status(400).json({ error: 'Enter your email and password.' });
  }

  const result = await pool.query('SELECT id, password_hash FROM users WHERE email = $1', [email]);
  const user = result.rows[0];
  const hash = user ? user.password_hash : await dummyHashPromise;
  const passwordMatches = await bcrypt.compare(password, hash);

  if (!user || !passwordMatches) {
    return res.status(401).json({ error: 'Incorrect email or password.' });
  }

  // A new session id after login prevents "session fixation" attacks
  req.session.regenerate((regenerateError) => {
    if (regenerateError) return next(regenerateError);

    req.session.userId = user.id;
    req.session.save((saveError) => {
      if (saveError) return next(saveError);
      res.json({ message: 'Logged in.' });
    });
  });
});

router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('spendwise.sid');
    res.json({ message: 'Logged out.' });
  });
});

router.get('/me', requireLogin, async (req, res) => {
  const result = await pool.query(
    'SELECT full_name AS "fullName", email FROM users WHERE id = $1',
    [req.session.userId]
  );
  if (result.rows.length === 0) return res.status(401).json({ error: 'Please log in.' });
  res.json(result.rows[0]);
});

module.exports = router;
