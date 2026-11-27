// Shared Chart.js helpers. Chart.js draws with numbers, so amounts are only
// converted with Number() here for drawing, never for calculations.

const CHART_COLORS = [
  '#047857', '#2563eb', '#d97706', '#7c3aed', '#dc2626',
  '#0891b2', '#be185d', '#65a30d', '#78716c', '#334155',
];

const charts = {}; // chart objects by canvas id, so they can be replaced

// Draws a chart, or shows emptyText instead when there is nothing to draw
function drawChart(canvasId, config, hasData, emptyText) {
  const canvas = document.getElementById(canvasId);
  const emptyMessage = document.getElementById(`${canvasId}-empty`);

  if (charts[canvasId]) charts[canvasId].destroy();
  delete charts[canvasId];

  const libraryLoaded = typeof Chart !== 'undefined';
  canvas.parentElement.hidden = !hasData || !libraryLoaded;

  if (emptyMessage) {
    emptyMessage.hidden = hasData && libraryLoaded;
    emptyMessage.textContent = libraryLoaded
      ? emptyText
      : 'The chart library did not load. Run "npm install" and restart the server.';
  }
  if (!hasData || !libraryLoaded) return;

  config.options = { responsive: true, maintainAspectRatio: false, ...config.options };
  charts[canvasId] = new Chart(canvas, config);
}

// items look like { name, total }
function doughnutConfig(items) {
  return {
    type: 'doughnut',
    data: {
      labels: items.map((item) => item.name),
      datasets: [{
        data: items.map((item) => Number(item.total)),
        backgroundColor: items.map((item, i) => CHART_COLORS[i % CHART_COLORS.length]),
      }],
    },
    options: { plugins: { legend: { position: 'bottom' } } },
  };
}

function barConfig(labels, datasets) {
  return {
    type: 'bar',
    data: { labels, datasets },
    options: { scales: { y: { beginAtZero: true } } },
  };
}

function incomeExpenseConfig(months, labels) {
  return barConfig(labels, [
    { label: 'Income', data: months.map((m) => Number(m.income)), backgroundColor: '#047857' },
    { label: 'Expenses', data: months.map((m) => Number(m.expense)), backgroundColor: '#d97706' },
  ]);
}

// "2026-11" becomes "Nov 2026"
function shortMonth(month) {
  const [year, number] = month.split('-');
  return `${MONTH_NAMES[number - 1].slice(0, 3)} ${year}`;
}
