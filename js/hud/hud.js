export function formatNetStats(metrics = {}) { return `Ping ${Math.round(metrics.ping || 0)}ms · Loss ${Math.round(metrics.loss || 0)}% · ${metrics.connection || 'offline'}`; }
export function formatResultRow(row) { return `#${row.position} ${row.name}: ${row.score} pts · ${row.kos} KOs · ${row.deaths} muertes`; }
