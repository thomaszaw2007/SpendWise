// Server-side checks. The browser also validates, but it cannot be trusted.
// Each validate function returns { error } or { data }.

const TYPES = ['income', 'expense'];
const PAYMENT_METHODS = ['Cash', 'Card', 'PayNow', 'Bank Transfer', 'E-wallet', 'Other'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Trims text and removes null characters, which PostgreSQL cannot store
function cleanText(value) {
  return typeof value === 'string' ? value.replaceAll('\u0000', '').trim() : '';
}

// Today's date in Singapore as YYYY-MM-DD ('en-CA' formats dates that way)
function todayInSingapore() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(new Date());
}

// True only for real calendar dates, so 2026-02-30 is rejected
function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  if (value < '2000-01-01') return false;

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

// "YYYY-MM" between 2000 and 2100
function isValidMonth(value) {
  return typeof value === 'string' && /^(20\d{2}|2100)-(0[1-9]|1[0-2])$/.test(value);
}

// A positive amount of money with at most 2 decimal places, given as a string
function isValidAmount(value) {
  return /^\d{1,10}(\.\d{1,2})?$/.test(value) && Number(value) > 0;
}

// A money amount that can be 0 or negative, e.g. an opening balance
function isValidSignedAmount(value) {
  return /^-?\d{1,10}(\.\d{1,2})?$/.test(value);
}

// Turns a money string such as "12.5" or "-3.40" into whole cents (1250, -340).
// Whole numbers are exact, so amounts can be compared without rounding errors.
function toCents(amount) {
  const negative = amount.startsWith('-');
  const [dollars, cents = ''] = amount.replace('-', '').split('.');
  const total = Number(dollars) * 100 + Number(cents.padEnd(2, '0'));
  return negative ? -total : total;
}

// Returns the id as a number, or null if it is not a positive database integer
function parseId(value) {
  const text = String(value);
  if (!/^[1-9]\d{0,9}$/.test(text)) return null;
  const id = Number(text);
  return id <= 2147483647 ? id : null;
}

function validateRegistration(body) {
  const fullName = cleanText(body.fullName);
  const email = cleanText(body.email).toLowerCase();
  const password = typeof body.password === 'string' ? body.password : '';

  if (!fullName || fullName.length > 100) {
    return { error: 'Enter your full name (up to 100 characters).' };
  }
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return { error: 'Enter a valid email address.' };
  }
  // bcrypt only uses the first 72 bytes, so longer passwords are rejected
  if (password.length < 8 || Buffer.byteLength(password) > 72) {
    return { error: 'Password must be 8 to 72 characters.' };
  }
  if (password !== body.confirmPassword) {
    return { error: 'Passwords do not match.' };
  }
  return { data: { fullName, email, password } };
}

// New passwords follow the same rules as registration
function validateNewPassword(password, confirmPassword) {
  // bcrypt only uses the first 72 bytes, so longer passwords are rejected
  if (typeof password !== 'string' || password.length < 8 || Buffer.byteLength(password) > 72) {
    return 'Password must be 8 to 72 characters.';
  }
  if (password !== confirmPassword) return 'Passwords do not match.';
  return null;
}

function validateProfile(body) {
  const fullName = cleanText(body.fullName);
  const email = cleanText(body.email).toLowerCase();

  if (!fullName || fullName.length > 100) {
    return { error: 'Enter your full name (up to 100 characters).' };
  }
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return { error: 'Enter a valid email address.' };
  }
  return { data: { fullName, email } };
}

// Name, description, target amount and optional target date of a savings goal
function validateGoal(body) {
  const name = cleanText(body.name);
  const description = cleanText(body.description) || null;
  const targetAmount = cleanText(body.targetAmount);
  const targetDate = cleanText(body.targetDate) || null;

  if (!name || name.length > 80) return { error: 'Enter a goal name (up to 80 characters).' };
  if (description && description.length > 300) {
    return { error: 'The description can be up to 300 characters.' };
  }
  if (!isValidAmount(targetAmount)) {
    return { error: 'Enter a target amount above 0 with at most 2 decimal places.' };
  }
  if (targetDate && !isValidDate(targetDate)) return { error: 'Enter a valid target date.' };

  return { data: { name, description, targetAmount, targetDate } };
}

// The amount and optional note of a savings contribution or withdrawal
function validateSavingsEntry(body) {
  const amount = cleanText(body.amount);
  const note = cleanText(body.note) || null;

  if (!isValidAmount(amount)) {
    return { error: 'Enter an amount above 0 with at most 2 decimal places.' };
  }
  if (note && note.length > 200) return { error: 'The note can be up to 200 characters.' };

  return { data: { amount, note } };
}

function validateTransaction(body) {
  const type = body.type;
  const description = cleanText(body.description);
  // Money stays as a string so it is never rounded by floating point maths
  const amount = cleanText(body.amount);
  const categoryId = parseId(body.categoryId);
  const date = body.date;
  const time = cleanText(body.time) || null;
  const paymentMethod = body.paymentMethod;
  const notes = cleanText(body.notes) || null;

  if (!TYPES.includes(type)) return { error: 'Choose income or expense.' };
  if (!description || description.length > 120) {
    return { error: 'Enter a description (up to 120 characters).' };
  }
  if (!isValidAmount(amount)) {
    return { error: 'Enter an amount above 0 with at most 2 decimal places.' };
  }
  if (!categoryId) return { error: 'Choose a category.' };
  if (!isValidDate(date)) return { error: 'Enter a valid date (year 2000 or later).' };
  if (date > todayInSingapore()) return { error: 'The date cannot be in the future.' };
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { error: 'Enter a valid time.' };
  if (!PAYMENT_METHODS.includes(paymentMethod)) return { error: 'Choose a payment method.' };
  if (notes && notes.length > 500) return { error: 'Notes can be up to 500 characters.' };

  return {
    data: { type, description, amount, categoryId, date, time, paymentMethod, notes },
  };
}

module.exports = {
  TYPES,
  PAYMENT_METHODS,
  cleanText,
  todayInSingapore,
  isValidDate,
  isValidMonth,
  isValidAmount,
  isValidSignedAmount,
  toCents,
  parseId,
  validateRegistration,
  validateNewPassword,
  validateProfile,
  validateGoal,
  validateSavingsEntry,
  validateTransaction,
};
