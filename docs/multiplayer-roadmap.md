# Plan multijugador, salas y evolución MMO de BombStick Arena

## 1. Punto de partida actual

BombStick Arena ya tiene una base jugable útil para validar el multijugador:

- Arena pseudo-3D en Canvas, pensada para rendimiento en navegador y sin WebGL pesado.
- Rondas de 7 minutos con score, KOs, bots, obstáculos, packs, cráteres, zonas de fuego/hielo y minimapa.
- Controles de shooter frenético: WASD, sprint, dash, mouse look y selección de 5 tipos de bomba.
- `Performance Lab` para simular carga local con número de bots/jugadores, obstáculos, packs, partículas, escala de render y FPS cap.
- IA simple que recoge packs, persigue objetivos y lanza bombas, útil como sustituto de jugadores humanos durante matchmaking o relleno de salas.

La dirección recomendada es convertir el prototipo en un **arena multiplayer por salas autoritativas**, con límite duro de jugadores por sala, y dejar preparada una capa de metajuego persistente para que pueda crecer hacia una experiencia tipo MMO sin intentar meter a todos los usuarios en una sola simulación.

## 2. Objetivos de diseño

### Objetivos inmediatos

1. Permitir partidas online estables con salas pequeñas y controladas.
2. Evitar sobresaturación mediante límites por sala, colas y creación automática de instancias.
3. Mantener sensación frenética con tiempos cortos de espera, bots de relleno y respawns rápidos si el modo lo permite.
4. Usar el motor actual como cliente visual y mover la autoridad de gameplay al servidor.
5. Construir datos persistentes: cuenta, progreso, cosméticos, inventario, MMR/ranking y telemetría.

### Objetivos de futuro

1. Escalar de arena por salas a hubs sociales, clanes, eventos y torneos.
2. Crear una experiencia “MMO-like” mediante muchas instancias conectadas, no mediante una única sala infinita.
3. Añadir economía sostenible sin pay-to-win.
4. Preparar el juego para temporadas, pases, misiones, tienda y eventos en vivo.

## 3. Arquitectura propuesta

### Modelo recomendado: servidor autoritativo por salas

Cada sala debe tener una simulación de juego independiente ejecutándose en servidor. El cliente solo envía inputs y renderiza estados confirmados/predichos.

Componentes:

- **Cliente web**: mantiene Canvas, HUD, input, predicción ligera, interpolación de jugadores remotos y efectos visuales.
- **Gateway WebSocket**: autentica conexiones, valida sesión y enruta al servidor de sala.
- **Matchmaker**: decide a qué sala entra cada usuario según región, modo, MMR, latencia, party y capacidad.
- **Room Server**: simula una arena concreta con tick fijo, colisiones, bombas, daño, pickups y reglas del modo.
- **Presence/Lobby Service**: muestra amigos, party, invitaciones y estado de salas.
- **Persistence API**: guarda cuenta, progreso, cosméticos, misiones, monedas, ranking y estadísticas.
- **Telemetry Pipeline**: registra FPS, ping, desconexiones, duración de partida, kills, muertes, uso de bombas y economía.

### Por qué no hacer MMO directo desde el primer paso

El gameplay actual depende de proyectiles explosivos, zonas de daño, obstáculos y muchos efectos. Eso exige baja latencia y simulación precisa. Un MMO directo con cientos de usuarios en el mismo mapa aumentaría demasiado:

- ancho de banda,
- coste de CPU,
- complejidad de sincronización,
- problemas de balance,
- riesgo de trampas,
- dificultad de onboarding.

La ruta segura es **instanciar muchas salas pequeñas** y conectar esas salas con progresión persistente, hubs y eventos globales.

## 4. Diseño de salas y límites de usuarios

### Límites base por modo

| Modo | Jugadores humanos | Bots de relleno | Duración | Objetivo |
| --- | ---: | ---: | ---: | --- |
| Tutorial online | 1 | 3-7 | 3-5 min | Enseñar movimiento, dash y bombas |
| Casual rápida | 6-10 | Hasta completar 10 | 5-7 min | Partida inmediata |
| Ranked Arena | 8 | 0-2 solo si matchmaking tarda | 6-8 min | Competitivo estable |
| Chaos Arena | 12-16 | 0-4 | 5 min | Acción frenética |
| Party privada | 2-12 | Configurable | 3-10 min | Amigos y creadores |
| Evento grande instanciado | 16-24 | 0 | 8-12 min | Modo especial no ranked |

Recomendación inicial: lanzar con **10 jugadores máximos por sala casual**. El slider actual permite simular más bots, pero online conviene empezar bajo, medir, y subir solo cuando los servidores y el netcode lo soporten.

### Reglas anti-sobresaturación

1. Cada sala tiene `maxPlayers`, `maxSpectators`, `maxBots`, `tickRate` y `budget` de entidades.
2. El matchmaker nunca añade usuarios si la sala supera el 90-100% de capacidad.
3. Si no existe sala disponible, se crea una nueva instancia.
4. Si hay demasiadas salas vacías, se prioriza rellenar salas ya creadas antes de abrir otra.
5. Si una sala pierde jugadores, se rellena con bots solo en casual; ranked debe proteger integridad competitiva.
6. Cada sala tiene presupuesto máximo de bombas activas, partículas replicadas, packs y obstáculos destructibles.
7. Los efectos puramente visuales no se replican; el servidor solo envía eventos esenciales.

### Estados de sala

- `CREATING`: reserva de instancia y carga de arena.
- `WAITING`: esperando mínimo de jugadores.
- `COUNTDOWN`: cuenta atrás; se bloquean entradas tardías si el modo lo requiere.
- `LIVE`: partida activa.
- `OVERTIME`: desempate opcional.
- `FINISHED`: resultados firmados por servidor.
- `CLOSING`: limpieza, guardado de stats y liberación de recursos.

## 5. Netcode y sincronización

### Tickrate recomendado

- MVP: 20 ticks por segundo en servidor.
- Objetivo competitivo: 30 ticks por segundo.
- Cliente: render libre a 60/120 FPS con interpolación.

### Datos enviados por el cliente

El cliente debe enviar inputs, no posiciones finales:

```json
{
  "seq": 1842,
  "dt": 0.033,
  "moveX": -1,
  "moveZ": 1,
  "yaw": 1.42,
  "pitch": -0.08,
  "sprint": true,
  "dash": false,
  "throw": { "type": "frag" }
}
```

### Datos enviados por el servidor

El servidor envía snapshots compactos:

```json
{
  "tick": 9221,
  "players": [{ "id": "p1", "x": 12.1, "z": -4.2, "yaw": 0.7, "hp": 80 }],
  "bombs": [{ "id": "b9", "type": "ice", "x": 4.1, "y": 1.2, "z": 8.4 }],
  "events": [{ "kind": "explosion", "x": 4.1, "z": 8.4, "radius": 7.3 }]
}
```

### Técnicas necesarias

- Predicción local del jugador propio para movimiento y dash.
- Reconciliación cuando el servidor corrige posición o estado.
- Interpolación de rivales con buffer de 100-150 ms.
- Lag compensation para validar lanzamientos de bomba contra posiciones históricas.
- Rate limits por acción: lanzamiento, dash, cambios de bomba, pickup.
- Validación server-side de munición, cooldowns, daño, línea de visión y colisiones.

## 6. Evolución técnica por fases

### Fase 0: Preparación del cliente actual

- Separar simulación, render, input y HUD en módulos.
- Crear un modelo de estado serializable: jugador, bot, bomba, pickup, obstáculo y zona.
- Hacer que `update()` pueda correr con tick fijo independiente del render.
- Sustituir referencias globales por un `GameState` explícito.
- Marcar qué efectos son gameplay y cuáles son solo visuales.

### Fase 1: Multiplayer local simulado

- Simular varios jugadores locales con inputs grabados.
- Añadir IDs estables a entidades.
- Grabar y reproducir partidas para depurar desync.
- Crear snapshots y diffs aunque todavía no haya servidor real.

### Fase 2: Servidor de sala MVP

- Node.js + WebSocket al inicio por velocidad de desarrollo.
- Un proceso puede alojar varias salas pequeñas al principio.
- Tick fijo de 20 Hz.
- Matchmaking casual por región y modo.
- Bots de relleno reutilizando reglas del cliente, pero ejecutadas en servidor.

### Fase 3: Producción escalable

- Separar gateway, matchmaker, room workers y persistence.
- Autoscaling por CPU, salas activas y conexiones.
- Redis o NATS para presence, colas y eventos rápidos.
- PostgreSQL para datos persistentes.
- Object storage para replays o logs grandes.
- Observabilidad: métricas por sala, tick time, bandwidth, ping, errores y abandono.

### Fase 4: Camino MMO-like

- Hubs sociales sin combate pesado: 30-100 usuarios con baja frecuencia de actualización.
- Arenas instanciadas para combate real.
- Eventos globales que se dividen en múltiples instancias con ranking compartido.
- Clanes, chat, marketplace cosmético, misiones cooperativas y temporadas.
- “Mega eventos” con shards: cada instancia aporta puntos a un objetivo global.

## 7. Gameplay más jugable y frenético

### Cambios de ritmo

1. Reducir el tiempo muerto: el jugador empieza con 1-2 bombas básicas o hay packs muy cerca del spawn.
2. Añadir respawn en modos casuales para evitar que una muerte temprana corte la diversión.
3. Aumentar feedback de impacto: indicadores de daño, marcador de hit, sonido/flash y texto flotante más claro.
4. Añadir pickups temporales: velocidad, escudo, doble dash, recarga rápida y salto/impulso.
5. Crear zonas del mapa que cambien durante la ronda: puertas, plataformas, lava/fuego, viento o hielo.
6. Introducir eventos de mitad de partida: lluvia de packs, bomba dorada, zona peligrosa o objetivo móvil.
7. Usar “sudden death” al final: arena se reduce o aparecen más hazards.

### Balance de bombas

- **Frag**: bomba base fácil de entender, cooldown corto y daño medio.
- **Sticky**: herramienta de precisión, buena contra jugadores rápidos.
- **Trap**: control de zona; limitar cantidad activa por jugador.
- **Fire**: negar área y forzar movimiento.
- **Ice**: combo y persecución; bajar daño si el slow es muy fuerte.

### Modos recomendados

- **Bomb Royale**: todos contra todos, gana score/KOs.
- **Hot Potato**: un jugador porta una mega bomba y debe pasarla golpeando.
- **King of the Crater**: control de zona central con explosiones periódicas.
- **Payload Bomb**: empujar una bomba gigante hasta la base rival.
- **Duo Chaos**: equipos de 2 con revivir rápido.
- **Ranked Duel/4v4**: reglas más limpias, menos RNG y mapa competitivo.

## 8. Monetización sostenible

### Principios

- No vender daño, vida, velocidad permanente ni ventaja directa.
- Monetizar identidad, comodidad social y contenido estacional.
- Mantener una economía clara: moneda gratis, moneda premium y recompensas de temporada.

### Fuentes de ingresos

1. **Cosméticos de personaje**: skins, cascos, guantes, estelas de dash y animaciones de victoria.
2. **Cosméticos de bombas**: modelos, colores, trails, explosiones visuales y stickers.
3. **Pase de temporada**: misiones, recompensas gratis/premium, títulos y emotes.
4. **Tienda rotativa**: bundles temáticos sin afectar gameplay.
5. **Salas privadas premium**: opciones extra para creadores, torneos y comunidades.
6. **Founder Pack**: cosméticos exclusivos de lanzamiento, moneda premium y badge.
7. **Eventos patrocinados**: mapas o skins temáticas, cuidando que no rompan la identidad del juego.

### Retención ligada a monetización

- Misiones diarias/semanales: jugar modos, usar tipos de bomba, ganar KOs, revivir aliados.
- Progresión de maestría por bomba con recompensas visuales.
- Ranking por temporada y recompensas al cierre.
- Clanes con objetivos colectivos y cosméticos grupales.

## 9. Seguridad, anti-cheat y abuso

- Autoridad total del servidor para posición, vida, munición, pickups, cooldowns y daño.
- Cliente nunca decide KOs ni recompensas finales.
- Rate limiting por IP, cuenta y conexión.
- Detección de inputs imposibles: velocidad, dash, frecuencia de lanzamiento y teleports.
- Firmar resultados de partida desde el servidor.
- Reportes, mute, bloqueo, chat filtrado y sanciones progresivas.
- Replays ligeros para revisar partidas ranked o reportadas.

## 10. Métricas de éxito

### Técnicas

- Tick server p95 por debajo de 33 ms en 30 Hz.
- Ping medio por región menor de 80 ms para usuarios locales.
- Desconexión por partida menor del 3%.
- Menos de 1% de salas con overload sostenido.
- Bandwidth por jugador controlado y medido por modo.

### Gameplay

- Tiempo hasta primera acción menor de 15 segundos.
- Tiempo hasta primera bomba menor de 10 segundos.
- Duración de partida casual entre 5 y 7 minutos.
- KOs por minuto suficientemente altos para sensación frenética.
- Ratio de abandono temprano menor del 10%.

### Negocio

- D1/D7/D30 retention.
- Conversión a pase de temporada.
- Ingreso medio por usuario pagador sin afectar balance.
- Participación en eventos.
- Repetición de partidas por sesión.

## 11. Roadmap recomendado

### MVP online: 4-8 semanas

1. Refactor mínimo del estado de juego.
2. Servidor WebSocket con una sala casual.
3. 6-10 jugadores máximos por sala.
4. Bots de relleno.
5. Matchmaking básico por región.
6. Resultados al final de ronda.
7. Telemetría mínima: ping, FPS, abandono, duración, KOs.

### Alpha cerrada: 8-12 semanas

1. Parties e invitaciones.
2. Salas privadas.
3. Primer pase/progresión básica sin pagos reales.
4. Primer modo por equipos.
5. Mejoras de interpolación y reconciliación.
6. Moderación básica y reportes.

### Beta abierta: 3-6 meses

1. Ranked.
2. Temporada 1.
3. Tienda cosmética.
4. Clanes simples.
5. Eventos rotativos.
6. Infraestructura autoscalable.

### MMO-like: 6-12+ meses

1. Hub social.
2. Eventos globales instanciados.
3. Clanes avanzados.
4. Torneos en cliente.
5. Economía cosmética más profunda.
6. Mapa mundial/meta con objetivos de comunidad.

## 12. Decisiones clave recomendadas

- Empezar con **salas de 10 jugadores** y subir a 12/16 solo tras métricas reales.
- Mantener el combate en instancias pequeñas, incluso si el metajuego se vuelve MMO.
- Priorizar servidor autoritativo desde el primer online para evitar trampas y desync.
- Usar bots como herramienta de retención y matchmaking, no como sustituto permanente del PVP.
- Monetizar cosméticos, temporadas y comunidad; nunca poder directo.
- Convertir el `Performance Lab` actual en una herramienta de QA para estimar presupuesto por sala.
