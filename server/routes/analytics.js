const express = require('express');
const pool = require('../db/pool');
const { todayInSingapore, isValidMonth } = require('../validation');
const reports = require('../reports');

const router = express.Router();

// GET /api/analytics?year=2026&month=11  (leave out month for the whole year)
router.get('/', async (req, res) => {
  const userId = req.session.userId;
  const year = String(req.query.year || todayInSingapore().slice(0, 4));
  const month = req.query.month ? String(req.query.month).padStart(2, '0') : '';

  if (!isValidMonth(`${year}-${month || '01'}`)) {
    return res.status(400).json({ error: 'Choose a valid month and year.' });
  }

  const { start, end } = month
    ? reports.monthRange(`${year}-${month}`)
    : { start: `${year}-01-01`, end: `${Number(year) + 1}-01-01` };
  const params = [userId, start, end];

  const dailySpending = await pool.query(
    `SELECT to_char(day, 'YYYY-MM-DD') AS date,
            COALESCE(SUM(t.amount), 0)::numeric(20,2) AS total
     FROM generate_series($2::timestamp, $3::timestamp - interval '1 day', interval '1 day') AS day
     LEFT JOIN transactions t
       ON t.user_id = $1 AND t.type = 'expense' AND t.transaction_date = day::date
     GROUP BY day
     ORDER BY day`,
    params
  );

  const highestDay = await pool.query(
    `SELECT to_char(transaction_date, 'YYYY-MM-DD') AS date,
            SUM(amount)::numeric(20,2) AS total
     FROM transactions
     WHERE user_id = $1 AND type = 'expense'
       AND transaction_date >= $2 AND transaction_date < $3
     GROUP BY transaction_date
     ORDER BY SUM(amount) DESC, transaction_date DESC
     LIMIT 1`,
    params
  );

  const paymentMethods = await pool.query(
    `SELECT payment_method AS name, SUM(amount)::numeric(20,2) AS total
     FROM transactions
     WHERE user_id = $1 AND type = 'expense'
       AND transaction_date >= $2 AND transaction_date < $3
     GROUP BY payment_method
     ORDER BY SUM(amount) DESC, payment_method`,
    params
  );

  const categorySpending = await reports.getSpendingByCategory(userId, start, end);

  res.json({
    totals: await reports.getTotals(userId, start, end),
    categorySpending,
    highestCategory: categorySpending[0] || null,
    highestDay: highestDay.rows[0] || null,
    paymentMethods: paymentMethods.rows,
    dailySpending: dailySpending.rows,
    // Month by month for the selected year and the year before, for comparison
    months: await reports.getMonthlyTotals(userId, `${year}-01-01`, 12),
    previousYearMonths: await reports.getMonthlyTotals(userId, `${Number(year) - 1}-01-01`, 12),
  });
});

module.exports = router;
