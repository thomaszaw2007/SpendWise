
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

// All settings belong to the currently logged-in user.
const router = express.Router();

const SALT_ROUNDS = 12;
const FIFTEEN_MINUTES = 15 * 60 * 1000;

// Limit repeated password verification attempts.
const passwordLimiter = createRateLimiter(10, FIFTEEN_MINUTES);

const WRONG_PASSWORD = 'Your current password is incorrect.';

// GET ACCOUNT SETTINGS
router.get('/', async (req, res) => {
  const result = await pool.query(
    `SELECT full_name AS "fullName",
            email,
            opening_balance AS "openingBalance",
            to_char(
              created_at AT TIME ZONE 'Asia/Singapore',
              'YYYY-MM-DD'
            ) AS "createdDate"
     FROM users
     WHERE id = $1`,
    [req.session.userId]
  );

  res.json({
    ...result.rows[0],
    currency: 'SGD',
    timeZone: 'Asia/Singapore',
  });
});

// UPDATE PROFILE
router.put('/profile', async (req, res) => {
  const { data, error } = validateProfile(req.body || {});

  if (error) {
    return res.status(400).json({ error });
  }

  try {
    await pool.query(
      `UPDATE users
       SET full_name = $1, email = $2
       WHERE id = $3`,
      [
        data.fullName,
        data.email,
        req.session.userId,
      ]
    );

    res.json({
      message: 'Profile updated.',
    });
  } catch (err) {
    // 23505 means the email is already in use.
    if (err.code === '23505') {
      return res.status(409).json({
        error: 'An account with this email already exists.',
      });
    }

    throw err;
  }
});

// Verify the current password against the stored hash.
async function passwordIsCorrect(userId, password) {
  if (
    typeof password !== 'string' ||
    password === '' ||
    Buffer.byteLength(password, 'utf8') > 72
  ) {
    return false;
  }

  const result = await pool.query(
    'SELECT password_hash FROM users WHERE id = $1',
    [userId]
  );

  // Handle accounts that no longer exist.
  if (result.rows.length === 0) {
    return false;
  }

  return bcrypt.compare(
    password,
    result.rows[0].password_hash
  );
}

// CHANGE PASSWORD
router.put('/password', passwordLimiter, async (req, res) => {
  const userId = req.session.userId;

  const {
    currentPassword,
    newPassword,
    confirmPassword,
  } = req.body || {};

  const passwordError = validateNewPassword(
    newPassword,
    confirmPassword
  );

  if (passwordError) {
    return res.status(400).json({
      error: passwordError,
    });
  }

  if (!(await passwordIsCorrect(userId, currentPassword))) {
    return res.status(400).json({
      error: WRONG_PASSWORD,
    });
  }

  if (newPassword === currentPassword) {
    return res.status(400).json({
      error: 'Choose a password different from the current one.',
    });
  }

  const newHash = await bcrypt.hash(
    newPassword,
    SALT_ROUNDS
  );

  await pool.query(
    `UPDATE users
     SET password_hash = $1
     WHERE id = $2`,
    [newHash, userId]
  );

  // Log out other devices but keep the current session.
  await pool.query(
    `DELETE FROM sessions
     WHERE sess ->> 'userId' = $1
       AND sid <> $2`,
    [String(userId), req.sessionID]
  );

  res.json({
    message: 'Password changed. Other devices have been logged out.',
  });
});

// UPDATE OPENING BALANCE
router.put('/opening-balance', async (req, res) => {
  const openingBalance = cleanText(
    req.body?.openingBalance
  );

  if (!isValidSignedAmount(openingBalance)) {
    return res.status(400).json({
      error:
        'Enter an amount with at most 2 decimal places, for example 500 or 0.',
    });
  }

  // Allow users to correct their actual opening balance,
  // even if available funds become negative.
  // Existing savings contributions remain unchanged.
  await changeBalanceSafely(
    req.session.userId,
    (client) =>
      client.query(
        `UPDATE users
         SET opening_balance = $1
         WHERE id = $2`,
        [openingBalance, req.session.userId]
      )
  );

  res.json({
    message: 'Opening balance updated.',
  });
});

// PERMANENTLY DELETE ACCOUNT
router.post(
  '/delete-account',
  passwordLimiter,
  async (req, res, next) => {
    const userId = req.session.userId;

    const {
      currentPassword,
      confirmation,
    } = req.body || {};

    if (cleanText(confirmation) !== 'DELETE') {
      return res.status(400).json({
        error: 'Type DELETE in capital letters to confirm.',
      });
    }

    if (!(await passwordIsCorrect(userId, currentPassword))) {
      return res.status(400).json({
        error: WRONG_PASSWORD,
      });
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');
      await lockUser(client, userId);

      // Delete dependent records first.
      // Only records belonging to this user are affected.
      const tables = [
        'savings_entries',
        'savings_goals',
        'budgets',
        'journal_entries',
        'transactions',
        'categories',
      ];

      for (const table of tables) {
        await client.query(
          `DELETE FROM ${table}
           WHERE user_id = $1`,
          [userId]
        );
      }

      await client.query(
        'DELETE FROM users WHERE id = $1',
        [userId]
      );

      // Remove all login sessions for this account.
      await client.query(
        `DELETE FROM sessions
         WHERE sess ->> 'userId' = $1`,
        [String(userId)]
      );

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

      res.json({
        message: 'Your account has been deleted.',
      });
    });
  }
);

module.exports = router;
