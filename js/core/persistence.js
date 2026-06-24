import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';

export function createSession({ id, name = 'Player' }) {
  return {
    id,
    name: String(name || 'Player').trim().slice(0, 16) || 'Player',
    progress: { level: 1, xp: 0 },
    stats: { matchesPlayed: 0, wins: 0, kos: 0, deaths: 0, abandons: 0 },
    cosmetics: { owned: [], equipped: {} },
    ranking: { mmr: 1000, tier: 'unranked' },
    missions: []
  };
}

export class JsonSessionStore {
  constructor(path = './data/sessions.json') { this.path = path; this.sessions = new Map(); this.load(); }
  load() { if (!existsSync(this.path)) return; const raw = JSON.parse(readFileSync(this.path, 'utf8')); this.sessions = new Map(Object.entries(raw)); }
  save() { mkdirSync(dirname(this.path), { recursive: true }); writeFileSync(this.path, JSON.stringify(Object.fromEntries(this.sessions), null, 2)); }
  getOrCreate(session) { const id = session.id; if (!this.sessions.has(id)) this.sessions.set(id, createSession(session)); const stored = this.sessions.get(id); if (session.name) stored.name = createSession(session).name; return stored; }
  applyResult(result) { for (const row of result.players || []) { const s = this.getOrCreate({ id: row.id, name: row.name }); s.stats.matchesPlayed++; s.stats.kos += row.kos || 0; s.stats.deaths += row.deaths || 0; if (row.position === 1) s.stats.wins++; s.progress.xp += 25 + (row.kos || 0) * 10; } this.save(); }
}
