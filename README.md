

# SpendWise

SpendWise is a personal finance management web application that I developed to improve my full-stack development skills outside of my school assignments.

The application allows users to track their income, expenses, budgets and savings goals while understanding their spending habits through financial summaries and charts.

## Technology Stack

- Frontend: HTML, CSS, Vanilla JavaScript
- Backend: Node.js, Express.js
- Database: PostgreSQL
- Data Visualisation: Chart.js
- Testing: Jest, Supertest
- Version Control: Git, GitHub

## Live Demo

[Try SpendWise](https://spendwise-do7f.onrender.com)

Hosted on Render with a Neon PostgreSQL database.

Note: The initial page load may take 50 seconds or longer due to free hosting limitations. Please use fictional financial data when testing.

## About the Project


## About the Project

SpendWise is a personal project that I developed to improve my full-stack development skills outside of my school assignments.

As a Diploma in Information Technology student at Singapore Polytechnic, I wanted to build a complete web application where I could apply what I have learned in frontend development, backend programming and database management.

I chose personal finance management because keeping track of daily expenses, budgets and savings is something that is relevant to everyday life. I wanted to create an application that makes this process more organised and easier to understand.

The project started with basic authentication and transaction management before gradually expanding into financial analytics, budgeting, savings goals and account management.

Throughout development, I focused on making the application functional, easy to use and consistent across different pages while learning more about how a full-stack application works.

## Table of Contents

- [Features](#features)
- [Application Screenshots](#application-screenshots)
- [Technology Stack](#technology-stack)
- [System Architecture](#system-architecture)
- [Database Design](#database-design)
- [Financial Logic](#financial-logic)
- [Security and Data Privacy](#security-and-data-privacy)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Demo Account](#demo-account)
- [Testing](#testing)
- [Challenges and Lessons Learned](#challenges-and-lessons-learned)
- [Current Limitations](#current-limitations)
- [Future Improvements](#future-improvements)
- [AI-Assisted Development](#ai-assisted-development)
- [Author](#author)

## Features

### Dashboard

- View current balance, available funds and reserved savings.
- Monitor daily and monthly income and expenses.
- View recent transactions.
- Track budget progress and savings goals.
- Visualise financial activity through interactive charts.
- Select different months and years to view previous financial activity.

### Transaction Management

- Record income and expenses.
- Edit and delete existing transactions.
- Organise transactions using categories.
- Search transactions by description.
- Filter by category, transaction type, payment method and date.
- Sort transactions by date or amount.
- Browse transaction history with pagination.
- Export filtered transactions to CSV.

### Daily Entry and Journal

- Quickly record daily financial activity.
- View income, expenses and net balance for a selected date.
- Monitor daily budget usage.
- Write and manage personal daily reflections.
- Review previous journal entries.

### Category Management

- Create custom income and expense categories.
- Edit category names and colours.
- Archive categories that are no longer needed.
- Preserve existing transactions when categories are archived.
- Use category colours in transaction lists and spending charts.

### Spending Calendar

- View financial activity in a monthly calendar.
- Identify daily income and expenses.
- Navigate between different months.
- Review spending patterns and daily budget usage.

### Budget Management

- Set daily spending limits.
- Create monthly budgets.
- Set individual category budgets.
- Monitor spending through progress indicators.
- Receive warnings when approaching or exceeding budget limits.

Budgets are used to monitor spending rather than restrict users from recording transactions.

### Financial Analytics

- Compare income and expenses.
- View monthly financial summaries.
- Analyse spending by category.
- Visualise daily spending trends.
- Review six-month financial trends.
- Calculate average daily expenses and savings rates.

### Savings Goals

- Create multiple savings goals.
- Set target amounts and optional target dates.
- Add and withdraw savings.
- Track progress towards individual targets.
- View contribution and withdrawal history.
- Complete or cancel savings goals.
- Display warnings when available funds become negative.

Savings contributions reserve money from the current balance without recording them as expenses.

### Account Management

- Register and log in to individual accounts.
- Update personal information.
- Change account passwords.
- Set or update opening balances.
- Switch between light, dark and system appearance.
- Permanently delete an account and its associated records.


## Application Screenshots

The following screenshots showcase the main features of SpendWise in dark mode.

### Landing Page

![Landing Page](docs/screenshots/landing1.jpg)

### Login Page

![Login Page](docs/screenshots/log_in_page.jpg)

### Registration Page

![Registration Page](docs/screenshots/Register_page.jpg)

### Dashboard

![Dashboard](docs/screenshots/Dashboard.jpg)

### Daily Entry

![Daily Entry](docs/screenshots/Daily_Entry.jpg)

### Transaction History

![Transaction History](docs/screenshots/Transactions.jpg)

### Spending Calendar

![Spending Calendar](docs/screenshots/Calendar.jpg)

### Budget Management

![Budget Management](docs/screenshots/Budget.jpg)

### Financial Analytics

![Financial Analytics](docs/screenshots/Analytics.jpg)

### Savings Goals

![Savings Goals](docs/screenshots/Saving_Goals.jpg)

### Category Management

![Category Management](docs/screenshots/Categories.jpg)

### Account Settings

![Account Settings](docs/screenshots/Setting.jpg)

### Responsive Design

SpendWise supports different screen sizes, including mobile devices.

<img src="docs/screenshots/mobile.png" alt="SpendWise Mobile View" width="320">

## Technology Stack

| Area | Technologies |
| --- | --- |
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| Data Visualisation | Chart.js |
| Authentication | bcrypt, Express Session |
| Session Storage | connect-pg-simple |
| Security | Helmet, CSRF protection, rate limiting |
| API | REST API, JSON |
| Testing | Jest, Supertest |
| Version Control | Git, GitHub |
| Development Tools | Visual Studio Code, pgAdmin |

I chose vanilla JavaScript instead of a frontend framework because I wanted to strengthen my understanding of JavaScript, DOM manipulation, API requests and how frontend pages communicate with a backend.

## System Architecture

SpendWise uses a client-server architecture with a separate frontend, backend and database.

```mermaid
flowchart TD
    A["User / Web Browser"] --> B["HTML, CSS and JavaScript"]

    B -->|"HTTP Requests"| C["Express.js REST API"]

    C --> D["Authentication and Middleware"]

    D --> E["Application Routes"]

    E --> F["Financial Logic and Validation"]

    F -->|"Parameterised SQL Queries"| G[("PostgreSQL Database")]

    G -->|"Query Results"| F

    F --> E

    E -->|"JSON Responses"| B

    B --> H["Dashboard, Charts and User Interface"]
```

### Frontend

The frontend handles the user interface, forms, navigation, charts and interaction with the backend.

JavaScript is used to send API requests, process responses and update page content dynamically without requiring a full page reload for every operation.

### Backend

The Express backend handles authentication, input validation, session management, financial calculations and database operations.

Routes are separated according to their features to make the code easier to maintain.

### Database

PostgreSQL stores user accounts, transactions, categories, budgets, journal entries, savings goals and login sessions.

Financial summaries are calculated using SQL queries based on the user's stored records.

## Database Design

The application uses a relational database consisting of eight main tables.

| Table | Description |
| --- | --- |
| `users` | Stores account information, password hashes and opening balances. |
| `sessions` | Stores login sessions. |
| `categories` | Stores income and expense categories. |
| `transactions` | Stores financial transaction records. |
| `budgets` | Stores daily, monthly and category budgets. |
| `journal_entries` | Stores personal daily reflections. |
| `savings_goals` | Stores savings targets and goal information. |
| `savings_entries` | Stores savings contributions, withdrawals and releases. |

Primary keys, foreign keys and database constraints are used to maintain relationships and help prevent inconsistent records.

### Entity Relationship Diagram

![SpendWise Database ERD](docs/database-erd.png)

## Financial Logic

One of the main parts of developing SpendWise was deciding how transactions, balances, budgets and savings should work together.

### Current Balance

```text
Current Balance = Opening Balance + Total Income - Total Expenses
```

The current balance represents the user's recorded financial position based on their opening balance and transaction history.

### Available Spending Balance

```text
Available Balance = Current Balance - Reserved Savings
```

Reserved savings represent money allocated towards savings goals.

For example:

| Description | Amount |
| --- | ---: |
| Current balance | S$500.00 |
| Reserved savings | S$200.00 |
| Available spending balance | S$300.00 |

A savings contribution does not count as an expense because the money still belongs to the user.

### Negative Balances

During development, I initially prevented users from recording expenses if doing so would reduce their balance below their reserved savings.

After testing the feature, I realised that this restriction made the application less practical. A financial tracker should allow users to record what actually happens to their money, even when they overspend.

I changed the implementation to allow negative balances and display a warning instead.

Existing savings records remain unchanged, while additional savings contributions are still restricted by the available balance and the remaining goal target.

### Budget Calculations

Budget progress is calculated based on recorded expenses.

| Budget Usage | Status |
| --- | --- |
| Below 80% | Within budget |
| 80% to below 100% | Approaching limit |
| 100% | Budget reached |
| Above 100% | Budget exceeded |

Budget warnings do not prevent users from recording expenses.

### Savings Rate

```text
Savings Rate = (Income - Expenses) / Income × 100
```

The savings rate is displayed as unavailable when no income has been recorded for the selected period.

### Financial Data Consistency

Monetary values are stored using PostgreSQL's `NUMERIC` data type to avoid unnecessary floating-point rounding issues.

Database transactions and user-level row locking are used when updating balances and savings allocations to help prevent conflicting operations.

Savings goal progress is calculated from contribution and withdrawal history instead of maintaining a separate manually updated total.

## Security and Data Privacy

Since SpendWise handles personal financial information, I included several security measures during development.

| Security Measure | Purpose |
| --- | --- |
| Password hashing | Uses bcrypt instead of storing plain-text passwords. |
| Session authentication | Maintains authenticated user sessions. |
| PostgreSQL session storage | Stores session information in the database. |
| HTTP-only cookies | Prevents browser JavaScript from reading session cookies. |
| Secure production cookies | Restricts session cookies to HTTPS connections in production. |
| CSRF protection | Helps protect state-changing requests. |
| Rate limiting | Limits repeated authentication and password verification attempts. |
| Server-side validation | Checks submitted data before processing it. |
| Parameterised SQL | Helps prevent SQL injection. |
| User-specific queries | Restricts financial records to the authenticated user. |
| Helmet | Provides additional HTTP security headers. |
| Environment variables | Keeps database credentials and session secrets outside the source code. |
| Restricted database user | Reduces the application's database privileges during local development. |

Account deletion requires password verification and an explicit confirmation before removing the user's records.

Changing an account password also removes other stored sessions belonging to that account.

These measures provide a foundation for application security, although additional security testing would be necessary before using SpendWise for real-world financial services.

## Project Structure

```text
SpendWise/
│
├── docs/
│   ├── database-erd.png
│   └── screenshots/
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
│   │
│   ├── routes/
│   │
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

The following software is required to run the project locally:

- Node.js
- npm
- PostgreSQL
- Git
- pgAdmin (optional)

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

Create a `.env` file based on `.env.example`.

For Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Configure the following values:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/SpendWise
SESSION_SECRET=your_random_session_secret
PORT=3000
```

Replace the example credentials with your own PostgreSQL connection details.

Passwords containing special URL characters must be URL-encoded in the connection string.

Generate a random session secret using:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

The `.env` file contains private configuration details and should never be committed to GitHub.

### 4. Set Up the Database

Create a PostgreSQL database named `SpendWise`.

The database name is case-sensitive when using the provided connection string.

Open the Query Tool in pgAdmin and execute the SQL migration files in the following order:

```text
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

The migration files are located in:

```text
server/db/migrations/
```

Each migration should only be applied once.

The database user configured in `.env` must have the necessary permissions to access the application's tables and sequences.

### 5. Start the Application

```bash
npm run dev
```

Open the application in your browser:

http://localhost:3000

You can then register an account and start recording transactions.

## Demo Account

A demo seed script is included to make local testing and demonstrations easier.

After setting up the database, run:

```bash
npm run seed:demo
```

The script creates a fictional demo account containing:

- Six months of sample financial activity.
- Income and expense transactions.
- Financial categories.
- Monthly budgets.
- Savings goals.
- Daily journal entries.

The demo account uses the following email:

```text
demo@spendwise.example
```

A password is generated and displayed in the terminal when the account is created.

The script does not overwrite an existing demo account.

All demo financial records are fictional and are intended for local testing, screenshots and demonstrations only.

The seed script should not be run against a production database.

## Testing

SpendWise uses Jest and Supertest for automated testing.

Run the tests with:

```bash
npm test
```

### Automated Test Coverage

| Area | Tested Behaviour |
| --- | --- |
| Authentication | Unauthenticated API requests are rejected. |
| Protected pages | Unauthenticated users are redirected to the login page. |
| CSRF protection | Requests without a required token are rejected. |
| Registration | Password confirmation is validated. |
| Transactions | Invalid transaction amounts are rejected. |
| Date validation | Invalid dates and months are rejected. |
| Financial calculations | Monetary values and signed amounts are validated. |
| Savings | Invalid contribution amounts are rejected by validation. |
| Password requirements | Password length and confirmation are validated. |
| CSV export | Values are escaped and formatted correctly. |
| Balance handling | Negative available balance values are accepted. |
| Database transactions | Commit and rollback behaviour is tested using mocks. |
| User scoping | The correct user ID is passed to balance queries. |

The automated tests use validation functions, unauthenticated API requests and mocked database operations rather than modifying actual financial records.

### Manual Testing

Manual testing was also carried out during development to review how different features worked together.

This included:

- Registration, login and logout.
- Creating, editing and deleting transactions.
- Updating categories.
- Creating and monitoring budgets.
- Savings contributions and withdrawals.
- Negative balance handling.
- Financial chart rendering.
- Account settings.
- Light and dark appearance.
- Responsive page layouts.

Automated testing does not currently cover every authenticated database operation or possible user interaction.

## Challenges and Lessons Learned

### Connecting the Frontend and Backend

One of my main goals was to become more comfortable with building a complete application instead of working on individual frontend or backend exercises.

Through this project, I gained more experience with sending API requests, processing JSON responses, updating the interface dynamically and handling errors between the frontend and backend.

### Database Design and SQL

Working with PostgreSQL helped me improve my understanding of relational databases and the relationships between different types of records.

I became more familiar with SQL queries, aggregations, constraints and calculating financial summaries directly from stored data.

I also explored database transactions and row locking to understand how multiple requests can affect data consistency.

### Financial Logic

Managing balances and savings was one of the more challenging parts of the project because a single transaction can affect several financial calculations.

I had to consider what should happen when users edit previous transactions, withdraw savings, change their opening balances or spend more than their available funds.

This helped me understand the importance of defining business rules before implementing a feature.

### Security

Before developing SpendWise, I mainly focused on getting application features to work.

During development, I realised that handling user accounts and private financial records also requires proper authentication, validation, database permissions and session management.

I learned more about how these security measures work together and why frontend validation alone is not sufficient.

### Improving the User Experience

The original savings implementation prevented users from recording expenses when their reserved savings would be affected.

Although the restriction worked technically, it was inconvenient when trying to record actual expenses.

Changing it to a non-blocking warning helped me understand that a technically correct feature is not necessarily the most practical solution for the user.

### Debugging and Testing

Throughout the project, I encountered issues involving database connections, SQL queries, authentication and frontend rendering.

Working through these issues helped me become more comfortable with reading error messages, identifying the source of a problem and testing changes before committing them.

Using Git also helped me keep track of the project's development and separate different feature updates.

## Current Limitations

SpendWise is a personal learning project rather than a commercial financial service.

The current version has the following limitations:

- Supports SGD only.
- Transactions must be entered manually.
- No direct bank account integration.
- No recurring transaction automation.
- No email verification or password recovery.
- Budget limits do not roll over between months.
- Transaction summary amounts reflect the current page of results.
- Automated tests do not cover every database operation.
- Further security and performance testing would be required for real-world use.

## Future Improvements

If I continue developing SpendWise, I would like to explore:

- Recurring income and expense management.
- Receipt uploads.
- Budget reminders and notifications.
- Password recovery and email verification.
- Multiple currency support.
- More detailed financial reporting.
- Improved accessibility.
- Additional integration and end-to-end testing.

## AI-Assisted Development

ChatGPT and Claude were used throughout this project for planning, coding assistance, debugging, code review and exploring different implementation approaches.

Base44 was also used during the initial interface design exploration.

I reviewed and worked with the suggested implementations, configured the development environment, tested features locally and made adjustments based on the project's requirements and usability.

The project gave me an opportunity to explore how AI tools can support software development while improving my understanding of the technologies and decisions involved.

## Author

**Thuta Zaw (Thomas)**

Diploma in Information Technology  
Singapore Polytechnic

Interested in software engineering, full-stack development and building practical applications.

GitHub: [thomaszaw2007](https://github.com/thomaszaw2007)

## Project Status

The main application features have been implemented and the project is currently being prepared for public deployment.

SpendWise was developed for personal learning and portfolio purposes.
