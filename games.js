// Catálogo de juegos. Para agregar uno nuevo, sumá un objeto a esta lista
// y subí el ROM a la carpeta indicada en "rom".
//
// rom:      ruta dentro del sitio (ej. "roms/gba/esmeralda.gba") o una dirección completa
//           si el archivo está en otro servidor (ej. "https://roms.midominio.com/platino.7z").
//           Se aceptan ROMs comprimidos en .zip o .7z.
// parts:    (opcional) si el ROM está dividido en partes con 7-Zip (platino.7z.001, .002, …),
//           poné en "rom" el nombre sin el número (ej. "roms/nds/platino.7z") y en "parts" la cantidad.
// parts:    (opcional) cantidad de partes si el ROM comprimido está dividido para entrar en GitHub
//           (máximo 25 MB por archivo). Con rom: "roms/nds/platino.7z" y parts: 4 se cargan
//           platino.7z.001, platino.7z.002, platino.7z.003 y platino.7z.004 y se unen en el navegador.
// platform: "gb" | "gbc" | "gba" | "nds"
// color:    color de la etiqueta del cartucho
// cover:    (opcional) ruta a una imagen. Si no lo ponés, se busca sola en
//           covers/<id>.webp, .jpg o .png (ej. covers/rojo.jpg)
// party:    (opcional) activa el visor de equipo Pokémon. Valores:
//           gen1, gen2, gen2c (Cristal), gen3, gen4dp, gen4pt, gen4hgss, gen5

const PLATFORMS = {
  gb:  { name: "Game Boy",         core: "gb",  short: "GB"  },
  gbc: { name: "Game Boy Color",   core: "gb",  short: "GBC" },
  gba: { name: "Game Boy Advance", core: "gba", short: "GBA" },
  nds: { name: "Nintendo DS",      core: "nds", short: "DS"  },
};

const GAMES = [
  // Game Boy
  { id: "rojo",      title: "Pokémon Rojo",        platform: "gb",  year: 1996, color: "#D63A3A", rom: "roms/gb/rojo.gb", party: "gen1" },
  { id: "verde",     title: "Pokémon Verde",       platform: "gb",  year: 1996, color: "#3E9A4F", rom: "roms/gb/verde.gb", party: "gen1" },
  { id: "azul",      title: "Pokémon Azul",        platform: "gb",  year: 1996, color: "#3567C9", rom: "roms/gb/azul.gb", party: "gen1" },
  // Game Boy Color
  { id: "oro",       title: "Pokémon Oro",         platform: "gbc", year: 1999, color: "#C9A227", rom: "roms/gbc/oro.gbc", party: "gen2" },
  { id: "plata",     title: "Pokémon Plata",       platform: "gbc", year: 1999, color: "#9AA3AE", rom: "roms/gbc/plata.gbc", party: "gen2" },
  { id: "cristal",   title: "Pokémon Cristal",     platform: "gbc", year: 2000, color: "#5FB7D4", rom: "roms/gbc/cristal.gbc", party: "gen2c" },
  // Game Boy Advance
  { id: "rubi",      title: "Pokémon Rubí",        platform: "gba", year: 2002, color: "#B8243C", rom: "roms/gba/rubi.gba", party: "gen3" },
  { id: "zafiro",    title: "Pokémon Zafiro",      platform: "gba", year: 2002, color: "#22489E", rom: "roms/gba/zafiro.gba", party: "gen3" },
  { id: "rojofuego", title: "Pokémon Rojo Fuego",  platform: "gba", year: 2004, color: "#E2632B", rom: "roms/gba/rojofuego.gba", party: "gen3" },
  { id: "verdehoja", title: "Pokémon Verde Hoja",  platform: "gba", year: 2004, color: "#6BB33A", rom: "roms/gba/verdehoja.gba", party: "gen3" },
  { id: "esmeralda", title: "Pokémon Esmeralda",   platform: "gba", year: 2004, color: "#1E9C72", rom: "roms/gba/esmeralda.gba", party: "gen3" },
  // Nintendo DS
  { id: "diamante",  title: "Pokémon Diamante",    platform: "nds", year: 2006, color: "#6E8FD8", rom: "roms/nds/diamante.nds", party: "gen4dp" },
  { id: "perla",     title: "Pokémon Perla",       platform: "nds", year: 2006, color: "#D99BB4", rom: "roms/nds/perla.nds", party: "gen4dp" },
  { id: "platino",   title: "Pokémon Platino",     platform: "nds", year: 2008, color: "#7D7A8C", rom: "roms/nds/platino.nds", party: "gen4pt" },
  { id: "heartgold", title: "Pokémon Oro HeartGold",   platform: "nds", year: 2009, color: "#D9A520", rom: "roms/nds/heartgold.nds", party: "gen4hgss" },
  { id: "soulsilver",title: "Pokémon Plata SoulSilver",platform: "nds", year: 2009, color: "#A7B4C4", rom: "roms/nds/soulsilver.nds", party: "gen4hgss" },
  { id: "negro",     title: "Pokémon Negro",       platform: "nds", year: 2010, color: "#2B2B30", rom: "roms/nds/negro.nds", party: "gen5" },
  { id: "blanco",    title: "Pokémon Blanco",      platform: "nds", year: 2010, color: "#ECECEA", rom: "roms/nds/blanco.nds", party: "gen5" },
  { id: "negro2",    title: "Pokémon Negro 2",     platform: "nds", year: 2012, color: "#1E2A3A", rom: "roms/nds/negro2.nds", party: "gen5" },
  { id: "blanco2",   title: "Pokémon Blanco 2",    platform: "nds", year: 2012, color: "#E8E2D6", rom: "roms/nds/blanco2.nds", party: "gen5" },
];
