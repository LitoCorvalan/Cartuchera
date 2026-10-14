# Cartuchera — Emulador web de GB, GBC, GBA y DS

## Estructura
```
index.html   → biblioteca de juegos
play.html    → reproductor (EmulatorJS)
games.js     → catálogo: acá agregás, quitás o editás juegos
roms/        → ROMs, una carpeta por consola (gb, gbc, gba, nds)
party.js     → lectura y escritura del equipo Pokémon en la partida guardada
trade.js     → intercambio en línea entre jugadores
covers/      → portadas de los cartuchos
```

## Agregar un juego
1. Copiá el ROM en la carpeta de su consola, por ejemplo `roms/gba/mijuego.gba`.
2. Sumá una línea en `games.js`:
   ```js
   { id: "mijuego", title: "Mi Juego", platform: "gba", year: 2026, color: "#4636C9", rom: "roms/gba/mijuego.gba", cover: "covers/mijuego.png" },
   ```
   El `id` no debe cambiar después de publicar: las partidas guardadas dependen de él.
   `party` es opcional y activa el visor de equipo (ver más abajo).

## Portadas
Guardá una imagen con el mismo nombre que el `id` del juego en `covers/`: por ejemplo `covers/esmeralda.jpg`.
Sirven `.webp`, `.jpg` o `.png`; se detectan solas. Proporción ideal: cuadrada para GB/GBC/DS y apaisada (3:2) para GBA.
También podés indicar otra ruta con el campo `cover`.

Los juegos de ejemplo apuntan a archivos que todavía no existen; si alguien abre uno, la página avisa que falta el ROM.

## Publicar en GitHub Pages
1. Creá un repositorio y subí todo el contenido de esta carpeta.
2. Settings → Pages → Source: "Deploy from a branch", rama `main`, carpeta `/ (root)`.
3. En un minuto queda en `https://TU-USUARIO.github.io/NOMBRE-REPO/`.

Límite de GitHub: 100 MB por archivo. Para ROMs más grandes usá Netlify, Cloudflare Pages o un hosting propio.

## Probar en tu computadora
No funciona abriendo el HTML con doble clic. Levantá un servidor local:
```
python -m http.server 8000
```
y entrá a http://localhost:8000

## Guardado de partidas
- El guardado normal del juego se almacena automáticamente en el navegador del usuario (IndexedDB).
- Si el usuario borra los datos del navegador, pierde la partida. Desde el menú del emulador puede exportarla e importarla.

## Opciones del emulador
Están fuera de la pantalla de juego y en español: pausa, reinicio, avance rápido, volumen, pantalla completa,
3 ranuras de estados rápidos por juego, descarga y carga de la partida (.sav).
Debajo está la configuración completa del emulador en español: teclas reasignables, joystick, velocidad,
imagen (filtros, FPS, rotación), opciones del núcleo de cada consola y frecuencia de guardado en el navegador.
Las opciones se leen del propio EmulatorJS (versión fijada en 4.2.3) y se guardan por navegador.

## Visor de equipo Pokémon
Muestra los 6 Pokémon del equipo con imagen, nombre en español, mote, nivel, PS y si es variocolor.
Lee la partida guardada: se actualiza cada vez que el jugador guarda dentro del juego.

| party      | Juegos                                   |
|------------|------------------------------------------|
| `gen1`     | Rojo, Verde, Azul                        |
| `gen2`     | Oro, Plata                               |
| `gen2c`    | Cristal                                  |
| `gen3`     | Rubí, Zafiro, Esmeralda, Rojo Fuego, Verde Hoja |
| `gen4dp`   | Diamante, Perla                          |
| `gen4pt`   | Platino                                  |
| `gen4hgss` | Oro HeartGold, Plata SoulSilver          |
| `gen5`     | Negro, Blanco, Negro 2, Blanco 2         |

Los nombres salen de PokéAPI y las imágenes del repositorio de sprites de PokéAPI (con el estilo de cada generación).
Está pensado para versiones occidentales (español/inglés) y hacks basados en ellas; las versiones japonesas usan otra estructura.

## Intercambio en línea
Botón "Intercambiar en línea" en el panel del equipo.
1. Los dos jugadores guardan la partida dentro del juego.
2. Uno toca "Crear sala" y le pasa el código de 6 letras al otro, que toca "Unirme".
3. Cada uno elige qué Pokémon enviar, ven la oferta del otro y confirman.
4. La web escribe la partida, recalcula las sumas de verificación y reinicia el juego.

- Compatibilidad: igual que en las consolas, solo entre juegos de la misma generación
  (Gen 1 entre sí, Oro/Plata/Cristal, Gen 3, Gen 4, Gen 5).
- Evoluciones por intercambio sin objeto: Kadabra, Machoke, Graveler, Haunter, Boldore y Gurdurr
  (salvo que lleven Piedra Eterna). Las que requieren objeto todavía no están implementadas.
- Seguridad: antes de escribir, verifica las sumas de verificación de la partida; si algo no coincide,
  cancela sin tocar nada. Además guarda un respaldo automático: "Restaurar partida previa al último intercambio".
- Conexión: directa entre navegadores (WebRTC) usando el servidor público gratuito de PeerJS solo para
  encontrarse. Si en algún momento falla o querés más control, se puede montar un servidor PeerJS propio.

## Notas
- El emulador (EmulatorJS) se carga desde su CDN oficial; no hace falta instalar nada.
- DS es más exigente: anda fluido en PC y celulares de gama media/alta.
- Usá solo ROMs propios o con permiso de distribución. Los nombres actuales son de ejemplo.
