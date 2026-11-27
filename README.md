# SpendWise

A personal finance management web app, built step by step as a portfolio project.

**Stack:** HTML, CSS, vanilla JavaScript, Node.js, Express, PostgreSQL, Chart.js

**Current features:** registration and login, income and expense categories, daily entry, transaction history (search, filters, sorting, pagination, CSV export), dashboard, spending calendar, daily journal, budgets, analytics, savings goals, and account settings (profile, password, opening balance, account deletion).

## Setup (Windows)

You need Node.js, PostgreSQL, pgAdmin, and a database named exactly `SpendWise`.

1. Install the packages:
   ```
   npm install
   ```
2. Set up `.env`. For a new setup run `copy .env.example .env`. It needs:
   - `DATABASE_URL` - your PostgreSQL connection
   - `SESSION_SECRET` - a long random string:
     ```
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
3. In pgAdmin, open the Query Tool on `SpendWise` and run each file once, in order (if you already ran 001-006, run only 007 and 008):
   1. `server/db/migrations/001_create_users.sql`
   2. `server/db/migrations/002_create_sessions.sql`
   3. `server/db/migrations/003_create_categories.sql`
   4. `server/db/migrations/004_create_transactions.sql`
   5. `server/db/migrations/005_create_budgets.sql`
   6. `server/db/migrations/006_create_journal_entries.sql`
   7. `server/db/migrations/007_create_savings.sql`
   8. `server/db/migrations/008_account_settings.sql`
4. Start the app and open http://localhost:3000:
   ```
   npm run dev
   ```

`npm test` runs the automated tests. They do not touch the database.

## Folder structure

```
server/
  app.js          Express setup (sessions, security, routes)
  server.js       Starts the server
  middleware.js   Login check, CSRF protection, rate limiting
  validation.js   Server-side input checks
  reports.js      SQL summaries used by several routes
  balance.js      Balance and reserved-savings calculations, plus the balance safety check
  routes/         One file per feature
  db/             PostgreSQL connection and SQL migrations
public/
  *.html          Pages
  css/            base.css (colours, forms), layout.css
  js/             api.js, common.js, transaction-form.js, page scripts
tests/            Jest + Supertest tests
```

## How the main parts work

- **Passwords** are hashed with bcrypt.
- **Sessions** are stored in the `sessions` table; the browser holds only a signed cookie. They last 1 day.
- **CSRF:** the browser gets a token from `/api/auth/csrf` and sends it in the `X-CSRF-Token` header on every change.
- **Rate limiting:** 10 login and 10 registration attempts per 15 minutes per IP, counted in memory.
- **Privacy:** every query filters by the user id from the session. A foreign key also stops a transaction using another user's category.
- **Money** is stored as `NUMERIC(12,2)`, added up in SQL and sent to the browser as strings.
- **Dates** use Singapore time. Future dates are not allowed.
- **Balance** = opening balance + income - expenses. **Available spending balance** = balance - reserved savings.
- **Budgets:** one daily limit, plus monthly and per-category budgets for each month. Spending is calculated when read. Warning from 80%, reached at exactly 100%, exceeded above. The calendar compares every day with the current daily limit.
- **Averages:** average daily expenses divide by the days of the period that have passed.
- **Savings rate** = (income - expenses) / income. Shown as N/A without income.
- **Journal:** one entry per user per date. It never affects calculations.
- **Chart.js** is installed with npm and served at `/vendor/chart.js`.

## Project decisions

- Multiple HTML pages, no frontend framework. SGD only.
- Categories with transactions are archived, not deleted.
- No inline `<script>` tags or `onclick` attributes (blocked by the Content Security Policy).
- Budgets do not roll over and never block a transaction.
- **Savings goals:** a contribution reserves money that is already in the balance, so it is not an expense. The amount reserved for a goal is always calculated from its history (`savings_entries`: contributions minus withdrawals and releases), so it cannot drift out of sync. A contribution cannot exceed the available spending balance or the goal's remaining amount, and a withdrawal cannot exceed what is reserved for that goal. A goal becomes completed when its target is reached and goes back to active if money is withdrawn. Cancelling releases the reserved money and keeps the history.
- **Preventing over-allocation:** every change that affects the balance or reserved savings runs in a PostgreSQL transaction that first locks the user's row (`SELECT ... FOR UPDATE`), so two requests at the same time are handled one after the other.
- **Protecting reserved money:** adding or editing an expense, deleting an income, or lowering the opening balance is refused if it would leave less money than is reserved for savings goals. Withdraw from a goal first. If nothing is reserved, nothing is blocked.
- **Settings:** changing the password needs the current password and logs out all other devices. Deleting the account needs the current password and typing DELETE, removes only that user's rows in one transaction, and ends all of their sessions.
- **CSV export:** `GET /api/transactions/export` uses the same filters as the history list but returns every matching row. Values are quoted, text starting with `=`, `+`, `-` or `@` gets a leading `'` to stop spreadsheet formulas, and a UTF-8 BOM makes Excel read the file correctly.
- **Out of scope:** recurring transactions, multi-currency, password reset, email verification.
