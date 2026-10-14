# Cartuchera — Emulador web de GB, GBC, GBA y DS

## Estructura
```
index.html   → biblioteca de juegos
play.html    → reproductor (EmulatorJS)
games.js     → catálogo: acá agregás, quitás o editás juegos
roms/        → ROMs, una carpeta por consola (gb, gbc, gba, nds)
covers/      → portadas opcionales
```

## Agregar un juego
1. Copiá el ROM en la carpeta de su consola, por ejemplo `roms/gba/mijuego.gba`.
2. Sumá una línea en `games.js`:
   ```js
   { id: "mijuego", title: "Mi Juego", platform: "gba", year: 2026, color: "#4636C9", rom: "roms/gba/mijuego.gba", cover: "covers/mijuego.png" },
   ```
   `cover` es opcional. El `id` no debe cambiar después de publicar: las partidas guardadas dependen de él.

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

## Notas
- El emulador (EmulatorJS) se carga desde su CDN oficial; no hace falta instalar nada.
- DS es más exigente: anda fluido en PC y celulares de gama media/alta.
- Usá solo ROMs propios o con permiso de distribución. Los nombres actuales son de ejemplo.
