// Shared by all logged-in pages: sidebar, formatting and the transaction table

const NAV_LINKS = [
  ['/dashboard.html', 'Dashboard'],
  ['/daily.html', 'Daily Entry'],
  ['/transactions.html', 'Transactions'],
  ['/calendar.html', 'Calendar'],
  ['/budgets.html', 'Budgets'],
  ['/savings.html', 'Savings Goals'],
  ['/analytics.html', 'Analytics'],
  ['/categories.html', 'Categories'],
  ['/settings.html', 'Settings'],
];

// Creates an element with optional text. textContent never runs HTML,
// so it is safe for text that users typed.
function createElement(tag, text = '', className = '') {
  const element = document.createElement(tag);
  element.textContent = text;
  element.className = className;
  return element;
}

function createButton(text, className, onClick) {
  const button = createElement('button', text, `button button-small ${className}`);
  button.type = 'button';
  button.addEventListener('click', onClick);
  return button;
}

// Turns "-1234.50" into "-S$1,234.50" using only string operations,
// so the amount is never rounded by floating point maths
function formatMoney(amount) {
  const negative = amount.startsWith('-');
  const [dollars, cents = '00'] = amount.replace('-', '').split('.');
  const withCommas = dollars.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}S$${withCommas}.${cents}`;
}

// Turns "2026-11-27" into "27 Nov 2026"
function formatDate(date) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function todayInSingapore() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Singapore' }).format(new Date());
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Fills a month dropdown and a year dropdown and selects the current month
function setUpMonthPicker(monthSelect, yearSelect) {
  const [year, month] = todayInSingapore().split('-').map(Number);

  monthSelect.append(...MONTH_NAMES.map((name, i) => new Option(name, String(i + 1).padStart(2, '0'))));
  for (let y = year + 1; y >= 2000; y -= 1) yearSelect.append(new Option(y, y));

  monthSelect.value = String(month).padStart(2, '0');
  yearSelect.value = year;
}

const BUDGET_STATUS = {
  normal: 'Normal',
  warning: 'Approaching limit',
  reached: 'Limit reached',
  exceeded: 'Exceeded',
};

// Limit, spending, remaining amount, percentage, progress bar and status
function createBudgetSummary(title, budget) {
  const box = createElement('div', '', `budget budget-${budget.status}`);

  const heading = createElement('div', '', 'budget-heading');
  heading.append(
    createElement('strong', title),
    createElement('span', BUDGET_STATUS[budget.status], 'badge')
  );

  const bar = document.createElement('progress');
  bar.max = 100;
  bar.value = Math.min(Number(budget.percent), 100);
  bar.setAttribute('aria-label', `${title}: ${budget.percent}% used`);

  const remaining = budget.remaining.startsWith('-')
    ? `Over by ${formatMoney(budget.remaining.slice(1))}`
    : `Remaining ${formatMoney(budget.remaining)}`;

  box.append(
    heading,
    bar,
    createElement(
      'p',
      `Spent ${formatMoney(budget.spent)} of ${formatMoney(budget.limit)} (${budget.percent}%). ${remaining}.`,
      'budget-text'
    )
  );
  return box;
}

// A simple list of names and amounts
function renderAmountList(container, items, emptyText) {
  if (items.length === 0) {
    container.replaceChildren(createElement('p', emptyText, 'empty-state'));
    return;
  }

  const list = createElement('ul', '', 'plain-list');
  for (const item of items) {
    const row = document.createElement('li');
    row.append(createElement('span', item.name), createElement('strong', formatMoney(item.total)));
    list.append(row);
  }
  container.replaceChildren(list);
}

// Builds a table of transactions. Pass onEdit and onDelete to add buttons.
function renderTransactions(container, transactions, emptyText, actions) {
  if (transactions.length === 0) {
    container.replaceChildren(createElement('p', emptyText, 'empty-state'));
    return;
  }

  const headings = ['Date', 'Description', 'Category', 'Payment', 'Amount'];
  if (actions) headings.push('Actions');

  const table = document.createElement('table');
  const headRow = table.createTHead().insertRow();
  headings.forEach((heading) => headRow.append(createElement('th', heading)));
  const body = table.createTBody();

  for (const transaction of transactions) {
    const row = body.insertRow();
    const addCell = (label, content) => {
      const cell = row.insertCell();
      cell.dataset.label = label;
      cell.append(content);
    };

    const time = transaction.time ? `, ${transaction.time}` : '';
    addCell('Date', createElement('span', formatDate(transaction.date) + time));

    const description = createElement('span', transaction.description);
    if (transaction.notes) {
      description.append(createElement('span', transaction.notes, 'notes'));
    }
    addCell('Description', description);
    addCell('Category', createElement('span', transaction.categoryName));
    addCell('Payment', createElement('span', transaction.paymentMethod));

    const sign = transaction.type === 'income' ? '+' : '-';
    addCell(
      'Amount',
      createElement('span', sign + formatMoney(transaction.amount), `amount-${transaction.type}`)
    );

    if (actions) {
      const buttons = createElement('span', '', 'row-actions');
      buttons.append(
        createButton('Edit', 'button-secondary', () => actions.onEdit(transaction)),
        createButton('Delete', 'button-danger', () => actions.onDelete(transaction))
      );
      addCell('Actions', buttons);
    }
  }

  container.replaceChildren(table);
}

async function setUpSidebar() {
  const sidebar = document.getElementById('sidebar');
  const nav = document.createElement('nav');

  for (const [href, label] of NAV_LINKS) {
    const link = createElement('a', label);
    link.href = href;
    if (window.location.pathname === href) link.setAttribute('aria-current', 'page');
    nav.append(link);
  }

  const userName = createElement('span');
  const logoutButton = createButton('Log out', 'button-secondary', async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login.html';
    } catch (error) {
      showMessage('message', error.message);
    }
  });
  const userArea = createElement('div', '', 'sidebar-user');
  userArea.append(userName, logoutButton);

  sidebar.append(createElement('span', 'SpendWise', 'brand'), nav, userArea);

  try {
    const user = await apiRequest('/api/auth/me');
    userName.textContent = user.fullName;
  } catch (error) {
    showMessage('message', error.message);
  }
}

setUpSidebar();
