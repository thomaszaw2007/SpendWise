// Placeholder page: asks the server if everything is working.
async function showServerStatus() {
  const statusElement = document.getElementById('server-status');

  try {
    const data = await apiRequest('/api/health');
    statusElement.textContent = `Server: ${data.status}, database: ${data.database}`;
    statusElement.className = 'status-ok';
  } catch (error) {
    statusElement.textContent = 'Could not reach the server or database.';
    statusElement.className = 'status-error';
  }
}

showServerStatus();
