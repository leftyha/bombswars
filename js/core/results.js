import { createHmac } from 'node:crypto';

export function buildMatchResults(state, secret = 'dev-secret') {
  const rows = [...state.players, ...state.bots].map(actor => ({
    id: actor.id,
    name: actor.name,
    kind: actor.kind,
    score: state.score?.[actor.id] || actor.score || 0,
    kos: actor.stats?.kos || 0,
    deaths: actor.stats?.deaths || 0,
    bombsUsed: actor.stats?.bombsUsed || 0,
    duration: Math.round(state.stats?.duration || 0)
  })).sort((a, b) => b.score - a.score || b.kos - a.kos || a.deaths - b.deaths);
  rows.forEach((row, i) => row.position = i + 1);
  const payload = { mode: state.mode, tick: state.tick, duration: Math.round(state.stats?.duration || 0), players: rows };
  return { ...payload, signature: signResults(payload, secret) };
}

export function signResults(payload, secret) {
  return createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
}
