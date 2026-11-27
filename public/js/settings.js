const profileForm = document.getElementById('profile-form');
const balanceForm = document.getElementById('balance-form');
const passwordForm = document.getElementById('password-form');
const deleteForm = document.getElementById('delete-form');

async function loadSettings() {
  try {
    const settings = await apiRequest('/api/settings');
    document.getElementById('created-date').textContent = formatDate(settings.createdDate);
    document.getElementById('currency').textContent = settings.currency;
    document.getElementById('time-zone').textContent = settings.timeZone;
    profileForm.elements.fullName.value = settings.fullName;
    profileForm.elements.email.value = settings.email;
    balanceForm.elements.openingBalance.value = settings.openingBalance;
  } catch (error) {
    showMessage('message', error.message);
  }
}

// Sends a form to the server and shows the result in the message box
// that belongs to that form. Returns true when it worked.
async function submitForm(form, url, method, messageId) {
  const submitButton = form.querySelector('[type="submit"]');
  submitButton.disabled = true;
  showMessage(messageId, '');

  try {
    const body = JSON.stringify(Object.fromEntries(new FormData(form)));
    const data = await apiRequest(url, { method, body });
    showMessage(messageId, data.message, 'success');
    return true;
  } catch (error) {
    showMessage(messageId, error.message);
    return false;
  } finally {
    submitButton.disabled = false;
  }
}

profileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (await submitForm(profileForm, '/api/settings/profile', 'PUT', 'profile-message')) {
    // Update the name shown in the sidebar
    document.querySelector('.sidebar-user span').textContent = profileForm.elements.fullName.value.trim();
  }
});

balanceForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await submitForm(balanceForm, '/api/settings/opening-balance', 'PUT', 'balance-message');
});

passwordForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (passwordForm.newPassword.value !== passwordForm.confirmPassword.value) {
    showMessage('password-message', 'Passwords do not match.');
    return;
  }
  if (await submitForm(passwordForm, '/api/settings/password', 'PUT', 'password-message')) {
    passwordForm.reset();
  }
});

deleteForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const question =
    'Permanently delete your SpendWise account and all of your data? This cannot be undone.';
  if (!window.confirm(question)) return;

  if (await submitForm(deleteForm, '/api/settings/delete-account', 'POST', 'danger-message')) {
    window.location.href = '/login.html';
  }
});

loadSettings();
