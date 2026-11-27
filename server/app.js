const path = require('path');
const express = require('express');
const helmet = require('helmet');

const healthRoutes = require('./routes/health');

const app = express();

// helmet adds security headers, including a Content Security Policy (CSP).
// The default CSP only allows scripts from our own site, so inline <script>
// tags and onclick="..." attributes will not work. Use .js files instead.
app.use(helmet());

// Lets us read JSON sent from the browser. The limit blocks huge requests.
app.use(express.json({ limit: '10kb' }));

// Serve the HTML, CSS and JS files in the public folder
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api/health', healthRoutes);

// Any other /api URL does not exist
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler: Express calls this when something throws.
// It must have 4 parameters so Express knows it is an error handler.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

module.exports = app;
