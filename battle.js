// Combate en línea entre dos jugadores, con el motor de Pokémon Showdown (@pkmn/sim, licencia MIT).
// Los dos navegadores simulan el mismo combate con la misma semilla y solo se envían las elecciones de cada turno.
// Antes de cada turno se compara el estado del generador aleatorio: si no coincide, el combate se cancela.
// No modifica la partida guardada. Requiere window.Cartuchera (play.html), party.js, battle-data.js y vendor/pkmn-sim.js.

// ---------- Núcleo: equipos y simulación (sin interfaz) ----------
const BattleCore = (() => {
  const NATURES = ['Hardy','Lonely','Brave','Adamant','Naughty','Bold','Docile','Relaxed','Impish','Lax','Timid','Hasty','Serious',
    'Jolly','Naive','Modest','Mild','Quiet','Bashful','Rash','Calm','Gentle','Sassy','Careful','Quirky'];
  // Formas que cambian el combate (Gen 4-5), según el valor de forma guardado en la partida
  const FORMS = { 386:['Deoxys','Deoxys-Attack','Deoxys-Defense','Deoxys-Speed'], 413:['Wormadam','Wormadam-Sandy','Wormadam-Trash'],
    479:['Rotom','Rotom-Heat','Rotom-Wash','Rotom-Frost','Rotom-Fan','Rotom-Mow'], 487:['Giratina','Giratina-Origin'], 492:['Shaymin','Shaymin-Sky'],
    550:['Basculin','Basculin-Blue-Striped'], 641:['Tornadus','Tornadus-Therian'], 642:['Thundurus','Thundurus-Therian'],
    645:['Landorus','Landorus-Therian'], 646:['Kyurem','Kyurem-White','Kyurem-Black'], 647:['Keldeo','Keldeo-Resolute'] };
  const GEN = { g1:1, g2:2, g3:3, g4:4, g5:5 };
  const cache = {};

  function dex(gen){
    if (cache[gen]) return cache[gen];
    const D = PkmnSim.Dex.forGen(gen), species = {}, moves = {}, abilities = {};
    for (const s of D.species.all()) if (s.exists && s.num > 0 && !s.forme) species[s.num] ??= s.name;
    for (const m of D.moves.all()) if (m.exists && m.num > 0 && (!moves[m.num] || m.name.length < moves[m.num].length)) moves[m.num] = m.name;
    for (const a of D.abilities.all()) if (a.exists && a.num > 0) abilities[a.num] ??= a.name;
    return cache[gen] = { D, species, moves, abilities };
  }

  // Un Pokémon de la partida -> set de Showdown. El nivel se baja al tope (las estadísticas se recalculan solas).
  function toSet(info, cap, gen){
    const { D, species, moves, abilities } = dex(gen);
    const base = species[info.dex]; if (!base) return null;
    let name = base;
    if (gen >= 4 && FORMS[info.dex]?.[info.form]) name = FORMS[info.dex][info.form];
    const item = gen >= 2 ? (BATTLE_DATA.items[gen][info.item] || '') : '';
    if (item) { const it = D.items.get(item);
      if (it.forcedForme && D.species.get(it.forcedForme).baseSpecies === base) name = it.forcedForme; }
    const sp = D.species.get(name);
    let ability;
    if (gen === 3) ability = (info.abilitySlot && sp.abilities[1]) || sp.abilities[0];
    else if (gen >= 4) ability = abilities[info.ability] || sp.abilities[0];
    let gender = '';
    if (gen >= 2) {
      if (sp.gender) gender = sp.gender;
      else if (gen === 2) gender = info.atkDV < sp.genderRatio.F * 16 ? 'F' : 'M';
      else if (gen === 3) gender = info.genderValue < sp.genderRatio.F * 256 - 1 ? 'F' : 'M';
      else gender = info.gender === 'F' ? 'F' : 'M';
    }
    const nick = info.nickname && info.nickname.toUpperCase() !== base.toUpperCase() ? info.nickname : '';
    const st = ['hp','atk','def','spa','spd','spe'], obj = a => Object.fromEntries(st.map((k, i) => [k, a[i]]));
    const mv = info.moves.map(n => moves[n]).filter(Boolean);
    if (!mv.length) return null;
    return { name: (nick || BATTLE_DATA.species[info.dex] || base).slice(0, 18), species: sp.name, item, ability, moves: mv,
      nature: info.nature != null ? NATURES[info.nature] : undefined, evs: obj(info.evs), ivs: obj(info.ivs),
      level: Math.max(1, Math.min(info.level, cap)), gender, shiny: info.shiny, happiness: info.happiness };
  }

  function team(kind, payloads, cap){
    const gen = GEN[PartyReader.family(kind)];
    return payloads.map(p => { const i = PartyReader.battleInfo(kind, p); return i && toSet(i, cap, gen); }).filter(Boolean).slice(0, 6);
  }

  // Combate sincronizado: submit() recibe la elección de cada lado; cuando están todas, se aplican siempre en orden p1, p2.
  function duel({ gen, seed, teams, mySide, onLines, onRequest }){
    const battle = new PkmnSim.Battle({ formatid: `gen${gen}customgame` + (gen === 5 ? '@@@!Team Preview' : ''), seed,
      send: (type, data) => {
        if (type === 'update') {
          const L = Array.isArray(data) ? data : String(data).split('\n'), out = [];
          for (let i = 0; i < L.length; i++) { if (L[i].startsWith('|split|')) { out.push(L[i + 1]); i += 2; } else out.push(L[i]); }
          onLines(out);
        } else if (type === 'sideupdate') {
          const nl = data.indexOf('\n'), side = data.slice(0, nl), msg = data.slice(nl + 1);
          if (side === mySide && msg.startsWith('|request|')) onRequest(JSON.parse(msg.slice(9)));
        }
      } });
    battle.setPlayer('p1', { name: 'p1', team: teams[0] });
    battle.setPlayer('p2', { name: 'p2', team: teams[1] });
    let round = 0, pending = {}, roundSeed = battle.prng.getSeed();
    const need = () => battle.ended ? [] : battle.sides.filter(s => s.requestState).map(s => s.id);
    function submit(side, r, choice, seedAt){
      if (r !== round) throw new Error(`ronda ${r} != ${round}`);
      if (seedAt && seedAt !== roundSeed) throw new Error('desincronizado');
      if (!need().includes(side)) throw new Error('elección fuera de turno');
      pending[side] = choice;
      const n = need();
      if (!n.every(s => pending[s] != null)) return false;
      for (const s of ['p1','p2']) if (n.includes(s) && !battle.choose(s, pending[s])) throw new Error('elección inválida');
      pending = {}; round++; roundSeed = battle.prng.getSeed();
      battle.sendUpdates();
      return true;
    }
    function lose(side){ battle.lose(side); battle.sendUpdates(); }
    return { battle, submit, lose, start: () => battle.sendUpdates(),
      get round(){ return round; }, get seed(){ return roundSeed; },
      needs: side => need().includes(side) && pending[side] == null };
  }

  return { team, duel, dex, GEN };
})();

// ---------- Interfaz y conexión ----------
(() => {
  if (typeof document === 'undefined' || !window.Cartuchera) return;
  const C = window.Cartuchera, g = C.game, kind = g.party, fam = PartyReader.family(kind), gen = BattleCore.GEN[fam];
  const PEERJS = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
  const PREFIX = 'cartuchera-b1-', ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const dlg = document.getElementById('battle'), body = document.getElementById('battle-body');

  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const b64 = u => { let s = ''; u.forEach(b => s += String.fromCharCode(b)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const loadScript = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s); });
  let libs = null;
  const loadLibs = () => libs ??= Promise.all([
    window.Peer || loadScript(PEERJS), window.PkmnSim || loadScript('vendor/pkmn-sim.js'), window.BATTLE_DATA || loadScript('battle-data.js'),
  ]).catch(e => { libs = null; throw e; });

  let peer = null, conn = null, host = false, cap = 50, mine = [], them = null, duel = null, mySide = 'p1', req = null, ended = false;
  const send = m => { try { conn?.open && conn.send(m); } catch {} };
  function closeLink(){ try { conn?.close(); } catch {} try { peer?.destroy(); } catch {} conn = peer = null; }

  // ---------- Textos ----------
  const TYPES = { Normal:'Normal', Fire:'Fuego', Water:'Agua', Electric:'Eléctrico', Grass:'Planta', Ice:'Hielo', Fighting:'Lucha', Poison:'Veneno',
    Ground:'Tierra', Flying:'Volador', Psychic:'Psíquico', Bug:'Bicho', Rock:'Roca', Ghost:'Fantasma', Dragon:'Dragón', Dark:'Siniestro', Steel:'Acero', '???':'???' };
  const TYPE_COLOR = { Normal:'#9FA19F', Fire:'#E62829', Water:'#2980EF', Electric:'#E0B000', Grass:'#3FA129', Ice:'#3DCEF3', Fighting:'#FF8000', Poison:'#9141CB',
    Ground:'#915121', Flying:'#81B9EF', Psychic:'#EF4179', Bug:'#91A119', Rock:'#AFA981', Ghost:'#704170', Dragon:'#5060E1', Dark:'#624D4E', Steel:'#60A1B8' };
  const STAT = { atk:'el Ataque', def:'la Defensa', spa:'el Ataque Especial', spd:'la Defensa Especial', spe:'la Velocidad', accuracy:'la Precisión', evasion:'la Evasión', spc:'el Especial' };
  const STATUS = { brn:['QUE','#E0663A'], par:['PAR','#D8B21E'], slp:['DOR','#8C8C9C'], frz:['CON','#4FB6D8'], psn:['ENV','#A04CC0'], tox:['ENV','#A04CC0'] };
  const GOT = { brn:'se quemó', par:'está paralizado. ¡Quizás no pueda moverse!', slp:'se durmió', frz:'se congeló', psn:'fue envenenado', tox:'fue gravemente envenenado' };
  const D = () => BattleCore.dex(gen).D;
  const moveEs = n => { const m = D().moves.get(n); return (m.exists && BATTLE_DATA.moves[m.num]) || n; };
  const abilityEs = n => { const a = D().abilities.get(n); return (a.exists && BATTLE_DATA.abilities[a.num]) || n; };
  const itemEs = n => { const i = D().items.get(n); return BATTLE_DATA.itemsEs[i.id] || n; };
  const EFFECT = { brn:'la quemadura', psn:'el veneno', tox:'el veneno', confusion:'la confusión', Sandstorm:'la tormenta de arena', Hail:'el granizo',
    Recoil:'el retroceso', 'Leech Seed':'Drenadoras', leechseed:'Drenadoras', Spikes:'las Púas', 'Stealth Rock':'las piedras puntiagudas',
    nightmare:'Pesadilla', curse:'la maldición', partiallytrapped:'el ataque que lo atrapa', 'Struggle Recoil':'el retroceso' };
  function effect(e){
    if (!e) return '';
    if (e.startsWith('item: ')) return itemEs(e.slice(6));
    if (e.startsWith('ability: ')) return abilityEs(e.slice(9));
    if (e.startsWith('move: ')) return moveEs(e.slice(6));
    return EFFECT[e] || moveEs(e);
  }

  // ---------- Estado visible ----------
  let field;
  const freshSide = () => ({ active:null, seen:new Map(), size:0 });
  function parseCond(c){
    const [hp, st] = String(c).split(' '); if (st === 'fnt' || hp === '0') return { hp:0, max:1, status:'', fnt:true };
    const [a, b] = hp.split('/').map(Number); return { hp:a, max:b || 100, status:st || '', fnt:false };
  }
  function parseDetails(d){ const [species, ...r] = d.split(', '); const l = r.find(x => /^L\d+$/.test(x));
    return { species, level: l ? +l.slice(1) : 100, shiny: r.includes('shiny') }; }
  const sideOf = id => id.slice(0, 2);
  const nameOf = id => id.slice(id.indexOf(': ') + 2);
  const who = id => { const n = esc(nameOf(id)); return sideOf(id) === mySide ? n : `${n} rival`; };
  const Who = id => { const s = who(id); return s[0].toUpperCase() + s.slice(1); };

  function lineText(line){
    const parts = line.split('|'); if (parts.length < 2) return null;
    const cmd = parts[1], kw = {}, a = [];
    for (const p of parts.slice(2)) { const m = /^\[(\w+)\]\s?(.*)$/.exec(p); if (m) kw[m[1]] = m[2]; else a.push(p); }
    const S = id => field[sideOf(id)];
    const upd = (id, cond, det) => { const s = S(id), key = nameOf(id); let p = s.seen.get(key) || {};
      if (det) Object.assign(p, parseDetails(det)); if (cond != null) Object.assign(p, parseCond(cond)); p.name = nameOf(id); s.seen.set(key, p); return p; };
    switch (cmd) {
      case 'teamsize': field[a[0]].size = +a[1]; return null;
      case 'turn': return `<p class="b-turn">Turno ${a[0]}</p>`;
      case 'switch': case 'drag': {
        const s = S(a[0]); s.active = nameOf(a[0]); upd(a[0], a[2], a[1]);
        if (cmd === 'drag') return `${Who(a[0])} fue arrastrado al combate.`;
        return sideOf(a[0]) === mySide ? `¡Adelante, ${esc(nameOf(a[0]))}!` : `Tu rival envió a ${esc(nameOf(a[0]))}.`; }
      case 'detailschange': case '-formechange': upd(a[0], null, a[1]); return null;
      case 'move': return `${Who(a[0])} usó <b>${esc(moveEs(a[1]))}</b>.`;
      case '-damage': case '-heal': case '-sethp': {
        upd(a[0], a[1]); if (cmd === '-sethp') return null;
        const f = kw.from;
        if (cmd === '-heal') return f ? `${Who(a[0])} recuperó PS gracias a ${esc(effect(f))}.` : null;
        if (!f) return null;
        if (f === 'confusion') return `¡${Who(a[0])} está tan confuso que se hirió a sí mismo!`;
        if (f === 'Recoil' || f === 'Struggle Recoil') return `${Who(a[0])} sufrió daño por el retroceso.`;
        return `${Who(a[0])} sufrió daño por ${esc(effect(f))}.`; }
      case 'faint': upd(a[0], '0 fnt'); return `¡${Who(a[0])} se debilitó!`;
      case '-status': upd(a[0]).status = a[1]; return `¡${Who(a[0])} ${GOT[a[1]] || 'cambió de estado'}!`;
      case '-curestatus': upd(a[0]).status = ''; return a[1] === 'slp' ? `¡${Who(a[0])} se despertó!` : a[1] === 'frz' ? `¡${Who(a[0])} se descongeló!` : `${Who(a[0])} se curó.`;
      case 'cant': {
        const r = { slp:'está dormido.', par:'está paralizado. ¡No se puede mover!', frz:'está congelado.', recharge:'necesita recuperarse.',
          flinch:'retrocedió y no pudo moverse.', nopp:'no tiene PP.', Truant:'está holgazaneando.', Focus_Punch:'perdió la concentración.' }[a[1]] || 'no se puede mover.';
        return `${Who(a[0])} ${r}`; }
      case '-fail': return '¡Pero falló!';
      case '-miss': return `¡El ataque de ${who(a[0])} falló!`;
      case '-crit': return '¡Un golpe crítico!';
      case '-supereffective': return '¡Es súper eficaz!';
      case '-resisted': return 'No es muy eficaz…';
      case '-immune': return `No afecta a ${who(a[0])}…`;
      case '-ohko': return '¡KO de un golpe!';
      case '-hitcount': return `¡Golpeó ${a[1]} ${a[1] === '1' ? 'vez' : 'veces'}!`;
      case '-boost': case '-unboost': {
        const n = +a[2], up = cmd === '-boost', st = STAT[a[1]] || a[1];
        if (!n) return `¡${st[0].toUpperCase() + st.slice(1)} de ${who(a[0])} no puede ${up ? 'subir' : 'bajar'} más!`;
        return `¡${st[0].toUpperCase() + st.slice(1)} de ${who(a[0])} ${up ? 'subió' : 'bajó'}${n >= 3 ? ' muchísimo' : n === 2 ? ' mucho' : ''}!`; }
      case '-setboost': return `¡${Who(a[0])} maximizó su Ataque!`;
      case '-clearallboost': case '-clearboost': return 'Se anularon los cambios de características.';
      case '-weather': {
        if (a[0] === 'none') return 'El tiempo volvió a la normalidad.';
        const w = { SunnyDay:['El sol pega fuerte.','El sol sigue pegando fuerte.'], RainDance:['¡Empezó a llover!','Sigue lloviendo.'],
          Sandstorm:['¡Se desató una tormenta de arena!','La tormenta de arena sigue.'], Hail:['¡Empezó a granizar!','Sigue granizando.'] }[a[0]];
        return w ? w[kw.upkeep !== undefined ? 1 : 0] : null; }
      case '-start': {
        const e = a[1].replace(/^move: /, '');
        if (e === 'confusion') return `¡${Who(a[0])} se encuentra confuso!`;
        if (e === 'Substitute') return `¡${Who(a[0])} creó un sustituto!`;
        if (e === 'Leech Seed') return `¡${Who(a[0])} fue infectado por Drenadoras!`;
        if (e === 'typechange') return null;
        if (/^perish/.test(e)) return `Cuenta atrás de ${who(a[0])}: ${e.slice(6)}.`;
        return null; }
      case '-end': {
        const e = a[1].replace(/^move: /, '');
        if (e === 'confusion') return `${Who(a[0])} ya no está confuso.`;
        if (e === 'Substitute') return `El sustituto de ${who(a[0])} desapareció.`;
        return null; }
      case '-sidestart': case '-sideend': {
        const e = esc(effect(a[1].replace(/^move: /, ''))), team = a[0].startsWith(mySide) ? 'tu equipo' : 'el equipo rival';
        if (cmd === '-sideend') return `${e} dejó de hacer efecto en ${team}.`;
        return /Spikes|Stealth Rock/.test(a[1]) ? `¡${e} rodea a ${team}!` : `¡${e} protege a ${team}!`; }
      case '-item': return `${Who(a[0])} tiene ${esc(itemEs(a[1]))}.`;
      case '-enditem': return /berry/i.test(a[1]) ? `${Who(a[0])} comió su ${esc(itemEs(a[1]))}.` : kw.from ? null : `${Who(a[0])} usó su ${esc(itemEs(a[1]))}.`;
      case '-ability': return `[${esc(abilityEs(a[1]))} de ${who(a[0])}]`;
      case '-activate': {
        const e = (a[1] || '').replace(/^move: /, '');
        if (e === 'confusion') return `${Who(a[0])} está confuso.`;
        if (e === 'Protect' || e === 'Detect') return `¡${Who(a[0])} se protegió!`;
        if (e === 'Substitute') return `¡El sustituto recibió el daño!`;
        return null; }
      case '-prepare': return `${Who(a[0])} se está preparando.`;
      case '-transform': return `¡${Who(a[0])} se transformó en ${esc(nameOf(a[1]))}!`;
      case '-message': return esc(a[0]);
      case 'win': ended = true; return `<p class="b-turn">${a[0] === mySide ? '¡Ganaste el combate!' : 'Tu rival ganó el combate.'}</p>`;
      case 'tie': ended = true; return '<p class="b-turn">¡Empate!</p>';
    }
    return null;
  }

  // ---------- Pantallas ----------
  function view(html){ body.innerHTML = html; body.querySelector('[autofocus]')?.focus(); }
  function error(msg){
    view(`<h2>Combate cancelado</h2><p>${msg}</p><div class="t-actions"><button class="btn" data-act="home">Volver</button></div>`);
    closeLink(); duel = null;
  }
  function home(){
    view(`<h2>Combatir en línea</h2>
      <p>Enfrentá tu equipo con el de alguien que juegue un juego de la misma generación (${PartyReader.genName(kind)}). Se usa el equipo de tu última partida guardada.
      El combate no cambia nada en tu partida: no da experiencia ni se pierde nada.</p>
      <label class="b-cap">Nivel máximo
        <select id="b-cap">${[100,75,50,30,20,10,5].map(n => `<option value="${n}" ${n === cap ? 'selected' : ''}>${n === 100 ? 'Sin tope (100)' : n}</option>`).join('')}</select></label>
      <p class="b-hint">Los Pokémon de nivel más alto bajan a ese nivel durante el combate.</p>
      <div class="t-actions"><button class="btn primary" data-act="create" autofocus>Crear sala</button></div>
      <p class="t-or">o unite a una sala con el código de tu rival</p>
      <form class="t-join"><input id="b-code" maxlength="6" autocomplete="off" placeholder="Código" aria-label="Código de sala"><button class="btn">Unirme</button></form>`);
  }
  function waiting(code){
    view(`<h2>Sala creada</h2><p>Pasale este código a tu rival:</p><p class="t-code">${code}</p>
      <p class="b-hint">Nivel máximo: ${cap === 100 ? 'sin tope' : cap}</p>
      <div class="t-actions"><button class="btn" data-act="copy" data-code="${code}">Copiar código</button></div>
      <p class="t-wait">Esperando a que se conecte…</p>`);
  }

  function sprite(dex, shiny, k){ const [src, fb] = PartyReader.spriteUrls(k, dex, shiny);
    return `<img src="${src}" onerror="this.onerror=null;this.src='${fb}'" alt="">`; }
  function hpColor(p){ return p > .5 ? '#3FBF6F' : p > .2 ? '#E8B530' : '#E5484D'; }
  function infoBox(side){
    const s = field[side], p = s.active && s.seen.get(s.active); if (!p) return '<div class="b-box"></div>';
    const pct = p.fnt ? 0 : p.hp / p.max, st = STATUS[p.status];
    const balls = [...Array(Math.max(s.size, 1))].map((_, i) => { const m = [...s.seen.values()][i];
      return `<i class="b-ball ${m ? (m.fnt ? 'fnt' : 'ok') : ''}"></i>`; }).join('');
    return `<div class="b-box">
      <div class="b-name"><b>${esc(p.name)}</b><span>Nv. ${p.level}</span></div>
      <div class="b-bar"><i style="width:${pct * 100}%;background:${hpColor(pct)}"></i></div>
      <div class="b-sub">${st ? `<span class="b-st" style="background:${st[1]}">${st[0]}</span>` : ''}
        <span>${side === mySide ? `${p.hp}/${p.max} PS` : `${Math.ceil(pct * 100)}%`}</span><span class="b-balls">${balls}</span></div></div>`;
  }
  function fieldHTML(){
    const foe = mySide === 'p1' ? 'p2' : 'p1', mon = side => { const s = field[side], p = s.active && s.seen.get(s.active);
      if (!p || p.fnt) return '<div class="b-spr"></div>';
      const sp = D().species.get(p.species);
      return `<div class="b-spr ${side === mySide ? 'me' : ''}">${sprite(sp.num, p.shiny, side === mySide ? kind : them.kind)}</div>`; };
    return `<div class="b-field">${infoBox(foe)}${mon(foe)}${mon(mySide)}${infoBox(mySide)}</div>`;
  }
  function actionsHTML(){
    if (ended) return `<div class="b-end"><button class="btn primary" data-act="close" autofocus>Volver al juego</button></div>`;
    if (!duel || !req || req.wait || !duel.needs(mySide)) return `<p class="b-wait" role="status">Esperando a tu rival…</p>`;
    const team = req.side.pokemon, force = req.forceSwitch?.[0], act = req.active?.[0];
    const sw = team.map((p, i) => ({ p, i })).filter(({ p }) => !p.active && !p.condition.endsWith(' fnt'));
    const swHTML = sw.length && !act?.trapped ? `<h3>${force ? '¿Qué Pokémon sale?' : 'Cambiar de Pokémon'}</h3><div class="b-switch">${sw.map(({ p, i }) => {
      const c = parseCond(p.condition), d = parseDetails(p.details), sp = D().species.get(d.species);
      return `<button class="btn b-mon" data-choice="switch ${i + 1}">${sprite(sp.num, d.shiny, kind)}<span><b>${esc(nameOf(p.ident))}</b><small>Nv. ${d.level} · ${c.hp}/${c.max} PS</small></span></button>`; }).join('')}</div>` : '';
    if (force) return swHTML;
    const moves = (act?.moves || []).map((m, i) => { const md = D().moves.get(m.id), t = md.type || 'Normal';
      const off = m.disabled || (m.pp === 0 && m.id !== 'struggle');
      return `<button class="btn b-move" style="--tc:${TYPE_COLOR[t] || '#888'}" data-choice="move ${i + 1}" ${off ? 'disabled' : ''}>
        <b>${esc(moveEs(m.move))}</b><small>${TYPES[t] || t}${m.maxpp ? ` · PP ${m.pp}/${m.maxpp}` : ''}</small></button>`; }).join('');
    return `<h3>¿Qué va a hacer ${esc(nameOf(team.find(p => p.active).ident))}?</h3><div class="b-moves">${moves}</div>${swHTML}`;
  }
  function battleView(){
    view(`<div class="b-top"><h2>Combate</h2><span class="b-hint">${esc(them.game)} · Nivel máximo ${cap === 100 ? 'sin tope' : cap}</span></div>
      <div id="b-field-wrap">${fieldHTML()}</div>
      <div class="b-log" id="b-log" aria-live="polite"></div>
      <div class="b-act" id="b-act">${actionsHTML()}</div>
      ${ended ? '' : '<div class="b-foot"><button class="btn sm" data-act="forfeit">Rendirse</button></div>'}`);
  }
  let logBuf = [];
  function flush(){
    if (!document.getElementById('b-log')) battleView();
    const log = document.getElementById('b-log');
    for (const l of logBuf) log.insertAdjacentHTML('beforeend', l.startsWith('<p') ? l : `<p>${l}</p>`);
    logBuf = []; log.scrollTop = log.scrollHeight;
    document.getElementById('b-field-wrap').innerHTML = fieldHTML();
    document.getElementById('b-act').innerHTML = actionsHTML();
    if (ended) body.querySelector('.b-foot')?.remove();
  }

  // ---------- Combate ----------
  function begin(seed){
    const teams = [host ? mine : them.team, host ? them.team : mine];
    const sets = [BattleCore.team(host ? kind : them.kind, teams[0], cap), BattleCore.team(host ? them.kind : kind, teams[1], cap)];
    if (!sets[0].length || !sets[1].length) return error('Uno de los equipos no tiene Pokémon que puedan combatir.');
    mySide = host ? 'p1' : 'p2'; field = { p1: freshSide(), p2: freshSide() }; ended = false; req = null; logBuf = [];
    try {
      duel = BattleCore.duel({ gen, seed, teams: sets, mySide,
        onLines: lines => { for (const l of lines) { const t = lineText(l); if (t) logBuf.push(t); } },
        onRequest: r => { req = r; } });
      duel.start();
    } catch (e) { console.warn(e); return error('No se pudo armar el combate con estos equipos.'); }
    battleView(); flush();
  }
  function choose(choice){
    if (!duel || ended || !duel.needs(mySide)) return;
    const r = duel.round, s = duel.seed;
    send({ t:'choice', r, s, c:choice });
    try { duel.submit(mySide, r, choice); } catch (e) { console.warn(e); send({ t:'abort', reason:'desync' }); return error('Se perdió la sincronización con tu rival.'); }
    flush();
  }
  const queue = [];
  function theirChoice(m){
    queue.push(m); queue.sort((a, b) => a.r - b.r);
    while (queue.length && queue[0].r === duel.round) {
      const x = queue.shift();
      try { duel.submit(mySide === 'p1' ? 'p2' : 'p1', x.r, String(x.c).slice(0, 40), x.s); }
      catch (e) { console.warn(e); send({ t:'abort', reason:'desync' }); return error('Se perdió la sincronización con tu rival.'); }
    }
    flush();
  }

  // ---------- Red ----------
  function hello(){ send({ t:'hello', v:1, family:fam, kind, game:g.title, team:mine.map(b64), cap: host ? cap : undefined }); }
  function wire(c){
    conn = c;
    c.on('open', hello);
    c.on('data', onData);
    c.on('close', () => { if (dlg.open && !ended) error('Tu rival se desconectó.'); });
  }
  async function start(code){
    try { await loadLibs(); } catch { return error('No se pudo cargar el combate. Revisá tu internet.'); }
    view(`<h2>Conectando…</h2><p class="t-wait">Un momento.</p>`);
    host = !code;
    if (host) {
      code = [...crypto.getRandomValues(new Uint8Array(6))].map(b => ALPHA[b % ALPHA.length]).join('');
      peer = new Peer(PREFIX + code);
      peer.on('open', () => waiting(code));
      peer.on('connection', c => { if (conn) return c.close(); wire(c); });
    } else {
      peer = new Peer();
      peer.on('open', () => wire(peer.connect(PREFIX + code, { reliable:true })));
    }
    peer.on('error', e => error(e.type === 'peer-unavailable' ? 'No existe una sala con ese código. Revisalo con tu rival.'
      : e.type === 'unavailable-id' ? 'Ese código ya está en uso. Creá la sala de nuevo.' : 'Falló la conexión. Probá de nuevo.'));
  }
  function onData(m){
    if (!m || typeof m !== 'object') return;
    if (m.t === 'hello') {
      if (m.family !== fam) return error(`Tu juego (${esc(g.title)}, ${PartyReader.genName(kind)}) no es compatible con el de tu rival (${esc(String(m.game).slice(0, 60))}). Solo se puede combatir entre juegos de la misma generación.`);
      let team;
      try { team = (m.team || []).slice(0, 6).map(unb64).filter(p => PartyReader.battleInfo(m.kind, p)); } catch { team = []; }
      if (!team.length) return error('El equipo de tu rival no es válido.');
      them = { kind:m.kind, game:String(m.game).slice(0, 60), team };
      if (!host) { cap = Math.max(1, Math.min(100, m.cap | 0 || 100)); return view(`<h2>Conectado</h2><p class="t-wait">Empezando el combate…</p>`); }
      const seed = PkmnSim.PRNG.generateSeed();
      send({ t:'start', seed });
      return begin(seed);
    }
    if (m.t === 'start' && !host && them && !duel) return begin(String(m.seed));
    if (!duel) return;
    if (m.t === 'choice') return theirChoice(m);
    if (m.t === 'forfeit' && !ended) { duel.lose(mySide === 'p1' ? 'p2' : 'p1'); logBuf.push('Tu rival se rindió.'); return flush(); }
    if (m.t === 'abort' && !ended) return error(m.reason === 'desync' ? 'Se perdió la sincronización con tu rival.' : 'Tu rival canceló el combate.');
  }

  // ---------- Eventos ----------
  body.addEventListener('click', async e => {
    const c = e.target.closest('[data-choice]'); if (c && !c.disabled) return choose(c.dataset.choice);
    const b = e.target.closest('[data-act]'); if (!b || b.tagName === 'FORM') return;
    const act = b.dataset.act;
    if (act === 'create') { cap = +document.getElementById('b-cap').value; start(); }
    if (act === 'home') { closeLink(); duel = null; home(); }
    if (act === 'copy') { try { await navigator.clipboard.writeText(b.dataset.code); b.textContent = 'Copiado'; } catch {} }
    if (act === 'forfeit' && duel && !ended && confirm('¿Seguro que querés rendirte?')) { send({ t:'forfeit' }); duel.lose(mySide); logBuf.push('Te rendiste.'); flush(); }
    if (act === 'close') dlg.close();
  });
  body.addEventListener('change', e => { if (e.target.id === 'b-cap') cap = +e.target.value; });
  body.addEventListener('submit', e => {
    e.preventDefault();
    const code = (document.getElementById('b-code').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) return document.getElementById('b-code').focus();
    start(code);
  });
  dlg.addEventListener('close', () => { if (duel && !ended) send({ t:'abort' }); closeLink(); duel = null; them = null; C.pause(false); });

  window.openBattle = () => {
    const save = C.readSave();
    if (!save) return C.status('Guardá la partida dentro del juego antes de combatir.');
    let s; try { s = PartyReader.open(save, kind, false); } catch {}
    mine = s ? [...Array(s.count)].map((_, i) => s.get(i)).filter(p => PartyReader.battleInfo(kind, p)) : [];
    if (!mine.length) return C.status('No hay Pokémon en tu equipo que puedan combatir.');
    C.pause(true); closeLink(); duel = null; them = null;
    home(); dlg.showModal();
    loadLibs().catch(() => {});   // se adelanta la descarga mientras se arma la sala
  };
})();
