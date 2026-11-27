const express = require('express');
const bcrypt = require('bcrypt');

const pool = require('../db/pool');
const { changeBalanceSafely, lockUser } = require('../balance');
const { createRateLimiter } = require('../middleware');
const {
  cleanText,
  isValidSignedAmount,
  validateProfile,
  validateNewPassword,
} = require('../validation');

// Mounted behind requireLogin in app.js.
// Every query filters by req.session.userId, never by an id from the browser.
const router = express.Router();

const SALT_ROUNDS = 12;
const FIFTEEN_MINUTES = 15 * 60 * 1000;

// Changing the password and deleting the account both ask for the current
// password, so guessing it is limited
const passwordLimiter = createRateLimiter(10, FIFTEEN_MINUTES);

const WRONG_PASSWORD = 'Your current password is incorrect.';

// Currency and time zone are fixed for now, so they are not stored in the database
router.get('/', async (req, res) => {
  const result = await pool.query(
    `SELECT full_name AS "fullName", email, opening_balance AS "openingBalance",
            to_char(created_at AT TIME ZONE 'Asia/Singapore', 'YYYY-MM-DD') AS "createdDate"
     FROM users
     WHERE id = $1`,
    [req.session.userId]
  );
  res.json({ ...result.rows[0], currency: 'SGD', timeZone: 'Asia/Singapore' });
});

router.put('/profile', async (req, res) => {
  const { data, error } = validateProfile(req.body || {});
  if (error) return res.status(400).json({ error });

  try {
    await pool.query('UPDATE users SET full_name = $1, email = $2 WHERE id = $3', [
      data.fullName,
      data.email,
      req.session.userId,
    ]);
    res.json({ message: 'Profile updated.' });
  } catch (err) {
    // 23505 = unique constraint violation (email already used by another account)
    if (err.code === '23505') {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }
    throw err;
  }
});

// Checks a password typed by the user against the saved hash
async function passwordIsCorrect(userId, password) {
  if (typeof password !== 'string' || password === '') return false;
  const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [userId]);
  return bcrypt.compare(password, result.rows[0].password_hash);
}

router.put('/password', passwordLimiter, async (req, res) => {
  const userId = req.session.userId;
  const { currentPassword, newPassword, confirmPassword } = req.body || {};

  const passwordError = validateNewPassword(newPassword, confirmPassword);
  if (passwordError) return res.status(400).json({ error: passwordError });

  // 400 instead of 401, because the browser treats 401 as "logged out"
  if (!(await passwordIsCorrect(userId, currentPassword))) {
    return res.status(400).json({ error: WRONG_PASSWORD });
  }
  if (newPassword === currentPassword) {
    return res.status(400).json({ error: 'Choose a password different from the current one.' });
  }

  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newHash, userId]);

  // Log this account out on every other device. This browser stays logged in.
  await pool.query("DELETE FROM sessions WHERE sess ->> 'userId' = $1 AND sid <> $2", [
    String(userId),
    req.sessionID,
  ]);
  res.json({ message: 'Password changed. Other devices have been logged out.' });
});

// The balance before the first recorded transaction. It can be negative.
router.put('/opening-balance', async (req, res) => {
  const openingBalance = cleanText(req.body?.openingBalance);
  if (!isValidSignedAmount(openingBalance)) {
    return res.status(400).json({
      error: 'Enter an amount with at most 2 decimal places, for example 500 or 0.',
    });
  }

  // A lower opening balance cannot leave less money than is reserved for savings
  const { error } = await changeBalanceSafely(req.session.userId, (client) =>
    client.query('UPDATE users SET opening_balance = $1 WHERE id = $2', [
      openingBalance,
      req.session.userId,
    ])
  );
  if (error) return res.status(400).json({ error });

  res.json({ message: 'Opening balance updated.' });
});

// Permanently deletes the account and everything that belongs to it
router.post('/delete-account', passwordLimiter, async (req, res, next) => {
  const userId = req.session.userId;
  const { currentPassword, confirmation } = req.body || {};

  if (cleanText(confirmation) !== 'DELETE') {
    return res.status(400).json({ error: 'Type DELETE in capital letters to confirm.' });
  }
  if (!(await passwordIsCorrect(userId, currentPassword))) {
    return res.status(400).json({ error: WRONG_PASSWORD });
  }

  // One database transaction: everything is deleted, or nothing is
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockUser(client, userId);

    // Child tables first. Each query only touches this user's rows.
    for (const table of [
      'savings_entries',
      'savings_goals',
      'budgets',
      'journal_entries',
      'transactions',
      'categories',
    ]) {
      await client.query(`DELETE FROM ${table} WHERE user_id = $1`, [userId]);
    }
    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    // Ends this user's login sessions on every device
    await client.query("DELETE FROM sessions WHERE sess ->> 'userId' = $1", [String(userId)]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('spendwise.sid');
    res.json({ message: 'Your account has been deleted.' });
  });
});

module.exports = router;
