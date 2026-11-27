function applyTheme() {
  let choice = 'system';
  try { choice = localStorage.getItem('spendwise-theme') || 'system'; } catch (error) { /* Storage may be unavailable. */ }
  const dark = choice === 'dark' || (choice === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelectorAll('[data-theme-choice]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.themeChoice === choice));
  });
  document.dispatchEvent(new Event('spendwise-theme-change'));
}

applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);


function setTheme(choice) {
  try { localStorage.setItem('spendwise-theme', choice); } catch (error) { return; }
  applyTheme();
}
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-public-theme]').forEach(button => {
    button.addEventListener('click', () => setTheme(button.dataset.themeChoice));
  });
  applyTheme();
});
