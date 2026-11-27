const monthSelect = document.getElementById('month');
const yearSelect = document.getElementById('year');
let latestRequest = 0;

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

function formatRate(rate) {
  return rate === null ? 'N/A (no income)' : `${rate}%`;
}

function showMonthlyTable(months) {
  const table = document.createElement('table');
  const headRow = table.createTHead().insertRow();
  const headings = ['Month', 'Income', 'Expenses', 'Net', 'Savings rate'];
  headings.forEach((heading) => headRow.append(createElement('th', heading)));
  const body = table.createTBody();

  for (const m of months) {
    const row = body.insertRow();
    const values = [
      shortMonth(m.month),
      formatMoney(m.income),
      formatMoney(m.expense),
      formatMoney(m.net),
      formatRate(m.savingsRate),
    ];
    values.forEach((value, i) => {
      const cell = row.insertCell();
      cell.dataset.label = headings[i];
      cell.textContent = value;
    });
  }
  document.getElementById('monthly-table').replaceChildren(table);
}

function showStatistics(data) {
  const { totals, highestCategory, highestDay } = data;

  setText('total-income', formatMoney(totals.income));
  setText('total-expense', formatMoney(totals.expense));
  setText('total-net', formatMoney(totals.net));
  setText('savings-rate', formatRate(totals.savingsRate));
  setText('average-daily', totals.averageDailyExpense ? formatMoney(totals.averageDailyExpense) : 'N/A');
  setText(
    'highest-category',
    highestCategory ? `${highestCategory.name}: ${formatMoney(highestCategory.total)}` : 'No expenses'
  );
  setText(
    'highest-day',
    highestDay ? `${formatDate(highestDay.date)}: ${formatMoney(highestDay.total)}` : 'No expenses'
  );
}

function showCharts(data) {
  const hasExpenses = data.categorySpending.length > 0;
  const noExpenses = 'No expenses in this period.';

  drawChart('category-chart', doughnutConfig(data.categorySpending), hasExpenses, noExpenses);
  drawChart('payment-chart', doughnutConfig(data.paymentMethods), hasExpenses, noExpenses);

  drawChart('daily-chart', {
    type: 'line',
    data: {
      labels: data.dailySpending.map((d) => formatDate(d.date)),
      datasets: [{
        label: 'Expenses',
        data: data.dailySpending.map((d) => Number(d.total)),
        borderColor: '#047857',
        pointRadius: data.dailySpending.length > 31 ? 0 : 3,
      }],
    },
    options: { scales: { y: { beginAtZero: true } } },
  }, hasExpenses, noExpenses);

  const labels = MONTH_NAMES.map((name) => name.slice(0, 3));
  const hasYearData = data.months.some((m) => m.income !== '0.00' || m.expense !== '0.00');
  drawChart(
    'income-chart',
    incomeExpenseConfig(data.months, labels),
    hasYearData,
    'No transactions in this year.'
  );

  const hasComparison = [...data.months, ...data.previousYearMonths].some((m) => m.expense !== '0.00');
  drawChart('comparison-chart', barConfig(labels, [
    {
      label: String(Number(yearSelect.value) - 1),
      data: data.previousYearMonths.map((m) => Number(m.expense)),
      backgroundColor: '#a8b0b9',
    },
    {
      label: yearSelect.value,
      data: data.months.map((m) => Number(m.expense)),
      backgroundColor: '#047857',
    },
  ]), hasComparison, 'No expenses in these two years.');
}

async function loadAnalytics() {
  const requestNumber = ++latestRequest;
  const query = new URLSearchParams({ year: yearSelect.value, month: monthSelect.value });

  try {
    const data = await apiRequest(`/api/analytics?${query}`);
    if (requestNumber !== latestRequest) return;
    showMessage('message', '');

    const monthName = monthSelect.value ? `${MONTH_NAMES[monthSelect.value - 1]} ` : 'Whole of ';
    setText('period-title', monthName + yearSelect.value);
    setText('year-title', `Month by month in ${yearSelect.value}`);

    showStatistics(data);
    showCharts(data);
    showMonthlyTable(data.months);
  } catch (error) {
    showMessage('message', error.message);
  }
}

setUpMonthPicker(monthSelect, yearSelect);
const currentMonth = monthSelect.value;
monthSelect.prepend(new Option('Whole year', ''));
monthSelect.value = currentMonth;

monthSelect.addEventListener('change', loadAnalytics);
yearSelect.addEventListener('change', loadAnalytics);
loadAnalytics();
