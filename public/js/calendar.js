// The calendar grid and the selected day's transactions.
// Dates are "YYYY-MM-DD" strings. Date.UTC is used for calendar maths so the
// computer's own time zone can never move a date to the day before or after.

const today = todayInSingapore();
const requestedDate = new URLSearchParams(window.location.search).get('date');
const isUsableDate = /^20\d{2}-\d{2}-\d{2}$/.test(requestedDate) && requestedDate <= today
  && !Number.isNaN(Date.parse(requestedDate));

let selectedDate = isUsableDate ? requestedDate : today;
let shownMonth = selectedDate.slice(0, 7);
let categories = [];
let latestMonthRequest = 0;
let latestDayRequest = 0;

const addForm = document.getElementById('add-form');
setUpAddForm(addForm, () => categories, (savedDate) => {
  if (savedDate === selectedDate) refresh();
  else {
    selectDate(savedDate);
    showMessage('add-message', 'Transaction added.', 'success');
  }
});
const actions = setUpTransactionActions(() => categories, refresh);

// "2026-12" plus 1 becomes "2027-01"
function addMonths(month, change) {
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1 + change, 1)).toISOString().slice(0, 7);
}

// "1234.50" becomes "1,234.50" for the small calendar cells
function shortMoney(amount) {
  return formatMoney(amount).replace('S$', '');
}

function createDayCell(date, totals, hasJournal) {
  const cell = createElement('button', '', 'day');
  cell.type = 'button';
  cell.disabled = date > today; // transactions cannot be in the future
  cell.append(createElement('span', String(Number(date.slice(8))), 'day-number'));

  const description = [formatDate(date)];
  if (date === today) cell.classList.add('day-today');
  if (date === selectedDate) {
    cell.classList.add('day-selected');
    cell.setAttribute('aria-pressed', 'true');
  }
  if (totals && totals.income !== '0.00') {
    cell.append(createElement('span', `+${shortMoney(totals.income)}`, 'day-income'));
    description.push(`income ${formatMoney(totals.income)}`);
  }
  if (totals && totals.expense !== '0.00') {
    cell.append(createElement('span', `-${shortMoney(totals.expense)}`, 'day-expense'));
    description.push(`expenses ${formatMoney(totals.expense)}`);
  }
  if (totals && totals.overBudget) {
    cell.classList.add('day-over');
    cell.append(createElement('span', 'Over', 'day-flag'));
    description.push('over daily limit');
  }
  if (hasJournal) {
    cell.append(createElement('span', '✎', 'day-journal'));
    description.push('has journal entry');
  }

  cell.setAttribute('aria-label', description.join(', '));
  cell.addEventListener('click', () => selectDate(date));
  return cell;
}

async function loadMonth() {
  const requestNumber = ++latestMonthRequest;
  const month = shownMonth;

  try {
    const data = await apiRequest(`/api/calendar?month=${month}`);
    if (requestNumber !== latestMonthRequest) return;

    const [year, number] = month.split('-').map(Number);
    document.getElementById('calendar-title').textContent = `${MONTH_NAMES[number - 1]} ${year}`;

    // Day 0 of the next month is the last day of this one (handles leap years)
    const daysInMonth = new Date(Date.UTC(year, number, 0)).getUTCDate();
    // getUTCDay() starts at Sunday = 0; this calendar starts on Monday
    const emptyCells = (new Date(Date.UTC(year, number - 1, 1)).getUTCDay() + 6) % 7;

    const cells = [];
    for (let i = 0; i < emptyCells; i += 1) cells.push(createElement('span'));

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = `${month}-${String(day).padStart(2, '0')}`;
      const totals = data.days.find((d) => d.date === date);
      cells.push(createDayCell(date, totals, data.journalDates.includes(date)));
    }
    document.getElementById('calendar').replaceChildren(...cells);

    document.getElementById('legend').textContent = data.dailyLimit
      ? `+ income, - expenses, ✎ journal, "Over" = above your daily limit of ${formatMoney(data.dailyLimit)}.`
      : '+ income, - expenses, ✎ journal. Set a daily limit on the Budgets page to see overspent days.';

    document.getElementById('previous-month').disabled = month <= '2000-01';
    document.getElementById('next-month').disabled = month >= '2100-12';
  } catch (error) {
    showMessage('message', error.message);
  }
}

async function loadSelectedDay() {
  const requestNumber = ++latestDayRequest;

  try {
    const data = await apiRequest(`/api/transactions/daily?date=${selectedDate}`);
    if (requestNumber !== latestDayRequest) return;

    document.getElementById('selected-title').textContent = formatDate(data.date);
    document.getElementById('day-income').textContent = formatMoney(data.totals.income);
    document.getElementById('day-expense').textContent = formatMoney(data.totals.expense);
    document.getElementById('day-net').textContent = formatMoney(data.totals.net);
    renderTransactions(
      document.getElementById('day-transactions'),
      data.transactions,
      'No transactions on this day.',
      actions
    );
  } catch (error) {
    showMessage('message', error.message);
  }
}

// After a transaction changes, update the totals (the journal is left alone)
function refresh() {
  loadMonth();
  loadSelectedDay();
}

function selectDate(date) {
  // canLeaveJournal, loadJournal and journalDate are in journal.js
  const changed = date !== selectedDate;
  if (changed && !canLeaveJournal()) return;

  selectedDate = date;
  shownMonth = date.slice(0, 7);
  addForm.elements.date.value = date;
  showMessage('message', '');
  showMessage('add-message', '');
  refresh();
  // Reloading the same day's journal would wipe unsaved writing
  if (changed || journalDate !== date) loadJournal();
}

function showMonth(month) {
  shownMonth = month;
  loadMonth();
}

document.getElementById('previous-month').addEventListener('click', () => {
  showMonth(addMonths(shownMonth, -1));
});
document.getElementById('next-month').addEventListener('click', () => {
  showMonth(addMonths(shownMonth, 1));
});
document.getElementById('current-month').addEventListener('click', () => {
  // Goes back to the current month and selects today
  showMonth(today.slice(0, 7));
  selectDate(today);
});
