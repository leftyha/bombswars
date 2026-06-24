import { WebSocketServer } from 'ws';
import { Matchmaker } from '../js/core/rooms.js';
import { stepSimulation } from '../js/core/simulation.js';
import { compactSnapshot } from '../js/core/state.js';
import { MSG, encode, decode } from '../js/net/protocol.js';
import { RateLimiter } from '../js/core/security.js';
import { buildMatchResults } from '../js/core/results.js';
import { JsonSessionStore } from '../js/core/persistence.js';
import { createTelemetry, updateMatchTelemetry } from '../js/core/telemetry.js';

const port = process.env.PORT || 8080;
const resultSecret = process.env.RESULT_SECRET || 'dev-secret';
const wss = new WebSocketServer({ port });
const mm = new Matchmaker();
const clients = new Map();
const limiter = new RateLimiter();
const sessions = new JsonSessionStore(process.env.SESSION_STORE || './data/sessions.json');
const telemetry = createTelemetry();

wss.on('connection', (ws, req) => {
  const id = `p_${Math.random().toString(36).slice(2, 10)}`;
  let room, player;
  clients.set(ws, { id, inputs: [], ip: req.socket.remoteAddress, bytes: 0 });
  ws.on('message', buf => {
    const c = clients.get(ws); c.bytes += buf.length;
    let msg; try { msg = decode(buf); } catch { return; }
    if (!limiter.allow(`${c.ip}:conn`, 180, 1000)) return;
    if (msg.t === MSG.HELLO) {
      const session = sessions.getOrCreate({ id: msg.sessionId || id, name: msg.name });
      ({ room, player } = mm.enqueue({ id: session.id, name: session.name }, msg.region || 'local'));
      ws.send(encode({ t: MSG.WELCOME, playerId: player.id, roomId: room.id, limits: room.limits, session }));
      return;
    }
    if (msg.t === MSG.INPUT && player) {
      if (!limiter.allow(`${c.ip}:input`, 40, 1000)) return;
      if (msg.throwBomb && !limiter.allow(`${player.id}:throw`, 4, 1000)) return;
      if (msg.dash && !limiter.allow(`${player.id}:dash`, 3, 1000)) return;
      c.inputs.push({ ...msg, playerId: player.id });
    }
    if (msg.t === MSG.PING) ws.send(encode({ t: MSG.PONG, clientTime: msg.clientTime, serverTime: Date.now() }));
  });
  ws.on('close', () => { telemetry.disconnects++; clients.delete(ws); });
});

setInterval(() => {
  const start = performance.now();
  for (const room of mm.rooms) {
    if (room.state === 'COUNTDOWN' && Date.now() > room.countdownUntil) room.setLive();
    if (room.state !== 'LIVE' && room.state !== 'WAITING') continue;
    const inputs = [];
    for (const [, c] of clients) if (c.inputs?.length) inputs.push(...c.inputs.splice(0));
    stepSimulation(room.game, inputs, 1 / room.limits.tickRate);
    const tickMs = +(performance.now() - start).toFixed(2);
    updateMatchTelemetry(telemetry, room.game, tickMs);
    const snap = { t: MSG.SNAPSHOT, roomId: room.id, ...compactSnapshot(room.game), telemetry: { serverTickMs: telemetry.serverTickMs }, tickTimeMs: tickMs };
    const payload = encode(snap);
    for (const [ws, c] of clients) if (ws.readyState === 1) { telemetry.bytesPerPlayer[c.id] = (telemetry.bytesPerPlayer[c.id] || 0) + payload.length; ws.send(payload); }
    if (room.game.matchTime <= 0 && room.state === 'LIVE') {
      room.state = 'FINISHED'; room.game.phase = 'FINISHED';
      const result = buildMatchResults(room.game, resultSecret); sessions.applyResult(result);
      const resultPayload = encode({ t: MSG.RESULT, roomId: room.id, result });
      for (const [ws] of clients) if (ws.readyState === 1) ws.send(resultPayload);
    }
  }
}, 50);
console.log(`BombsWars room server listening on :${port}`);
