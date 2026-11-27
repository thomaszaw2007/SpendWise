const crypto = require('crypto');

// Blocks API requests from visitors who are not logged in
function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Please log in.' });
  }
  next();
}

// CSRF protection: a request that changes data must send the secret token
// stored in this visitor's session. Other websites cannot read that token.
function getCsrfToken(req) {
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(32).toString('hex');
  }
  return req.session.csrfToken;
}

function checkCsrfToken(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const token = req.get('X-CSRF-Token');
  if (!token || token !== req.session.csrfToken) {
    return res.status(403).json({
      error: 'Your session has expired. Please try again.',
      code: 'CSRF',
    });
  }
  next();
}

// Allows each IP address a limited number of requests per time window.
// Counts are kept in memory, so they reset when the server restarts.
function createRateLimiter(maxRequests, windowMs) {
  const visitors = new Map();

  return (req, res, next) => {
    const now = Date.now();
    // Forget expired entries so the map does not grow forever
    for (const [ip, entry] of visitors) {
      if (now > entry.resetAt) visitors.delete(ip);
    }
    let visitor = visitors.get(req.ip);

    if (!visitor) {
      visitor = { count: 0, resetAt: now + windowMs };
      visitors.set(req.ip, visitor);
    }

    visitor.count += 1;

    if (visitor.count > maxRequests) {
      return res.status(429).json({ error: 'Too many attempts. Please try again later.' });
    }
    next();
  };
}

module.exports = { requireLogin, getCsrfToken, checkCsrfToken, createRateLimiter };
