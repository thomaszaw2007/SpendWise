// The add/edit transaction form, plus editing and deleting.
// Used by the daily entry page and the transactions page.

const PAYMENT_METHODS = ['Cash', 'Card', 'PayNow', 'Bank Transfer', 'E-wallet', 'Other'];

// This HTML is fixed text written by us (no user data), so innerHTML is safe
function transactionFormHtml(prefix) {
  return `
    <div>
      <label for="${prefix}-type">Type</label>
      <select id="${prefix}-type" name="type">
        <option value="expense">Expense</option>
        <option value="income">Income</option>
      </select>
    </div>
    <div>
      <label for="${prefix}-amount">Amount (SGD)</label>
      <input id="${prefix}-amount" name="amount" inputmode="decimal" placeholder="0.00"
             pattern="[0-9]{1,10}(\\.[0-9]{1,2})?" title="A number with up to 2 decimal places" required>
    </div>
    <div>
      <label for="${prefix}-category">Category</label>
      <select id="${prefix}-category" name="categoryId" required></select>
    </div>
    <div class="full-width">
      <label for="${prefix}-description">Description</label>
      <input id="${prefix}-description" name="description" maxlength="120" required>
    </div>
    <div>
      <label for="${prefix}-date">Date</label>
      <input type="date" id="${prefix}-date" name="date" min="2000-01-01" required>
    </div>
    <div>
      <label for="${prefix}-time">Time (optional)</label>
      <input type="time" id="${prefix}-time" name="time">
    </div>
    <div>
      <label for="${prefix}-payment">Payment method</label>
      <select id="${prefix}-payment" name="paymentMethod"></select>
    </div>
    <div class="full-width">
      <label for="${prefix}-notes">Notes (optional)</label>
      <textarea id="${prefix}-notes" name="notes" rows="2" maxlength="500"></textarea>
    </div>
    <div class="full-width form-actions">
      <button type="submit" class="button">Save</button>
    </div>`;
}

// Lists the categories for the chosen type. Archived ones are hidden, unless
// it is the category already used by the transaction being edited.
function fillCategoryOptions(form, categories, currentCategoryId) {
  const type = form.elements.type.value;
  const options = categories
    .filter((c) => c.type === type && (!c.isArchived || c.id === currentCategoryId))
    .map((c) => new Option(c.isArchived ? `${c.name} (archived)` : c.name, c.id));

  form.elements.categoryId.replaceChildren(new Option('Select...', ''), ...options);
}

function createTransactionForm(form, prefix) {
  form.innerHTML = transactionFormHtml(prefix);
  form.elements.paymentMethod.append(...PAYMENT_METHODS.map((method) => new Option(method)));
  form.elements.date.max = todayInSingapore();
}

// Sets up an "add transaction" form. onSaved receives the saved date.
function setUpAddForm(form, getCategories, onSaved) {
  createTransactionForm(form, 'add');

  form.elements.type.addEventListener('change', () => {
    fillCategoryOptions(form, getCategories());
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const savedDate = form.elements.date.value;

    if (await saveTransaction(form, '/api/transactions', 'POST', 'add-message')) {
      // Keep type, date and payment method to make the next entry quicker
      for (const field of ['amount', 'description', 'time', 'notes', 'categoryId']) {
        form.elements[field].value = '';
      }
      showMessage('add-message', 'Transaction added.', 'success');
      onSaved(savedDate);
    }
  });
}

// Sends the form to the server. Returns true if it was saved.
async function saveTransaction(form, url, method, messageId) {
  const submitButton = form.querySelector('[type="submit"]');
  submitButton.disabled = true; // stops double clicks creating duplicates
  showMessage(messageId, '');

  try {
    const body = Object.fromEntries(new FormData(form));
    await apiRequest(url, { method, body: JSON.stringify(body) });
    return true;
  } catch (error) {
    showMessage(messageId, error.message);
    return false;
  } finally {
    submitButton.disabled = false;
  }
}

// Sets up the edit dialog and returns the Edit and Delete actions.
// getCategories returns the latest category list; onChange reloads the page data.
function setUpTransactionActions(getCategories, onChange) {
  const dialog = document.getElementById('edit-dialog');
  const form = document.getElementById('edit-form');
  let editing = null;

  createTransactionForm(form, 'edit');

  const cancelButton = createElement('button', 'Cancel', 'button button-secondary');
  cancelButton.type = 'button';
  cancelButton.addEventListener('click', () => dialog.close());
  form.querySelector('.form-actions').append(cancelButton);

  form.elements.type.addEventListener('change', () => {
    fillCategoryOptions(form, getCategories(), editing.categoryId);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const url = `/api/transactions/${editing.id}`;

    if (await saveTransaction(form, url, 'PUT', 'edit-message')) {
      dialog.close();
      showMessage('message', 'Transaction updated.', 'success');
      onChange();
    }
  });

  function onEdit(transaction) {
    editing = transaction;
    showMessage('edit-message', '');
    form.elements.type.value = transaction.type;
    fillCategoryOptions(form, getCategories(), transaction.categoryId);

    for (const field of ['categoryId', 'amount', 'description', 'date', 'time', 'paymentMethod', 'notes']) {
      form.elements[field].value = transaction[field] ?? '';
    }
    dialog.showModal();
  }

  async function onDelete(transaction) {
    if (!window.confirm(`Delete "${transaction.description}"? This cannot be undone.`)) return;

    try {
      await apiRequest(`/api/transactions/${transaction.id}`, { method: 'DELETE' });
      showMessage('message', 'Transaction deleted.', 'success');
      onChange();
    } catch (error) {
      showMessage('message', error.message);
    }
  }

  return { onEdit, onDelete };
}
