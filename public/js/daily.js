const dayInput = document.getElementById('day');
const addForm = document.getElementById('add-form');

let categories = [];
let latestRequest = 0;

setUpAddForm(addForm, () => categories, (savedDate) => {
  dayInput.value = savedDate;
  loadDay();
});
const actions = setUpTransactionActions(() => categories, loadDay);

async function loadDay() {
  const requestNumber = ++latestRequest;

  try {
    const query = dayInput.value ? `?date=${dayInput.value}` : '';
    const data = await apiRequest(`/api/transactions/daily${query}`);
    // Ignore this reply if the user has since picked another date
    if (requestNumber !== latestRequest) return;

    // "today" comes from the server so it is always Singapore time
    dayInput.value = data.date;
    dayInput.max = data.today;
    document.getElementById('journal-link').href = `/calendar.html?date=${data.date}`;
    if (!addForm.elements.date.value) addForm.elements.date.value = data.date;

    document.getElementById('day-income').textContent = formatMoney(data.totals.income);
    document.getElementById('day-expense').textContent = formatMoney(data.totals.expense);
    document.getElementById('day-net').textContent = formatMoney(data.totals.net);

    loadDailyExtras(data.date, data.totals);
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

dayInput.addEventListener('change', () => {
  if (dailyNoteDate && dailyNote.value !== savedDailyNote && !confirm('Discard your unsaved reflection?')) { dayInput.value = dailyNoteDate; return; }
  showMessage('message', '');
  dailyNote.disabled = true; dailyNoteSave.disabled = true;
  addForm.elements.date.value = dayInput.value;
  loadDay(); // an empty date means today
});

async function startPage() {
  try {
    ({ categories } = await apiRequest('/api/categories'));
    fillCategoryOptions(addForm, categories);
  } catch (error) {
    showMessage('message', error.message);
  }
  loadDay();
}


// The daily reflection uses the same private journal endpoint as the calendar.
const dailyNote = document.getElementById('daily-note');
const dailyNoteSave = document.getElementById('daily-note-save');
let dailyNoteDate = null;
let savedDailyNote = '';
let noteRequest = 0;
async function loadDailyExtras(date, totals) {
  const request = ++noteRequest;
  dailyNote.disabled = true;
  dailyNoteSave.disabled = true;
  try {
    const [budgets, journal] = await Promise.all([
      apiRequest(`/api/budgets?month=${date.slice(0,7)}`), apiRequest(`/api/journal/${date}`)
    ]);
    if (request !== noteRequest) return;
    if (dailyNoteDate !== date || dailyNote.value === savedDailyNote) {
      dailyNote.value = journal.entry?.content || '';
      savedDailyNote = dailyNote.value;
    }
    dailyNoteDate = date;
    dailyNote.disabled = false;
    dailyNoteSave.disabled = false;
    const box = document.getElementById('daily-budget-status');
    if (!budgets.daily) { box.textContent = 'Set a daily spending limit on the Budgets page.'; return; }
    // Progress display only; the database remains the source of monetary totals.
    const limit = BigInt(budgets.daily.limit.replace('.',''));
    const spent = BigInt(totals.expense.replace('.',''));
    const left = limit - spent;
    const absolute = (left < 0n ? -left : left).toString().padStart(3,'0');
    const remaining = (left < 0n ? '-' : '') + absolute.slice(0,-2) + '.' + absolute.slice(-2);
    const percent = Number(spent * 10000n / limit) / 100;
    const status = spent > limit ? 'exceeded' : spent === limit ? 'reached' : spent * 100n >= limit * 80n ? 'warning' : 'normal';
    box.replaceChildren(createBudgetSummary('Daily limit', {limit:budgets.daily.limit,spent:totals.expense,remaining,percent,status}));
  } catch (error) { if (request === noteRequest) showMessage('daily-note-message',error.message); }
}
document.getElementById('daily-note-form').addEventListener('submit', async event => {
  event.preventDefault();
  const date = dailyNoteDate;
  if (!date || dailyNote.disabled) return;
  dailyNoteSave.disabled = true;
  const content = dailyNote.value;
  try {
    const data = await apiRequest(`/api/journal/${date}`,{method:'PUT',body:JSON.stringify({content})});
    if (dailyNoteDate === date) { savedDailyNote = content; showMessage('daily-note-message',data.message,'success'); }
  } catch (error) { if (dailyNoteDate === date) showMessage('daily-note-message',error.message); }
  if (dailyNoteDate === date) dailyNoteSave.disabled = dailyNote.disabled;
});

startPage();
