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
  const label = createElement('strong', '', 'amount-list-label');
  if (budget.categoryColor) label.append(categoryIcon(title, budget.categoryColor));
  label.append(document.createTextNode(title));
  heading.append(
    label,
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
    (() => { const line = createElement('div','','budget-amount-line'); line.append(createElement('strong',`${budget.percent}%`),createElement('span',formatMoney(budget.limit))); return line; })(),
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
    const label = createElement('span', '', 'amount-list-label');
    if (item.color) label.append(categoryIcon(item.name, item.color));
    label.append(document.createTextNode(item.name));
    row.append(label, createElement('strong', formatMoney(item.total)));
    list.append(row);
  }
  container.replaceChildren(list);
}

// Small category markers used throughout the finance pages.
function categoryIcon(name, color) {
  const dot = createElement('span', '', 'category-icon');
  dot.style.backgroundColor = /^#[0-9a-fA-F]{6}$/.test(color || '') ? color : '#64748b';
  dot.setAttribute('aria-hidden', 'true');
  return dot;
}

function renderTimeline(container, transactions, actions) {
  const list = createElement('div', '', 'day-timeline');
  const entries = [...transactions];
  if (container.id === 'day-transactions') entries.reverse();
  for (const t of entries) {
    const row = createElement('div', '', 'timeline-row');
    const detail = createElement('div', '', 'timeline-detail');
    detail.append(createElement('strong', t.description), createElement('small', `${t.categoryName} · ${t.paymentMethod}${t.time ? ' · ' + t.time : ''}`));
    if (t.notes) detail.append(createElement('small', t.notes));
    if (actions) {
      const buttons = createElement('div', '', 'row-actions');
      buttons.append(createButton('Edit','button-secondary',()=>actions.onEdit(t)),createButton('Delete','button-danger',()=>actions.onDelete(t)));
      detail.append(buttons);
    }
    row.append(createElement('span', t.time || formatDate(t.date), 'timeline-time'),categoryIcon(t.categoryName, t.categoryColor),detail,createElement('strong',(t.type === 'income' ? '+' : '-') + formatMoney(t.amount),`amount-${t.type}`));
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

  if (['day-transactions', 'recent-transactions'].includes(container.id)) { renderTimeline(container, transactions, actions); return; }
  const headings = ['Date', 'Description', 'Category', 'Payment', 'Type', 'Amount'];
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

    const date = createElement('span', formatDate(transaction.date), 'transaction-date');
    if (transaction.time) date.append(createElement('small', transaction.time));
    addCell('Date', date);

    const description = createElement('span', transaction.description);
    if (transaction.notes) {
      description.append(createElement('span', transaction.notes, 'notes'));
    }
    const descriptionCell = createElement('div', '', 'transaction-description');
    descriptionCell.append(categoryIcon(transaction.categoryName, transaction.categoryColor), description);
    addCell('Description', descriptionCell);
    addCell('Category', createElement('span', transaction.categoryName));
    addCell('Payment', createElement('span', transaction.paymentMethod));

    addCell('Type', createElement('span', transaction.type === 'income' ? 'Income' : 'Expense', 'badge'));
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

// Simple line icons, defined locally to avoid external libraries.
const navIcons = [
  '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
  '<path d="M3 7h18l-4-4M21 17H3l4 4"/>',
  '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
  '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M15 14h3"/>',
  '<path d="M12 21s-9-5-9-12a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 7-9 12-9 12Z"/>',
  '<path d="M12 3v9h9M10 3a9 9 0 1 0 11 11"/><path d="M15 3a9 9 0 0 1 6 6"/>',
  '<path d="M3 3h8l10 10-8 8L3 11Z"/><circle cx="7.5" cy="7.5" r="1"/>',
  '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2"/>',
];

async function setUpSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  const nav = document.createElement('nav');
  nav.setAttribute('aria-label', 'Main navigation');
  const headings = { 0: 'Overview', 1: 'Money management', 6: 'Insights', 7: 'Preferences' };

  NAV_LINKS.forEach(([href, label], index) => {
    if (headings[index]) nav.append(createElement('span', headings[index], 'nav-heading'));
    const link = createElement('a');
    link.href = href;
    // Only fixed, locally defined SVG markup is used here, never user input.
    link.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${navIcons[index]}</svg>`;
    link.append(createElement('span', label));
    if (window.location.pathname === href) link.setAttribute('aria-current', 'page');
    nav.append(link);
  });

  const theme = createElement('div', '', 'theme-switch');
  for (const choice of ['light', 'system', 'dark']) {
    const button = createButton(choice[0].toUpperCase() + choice.slice(1), 'button-secondary', () => {
      try { localStorage.setItem('spendwise-theme', choice); } catch (error) { return; }
      applyTheme();
    });
    button.dataset.themeChoice = choice;
    theme.append(button);
  }
  const avatar = createElement('span', '?', 'user-avatar');
  const userName = createElement('strong', 'Account');
  const email = createElement('span', '', 'user-email');
  const details = createElement('div', '', 'user-details');
  details.append(userName, email);
  const profile = createElement('div', '', 'sidebar-profile');
  profile.append(avatar, details);
  const logoutButton = createButton('Log out', 'button-secondary', async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' });
      window.location.href = '/login.html';
    } catch (error) {
      showMessage('message', error.message);
    }
  });
  const userArea = createElement('div', '', 'sidebar-user');
  userArea.append(theme, profile, logoutButton);
  const brand = createElement('span', 'SpendWise', 'brand');
  brand.append(createElement('span', '.', 'brand-dot'));
  nav.id = 'main-navigation';
  const menu = createButton('Menu', 'button-secondary mobile-menu', () => {
    const open = sidebar.classList.toggle('menu-open');
    menu.setAttribute('aria-expanded', String(open));
  });
  menu.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-controls', 'main-navigation');
  sidebar.append(brand, menu, nav, userArea);
  applyTheme();

  try {
    const user = await apiRequest('/api/auth/me');
    userName.textContent = user.fullName;
    email.textContent = user.email;
    avatar.textContent = user.fullName.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  } catch (error) {
    showMessage('message', error.message);
  }
}

setUpSidebar();
