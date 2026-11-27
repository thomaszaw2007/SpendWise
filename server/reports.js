// SQL summaries shared by the dashboard, calendar and analytics routes.
// A period runs from "start" (included) to "end" (not included).
// All adding up is done by PostgreSQL so money stays exact.
const pool = require('./db/pool');
const { todayInSingapore } = require('./validation');

// Turns "2026-11" into the first day of that month and of the next month
function monthRange(month) {
  const [year, number] = month.split('-').map(Number);
  const next = new Date(Date.UTC(year, number, 1));
  return { start: `${month}-01`, end: next.toISOString().slice(0, 10) };
}

// Income, expenses, net, savings rate and average daily spending for a period
async function getTotals(userId, start, end) {
  const result = await pool.query(
    `WITH totals AS (
       SELECT
         COALESCE(SUM(amount) FILTER (WHERE type = 'income'), 0)::numeric(20,2) AS income,
         COALESCE(SUM(amount) FILTER (WHERE type = 'expense'), 0)::numeric(20,2) AS expense
       FROM transactions
       WHERE user_id = $1 AND transaction_date >= $2 AND transaction_date < $3
     ),
     period AS (
       -- Days of the period that have happened so far
       SELECT LEAST($3::date, $4::date + 1) - $2::date AS days
     )
     SELECT income, expense,
            (income - expense)::numeric(20,2) AS net,
            -- NULL when there is no income, to avoid dividing by zero
            ROUND((income - expense) * 100 / NULLIF(income, 0), 1) AS "savingsRate",
            ROUND(expense / NULLIF(GREATEST(days, 0), 0), 2) AS "averageDailyExpense"
     FROM totals, period`,
    [userId, start, end, todayInSingapore()]
  );
  return result.rows[0];
}

// One row per month, including months with no transactions
async function getMonthlyTotals(userId, firstDay, numberOfMonths) {
  const result = await pool.query(
    `WITH months AS (
       SELECT generate_series(
         $2::timestamp,
         $2::timestamp + make_interval(months => $3 - 1),
         interval '1 month'
       ) AS start
     ),
     totals AS (
       SELECT months.start,
         COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'income'), 0)::numeric(20,2) AS income,
         COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'expense'), 0)::numeric(20,2) AS expense
       FROM months
       LEFT JOIN transactions t
         ON t.user_id = $1
        AND t.transaction_date >= months.start::date
        AND t.transaction_date < (months.start + interval '1 month')::date
       GROUP BY months.start
     )
     SELECT to_char(start, 'YYYY-MM') AS month, income, expense,
            (income - expense)::numeric(20,2) AS net,
            ROUND((income - expense) * 100 / NULLIF(income, 0), 1) AS "savingsRate"
     FROM totals
     ORDER BY start`,
    [userId, firstDay, numberOfMonths]
  );
  return result.rows;
}

async function getSpendingByCategory(userId, start, end) {
  const result = await pool.query(
    `SELECT c.name, c.color, SUM(t.amount)::numeric(20,2) AS total
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = $1 AND t.type = 'expense'
       AND t.transaction_date >= $2 AND t.transaction_date < $3
     GROUP BY c.id
     ORDER BY SUM(t.amount) DESC, c.name`,
    [userId, start, end]
  );
  return result.rows;
}

// Budgets for one month, plus the daily limit compared with today's spending.
// Spending is calculated on every request, so it is never out of date.
async function getBudgets(userId, month) {
  const result = await pool.query(
    `SELECT b.id, b.type, b.category_id AS "categoryId", c.name AS "categoryName", c.color AS "categoryColor",
            b.amount AS "limit", s.spent,
            (b.amount - s.spent)::numeric(20,2) AS remaining,
            TRUNC(s.spent * 100 / b.amount, 1) AS percent,
            CASE
              WHEN s.spent > b.amount THEN 'exceeded'
              WHEN s.spent = b.amount THEN 'reached'
              WHEN s.spent >= b.amount * 0.8 THEN 'warning'
              ELSE 'normal'
            END AS status
     FROM budgets b
     LEFT JOIN categories c ON c.id = b.category_id
     CROSS JOIN LATERAL (
       SELECT COALESCE(SUM(t.amount), 0)::numeric(20,2) AS spent
       FROM transactions t
       WHERE t.user_id = b.user_id
         AND t.type = 'expense'
         AND (b.category_id IS NULL OR t.category_id = b.category_id)
         AND t.transaction_date >=
             CASE WHEN b.type = 'daily' THEN $2::date ELSE b.month END
         AND t.transaction_date <
             CASE WHEN b.type = 'daily' THEN $2::date + 1
                  ELSE (b.month + interval '1 month')::date END
     ) s
     WHERE b.user_id = $1 AND (b.type = 'daily' OR b.month = $3::date)
     ORDER BY c.name, b.id`,
    [userId, todayInSingapore(), `${month}-01`]
  );

  return {
    daily: result.rows.find((b) => b.type === 'daily') || null,
    monthly: result.rows.find((b) => b.type === 'monthly') || null,
    categories: result.rows.filter((b) => b.type === 'category'),
  };
}

module.exports = {
  monthRange,
  getTotals,
  getMonthlyTotals,
  getSpendingByCategory,
  getBudgets,
};
