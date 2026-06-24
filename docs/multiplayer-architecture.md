# BombsWars multiplayer MVP architecture

This document maps the online roadmap to implemented project modules.

## Client preparation

- `js/core/state.js` owns the explicit serializable `GameState` for players, bots, bombs, pickups, obstacles, fire/ice zones, score, events, and match stats.
- `js/core/simulation.js` owns deterministic gameplay updates: movement, dash, bombs, damage, KOs, pickups, cooldowns, and server-side validation hooks.
- `js/game.js` remains the browser preview renderer/HUD/input/audio shell. Its loop now advances gameplay at a fixed 20 Hz simulation tick and renders separately at the configured FPS cap.
- Gameplay effects that must replicate over the network are listed in `GAMEPLAY_EFFECTS`; cosmetic-only effects such as particles, screen shake, floating text, decals, and audio cues are listed in `VISUAL_EFFECTS`.

## Rooms and matchmaking

- `js/core/rooms.js` defines the room states `CREATING`, `WAITING`, `COUNTDOWN`, `LIVE`, `OVERTIME`, `FINISHED`, and `CLOSING`.
- Room limits include `maxPlayers`, `maxSpectators`, `maxBots`, `tickRate`, and `maxEntities`.
- Casual rooms target 6-10 players, avoid assigning new players once a room is 90% full, prioritize filling existing rooms, and create new room instances when needed.
- Bots fill casual rooms while waiting for enough human players.

## Local multiplayer simulation and replay

- Entities use stable IDs for players, bots, bombs, pickups, and obstacles.
- `js/core/replay.js` records inputs and snapshots, creates snapshot diffs, replays matches, and validates that the same input sequence yields the same compact snapshot.

## Server MVP

- `server/index.js` starts a Node.js WebSocket room server.
- One process can host multiple small rooms through the in-memory matchmaker.
- The server runs the authoritative simulation at 20 ticks per second and broadcasts compact snapshots containing tick, actors, bombs, and important gameplay events.

## Network protocol and client netcode

- `js/net/protocol.js` defines messages. Clients send inputs with sequence, delta time, movement, yaw/pitch, sprint, dash, and bomb throw intent.
- `js/net/client.js` provides client prediction, pending-input tracking for reconciliation, remote snapshot buffering, 100-150 ms interpolation support, ping tracking, and basic reconnect behavior.

## Server validation, security, and telemetry foundation

- The simulation validates ammo, bomb cooldown, dash cooldown, and pickup cooldown before applying authoritative actions.
- The server includes a simple per-IP input rate limit and ignores excessive action spam.
- Snapshots include server tick time to support operational telemetry.

## Results and persistence foundation

- `GameState.stats` tracks match duration and actor stats track KOs, deaths, and bombs used.
- Final result signing, account persistence, PostgreSQL, Redis/NATS, object storage, reporting, moderation, clans, hubs, seasons, and MMO-like services are intentionally staged as production follow-up work after the authoritative MVP is stable.

## Implementación ampliada

- `js/render/render.js`, `js/input/input.js`, `js/hud/hud.js` y `js/audio/effects.js` son puntos de entrada separados para seguir extrayendo el cliente monolítico sin cambiar la preview jugable.
- `js/core/security.js` centraliza detección de inputs imposibles y rate limiting reusable por IP, cuenta o conexión.
- `js/core/results.js` firma resultados de partida desde servidor y calcula posición final, puntuación, KOs, muertes, duración y bombas usadas.
- `js/core/persistence.js` añade sesiones/cuentas mínimas con nombre, progreso, estadísticas base y espacios preparados para cosméticos, ranking y misiones.
- `js/core/telemetry.js` agrega métricas base de partida y servidor para ping, desconexiones, duración, KOs por minuto, ancho de banda y tick time.
