# BombStick Arena FPS Optimizado

Preview jugable pseudo‑3D optimizada en Canvas.

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
- Esc: pausa / liberar mouse

## Diseño técnico
Esta versión usa Canvas pseudo‑3D en lugar de WebGL pesado.  
Incluye `libs/anime-lite.js`, un tweener local estilo anime.js para animaciones simples de mano/HUD sin depender de CDN.

Los personajes usan un rig procedural inspirado en LoongBones/DragonBones (huesos de cabeza, torso, brazos y piernas) sobre Canvas para ganar movimiento natural sin cargar un runtime WebGL pesado. Las explosiones combinan blast, onda expansiva, chispas, humo y escombros; además, la cámara usa trauma amortiguado por distancia para evitar temblores permanentes cuando hay muchas bombas.

## Packs
- Frag: +10
- Sticky: +5
- Trap: +3
- Incendiaria: +3
- Congelante: +1

## Performance Lab
Permite ajustar:
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
