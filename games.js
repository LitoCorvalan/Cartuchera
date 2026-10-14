// Catálogo de juegos. Para agregar uno nuevo, sumá un objeto a esta lista
// y subí el ROM a la carpeta indicada en "rom".
//
// platform: "gb" | "gbc" | "gba" | "nds"
// color:    color de la etiqueta del cartucho
// cover:    (opcional) ruta a una imagen, ej. "covers/rojo.png"

const PLATFORMS = {
  gb:  { name: "Game Boy",         core: "gb",  short: "GB"  },
  gbc: { name: "Game Boy Color",   core: "gb",  short: "GBC" },
  gba: { name: "Game Boy Advance", core: "gba", short: "GBA" },
  nds: { name: "Nintendo DS",      core: "nds", short: "DS"  },
};

const GAMES = [
  // Game Boy
  { id: "rojo",      title: "Pokémon Rojo",        platform: "gb",  year: 1996, color: "#D63A3A", rom: "roms/gb/rojo.gb" },
  { id: "verde",     title: "Pokémon Verde",       platform: "gb",  year: 1996, color: "#3E9A4F", rom: "roms/gb/verde.gb" },
  { id: "azul",      title: "Pokémon Azul",        platform: "gb",  year: 1996, color: "#3567C9", rom: "roms/gb/azul.gb" },
  // Game Boy Color
  { id: "oro",       title: "Pokémon Oro",         platform: "gbc", year: 1999, color: "#C9A227", rom: "roms/gbc/oro.gbc" },
  { id: "plata",     title: "Pokémon Plata",       platform: "gbc", year: 1999, color: "#9AA3AE", rom: "roms/gbc/plata.gbc" },
  { id: "cristal",   title: "Pokémon Cristal",     platform: "gbc", year: 2000, color: "#5FB7D4", rom: "roms/gbc/cristal.gbc" },
  // Game Boy Advance
  { id: "rubi",      title: "Pokémon Rubí",        platform: "gba", year: 2002, color: "#B8243C", rom: "roms/gba/rubi.gba" },
  { id: "zafiro",    title: "Pokémon Zafiro",      platform: "gba", year: 2002, color: "#22489E", rom: "roms/gba/zafiro.gba" },
  { id: "rojofuego", title: "Pokémon Rojo Fuego",  platform: "gba", year: 2004, color: "#E2632B", rom: "roms/gba/rojofuego.gba" },
  { id: "verdehoja", title: "Pokémon Verde Hoja",  platform: "gba", year: 2004, color: "#6BB33A", rom: "roms/gba/verdehoja.gba" },
  { id: "esmeralda", title: "Pokémon Esmeralda",   platform: "gba", year: 2004, color: "#1E9C72", rom: "roms/gba/esmeralda.gba" },
  // Nintendo DS
  { id: "diamante",  title: "Pokémon Diamante",    platform: "nds", year: 2006, color: "#6E8FD8", rom: "roms/nds/diamante.nds" },
  { id: "perla",     title: "Pokémon Perla",       platform: "nds", year: 2006, color: "#D99BB4", rom: "roms/nds/perla.nds" },
  { id: "platino",   title: "Pokémon Platino",     platform: "nds", year: 2008, color: "#7D7A8C", rom: "roms/nds/platino.nds" },
  { id: "heartgold", title: "Pokémon Oro HeartGold",   platform: "nds", year: 2009, color: "#D9A520", rom: "roms/nds/heartgold.nds" },
  { id: "soulsilver",title: "Pokémon Plata SoulSilver",platform: "nds", year: 2009, color: "#A7B4C4", rom: "roms/nds/soulsilver.nds" },
  { id: "negro",     title: "Pokémon Negro",       platform: "nds", year: 2010, color: "#2B2B30", rom: "roms/nds/negro.nds" },
  { id: "blanco",    title: "Pokémon Blanco",      platform: "nds", year: 2010, color: "#ECECEA", rom: "roms/nds/blanco.nds" },
  { id: "negro2",    title: "Pokémon Negro 2",     platform: "nds", year: 2012, color: "#1E2A3A", rom: "roms/nds/negro2.nds" },
  { id: "blanco2",   title: "Pokémon Blanco 2",    platform: "nds", year: 2012, color: "#E8E2D6", rom: "roms/nds/blanco2.nds" },
];
