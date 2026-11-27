const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);

const pool = require('./db/pool'); // also loads the .env file
const { requireLogin, checkCsrfToken } = require('./middleware');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const categoryRoutes = require('./routes/categories');
const transactionRoutes = require('./routes/transactions');
const dashboardRoutes = require('./routes/dashboard');
const calendarRoutes = require('./routes/calendar');
const journalRoutes = require('./routes/journal');
const budgetRoutes = require('./routes/budgets');
const analyticsRoutes = require('./routes/analytics');
const savingsRoutes = require('./routes/savings');
const settingsRoutes = require('./routes/settings');

if (!process.env.SESSION_SECRET) {
  throw new Error('SESSION_SECRET is missing. Add it to your .env file (see .env.example).');
}

const app = express();

// Trust the hosting provider's reverse proxy in production
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// helmet adds security headers, including a Content Security Policy (CSP).
// The default CSP only allows scripts from our own site, so inline <script>
// tags and onclick="..." attributes will not work. Use .js files instead.
app.use(helmet());

// Lets us read JSON sent from the browser. The limit blocks huge requests.
// (32kb leaves room for a long journal entry)
app.use(express.json({ limit: '32kb' }));

// Sessions are stored in PostgreSQL; the browser only holds a signed id cookie
app.use(
  session({
    store: new PgSession({ pool, tableName: 'sessions' }),
    name: 'spendwise.sid',
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true, // page scripts cannot read the cookie
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production', // HTTPS only when deployed
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    },
  })
);

// Send visitors who are not logged in to the login page. The data itself is
// protected by requireLogin on the API routes below.
const PRIVATE_PAGES = [
  '/dashboard.html',
  '/daily.html',
  '/transactions.html',
  '/calendar.html',
  '/budgets.html',
  '/analytics.html',
  '/categories.html',
  '/savings.html',
  '/settings.html',
];

app.use((req, res, next) => {
  if (PRIVATE_PAGES.includes(req.path.toLowerCase())) {
    if (!req.session.userId) return res.redirect('/login.html');
    res.set('Cache-Control', 'no-store');
  }
  next();
});

// Serve the HTML, CSS and JS files in the public folder
app.use(express.static(path.join(__dirname, '..', 'public')));

// Chart.js is served from node_modules, so no external CDN is needed
const CHART_FOLDER = path.join(__dirname, '..', 'node_modules', 'chart.js', 'dist');
// The build's file name differs between Chart.js versions
const CHART_FILE =
  ['chart.umd.min.js', 'chart.umd.js'].find((file) =>
    fs.existsSync(path.join(CHART_FOLDER, file))
  ) || 'chart.umd.js';

app.get('/vendor/chart.js', (req, res) => {
  res.sendFile(CHART_FILE, { root: CHART_FOLDER });
});

// Private data must never be cached, and changes need a CSRF token
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use('/api', checkCsrfToken);

app.use('/api/health', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/categories', requireLogin, categoryRoutes);
app.use('/api/transactions', requireLogin, transactionRoutes);
app.use('/api/dashboard', requireLogin, dashboardRoutes);
app.use('/api/calendar', requireLogin, calendarRoutes);
app.use('/api/journal', requireLogin, journalRoutes);
app.use('/api/budgets', requireLogin, budgetRoutes);
app.use('/api/analytics', requireLogin, analyticsRoutes);
app.use('/api/savings', requireLogin, savingsRoutes);
app.use('/api/settings', requireLogin, settingsRoutes);

// Any other /api URL does not exist
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler: Express calls this when something throws.
// It must have 4 parameters so Express knows it is an error handler.
app.use((err, req, res, next) => {
  // Bad requests from express.json(), such as invalid or oversized JSON.
  // The error is not logged because it can contain the submitted password.
  if (err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: 'Invalid request.' });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

module.exports = app;
