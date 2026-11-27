# SpendWise

A personal finance management web app, built step by step as a portfolio project.

**Stack:** HTML, CSS, vanilla JavaScript, Node.js, Express, PostgreSQL, Chart.js

**Current stage:** Phase 0 (project setup). No login or finance features yet.

## Setup (Windows)

### 1. Install the tools
- Node.js LTS (check with `node -v`)
- PostgreSQL and pgAdmin

### 2. Create the databases in pgAdmin
Right-click **Databases** > **Create** > **Database**, name it exactly `SpendWise` (same capital S and W).

We use this one database for everything. The default `postgres` user is fine for local development. (Later, a separate login role is safer for deployment.)

### 3. Set up the project
Open the project folder in VS Code, then run in the terminal:

```
npm install
copy .env.example .env
```

Open `.env` and replace `your_password` with your PostgreSQL password.

### 4. Run it
```
npm run dev
```
Open http://localhost:3000. The page should say **Server: ok, database: connected**.

### 5. Run the tests
```
npm test
```
The test checks the JSON 404 response and does not use the database. Features are tested manually in the browser for now. Database tests and a separate test database will be added in a later phase.

## npm scripts

| Command | What it does |
|---|---|
| `npm run dev` | Starts the server and restarts it when you save a file |
| `npm start` | Starts the server normally |
| `npm test` | Runs the automated tests |

## Folder structure

```
server/
  app.js        Express setup (middleware and routes)
  server.js     Starts the server
  db/pool.js    PostgreSQL connection
  routes/       One file per feature
public/
  index.html    Pages the browser loads
  css/          base.css (theme colours), layout.css
  js/           api.js (fetch helper), page scripts
tests/          Jest + Supertest tests (no database tests yet)
```

`app.js` and `server.js` are separate so the tests can load the app without starting a real server.

## SQL migrations

From Phase 1 onwards, database changes are numbered files in `server/db/migrations/` (for example `001_create_users.sql`). Run them in order using pgAdmin's Query Tool on `SpendWise`. This README will list which files to run.

## Project decisions

- **Frontend:** multiple HTML pages, no framework.
- **Money:** stored as `NUMERIC(12,2)`, sent to the browser as strings like `"12.50"`. Currency is SGD only.
- **Time zone:** Asia/Singapore. Transaction dates are calendar dates (`DATE`).
- **Auth:** bcrypt password hashing, sessions stored in PostgreSQL, CSRF protection, rate limiting.
- **Privacy:** users can only see their own records.
- **Categories:** default categories are created at registration; users can add their own. Categories with transactions are archived, not deleted.
- **Payment methods:** Cash, Card, PayNow, Bank Transfer, E-wallet, Other.
- **Budgets:** daily (one limit per user), monthly and per-category (one record per month). Only expenses count. Warning at 80%, "limit reached" at 100%, "exceeded" above 100%. Nothing is blocked and budgets do not roll over.
- **Savings:** contributions reserve money and are not expenses. Available balance = current balance - active savings. Contributions cannot exceed the available balance. Cancelling a goal releases its money. Completed goals keep their money reserved until withdrawn.
- **Journal:** one optional entry per user per date.
- **Out of scope:** recurring transactions, multi-currency, password reset, email verification.
- **Security rule:** no inline `<script>` tags or `onclick` attributes (blocked by the Content Security Policy).
