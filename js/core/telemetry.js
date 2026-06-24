export function createTelemetry() {
  return { ping: 0, fps: 0, disconnects: 0, matchDuration: 0, kosPerMinute: 0, earlyAbandons: 0, bytesPerPlayer: {}, serverTickMs: 0 };
}
export function updateMatchTelemetry(telemetry, state, tickMs = 0) {
  const kos = [...state.players, ...state.bots].reduce((sum, a) => sum + (a.stats?.kos || 0), 0);
  telemetry.matchDuration = state.stats?.duration || 0;
  telemetry.kosPerMinute = telemetry.matchDuration > 0 ? +(kos / (telemetry.matchDuration / 60)).toFixed(2) : 0;
  telemetry.serverTickMs = tickMs;
  return telemetry;
}
