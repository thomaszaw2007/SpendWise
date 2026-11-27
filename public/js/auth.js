// Used by both the login and register pages
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');

document.querySelectorAll('[data-toggle-password]').forEach((button) => {
  const input = document.getElementById(button.dataset.togglePassword);
  const label = button.getAttribute('aria-label').replace('Show ', '');

  button.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    button.textContent = show ? 'Hide' : 'Show';
    button.setAttribute('aria-label', `${show ? 'Hide' : 'Show'} ${label}`);
  });
});

async function submitAuthForm(form, url, onSuccess) {
  const submitButton = form.querySelector('[type="submit"]');
  submitButton.disabled = true;
  showMessage('message', '');

  try {
    const body = Object.fromEntries(new FormData(form));
    await apiRequest(url, { method: 'POST', body: JSON.stringify(body) });
    onSuccess();
  } catch (error) {
    showMessage('message', error.message);
    submitButton.disabled = false;
  }
}

if (loginForm) {
  if (new URLSearchParams(window.location.search).has('registered')) {
    showMessage('message', 'Account created. You can now log in.', 'success');
  }

  loginForm.addEventListener('submit', (event) => {
    event.preventDefault();
    submitAuthForm(loginForm, '/api/auth/login', () => {
      window.location.href = '/dashboard.html';
    });
  });
}

if (registerForm) {
  registerForm.addEventListener('submit', (event) => {
    event.preventDefault();

    if (registerForm.password.value !== registerForm.confirmPassword.value) {
      showMessage('message', 'Passwords do not match.');
      return;
    }
    submitAuthForm(registerForm, '/api/auth/register', () => {
      window.location.href = '/login.html?registered=1';
    });
  });
}
