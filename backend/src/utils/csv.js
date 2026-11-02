const toCsv = (rows, cols) =>
  [cols.join(','), ...rows.map(r => cols.map(c => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');

module.exports = toCsv;
