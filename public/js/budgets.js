const monthSelect = document.getElementById('month');
const yearSelect = document.getElementById('year');
const categoryForm = document.getElementById('category-budget-form');
let latestRequest = 0;

function selectedMonth() {
  return `${yearSelect.value}-${monthSelect.value}`;
}

// Sends a change to the server, shows the result and reloads the budgets
async function changeBudget(url, method, body) {
  try {
    const data = await apiRequest(url, { method, body: body && JSON.stringify(body) });
    showMessage('message', data.message, 'success');
    await loadBudgets();
    return true;
  } catch (error) {
    showMessage('message', error.message);
    return false;
  }
}

// An amount box with a Save button. onSave receives the typed amount.
function createAmountForm(label, value, buttonText, onSave) {
  const form = createElement('form', '', 'amount-form');
  const input = document.createElement('input');
  input.value = value;
  input.inputMode = 'decimal';
  input.placeholder = '0.00';
  input.required = true;
  input.setAttribute('aria-label', label);

  form.append(input, createElement('button', buttonText, 'button button-small'));
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    onSave(input.value);
  });
  return form;
}

// A saved budget: its progress, plus controls to edit or delete it
function createBudgetEditor(title, budget) {
  const url = `/api/budgets/${budget.id}`;
  const form = createAmountForm(`${title} amount`, budget.limit, 'Save', (amount) => {
    changeBudget(url, 'PUT', { amount });
  });
  form.append(
    createButton('Delete', 'button-danger', () => {
      if (window.confirm(`Delete this budget (${title})?`)) changeBudget(url, 'DELETE');
    })
  );

  const box = createElement('div', '', 'budget-item');
  box.append(createBudgetSummary(title, budget), form);
  return box;
}

// Shows the saved budget, or a form to create one
function showSingleBudget(containerId, type, title, budget) {
  const container = document.getElementById(containerId);

  if (budget) {
    container.replaceChildren(createBudgetEditor(title, budget));
    return;
  }

  const month = selectedMonth();
  container.replaceChildren(
    createElement('p', 'Not set.', 'muted'),
    createAmountForm(`${title} amount`, '', 'Set budget', (amount) => {
      changeBudget('/api/budgets', 'POST', { type, month, amount });
    })
  );
}

async function loadBudgets() {
  const requestNumber = ++latestRequest;
  const month = selectedMonth();
  const monthName = `${MONTH_NAMES[monthSelect.value - 1]} ${yearSelect.value}`;

  try {
    const data = await apiRequest(`/api/budgets?month=${month}`);
    if (requestNumber !== latestRequest) return;

    document.getElementById('monthly-title').textContent = `Monthly budget: ${monthName}`;
    document.getElementById('category-title').textContent = `Category budgets: ${monthName}`;

    showSingleBudget('daily-budget', 'daily', 'Daily limit (today)', data.daily);
    showSingleBudget('monthly-budget', 'monthly', monthName, data.monthly);

    const items = data.categories.map((b) => createBudgetEditor(b.categoryName, b));
    if (items.length === 0) {
      items.push(createElement('p', 'No category budgets for this month.', 'empty-state'));
    }
    document.getElementById('category-budgets').replaceChildren(...items);
  } catch (error) {
    showMessage('message', error.message);
  }
}

categoryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const body = {
    type: 'category',
    month: selectedMonth(),
    ...Object.fromEntries(new FormData(categoryForm)),
  };
  if (await changeBudget('/api/budgets', 'POST', body)) categoryForm.reset();
});

async function startPage() {
  try {
    const { categories } = await apiRequest('/api/categories');
    categoryForm.elements.categoryId.append(
      new Option('Select...', ''),
      ...categories
        .filter((c) => c.type === 'expense' && !c.isArchived)
        .map((c) => new Option(c.name, c.id))
    );
  } catch (error) {
    showMessage('message', error.message);
  }
  loadBudgets();
}

setUpMonthPicker(monthSelect, yearSelect);
for (const select of [monthSelect, yearSelect]) {
  select.addEventListener('change', () => {
    showMessage('message', '');
    loadBudgets();
  });
}
startPage();
