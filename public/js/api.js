// Small helper for talking to our backend.
// Every page can use apiRequest() instead of repeating fetch() code.
let csrfToken = null;

// Requests that change data must include the CSRF token from the server
async function getCsrfToken() {
  if (!csrfToken) {
    const data = await apiRequest('/api/auth/csrf');
    csrfToken = data.csrfToken;
  }
  return csrfToken;
}

async function apiRequest(url, options = {}) {
  const headers = { 'Content-Type': 'application/json' };

  if (options.method && options.method !== 'GET') {
    headers['X-CSRF-Token'] = await getCsrfToken();
  }

  const response = await fetch(url, { ...options, headers });
  // If the reply is not JSON, use an empty object so the error below is shown
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (data.code === 'CSRF') csrfToken = null; // fetch a fresh one next time

    // The session ended, so go back to the login page
    if (response.status === 401 && url !== '/api/auth/login') {
      window.location.href = '/login.html';
    }
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

// Shows a success or error message. An empty text hides it.
function showMessage(elementId, text, type = 'error') {
  const element = document.getElementById(elementId);
  element.textContent = text;
  element.className = `message message-${type}`;
  element.hidden = !text;
}
