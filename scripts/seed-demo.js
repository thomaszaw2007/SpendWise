const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('../server/db/pool');
const { todayInSingapore } = require('../server/validation');

const email = 'demo@spendwise.example';

const expenses = [
    ['Food & Drinks', '#0d9165', 'Lunch at school'],
    ['Transport', '#0284c7', 'MRT fare'],
    ['Groceries', '#8b5cf6', 'Supermarket run'],
    ['Shopping', '#db2777', 'Clothes'],
    ['Education', '#6366f1', 'Study materials'],
    ['Entertainment', '#d97706', 'Movie tickets'],
    ['Bills & Utilities', '#0891b2', 'Mobile plan'],
    ['Healthcare', '#dc2626', 'Pharmacy'],
    ['Subscriptions', '#ea580c', 'Music subscription'],
    ['Others', '#64748b', 'Miscellaneous']
];

const incomes = [
    ['Salary', '#0d9165'],
    ['Allowance', '#0284c7'],
    ['Freelance', '#8b5cf6'],
    ['Business', '#db2777'],
    ['Gifts', '#6366f1'],
    ['Refunds', '#d97706'],
    ['Others', '#64748b']
];

async function seedDemo() {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('Demo seed is for local development only.');
    }

    if (!process.env.DATABASE_URL) {
        throw new Error('Set DATABASE_URL in .env first.');
    }

    const url = new URL(process.env.DATABASE_URL);

    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) {
        throw new Error('Demo seed requires a local database.');
    }

    const password = crypto.randomBytes(15).toString('base64url');
    const hash = await bcrypt.hash(password, 12);
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Create demo user
        const result = await client.query(
            `INSERT INTO users
            (full_name, email, password_hash, opening_balance)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (email) DO NOTHING
            RETURNING id`,
            ['Demo User', email, hash, '1200.00']
        );

        if (!result.rowCount) {
            throw new Error(
                'Demo account already exists. No existing records were changed.'
            );
        }

        const id = result.rows[0].id;
        const categoryIds = {};

        // Create default categories
        for (const [type, categories] of [
            ['expense', expenses],
            ['income', incomes]
        ]) {
            for (const [name, color] of categories) {
                const saved = await client.query(
                    `INSERT INTO categories
                    (user_id, name, type, color)
                    VALUES ($1, $2, $3, $4)
                    RETURNING id`,
                    [id, name, type, color]
                );

                categoryIds[`${type}:${name}`] = saved.rows[0].id;
            }
        }

        async function transaction(
            type, category, description, cents, date, time, method
        ) {
            await client.query(
                `INSERT INTO transactions
                (user_id, category_id, type, description,
                amount, transaction_date, transaction_time, payment_method)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [
                    id,
                    categoryIds[`${type}:${category}`],
                    type,
                    description,
                    (cents / 100).toFixed(2),
                    date,
                    time,
                    method
                ]
            );
        }

        const today = todayInSingapore();
        const [year, month] = today.split('-').map(Number);

        // Generate six months of financial records
        for (let offset = 5; offset >= 0; offset--) {
            const first = new Date(
                Date.UTC(year, month - 1 - offset, 1)
            ).toISOString().slice(0, 10);

            const prefix = first.slice(0, 7);

            const lastDay = offset === 0
                ? Number(today.slice(8))
                : new Date(
                    Date.UTC(year, month - offset, 0)
                ).getUTCDate();

            await transaction(
                'income', 'Salary', 'Part-time salary',
                85000 + (5 - offset) * 5000,
                first, '09:00', 'Bank Transfer'
            );

            await transaction(
                'income', 'Allowance', 'Monthly allowance',
                50000, first, '10:00', 'PayNow'
            );

            for (let day = 1; day <= lastDay; day++) {
                const date =
                    `${prefix}-${String(day).padStart(2, '0')}`;

                await transaction(
                    'expense', 'Food & Drinks', 'Lunch at school',
                    550 + (day % 5) * 100,
                    date, '12:30', 'PayNow'
                );

                if (day % 3 !== 0) {
                    await transaction(
                        'expense', 'Transport', 'MRT fare',
                        210, date, '08:15', 'Card'
                    );
                }

                if (day % 4 === 0) {
                    await transaction(
                        'expense', 'Groceries', 'Supermarket run',
                        2400 + (day % 7) * 350,
                        date, '18:00', 'Card'
                    );
                }

                if (day % 7 === 0) {
                    const [name, , description] =
                        expenses[3 + ((day / 7 + offset) % 7)];

                    await transaction(
                        'expense', name, description,
                        3000 + (day % 5) * 800,
                        date, '16:00', 'Card'
                    );
                }
            }

            // Monthly budget
            await client.query(
                `INSERT INTO budgets (user_id, type, month, amount)
                VALUES ($1, 'monthly', $2, 650)`,
                [id, first]
            );

            const categoryBudgets = [
                ['Food & Drinks', 220],
                ['Groceries', 150],
                ['Transport', 80],
                ['Shopping', 50]
            ];

            for (const [name, limit] of categoryBudgets) {
                await client.query(
                    `INSERT INTO budgets
                    (user_id, type, month, category_id, amount)
                    VALUES ($1, 'category', $2, $3, $4)`,
                    [
                        id,
                        first,
                        categoryIds['expense:' + name],
                        limit
                    ]
                );
            }
        }

        // Daily budget
        await client.query(
            `INSERT INTO budgets (user_id, type, amount)
            VALUES ($1, 'daily', 35)`,
            [id]
        );

        // Sample journal entry
        await client.query(
            `INSERT INTO journal_entries
            (user_id, entry_date, content)
            VALUES ($1, $2, $3)`,
            [
                id,
                today,
                'Kept track of meals and transport today. Planning to bring lunch tomorrow.'
            ]
        );

        // Savings goals
        const goals = [
            ['Emergency fund', 2000, 650, false],
            ['New laptop', 1500, 400, false],
            ['Holiday', 800, 240, false],
            ['Textbooks', 120, 120, true]
        ];

        for (const [name, target, saved, complete] of goals) {
            const goal = await client.query(
                `INSERT INTO savings_goals
                (user_id, name, target_amount, status, completed_at)
                VALUES (
                    $1, $2, $3, $4,
                    CASE WHEN $5::boolean THEN now() ELSE NULL END
                )
                RETURNING id`,
                [
                    id,
                    name,
                    target,
                    complete ? 'completed' : 'active',
                    complete
                ]
            );

            await client.query(
                `INSERT INTO savings_entries
                (user_id, goal_id, type, amount, note)
                VALUES ($1, $2, 'contribution', $3, 'Demo contribution')`,
                [id, goal.rows[0].id, saved]
            );
        }

        await client.query('COMMIT');

        console.log('Demo account created successfully!');
        console.log('Email:', email);
        console.log('Password:', password);

    } catch (error) {
        await client.query('ROLLBACK');
        throw error;

    } finally {
        client.release();
    }
}

seedDemo()
    .catch(error => {
        console.error(error.message);
        process.exitCode = 1;
    })
    .finally(() => pool.end());