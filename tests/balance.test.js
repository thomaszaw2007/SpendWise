
// Tests for the updated balance logic.
// Mock the database connection without touching real records.

describe('Balance management', () => {
  const pool = require('../server/db/pool');
  const {
    getBalances,
    changeBalanceSafely,
  } = require('../server/balance');

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('available balance can be negative', async () => {
    const mockDb = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            balance: '350.00',
            reserved: '400.00',
            available: '-50.00',
          },
        ],
      }),
    };

    const balances = await getBalances(mockDb, 1);

    expect(balances.balance).toBe('350.00');
    expect(balances.reserved).toBe('400.00');
    expect(balances.available).toBe('-50.00');
  });

  test('balance changes are committed without blocking expenses', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({
        rowCount: 1,
      }),
      release: jest.fn(),
    };

    jest.spyOn(pool, 'connect').mockResolvedValue(client);

    const makeChange = jest.fn(async (db) => {
      return db.query('INSERT TEST EXPENSE');
    });

    const outcome = await changeBalanceSafely(1, makeChange);

    expect(outcome.error).toBeUndefined();
    expect(outcome.result.rowCount).toBe(1);

    expect(client.query).toHaveBeenCalledWith('BEGIN');

    expect(client.query).toHaveBeenCalledWith(
      'SELECT id FROM users WHERE id = $1 FOR UPDATE',
      [1]
    );

    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.query).not.toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalled();
  });

  test('failed balance changes are rolled back safely', async () => {
    const client = {
      query: jest.fn().mockResolvedValue({}),
      release: jest.fn(),
    };

    jest.spyOn(pool, 'connect').mockResolvedValue(client);

    const makeChange = jest.fn().mockRejectedValue(
      new Error('Database operation failed')
    );

    await expect(
      changeBalanceSafely(1, makeChange)
    ).rejects.toThrow('Database operation failed');

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalled();
  });

  test('balance queries are scoped to the correct user', async () => {
    const mockDb = {
      query: jest.fn().mockResolvedValue({
        rows: [
          {
            balance: '100.00',
            reserved: '20.00',
            available: '80.00',
          },
        ],
      }),
    };

    await getBalances(mockDb, 42);

    expect(mockDb.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE u.id = $1'),
      [42]
    );
  });
});
