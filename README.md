
# SpendWise

SpendWise is a personal finance management web application that I built as a personal project to improve my full-stack development skills.

The application helps users keep track of their income, expenses, budgets and savings goals in one place. It also provides visual breakdowns of spending habits, making it easier for users to understand and manage their finances.

## About the Project

I am currently pursuing a Diploma in Information Technology at Singapore Polytechnic, with an interest in software engineering and full-stack development.

I wanted to build something outside of my school assignments where I could apply what I have learned while exploring new concepts on my own.

I chose to develop a personal finance application because managing daily expenses and savings is something that is relevant to everyday life. I also wanted to understand how different parts of a web application work together, from the user interface to the backend and database.

SpendWise was developed progressively, starting with basic authentication and transaction management before moving on to more advanced features such as budgets, analytics and savings goals.

## Technology Stack

### Frontend

- HTML5
- CSS3
- Vanilla JavaScript
- Chart.js

### Backend

- Node.js
- Express.js
- REST API
- bcrypt
- Express Session

### Database

- PostgreSQL
- pgAdmin

### Testing and Development Tools

- Jest
- Supertest
- Git
- GitHub
- Visual Studio Code

## Key Features

### User Authentication

- Account registration and login
- Secure password hashing using bcrypt
- Session-based authentication
- Protected pages and API endpoints
- Individual user accounts and private financial records

### Dashboard

- Current account balance
- Available spending balance
- Reserved savings
- Daily and monthly financial summaries
- Recent transactions
- Budget progress
- Income and expense charts
- Savings goal overview

### Transaction Management

- Record daily income and expenses
- Edit and delete transactions
- Organise transactions by category
- Search and filter transaction history
- Sort transactions by date or amount
- Pagination
- Export transaction records to CSV

### Category Management

- Create custom income and expense categories
- Edit category names and colours
- Archive unused categories
- Display category colours in transaction lists and charts

### Spending Calendar and Daily Journal

- View financial activity through a monthly calendar
- Track daily income and expenses
- Identify days with higher spending
- Write personal daily financial reflections
- View previous journal entries

### Budget Management

- Set daily spending limits
- Create monthly budgets
- Set budgets for individual spending categories
- Monitor spending against budget limits
- Receive warnings when approaching or exceeding a budget

Budgets are intended to help users monitor their spending rather than prevent them from recording transactions.

### Financial Analytics

- Income and expense comparisons
- Spending breakdown by category
- Daily spending trends
- Monthly financial summaries
- Six-month income and expense trends
- Average daily expenses
- Savings rate calculations

### Savings Goals

- Create and manage multiple savings goals
- Set target amounts and optional target dates
- Add and withdraw savings
- Track goal progress
- View contribution and withdrawal history
- Complete or cancel savings goals

Savings contributions reserve money from the user's existing balance instead of counting as an expense.

Users can still record expenses when their available balance becomes negative. A warning is displayed instead of blocking the transaction, allowing users to keep an accurate record of their financial activity.

### Account Settings

- Update personal information
- Change account password
- Set or update opening balance
- Switch between light, dark and system themes
- Permanently delete an account and its associated data

## Application Screenshots

Screenshots of the application will be added here.

## System Architecture

SpendWise follows a client-server architecture.

The frontend is built using HTML, CSS and vanilla JavaScript. It communicates with the Express backend through REST API requests.

The backend handles authentication, input validation, financial calculations and database operations.

PostgreSQL stores user accounts, transactions, categories, budgets, journal entries, savings goals and sessions.

```mermaid
flowchart TD
    A[User Browser] --> B[HTML, CSS and JavaScript]
    B -->|HTTP Requests| C[Express REST API]
    C --> D[Authentication and Validation]
    D --> E[Application Logic]
    E --> F[PostgreSQL Database]
    F -->|Query Results| E
    C -->|JSON Responses| B
```

## Database Design

The application uses a relational database with the following main tables:

| Table | Purpose |
| --- | --- |
| users | User accounts and opening balances |
| sessions | Login sessions |
| categories | Income and expense categories |
| transactions | Financial transactions |
| budgets | Daily, monthly and category budgets |
| journal_entries | Personal daily reflections |
| savings_goals | Savings targets and goal information |
| savings_entries | Savings contributions and withdrawals |

Primary keys, foreign keys and database constraints are used to maintain relationships and help ensure data consistency.

A detailed entity relationship diagram will be added to the project documentation.

## How the Financial Logic Works

One of the main challenges in this project was deciding how income, expenses, balances and savings should work together.

### Current Balance

```
Current Balance = Opening Balance + Income - Expenses
```

### Available Balance

```
Available Balance = Current Balance - Reserved Savings
```

For example, if a user has $500 in their account and reserves $200 towards a savings goal, their available spending balance is $300.

Savings contributions do not reduce the current balance because the money still belongs to the user.

During development, I originally prevented users from recording expenses if doing so would affect their reserved savings. However, I realised that this made the application less practical, since users should be able to record what actually happens to their money.

I changed this behaviour to allow negative balances and display a warning instead. Savings contributions are still restricted to the available funds and the remaining target amount.

## Security and Data Privacy

As SpendWise handles personal financial information, I included several security measures throughout the application.

- Password hashing using bcrypt
- PostgreSQL-backed session storage
- HTTP-only session cookies
- Secure cookies in production
- CSRF protection
- Login and registration rate limiting
- Server-side input validation
- Parameterised SQL queries
- User-specific database queries
- Helmet security headers
- Content Security Policy
- Environment variables for private credentials
- A dedicated PostgreSQL user with restricted permissions for local development

Database transactions and row-level locking are also used when updating balances and savings to help prevent conflicting requests from affecting financial records.

These measures provide a security foundation for the application, although further testing and improvements would be needed for a real-world financial service.

## Project Structure

```
SpendWise/
│
├── public/
│   ├── css/
│   ├── js/
│   └── *.html
│
├── server/
│   ├── db/
│   │   ├── migrations/
│   │   └── pool.js
│   ├── routes/
│   ├── app.js
│   ├── server.js
│   ├── middleware.js
│   ├── validation.js
│   ├── balance.js
│   └── reports.js
│
├── scripts/
│   └── seed-demo.js
│
├── tests/
│   ├── api.test.js
│   ├── balance.test.js
│   └── health.test.js
│
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
└── README.md
```

## Getting Started

### Prerequisites

Make sure the following are installed:

- Node.js
- npm
- PostgreSQL
- Git
- pgAdmin (optional, for managing the database)

### 1. Clone the Repository

```bash
git clone https://github.com/thomaszaw2007/SpendWise.git
cd SpendWise
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file using the provided `.env.example`.

For Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Configure the following environment variables:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/SpendWise
SESSION_SECRET=your_random_session_secret
PORT=3000
```

Replace the example values with your own database credentials.

If your database password contains special URL characters, make sure they are URL-encoded in the connection string.

To generate a random session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The `.env` file should never be committed to GitHub.

### 4. Set Up the Database

Create a PostgreSQL database named `SpendWise`.

Run the SQL migration files in the following order:

```
001_create_users.sql
002_create_sessions.sql
003_create_categories.sql
004_create_transactions.sql
005_create_budgets.sql
006_create_journal_entries.sql
007_create_savings.sql
008_account_settings.sql
009_category_colours.sql
```

All migration files are located in:

```
server/db/migrations/
```

Apply each migration once. For an existing database, only apply migrations that have not already been completed.

The application's database user needs permission to access the relevant tables and sequences.

### 5. Start the Application

```bash
npm run dev
```

Open the following URL in your browser:

http://localhost:3000

## Demo Account

A demo seed script is included for local testing and demonstrations.

After completing the database setup, run:

```bash
npm run seed:demo
```

This creates a fictional demo account with:

- Six months of sample financial transactions
- Income and expense categories
- Monthly budgets
- Savings goals
- Journal entries
- Financial analytics based on the sample records

The account credentials will be generated by the script and displayed in the terminal.

The script is intended for local development only and does not contain real personal financial information.

## Testing

The project uses Jest and Supertest for automated testing.

To run the tests:

```bash
npm test
```

The automated tests cover areas such as:

- Authentication requirements
- Protected page redirects
- CSRF protection
- Input validation
- Password requirements
- Date validation
- CSV export formatting
- Negative balance handling
- Database transaction rollback using mocks
- User ID scoping in balance queries

The tests use unauthenticated API requests, validation functions and mocked database operations rather than modifying actual financial records.

I also carried out manual testing during development to check how different features worked together and identify issues that were not covered by the automated tests.

## Challenges and Lessons Learned

### Connecting the Frontend and Backend

This project helped me gain a better understanding of how frontend JavaScript communicates with an Express backend using API requests.

I became more familiar with handling JSON responses, updating page content dynamically and displaying meaningful messages when an operation fails.

### Database Management

Working with PostgreSQL gave me more experience in designing relational tables, writing SQL queries and managing relationships between different types of financial records.

I also learned more about database transactions and how they can help maintain data consistency.

### Financial Calculations

Managing the relationship between income, expenses, budgets and savings was one of the more interesting parts of the project.

I had to consider different situations, such as editing previous transactions, withdrawing savings and recording expenses when available funds are insufficient.

### Security

Before working on this project, I mainly focused on getting features to work.

During development, I gained a better appreciation of why authentication, server-side validation, session management and data privacy are important, especially when an application stores personal information.

### User Experience

I also learned that a feature can work correctly from a technical perspective but still be inconvenient for the user.

For example, changing the savings restriction from an error to a warning made transaction recording more practical without removing savings contribution limits.

## Current Limitations

SpendWise is a personal learning project and is not intended to replace professional financial software.

Some current limitations include:

- Supports SGD only
- No direct bank account integration
- Transactions must be entered manually
- No recurring transaction automation
- No email verification or password reset
- Transaction summary amounts reflect the current page of results
- Automated tests do not yet cover every database operation

## Future Improvements

Some features I would like to explore in the future include:

- Recurring income and expenses
- Receipt uploads
- Email reminders and budget notifications
- Password recovery
- Multiple currency support
- More detailed financial reports
- Improved mobile experience
- Expanded integration and end-to-end testing

## AI-Assisted Development

AI tools, including ChatGPT and Claude, were used during the development of this project for planning, coding assistance, debugging, reviewing implementations and exploring different solutions.

I also used Base44 as part of the initial interface design exploration.

Throughout development, I worked through the suggested implementations, tested features locally and made adjustments based on the application's requirements and my understanding of the code.

This project was an opportunity for me to explore how AI tools can support software development while still developing my own technical understanding and problem-solving skills.

## Author

**Thuta Zaw (Thomas)**

Diploma in Information Technology  
Singapore Polytechnic

- GitHub: https://github.com/thomaszaw2007

## Project Status

The main features have been implemented. Further testing, documentation and deployment preparation are currently in progress.

SpendWise was developed for personal learning and portfolio purposes.
