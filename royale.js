/* ============================================================================
   RACCOON ROYALE — battle-royale-lite prototype (offline vs bots)
   Vanilla canvas, no dependencies. Phase 1: bots fill the lobby; a WebSocket
   server can later replace bots with real players (same racer[] structure).
   ============================================================================ */
(function () {
  'use strict';
  const canvas = document.getElementById('world');
  const ctx = canvas.getContext('2d');

  // ---- seeded rng for the arena (bot behaviour uses Math.random) -----------
  let _seed = 918273;
  function srng() { _seed = (Math.imul(_seed, 1103515245) + 12345) & 0x7fffffff; return _seed / 0x7fffffff; }
  const srand = (a, b) => a + srng() * (b - a);

  const TILE = 48, ARENA = 2200;
  const N_RACERS = 11;
  const BONK_RANGE = 54, BONK_DMG = 24, BONK_CD = 550;

  const el = {
    alive: document.getElementById('aliveCount'), shine: document.getElementById('shineCount'),
    hpFill: document.getElementById('hpFill'), hpLabel: document.getElementById('hpLabel'),
    itemSlot: document.getElementById('itemSlot'), feed: document.getElementById('feed'),
    zone: document.getElementById('zoneBanner'), zoneText: document.getElementById('zoneText'),
    intro: document.getElementById('intro'), result: document.getElementById('result'),
    playBtn: document.getElementById('playBtn'), againBtn: document.getElementById('againBtn'),
    placeText: document.getElementById('placeText'), resultTitle: document.getElementById('resultTitle'),
    resultSub: document.getElementById('resultSub'), rKills: document.getElementById('rKills'), rShine: document.getElementById('rShine'),
    touch: document.getElementById('touch'), bonkBtn: document.getElementById('bonkBtn'),
  };

  // ---- palettes ------------------------------------------------------------
  function shade(hex, f) { const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255, c = v => Math.max(0, Math.min(255, Math.round(v * f))); return `rgb(${c(r)},${c(g)},${c(b)})`; }
  function makePal(body) { return { body, body2: shade(body, 1.2), belly: '#dcd9d2', mask: '#20202a', eyering: '#efece5', leg: shade(body, 0.42), ear: shade(body, 0.86), tail: body, ring: '#232327', nose: '#141416' }; }
  const SKINS = ['#7f848c', '#8b7d6b', '#6b7f7a', '#8a6b86', '#b79452', '#4a5570', '#7a5b5b', '#5b7a6b', '#9a8f52', '#6b6b8a', '#a05a5a'].map(makePal);
  const NAMES = ['Rocky', 'Pip', 'Momo', 'Bandit', 'Trash', 'Nibbles', 'Scraps', 'Dumpster', 'Waddles', 'Mask', 'Gizmo', 'Biscuit', 'Ollie'];

  // ---- arena ---------------------------------------------------------------
  let world, racers, shinies, bins, loose, zone, game;

  function buildArena() {
    _seed = 918273 + ((Math.random() * 9999) | 0);
    const zones = [
      { x: 0, y: 0, w: ARENA, h: ARENA, type: 'grass' },
      { x: 120, y: 120, w: 620, h: 560, type: 'forest' },
      { x: ARENA - 760, y: 160, w: 640, h: 620, type: 'flower' },
      { x: 200, y: ARENA - 720, w: 720, h: 560, type: 'flower' },
      { x: ARENA - 700, y: ARENA - 700, w: 560, h: 560, type: 'sand' },
    ];
    const zoneAt = (x, y) => { let t = 'grass'; for (const z of zones) if (x > z.x && x < z.x + z.w && y > z.y && y < z.y + z.h) t = z.type; return t; };
    const water = [{ x: ARENA - 420, y: ARENA - 420, rx: 150, ry: 120 }, { x: 380, y: 380, rx: 140, ry: 110 }];
    const waterHit = (x, y, pad) => water.some(p => ((x - p.x) / (p.rx + pad)) ** 2 + ((y - p.y) / (p.ry + pad)) ** 2 < 1);
    const trees = [], rocks = [], bushes = [];
    // border ring
    for (let i = 0; i < ARENA; i += 60) { trees.push({ x: i + 30, y: 20, r: 30 }); trees.push({ x: i + 30, y: ARENA - 20, r: 30 }); trees.push({ x: 20, y: i + 30, r: 30 }); trees.push({ x: ARENA - 20, y: i + 30, r: 30 }); }
    // scattered cover
    for (let i = 0; i < 90; i++) { const x = srand(120, ARENA - 120), y = srand(120, ARENA - 120); if (!waterHit(x, y, 40)) (srng() < 0.6 ? trees : rocks).push({ x, y, r: srand(20, 36) }); }
    for (let i = 0; i < 120; i++) { const x = srand(80, ARENA - 80), y = srand(80, ARENA - 80); if (!waterHit(x, y, 20)) bushes.push({ x, y, r: srand(13, 20) }); }
    return { zones, zoneAt, water, waterHit, trees, rocks, bushes };
  }

  function newRound() {
    world = buildArena();
    const cx = ARENA / 2 + srand(-160, 160), cy = ARENA / 2 + srand(-160, 160);
    zone = { cx, cy, r: ARENA * 0.7, targetR: ARENA * 0.7, stage: 0, nextShrinkAt: 4500, dps: 6, shrinking: false };

    // racers spread around the ring
    racers = [];
    const skins = SKINS.slice(); const names = NAMES.slice();
    for (let i = 0; i < N_RACERS; i++) {
      const ang = (i / N_RACERS) * Math.PI * 2 + srand(-0.2, 0.2), rr = ARENA * 0.34;
      const si = (Math.random() * skins.length) | 0, pal = skins.splice(si, 1)[0] || makePal('#7f848c');
      const ni = (Math.random() * names.length) | 0, name = names.splice(ni, 1)[0] || ('Coon' + i);
      racers.push({
        x: cx + Math.cos(ang) * rr, y: cy + Math.sin(ang) * rr, vx: 0, vy: 0, kx: 0, ky: 0,
        hp: 100, alive: true, flip: true, walk: 0, pal, name, isBot: i !== 0,
        shinies: 0, speed: 2.7, bonkCd: 0, item: null, itemT: 0, shield: 0, slow: 0, kills: 0,
        think: 0, tx: cx, ty: cy, flee: false, hitFlash: 0,
      });
    }
    me = racers[0]; me.isBot = false;

    shinies = [];
    for (let i = 0; i < 46; i++) { const x = srand(120, ARENA - 120), y = srand(120, ARENA - 120); if (!world.waterHit(x, y, 20)) shinies.push({ x, y, bob: srng() * 6 }); }
    bins = [];
    for (let i = 0; i < 12; i++) { const x = srand(180, ARENA - 180), y = srand(180, ARENA - 180); if (!world.waterHit(x, y, 30)) bins.push({ x, y, ready: true, cd: 0, kind: pickItem() }); }
    loose = [];

    game = { running: true, t: 0, aliveCount: N_RACERS, total: N_RACERS, over: false, placed: 0 };
    el.alive.textContent = game.aliveCount; el.shine.textContent = 0;
    setHUD();
  }
  let me = null;
  const ITEMS = ['speed', 'shield', 'pepper'];
  function pickItem() { return ITEMS[(Math.random() * ITEMS.length) | 0]; }

  // ---- helpers -------------------------------------------------------------
  function ellipse(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
  function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.fill(); }
  function softShadow(cx, by, rx, ry, a) { ctx.fillStyle = `rgba(15,23,42,${a || 0.18})`; ctx.beginPath(); ctx.ellipse(cx, by, rx, ry, 0, 0, 6.283); ctx.fill(); }
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function drawRaccoon(r, t) {
    const pal = r.pal, scale = 0.92;
    ctx.save(); ctx.translate(r.x, r.y); softShadow(0, 2, 19 * scale, 6.5 * scale, 0.16);
    if (r.flip) ctx.scale(-1, 1); ctx.scale(scale, scale);
    const bob = Math.sin(r.walk) * 1.4, ls = Math.sin(r.walk) * 3;
    ctx.save(); ctx.translate(-16, -20 + bob); ctx.rotate(-0.5);
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(-i * 7, -i * 3, 9 - i * 0.6, 7 - i * 0.4, 0, 0, 6.283); ctx.fillStyle = (i % 2 === 0) ? pal.tail : pal.ring; ctx.fill(); }
    ctx.restore();
    ctx.fillStyle = pal.leg; rrect(-13, -10 - ls, 8, 12, 3); rrect(6, -10 + ls, 8, 12, 3); rrect(-8, -8 + ls, 8, 11, 3); rrect(2, -8 - ls, 8, 11, 3);
    ctx.translate(0, bob);
    const g = ctx.createRadialGradient(-4, -26, 4, 0, -22, 26); g.addColorStop(0, pal.body2); g.addColorStop(1, pal.body);
    ctx.fillStyle = g; ellipse(0, -22, 22, 18); ctx.fillStyle = pal.belly; ellipse(0, -13, 12, 9);
    ctx.fillStyle = pal.ear; ellipse(-11, -30, 6, 7); ellipse(11, -30, 6, 7);
    ctx.fillStyle = pal.mask; ellipse(-11, -31, 3.2, 4); ellipse(11, -31, 3.2, 4);
    ctx.fillStyle = pal.body2; ellipse(0, -20, 15, 13); ctx.fillStyle = pal.belly; ellipse(0, -15, 9, 8);
    ctx.fillStyle = pal.mask; ctx.beginPath(); ctx.ellipse(-7, -22, 6.5, 6, 0.25, 0, 6.283); ctx.ellipse(7, -22, 6.5, 6, -0.25, 0, 6.283); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -24, 4, 3, 0, 0, 6.283); ctx.fill();
    ctx.fillStyle = pal.eyering; ellipse(-6.5, -22, 3.6, 3.4); ellipse(6.5, -22, 3.6, 3.4);
    ctx.fillStyle = '#111'; ellipse(-6, -22, 1.9, 2.1); ellipse(7, -22, 1.9, 2.1);
    ctx.fillStyle = pal.nose; ellipse(0, -14, 2.6, 2);
    if (r.hitFlash > game.t) { ctx.fillStyle = 'rgba(255,90,80,.5)'; ellipse(0, -20, 24, 20); }
    if (r.shield > game.t) { ctx.strokeStyle = 'rgba(120,180,255,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(0, -20, 27, 24, 0, 0, 6.283); ctx.stroke(); }
    ctx.restore();
    // hp bar + name
    if (r.alive) {
      const w = 30, hpw = w * Math.max(0, r.hp) / 100;
      ctx.fillStyle = 'rgba(20,26,34,.55)'; rrect(r.x - w / 2, r.y - 52, w, 5, 2.5);
      ctx.fillStyle = r === me ? '#43d18f' : (r.hp > 40 ? '#e2c04a' : '#e0483c'); rrect(r.x - w / 2, r.y - 52, hpw, 5, 2.5);
      if (r === me) { ctx.fillStyle = '#fff'; ctx.font = '700 11px Fredoka'; ctx.textAlign = 'center'; ctx.fillText('YOU', r.x, r.y - 58); }
    }
  }

  function drawTree(tr) {
    const r = tr.r, tw = r * 0.24, th = r * 0.8;
    softShadow(tr.x, tr.y + 2, r * 0.8, r * 0.26, 0.2);
    ctx.fillStyle = '#6b4a2a'; rrect(tr.x - tw / 2, tr.y - th, tw, th, 3);
    ctx.fillStyle = '#7c5836'; ctx.fillRect(tr.x - tw / 2, tr.y - th, tw * 0.4, th);
    const cy = tr.y - th - r * 0.12;
    ctx.fillStyle = '#3f8f2f'; ellipse(tr.x, cy, r * 0.82, r * 0.72);
    ctx.fillStyle = '#4ea33a'; ellipse(tr.x - r * 0.3, cy - r * 0.12, r * 0.5, r * 0.46);
    ctx.fillStyle = '#5cb343'; ellipse(tr.x - r * 0.1, cy - r * 0.34, r * 0.36, r * 0.3);
  }
  function drawRock(r) { softShadow(r.x, r.y + r.r * 0.5, r.r * 1.1, r.r * 0.38, 0.18); ctx.fillStyle = '#8a8f96'; ellipse(r.x, r.y, r.r, r.r * 0.8); ctx.fillStyle = '#a4a9b0'; ellipse(r.x - r.r * 0.3, r.y - r.r * 0.28, r.r * 0.5, r.r * 0.36); }
  function drawBush(b) { softShadow(b.x, b.y + b.r * 0.5, b.r, b.r * 0.4, 0.12); ctx.fillStyle = '#3f9142'; ctx.beginPath(); ctx.arc(b.x - b.r * 0.5, b.y, b.r * 0.6, 0, 6.283); ctx.arc(b.x + b.r * 0.5, b.y, b.r * 0.6, 0, 6.283); ctx.arc(b.x, b.y - b.r * 0.3, b.r * 0.7, 0, 6.283); ctx.fill(); }
  function drawShiny(s, t) { const y = s.y - 7 - Math.sin(t / 260 + s.bob) * 3; softShadow(s.x, s.y + 1, 8, 2.6, 0.18); ctx.fillStyle = '#ffd23f'; ellipse(s.x, y, 8, 8); ctx.strokeStyle = '#e0a92b'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s.x, y, 8, 0, 6.283); ctx.stroke(); ctx.fillStyle = '#7a5a12'; ctx.font = '700 10px Fredoka'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('J', s.x, y + 1); }
  function drawBin(b, t) {
    softShadow(b.x, b.y + 4, 16, 5, 0.2);
    ctx.fillStyle = b.ready ? '#5a6169' : '#464b52'; rrect(b.x - 14, b.y - 26, 28, 28, 5);
    ctx.fillStyle = '#454b52'; rrect(b.x - 16, b.y - 30, 32, 6, 3);
    if (b.ready) {
      const col = b.kind === 'speed' ? '#4f7cff' : b.kind === 'shield' ? '#8a97a6' : '#d98a2b';
      const gy = b.y - 14 - Math.sin(t / 200 + b.x) * 2;
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(b.x, gy, 6, 0, 6.283); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '700 9px Fredoka'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(b.kind === 'speed' ? 'S' : b.kind === 'shield' ? 'D' : 'P', b.x, gy + 0.5);
    }
  }

  // ---- input ---------------------------------------------------------------
  const keys = {}, dir = { up: 0, down: 0, left: 0, right: 0 }; let bonkEdge = false;
  window.addEventListener('keydown', e => { const k = e.key.toLowerCase(); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault(); keys[k] = true; if (k === 'e' || k === ' ') bonkEdge = true; });
  window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
  canvas.addEventListener('mousedown', () => { bonkEdge = true; });
  function bindHold(btn, d) { const on = e => { e.preventDefault(); dir[d] = 1; }, off = e => { e.preventDefault(); dir[d] = 0; }; btn.addEventListener('touchstart', on, { passive: false }); btn.addEventListener('touchend', off); btn.addEventListener('touchcancel', off); btn.addEventListener('mousedown', on); btn.addEventListener('mouseup', off); btn.addEventListener('mouseleave', off); }
  document.querySelectorAll('.dpad button').forEach(b => bindHold(b, b.dataset.dir));
  el.bonkBtn.addEventListener('touchstart', e => { e.preventDefault(); bonkEdge = true; }, { passive: false });
  el.bonkBtn.addEventListener('mousedown', () => { bonkEdge = true; });
  if ('ontouchstart' in window) el.touch.classList.add('on');

  // ---- collision (trees/rocks/water/border) --------------------------------
  function solid(x, y) {
    if (x < 40 || y < 40 || x > ARENA - 40 || y > ARENA - 40) return true;
    if (world.waterHit(x, y, 2)) return true;
    for (const tr of world.trees) if (Math.hypot(x - tr.x, y - tr.y) < tr.r * 0.28) return true;
    for (const r of world.rocks) if (Math.hypot(x - r.x, y - r.y) < r.r * 0.8) return true;
    return false;
  }
  function moveRacer(r, vx, vy) {
    if (solid(r.x + vx, r.y)) vx = 0; if (solid(r.x, r.y + vy)) vy = 0;
    r.x += vx; r.y += vy;
  }

  // ---- combat --------------------------------------------------------------
  function feed(msg) { const row = document.createElement('div'); row.className = 'row'; row.innerHTML = msg; el.feed.appendChild(row); setTimeout(() => row.remove(), 3200); while (el.feed.children.length > 5) el.feed.firstChild.remove(); }
  function bonk(r) {
    if (r.bonkCd > game.t || !r.alive) return; r.bonkCd = game.t + BONK_CD;
    let tgt = null, bd = BONK_RANGE;
    for (const o of racers) { if (o === r || !o.alive) continue; const d = dist(r, o); if (d < bd) { tgt = o; bd = d; } }
    if (!tgt) return;
    let dmg = BONK_DMG; if (tgt.shield > game.t) dmg *= 0.4;
    tgt.hp -= dmg; tgt.hitFlash = game.t + 160;
    const ang = Math.atan2(tgt.y - r.y, tgt.x - r.x); tgt.kx += Math.cos(ang) * 7; tgt.ky += Math.sin(ang) * 7;
    // steal / scatter shinies
    const drop = Math.min(tgt.shinies, 3); tgt.shinies -= drop;
    for (let i = 0; i < drop; i++) { const a = Math.random() * 6.28, rr = 16 + Math.random() * 26; loose.push({ x: tgt.x + Math.cos(a) * rr, y: tgt.y + Math.sin(a) * rr, bob: Math.random() * 6 }); }
    if (tgt.hp <= 0) { tgt.hp = 0; eliminate(tgt, r); }
  }
  function eliminate(r, by) {
    if (!r.alive) return; r.alive = false;
    for (let i = 0; i < r.shinies; i++) { const a = Math.random() * 6.28, rr = 16 + Math.random() * 30; loose.push({ x: r.x + Math.cos(a) * rr, y: r.y + Math.sin(a) * rr, bob: Math.random() * 6 }); }
    if (by) by.kills++;
    const place = game.aliveCount;               // position this racer finished at
    game.aliveCount--;
    el.alive.textContent = game.aliveCount;
    if (r === me) { feed(`You were caught &mdash; <b>#${place}</b>`); endGame(place); return; }
    feed(`${by && by === me ? '<b>You</b>' : (by ? by.name : 'The Sweep')} knocked out ${r.name}`);
    if (game.aliveCount === 1 && me.alive) endGame(1);
  }

  // ---- update --------------------------------------------------------------
  function botThink(r) {
    // storm escape has priority
    const dc = Math.hypot(r.x - zone.cx, r.y - zone.cy);
    if (dc > zone.r * 0.82) { r.tx = zone.cx + (r.x - zone.cx) * 0.2; r.ty = zone.cy + (r.y - zone.cy) * 0.2; r.flee = false; return; }
    // nearest enemy
    let en = null, ed = 300; for (const o of racers) { if (o === r || !o.alive) continue; const d = dist(r, o); if (d < ed) { en = o; ed = d; } }
    if (en && r.hp <= 32 && ed < 200) { r.tx = r.x - (en.x - r.x); r.ty = r.y - (en.y - r.y); r.flee = true; r.enemy = null; return; }
    if (en && ed < 220 && r.hp > 32) { r.tx = en.x; r.ty = en.y; r.enemy = en; r.flee = false; return; }
    r.enemy = null; r.flee = false;
    // nearest loot / bin
    let best = null, bdd = 1e9;
    for (const s of shinies) { const d = Math.hypot(r.x - s.x, r.y - s.y); if (d < bdd) { bdd = d; best = s; } }
    for (const b of bins) if (b.ready) { const d = Math.hypot(r.x - b.x, r.y - b.y); if (d < bdd) { bdd = d; best = b; } }
    if (best) { r.tx = best.x; r.ty = best.y; } else { r.tx = zone.cx; r.ty = zone.cy; }
  }

  function update(dt) {
    game.t += dt;
    // ---- storm ----
    if (!zone.shrinking && game.t > zone.nextShrinkAt && zone.stage < 6) {
      zone.stage++; zone.targetR = Math.max(90, zone.r * 0.6); zone.dps += 4; zone.shrinking = true;
      showZone(zone.stage < 6 ? 'The Sweep is closing in!' : 'Final sweep!');
    }
    if (zone.shrinking) { zone.r += (zone.targetR - zone.r) * 0.02; if (Math.abs(zone.r - zone.targetR) < 4) { zone.r = zone.targetR; zone.shrinking = false; zone.nextShrinkAt = game.t + 16000; } }

    // ---- racers ----
    for (const r of racers) {
      if (!r.alive) continue;
      if (r.itemT && r.itemT < game.t) { r.item = null; r.itemT = 0; if (r === me) setHUD(); }
      // input / ai
      let ax = 0, ay = 0;
      if (r === me) {
        ax = (keys['d'] || keys['arrowright'] || dir.right ? 1 : 0) - (keys['a'] || keys['arrowleft'] || dir.left ? 1 : 0);
        ay = (keys['s'] || keys['arrowdown'] || dir.down ? 1 : 0) - (keys['w'] || keys['arrowup'] || dir.up ? 1 : 0);
      } else {
        if (game.t > r.think) { r.think = game.t + 180 + Math.random() * 220; botThink(r); }
        ax = r.tx - r.x; ay = r.ty - r.y; const L = Math.hypot(ax, ay) || 1; ax /= L; ay /= L;
        ax += (Math.random() - 0.5) * 0.3; ay += (Math.random() - 0.5) * 0.3;
        if (r.enemy && r.enemy.alive && dist(r, r.enemy) < BONK_RANGE - 6) bonk(r);
      }
      const spd = r.speed * (r.item === 'speed' && r.itemT > game.t ? 1.55 : 1) * (r.slow > game.t ? 0.55 : 1);
      let vx = ax, vy = ay; const L = Math.hypot(vx, vy);
      if (L > 0.05) { vx = vx / L * spd; vy = vy / L * spd; if (vx > 0.1) r.flip = false; else if (vx < -0.1) r.flip = true; r.walk += 0.25; }
      else { vx = vy = 0; }
      // knockback decay
      vx += r.kx; vy += r.ky; r.kx *= 0.8; r.ky *= 0.8;
      moveRacer(r, vx, vy);
      // storm damage
      if (Math.hypot(r.x - zone.cx, r.y - zone.cy) > zone.r) { r.hp -= zone.dps * (dt / 1000); if (r.hp <= 0) { r.hp = 0; eliminate(r, null); } }
      // shiny pickup
      for (let i = shinies.length - 1; i >= 0; i--) { if (Math.hypot(r.x - shinies[i].x, r.y - shinies[i].y) < 24) { shinies.splice(i, 1); r.shinies++; if (r === me) setHUD(); } }
      for (let i = loose.length - 1; i >= 0; i--) { if (Math.hypot(r.x - loose[i].x, r.y - loose[i].y) < 24) { loose.splice(i, 1); r.shinies++; if (r === me) setHUD(); } }
      // bin item pickup
      for (const b of bins) { if (b.ready && Math.hypot(r.x - b.x, r.y - b.y) < 30) { grabItem(r, b); } if (!b.ready && game.t > b.cd) { b.ready = true; b.kind = pickItem(); } }
    }
    if (bonkEdge) { bonkEdge = false; if (me.alive) bonk(me); }
  }
  function grabItem(r, b) {
    b.ready = false; b.cd = game.t + 12000;
    if (b.kind === 'speed') { r.item = 'speed'; r.itemT = game.t + 5000; }
    else if (b.kind === 'shield') { r.shield = game.t + 6000; r.item = 'shield'; r.itemT = game.t + 6000; }
    else { r.item = 'pepper'; r.itemT = game.t + 200; for (const o of racers) { if (o !== r && o.alive && dist(r, o) < 130) o.slow = game.t + 3000; } }
    if (r === me) { setHUD(); feed(`Grabbed <b>${b.kind}</b>!`); }
  }

  // ---- HUD -----------------------------------------------------------------
  function setHUD() {
    el.shine.textContent = me.shinies;
    const hp = Math.max(0, Math.round(me.hp));
    el.hpFill.style.width = hp + '%'; el.hpLabel.textContent = hp; el.hpFill.classList.toggle('low', hp <= 35);
    const active = me.item && me.itemT > game.t;
    el.itemSlot.className = 'item' + (active ? ' armed ' + me.item : '');
    el.itemSlot.innerHTML = active ? `<span>${me.item.toUpperCase()}</span>` : '<span>No item</span>';
  }
  let zoneTO = 0;
  function showZone(txt) { el.zoneText.textContent = txt; el.zone.classList.add('show'); clearTimeout(zoneTO); zoneTO = setTimeout(() => el.zone.classList.remove('show'), 2600); }

  // ---- render --------------------------------------------------------------
  const cam = { x: 0, y: 0 };
  function palette(type) { return type === 'sand' ? '#e3cd8e' : type === 'forest' ? '#5d9c39' : type === 'flower' ? '#8fc94e' : '#8cc24a'; }
  function render(t) {
    resize(); const vw = canvas.width / DPR, vh = canvas.height / DPR;
    cam.x = clamp(me.x - vw / 2, 0, ARENA - vw); cam.y = clamp(me.y - vh / 2, 0, ARENA - vh);
    if (ARENA < vw) cam.x = (ARENA - vw) / 2; if (ARENA < vh) cam.y = (ARENA - vh) / 2;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, vw, vh);
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    const vx0 = cam.x, vy0 = cam.y, vx1 = cam.x + vw, vy1 = cam.y + vh;

    // terrain (coarse tiles)
    const s0x = Math.floor(vx0 / TILE) * TILE, s0y = Math.floor(vy0 / TILE) * TILE;
    for (let gx = s0x; gx < vx1; gx += TILE) for (let gy = s0y; gy < vy1; gy += TILE) {
      const type = world.zoneAt(gx + 24, gy + 24); ctx.fillStyle = palette(type); ctx.fillRect(gx, gy, TILE, TILE);
      if (((gx / TILE + gy / TILE) & 1) === 0) { ctx.fillStyle = 'rgba(0,0,0,.04)'; ctx.fillRect(gx, gy, TILE, TILE); }
    }
    // water
    for (const p of world.water) { ctx.fillStyle = '#2f6d86'; ellipse(p.x, p.y, p.rx, p.ry); ctx.fillStyle = '#3f89a6'; ellipse(p.x, p.y - 3, p.rx * 0.85, p.ry * 0.8); }

    // loot
    for (const s of shinies) if (vis(s.x, s.y, vx0, vy0, vx1, vy1, 20)) drawShiny(s, t);
    for (const s of loose) if (vis(s.x, s.y, vx0, vy0, vx1, vy1, 20)) drawShiny(s, t);
    for (const b of bins) if (vis(b.x, b.y, vx0, vy0, vx1, vy1, 30)) drawBin(b, t);

    // depth-sorted scenery + racers
    const draws = [];
    for (const b of world.bushes) if (vis(b.x, b.y, vx0, vy0, vx1, vy1, 40)) draws.push({ y: b.y, f: () => drawBush(b) });
    for (const tr of world.trees) if (vis(tr.x, tr.y, vx0, vy0, vx1, vy1, 80)) draws.push({ y: tr.y, f: () => drawTree(tr) });
    for (const r of world.rocks) if (vis(r.x, r.y, vx0, vy0, vx1, vy1, 50)) draws.push({ y: r.y, f: () => drawRock(r) });
    for (const r of racers) if (r.alive && vis(r.x, r.y, vx0, vy0, vx1, vy1, 60)) draws.push({ y: r.y, f: () => drawRaccoon(r, t) });
    draws.sort((a, b) => a.y - b.y); for (const d of draws) d.f();

    // storm — darken outside the safe circle + pulsing edge
    ctx.save();
    ctx.fillStyle = 'rgba(120,20,34,.30)'; ctx.beginPath();
    ctx.rect(vx0 - 4, vy0 - 4, vw + 8, vh + 8); ctx.arc(zone.cx, zone.cy, zone.r, 0, 6.283, true); ctx.fill('evenodd');
    ctx.strokeStyle = `rgba(255,120,120,${0.6 + 0.3 * Math.sin(t / 200)})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(zone.cx, zone.cy, zone.r, 0, 6.283); ctx.stroke();
    ctx.restore();

    ctx.restore();
    drawMinimap();
  }
  function vis(x, y, a, b, c, d, p) { return x > a - p && x < c + p && y > b - p && y < d + p; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function drawMinimap() {
    const mw = 150, mh = 150, ox = 14, oy = 58, sx = mw / ARENA, sy = mh / ARENA;
    ctx.globalAlpha = 0.95; ctx.fillStyle = 'rgba(255,255,255,.9)'; rrect(ox - 4, oy - 4, mw + 8, mh + 8, 10);
    ctx.save(); rrect(ox, oy, mw, mh, 6); ctx.clip();
    ctx.fillStyle = '#8cc24a'; ctx.fillRect(ox, oy, mw, mh);
    for (const z of world.zones) { ctx.fillStyle = z.type === 'forest' ? 'rgba(60,140,50,.6)' : z.type === 'sand' ? 'rgba(230,205,140,.8)' : z.type === 'flower' ? 'rgba(160,210,90,.5)' : 'rgba(0,0,0,0)'; ctx.fillRect(ox + z.x * sx, oy + z.y * sy, z.w * sx, z.h * sy); }
    // storm ring
    ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(ox + zone.cx * sx, oy + zone.cy * sy, zone.r * sx, 0, 6.283); ctx.stroke();
    ctx.fillStyle = 'rgba(120,20,34,.18)'; ctx.beginPath(); ctx.rect(ox, oy, mw, mh); ctx.arc(ox + zone.cx * sx, oy + zone.cy * sy, zone.r * sx, 0, 6.283, true); ctx.fill('evenodd');
    for (const r of racers) { if (!r.alive) continue; ctx.fillStyle = r === me ? '#ffd23f' : '#e0483c'; ctx.beginPath(); ctx.arc(ox + r.x * sx, oy + r.y * sy, r === me ? 3.4 : 2.2, 0, 6.283); ctx.fill(); if (r === me) { ctx.strokeStyle = '#1b2430'; ctx.lineWidth = 1.4; ctx.stroke(); } }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  // ---- loop / lifecycle ----------------------------------------------------
  let DPR = 1, last = 0;
  function resize() { DPR = Math.min(window.devicePixelRatio || 1, 2); const w = window.innerWidth, h = window.innerHeight; if (canvas.width !== Math.floor(w * DPR) || canvas.height !== Math.floor(h * DPR)) { canvas.width = Math.floor(w * DPR); canvas.height = Math.floor(h * DPR); } }
  window.addEventListener('resize', resize);
  function frame(now) { const dt = Math.min(40, now - last); last = now; if (game && game.running && !game.over) update(dt); if (game) render(now || 0); requestAnimationFrame(frame); }

  function endGame(place) {
    game.over = true; game.running = false;
    el.placeText.textContent = '#' + place;
    if (place === 1) { el.resultTitle.textContent = 'Trash King of the Night!'; el.resultSub.textContent = 'You outlasted every last raccoon.'; }
    else { el.resultTitle.textContent = 'Caught by the Sweep'; el.resultSub.textContent = `You placed #${place} of ${game.total}. Waddle back in?`; }
    el.rKills.textContent = me.kills; el.rShine.textContent = me.shinies;
    el.result.classList.remove('hidden');
  }
  function start() { el.intro.classList.add('hidden'); el.result.classList.add('hidden'); newRound(); }
  el.playBtn.addEventListener('click', start);
  el.againBtn.addEventListener('click', start);

  // boot: build an idle arena so something renders behind the intro
  newRound(); game.running = false;
  requestAnimationFrame(frame);

  window.RR = {
    state: () => ({ me, racers, zone, game, shinies: shinies.length, bins: bins.length }),
    bonk: () => bonk(me),
    forceShrink: () => { zone.nextShrinkAt = game.t - 1; },
    killBots: (n) => { let k = 0; for (const r of racers) { if (r.isBot && r.alive && k < n) { r.hp = 0; eliminate(r, me); k++; } } },
  };
})();
