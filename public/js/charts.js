// Shared Chart.js helpers. Chart.js draws with numbers, so amounts are only
// converted with Number() here for drawing, never for calculations.

const CHART_COLORS = [
  '#8b5cf6', '#0d9165', '#ec4899', '#f59e0b', '#6366f1',
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
  styleChart(charts[canvasId]);
}

// items look like { name, total }
function doughnutConfig(items) {
  return {
    type: 'doughnut',
    data: {
      labels: items.map((item) => item.name),
      datasets: [{
        data: items.map((item) => Number(item.total)),
        backgroundColor: items.map((item, i) => (/^#[0-9a-fA-F]{6}$/.test(item.color || '') ? item.color : CHART_COLORS[i % CHART_COLORS.length])),
      }],
    },
    options: { cutout: '68%', plugins: { legend: { position: 'bottom' } } },
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
    { label: 'Income', data: months.map((m) => Number(m.income)), backgroundColor: '#0d9165' },
    { label: 'Expenses', data: months.map((m) => Number(m.expense)), backgroundColor: '#ef4343' },
  ]);
}

// "2026-11" becomes "Nov 2026"
function shortMonth(month) {
  const [year, number] = month.split('-');
  return `${MONTH_NAMES[number - 1].slice(0, 3)} ${year}`;
}

// Match chart text and grid lines to the active theme.
function styleChart(chart) {
  const style = getComputedStyle(document.documentElement);
  const muted = style.getPropertyValue('--color-text-muted').trim();
  const border = style.getPropertyValue('--color-border').trim();
  chart.options.color = muted;
  chart.options.plugins.legend.labels.color = muted;
  chart.options.plugins.legend.labels.usePointStyle = true;
  chart.options.plugins.legend.labels.boxWidth = 8;
  for (const scale of Object.values(chart.options.scales || {})) {
    if (scale.ticks) scale.ticks.color = muted;
    if (scale.grid) scale.grid.color = border;
  }
  if (chart.config.type === 'bar') {
    chart.data.datasets.forEach(dataset => { dataset.borderRadius = 4; dataset.maxBarThickness = 30; if (dataset.label === 'Income') dataset.backgroundColor = style.getPropertyValue('--color-chart-income').trim(); if (dataset.label === 'Expenses') dataset.backgroundColor = style.getPropertyValue('--color-chart-expense').trim(); });
  }
  if (chart.config.type === 'line') {
    chart.data.datasets.forEach(dataset => { dataset.tension = .35; dataset.borderWidth = 2; dataset.borderColor = style.getPropertyValue('--color-chart-income').trim(); });
  }
  if (chart.config.type === 'doughnut') {
    chart.data.datasets.forEach(dataset => { dataset.borderColor = style.getPropertyValue('--color-surface').trim(); dataset.borderWidth = 2; });
  }
  chart.update('none');
}

document.addEventListener('spendwise-theme-change', () => {
  Object.values(charts).forEach(styleChart);
});
