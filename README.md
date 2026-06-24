# BombStick Arena FPS Optimizado

Preview jugable pseudo‑3D optimizada en Canvas, con música y efectos de sonido procedurales mediante Web Audio API.

## Cómo jugar
Abre `index.html` en un navegador moderno.

Controles:
- Click: capturar mouse / lanzar bomba
- Mouse: mirar
- WASD: moverse
- Shift: correr
- Espacio: dash
- 1-5: elegir bomba
- P: abrir/cerrar Performance Lab
- R: reiniciar
- Esc: pausa / liberar mouse / pausa o reanuda la música
- Botones Música/Efectos: activar o desactivar cada canal de audio por separado

## Plan multijugador

La planificación para evolucionar el prototipo hacia salas online, escalado tipo MMO, mejoras de jugabilidad y monetización está en [`docs/multiplayer-roadmap.md`](docs/multiplayer-roadmap.md).

## Diseño técnico
Esta versión usa Canvas pseudo‑3D en lugar de WebGL pesado.  
Incluye `libs/anime-lite.js`, un tweener local estilo anime.js para animaciones simples de mano/HUD sin depender de CDN.

El audio no necesita archivos externos: `js/game.js` sintetiza música de combate y SFX con Web Audio API para lanzamiento, bombas vacías, packs, dash, daño, KO, victoria/derrota, explosiones, fuego y hielo.

Los personajes usan un rig procedural inspirado en LoongBones/DragonBones (huesos de cabeza, torso, brazos y piernas) sobre Canvas para ganar movimiento natural sin cargar un runtime WebGL pesado. Las explosiones combinan blast, onda expansiva, chispas, humo y escombros; además, la cámara usa trauma amortiguado por distancia para evitar temblores permanentes cuando hay muchas bombas.

## Packs
- Frag: +10
- Sticky: +5
- Trap: +3
- Incendiaria: +3
- Congelante: +1

## Performance Lab
Permite ajustar:
- Música y efectos por separado
- Cantidad de bots / jugadores
- Cantidad de obstáculos
- Cantidad de packs
- Porcentaje de partículas
- Render scale
- FPS cap
- Daño visual del piso

## Archivos
- `index.html`
- `styles.css`
- `js/game.js`
- `libs/anime-lite.js`
- `README.md`

## Multijugador local/online MVP

El repositorio incluye una primera versión de servidor autoritativo por salas para jugar con varios clientes web mediante WebSocket.

### Requisitos

- Node.js 18 o superior.
- Dependencias instaladas con `npm install`.

### Levantar el servidor

```bash
npm install
npm run server
```

Por defecto el servidor escucha en `http://0.0.0.0:8080`, sirve el cliente web y acepta WebSocket en la misma dirección. Desde otra máquina abre `http://IP-DE-LA-MAQUINA:8080`, marca **Multijugador** y deja vacío el campo Servidor para que use esa misma dirección automáticamente. Puedes cambiar el puerto, host y la clave de firma de resultados con variables de entorno:

```bash
HOST=0.0.0.0 PORT=9090 RESULT_SECRET=clave-local npm run server
```

### Probar multijugador

1. Arranca el servidor con `npm run server`.
2. Abre `http://localhost:8080` en la misma máquina o `http://IP-DE-LA-MAQUINA:8080` desde otras máquinas con acceso de red.
3. Escribe tu nombre, marca **Multijugador** y pulsa **JUGAR / CONECTAR**.
4. Si el cliente se sirve desde otra URL, rellena el campo Servidor con `ws://IP-DE-LA-MAQUINA:8080`; si no, déjalo vacío para usar la dirección actual.

### Qué implementa el MVP

- Salas casuales con estados `CREATING`, `WAITING`, `COUNTDOWN`, `LIVE`, `OVERTIME`, `FINISHED` y `CLOSING`.
- Matchmaking casual por región, prioridad para salas existentes y creación automática de salas nuevas cuando no hay cupo.
- Bots de relleno para salas casuales.
- Simulación autoritativa a 20 ticks por segundo.
- Inputs de cliente en vez de posiciones finales.
- Snapshots compactos con tick, actores, bombas y eventos importantes.
- Validación de munición, cooldowns, dash, pickups, daño, KOs y rate limits básicos.
- Predicción/reconciliación/interpolación base en `js/net/client.js`.
- Resultados firmados por servidor y persistencia JSON mínima de sesiones/estadísticas en `data/sessions.json`.
- Telemetría base de ping, desconexiones, duración, KOs por minuto, bytes por jugador y tiempo de tick.

### Arquitectura y roadmap

- Diseño implementado: [`docs/multiplayer-architecture.md`](docs/multiplayer-architecture.md).
- Plan completo hacia producción/MMO-like: [`docs/multiplayer-roadmap.md`](docs/multiplayer-roadmap.md).
