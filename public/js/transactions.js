const filterForm = document.getElementById('filter-form');
const previousButton = document.getElementById('previous-page');
const nextButton = document.getElementById('next-page');

let categories = [];
let appliedFilters = new URLSearchParams();
let currentPage = 1;
let latestRequest = 0;

filterForm.elements.paymentMethod.append(...PAYMENT_METHODS.map((method) => new Option(method)));
const actions = setUpTransactionActions(() => categories, loadHistory);

async function loadHistory() {
  const requestNumber = ++latestRequest;

  try {
    const query = new URLSearchParams(appliedFilters);
    query.set('page', currentPage);
    const data = await apiRequest(`/api/transactions?${query}`);
    if (requestNumber !== latestRequest) return; // a newer request replaced this one

    // The server may reduce the page number, e.g. after deleting the last row
    currentPage = data.page;
    document.getElementById('history-count').textContent = data.total;
    for (const type of ['income', 'expense']) {
      const cents = data.transactions.filter(t => t.type === type).reduce((sum,t) => sum + BigInt(t.amount.replace('.', '')), 0n);
      const value = cents.toString().padStart(3, '0');
      document.getElementById(`history-${type}`).textContent = formatMoney(value.slice(0,-2) + '.' + value.slice(-2));
    }

    const filtering = [...appliedFilters].some(([name, value]) => value && name !== 'sort');
    renderTransactions(
      document.getElementById('history'),
      data.transactions,
      filtering
        ? 'No transactions match these filters.'
        : 'No transactions yet. Add your first one from Daily entry.',
      actions
    );

    document.getElementById('pagination').hidden = data.total === 0;
    document.getElementById('page-info').textContent =
      `Page ${data.page} of ${data.totalPages} (${data.total} total)`;
    previousButton.disabled = data.page <= 1;
    nextButton.disabled = data.page >= data.totalPages;
  } catch (error) {
    showMessage('message', error.message);
  }
}

function applyFilters() {
  const { from, to } = filterForm.elements;
  if (from.value && to.value && from.value > to.value) {
    showMessage('message', 'The "from" date must not be after the "to" date.');
    return;
  }
  showMessage('message', '');
  appliedFilters = new URLSearchParams(new FormData(filterForm));
  currentPage = 1;
  loadHistory();
}

filterForm.addEventListener('submit', (event) => {
  event.preventDefault();
  applyFilters();
});

// Downloads a CSV of everything that matches the applied filters (all pages)
document.getElementById('export-button').addEventListener('click', () => {
  const query = new URLSearchParams(appliedFilters);
  query.delete('page');
  window.location.href = `/api/transactions/export?${query}`;
});

// The reset event fires before the fields are cleared, so wait a moment
filterForm.addEventListener('reset', () => setTimeout(applyFilters));

previousButton.addEventListener('click', () => {
  currentPage -= 1;
  loadHistory();
});

nextButton.addEventListener('click', () => {
  currentPage += 1;
  loadHistory();
});

async function startPage() {
  try {
    ({ categories } = await apiRequest('/api/categories'));

    // Group the category filter into expense and income
    for (const [type, label] of [['expense', 'Expense'], ['income', 'Income']]) {
      const group = document.createElement('optgroup');
      group.label = label;
      group.append(
        ...categories
          .filter((c) => c.type === type)
          .map((c) => new Option(c.isArchived ? `${c.name} (archived)` : c.name, c.id))
      );
      filterForm.elements.categoryId.append(group);
    }
  } catch (error) {
    showMessage('message', error.message);
  }
  loadHistory();
}

startPage();
