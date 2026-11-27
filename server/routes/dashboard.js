const express = require('express');
const pool = require('../db/pool');
const { todayInSingapore, isValidMonth } = require('../validation');
const reports = require('../reports');
const { getBalances } = require('../balance');
const { SELECT_TRANSACTIONS, NEWEST_FIRST } = require('./transactions');

const router = express.Router();

// GET /api/dashboard?month=2026-11
router.get('/', async (req, res) => {
  const userId = req.session.userId;
  const today = todayInSingapore();
  const month = req.query.month || today.slice(0, 7);
  if (!isValidMonth(month)) return res.status(400).json({ error: 'Choose a valid month.' });

  const { start, end } = reports.monthRange(month);

  // All time: balance, money reserved for savings goals and what is left to spend
  const { balance, reserved, available } = await getBalances(pool, userId);

  const goalCounts = await pool.query(
    `SELECT COUNT(*) FILTER (WHERE status = 'active')::int AS active,
            COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
     FROM savings_goals
     WHERE user_id = $1`,
    [userId]
  );

  const todayTotals = await pool.query(
    `SELECT
       COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)::numeric(20,2) AS income,
       COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)::numeric(20,2) AS expense
     FROM transactions
     WHERE user_id = $1 AND transaction_date = $2`,
    [userId, today]
  );

  // The six months ending with the selected month, for the chart
  const [year, number] = month.split('-').map(Number);
  const firstChartDay = new Date(Date.UTC(year, number - 6, 1)).toISOString().slice(0, 10);

  const recent = await pool.query(
    `${SELECT_TRANSACTIONS}
     WHERE t.user_id = $1
     ORDER BY ${NEWEST_FIRST}
     LIMIT 5`,
    [userId]
  );

  res.json({
    today,
    month,
    balance,
    reservedSavings: reserved,
    availableBalance: available,
    goalCounts: goalCounts.rows[0],
    todayTotals: todayTotals.rows[0],
    monthTotals: await reports.getTotals(userId, start, end),
    budgets: await reports.getBudgets(userId, month),
    categorySpending: await reports.getSpendingByCategory(userId, start, end),
    sixMonths: await reports.getMonthlyTotals(userId, firstChartDay, 6),
    recent: recent.rows,
  });
});

module.exports = router;
