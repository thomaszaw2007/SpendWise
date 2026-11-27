const express = require('express');
const pool = require('../db/pool');
const { getBalances, lockUser } = require('../balance');
const {
  todayInSingapore,
  toCents,
  parseId,
  validateGoal,
  validateSavingsEntry,
} = require('../validation');

// Mounted behind requireLogin in app.js.
// Every query filters by req.session.userId, never by an id from the browser.
//
// How savings work:
// - Putting money in a goal "reserves" it. The money stays in the balance, so a
//   contribution is not an expense.
// - Available spending balance = current balance - reserved savings.
// - The reserved amount of a goal is always calculated from its history in the
//   savings_entries table (contributions minus withdrawals and releases).
const router = express.Router();

const NOT_FOUND = { status: 404, error: 'Savings goal not found.' };

// One goal with the amount saved so far, the remaining amount and the progress.
// Add a WHERE clause after it.
const SELECT_GOALS = `
  SELECT g.id, g.name, g.description, g.status,
         g.target_amount AS "targetAmount",
         to_char(g.target_date, 'YYYY-MM-DD') AS "targetDate",
         to_char(g.created_at AT TIME ZONE 'Asia/Singapore', 'YYYY-MM-DD') AS "createdDate",
         s.saved,
         GREATEST(g.target_amount - s.saved, 0)::numeric(20,2) AS remaining,
         LEAST(TRUNC(s.saved * 100 / g.target_amount, 1), 100) AS percent
  FROM savings_goals g
  CROSS JOIN LATERAL (
    SELECT COALESCE(SUM(CASE WHEN e.type = 'contribution' THEN e.amount ELSE -e.amount END), 0)::numeric(20,2) AS saved
    FROM savings_entries e
    WHERE e.goal_id = g.id AND e.user_id = g.user_id
  ) s`;

async function getGoal(db, userId, goalId) {
  const result = await db.query(`${SELECT_GOALS} WHERE g.id = $1 AND g.user_id = $2`, [
    goalId,
    userId,
  ]);
  return result.rows[0];
}

// Runs work(client) in a database transaction. The user's row is locked first,
// so two requests at the same time cannot reserve the same money twice.
// work returns { status, error } to undo everything, or { status, message }.
async function runLocked(userId, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await lockUser(client, userId);
    const outcome = await work(client);
    await client.query(outcome.error ? 'ROLLBACK' : 'COMMIT');
    return outcome;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

function sendOutcome(res, outcome) {
  if (outcome.error) return res.status(outcome.status).json({ error: outcome.error });
  res.status(outcome.status).json({ message: outcome.message });
}

function sendDuplicateNameError(res) {
  res.status(409).json({ error: 'You already have a goal with this name.' });
}

function insertEntry(client, userId, goalId, type, amount, note) {
  return client.query(
    `INSERT INTO savings_entries (user_id, goal_id, type, amount, note)
     VALUES ($1, $2, $3, $4, $5)`,
    [userId, goalId, type, amount, note]
  );
}

// All goals, plus the totals shown at the top of the page
router.get('/', async (req, res) => {
  const userId = req.session.userId;

  const goals = await pool.query(
    `${SELECT_GOALS}
     WHERE g.user_id = $1
     ORDER BY CASE g.status WHEN 'active' THEN 1 WHEN 'completed' THEN 2 ELSE 3 END,
              g.target_date NULLS LAST, g.id`,
    [userId]
  );
  const counts = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE status = 'active')::int AS active,
            COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
            COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
     FROM savings_goals
     WHERE user_id = $1`,
    [userId]
  );
  const { balance, reserved, available } = await getBalances(pool, userId);

  res.json({
    summary: { balance, reserved, available, goalCounts: counts.rows[0] },
    goals: goals.rows,
  });
});

// One goal and its contribution and withdrawal history
router.get('/:id/history', async (req, res) => {
  const userId = req.session.userId;
  const goalId = parseId(req.params.id);
  if (!goalId) return res.status(404).json({ error: NOT_FOUND.error });

  const goal = await getGoal(pool, userId, goalId);
  if (!goal) return res.status(404).json({ error: NOT_FOUND.error });

  const entries = await pool.query(
    `SELECT id, type, amount, note,
            to_char(created_at AT TIME ZONE 'Asia/Singapore', 'YYYY-MM-DD HH24:MI') AS "createdAt"
     FROM savings_entries
     WHERE goal_id = $1 AND user_id = $2
     ORDER BY created_at DESC, id DESC`,
    [goalId, userId]
  );
  res.json({ goal, entries: entries.rows });
});

router.post('/', async (req, res) => {
  const { data, error } = validateGoal(req.body || {});
  if (error) return res.status(400).json({ error });

  if (data.targetDate && data.targetDate < todayInSingapore()) {
    return res.status(400).json({ error: 'The target date cannot be in the past.' });
  }

  try {
    await pool.query(
      `INSERT INTO savings_goals (user_id, name, description, target_amount, target_date)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.session.userId, data.name, data.description, data.targetAmount, data.targetDate]
    );
    res.status(201).json({ message: 'Savings goal created.' });
  } catch (err) {
    // 23505 = unique constraint violation (same goal name)
    if (err.code === '23505') return sendDuplicateNameError(res);
    throw err;
  }
});

router.put('/:id', async (req, res) => {
  const userId = req.session.userId;
  const goalId = parseId(req.params.id);
  if (!goalId) return res.status(404).json({ error: NOT_FOUND.error });

  const { data, error } = validateGoal(req.body || {});
  if (error) return res.status(400).json({ error });

  try {
    const outcome = await runLocked(userId, async (client) => {
      const goal = await getGoal(client, userId, goalId);
      if (!goal) return NOT_FOUND;
      if (goal.status === 'cancelled') {
        return { status: 400, error: 'A cancelled goal cannot be edited.' };
      }

      // An old date can stay as it is, but cannot be newly chosen
      if (data.targetDate && data.targetDate < todayInSingapore() && data.targetDate !== goal.targetDate) {
        return { status: 400, error: 'The target date cannot be in the past.' };
      }

      // The saved amount must never be above the target
      const targetCents = toCents(data.targetAmount);
      const savedCents = toCents(goal.saved);
      if (targetCents < savedCents) {
        return {
          status: 400,
          error: `S$${goal.saved} is already reserved for this goal. Set the target to at least that amount, or withdraw some savings first.`,
        };
      }

      // Lowering the target to the saved amount completes the goal.
      // Raising the target of a completed goal makes it active again.
      const newStatus = targetCents === savedCents ? 'completed' : 'active';

      await client.query(
        `UPDATE savings_goals
         SET name = $1, description = $2, target_amount = $3, target_date = $4,
             status = $5::text,
             completed_at = CASE WHEN $5::text = 'completed' THEN COALESCE(completed_at, now()) END,
             updated_at = now()
         WHERE id = $6 AND user_id = $7`,
        [data.name, data.description, data.targetAmount, data.targetDate, newStatus, goalId, userId]
      );
      return { status: 200, message: 'Savings goal updated.' };
    });
    sendOutcome(res, outcome);
  } catch (err) {
    if (err.code === '23505') return sendDuplicateNameError(res);
    throw err;
  }
});

// Reserve money for a goal
router.post('/:id/contributions', async (req, res) => {
  const userId = req.session.userId;
  const goalId = parseId(req.params.id);
  if (!goalId) return res.status(404).json({ error: NOT_FOUND.error });

  const { data, error } = validateSavingsEntry(req.body || {});
  if (error) return res.status(400).json({ error });

  const outcome = await runLocked(userId, async (client) => {
    const goal = await getGoal(client, userId, goalId);
    if (!goal) return NOT_FOUND;
    if (goal.status === 'cancelled') return { status: 400, error: 'This goal was cancelled.' };
    if (goal.status === 'completed') return { status: 400, error: 'This goal is already completed.' };

    // Checked inside the transaction, with the user's row locked
    const money = await getBalances(client, userId);
    const amountCents = toCents(data.amount);

    if (amountCents > toCents(money.available)) {
      return {
        status: 400,
        error: `You cannot reserve more than your available spending balance (S$${money.available}).`,
      };
    }
    if (amountCents > toCents(goal.remaining)) {
      return { status: 400, error: `This goal only needs S$${goal.remaining} more.` };
    }

    await insertEntry(client, userId, goalId, 'contribution', data.amount, data.note);

    if (amountCents === toCents(goal.remaining)) {
      await client.query(
        `UPDATE savings_goals
         SET status = 'completed', completed_at = now(), updated_at = now()
         WHERE id = $1 AND user_id = $2`,
        [goalId, userId]
      );
      return { status: 201, message: 'Contribution added. You reached your goal!' };
    }
    return { status: 201, message: 'Contribution added.' };
  });
  sendOutcome(res, outcome);
});

// Take reserved money back. It becomes available to spend again.
router.post('/:id/withdrawals', async (req, res) => {
  const userId = req.session.userId;
  const goalId = parseId(req.params.id);
  if (!goalId) return res.status(404).json({ error: NOT_FOUND.error });

  const { data, error } = validateSavingsEntry(req.body || {});
  if (error) return res.status(400).json({ error });

  const outcome = await runLocked(userId, async (client) => {
    const goal = await getGoal(client, userId, goalId);
    if (!goal) return NOT_FOUND;
    if (goal.status === 'cancelled') return { status: 400, error: 'This goal was cancelled.' };

    if (toCents(data.amount) > toCents(goal.saved)) {
      return { status: 400, error: `Only S$${goal.saved} is reserved for this goal.` };
    }

    await insertEntry(client, userId, goalId, 'withdrawal', data.amount, data.note);

    // Any withdrawal puts a completed goal below its target again
    if (goal.status === 'completed') {
      await client.query(
        `UPDATE savings_goals
         SET status = 'active', completed_at = NULL, updated_at = now()
         WHERE id = $1 AND user_id = $2`,
        [goalId, userId]
      );
    }
    return { status: 201, message: 'Withdrawal recorded.' };
  });
  sendOutcome(res, outcome);
});

// Cancel a goal. Its reserved money is released, and its history is kept.
router.post('/:id/cancel', async (req, res) => {
  const userId = req.session.userId;
  const goalId = parseId(req.params.id);
  if (!goalId) return res.status(404).json({ error: NOT_FOUND.error });

  const outcome = await runLocked(userId, async (client) => {
    const goal = await getGoal(client, userId, goalId);
    if (!goal) return NOT_FOUND;
    if (goal.status === 'cancelled') {
      return { status: 400, error: 'This goal is already cancelled.' };
    }

    if (toCents(goal.saved) > 0) {
      await insertEntry(client, userId, goalId, 'release', goal.saved, 'Goal cancelled');
    }
    await client.query(
      `UPDATE savings_goals
       SET status = 'cancelled', cancelled_at = now(), completed_at = NULL, updated_at = now()
       WHERE id = $1 AND user_id = $2`,
      [goalId, userId]
    );
    return { status: 200, message: `Goal cancelled. S$${goal.saved} is available to spend again.` };
  });
  sendOutcome(res, outcome);
});

module.exports = router;
