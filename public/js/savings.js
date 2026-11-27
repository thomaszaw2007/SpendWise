const goalForm = document.getElementById('goal-form');
const editForm = document.getElementById('edit-form');
const entryForm = document.getElementById('entry-form');
const entryDialog = document.getElementById('entry-dialog');
const editDialog = document.getElementById('edit-dialog');
const historyDialog = document.getElementById('history-dialog');

const STATUS_LABELS = { active: 'Active', completed: 'Completed', cancelled: 'Cancelled' };
const ENTRY_LABELS = {
  contribution: 'Contribution',
  withdrawal: 'Withdrawal',
  release: 'Released (goal cancelled)',
};

let latestSummary = null;
let editingGoal = null;
let entryGoal = null;
let entryKind = ''; // 'contributions' or 'withdrawals'

// The form fields for a goal. Used by both the "new" form and the edit dialog.
// This HTML is fixed text written by us (no user data), so innerHTML is safe.
function goalFieldsHtml(prefix) {
  return `
    <div class="full-width">
      <label for="${prefix}-name">Goal name</label>
      <input id="${prefix}-name" name="name" maxlength="80" required>
    </div>
    <div class="full-width">
      <label for="${prefix}-description">Description (optional)</label>
      <textarea id="${prefix}-description" name="description" rows="2" maxlength="300"></textarea>
    </div>
    <div>
      <label for="${prefix}-amount">Target amount (SGD)</label>
      <input id="${prefix}-amount" name="targetAmount" inputmode="decimal" placeholder="0.00"
             pattern="[0-9]{1,10}(\\.[0-9]{1,2})?" title="A number with up to 2 decimal places" required>
    </div>
    <div>
      <label for="${prefix}-date">Target date (optional)</label>
      <input type="date" id="${prefix}-date" name="targetDate">
    </div>
    <div class="full-width form-actions">
      <button type="submit" class="button">Save</button>
      ${prefix === 'edit' ? '<button type="button" class="button button-secondary" data-close-dialog>Close</button>' : ''}
    </div>`;
}

goalForm.innerHTML = goalFieldsHtml('new');
editForm.innerHTML = goalFieldsHtml('edit');
goalForm.elements.targetDate.min = todayInSingapore();

// Every Close button closes the dialog it is in
document.querySelectorAll('[data-close-dialog]').forEach((button) => {
  button.addEventListener('click', () => button.closest('dialog').close());
});

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

function showSummary(summary) {
  latestSummary = summary;
  setText('balance', formatMoney(summary.balance));
  setText('reserved', formatMoney(summary.reserved));
  setText('available', formatMoney(summary.available));
  setText('active-count', summary.goalCounts.active);
  setText('completed-count', summary.goalCounts.completed);
}

function createGoalCard(goal) {
  const card = createElement('div', '', `goal goal-${goal.status}`);

  const heading = createElement('div', '', 'budget-heading');
  heading.append(createElement('strong', goal.name), createElement('span', STATUS_LABELS[goal.status], 'badge'));
  card.append(heading);

  if (goal.description) card.append(createElement('p', goal.description, 'muted goal-description'));

  const details = [`Target ${formatMoney(goal.targetAmount)}`];
  if (goal.targetDate) details.push(`by ${formatDate(goal.targetDate)}`);

  if (goal.status === 'cancelled') {
    details.push('Cancelled, so its reserved money was released');
  } else {
    const bar = document.createElement('progress');
    bar.max = 100;
    bar.value = Number(goal.percent);
    bar.setAttribute('aria-label', `${goal.name}: ${goal.percent}% saved`);
    const line = createElement('div', '', 'goal-amount-line');
    line.append(createElement('strong', formatMoney(goal.saved)), createElement('span', `${goal.percent}%`));
    card.append(line, bar);

    details.unshift(`Saved ${formatMoney(goal.saved)} (${goal.percent}%)`);
    details.push(`Remaining ${formatMoney(goal.remaining)}`);
  }
  card.append(createElement('p', `${details.join('. ')}.`, 'budget-text'));

  const buttons = createElement('div', '', 'row-actions goal-actions');
  if (goal.status === 'active') {
    buttons.append(createButton('Add savings', '', () => openEntryDialog(goal, 'contributions')));
  }
  if (goal.status !== 'cancelled') {
    buttons.append(
      createButton('Withdraw', 'button-secondary', () => openEntryDialog(goal, 'withdrawals')),
      createButton('Edit', 'button-secondary', () => openEditDialog(goal))
    );
  }
  buttons.append(createButton('History', 'button-secondary', () => openHistoryDialog(goal)));
  if (goal.status !== 'cancelled') {
    buttons.append(createButton('Cancel goal', 'button-danger', () => cancelGoal(goal)));
  }
  card.append(buttons);
  return card;
}

function showGoals(goals) {
  const groups = [
    ['active', 'active-goals', 'No active goals. Create one above.'],
    ['completed', 'completed-goals', 'No completed goals yet.'],
    ['cancelled', 'cancelled-goals', 'No cancelled goals.'],
  ];
  for (const [status, containerId, emptyText] of groups) {
    const cards = goals.filter((goal) => goal.status === status).map(createGoalCard);
    if (cards.length === 0) cards.push(createElement('p', emptyText, 'empty-state'));
    document.getElementById(containerId).replaceChildren(...cards);
  }
}

async function loadSavings() {
  try {
    const data = await apiRequest('/api/savings');
    showSummary(data.summary);
    showGoals(data.goals);
  } catch (error) {
    showMessage('message', error.message);
  }
}

// Create a goal
goalForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const body = JSON.stringify(Object.fromEntries(new FormData(goalForm)));
    const data = await apiRequest('/api/savings', { method: 'POST', body });
    showMessage('message', data.message, 'success');
    goalForm.reset();
    loadSavings();
  } catch (error) {
    showMessage('message', error.message);
  }
});

// Edit a goal
function openEditDialog(goal) {
  editingGoal = goal;
  showMessage('edit-message', '');
  editForm.elements.name.value = goal.name;
  editForm.elements.description.value = goal.description || '';
  editForm.elements.targetAmount.value = goal.targetAmount;
  editForm.elements.targetDate.value = goal.targetDate || '';
  editDialog.showModal();
}

editForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const body = JSON.stringify(Object.fromEntries(new FormData(editForm)));
    const data = await apiRequest(`/api/savings/${editingGoal.id}`, { method: 'PUT', body });
    editDialog.close();
    showMessage('message', data.message, 'success');
    loadSavings();
  } catch (error) {
    showMessage('edit-message', error.message);
  }
});

// Add savings to a goal, or withdraw from it
function openEntryDialog(goal, kind) {
  entryGoal = goal;
  entryKind = kind;
  showMessage('entry-message', '');
  entryForm.reset();

  if (kind === 'contributions') {
    setText('entry-title', `Add savings to "${goal.name}"`);
    setText(
      'entry-hint',
      `Goal needs ${formatMoney(goal.remaining)} more. You can reserve up to ` +
        `${formatMoney(latestSummary.available)} (your available spending balance).`
    );
  } else {
    setText('entry-title', `Withdraw from "${goal.name}"`);
    setText('entry-hint', `${formatMoney(goal.saved)} is reserved for this goal.`);
  }
  entryDialog.showModal();
}

entryForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const body = JSON.stringify(Object.fromEntries(new FormData(entryForm)));
    const data = await apiRequest(`/api/savings/${entryGoal.id}/${entryKind}`, { method: 'POST', body });
    entryDialog.close();
    showMessage('message', data.message, 'success');
    loadSavings();
  } catch (error) {
    showMessage('entry-message', error.message);
  }
});

// Contribution and withdrawal history of one goal
async function openHistoryDialog(goal) {
  setText('history-title', `History: ${goal.name}`);
  showMessage('history-message', '');
  document.getElementById('history-list').replaceChildren();
  historyDialog.showModal();

  try {
    const data = await apiRequest(`/api/savings/${goal.id}/history`);
    const list = document.getElementById('history-list');

    if (data.entries.length === 0) {
      list.replaceChildren(createElement('p', 'No contributions or withdrawals yet.', 'empty-state'));
      return;
    }

    const table = document.createElement('table');
    const headRow = table.createTHead().insertRow();
    ['Date', 'Type', 'Amount', 'Note'].forEach((heading) => headRow.append(createElement('th', heading)));
    const body = table.createTBody();

    for (const entry of data.entries) {
      const row = body.insertRow();
      const sign = entry.type === 'contribution' ? '+' : '-';
      [
        ['Date', entry.createdAt],
        ['Type', ENTRY_LABELS[entry.type]],
        ['Amount', sign + formatMoney(entry.amount)],
        ['Note', entry.note || ''],
      ].forEach(([label, text]) => {
        const cell = row.insertCell();
        cell.dataset.label = label;
        cell.textContent = text;
      });
    }
    list.replaceChildren(table);
  } catch (error) {
    showMessage('history-message', error.message);
  }
}

async function cancelGoal(goal) {
  const question =
    `Cancel the goal "${goal.name}"?\n\n` +
    `${formatMoney(goal.saved)} reserved for it will become available to spend again. ` +
    'The goal and its history stay on this page, but it cannot be restarted.';
  if (!window.confirm(question)) return;

  try {
    const data = await apiRequest(`/api/savings/${goal.id}/cancel`, { method: 'POST' });
    showMessage('message', data.message, 'success');
    loadSavings();
  } catch (error) {
    showMessage('message', error.message);
  }
}

loadSavings();
