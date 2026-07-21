/* ============================================================================
   JIMOTHY'S ADVENTURES — top-down 2D adventure
   Vanilla canvas, no dependencies, no image assets required.

   World layout & biome idea adapted from the author's own "pokefight" engine;
   decorations are drawn as smooth cartoon art (not blocky).

   Roadmap hooks already in place for the planned multiplayer + editable skins:
   - player.skin is a swappable palette (see SKINS / applySkin)
   - remote players could be pushed into `others[]` and drawn like npcs
   ============================================================================ */
(function () {
  'use strict';

  const canvas = document.getElementById('world');
  const ctx = canvas.getContext('2d');

  const SPRITES = { player: null, npc: null, momo: null, dog: null };
  function loadImg(src) { const i = new Image(); i.src = src; return i; }

  // ---- Seeded RNG so the world layout is stable across reloads -------------
  let _seed = 20260721;
  function rng() { _seed = (Math.imul(_seed, 1103515245) + 12345) & 0x7fffffff; return _seed / 0x7fffffff; }
  const rand = (a, b) => a + rng() * (b - a);

  // ---- World constants (bigger map) ----------------------------------------
  const TILE = 48;
  const WORLD_W = 3600, WORLD_H = 2400;

  // ---- DOM -----------------------------------------------------------------
  const el = {
    coin: document.getElementById('coinCount'),
    qName: document.getElementById('qName'),
    qObj: document.getElementById('qObj'),
    dialog: document.getElementById('dialog'),
    dWho: document.getElementById('dWho'),
    dLine: document.getElementById('dLine'),
    intro: document.getElementById('intro'),
    win: document.getElementById('win'),
    winText: document.getElementById('winText'),
    playBtn: document.getElementById('playBtn'),
    replayBtn: document.getElementById('replayBtn'),
    touch: document.getElementById('touch'),
    actBtn: document.getElementById('actBtn'),
    skinRow: document.getElementById('skinRow'),
  };

  // ---- Skins (editable-skin groundwork) ------------------------------------
  function shade(hex, f) { const n = parseInt(hex.slice(1), 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255, c = v => Math.max(0, Math.min(255, Math.round(v * f))); return `rgb(${c(r)},${c(g)},${c(b)})`; }
  function makePal(body, opts) {
    opts = opts || {};
    return { body, body2: shade(body, 1.2), belly: opts.belly || '#d9d6cf', mask: opts.mask || '#1d1d21', eyering: '#efece5', leg: opts.leg || shade(body, 0.42), ear: shade(body, 0.86), tail: body, ring: opts.ring || '#232327', nose: '#141416' };
  }
  const SKINS = [
    { id: 'classic', name: 'Classic', pal: makePal('#7f848c') },
    { id: 'sandy', name: 'Sandy', pal: makePal('#8b7d6b', { belly: '#e2d8c6' }) },
    { id: 'forest', name: 'Forest', pal: makePal('#6b7f7a', { belly: '#d3ddd6' }) },
    { id: 'berry', name: 'Berry', pal: makePal('#8a6b86', { belly: '#e6dae6', mask: '#2a1f2a', ring: '#3a2a3a' }) },
    { id: 'gold', name: 'Golden', pal: makePal('#b79452', { belly: '#f0e6cf', ring: '#5b451f' }) },
    { id: 'night', name: 'Night', pal: makePal('#4a5570', { belly: '#c9d2e6', ring: '#1a2030' }) },
  ];
  let chosenSkin = SKINS[0];
  try { const saved = localStorage.getItem('jimothy_skin'); if (saved) { const s = SKINS.find(k => k.id === saved); if (s) chosenSkin = s; } } catch (e) {}

  function buildSkinPicker() {
    if (!el.skinRow) return;
    el.skinRow.innerHTML = '';
    SKINS.forEach(s => {
      const b = document.createElement('button');
      b.className = 'skin-swatch' + (s.id === chosenSkin.id ? ' on' : '');
      b.style.background = s.pal.body; b.title = s.name; b.setAttribute('aria-label', s.name);
      b.addEventListener('click', () => {
        chosenSkin = s; try { localStorage.setItem('jimothy_skin', s.id); } catch (e) {}
        el.skinRow.querySelectorAll('.skin-swatch').forEach(x => x.classList.remove('on'));
        b.classList.add('on');
        if (player) player.pal = s.pal;
      });
      el.skinRow.appendChild(b);
    });
  }

  // ---- World data ----------------------------------------------------------
  let world, player, game, npcs, coins, berries, gems, trash, momo, dogs, bin, sign, others = [];

  function inRect(x, y, r, pad) { return x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad; }

  function buildWorld() {
    _seed = 20260721;
    const zones = [
      { x: 0, y: 0, w: WORLD_W, h: WORLD_H, type: 'grass' },
      { x: 0, y: 0, w: 1300, h: 1000, type: 'forest' },       // NW forest
      { x: 1500, y: 0, w: 1000, h: 700, type: 'snow' },       // N snow
      { x: 2600, y: 560, w: 1000, h: 760, type: 'sand' },     // E beach
      { x: 1300, y: 1650, w: 1500, h: 750, type: 'forest' },  // S forest
      { x: 0, y: 1500, w: 1300, h: 900, type: 'flower' },     // SW meadow
      { x: 2500, y: 1300, w: 1100, h: 1100, type: 'flower' }, // SE meadow
      { x: 1360, y: 900, w: 900, h: 520, type: 'grass' },     // central clearing
    ];
    const zoneAt = (x, y) => { let t = 'grass'; for (const z of zones) if (x > z.x && x < z.x + z.w && y > z.y && y < z.y + z.h) t = z.type; return t; };

    // Dirt paths — a clean cross + one south spur
    const paths = [
      { x: 1740, y: 300, w: 90, h: 1800 },   // vertical main road
      { x: 300, y: 1140, w: 3000, h: 84 },   // horizontal main road
      { x: 1300, y: 1224, w: 74, h: 680 },   // south spur into the SW meadow
    ];
    const onPath = (x, y, pad = 20) => paths.some(p => inRect(x, y, p, pad));

    // Water ponds — placed OFF every road
    const water = [
      { x: 700, y: 520, rx: 240, ry: 170 },   // NW forest lake
      { x: 3050, y: 780, rx: 250, ry: 175 },  // E beach pond
      { x: 620, y: 2040, rx: 220, ry: 150 },  // SW meadow pond
      { x: 3050, y: 1900, rx: 250, ry: 175 }, // SE meadow pond
    ];
    const waterHit = (x, y, pad) => water.some(p => ((x - p.x) / (p.rx + pad)) ** 2 + ((y - p.y) / (p.ry + pad)) ** 2 < 1);

    const spawn = { x: 1785, y: 1182 };
    const nearSpawn = (x, y, pad) => Math.hypot(x - spawn.x, y - spawn.y) < pad;

    const houses = [
      { x: 470, y: 700, w: 150, h: 120, roof: '#c76b3f' },
      { x: 2760, y: 1560, w: 165, h: 128, roof: '#5b8fb0' },
    ];
    const nearHouse = (x, y, pad) => houses.some(h => inRect(x, y, h, pad));

    const blocked = (x, y, pad) => waterHit(x, y, pad) || onPath(x, y, pad) || nearHouse(x, y, pad + 30) || nearSpawn(x, y, 190);

    // Trees — dense in forest, scattered elsewhere
    const trees = [];
    for (let i = 0; i < 420; i++) {
      let x = 0, y = 0, ok = false, tries = 0;
      do {
        x = rand(50, WORLD_W - 50); y = rand(50, WORLD_H - 50); tries++;
        const inForest = zoneAt(x, y) === 'forest';
        const keep = inForest ? rng() < 0.85 : rng() < 0.16;
        ok = keep && !blocked(x, y, 34) && zoneAt(x, y) !== 'snow';
      } while (!ok && tries < 24);
      if (ok) trees.push({ x, y, r: rand(26, 40) });
    }
    for (let i = 0; i < 30; i++) { const x = rand(1520, 2480), y = rand(40, 660); if (!blocked(x, y, 24)) trees.push({ x, y, r: rand(24, 34), snow: true }); }

    const rocks = [];
    for (let i = 0; i < 90; i++) { let x = rand(70, WORLD_W - 70), y = rand(70, WORLD_H - 70), t = 0; while (blocked(x, y, 26) && t < 18) { x = rand(70, WORLD_W - 70); y = rand(70, WORLD_H - 70); t++; } if (!blocked(x, y, 26)) rocks.push({ x, y, r: rand(15, 26) }); }

    const bushes = [];
    for (let i = 0; i < 220; i++) { const x = rand(40, WORLD_W - 40), y = rand(40, WORLD_H - 40); if (!blocked(x, y, 12) && zoneAt(x, y) !== 'snow') bushes.push({ x, y, r: rand(14, 22) }); }

    const flowerColors = ['#f472b6', '#fbbf24', '#60a5fa', '#f87171', '#a78bfa', '#ffffff'];
    const flowers = [];
    for (let i = 0; i < 1500; i++) { const x = rand(16, WORLD_W - 16), y = rand(16, WORLD_H - 16); const z = zoneAt(x, y); if (z === 'snow' || z === 'sand') continue; if (z !== 'flower' && rng() < 0.55) continue; if (!waterHit(x, y, 8) && !onPath(x, y, 6)) flowers.push({ x, y, c: flowerColors[(rng() * flowerColors.length) | 0] }); }

    const mushroomColors = ['#ef4444', '#a855f7', '#f59e0b'];
    const mushrooms = [];
    for (let i = 0; i < 110; i++) { const x = rand(50, WORLD_W - 50), y = rand(50, WORLD_H - 50); if (zoneAt(x, y) === 'forest' && !waterHit(x, y, 16)) mushrooms.push({ x, y, c: mushroomColors[(rng() * mushroomColors.length) | 0] }); }

    const lilies = [];
    water.forEach(p => { const n = 3 + ((rng() * 3) | 0); for (let i = 0; i < n; i++) { const a = rng() * 6.283, rr = rng() * 0.7; lilies.push({ x: p.x + Math.cos(a) * p.rx * rr, y: p.y + Math.sin(a) * p.ry * rr, c: rng() < 0.5 ? '#f472b6' : '#ffffff' }); } });

    const butterflies = [];
    const flutter = ['#f472b6', '#fbbf24', '#60a5fa', '#a78bfa'];
    for (let i = 0; i < 34; i++) { const x = rand(120, WORLD_W - 120), y = rand(120, WORLD_H - 120); butterflies.push({ x, y, phase: rng() * 6.28, c: flutter[(rng() * flutter.length) | 0] }); }

    return { zones, zoneAt, water, waterHit, paths, onPath, spawn, houses, blocked, trees, rocks, bushes, flowers, mushrooms, lilies, butterflies };
  }

  function scatter(n, pred) {
    const out = [];
    for (let i = 0; i < n; i++) {
      let x = 0, y = 0, ok = false, t = 0;
      do { x = rand(90, WORLD_W - 90); y = rand(90, WORLD_H - 90); t++; ok = !world.blocked(x, y, 16) && (!pred || pred(x, y)); } while (!ok && t < 40);
      if (ok) out.push({ x, y });
    }
    return out;
  }

  function resetGame() {
    world = buildWorld();
    buildSkinPicker();

    player = { x: world.spawn.x, y: world.spawn.y, w: 34, h: 26, speed: 2.8, flip: true, walk: 0, moving: false, carrying: 0, pal: chosenSkin.pal };

    npcs = [
      { name: 'Rocky', x: world.spawn.x + 120, y: world.spawn.y - 150, flip: true, walk: 0, pal: PAL_ROCKY, bob: 0 },
      { name: 'Pip', x: 1180, y: 1720, flip: false, walk: 0, pal: PAL_PIP, bob: 1.5 },
    ];

    bin = { x: world.spawn.x - 150, y: world.spawn.y - 120, solid: { w: 32, h: 28 } };
    sign = { x: world.spawn.x - 30, y: world.spawn.y + 46 };

    // Collectibles — plenty, scattered across the whole map
    coins = scatter(20, (x, y) => world.zoneAt(x, y) !== 'sand').map(p => ({ ...p, bob: rng() * 6 }));
    berries = scatter(12, (x, y) => world.zoneAt(x, y) === 'forest').map(p => ({ ...p, got: false }));
    gems = scatter(10).map(p => ({ ...p, spin: rng() * 6 }));

    trash = [];
    [[1600, 1080], [1660, 1010], [1520, 1050], [1720, 1120]].forEach(([x, y]) => trash.push({ x, y, got: false }));

    momo = { x: 220, y: 240, following: false, flip: false, walk: 0 };

    // Dogs — the villains. Three hounds roaming different regions.
    dogs = [
      mkDog(1980, 1000, 'east'),
      mkDog(900, 1780, 'sw'),
      mkDog(2900, 1450, 'se'),
    ];

    game = { coins: 0, berries: 0, stage: 0, running: false, dialogQueue: [], onDialogEnd: null, t: 0, toast: '', toastT: 0 };
    updateHUD();
  }
  function mkDog(x, y, tag) { return { x, y, home: { x, y }, tag, w: 40, h: 26, dir: rng() < 0.5 ? 1 : -1, walk: 0, chase: false, scared: 0, questShooed: false }; }

  // ---- Palettes ------------------------------------------------------------
  const PAL_ROCKY = makePal('#8b7d6b', { belly: '#e2d8c6' });
  const PAL_PIP = makePal('#6b7f7a', { belly: '#d3ddd6' });
  const PAL_MOMO = makePal('#9298a0');

  // ---- helpers -------------------------------------------------------------
  function ellipse(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
  function roundedRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.fill(); }
  function softShadow(cx, by, rx, ry, a) { ctx.fillStyle = `rgba(15,23,42,${a || 0.18})`; ctx.beginPath(); ctx.ellipse(cx, by, rx, ry, 0, 0, 6.283); ctx.fill(); }

  // ---- Cartoon raccoon painter (Jimothy & friends) -------------------------
  function drawRaccoon(x, y, pal, scale, walk, flip, sprite) {
    ctx.save(); ctx.translate(x, y); softShadow(0, 2, 20 * scale, 7 * scale, 0.16);
    if (flip) ctx.scale(-1, 1); ctx.scale(scale, scale);
    if (sprite && sprite.complete && sprite.naturalWidth) { const w = 60, h = 56; ctx.drawImage(sprite, -w / 2, -h, w, h); ctx.restore(); return; }
    const bob = Math.sin(walk) * 1.4, legSwing = Math.sin(walk) * 3;
    ctx.save(); ctx.translate(-16, -20 + bob); ctx.rotate(-0.5);
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(-i * 7, -i * 3, 9 - i * 0.6, 7 - i * 0.4, 0, 0, Math.PI * 2); ctx.fillStyle = (i % 2 === 0) ? pal.tail : pal.ring; ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(-35, -15, 5, 4, 0, 0, Math.PI * 2); ctx.fillStyle = pal.ring; ctx.fill(); ctx.restore();
    ctx.fillStyle = pal.leg;
    roundedRect(-13, -10 - legSwing, 8, 12, 3); roundedRect(6, -10 + legSwing, 8, 12, 3);
    roundedRect(-8, -8 + legSwing, 8, 11, 3); roundedRect(2, -8 - legSwing, 8, 11, 3);
    ctx.translate(0, bob);
    const g = ctx.createRadialGradient(-4, -26, 4, 0, -22, 26); g.addColorStop(0, pal.body2); g.addColorStop(1, pal.body);
    ctx.fillStyle = g; ellipse(0, -22, 22, 18); ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = pal.belly; ellipse(0, -13, 12, 9);
    ctx.fillStyle = pal.ear; ellipse(-11, -30, 6, 7); ellipse(11, -30, 6, 7);
    ctx.fillStyle = pal.mask; ellipse(-11, -31, 3.2, 4); ellipse(11, -31, 3.2, 4);
    ctx.fillStyle = pal.body2; ellipse(0, -20, 15, 13); ctx.fillStyle = pal.belly; ellipse(0, -15, 9, 8);
    ctx.fillStyle = pal.mask; ctx.beginPath(); ctx.ellipse(-7, -22, 6.5, 6, 0.25, 0, Math.PI * 2); ctx.ellipse(7, -22, 6.5, 6, -0.25, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -24, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pal.eyering; ellipse(-6.5, -22, 3.6, 3.4); ellipse(6.5, -22, 3.6, 3.4);
    ctx.fillStyle = '#111'; ellipse(-6, -22, 1.9, 2.1); ellipse(7, -22, 1.9, 2.1);
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ellipse(-6.6, -22.8, .7, .7); ellipse(6.4, -22.8, .7, .7);
    ctx.fillStyle = pal.nose; ellipse(0, -14, 2.6, 2);
    ctx.strokeStyle = pal.nose; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, -12.5); ctx.quadraticCurveTo(-2.5, -10.5, -4, -11.5); ctx.moveTo(0, -12.5); ctx.quadraticCurveTo(2.5, -10.5, 4, -11.5); ctx.stroke();
    ctx.restore();
  }

  // ---- Terrain (soft, textured, feathered biome edges — not blocky) --------
  function palette(type) {
    return type === 'sand' ? ['#e3cd8e', '#efdca6', '#d2bb78']
      : type === 'snow' ? ['#eaf1f6', '#ffffff', '#d6e2ec']
      : type === 'forest' ? ['#4f8a2f', '#5d9c39', '#427a27']
      : type === 'flower' ? ['#7bb33e', '#8fc94e', '#6aa033']
      : ['#79ad3b', '#8cc24a', '#6b9c2f'];
  }
  function drawTerrain(vx0, vy0, vx1, vy1) {
    const CELL = 8, per = TILE / CELL, zoneAt = world.zoneAt;
    const sx = Math.floor(vx0 / TILE) * TILE, sy = Math.floor(vy0 / TILE) * TILE;
    for (let gx = sx; gx < vx1 + TILE; gx += TILE) {
      for (let gy = sy; gy < vy1 + TILE; gy += TILE) {
        const cx = gx + TILE / 2, cy = gy + TILE / 2, type = zoneAt(cx, cy);
        const [base, light, dark] = palette(type);
        ctx.fillStyle = base; ctx.fillRect(gx, gy, TILE, TILE);
        let h = (Math.imul(gx, 73856093) ^ Math.imul(gy, 19349663)) >>> 0;
        for (let i = 0; i < 5; i++) { h = (Math.imul(h, 1103515245) + 12345) >>> 0; const ox = (h % per) * CELL; h = (Math.imul(h, 1103515245) + 12345) >>> 0; const oy = (h % per) * CELL; ctx.fillStyle = (i & 1) ? dark : light; ctx.globalAlpha = 0.5; ctx.fillRect(gx + ox, gy + oy, CELL, CELL); }
        ctx.globalAlpha = 1;
        const feather = (nx, ny, side) => { const nt = zoneAt(nx, ny); if (nt === type) return; ctx.fillStyle = palette(nt)[0]; ctx.globalAlpha = 0.6; for (let k = 0; k < per; k++) { if ((k & 1) !== 0) continue; if (side === 'L') ctx.fillRect(gx, gy + k * CELL, CELL, CELL); else if (side === 'R') ctx.fillRect(gx + TILE - CELL, gy + k * CELL, CELL, CELL); else if (side === 'T') ctx.fillRect(gx + k * CELL, gy, CELL, CELL); else ctx.fillRect(gx + k * CELL, gy + TILE - CELL, CELL, CELL); } ctx.globalAlpha = 1; };
        feather(cx - TILE, cy, 'L'); feather(cx + TILE, cy, 'R'); feather(cx, cy - TILE, 'T'); feather(cx, cy + TILE, 'B');
      }
    }
  }
  function drawPaths() {
    for (const p of world.paths) {
      ctx.fillStyle = '#c8a86a'; roundedRect(p.x, p.y, p.w, p.h, 12);
      ctx.fillStyle = '#bd9c5e'; ctx.globalAlpha = 0.6;
      for (let gx = p.x + 6; gx < p.x + p.w; gx += 18) for (let gy = p.y + 6; gy < p.y + p.h; gy += 18) { const hh = (Math.imul(gx, 374761393) ^ Math.imul(gy, 668265263)) >>> 0; if ((hh & 3) === 0) ellipse(gx, gy, 3, 2); }
      ctx.globalAlpha = 1;
    }
  }
  function drawWater(t) {
    for (const p of world.water) {
      ctx.fillStyle = '#7bb0c4'; ellipse(p.x, p.y + 3, p.rx + 5, p.ry + 4);   // shore
      ctx.fillStyle = '#2f6d86'; ellipse(p.x, p.y, p.rx, p.ry);
      ctx.fillStyle = '#3f89a6'; ellipse(p.x, p.y - 4, p.rx * 0.86, p.ry * 0.8);
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2;
      for (let i = 1; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(p.x, p.y + Math.sin(t / 500 + i) * 4, p.rx * (0.4 + i * 0.22), p.ry * (0.4 + i * 0.22), 0, 0, 6.283); ctx.stroke(); }
    }
    for (const li of world.lilies) { const bob = Math.sin(t / 500 + li.x) * 1.2; ctx.fillStyle = '#2f9e44'; ctx.beginPath(); ctx.ellipse(li.x, li.y + bob, 9, 7, 0.4, 0, 6.283); ctx.fill(); ctx.fillStyle = li.c; ellipse(li.x, li.y + bob - 1, 3.2, 3.2); }
  }

  function drawFlower(f) { ctx.fillStyle = '#2f9e44'; ctx.fillRect(f.x - 0.6, f.y, 1.2, 5); ctx.fillStyle = f.c; for (let i = 0; i < 4; i++) { const a = i * 1.57; ellipse(f.x + Math.cos(a) * 2.4, f.y + Math.sin(a) * 2.4, 1.8, 1.8); } ctx.fillStyle = '#fde047'; ellipse(f.x, f.y, 1.4, 1.4); }
  function drawMushroom(m) { softShadow(m.x, m.y + 5, 6, 2.2, 0.15); ctx.fillStyle = '#f8fafc'; roundedRect(m.x - 2, m.y - 1, 4, 6, 2); ctx.fillStyle = m.c; ctx.beginPath(); ctx.arc(m.x, m.y - 1, 6, Math.PI, 0); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ellipse(m.x - 2, m.y - 3, 1.3, 1.3); ellipse(m.x + 2.5, m.y - 1.5, 1, 1); }
  function drawBush(b) { softShadow(b.x, b.y + b.r * 0.5, b.r, b.r * 0.4, 0.12); ctx.fillStyle = '#3f9142'; ctx.beginPath(); ctx.arc(b.x - b.r * 0.5, b.y, b.r * 0.6, 0, 6.283); ctx.arc(b.x + b.r * 0.5, b.y, b.r * 0.6, 0, 6.283); ctx.arc(b.x, b.y - b.r * 0.3, b.r * 0.7, 0, 6.283); ctx.fill(); ctx.fillStyle = '#4cae4f'; ellipse(b.x - b.r * 0.2, b.y - b.r * 0.2, b.r * 0.35, b.r * 0.35); }
  function drawButterfly(bf, t) { const flap = Math.abs(Math.sin(t / 90 + bf.phase)); ctx.fillStyle = bf.c; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.ellipse(bf.x - 3, bf.y, 3.4 * flap + 1, 4, -0.5, 0, 6.283); ctx.fill(); ctx.beginPath(); ctx.ellipse(bf.x + 3, bf.y, 3.4 * flap + 1, 4, 0.5, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; ctx.fillStyle = '#0f172a'; ctx.fillRect(bf.x - 0.6, bf.y - 3, 1.2, 6); }

  // Smooth cartoon tree (round layered canopy) — NOT blocky
  function drawTree(tr, t) {
    const sway = Math.sin(t / 900 + tr.x) * 2;
    softShadow(tr.x, tr.y + tr.r * 0.34, tr.r * 0.9, tr.r * 0.3, 0.2);
    ctx.fillStyle = '#6b4a2a'; roundedRect(tr.x - tr.r * 0.12, tr.y - tr.r * 0.5, tr.r * 0.24, tr.r * 0.55, 3);
    ctx.fillStyle = '#7c5836'; ctx.fillRect(tr.x - tr.r * 0.12, tr.y - tr.r * 0.5, tr.r * 0.09, tr.r * 0.55);
    const cx = tr.x + sway, cy = tr.y - tr.r * 0.7;
    if (tr.snow) {
      ctx.fillStyle = '#2f6b3a'; ellipse(cx, cy, tr.r * 0.82, tr.r * 0.78);
      ctx.fillStyle = '#3a7d46'; ellipse(cx - tr.r * 0.3, cy - tr.r * 0.2, tr.r * 0.5, tr.r * 0.5);
      ctx.fillStyle = '#eef5f9'; ellipse(cx + tr.r * 0.2, cy - tr.r * 0.35, tr.r * 0.4, tr.r * 0.32);
      return;
    }
    ctx.fillStyle = '#3f8f2f'; ellipse(cx, cy, tr.r * 0.9, tr.r * 0.82);
    ctx.fillStyle = '#4ea33a'; ellipse(cx - tr.r * 0.32, cy - tr.r * 0.14, tr.r * 0.55, tr.r * 0.52); ellipse(cx + tr.r * 0.34, cy + tr.r * 0.05, tr.r * 0.45, tr.r * 0.42);
    ctx.fillStyle = '#5cb343'; ellipse(cx - tr.r * 0.12, cy - tr.r * 0.4, tr.r * 0.4, tr.r * 0.34);
    ctx.fillStyle = 'rgba(255,255,255,0.10)'; ellipse(cx - tr.r * 0.4, cy - tr.r * 0.3, tr.r * 0.22, tr.r * 0.16);
  }
  // Smooth cartoon rock (rounded) — NOT blocky
  function drawRock(r) {
    softShadow(r.x, r.y + r.r * 0.5, r.r * 1.1, r.r * 0.38, 0.18);
    ctx.fillStyle = '#8a8f96'; ellipse(r.x, r.y, r.r, r.r * 0.8);
    ctx.fillStyle = '#a4a9b0'; ellipse(r.x - r.r * 0.3, r.y - r.r * 0.28, r.r * 0.5, r.r * 0.36);
    ctx.fillStyle = '#6f757c'; ellipse(r.x + r.r * 0.35, r.y + r.r * 0.2, r.r * 0.28, r.r * 0.2);
    ctx.strokeStyle = 'rgba(70,76,84,.5)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(r.x - r.r * 0.4, r.y + r.r * 0.1); ctx.lineTo(r.x, r.y - r.r * 0.1); ctx.stroke();
  }
  // Smooth cabin (triangle roof + rounded wall) — NOT blocky
  function drawHouse(h) {
    softShadow(h.x + h.w / 2, h.y + h.h + 4, h.w * 0.6, 10, 0.2);
    const wallY = h.y + h.h * 0.42, wallH = h.h * 0.58;
    ctx.fillStyle = '#efe7d6'; roundedRect(h.x, wallY, h.w, wallH, 8);
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 1.5; ctx.strokeRect(h.x, wallY, h.w, wallH);
    ctx.fillStyle = h.roof; ctx.beginPath(); ctx.moveTo(h.x - 10, wallY + 6); ctx.lineTo(h.x + h.w / 2, h.y - 6); ctx.lineTo(h.x + h.w + 10, wallY + 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.moveTo(h.x + h.w / 2, h.y - 6); ctx.lineTo(h.x + h.w / 2 - 30, wallY + 6); ctx.lineTo(h.x + h.w / 2, wallY + 6); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7c4a1e'; roundedRect(h.x + h.w / 2 - 13, wallY + wallH - 30, 26, 30, 4);
    ctx.fillStyle = '#ffd23f'; roundedRect(h.x + 16, wallY + 14, 16, 16, 3); roundedRect(h.x + h.w - 32, wallY + 14, 16, 16, 3);
  }
  function drawBin(b) {
    const x = b.x, y = b.y; softShadow(x, y + 4, 20, 6, 0.2);
    ctx.fillStyle = '#3f7d4a'; roundedRect(x - 16, y - 28, 32, 30, 6);
    ctx.fillStyle = '#356b40'; for (let i = 6; i < 28; i += 7) ctx.fillRect(x - 16, y - i, 32, 2);
    ctx.fillStyle = '#2c5a35'; roundedRect(x - 19, y - 32, 38, 7, 3);
    ctx.strokeStyle = '#eaf5ec'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y - 14, 6, 0.4, 5.9); ctx.stroke();
  }
  function drawSign(s) {
    ctx.fillStyle = '#6a5744'; ctx.fillRect(s.x - 2, s.y - 22, 4, 24);
    ctx.fillStyle = '#8a7050'; roundedRect(s.x - 26, s.y - 44, 52, 24, 4);
    ctx.fillStyle = '#fff8e6'; ctx.font = '700 13px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$JIMO', s.x, s.y - 31);
  }
  function drawCoin(c, t) {
    const y = c.y - 8 - Math.sin(t / 260 + c.bob) * 4; softShadow(c.x, c.y + 2, 9, 3, 0.18);
    ctx.save(); ctx.translate(c.x, y); const sx = Math.abs(Math.cos(t / 300 + c.bob)); ctx.scale(sx * 0.7 + 0.3, 1);
    ctx.fillStyle = '#ffd23f'; ellipse(0, 0, 10, 10); ctx.strokeStyle = '#e0a92b'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(0, 0, 10, 10, 0, 0, 6.283); ctx.stroke();
    ctx.fillStyle = '#7a5a12'; ctx.font = '700 12px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('J', 0, 1); ctx.restore();
  }
  function drawBerry(b, t) { const y = b.y - Math.sin(t / 320 + b.x) * 2; softShadow(b.x, b.y + 3, 7, 2.4, 0.16); ctx.fillStyle = '#d1466a'; ellipse(b.x - 2.5, y, 4.5, 4.5); ctx.fillStyle = '#e0577b'; ellipse(b.x + 2.5, y + 1, 4.5, 4.5); ctx.fillStyle = 'rgba(255,255,255,.5)'; ellipse(b.x - 3.5, y - 1.5, 1.2, 1.2); ctx.fillStyle = '#2f9e44'; ctx.fillRect(b.x - 0.6, y - 8, 1.2, 4); ellipse(b.x + 2, y - 7, 2.4, 1.4); }
  function drawGem(gm, t) {
    const y = gm.y - 7 - Math.sin(t / 300 + gm.spin) * 3; softShadow(gm.x, gm.y + 2, 8, 3, 0.18);
    ctx.save(); ctx.translate(gm.x, y);
    ctx.fillStyle = '#3fd0d8'; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(7, -1); ctx.lineTo(0, 9); ctx.lineTo(-7, -1); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7fe8ee'; ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(3, -1); ctx.lineTo(0, 9); ctx.lineTo(-3, -1); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#1f9aa2'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(-7, -1); ctx.lineTo(7, -1); ctx.stroke(); ctx.restore();
  }
  function drawTrashBag(o) { softShadow(o.x, o.y + 4, 11, 4, 0.16); ctx.fillStyle = '#3a3f45'; ellipse(o.x, o.y - 6, 11, 12); ctx.fillStyle = '#2b2f34'; ellipse(o.x - 3, o.y - 8, 4, 4); ctx.fillStyle = '#4a5057'; roundedRect(o.x - 4, o.y - 18, 8, 6, 2); }
  function drawDog(d, t) {
    ctx.save(); ctx.translate(d.x, d.y); softShadow(0, 2, 20, 6, 0.18); if (d.flip) ctx.scale(-1, 1);
    const sw = Math.sin(d.walk) * 3, scared = d.scared > t;
    ctx.fillStyle = '#3a2e24'; roundedRect(-14, -8 - sw, 6, 10, 2); roundedRect(8, -8 + sw, 6, 10, 2); roundedRect(-4, -8 + sw, 6, 10, 2);
    ctx.fillStyle = d.chase ? '#8a3a2a' : '#6a4b33'; ellipse(0, -16, 18, 12); ellipse(16, -20, 10, 9);
    ctx.fillStyle = '#3a2e24'; ellipse(20, -28, 4, 6);
    ctx.fillStyle = '#111'; ellipse(20, -21, 1.8, 2);
    ctx.fillStyle = '#1a1a1a'; ellipse(25, -19, 3, 2.5);
    ctx.strokeStyle = '#6a4b33'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-16, -18); ctx.quadraticCurveTo(-26, scared ? -10 : -22, scared ? -20 : -22, scared ? -14 : -30); ctx.stroke();
    ctx.restore();
    if (scared) { ctx.fillStyle = '#4f7cff'; ctx.font = '700 13px Fredoka'; ctx.textAlign = 'center'; ctx.fillText('?!', d.x, d.y - 40); }
    else if (d.chase) { ctx.fillStyle = '#e23b3b'; ctx.font = '700 15px Fredoka'; ctx.textAlign = 'center'; ctx.fillText('!', d.x, d.y - 40); }
  }
  function drawMomoHidden(m) {
    ctx.fillStyle = PAL_MOMO.ear; ellipse(m.x - 5, m.y - 6, 5, 6); ellipse(m.x + 5, m.y - 6, 5, 6);
    ctx.fillStyle = PAL_MOMO.mask; ellipse(m.x - 5, m.y - 7, 2.4, 3); ellipse(m.x + 5, m.y - 7, 2.4, 3);
    ctx.fillStyle = '#fff'; ellipse(m.x - 3, m.y - 2, 1.6, 1.8); ellipse(m.x + 3, m.y - 2, 1.6, 1.8);
    ctx.fillStyle = '#111'; ellipse(m.x - 3, m.y - 2, .8, 1); ellipse(m.x + 3, m.y - 2, .8, 1);
  }

  // ---- Input ---------------------------------------------------------------
  const keys = {}, dir = { up: false, down: false, left: false, right: false };
  let actEdge = false;
  window.addEventListener('keydown', (e) => { const k = e.key.toLowerCase(); if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault(); keys[k] = true; if (k === 'e' || k === ' ' || k === 'enter') actEdge = true; });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  function bindHold(btn, d) { const on = (e) => { e.preventDefault(); dir[d] = true; }, off = (e) => { e.preventDefault(); dir[d] = false; }; btn.addEventListener('touchstart', on, { passive: false }); btn.addEventListener('touchend', off); btn.addEventListener('touchcancel', off); btn.addEventListener('mousedown', on); btn.addEventListener('mouseup', off); btn.addEventListener('mouseleave', off); }
  document.querySelectorAll('.dpad button').forEach(b => bindHold(b, b.dataset.dir));
  el.actBtn.addEventListener('touchstart', (e) => { e.preventDefault(); actEdge = true; }, { passive: false });
  el.actBtn.addEventListener('mousedown', () => { actEdge = true; });
  if ('ontouchstart' in window) el.touch.classList.add('on');
  function readInput() { return { u: keys['w'] || keys['arrowup'] || dir.up, d: keys['s'] || keys['arrowdown'] || dir.down, l: keys['a'] || keys['arrowleft'] || dir.left, r: keys['d'] || keys['arrowright'] || dir.right }; }

  // ---- Collision -----------------------------------------------------------
  function solidAt(px, py) {
    if (px < 24 || py < 40 || px > WORLD_W - 24 || py > WORLD_H - 8) return true;
    if (world.waterHit(px, py, 4)) return true;
    for (const tr of world.trees) if (Math.hypot(px - tr.x, py - tr.y) < tr.r * 0.28) return true;
    for (const r of world.rocks) if (Math.hypot(px - r.x, py - (r.y + 2)) < r.r * 0.8) return true;
    for (const h of world.houses) if (px > h.x - 4 && px < h.x + h.w + 4 && py > h.y + h.h * 0.42 && py < h.y + h.h + 4) return true;
    if (px > bin.x - bin.solid.w / 2 && px < bin.x + bin.solid.w / 2 && py > bin.y - bin.solid.h && py < bin.y) return true;
    return false;
  }
  function canMove(px, py, w, h) { return !(solidAt(px - w / 2, py) || solidAt(px + w / 2, py) || solidAt(px - w / 2, py - h) || solidAt(px + w / 2, py - h)); }

  // ---- Quests / dialog -----------------------------------------------------
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function nearestInteractable() {
    let best = null, bestD = 62;
    for (const n of npcs) { const dd = dist(player, n); if (dd < bestD) { best = { kind: 'npc', ref: n }; bestD = dd; } }
    for (const d of dogs) { const dd = dist(player, d); if (dd < 66 && dd < bestD) { best = { kind: 'dog', ref: d }; bestD = dd; } }
    const db = Math.hypot(player.x - bin.x, player.y - (bin.y - 12));
    if (db < 66 && db < bestD) { best = { kind: 'bin', ref: bin }; bestD = db; }
    return best;
  }
  function say(who, lines, onEnd) { game.dialogQueue = lines.slice(); game.dialogWho = who; game.onDialogEnd = onEnd || null; advanceDialog(); }
  function advanceDialog() { if (game.dialogQueue.length === 0) { el.dialog.classList.remove('show'); const cb = game.onDialogEnd; game.onDialogEnd = null; if (cb) cb(); return; } el.dWho.textContent = game.dialogWho; el.dLine.textContent = game.dialogQueue.shift(); el.dialog.classList.add('show'); }
  function toast(msg) { game.toast = msg; game.toastT = game.t + 2600; }

  const COINS_GOAL = 12, BERRY_GOAL = 6;
  const QUESTS = {
    0: { name: 'Meet the Pack', obj: () => 'Talk to Rocky in the clearing.' },
    1: { name: 'Waddle & Collect', obj: () => `Collect JIMO coins — <b>${Math.min(game.coins, COINS_GOAL)}/${COINS_GOAL}</b>, then see Rocky.` },
    2: { name: 'Berry Run', obj: () => `Pick forest berries — <b>${game.berries}/${BERRY_GOAL}</b>, then see Rocky.` },
    3: { name: 'Clean the Meadow', obj: () => `Grab trash bags and dump them in the recycling bin. Carrying: <b>${player.carrying}</b>.` },
    4: { name: 'Chase Off the Hounds', obj: () => `Shoo the 3 dogs away (press E next to one) — <b>${dogs.filter(d => d.questShooed).length}/3</b>.` },
    5: { name: 'Find Momo', obj: () => momo.following ? 'Bring Momo back to Rocky.' : 'Search the NW woods for the lost cub Momo.' },
    6: { name: 'All done', obj: () => 'Adventure complete.' },
  };
  function updateHUD() { el.coin.textContent = game.coins; const q = QUESTS[game.stage]; if (q) { el.qName.textContent = q.name; el.qObj.innerHTML = (typeof q.obj === 'function') ? q.obj() : q.obj; } }

  function interact() {
    const near = nearestInteractable(); if (!near) return;
    if (near.kind === 'dog') { const d = near.ref; d.scared = game.t + 6000; d.chase = false; if (game.stage === 4) d.questShooed = true; toast('You hissed! The hound backs off.'); const ang = Math.atan2(d.y - player.y, d.x - player.x); d.x += Math.cos(ang) * 40; d.y += Math.sin(ang) * 40; updateHUD(); return; }
    if (near.kind === 'bin') {
      if (game.stage === 3 && player.carrying > 0) { const dumped = player.carrying; game.coins += dumped * 5; player.carrying = 0; say('You', [`Dumped ${dumped} trash bag(s). Recycled for ${dumped * 5} JIMO.`], () => { if (trash.every(x => x.got)) { game.stage = 4; toast('Meadow clean! Now deal with those hounds.'); } updateHUD(); }); }
      else say('Recycling Bin', ['A sturdy green bin. Bring trash bags here to recycle them.']);
      return;
    }
    const n = near.ref;
    if (n.name === 'Pip') { say('Pip', ['Pip the raccoon, at your service.', 'Those dogs are the Catcher\'s hounds — bad news for a short-spined hero.', 'Rocky hands out the quests. Find him by the clearing.']); return; }
    switch (game.stage) {
      case 0: say('Rocky', ['Well, waddle my whiskers — a hero with a short spine and a big heart.', 'The Trash Pack needs you, Jimothy.', `First job: collect ${COINS_GOAL} shiny JIMO coins around the world.`], () => { game.stage = 1; updateHUD(); }); break;
      case 1: if (game.coins >= COINS_GOAL) say('Rocky', ['Fastest waddler in the west!', `Now hop into the forest and pick me ${BERRY_GOAL} ripe berries.`], () => { game.stage = 2; updateHUD(); }); else say('Rocky', [`Not yet — ${game.coins}/${COINS_GOAL}. Keep waddling.`]); break;
      case 2: if (game.berries >= BERRY_GOAL) say('Rocky', ['Perfect, juicy ones.', 'The meadow is littered — collect the trash bags and dump them in the recycling bin.'], () => { game.stage = 3; updateHUD(); }); else say('Rocky', [`Only ${game.berries}/${BERRY_GOAL} berries. They grow among the trees.`]); break;
      case 3: say('Rocky', ['Grab the trash bags and take them to the green bin.']); break;
      case 4: if (dogs.every(d => d.questShooed)) say('Rocky', ['You chased off all three hounds! The Catcher won\'t be happy.', 'One last thing — little Momo wandered into the NW woods. Please find the cub.'], () => { game.stage = 5; updateHUD(); }); else say('Rocky', ['Shoo those hounds away — walk up and press E to hiss at them.']); break;
      case 5: if (momo.following) say('Rocky', ['MOMO! You found the little rascal.', 'The whole pack owes you, Jimothy. Short spine, biggest hero.'], () => { game.stage = 6; updateHUD(); winGame(); }); else say('Rocky', ['Momo is somewhere in the north-west woods. Please bring the cub home.']); break;
      default: say('Rocky', ['Thanks for everything, hero. Enjoy the adventure.']);
    }
  }
  function winGame() { game.running = false; el.winText.textContent = `You collected ${game.coins} JIMO, cleaned the meadow, chased off the Catcher's hounds and reunited the Trash Pack. Short spine, big adventure.`; el.win.classList.remove('hidden'); }

  // ---- Update --------------------------------------------------------------
  function update(t) {
    const inp = readInput();
    let vx = (inp.r ? 1 : 0) - (inp.l ? 1 : 0), vy = (inp.d ? 1 : 0) - (inp.u ? 1 : 0);
    player.moving = !!(vx || vy);
    if (vx || vy) {
      const len = Math.hypot(vx, vy) || 1; vx = vx / len * player.speed; vy = vy / len * player.speed;
      if (vx > 0) player.flip = false; else if (vx < 0) player.flip = true;   // face the way we move
      if (canMove(player.x + vx, player.y, player.w, player.h)) player.x += vx;
      if (canMove(player.x, player.y + vy, player.w, player.h)) player.y += vy;
      player.walk += 0.25;
    }

    for (let i = coins.length - 1; i >= 0; i--) { const c = coins[i]; if (Math.hypot(player.x - c.x, player.y - c.y) < 26) { coins.splice(i, 1); game.coins += 1; toast('+1 JIMO'); updateHUD(); } }
    for (let i = gems.length - 1; i >= 0; i--) { const gm = gems[i]; if (Math.hypot(player.x - gm.x, player.y - gm.y) < 26) { gems.splice(i, 1); game.coins += 10; toast('Gem! +10 JIMO'); updateHUD(); } }
    for (const b of berries) if (!b.got && Math.hypot(player.x - b.x, player.y - b.y) < 26) { b.got = true; game.berries += 1; game.coins += 2; toast('Berry picked (+2 JIMO)'); updateHUD(); }

    if (game.stage === 3) for (const tr of trash) if (!tr.got && Math.hypot(player.x - tr.x, player.y - tr.y) < 28) { tr.got = true; player.carrying += 1; updateHUD(); toast('Picked up a trash bag'); }

    if (game.stage === 5 && !momo.following && Math.hypot(player.x - momo.x, player.y - momo.y) < 42) { momo.following = true; updateHUD(); say('Momo', ['(happy chirp)', 'Momo waddles out and follows you. Take them to Rocky.']); }
    if (momo.following) { const tx = player.x - (player.flip ? -30 : 30), ty = player.y + 6; momo.x += (tx - momo.x) * 0.08; momo.y += (ty - momo.y) * 0.08; momo.flip = (tx < momo.x); if (player.moving) momo.walk += 0.2; }

    // Dogs — villains: patrol, chase, get shooed
    for (const d of dogs) {
      const scared = d.scared > t, dp = Math.hypot(player.x - d.x, player.y - d.y);
      if (scared) { const ang = Math.atan2(d.home.y - d.y, d.home.x - d.x); if (Math.hypot(d.home.x - d.x, d.home.y - d.y) > 6) { const nx = Math.cos(ang) * 2.4, ny = Math.sin(ang) * 2.4; if (canMove(d.x + nx, d.y, d.w, d.h)) d.x += nx; if (canMove(d.x, d.y + ny, d.w, d.h)) d.y += ny; d.flip = nx < 0; d.walk += 0.3; } d.chase = false; continue; }
      d.chase = dp < 170 && game.stage >= 1;
      if (d.chase) { const ang = Math.atan2(player.y - d.y, player.x - d.x), nx = Math.cos(ang) * 2.1, ny = Math.sin(ang) * 2.1; if (canMove(d.x + nx, d.y, d.w, d.h)) d.x += nx; if (canMove(d.x, d.y + ny, d.w, d.h)) d.y += ny; d.flip = nx < 0; d.walk += 0.3; if (dp < 26) spooked(); }
      else { const nx = d.x + d.dir * 1.1; if (Math.abs(nx - d.home.x) > 140 || !canMove(nx, d.y, d.w, d.h)) d.dir *= -1; else d.x = nx; d.flip = d.dir < 0; d.walk += 0.12; }
    }

    for (const bf of world.butterflies) { bf.phase += 0.03; bf.x += Math.cos(bf.phase * 1.3) * 0.5; bf.y += Math.sin(bf.phase) * 0.4; }
    game.t = t;
  }
  function spooked() {
    const lost = Math.min(game.coins, 3); game.coins -= lost; player.carrying = 0;
    player.x = world.spawn.x; player.y = world.spawn.y;
    for (const d of dogs) { d.x = d.home.x; d.y = d.home.y; d.chase = false; }
    updateHUD(); toast(`A hound caught you! Lost ${lost} JIMO.`);
  }

  // ---- Minimap -------------------------------------------------------------
  function drawMinimap() {
    const mw = 168, mh = mw * (WORLD_H / WORLD_W), ox = 14, oy = 58;
    const sx = mw / WORLD_W, sy = mh / WORLD_H;
    ctx.globalAlpha = 0.96; ctx.fillStyle = 'rgba(255,255,255,.92)'; roundedRect(ox - 4, oy - 4, mw + 8, mh + 8, 10);
    ctx.save(); roundedRect(ox, oy, mw, mh, 6); ctx.clip();
    ctx.fillStyle = '#8cc24a'; ctx.fillRect(ox, oy, mw, mh);
    for (const z of world.zones) { ctx.fillStyle = z.type === 'forest' ? 'rgba(60,140,50,.7)' : z.type === 'sand' ? 'rgba(230,205,140,.85)' : z.type === 'flower' ? 'rgba(244,160,200,.5)' : z.type === 'snow' ? 'rgba(255,255,255,.85)' : 'rgba(0,0,0,0)'; ctx.fillRect(ox + z.x * sx, oy + z.y * sy, z.w * sx, z.h * sy); }
    ctx.fillStyle = '#c8a86a'; for (const p of world.paths) ctx.fillRect(ox + p.x * sx, oy + p.y * sy, p.w * sx, p.h * sy);
    ctx.fillStyle = '#2f6d86'; for (const p of world.water) { ctx.beginPath(); ctx.ellipse(ox + p.x * sx, oy + p.y * sy, p.rx * sx, p.ry * sy, 0, 0, 6.283); ctx.fill(); }
    const dot = (x, y, col, r) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(ox + x * sx, oy + y * sy, r, 0, 6.283); ctx.fill(); };
    for (const c of coins) dot(c.x, c.y, '#e0a92b', 1.5);
    for (const gm of gems) dot(gm.x, gm.y, '#3fd0d8', 1.6);
    for (const b of berries) if (!b.got) dot(b.x, b.y, '#d1466a', 1.5);
    for (const n of npcs) { dot(n.x, n.y, '#2fa96b', 2.6); }
    for (const d of dogs) { dot(d.x, d.y, d.scared > game.t ? '#9aa4b2' : '#c33', 2.6); }
    if (momo.following || game.stage === 5) dot(momo.x, momo.y, '#a855f7', 2.4);
    // you
    ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#1b2430'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(ox + player.x * sx, oy + player.y * sy, 3.2, 0, 6.283); ctx.fill(); ctx.stroke();
    ctx.restore(); ctx.globalAlpha = 1;
    // legend
    const ly = oy + mh + 10, items = [['#ffd23f', 'You'], ['#2fa96b', 'Friend'], ['#c33', 'Dog'], ['#e0a92b', 'Coin'], ['#d1466a', 'Berry'], ['#3fd0d8', 'Gem']];
    ctx.fillStyle = 'rgba(255,255,255,.92)'; roundedRect(ox - 4, ly - 6, mw + 8, 40, 8);
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.font = '600 10px Fredoka, sans-serif';
    items.forEach((it, i) => { const cx = ox + 4 + (i % 3) * 56, cyy = ly + 4 + ((i / 3) | 0) * 16; ctx.fillStyle = it[0]; ctx.beginPath(); ctx.arc(cx + 3, cyy, 3.4, 0, 6.283); ctx.fill(); ctx.fillStyle = '#39434f'; ctx.fillText(it[1], cx + 10, cyy + 0.5); });
  }

  // ---- Render --------------------------------------------------------------
  const cam = { x: 0, y: 0 };
  function render(t) {
    resize();
    const vw = canvas.width / DPR, vh = canvas.height / DPR;
    cam.x = clamp(player.x - vw / 2, 0, Math.max(0, WORLD_W - vw));
    cam.y = clamp(player.y - vh / 2, 0, Math.max(0, WORLD_H - vh));
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.clearRect(0, 0, vw, vh);
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    const vx0 = cam.x, vy0 = cam.y, vx1 = cam.x + vw, vy1 = cam.y + vh;
    drawTerrain(vx0, vy0, vx1, vy1); drawPaths(); drawWater(t);
    for (const f of world.flowers) if (f.x > vx0 - 10 && f.x < vx1 + 10 && f.y > vy0 - 10 && f.y < vy1 + 10) drawFlower(f);
    for (const m of world.mushrooms) if (m.x > vx0 - 10 && m.x < vx1 + 10 && m.y > vy0 - 10 && m.y < vy1 + 10) drawMushroom(m);
    for (const c of coins) drawCoin(c, t);
    for (const gm of gems) drawGem(gm, t);
    for (const b of berries) if (!b.got) drawBerry(b, t);
    if (game.stage <= 3) for (const tr of trash) if (!tr.got) drawTrashBag(tr);

    const draws = [];
    const vis = (x, y, pad) => x > vx0 - pad && x < vx1 + pad && y > vy0 - pad && y < vy1 + pad;
    for (const b of world.bushes) if (vis(b.x, b.y, 40)) draws.push({ y: b.y, fn: () => drawBush(b) });
    for (const tr of world.trees) if (vis(tr.x, tr.y, 80)) draws.push({ y: tr.y, fn: () => drawTree(tr, t) });
    for (const r of world.rocks) if (vis(r.x, r.y, 50)) draws.push({ y: r.y, fn: () => drawRock(r) });
    for (const h of world.houses) if (vis(h.x + h.w / 2, h.y + h.h, 120)) draws.push({ y: h.y + h.h, fn: () => drawHouse(h) });
    draws.push({ y: bin.y, fn: () => drawBin(bin) });
    draws.push({ y: sign.y, fn: () => drawSign(sign) });
    for (const n of npcs) draws.push({ y: n.y, fn: () => drawRaccoon(n.x, n.y, n.pal, 1, n.walk + n.bob, n.flip, SPRITES.npc) });
    for (const o of others) draws.push({ y: o.y, fn: () => drawRaccoon(o.x, o.y, o.pal || PAL_PIP, 1, o.walk || 0, o.flip, SPRITES.npc) });
    if (game.stage === 5 && !momo.following) draws.push({ y: momo.y, fn: () => drawMomoHidden(momo) });
    if (momo.following) draws.push({ y: momo.y, fn: () => drawRaccoon(momo.x, momo.y, PAL_MOMO, 0.72, momo.walk, momo.flip, SPRITES.momo) });
    for (const d of dogs) draws.push({ y: d.y, fn: () => drawDog(d, t) });
    draws.push({ y: player.y, fn: () => drawRaccoon(player.x, player.y, player.pal, 1, player.walk, player.flip, SPRITES.player) });
    draws.sort((a, b) => a.y - b.y); for (const d of draws) d.fn();

    for (const bf of world.butterflies) if (vis(bf.x, bf.y, 10)) drawButterfly(bf, t);

    const near = nearestInteractable();
    if (near && !el.dialog.classList.contains('show')) {
      const r = near.ref, bx = r.x, by = (near.kind === 'bin' ? r.y - 44 : r.y - 58);
      ctx.fillStyle = 'rgba(27,36,48,.92)'; roundedRect(bx - 13, by - 13, 26, 22, 6);
      ctx.fillStyle = '#ffd23f'; ctx.font = '700 13px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('E', bx, by - 1);
    }
    ctx.restore();

    // screen-space UI: minimap + toast
    if (game.running) drawMinimap();
    if (game.toast && game.toastT > t) { ctx.globalAlpha = Math.min(1, (game.toastT - t) / 400); ctx.fillStyle = 'rgba(27,36,48,.9)'; ctx.font = '600 15px Fredoka, sans-serif'; ctx.textAlign = 'center'; const w = ctx.measureText(game.toast).width + 32; roundedRect(vw / 2 - w / 2, vh - 96, w, 34, 10); ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(game.toast, vw / 2, vh - 79); ctx.globalAlpha = 1; }
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  let DPR = 1;
  function resize() { DPR = Math.min(window.devicePixelRatio || 1, 2); const w = window.innerWidth, h = window.innerHeight; if (canvas.width !== Math.floor(w * DPR) || canvas.height !== Math.floor(h * DPR)) { canvas.width = Math.floor(w * DPR); canvas.height = Math.floor(h * DPR); } }
  window.addEventListener('resize', resize);

  function frame(t) { if (game && game.running) update(t || 0); render(t || 0); if (actEdge) { actEdge = false; if (el.dialog.classList.contains('show')) advanceDialog(); else if (game.running) interact(); } requestAnimationFrame(frame); }

  function start() { resetGame(); game.running = true; el.intro.classList.add('hidden'); el.win.classList.add('hidden'); }
  el.playBtn.addEventListener('click', start);
  el.replayBtn.addEventListener('click', start);
  resetGame(); game.running = false;
  requestAnimationFrame(frame);
  window.JIMOTHY = { SPRITES, loadImg, SKINS, others, dbg: () => ({ player, npcs, dogs, stage: game.stage, coins: game.coins, berries: game.berries }) };
})();
