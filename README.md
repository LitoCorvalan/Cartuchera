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

Límites de GitHub: 25 MB por archivo subido desde la web. Para ROMs más grandes, dividilas en partes (ver abajo).

## ROMs grandes (DS): dividir en partes
Opción fácil, sirve con WinRAR: abrí `dividir.html` de tu sitio (o directamente desde la carpeta, con doble clic),
elegí el ROM o el .rar/.zip que hiciste con WinRAR (sin dividir en volúmenes) y te genera las partes
y la línea para `games.js`. No uses la opción de volúmenes de WinRAR: esas partes no se pueden unir.

### Con 7-Zip
No necesita cuentas ni servicios extra: todo queda en GitHub.
1. Renombrá el ROM con el `id` del juego, por ejemplo `platino.nds`.
   Importante: la partida guardada toma el nombre de este archivo, así que tiene que ser único.
2. Con 7-Zip (gratis, 7-zip.org): clic derecho sobre el ROM → 7-Zip → Añadir al archivo…
   - Formato: 7z · Nivel de compresión: Ultra
   - Dividir en volúmenes: escribí `23M`
   Se generan `platino.7z.001`, `platino.7z.002`, etc.
3. Subí todas las partes a `roms/nds/` (la web de GitHub acepta varias a la vez).
4. En `games.js`:
   ```js
   rom: "roms/nds/platino.7z",
   ```
   Las partes `.001`, `.002`… se detectan solas (opcionalmente podés indicar `parts: 5`).
La página descarga las partes, las une, muestra el progreso y las guarda en el dispositivo:
la segunda vez el juego abre sin volver a descargar.

GitHub recomienda que el sitio completo no supere 1 GB. Si con todos los juegos de DS te pasás,
dejá los más pesados (Negro/Blanco 2) en Backblaze B2.

## Alternativa: Backblaze B2 (sin tarjeta)
10 GB gratis y descargas gratis hasta el triple de lo almacenado por día.
1. Creá la cuenta en backblaze.com (B2 Cloud Storage) y verificá el email.
2. Buckets → Create a Bucket → Files in Bucket: **Public**.
3. Subí los ROMs comprimidos (mismo criterio de nombres que arriba; no hace falta dividirlos).
4. Bucket Settings → CORS Rules → "Share everything in this bucket with all HTTPS origins",
   marcando B2 Native API y S3.
5. Copiá la dirección pública del archivo (Friendly URL, del tipo
   `https://f005.backblazeb2.com/file/mi-bucket/platino.7z`) y usala en `games.js`:
   ```js
   rom: "https://f005.backblazeb2.com/file/mi-bucket/platino.7z"
   ```

Importante con ROMs comprimidas: la partida guardada toma el nombre del archivo que está adentro del .7z/.zip.
No cambies ese nombre después de publicar, o los jugadores dejan de ver su partida.

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
Todo entra en una sola pantalla. Si el juego queda apaisado (DS lado a lado o híbrido), los controles pasan abajo para que la imagen sea más grande. En celular, el juego va arriba y las opciones en pestañas.
Están fuera de la pantalla de juego y en español: pausa, reinicio, avance rápido, volumen, pantalla completa,
3 ranuras de estados rápidos por juego, descarga y carga de la partida (.sav).
El botón "Controles y configuración" abre la configuración completa del emulador en español: teclas reasignables, joystick, velocidad,
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

## Nintendo DS: núcleo DeSmuME
La web usa DeSmuME para DS. Con melonDS, los Pokémon de DS muestran "Ha habido un error de conexión"
al cargar la partida porque ese núcleo necesita el BIOS y firmware de una DS real.
Si un juego tenía partida de melonDS, se traslada sola a DeSmuME la primera vez.
Para usar otro núcleo en un juego puntual: `core: "melonds"` en su línea de `games.js`.
Si va lento: Configuración del emulador → Núcleo → Salto de fotogramas.
La partida se copia al almacenamiento del navegador cada 2 segundos y al cerrar la página
(DeSmuME escribe sobre el archivo sin cerrarlo y el navegador no lo guardaba solo). Aparece el aviso
"Partida guardada en este navegador" cuando cambia.
La pantalla táctil se usa con el mouse de forma directa (el lápiz va donde está el cursor, sin capturarlo).

## Notas
- El emulador (EmulatorJS) se carga desde su CDN oficial; no hace falta instalar nada.
- DS es más exigente: anda fluido en PC y celulares de gama media/alta.
- Usá solo ROMs propios o con permiso de distribución. Los nombres actuales son de ejemplo.
