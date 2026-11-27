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
  showMessage('message', '');
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

startPage();
