// The journal part of the calendar page. Loaded after calendar.js.
const journalForm = document.getElementById('journal-form');
const journalText = document.getElementById('journal-content');
const saveButton = document.getElementById('journal-save');
const deleteButton = document.getElementById('journal-delete');

let journalDate = null; // the date the text box currently belongs to
let savedText = '';
let journalPage = 1;
let latestJournalRequest = 0;

function hasUnsavedText() {
  return journalText.value !== savedText;
}

function canLeaveJournal() {
  return !hasUnsavedText() || window.confirm('Discard your unsaved journal changes?');
}

function showEntry(content, exists) {
  journalText.value = content;
  savedText = content;
  deleteButton.hidden = !exists;
}

async function loadJournal() {
  const requestNumber = ++latestJournalRequest;
  const date = selectedDate;

  // Locked while loading, so text cannot be saved to the wrong date
  journalText.disabled = true;
  saveButton.disabled = true;
  showEntry('', false);
  showMessage('journal-message', '');

  try {
    const { entry } = await apiRequest(`/api/journal/${date}`);
    if (requestNumber !== latestJournalRequest) return;

    journalDate = date;
    showEntry(entry ? entry.content : '', Boolean(entry));
    journalText.disabled = false;
    saveButton.disabled = false;
  } catch (error) {
    showMessage('journal-message', error.message);
  }
}

async function loadJournalList() {
  try {
    const data = await apiRequest(`/api/journal?page=${journalPage}`);
    journalPage = data.page;

    const items = data.entries.map((entry) => {
      const item = document.createElement('li');
      const openButton = createButton(formatDate(entry.date), 'button-secondary', () => {
        selectDate(entry.date);
        document.getElementById('selected-title').scrollIntoView();
      });
      item.append(openButton, createElement('span', entry.preview, 'journal-preview'));
      return item;
    });
    if (items.length === 0) items.push(createElement('li', 'No journal entries yet.', 'muted'));

    document.getElementById('journal-list').replaceChildren(...items);
    document.getElementById('journal-pagination').hidden = data.totalPages === 1;
    document.getElementById('journal-page').textContent = `Page ${data.page} of ${data.totalPages}`;
    document.getElementById('journal-newer').disabled = data.page <= 1;
    document.getElementById('journal-older').disabled = data.page >= data.totalPages;
  } catch (error) {
    showMessage('journal-message', error.message);
  }
}

journalForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const date = journalDate;
  const content = journalText.value;
  saveButton.disabled = true;

  try {
    const data = await apiRequest(`/api/journal/${date}`, {
      method: 'PUT',
      body: JSON.stringify({ content }),
    });
    if (date === selectedDate) {
      savedText = content;
      deleteButton.hidden = false;
      showMessage('journal-message', data.message, 'success');
    }
    loadJournalList();
    loadMonth();
  } catch (error) {
    showMessage('journal-message', error.message);
  }
  saveButton.disabled = journalText.disabled;
});

deleteButton.addEventListener('click', async () => {
  const date = journalDate;
  if (!window.confirm(`Delete the journal entry for ${formatDate(date)}?`)) return;

  try {
    const data = await apiRequest(`/api/journal/${date}`, { method: 'DELETE' });
    if (date === selectedDate) {
      showEntry('', false);
      showMessage('journal-message', data.message, 'success');
    }
    loadJournalList();
    loadMonth();
  } catch (error) {
    showMessage('journal-message', error.message);
  }
});

document.getElementById('journal-newer').addEventListener('click', () => {
  journalPage -= 1;
  loadJournalList();
});
document.getElementById('journal-older').addEventListener('click', () => {
  journalPage += 1;
  loadJournalList();
});

// Warn before closing the page with unsaved writing
window.addEventListener('beforeunload', (event) => {
  if (hasUnsavedText()) event.preventDefault();
});

async function startPage() {
  try {
    ({ categories } = await apiRequest('/api/categories'));
    fillCategoryOptions(addForm, categories);
  } catch (error) {
    showMessage('message', error.message);
  }
  selectDate(selectedDate);
  loadJournalList();
}

startPage();
