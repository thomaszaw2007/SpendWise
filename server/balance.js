
const pool = require('./db/pool');

// Current balance = opening balance + income - expenses
// Reserved = money allocated to savings goals
// Available = balance - reserved
async function getBalances(db, userId) {
  const result = await db.query(
    `WITH money AS (
       SELECT
         u.opening_balance + COALESCE((
           SELECT SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE -t.amount END)
           FROM transactions t WHERE t.user_id = u.id
         ), 0) AS balance,
         COALESCE((
           SELECT SUM(CASE WHEN e.type = 'contribution' THEN e.amount ELSE -e.amount END)
           FROM savings_entries e WHERE e.user_id = u.id
         ), 0) AS reserved
       FROM users u
       WHERE u.id = $1
     )
     SELECT balance::numeric(20,2) AS balance,
            reserved::numeric(20,2) AS reserved,
            (balance - reserved)::numeric(20,2) AS available
     FROM money`,
    [userId]
  );

  return result.rows[0];
}

// Prevent simultaneous requests from changing the same balance.
async function lockUser(client, userId) {
  await client.query(
    'SELECT id FROM users WHERE id = $1 FOR UPDATE',
    [userId]
  );
}

// Allow users to record actual financial activity,
// even when their available balance becomes negative.
// Database transactions still protect data consistency.
async function changeBalanceSafely(userId, makeChange) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await lockUser(client, userId);

    const result = await makeChange(client);

    await client.query('COMMIT');

    return { result };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  getBalances,
  lockUser,
  changeBalanceSafely
};
