
const monthSelect = document.getElementById('month');
const yearSelect = document.getElementById('year');
let latestRequest = 0;

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

// Display a warning without blocking financial activity.
function showBalanceWarning(available, reserved) {
  const balanceElement = document.getElementById('available');
  let warning = document.getElementById('balance-warning');

  if (!warning) {
    warning = document.createElement('p');
    warning.id = 'balance-warning';
    warning.className = 'muted';
    warning.setAttribute('role', 'status');
    balanceElement.after(warning);
  }

  const isNegative = Number(available) < 0;

  warning.hidden = !isNegative;
  balanceElement.style.color = isNegative ? '#dc2626' : '';

  if (!isNegative) {
    warning.textContent = '';
    return;
  }

  const shortfall = formatMoney(Math.abs(Number(available)));

  if (Number(reserved) > 0) {
    warning.textContent =
      `Available funds are short by ${shortfall}. ` +
      'Review your savings goals or record additional income.';
  } else {
    warning.textContent =
      `Your balance is ${shortfall} below zero. ` +
      'You can still record transactions.';
  }
}

function showBudgets(budgets) {
  const items = [];

  if (budgets.monthly) {
    items.push(
      createBudgetSummary('Monthly budget', budgets.monthly)
    );
  }

  items.push(
    ...budgets.categories.map((b) =>
      createBudgetSummary(b.categoryName, b)
    )
  );

  if (budgets.daily) {
    items.push(
      createBudgetSummary('Daily limit (today)', budgets.daily)
    );
  }

  if (items.length === 0) {
    items.push(
      createElement(
        'p',
        'No budgets set for this month.',
        'empty-state'
      )
    );
  }

  document
    .getElementById('budget-progress')
    .replaceChildren(...items);
}

async function loadDashboard() {
  const requestNumber = ++latestRequest;
  const month = `${yearSelect.value}-${monthSelect.value}`;

  try {
    const data = await apiRequest(
      `/api/dashboard?month=${month}`
    );

    if (requestNumber !== latestRequest) return;

    showMessage('message', '');

    setText('balance', formatMoney(data.balance));
    setText('reserved', formatMoney(data.reservedSavings));
    setText('available', formatMoney(data.availableBalance));

    // Warn about negative funds instead of blocking expenses.
    showBalanceWarning(
      data.availableBalance,
      data.reservedSavings
    );

    setText(
      'goal-counts',
      `${data.goalCounts.active} active, ${data.goalCounts.completed} completed.`
    );

    setText(
      'today-income',
      formatMoney(data.todayTotals.income)
    );

    setText(
      'today-expense',
      formatMoney(data.todayTotals.expense)
    );

    const totals = data.monthTotals;

    setText(
      'month-title',
      `${MONTH_NAMES[monthSelect.value - 1]} ${yearSelect.value}`
    );

    setText('month-income', formatMoney(totals.income));
    setText('month-expense', formatMoney(totals.expense));
    setText('month-net', formatMoney(totals.net));

    setText(
      'month-average',
      totals.averageDailyExpense != null
        ? formatMoney(totals.averageDailyExpense)
        : 'N/A'
    );

    showBudgets(data.budgets);
    loadDashboardExtras(month, requestNumber);

    renderAmountList(
      document.getElementById('category-list'),
      data.categorySpending,
      'No expenses in this month.'
    );

    drawChart(
      'category-chart',
      doughnutConfig(data.categorySpending),
      data.categorySpending.length > 0
    );

    const hasTrend = data.sixMonths.some(
      (m) =>
        Number(m.income) !== 0 ||
        Number(m.expense) !== 0
    );

    drawChart(
      'trend-chart',
      incomeExpenseConfig(
        data.sixMonths,
        data.sixMonths.map((m) => shortMonth(m.month))
      ),
      hasTrend,
      'No transactions in these six months.'
    );

    renderTransactions(
      document.getElementById('recent-transactions'),
      data.recent,
      'No transactions yet. Add your first one from Daily Entry.'
    );
  } catch (error) {
    if (requestNumber === latestRequest) {
      showMessage('message', error.message);
    }
  }
}

setUpMonthPicker(monthSelect, yearSelect);

monthSelect.addEventListener('change', loadDashboard);
yearSelect.addEventListener('change', loadDashboard);

loadDashboard();

async function loadDashboardExtras(month, requestNumber) {
  try {
    const [year, number] = month.split('-');

    const [analytics, savings] = await Promise.all([
      apiRequest(`/api/analytics?year=${year}&month=${number}`),
      apiRequest('/api/savings'),
    ]);

    if (requestNumber !== latestRequest) return;

    const days = analytics.dailySpending;

    if (document.getElementById('dashboard-daily-chart')) {
      drawChart(
        'dashboard-daily-chart',
        {
          type: 'line',
          data: {
            labels: days.map((d) => d.date.slice(8)),
            datasets: [
              {
                label: 'Daily spending',
                data: days.map((d) => Number(d.total)),
                pointRadius: 0,
                fill: true,
                backgroundColor: 'rgba(13,145,101,.09)',
              },
            ],
          },
          options: {
            scales: {
              y: {
                beginAtZero: true,
              },
            },
          },
        },
        days.some((d) => Number(d.total) > 0),
        'No expenses this month.'
      );
    }

    const goals = savings.goals
      .filter((g) => g.status !== 'cancelled')
      .slice(0, 3);

    const cards = goals.map((g) => {
      const item = createElement(
        'div',
        '',
        'dashboard-goal'
      );

      const heading = createElement(
        'div',
        '',
        'budget-heading'
      );

      heading.append(
        createElement('strong', g.name),
        createElement('span', `${g.percent}%`)
      );

      const bar = document.createElement('progress');

      bar.max = 100;
      bar.value = Math.min(100, Number(g.percent));

      bar.setAttribute(
        'aria-label',
        `${g.name} progress`
      );

      item.append(
        heading,
        bar,
        createElement(
          'small',
          `${formatMoney(g.saved)} of ${formatMoney(g.targetAmount)}`,
          'muted'
        )
      );

      return item;
    });

    document
      .getElementById('dashboard-goals')
      .replaceChildren(
        ...(cards.length
          ? cards
          : [
              createElement(
                'p',
                'No savings goals yet.',
                'muted'
              ),
            ])
      );
  } catch (error) {
    if (requestNumber === latestRequest) {
      showMessage('message', error.message);
    }
  }
}
