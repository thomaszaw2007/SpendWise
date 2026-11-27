// These tests never touch the database, so they are safe to run any time.
process.env.SESSION_SECRET = 'test-only-secret';

const request = require('supertest');
const app = require('../server/app');
const {
  validateTransaction,
  validateRegistration,
  isValidDate,
  isValidMonth,
} = require('../server/validation');
const { monthRange } = require('../server/reports');
const {
  toCents,
  isValidSignedAmount,
  validateGoal,
  validateSavingsEntry,
  validateProfile,
  validateNewPassword,
} = require('../server/validation');
const { csvField } = require('../server/routes/transactions');

test.each([
  '/api/dashboard',
  '/api/transactions',
  '/api/categories',
  '/api/auth/me',
  '/api/budgets',
  '/api/journal',
  '/api/calendar',
  '/api/analytics',
  '/api/savings',
  '/api/settings',
  '/api/transactions/export',
])(
  '%s requires login',
  async (url) => {
    const response = await request(app).get(url);
    expect(response.status).toBe(401);
  }
);

test('private pages redirect to the login page', async () => {
  const response = await request(app).get('/dashboard.html');
  expect(response.status).toBe(302);
  expect(response.headers.location).toBe('/login.html');
});

test.each(['/savings.html', '/settings.html'])('%s redirects to the login page', async (url) => {
  const response = await request(app).get(url);
  expect(response.status).toBe(302);
  expect(response.headers.location).toBe('/login.html');
});

test('a change without a CSRF token is rejected', async () => {
  const response = await request(app).post('/api/auth/login').send({});
  expect(response.status).toBe(403);
});

test('registration checks that the passwords match', () => {
  const result = validateRegistration({
    fullName: 'Test User',
    email: 'test@example.com',
    password: 'password123',
    confirmPassword: 'password124',
  });
  expect(result.error).toBe('Passwords do not match.');
});

test('transaction amounts must be positive with at most 2 decimals', () => {
  const valid = {
    type: 'expense',
    description: 'Lunch',
    amount: '4.50',
    categoryId: '1',
    date: '2026-01-15',
    paymentMethod: 'Cash',
  };
  expect(validateTransaction(valid).data.amount).toBe('4.50');

  for (const amount of ['0', '-5', '1.005', 'abc', '1e3']) {
    expect(validateTransaction({ ...valid, amount }).error).toBeDefined();
  }
});

test('impossible dates are rejected', () => {
  expect(isValidDate('2026-02-30')).toBe(false);
  expect(isValidDate('2028-02-29')).toBe(true);
});

test('month ranges cross into the next year correctly', () => {
  expect(monthRange('2026-12').end).toBe('2027-01-01');
  expect(monthRange('2028-02').end).toBe('2028-03-01');
  expect(isValidMonth('2026-13')).toBe(false);
});

test('toCents turns money text into exact whole cents', () => {
  expect(toCents('12.5')).toBe(1250);
  expect(toCents('0.07')).toBe(7);
  expect(toCents('-3.40')).toBe(-340);
  expect(toCents('1234567890.99')).toBe(123456789099);
});

test('opening balances can be zero or negative but not have 3 decimals', () => {
  expect(isValidSignedAmount('0')).toBe(true);
  expect(isValidSignedAmount('-250.50')).toBe(true);
  expect(isValidSignedAmount('1.234')).toBe(false);
  expect(isValidSignedAmount('abc')).toBe(false);
});

test('validateGoal checks the name, target amount and date', () => {
  const good = { name: ' Holiday ', targetAmount: '1500', targetDate: '2027-06-30' };
  expect(validateGoal(good).data.name).toBe('Holiday');
  expect(validateGoal({ ...good, name: '' }).error).toBeDefined();
  expect(validateGoal({ ...good, targetAmount: '0' }).error).toBeDefined();
  expect(validateGoal({ ...good, targetAmount: '10.999' }).error).toBeDefined();
  expect(validateGoal({ ...good, targetDate: '2027-02-30' }).error).toBeDefined();
  expect(validateGoal({ ...good, targetDate: '' }).data.targetDate).toBeNull();
});

test('validateSavingsEntry needs a positive amount', () => {
  expect(validateSavingsEntry({ amount: '25.50' }).data.amount).toBe('25.50');
  expect(validateSavingsEntry({ amount: '-5' }).error).toBeDefined();
  expect(validateSavingsEntry({ amount: '5', note: 'x'.repeat(201) }).error).toBeDefined();
});

test('validateProfile lowercases the email', () => {
  expect(validateProfile({ fullName: 'Alex Tan', email: 'Alex@Example.com' }).data.email).toBe(
    'alex@example.com'
  );
  expect(validateProfile({ fullName: 'Alex', email: 'not-an-email' }).error).toBeDefined();
});

test('validateNewPassword enforces the 8 to 72 byte rules', () => {
  expect(validateNewPassword('short', 'short')).not.toBeNull();
  expect(validateNewPassword('a'.repeat(73), 'a'.repeat(73))).not.toBeNull();
  expect(validateNewPassword('é'.repeat(37), 'é'.repeat(37))).not.toBeNull(); // 74 bytes
  expect(validateNewPassword('long enough', 'different')).not.toBeNull();
  expect(validateNewPassword('long enough', 'long enough')).toBeNull();
});

test('CSV values are quoted, escaped and safe from spreadsheet formulas', () => {
  expect(csvField('Lunch, with "friends"', true)).toBe('"Lunch, with ""friends"""');
  expect(csvField('line one\nline two', true)).toBe('"line one\nline two"');
  expect(csvField('=HYPERLINK("http://evil")', true)).toBe('"\'=HYPERLINK(""http://evil"")"');
  expect(csvField('+1 coffee', true)).toBe('"\'+1 coffee"');
  expect(csvField('-5 refund', true)).toBe('"\'-5 refund"');
  expect(csvField('@SUM(1)', true)).toBe('"\'@SUM(1)"');
  expect(csvField(null, true)).toBe('""');
  // Not text, so numbers and dates are left alone
  expect(csvField('12.50')).toBe('"12.50"');
});
