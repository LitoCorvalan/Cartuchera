// Intercambio en línea entre dos jugadores, de navegador a navegador (WebRTC vía PeerJS).
// Requiere que play.html exponga window.Cartuchera = { game, readSave, writeSave, pause, refreshTeam, backup }.
(() => {
  const C = window.Cartuchera, g = C.game, kind = g.party;
  const PEERJS = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
  const PREFIX = 'cartuchera-v1-';
  const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  const dlg = document.getElementById('trade');
  const body = document.getElementById('trade-body');
  let peer = null, conn = null, save = null, model = null, myTeam = [];
  let me, them;
  const reset = () => { me = { slot:null, payload:null, confirmed:false, ready:false };
                        them = { hello:null, slot:null, payload:null, confirmed:false, ready:false }; };

  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const b64 = u => { let s=''; u.forEach(b => s += String.fromCharCode(b)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const send = m => { try { conn?.open && conn.send(m); } catch {} };
  const names = {};
  const nameOf = async dex => names[dex] ??= await PartyReader.speciesName(dex);

  // ---------- Pantallas ----------
  function view(html){ body.innerHTML = html; body.querySelector('[autofocus]')?.focus(); }
  function error(msg){
    view(`<h2>No se pudo intercambiar</h2><p>${msg}</p><div class="t-actions"><button class="btn" data-act="home">Volver</button></div>`);
    closeLink();
  }
  function home(){
    view(`<h2>Intercambiar Pokémon</h2>
      <p>Conectate con alguien que juegue un juego compatible (${PartyReader.genName(kind)}). Guardá la partida dentro del juego antes de empezar.</p>
      <div class="t-actions"><button class="btn primary" data-act="create" autofocus>Crear sala</button></div>
      <p class="t-or">o unite a una sala con el código de tu compañero</p>
      <form class="t-join" data-act="join"><input id="t-code" maxlength="6" autocomplete="off" placeholder="Código" aria-label="Código de sala"><button class="btn">Unirme</button></form>`);
  }
  function waiting(code){
    view(`<h2>Sala creada</h2><p>Pasale este código a tu compañero:</p>
      <p class="t-code">${code}</p>
      <div class="t-actions"><button class="btn" data-act="copy" data-code="${code}">Copiar código</button></div>
      <p class="t-wait">Esperando a que se conecte…</p>`);
  }
  async function monCard(m, k, extra=''){
    if (!m) return `<div class="t-mon empty">Eligiendo…</div>`;
    if (m.egg) return `<div class="t-mon ${extra}"><div class="egg sm"></div><div><b>Huevo</b></div></div>`;
    const [src, fb] = PartyReader.spriteUrls(k, m.dex, m.shiny);
    const n = await nameOf(m.dex);
    return `<div class="t-mon ${extra}"><img src="${src}" onerror="this.onerror=null;this.src='${fb}'" alt="">
      <div><b>${esc(n)}</b>${m.nickname && m.nickname.toLowerCase()!==n.toLowerCase() ? ` <span class="nick">“${esc(m.nickname)}”</span>` : ''}${m.shiny?' <span class="shiny">✦</span>':''}<br><span class="lvl">Nivel ${m.level}</span></div></div>`;
  }
  async function choose(){
    const theirKind = them.hello.kind;
    const mine = await Promise.all(myTeam.map(async (m,i) =>
      `<label class="t-pick"><input type="radio" name="t-slot" value="${i}" ${me.slot===i?'checked':''}>${await monCard(m, kind)}</label>`));
    const offer = them.payload ? PartyReader.decode(theirKind, them.payload) : null;
    const evo = offer && PartyReader.evolve(kind, them.payload);
    const theirs = await Promise.all(them.hello.team.map((m,i) => monCard(m, theirKind, i===them.slot ? 'sel' : 'dim')));
    let state = 'Elegí qué Pokémon vas a enviar.';
    if (me.slot!==null && them.slot===null) state = 'Esperando que tu compañero elija.';
    if (me.slot!==null && them.slot!==null) state = me.confirmed ? (them.confirmed ? 'Intercambiando…' : 'Esperando que tu compañero confirme.') : (them.confirmed ? 'Tu compañero ya confirmó.' : 'Revisá la oferta y confirmá.');
    view(`<h2>Intercambio con ${esc(them.hello.game)}</h2>
      <div class="t-cols">
        <section><h3>Tu equipo</h3><div class="t-list" id="t-mine">${mine.join('')}</div></section>
        <section><h3>Equipo de tu compañero</h3><div class="t-list">${theirs.join('')}</div>
          ${evo ? `<p class="t-evo">Al recibirlo va a evolucionar en ${esc(await nameOf(evo.to))}.</p>` : ''}</section>
      </div>
      <p class="t-state" role="status">${state}</p>
      <div class="t-actions">
        <button class="btn primary" data-act="confirm" ${me.slot!==null && them.slot!==null && !me.confirmed ? '' : 'disabled'}>Confirmar intercambio</button>
        <button class="btn" data-act="cancel">Cancelar</button>
      </div>`);
  }
  async function done(evo){
    const m = PartyReader.decode(them.hello.kind, them.payload);
    const n = m.egg ? 'un Huevo' : await nameOf(m.dex);
    view(`<h2>¡Intercambio completo!</h2>
      <p>Recibiste ${esc(n)}${evo ? ` y evolucionó en ${esc(await nameOf(evo.to))}` : ''}. El juego se reinició para cargar la partida actualizada.</p>
      <div class="t-actions"><button class="btn primary" data-act="close" autofocus>Seguir jugando</button></div>`);
    C.refreshTeam();
  }

  // ---------- Red ----------
  function loadPeer(){
    if (window.Peer) return Promise.resolve();
    return new Promise((res, rej) => { const s=document.createElement('script'); s.src=PEERJS; s.onload=res; s.onerror=rej; document.head.appendChild(s); });
  }
  function closeLink(){ try { conn?.close(); } catch {} try { peer?.destroy(); } catch {} conn=null; peer=null; }
  function wire(c){
    conn = c;
    c.on('open', () => send({ t:'hello', kind, family:PartyReader.family(kind), game:g.title, team:myTeam }));
    c.on('data', onData);
    c.on('close', () => { if (dlg.open && !body.classList.contains('t-done')) error('Tu compañero se desconectó.'); });
  }
  async function start(code){
    try { await loadPeer(); } catch { return error('No se pudo cargar el sistema de conexión. Revisá tu internet.'); }
    view(`<h2>Conectando…</h2><p class="t-wait">Un momento.</p>`);
    if (!code){ // crear sala
      code = [...crypto.getRandomValues(new Uint8Array(6))].map(b => ALPHA[b % ALPHA.length]).join('');
      peer = new Peer(PREFIX + code);
      peer.on('open', () => waiting(code));
      peer.on('connection', c => { if (conn) return c.close(); wire(c); });
    } else {
      peer = new Peer();
      peer.on('open', () => wire(peer.connect(PREFIX + code, { reliable:true })));
    }
    peer.on('error', e => error(e.type === 'peer-unavailable' ? 'No existe una sala con ese código. Revisalo con tu compañero.'
      : e.type === 'unavailable-id' ? 'Ese código ya está en uso. Creá la sala de nuevo.' : 'Falló la conexión. Probá de nuevo.'));
  }

  async function onData(m){
    if (!m || typeof m !== 'object') return;
    if (m.t === 'hello'){
      if (m.family !== PartyReader.family(kind))
        return error(`Tu juego (${esc(g.title)}, ${PartyReader.genName(kind)}) no es compatible con el de tu compañero (${esc(m.game)}, ${PartyReader.genName(m.kind)}). Solo se puede intercambiar entre juegos de la misma generación.`);
      them.hello = { kind:m.kind, game:String(m.game).slice(0,60), team:(m.team||[]).slice(0,6) };
      return choose();
    }
    if (!them.hello) return;
    if (m.t === 'offer'){
      const p = unb64(m.payload);
      if (!PartyReader.decode(kind, p)) return error('El Pokémon recibido no es válido.');
      them.slot = m.slot|0; them.payload = p; me.confirmed = them.confirmed = me.ready = them.ready = false;
      return choose();
    }
    if (m.t === 'confirm'){ them.confirmed = true; await choose(); return proceed(); }
    if (m.t === 'ready'){ them.ready = true; return commit(); }
    if (m.t === 'abort'){ if (body.classList.contains('t-done')) return; return error(m.reason || 'Tu compañero canceló el intercambio.'); }
  }

  // ---------- Intercambio en dos fases: validar (ready) y luego escribir ----------
  function proceed(){
    if (!(me.confirmed && them.confirmed) || me.ready) return;
    try {
      const fresh = C.readSave(), check = PartyReader.open(fresh, kind, true);
      const now = check.get(me.slot);
      if (now.length !== me.payload.length || now.some((v,i) => v !== me.payload[i])) throw new Error('cambió');
    } catch {
      send({ t:'abort', reason:'La partida de tu compañero cambió. Tiene que guardar de nuevo.' });
      return error('Tu partida cambió desde que empezaste. Guardá dentro del juego y volvé a intentarlo.');
    }
    me.ready = true; send({ t:'ready' }); commit();
  }
  async function commit(){
    if (!(me.ready && them.ready)) return;
    me.ready = them.ready = false;
    try {
      const data = C.readSave(), s = PartyReader.open(data, kind, true);
      await C.backup(data.slice());
      const evo = PartyReader.evolve(kind, them.payload);
      s.set(me.slot, evo ? evo.payload : them.payload);
      s.commit();
      PartyReader.open(data, kind, true); // verificación final
      C.writeSave(data);
      body.classList.add('t-done');
      await done(evo);
      setTimeout(closeLink, 1500);
    } catch (e) {
      console.warn(e);
      error('No se pudo escribir la partida. No se modificó nada.');
    }
  }

  // ---------- Eventos ----------
  body.addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b || b.tagName === 'FORM') return;
    const act = b.dataset.act;
    if (act === 'create') start();
    if (act === 'home') { reset(); closeLink(); home(); }
    if (act === 'copy') { try { await navigator.clipboard.writeText(b.dataset.code); b.textContent = 'Copiado'; } catch {} }
    if (act === 'confirm') { me.confirmed = true; send({ t:'confirm' }); await choose(); proceed(); }
    if (act === 'cancel') { send({ t:'abort' }); dlg.close(); }
    if (act === 'close') dlg.close();
  });
  body.addEventListener('submit', e => {
    e.preventDefault();
    const code = (document.getElementById('t-code').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length !== 6) return document.getElementById('t-code').focus();
    start(code);
  });
  body.addEventListener('change', e => {
    if (e.target.name !== 't-slot') return;
    me.slot = +e.target.value; me.payload = model.get(me.slot);
    me.confirmed = them.confirmed = me.ready = them.ready = false;
    send({ t:'offer', slot:me.slot, payload:b64(me.payload) });
    choose();
  });
  dlg.addEventListener('close', () => { send({ t:'abort' }); closeLink(); body.classList.remove('t-done'); C.pause(false); });

  window.openTrade = () => {
    reset();
    save = C.readSave();
    if (!save) { C.status('Guardá la partida dentro del juego antes de intercambiar.'); return; }
    try { model = PartyReader.open(save, kind, true); }
    catch { C.status('No se pudo verificar la partida de este juego, así que el intercambio no está disponible.'); return; }
    myTeam = [...Array(model.count)].map((_,i) => PartyReader.decode(kind, model.get(i)));
    C.pause(true);
    body.classList.remove('t-done');
    home();
    dlg.showModal();
  };
})();
