// Lectura del equipo Pokémon desde la partida guardada (save / SRAM).
// Soporta: Gen 1 (Rojo/Verde/Azul), Gen 2 (Oro/Plata/Cristal), Gen 3 (Rubí/Zafiro/Esmeralda/Rojo Fuego/Verde Hoja),
// Gen 4 (Diamante/Perla/Platino/HeartGold/SoulSilver) y Gen 5 (Negro/Blanco/Negro 2/Blanco 2).
// Valores de "party" en games.js: gen1, gen2, gen2c, gen3, gen4dp, gen4pt, gen4hgss, gen5
// read() devuelve [{ dex, level, hp, maxHp, shiny, egg, nickname }] o null si no hay datos válidos.
// open() permite reemplazar un Pokémon del equipo (intercambio) recalculando las sumas de verificación.

const PartyReader = (() => {
  // ---------- Tablas ----------
  // Gen 1: índice interno -> Pokédex nacional (0 = MissingNo)
  const G1 = [0,112,115,32,35,21,100,34,80,2,103,108,102,88,94,29,31,104,111,131,59,151,130,90,72,92,123,120,9,127,114,0,0,58,95,22,16,79,64,75,113,67,122,106,107,24,47,54,96,76,0,126,0,125,82,109,0,56,86,50,128,0,0,0,83,48,149,0,0,0,84,60,124,146,144,145,132,52,98,0,0,0,37,38,25,26,0,0,147,148,140,141,116,117,0,0,27,28,138,139,39,40,133,136,135,134,66,41,23,46,61,62,13,14,15,0,85,57,51,49,87,0,0,10,11,12,68,0,55,97,42,150,143,129,0,0,89,0,99,91,0,101,36,110,53,105,0,93,63,65,17,18,121,1,3,73,0,118,119,0,0,0,0,77,78,19,20,33,30,74,137,142,0,81,0,0,4,7,5,8,6,0,0,0,0,43,44,45,69,70,71];
  // Gen 3: índices internos 277-411 -> Pokédex nacional 252-386
  const G3 = [252,253,254,255,256,257,258,259,260,261,262,263,264,265,266,267,268,269,270,271,272,273,274,275,290,291,292,276,277,285,286,327,278,279,283,284,320,321,300,301,352,343,344,299,324,302,339,340,370,341,342,349,350,318,319,328,329,330,296,297,309,310,322,323,363,364,365,331,332,361,362,337,338,298,325,326,311,312,303,307,308,333,334,360,355,356,315,287,288,289,316,317,357,293,294,295,366,367,368,359,353,354,336,335,369,304,305,306,351,313,314,345,346,347,348,280,281,282,371,372,373,374,375,376,377,378,379,382,383,384,380,381,385,386,358];
  // Orden de subestructuras (Gen 3-5), índice = posición de cada bloque A,B,C,D
  const ORDERS = ['ABCD','ABDC','ACBD','ACDB','ADBC','ADCB','BACD','BADC','BCAD','BCDA','BDAC','BDCA','CABD','CADB','CBAD','CBDA','CDAB','CDBA','DABC','DACB','DBAC','DBCA','DCAB','DCBA'];

  // ---------- Utilidades ----------
  const u16le = (d,o) => d[o] | d[o+1]<<8;
  const u32le = (d,o) => (d[o] | d[o+1]<<8 | d[o+2]<<16 | d[o+3]<<24) >>> 0;
  const u16be = (d,o) => d[o]<<8 | d[o+1];
  const clean = s => (s && /^[\p{L}\p{N} .'\-♂♀]+$/u.test(s)) ? s.trim() : '';

  function textGB(d,o,len){ let s='';
    for (let i=0;i<len;i++){ const c=d[o+i]; if (c===0x50) break;
      if (c>=0x80&&c<=0x99) s+=String.fromCharCode(65+c-0x80);
      else if (c>=0xA0&&c<=0xB9) s+=String.fromCharCode(97+c-0xA0);
      else if (c>=0xF6) s+=String(c-0xF6); else if (c===0x7F) s+=' '; else return ''; }
    return s; }
  function textG3(d,o,len){ let s='';
    for (let i=0;i<len;i++){ const c=d[o+i]; if (c===0xFF) break;
      if (c>=0xBB&&c<=0xD4) s+=String.fromCharCode(65+c-0xBB);
      else if (c>=0xD5&&c<=0xEE) s+=String.fromCharCode(97+c-0xD5);
      else if (c>=0xA1&&c<=0xAA) s+=String(c-0xA1); else if (c===0) s+=' '; else return ''; }
    return s; }
  function textG4(d,o){ let s='';
    for (let i=0;i<11;i++){ const c=u16le(d,o+i*2); if (c===0xFFFF) break;
      if (c>=0x12B&&c<=0x144) s+=String.fromCharCode(65+c-0x12B);
      else if (c>=0x145&&c<=0x15E) s+=String.fromCharCode(97+c-0x145);
      else if (c>=0x121&&c<=0x12A) s+=String(c-0x121); else if (c===0x1DE) s+=' '; else return ''; }
    return s; }
  function textG5(d,o){ let s='';
    for (let i=0;i<11;i++){ const c=u16le(d,o+i*2); if (c===0xFFFF) break; s+=String.fromCharCode(c); }
    return s; }

  const w16le = (d,o,v) => { d[o]=v&255; d[o+1]=v>>8&255; };
  const w32le = (d,o,v) => { w16le(d,o,v&0xFFFF); w16le(d,o+2,v>>>16); };
  function crc16(d,o,len){ let c=0xFFFF;
    for (let i=0;i<len;i++){ c^=d[o+i]<<8; for (let k=0;k<8;k++) c = c&0x8000 ? ((c<<1)^0x1021)&0xFFFF : (c<<1)&0xFFFF; }
    return c; }
  const eq = (a,b) => a.length===b.length && a.every((v,i)=>v===b[i]);
  const FAMILY = { gen1:'g1', gen2:'g2', gen2c:'g2', gen3:'g3', gen4dp:'g4', gen4pt:'g4', gen4hgss:'g4', gen5:'g5' };
  const GEN_NAME = { g1:'Gen 1', g2:'Gen 2', g3:'Gen 3', g4:'Gen 4', g5:'Gen 5' };

  // ---------- Codificadores de texto (para renombrar al evolucionar) ----------
  function encGB(str,len){ const o=new Uint8Array(len).fill(0x50);
    [...str].forEach((ch,i)=>{ const c=ch.charCodeAt(0); o[i]= c>=65&&c<=90 ? 0x80+c-65 : c>=97&&c<=122 ? 0xA0+c-97 : 0x7F; }); return o; }
  function encG3(str,len){ const o=new Uint8Array(len).fill(0xFF);
    [...str].forEach((ch,i)=>{ const c=ch.charCodeAt(0); o[i]= c>=65&&c<=90 ? 0xBB+c-65 : c>=97&&c<=122 ? 0xD5+c-97 : 0; }); return o; }
  function encG4(str){ const o=new Uint8Array(22).fill(0xFF);
    [...str].forEach((ch,i)=>{ const c=ch.charCodeAt(0); w16le(o,i*2, c>=65&&c<=90 ? 0x12B+c-65 : c>=97&&c<=122 ? 0x145+c-97 : 0x1DE); }); return o; }
  function encG5(str){ const o=new Uint8Array(22).fill(0xFF); [...str].forEach((ch,i)=>w16le(o,i*2,ch.charCodeAt(0))); return o; }

  // ---------- Decodificar un Pokémon (payload portable) ----------
  // g1: [especie interna][44 bytes][OT 11][mote 11]   g2: [especie][48][OT 11][mote 11]
  // g3: 100 bytes · g4: 236 bytes · g5: 220 bytes (cifrados tal cual están en la partida)
  function g3one(p){
    const pid=u32le(p,0), otid=u32le(p,4), key=(pid^otid)>>>0, dec=g3decrypt(p,key);
    let sum=0; for (let j=0;j<48;j+=2) sum=(sum+u16le(dec,j))&0xFFFF;
    if (sum!==u16le(p,28)) return null;
    const order=ORDERS[pid%24], G=order.indexOf('A')*12, M=order.indexOf('D')*12;
    const raw=u16le(dec,G), dex = raw<=251 ? raw : (raw>=277&&raw<=411 ? G3[raw-277] : 0);
    if (!dex) return null;
    if (u32le(dec,M+4)>>>30&1) return {egg:true, dex};
    const sv=((otid&0xFFFF)^(otid>>>16)^(pid&0xFFFF)^(pid>>>16));
    return { dex, level:p[84], hp:u16le(p,86), maxHp:u16le(p,88), shiny:sv<8, egg:false, nickname: clean(textG3(p,8,10)), item:u16le(dec,G+2) };
  }
  function g3decrypt(p,key){ const dec=new Uint8Array(48);
    for (let j=0;j<48;j+=4) w32le(dec,j,(u32le(p,32+j)^key)>>>0); return dec; }
  function decode(kind, p){
    if (!p) return null;
    try {
      switch (FAMILY[kind]){
        case 'g1': { const dex=G1[p[0]]; if (!dex || p.length!==67) return null;
          return { dex, level:p[1+0x21], hp:u16be(p,2), maxHp:u16be(p,1+0x22), shiny:false, egg:false, nickname:clean(textGB(p,56,11)) }; }
        case 'g2': { if (p.length!==71) return null; if (p[0]===0xFD) return {egg:true, dex:p[1]};
          const dex=p[0]; if (!(dex>=1&&dex<=251)) return null;
          const atk=p[1+0x15]>>4, def=p[1+0x15]&15, spe=p[1+0x16]>>4, spc=p[1+0x16]&15;
          return { dex, level:p[1+0x1F], hp:u16be(p,1+0x22), maxHp:u16be(p,1+0x24), egg:false, item:p[2],
            shiny: def===10&&spe===10&&spc===10&&[2,3,6,7,10,11,14,15].includes(atk), nickname:clean(textGB(p,60,11)) }; }
        case 'g3': return p.length===100 ? g3one(p) : null;
        case 'g4': return p.length===236 ? decodeNDS(p,0,4) : null;
        case 'g5': return p.length===220 ? decodeNDS(p,0,5) : null;
      }
    } catch(e){ console.warn(e); }
    return null;
  }

  // ---------- Gen 4 y 5 ----------
  function prng(data, start, end, seed){
    for (let i=start;i<end;i+=2){
      seed=(Math.imul(seed,0x41C64E6D)+0x6073)>>>0;
      const v=u16le(data,i)^(seed>>>16); data[i]=v&255; data[i+1]=v>>8;
    }
  }
  function ndsDecrypt(src,o,gen){
    const size = gen===4 ? 236 : 220, d=src.slice(o,o+size);
    prng(d, 8, 136, u16le(d,6)); prng(d, 136, size, u32le(d,0)); return d;
  }
  function ndsEncrypt(d){ // d descifrado y con checksum actualizado
    const e=d.slice(); prng(e, 8, 136, u16le(e,6)); prng(e, 136, e.length, u32le(e,0)); return e;
  }
  function decodeNDS(src, o, gen){
    const d=ndsDecrypt(src,o,gen), pid=u32le(d,0), chk=u16le(d,6);
    let sum=0; for (let j=8;j<136;j+=2) sum=(sum+u16le(d,j))&0xFFFF;
    if (sum!==chk) return null;
    const order=ORDERS[((pid&0x3E000)>>>13)%24], blk=L=>8+order.indexOf(L)*32;
    const A=blk('A'), B=blk('B'), C=blk('C');
    const dex=u16le(d,A); if (!(dex>=1&&dex<=649)) return null;
    const iv=u32le(d,B+0x10);
    if (iv>>>30&1) return {egg:true, dex};
    const tid=u16le(d,A+4), sid=u16le(d,A+6), sv=tid^sid^(pid&0xFFFF)^(pid>>>16);
    return { dex, level:d[0x8C], hp:u16le(d,0x8E), maxHp:u16le(d,0x90), shiny: sv<8, egg:false, item:u16le(d,A+2),
      nickname: iv>>>31 ? clean(gen===4 ? textG4(d,C) : textG5(d,C)) : '' };
  }

  // ---------- Abrir una partida ----------
  // Devuelve { family, count, get(i), set(i,payload), commit() }. Con strict=true verifica las sumas
  // de verificación y lanza un error si la estructura no coincide, para no dañar nunca una partida.
  function open(d, kind, strict){
    const fam=FAMILY[kind]; if (!fam || !d) return null;
    const fail = m => { if (strict) throw new Error(m); return null; };

    if (fam==='g1'){
      const base=0x2F2C, n=d[base], S=base+8, OT=S+6*44, NK=OT+6*11;
      if (!(n>=1&&n<=6)) return fail('sin equipo');
      const sum = () => { let s=0; for (let i=0x2598;i<=0x3522;i++) s+=d[i]; return (~s)&0xFF; };
      if (strict && sum()!==d[0x3523]) return fail('checksum');
      return { family:fam, count:n,
        get:i=>{ const p=new Uint8Array(67); p[0]=d[base+1+i]; p.set(d.subarray(S+i*44,S+i*44+44),1); p.set(d.subarray(OT+i*11,OT+i*11+11),45); p.set(d.subarray(NK+i*11,NK+i*11+11),56); return p; },
        set:(i,p)=>{ d[base+1+i]=p[0]; d.set(p.subarray(1,45),S+i*44); d.set(p.subarray(45,56),OT+i*11); d.set(p.subarray(56,67),NK+i*11); },
        commit:()=>{ d[0x3523]=sum(); } };
    }

    if (fam==='g2'){
      const c = kind==='gen2c', base = c ? 0x2865 : 0x288A, n=d[base], S=base+8, OT=S+6*48, NK=OT+6*11;
      const ck = c ? {at:0x2D0D, from:0x2009, to:0x2B82} : {at:0x2D69, from:0x2009, to:0x2D68};
      if (!(n>=1&&n<=6) || d[base+1+n]!==0xFF) return fail('sin equipo');
      const sum = () => { let s=0; for (let i=ck.from;i<=ck.to;i++) s+=d[i]; return s&0xFFFF; };
      if (strict && sum()!==u16le(d,ck.at)) return fail('checksum');
      return { family:fam, count:n,
        get:i=>{ const p=new Uint8Array(71); p[0]=d[base+1+i]; p.set(d.subarray(S+i*48,S+i*48+48),1); p.set(d.subarray(OT+i*11,OT+i*11+11),49); p.set(d.subarray(NK+i*11,NK+i*11+11),60); return p; },
        set:(i,p)=>{ d[base+1+i]=p[0]; d.set(p.subarray(1,49),S+i*48); d.set(p.subarray(49,60),OT+i*11); d.set(p.subarray(60,71),NK+i*11); },
        commit:()=>{ w16le(d,ck.at,sum()); } };
    }

    if (fam==='g3'){
      const secs=[];
      for (const slot of [0, 0xE000]) for (let s=0;s<14;s++){
        const o=slot+s*0x1000; if (o+0x1000>d.length) break;
        if (u32le(d,o+0xFF8)===0x08012025 && u16le(d,o+0xFF4)===1) secs.push({o, idx:u32le(d,o+0xFFC)});
      }
      if (!secs.length) return fail('sin partida');
      secs.sort((a,b)=>b.idx-a.idx);
      const act=secs[0];
      const secSum = o => { let s=0; for (let i=0;i<0xF80;i+=4) s=(s+u32le(d,o+i))>>>0; return ((s>>>16)+(s&0xFFFF))&0xFFFF; };
      if (strict && secSum(act.o)!==u16le(d,act.o+0xFF6)) return fail('checksum');
      let off=null;
      for (const cand of [0x234, 0x34]){
        const n=u32le(d,act.o+cand);
        if (n>=1&&n<=6 && [...Array(n)].every((_,i)=>decode('gen3', d.slice(act.o+cand+4+i*100, act.o+cand+104+i*100)))) { off=cand; break; }
      }
      if (off===null) return fail('sin equipo');
      const at = (o,i) => o+off+4+i*100;
      const touched=new Set();
      return { family:fam, count:u32le(d,act.o+off),
        get:i=>d.slice(at(act.o,i), at(act.o,i)+100),
        set:(i,p)=>{ const orig=d.slice(at(act.o,i), at(act.o,i)+8);
          for (const s of secs) if (eq(d.slice(at(s.o,i), at(s.o,i)+8), orig)) { d.set(p, at(s.o,i)); touched.add(s.o); } },
        commit:()=>{ for (const o of touched) w16le(d,o+0xFF6,secSum(o)); } };
    }

    if (fam==='g4'){
      const cfg = { gen4dp:{size:0xC100, party:0x98}, gen4pt:{size:0xCF2C, party:0xA0}, gen4hgss:{size:0xF628, party:0x98} }[kind];
      const footer = base => { // posición del CRC dentro del pie del bloque
        const crc=crc16(d, base, cfg.size-0x14);
        for (let k=cfg.size-2; k>=cfg.size-0x14; k-=2) if (u16le(d,base+k)===crc) return base+k;
        return -1; };
      const copies=[];
      for (const base of [0, 0x40000]){
        if (base+cfg.size>d.length) continue;
        const n=u32le(d, base+cfg.party-4); if (!(n>=1&&n<=6)) continue;
        if (![...Array(n)].every((_,i)=>decodeNDS(d, base+cfg.party+i*236, 4))) continue;
        const crcAt = strict ? footer(base) : -1;
        if (strict && crcAt<0) continue;
        copies.push({ base, crcAt, n, count:u32le(d, base+cfg.size-0x14) });
      }
      if (!copies.length) return fail('checksum');
      copies.sort((a,b)=>b.count-a.count);
      const act=copies[0], at=(c,i)=>c.base+cfg.party+i*236, touched=new Set();
      return { family:fam, count:act.n,
        get:i=>d.slice(at(act,i), at(act,i)+236),
        set:(i,p)=>{ const orig=d.slice(at(act,i), at(act,i)+8);
          for (const c of copies) if (c.n>i && eq(d.slice(at(c,i),at(c,i)+8),orig)) { d.set(p, at(c,i)); touched.add(c); } },
        commit:()=>{ for (const c of touched) w16le(d, c.crcAt, crc16(d, c.base, cfg.size-0x14)); } };
    }

    if (fam==='g5'){
      const P=0x18E00, LEN=0x534, n=u32le(d,P+4);
      if (!(n>=1&&n<=6) || ![...Array(n)].every((_,i)=>decodeNDS(d,P+8+i*220,5))) return fail('sin equipo');
      let blk=-1, mirror=-1, table=null;
      if (strict){
        const c=crc16(d,P,LEN);
        for (let k=P+LEN; k<P+LEN+0x10; k+=2) if (u16le(d,k)===c) { blk=k; break; }
        for (const t of [{o:0x23F00,len:0x8C},{o:0x25F00,len:0x94}]){
          if (t.o+t.len+0x10>d.length) continue;
          const tc=crc16(d,t.o,t.len);
          for (let k=t.o+t.len; k<t.o+t.len+0x10; k+=2) if (u16le(d,k)===tc) { table={...t, at:k}; break; }
          if (table) break;
        }
        if (table) for (let k=table.o; k<table.o+table.len; k+=2) if (u16le(d,k)===c) { mirror=k; break; }
        if (blk<0 || !table || mirror<0) return fail('checksum');
      }
      return { family:fam, count:n,
        get:i=>d.slice(P+8+i*220, P+8+i*220+220),
        set:(i,p)=>{ d.set(p, P+8+i*220); },
        commit:()=>{ const c=crc16(d,P,LEN); w16le(d,blk,c); w16le(d,mirror,c); w16le(d,table.at,crc16(d,table.o,table.len)); } };
    }
    return null;
  }

  // ---------- Datos para combate ----------
  // Devuelve { dex, level, nickname, shiny, item, moves:[nº], ivs/evs:[ps,atk,def,ate,dfe,vel], nature (0-24),
  //   ability (nº, Gen 4-5), abilitySlot (Gen 3), form, gender ('M'|'F'|'N'|''), genderValue (Gen 3), atkDV (Gen 2), happiness }
  function battleInfo(kind, p){
    const m=decode(kind,p); if (!m || m.egg) return null;
    const fam=FAMILY[kind], out={ dex:m.dex, level:m.level, nickname:m.nickname, shiny:!!m.shiny, item:m.item||0,
      moves:[], ivs:[31,31,31,31,31,31], evs:[0,0,0,0,0,0], nature:null, ability:0, abilitySlot:0, form:0, gender:'', genderValue:null, atkDV:null, happiness:255 };
    const se = x => x ? Math.min(255, Math.floor(Math.sqrt(x-1))+1) : 0;   // experiencia de estadística -> EV (Gen 1-2)
    const six = (a, I) => [a[0],a[1],a[2],a[4],a[5],a[3]];                // orden del juego (PS,Atq,Def,Vel,AtE,DfE) -> PS,Atq,Def,AtE,DfE,Vel
    if (fam==='g1' || fam==='g2'){
      const o = fam==='g1' ? {mv:0x08, ex:0x11, dv:0x1B} : {mv:0x02, ex:0x0B, dv:0x15};
      out.moves=[0,1,2,3].map(i=>p[1+o.mv+i]).filter(Boolean);
      const e=[0,1,2,3,4].map(i=>se(u16be(p,1+o.ex+i*2)));                  // PS, Atq, Def, Vel, Especial
      const atk=p[1+o.dv]>>4, def=p[1+o.dv]&15, spe=p[1+o.dv+1]>>4, spc=p[1+o.dv+1]&15;
      const hp=((atk&1)<<3)|((def&1)<<2)|((spe&1)<<1)|(spc&1);
      out.ivs=[hp,atk,def,spc,spc,spe].map(v=>v*2);
      out.evs=[e[0],e[1],e[2],e[4],e[4],e[3]];
      out.atkDV=atk;
      if (fam==='g2') out.happiness=p[1+0x1B];
    } else if (fam==='g3'){
      const pid=u32le(p,0), dec=g3decrypt(p,(pid^u32le(p,4))>>>0), o=ORDERS[pid%24], at=L=>o.indexOf(L)*12;
      const A=at('A'), B=at('B'), C=at('C'), D=at('D');
      out.moves=[0,1,2,3].map(i=>u16le(dec,B+i*2)).filter(Boolean);
      out.evs=six([0,1,2,3,4,5].map(i=>dec[C+i]));
      const iv=u32le(dec,D+4); out.ivs=six([0,1,2,3,4,5].map(k=>iv>>>(k*5)&31));
      out.abilitySlot=iv>>>31; out.nature=pid%25; out.genderValue=pid&255; out.happiness=dec[A+9];
    } else {
      const gen = fam==='g4' ? 4 : 5, d=ndsDecrypt(p,0,gen), pid=u32le(d,0);
      const o=ORDERS[((pid&0x3E000)>>>13)%24], A=8+o.indexOf('A')*32, B=8+o.indexOf('B')*32;
      out.moves=[0,1,2,3].map(i=>u16le(d,B+i*2)).filter(Boolean);
      out.evs=six([0,1,2,3,4,5].map(i=>d[A+0x10+i]));
      const iv=u32le(d,B+0x10); out.ivs=six([0,1,2,3,4,5].map(k=>iv>>>(k*5)&31));
      out.ability=d[A+0x0D]; out.happiness=d[A+0x0C];
      const f=d[B+0x18]; out.form=f>>3; out.gender = f&4 ? 'N' : f&2 ? 'F' : 'M';
      out.nature = gen===5 && d[B+0x19]<25 ? d[B+0x19] : pid%25;
    }
    return out;
  }

  function read(data, kind){
    if (!data || data.length<0x8000) return null;
    try {
      const s=open(data, kind, false); if (!s) return null;
      const out=[];
      for (let i=0;i<s.count;i++){ const m=decode(kind, s.get(i)); if (!m) return null; out.push(m); }
      return out;
    } catch(e){ console.warn('PartyReader', e); return null; }
  }

  // ---------- Evolución por intercambio ----------
  const TRADE_EVO = { 64:65, 67:68, 75:76, 93:94, 525:526, 533:534 };
  const EN = { 64:'KADABRA',65:'ALAKAZAM',67:'MACHOKE',68:'MACHAMP',75:'GRAVELER',76:'GOLEM',93:'HAUNTER',94:'GENGAR',525:'BOLDORE',526:'GIGALITH',533:'GURDURR',534:'CONKELDURR' };
  const G1_INTERNAL = { 65:149, 68:126, 76:49, 94:14 };
  const EVERSTONE = { g2:0x70, g3:195, g4:229, g5:229 };
  const styled = (old, name) => old===old.toUpperCase() ? name : name[0]+name.slice(1).toLowerCase();

  // Devuelve { payload, from, to } con la especie evolucionada (y el nombre si no tenía mote), o null
  function evolve(kind, p){
    const fam=FAMILY[kind], m=decode(kind,p); if (!m || m.egg) return null;
    const to=TRADE_EVO[m.dex]; if (!to || (fam!=='g5' && to>=500)) return null;
    if (m.item && m.item===EVERSTONE[fam]) return null;
    const q=p.slice(), oldName=EN[m.dex];
    if (fam==='g1' || fam==='g2'){
      const nickOff = fam==='g1' ? 56 : 60, nick=textGB(q,nickOff,11);
      if (fam==='g1'){ q[0]=G1_INTERNAL[to]; q[1]=G1_INTERNAL[to]; } else { q[0]=to; q[1]=to; }
      if (nick.toUpperCase()===oldName) q.set(encGB(styled(nick,EN[to]),11), nickOff);
    } else if (fam==='g3'){
      const pid=u32le(q,0), key=(pid^u32le(q,4))>>>0, dec=g3decrypt(q,key), G=ORDERS[pid%24].indexOf('A')*12;
      w16le(dec,G,to);
      let sum=0; for (let j=0;j<48;j+=2) sum=(sum+u16le(dec,j))&0xFFFF; w16le(q,28,sum);
      for (let j=0;j<48;j+=4) w32le(q,32+j,(u32le(dec,j)^key)>>>0);
      const nick=textG3(q,8,10); if (nick.toUpperCase()===oldName) q.set(encG3(styled(nick,EN[to]),10),8);
    } else {
      const gen = fam==='g4' ? 4 : 5, d=ndsDecrypt(q,0,gen), pid=u32le(d,0);
      const order=ORDERS[((pid&0x3E000)>>>13)%24], A=8+order.indexOf('A')*32, C=8+order.indexOf('C')*32;
      w16le(d,A,to);
      const nick = gen===4 ? textG4(d,C) : textG5(d,C);
      if (nick.toUpperCase()===oldName) d.set(gen===4 ? encG4(styled(nick,EN[to])) : encG5(styled(nick,EN[to])), C);
      let sum=0; for (let j=8;j<136;j+=2) sum=(sum+u16le(d,j))&0xFFFF; w16le(d,6,sum);
      return { payload: ndsEncrypt(d), from:m.dex, to };
    }
    return { payload:q, from:m.dex, to };
  }

  // ---------- Nombres e imágenes ----------
  const SPRITES='https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/';
  const SPRITE_SET = {
    gen1:'versions/generation-i/red-blue/transparent/', gen2:'versions/generation-ii/crystal/transparent/', gen2c:'versions/generation-ii/crystal/transparent/',
    gen3:'versions/generation-iii/emerald/', gen4dp:'versions/generation-iv/platinum/', gen4pt:'versions/generation-iv/platinum/',
    gen4hgss:'versions/generation-iv/heartgold-soulsilver/', gen5:'versions/generation-v/black-white/animated/' };
  function spriteUrls(kind, dex, shiny){
    const ext = kind==='gen5' ? 'gif' : 'png', set=SPRITE_SET[kind]||'';
    const sh = shiny && kind!=='gen1' ? 'shiny/' : '';
    return [ `${SPRITES}${set}${sh}${dex}.${ext}`, `${SPRITES}${shiny?'shiny/':''}${dex}.png` ];
  }
  const nameCache = (() => { try { return JSON.parse(localStorage.getItem('pkmn-names-es')||'{}'); } catch { return {}; } })();
  async function speciesName(dex){
    if (nameCache[dex]) return nameCache[dex];
    try {
      const r=await fetch(`https://pokeapi.co/api/v2/pokemon-species/${dex}/`); const j=await r.json();
      const n=(j.names.find(x=>x.language.name==='es')||j.names.find(x=>x.language.name==='en')).name;
      nameCache[dex]=n; try { localStorage.setItem('pkmn-names-es', JSON.stringify(nameCache)); } catch {}
      return n;
    } catch { return `Nº ${dex}`; }
  }

  return { read, open, decode, evolve, battleInfo, family:k=>FAMILY[k], genName:k=>GEN_NAME[FAMILY[k]], spriteUrls, speciesName, _tables:{G1,G3} };
})();
