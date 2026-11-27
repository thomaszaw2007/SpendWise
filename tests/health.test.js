const request = require('supertest');
const app = require('../server/app');

// Supertest calls our Express app directly, so no server needs to be running.
// This test does not touch the database.
test('an unknown /api route returns a JSON 404', async () => {
  const response = await request(app).get('/api/does-not-exist');

  expect(response.status).toBe(404);
  expect(response.body.error).toBe('Not found');
});
