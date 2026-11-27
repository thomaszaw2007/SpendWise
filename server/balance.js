// Balance and reserved-savings calculations shared by several routes.
// All adding up is done by PostgreSQL so money stays exact.
const pool = require('./db/pool');
const { toCents } = require('./validation');

const RESERVED_ERROR =
  'This change would leave less money than you have reserved for savings goals. ' +
  'Withdraw from a goal first.';

// Current balance = opening balance + income - expenses
// Reserved      = money held in savings goals
// Available     = balance - reserved
// "db" is either the pool or one client inside a database transaction.
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

// Locks the user's row until the database transaction ends. Every change that
// affects the balance or the reserved savings locks it first, so two requests
// at the same time are handled one after the other instead of both spending
// the same money.
async function lockUser(client, userId) {
  await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
}

// Runs makeChange(client) in a database transaction that changes transactions
// or the opening balance. If the change would leave less money than is
// reserved for savings goals, it is undone and { error } is returned.
// Otherwise it returns { result: whatever makeChange returned }.
async function changeBalanceSafely(userId, makeChange) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockUser(client, userId);

    const before = await getBalances(client, userId);
    const result = await makeChange(client);
    const after = await getBalances(client, userId);

    // Only block a change that makes things worse
    const tooLow = toCents(after.available) < 0 && toCents(after.available) < toCents(before.available);
    if (tooLow) {
      await client.query('ROLLBACK');
      return { error: RESERVED_ERROR };
    }

    await client.query('COMMIT');
    return { result };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { getBalances, lockUser, changeBalanceSafely };
