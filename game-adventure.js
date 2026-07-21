/* ============================================================================
   JIMOTHY'S ADVENTURES — top-down 2D adventure
   Vanilla canvas, no dependencies, no image assets required.

   The world (biomes, blocky terrain, trees, rocks, flowers, water, paths and
   depth-sorted rendering) is adapted from the "pokefight" open-world engine.

   >>> WANT PAINTED SPRITE ART? <<<
   Drop sprite PNGs into /assets and set them in SPRITES below; when a sprite
   Image is present it is used instead of the built-in vector drawing.
   ============================================================================ */
(function () {
  'use strict';

  const canvas = document.getElementById('world');
  const ctx = canvas.getContext('2d');

  // ---- Optional real-art hook (leave null to use built-in vector art) ------
  const SPRITES = { player: null, npc: null, momo: null, dog: null };
  function loadImg(src) { const i = new Image(); i.src = src; return i; }

  // ---- Seeded RNG so the world layout is stable across reloads -------------
  let _seed = 1337;
  function rng() { _seed = (Math.imul(_seed, 1103515245) + 12345) & 0x7fffffff; return _seed / 0x7fffffff; }
  const rand = (a, b) => a + rng() * (b - a);

  // ---- World constants -----------------------------------------------------
  const TILE = 48;
  const WORLD_W = 2640, WORLD_H = 1800;

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
  };

  // ---- World data ----------------------------------------------------------
  let world, player, game;

  function inRect(x, y, r, pad) { return x > r.x - pad && x < r.x + r.w + pad && y > r.y - pad && y < r.y + r.h + pad; }

  function buildWorld() {
    _seed = 1337;
    // Biome zones — last match wins. Base grass covers everything.
    const zones = [
      { x: 0, y: 0, w: WORLD_W, h: WORLD_H, type: 'grass' },
      { x: 0, y: 0, w: 1040, h: 720, type: 'forest' },        // NW forest
      { x: 1900, y: 0, w: 740, h: 560, type: 'snow' },        // NE snow
      { x: 1620, y: 540, w: 1020, h: 620, type: 'sand' },     // E beach (around pond)
      { x: 720, y: 1180, w: 1920, h: 620, type: 'flower' },   // S meadow
      { x: 0, y: 1180, w: 720, h: 620, type: 'flower' },      // SW meadow
      { x: 1120, y: 780, w: 900, h: 360, type: 'grass' },     // central clearing
    ];
    const zoneAt = (x, y) => { let t = 'grass'; for (const z of zones) if (x > z.x && x < z.x + z.w && y > z.y && y < z.y + z.h) t = z.type; return t; };

    // Water ponds (blocking ellipses)
    const water = [
      { x: 2060, y: 820, rx: 220, ry: 150 },  // beach pond (east)
      { x: 1360, y: 300, rx: 170, ry: 120 },  // north pond
      { x: 780, y: 1470, rx: 210, ry: 140 },  // south meadow pond
    ];
    const waterHit = (x, y, pad) => water.some(p => ((x - p.x) / (p.rx + pad)) ** 2 + ((y - p.y) / (p.ry + pad)) ** 2 < 1);

    // Dirt path network
    const paths = [
      { x: 1200, y: 200, w: 84, h: 1420 },   // vertical main road
      { x: 240, y: 860, w: 2160, h: 74 },    // horizontal main road
      { x: 900, y: 1180, w: 74, h: 360 },    // spur south into meadow
    ];
    const onPath = (x, y, pad = 16) => paths.some(p => inRect(x, y, p, pad));

    const spawn = { x: 1242, y: 897 };
    const nearSpawn = (x, y, pad) => Math.hypot(x - spawn.x, y - spawn.y) < pad;

    // Houses (blocky) — placed first so decorations avoid them
    const houses = [
      { x: 560, y: 470, w: 150, h: 120, roof: '#c76b3f' },   // forest cabin
      { x: 1820, y: 1230, w: 165, h: 128, roof: '#5b8fb0' }, // meadow house
    ];
    const nearHouse = (x, y, pad) => houses.some(h => inRect(x, y, h, pad));

    // Trees — dense in forest, scattered elsewhere
    const trees = [];
    for (let i = 0; i < 260; i++) {
      let x = 0, y = 0, ok = false, tries = 0;
      do {
        x = rand(50, WORLD_W - 50); y = rand(50, WORLD_H - 50); tries++;
        const inForest = zoneAt(x, y) === 'forest';
        const keep = inForest ? rng() < 0.9 : rng() < 0.22;
        ok = keep && !nearSpawn(x, y, 190) && !waterHit(x, y, 44) && !onPath(x, y, 20) && !nearHouse(x, y, 54) && zoneAt(x, y) !== 'snow';
      } while (!ok && tries < 24);
      if (ok) trees.push({ x, y, r: rand(24, 36) });
    }
    // A few snowy pines in the snow zone
    for (let i = 0; i < 22; i++) {
      const x = rand(1920, 2600), y = rand(40, 520);
      if (!waterHit(x, y, 30) && !onPath(x, y, 16)) trees.push({ x, y, r: rand(22, 32), snow: true });
    }

    // Rocks
    const rocks = [];
    for (let i = 0; i < 70; i++) {
      let x = rand(70, WORLD_W - 70), y = rand(70, WORLD_H - 70), tries = 0;
      while ((nearSpawn(x, y, 170) || waterHit(x, y, 30) || onPath(x, y, 18) || nearHouse(x, y, 44)) && tries < 18) { x = rand(70, WORLD_W - 70); y = rand(70, WORLD_H - 70); tries++; }
      rocks.push({ x, y, r: rand(14, 24) });
    }

    // Bushes
    const bushes = [];
    for (let i = 0; i < 150; i++) {
      const x = rand(40, WORLD_W - 40), y = rand(40, WORLD_H - 40);
      if (!waterHit(x, y, 18) && !onPath(x, y, 10) && zoneAt(x, y) !== 'snow' && !nearHouse(x, y, 20)) bushes.push({ x, y, r: rand(13, 20) });
    }

    // Flowers (dense in meadows)
    const flowerColors = ['#f472b6', '#fbbf24', '#60a5fa', '#f87171', '#a78bfa', '#ffffff'];
    const flowers = [];
    for (let i = 0; i < 900; i++) {
      const x = rand(16, WORLD_W - 16), y = rand(16, WORLD_H - 16);
      const z = zoneAt(x, y);
      if (z === 'snow' || z === 'sand') continue;
      if (z !== 'flower' && rng() < 0.55) continue;
      if (!waterHit(x, y, 8) && !onPath(x, y, 6)) flowers.push({ x, y, c: flowerColors[(rng() * flowerColors.length) | 0] });
    }

    // Mushrooms (forest)
    const mushroomColors = ['#ef4444', '#a855f7', '#f59e0b'];
    const mushrooms = [];
    for (let i = 0; i < 70; i++) {
      const x = rand(50, WORLD_W - 50), y = rand(50, WORLD_H - 50);
      if (zoneAt(x, y) === 'forest' && !waterHit(x, y, 16)) mushrooms.push({ x, y, c: mushroomColors[(rng() * mushroomColors.length) | 0] });
    }

    // Lilies on ponds
    const lilies = [];
    water.forEach(p => { const n = 3 + ((rng() * 3) | 0); for (let i = 0; i < n; i++) { const a = rng() * 6.283, rr = rng() * 0.7; lilies.push({ x: p.x + Math.cos(a) * p.rx * rr, y: p.y + Math.sin(a) * p.ry * rr, c: rng() < 0.5 ? '#f472b6' : '#ffffff' }); } });

    // Butterflies over meadows
    const butterflies = [];
    const flutter = ['#f472b6', '#fbbf24', '#60a5fa', '#a78bfa'];
    for (let i = 0; i < 26; i++) { const x = rand(120, WORLD_W - 120), y = rand(120, WORLD_H - 120); butterflies.push({ x, y, vx: 0, vy: 0, phase: rng() * 6.28, c: flutter[(rng() * flutter.length) | 0] }); }

    return { zones, zoneAt, water, waterHit, paths, spawn, houses, trees, rocks, bushes, flowers, mushrooms, lilies, butterflies };
  }

  // ---- Reset / new game ----------------------------------------------------
  function resetGame() {
    world = buildWorld();

    player = { x: world.spawn.x, y: world.spawn.y, w: 34, h: 26, speed: 2.7, flip: false, walk: 0, moving: false, carrying: 0 };

    npcs = [
      { name: 'Rocky', x: world.spawn.x + 130, y: world.spawn.y - 150, flip: false, walk: 0, palette: PAL_ROCKY, bob: 0 },
      { name: 'Pip', x: 620, y: 1360, flip: true, walk: 0, palette: PAL_PIP, bob: 1.5 },
    ];

    // Bin near the spawn clearing
    bin = { x: world.spawn.x - 150, y: world.spawn.y - 120, solid: { w: 32, h: 28 } };
    // Sign near spawn
    sign = { x: world.spawn.x - 40, y: world.spawn.y + 40 };

    // Coins along open ground / paths
    coins = [];
    [[1242, 640], [1242, 1180], [980, 900], [1520, 900], [1242, 1360],
     [700, 980], [1700, 980], [1080, 700], [1440, 700], [860, 1320],
     [1640, 1300], [1120, 1040]].forEach(([x, y]) => coins.push({ x, y, got: false, bob: rng() * 6 }));

    // Trash near the forest/clearing edge
    trash = [];
    [[1060, 820], [1140, 760], [980, 800]].forEach(([x, y]) => trash.push({ x, y, got: false }));

    // Momo hidden in the NW forest
    momo = { x: 220, y: 230, found: false, following: false, flip: true, walk: 0 };

    // Dog patrols the eastern grass
    dog = { x: 1740, y: 900, home: { x: 1740, y: 900 }, w: 40, h: 26, dir: 1, flip: false, walk: 0, chase: false };

    game = { coins: 0, stage: 0, running: false, dialogQueue: [], onDialogEnd: null, t: 0 };
    updateHUD();
  }
  let npcs, coins, trash, momo, dog, bin, sign;

  // ---- Palettes ------------------------------------------------------------
  const PAL_PLAYER = { body: '#7f848c', body2: '#9aa0a8', belly: '#d9d6cf', mask: '#1d1d21', eyering: '#efece5', leg: '#26262b', ear: '#6c7178', tail: '#7f848c', ring: '#232327', nose: '#141416' };
  const PAL_ROCKY = { ...PAL_PLAYER, body: '#8b7d6b', body2: '#a89a86', belly: '#e2d8c6', ear: '#766a5a', tail: '#8b7d6b' };
  const PAL_PIP = { ...PAL_PLAYER, body: '#6b7f7a', body2: '#87a099', belly: '#d3ddd6', ear: '#5b6c68', tail: '#6b7f7a' };
  const PAL_MOMO = { ...PAL_PLAYER, body: '#9298a0', body2: '#adb3ba', belly: '#e6e3dc' };

  // ---- helpers -------------------------------------------------------------
  function ellipse(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
  function roundedRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.fill();
  }
  function softShadow(cx, by, rx, ry, a) { ctx.fillStyle = `rgba(15,23,42,${a || 0.18})`; ctx.beginPath(); ctx.ellipse(cx, by, rx, ry, 0, 0, 6.283); ctx.fill(); }

  // ---- Cartoon raccoon painter (Jimothy & friends) -------------------------
  function drawRaccoon(x, y, pal, scale, walk, flip, sprite) {
    ctx.save();
    ctx.translate(x, y);
    softShadow(0, 2, 20 * scale, 7 * scale, 0.16);
    if (flip) ctx.scale(-1, 1);
    ctx.scale(scale, scale);

    if (sprite && sprite.complete && sprite.naturalWidth) {
      const w = 60, h = 56; ctx.drawImage(sprite, -w / 2, -h, w, h); ctx.restore(); return;
    }

    const bob = Math.sin(walk) * 1.4, legSwing = Math.sin(walk) * 3;

    // tail
    ctx.save();
    ctx.translate(-16, -20 + bob); ctx.rotate(-0.5);
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(-i * 7, -i * 3, 9 - i * 0.6, 7 - i * 0.4, 0, 0, Math.PI * 2); ctx.fillStyle = (i % 2 === 0) ? pal.tail : pal.ring; ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(-35, -15, 5, 4, 0, 0, Math.PI * 2); ctx.fillStyle = pal.ring; ctx.fill();
    ctx.restore();

    // legs
    ctx.fillStyle = pal.leg;
    roundedRect(-13, -10 - legSwing, 8, 12, 3); roundedRect(6, -10 + legSwing, 8, 12, 3);
    roundedRect(-8, -8 + legSwing, 8, 11, 3); roundedRect(2, -8 - legSwing, 8, 11, 3);

    ctx.translate(0, bob);

    // body
    const g = ctx.createRadialGradient(-4, -26, 4, 0, -22, 26);
    g.addColorStop(0, pal.body2); g.addColorStop(1, pal.body);
    ctx.fillStyle = g; ellipse(0, -22, 22, 18);
    ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = pal.belly; ellipse(0, -13, 12, 9);

    // ears
    ctx.fillStyle = pal.ear; ellipse(-11, -30, 6, 7); ellipse(11, -30, 6, 7);
    ctx.fillStyle = pal.mask; ellipse(-11, -31, 3.2, 4); ellipse(11, -31, 3.2, 4);

    // head
    ctx.fillStyle = pal.body2; ellipse(0, -20, 15, 13);
    ctx.fillStyle = pal.belly; ellipse(0, -15, 9, 8);
    // mask
    ctx.fillStyle = pal.mask;
    ctx.beginPath(); ctx.ellipse(-7, -22, 6.5, 6, 0.25, 0, Math.PI * 2); ctx.ellipse(7, -22, 6.5, 6, -0.25, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -24, 4, 3, 0, 0, Math.PI * 2); ctx.fill();
    // eyes
    ctx.fillStyle = pal.eyering; ellipse(-6.5, -22, 3.6, 3.4); ellipse(6.5, -22, 3.6, 3.4);
    ctx.fillStyle = '#111'; ellipse(-6, -22, 1.9, 2.1); ellipse(7, -22, 1.9, 2.1);
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ellipse(-6.6, -22.8, .7, .7); ellipse(6.4, -22.8, .7, .7);
    // nose + mouth
    ctx.fillStyle = pal.nose; ellipse(0, -14, 2.6, 2);
    ctx.strokeStyle = pal.nose; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -12.5); ctx.quadraticCurveTo(-2.5, -10.5, -4, -11.5);
    ctx.moveTo(0, -12.5); ctx.quadraticCurveTo(2.5, -10.5, 4, -11.5); ctx.stroke();

    ctx.restore();
  }

  // ---- Terrain (blocky, grainy, feathered biome edges) ---------------------
  function palette(type) {
    return type === 'sand' ? ['#e3cd8e', '#efdca6', '#d2bb78']
      : type === 'snow' ? ['#eaf1f6', '#ffffff', '#d6e2ec']
      : type === 'forest' ? ['#4f8a2f', '#5d9c39', '#427a27']
      : type === 'flower' ? ['#7bb33e', '#8fc94e', '#6aa033']
      : ['#79ad3b', '#8cc24a', '#6b9c2f'];
  }
  function drawTerrain(vx0, vy0, vx1, vy1) {
    const CELL = 8, per = TILE / CELL;
    const zoneAt = world.zoneAt;
    const sx = Math.floor(vx0 / TILE) * TILE, sy = Math.floor(vy0 / TILE) * TILE;
    for (let gx = sx; gx < vx1 + TILE; gx += TILE) {
      for (let gy = sy; gy < vy1 + TILE; gy += TILE) {
        const cx = gx + TILE / 2, cy = gy + TILE / 2;
        const type = zoneAt(cx, cy);
        const [base, light, dark] = palette(type);
        ctx.fillStyle = base; ctx.fillRect(gx, gy, TILE, TILE);
        let h = (Math.imul(gx, 73856093) ^ Math.imul(gy, 19349663)) >>> 0;
        for (let i = 0; i < 7; i++) {
          h = (Math.imul(h, 1103515245) + 12345) >>> 0; const ox = (h % per) * CELL;
          h = (Math.imul(h, 1103515245) + 12345) >>> 0; const oy = (h % per) * CELL;
          ctx.fillStyle = (i & 1) ? dark : light; ctx.fillRect(gx + ox, gy + oy, CELL, CELL);
        }
        if (type === 'flower' && (h & 7) === 0) { ctx.fillStyle = (h & 8) ? '#f9a8d4' : '#fde047'; ctx.fillRect(gx + 16, gy + 20, 6, 6); }
        const feather = (nx, ny, side) => {
          const nt = zoneAt(nx, ny); if (nt === type) return;
          ctx.fillStyle = palette(nt)[0];
          for (let k = 0; k < per; k++) { if ((k & 1) !== 0) continue;
            if (side === 'L') ctx.fillRect(gx, gy + k * CELL, CELL, CELL);
            else if (side === 'R') ctx.fillRect(gx + TILE - CELL, gy + k * CELL, CELL, CELL);
            else if (side === 'T') ctx.fillRect(gx + k * CELL, gy, CELL, CELL);
            else ctx.fillRect(gx + k * CELL, gy + TILE - CELL, CELL, CELL); }
        };
        feather(cx - TILE, cy, 'L'); feather(cx + TILE, cy, 'R'); feather(cx, cy - TILE, 'T'); feather(cx, cy + TILE, 'B');
        ctx.strokeStyle = 'rgba(0,0,0,0.06)'; ctx.lineWidth = 1; ctx.strokeRect(gx + 0.5, gy + 0.5, TILE, TILE);
      }
    }
  }

  function drawPaths() {
    for (const p of world.paths) {
      ctx.fillStyle = '#c8a86a'; ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = '#b9975a';
      for (let gx = p.x; gx < p.x + p.w; gx += 16) for (let gy = p.y; gy < p.y + p.h; gy += 16) {
        const hh = (Math.imul(gx, 374761393) ^ Math.imul(gy, 668265263)) >>> 0;
        if ((hh & 3) === 0) ctx.fillRect(gx, gy, 8, 8);
      }
    }
  }

  function drawWater(t) {
    for (const p of world.water) {
      ctx.fillStyle = '#2f6d86'; ellipse(p.x, p.y, p.rx, p.ry);
      ctx.fillStyle = '#3f89a6'; ellipse(p.x, p.y - 4, p.rx * 0.86, p.ry * 0.8);
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; ctx.lineWidth = 2;
      for (let i = 1; i <= 2; i++) { ctx.beginPath(); ctx.ellipse(p.x, p.y + Math.sin(t / 500 + i) * 4, p.rx * (0.4 + i * 0.22), p.ry * (0.4 + i * 0.22), 0, 0, 6.283); ctx.stroke(); }
    }
    for (const li of world.lilies) { const bob = Math.sin(t / 500 + li.x) * 1.2; ctx.fillStyle = '#2f9e44'; ctx.beginPath(); ctx.ellipse(li.x, li.y + bob, 9, 7, 0.4, 0, 6.283); ctx.fill(); ctx.fillStyle = li.c; ellipse(li.x, li.y + bob - 1, 3.2, 3.2); }
  }

  function drawFlower(f) { ctx.fillStyle = '#2f9e44'; ctx.fillRect(f.x - 0.6, f.y, 1.2, 5); ctx.fillStyle = f.c; for (let i = 0; i < 4; i++) { const a = i * 1.57; ellipse(f.x + Math.cos(a) * 2.4, f.y + Math.sin(a) * 2.4, 1.8, 1.8); } ctx.fillStyle = '#fde047'; ellipse(f.x, f.y, 1.4, 1.4); }
  function drawMushroom(m) { softShadow(m.x, m.y + 5, 6, 2.2, 0.15); ctx.fillStyle = '#f8fafc'; ctx.fillRect(m.x - 2, m.y - 1, 4, 6); ctx.fillStyle = m.c; ctx.beginPath(); ctx.arc(m.x, m.y - 1, 6, Math.PI, 0); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ellipse(m.x - 2, m.y - 3, 1.3, 1.3); ellipse(m.x + 2.5, m.y - 1.5, 1, 1); }
  function drawBush(b) { softShadow(b.x, b.y + b.r * 0.5, b.r, b.r * 0.4, 0.12); ctx.fillStyle = '#3f9142'; ctx.beginPath(); ctx.arc(b.x - b.r * 0.5, b.y, b.r * 0.6, 0, 6.283); ctx.arc(b.x + b.r * 0.5, b.y, b.r * 0.6, 0, 6.283); ctx.arc(b.x, b.y - b.r * 0.3, b.r * 0.7, 0, 6.283); ctx.fill(); ctx.fillStyle = '#4cae4f'; ellipse(b.x - b.r * 0.2, b.y - b.r * 0.2, b.r * 0.35, b.r * 0.35); }
  function drawButterfly(bf, t) { const flap = Math.abs(Math.sin(t / 90 + bf.phase)); ctx.fillStyle = bf.c; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.ellipse(bf.x - 3, bf.y, 3.4 * flap + 1, 4, -0.5, 0, 6.283); ctx.fill(); ctx.beginPath(); ctx.ellipse(bf.x + 3, bf.y, 3.4 * flap + 1, 4, 0.5, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; ctx.fillStyle = '#0f172a'; ctx.fillRect(bf.x - 0.6, bf.y - 3, 1.2, 6); }

  function drawTree(tr, t) {
    const sway = Math.round(Math.sin(t / 900 + tr.x) * 1.5);
    softShadow(tr.x, tr.y + tr.r * 0.42, tr.r * 0.95, tr.r * 0.34, 0.2);
    ctx.fillStyle = '#6b4a2a'; ctx.fillRect(tr.x - 5, tr.y - tr.r * 0.5, 10, tr.r);
    ctx.fillStyle = '#7c5836'; ctx.fillRect(tr.x - 5, tr.y - tr.r * 0.5, 4, tr.r);
    const s = Math.round(tr.r * 0.78), cyl = tr.y - tr.r * 0.85;
    if (tr.snow) {
      ctx.fillStyle = '#2f6b3a'; ctx.beginPath(); ctx.moveTo(tr.x + sway, cyl - s * 1.7); ctx.lineTo(tr.x - s + sway, cyl + s * 0.6); ctx.lineTo(tr.x + s + sway, cyl + s * 0.6); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#eaf1f6'; ctx.beginPath(); ctx.moveTo(tr.x + sway, cyl - s * 1.7); ctx.lineTo(tr.x - s * 0.5 + sway, cyl - s * 0.4); ctx.lineTo(tr.x + s * 0.5 + sway, cyl - s * 0.4); ctx.closePath(); ctx.fill();
      return;
    }
    ctx.fillStyle = '#3f8f2f'; ctx.fillRect(tr.x - s + sway, cyl - s, s * 2, s * 2);
    ctx.fillStyle = '#4ea33a'; ctx.fillRect(tr.x - s * 0.6 + sway, cyl - s * 1.5, s * 1.2, s * 1.2);
    ctx.fillStyle = '#357a26'; ctx.fillRect(tr.x - s + 5 + sway, cyl - s + 5, 7, 7); ctx.fillRect(tr.x + s * 0.3 + sway, cyl + s * 0.2, 7, 7);
    ctx.fillStyle = '#5cb343'; ctx.fillRect(tr.x - 3 + sway, cyl - s * 1.2, 7, 7); ctx.fillRect(tr.x + s * 0.4 + sway, cyl - s * 0.7, 6, 6);
    ctx.strokeStyle = 'rgba(20,70,25,0.4)'; ctx.lineWidth = 1.5; ctx.strokeRect(tr.x - s + sway, cyl - s, s * 2, s * 2);
  }
  function drawRock(r) {
    const s = Math.round(r.r * 1.1), top = r.y - s * 0.7, h = s * 1.4;
    softShadow(r.x, r.y + s * 0.55, s * 1.05, s * 0.36, 0.18);
    ctx.fillStyle = '#8a8f96'; ctx.fillRect(r.x - s, top, s * 2, h);
    ctx.fillStyle = '#a4a9b0'; ctx.fillRect(r.x - s + 4, top + 4, s * 0.85, h * 0.4);
    ctx.fillStyle = '#6f757c'; ctx.fillRect(r.x + s * 0.2, r.y, s * 0.45, h * 0.35);
    ctx.strokeStyle = '#5b6066'; ctx.lineWidth = 1.5; ctx.strokeRect(r.x - s, top, s * 2, h);
  }
  function blockFace(x, y, w, h, base, dark, light) {
    const T = 14;
    for (let gx = x; gx < x + w; gx += T) for (let gy = y; gy < y + h; gy += T) {
      const bw = Math.min(T, x + w - gx), bh = Math.min(T, y + h - gy);
      const hh = (Math.imul(Math.round(gx), 374761393) ^ Math.imul(Math.round(gy), 668265263)) >>> 0;
      ctx.fillStyle = (hh & 3) === 0 ? dark : (hh & 1) ? base : light;
      ctx.fillRect(Math.round(gx), Math.round(gy), Math.ceil(bw), Math.ceil(bh));
    }
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h);
  }
  function shadeRoof(hex, f) { const n = parseInt(hex.slice(1), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; const c = v => Math.max(0, Math.min(255, Math.round(v * f))); return `rgb(${c(r)},${c(g)},${c(b)})`; }
  function drawHouse(h) {
    softShadow(h.x + h.w / 2, h.y + h.h + 4, h.w * 0.6, 10, 0.2);
    const roofH = h.h * 0.5, wallY = h.y + roofH, wallH = h.h - roofH;
    blockFace(h.x, h.y, h.w, roofH, h.roof, shadeRoof(h.roof, 0.8), shadeRoof(h.roof, 1.15));
    blockFace(h.x, wallY, h.w, wallH, '#eef2f6', '#cbd5e1', '#ffffff');
    ctx.fillStyle = '#5b3f24'; roundedRect(h.x + h.w / 2 - 13, wallY + wallH - 30, 26, 30, 3);
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(h.x + 14, wallY + 12, 16, 16); ctx.fillRect(h.x + h.w - 30, wallY + 12, 16, 16);
    ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 1.5; ctx.strokeRect(h.x + 14, wallY + 12, 16, 16); ctx.strokeRect(h.x + h.w - 30, wallY + 12, 16, 16);
  }
  function drawBin(b) {
    const x = b.x, y = b.y; softShadow(x, y + 4, 20, 6, 0.2);
    ctx.fillStyle = '#3f7d4a'; roundedRect(x - 16, y - 28, 32, 30, 5);
    ctx.fillStyle = '#356b40'; for (let i = 6; i < 28; i += 7) ctx.fillRect(x - 16, y - i, 32, 2);
    ctx.fillStyle = '#2c5a35'; roundedRect(x - 19, y - 32, 38, 7, 3);
    ctx.strokeStyle = '#eaf5ec'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y - 14, 6, 0.4, 5.9); ctx.stroke();
  }
  function drawSign(s) {
    ctx.fillStyle = '#6a5744'; ctx.fillRect(s.x - 2, s.y - 22, 4, 24);
    ctx.fillStyle = '#8a7050'; roundedRect(s.x - 26, s.y - 44, 52, 24, 4);
    ctx.strokeStyle = '#5b3f24'; ctx.lineWidth = 2; ctx.strokeRect(s.x - 26, s.y - 44, 52, 24);
    ctx.fillStyle = '#fff8e6'; ctx.font = '700 13px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('$JIMO', s.x, s.y - 31);
  }
  function drawCoin(c, t) {
    const y = c.y - 8 - Math.sin(t / 260 + c.bob) * 4;
    softShadow(c.x, c.y + 2, 9, 3, 0.18);
    ctx.save(); ctx.translate(c.x, y); const sx = Math.abs(Math.cos(t / 300 + c.bob));
    ctx.scale(sx * 0.7 + 0.3, 1);
    ctx.fillStyle = '#ffd23f'; ellipse(0, 0, 10, 10);
    ctx.strokeStyle = '#e0a92b'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(0, 0, 10, 10, 0, 0, 6.283); ctx.stroke();
    ctx.fillStyle = '#7a5a12'; ctx.font = '700 12px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('J', 0, 1);
    ctx.restore();
  }
  function drawTrashBag(o) { softShadow(o.x, o.y + 4, 11, 4, 0.16); ctx.fillStyle = '#3a3f45'; ellipse(o.x, o.y - 6, 11, 12); ctx.fillStyle = '#2b2f34'; ellipse(o.x - 3, o.y - 8, 4, 4); ctx.fillStyle = '#4a5057'; roundedRect(o.x - 4, o.y - 18, 8, 6, 2); }
  function drawDog(d) {
    ctx.save(); ctx.translate(d.x, d.y); softShadow(0, 2, 20, 6, 0.18); if (d.flip) ctx.scale(-1, 1);
    const sw = Math.sin(d.walk) * 3;
    ctx.fillStyle = '#3a2e24'; roundedRect(-14, -8 - sw, 6, 10, 2); roundedRect(8, -8 + sw, 6, 10, 2); roundedRect(-4, -8 + sw, 6, 10, 2);
    ctx.fillStyle = d.chase ? '#7a4a34' : '#6a4b33'; ellipse(0, -16, 18, 12); ellipse(16, -20, 10, 9);
    ctx.fillStyle = '#3a2e24'; ellipse(20, -28, 4, 6);
    ctx.fillStyle = '#111'; ellipse(20, -21, 1.8, 2);
    ctx.fillStyle = '#1a1a1a'; ellipse(25, -19, 3, 2.5);
    ctx.strokeStyle = '#6a4b33'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-16, -18); ctx.quadraticCurveTo(-26, -22, -22, -30); ctx.stroke();
    if (d.chase) { ctx.fillStyle = '#e23b3b'; ctx.font = '700 15px Fredoka'; ctx.textAlign = 'center'; ctx.fillText('!', 16, -36); }
    ctx.restore();
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
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    keys[k] = true; if (k === 'e' || k === ' ' || k === 'enter') actEdge = true;
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });
  function bindHold(btn, d) {
    const on = (e) => { e.preventDefault(); dir[d] = true; }, off = (e) => { e.preventDefault(); dir[d] = false; };
    btn.addEventListener('touchstart', on, { passive: false }); btn.addEventListener('touchend', off); btn.addEventListener('touchcancel', off);
    btn.addEventListener('mousedown', on); btn.addEventListener('mouseup', off); btn.addEventListener('mouseleave', off);
  }
  document.querySelectorAll('.dpad button').forEach(b => bindHold(b, b.dataset.dir));
  el.actBtn.addEventListener('touchstart', (e) => { e.preventDefault(); actEdge = true; }, { passive: false });
  el.actBtn.addEventListener('mousedown', () => { actEdge = true; });
  if ('ontouchstart' in window) el.touch.classList.add('on');
  function readInput() {
    return {
      u: keys['w'] || keys['arrowup'] || dir.up, d: keys['s'] || keys['arrowdown'] || dir.down,
      l: keys['a'] || keys['arrowleft'] || dir.left, r: keys['d'] || keys['arrowright'] || dir.right,
    };
  }

  // ---- Collision -----------------------------------------------------------
  function solidAt(px, py) {
    if (px < 24 || py < 40 || px > WORLD_W - 24 || py > WORLD_H - 8) return true;
    if (world.waterHit(px, py, 4)) return true;
    for (const tr of world.trees) if (Math.hypot(px - tr.x, py - tr.y) < tr.r * 0.34) return true;
    for (const r of world.rocks) if (Math.hypot(px - r.x, py - (r.y + 4)) < r.r * 0.9) return true;
    for (const h of world.houses) if (px > h.x - 4 && px < h.x + h.w + 4 && py > h.y + h.h * 0.4 && py < h.y + h.h + 4) return true;
    if (px > bin.x - bin.solid.w / 2 && px < bin.x + bin.solid.w / 2 && py > bin.y - bin.solid.h && py < bin.y) return true;
    return false;
  }
  function canMove(px, py, w, h) {
    return !(solidAt(px - w / 2, py) || solidAt(px + w / 2, py) || solidAt(px - w / 2, py - h) || solidAt(px + w / 2, py - h));
  }

  // ---- Quests / dialog -----------------------------------------------------
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  function nearestInteractable() {
    let best = null, bestD = 60;
    for (const n of npcs) { const dd = dist(player, n); if (dd < bestD) { best = { kind: 'npc', ref: n }; bestD = dd; } }
    const db = Math.hypot(player.x - bin.x, player.y - (bin.y - 12));
    if (db < 64 && db < bestD) { best = { kind: 'bin', ref: bin }; bestD = db; }
    return best;
  }
  function say(who, lines, onEnd) { game.dialogQueue = lines.slice(); game.dialogWho = who; game.onDialogEnd = onEnd || null; advanceDialog(); }
  function advanceDialog() {
    if (game.dialogQueue.length === 0) { el.dialog.classList.remove('show'); const cb = game.onDialogEnd; game.onDialogEnd = null; if (cb) cb(); return; }
    el.dWho.textContent = game.dialogWho; el.dLine.textContent = game.dialogQueue.shift(); el.dialog.classList.add('show');
  }
  const QUESTS = {
    0: { name: 'Meet the Pack', obj: 'Talk to Rocky in the clearing.' },
    1: { name: 'Waddle & Collect', obj: () => `Collect JIMO coins — <b>${Math.min(game.coins, 8)}/8</b>` },
    2: { name: 'Report Back', obj: 'Return to Rocky.' },
    3: { name: 'Clean the Meadow', obj: () => `Grab trash bags and dump them in the bin. Carrying: <b>${player.carrying}</b>` },
    4: { name: 'Report Back', obj: 'Return to Rocky.' },
    5: { name: 'Find Momo', obj: () => momo.following ? 'Bring Momo back to Rocky.' : 'Search the northern woods for the lost cub Momo.' },
    6: { name: 'All done', obj: 'Adventure complete.' },
  };
  function updateHUD() { el.coin.textContent = game.coins; const q = QUESTS[game.stage]; if (q) { el.qName.textContent = q.name; el.qObj.innerHTML = (typeof q.obj === 'function') ? q.obj() : q.obj; } }

  function interact() {
    const near = nearestInteractable(); if (!near) return;
    if (near.kind === 'bin') {
      if (game.stage === 3 && player.carrying > 0) {
        const dumped = player.carrying; game.coins += dumped * 5; player.carrying = 0;
        say('You', [`Dumped ${dumped} trash bag(s). Recycled for ${dumped * 5} JIMO.`], () => { if (trash.every(t => t.got)) game.stage = 4; updateHUD(); });
      } else say('Recycling Bin', ['A sturdy green bin. Bring trash bags here to recycle them.']);
      return;
    }
    const n = near.ref;
    if (n.name === 'Pip') { say('Pip', ['Pip the raccoon, at your service.', 'Rocky hands out the quests. Find him up by the clearing.']); return; }
    switch (game.stage) {
      case 0: say('Rocky', ['Well, waddle my whiskers — a hero with a short spine and a big heart.', 'The Trash Pack could use your help, Jimothy.', 'First job: collect 8 shiny JIMO coins around the world.'], () => { game.stage = 1; updateHUD(); }); break;
      case 1: if (game.coins >= 8) { game.stage = 2; advanceStage(); } else say('Rocky', [`Not yet. You have ${game.coins}. Find ${8 - game.coins} more coins.`]); break;
      case 2: advanceStage(); break;
      case 3: say('Rocky', ['The meadow is a mess. Grab those trash bags and dump them in the recycling bin.']); break;
      case 4: advanceStage(); break;
      case 5: if (momo.following) say('Rocky', ['MOMO. You found the little rascal.', 'The whole pack owes you, Jimothy. Short spine, biggest hero.'], () => { game.stage = 6; updateHUD(); winGame(); }); else say('Rocky', ['Momo the cub wandered into the northern woods. Please find them.']); break;
      default: say('Rocky', ['Thanks for everything, hero. Enjoy the adventure.']);
    }
  }
  function advanceStage() {
    if (game.stage === 2) say('Rocky', ['Eight coins already? Fastest waddler in the west.', 'Next: the meadow is full of trash. Collect the bags and recycle them at the bin.'], () => { game.stage = 3; updateHUD(); });
    else if (game.stage === 4) say('Rocky', ['Spotless. The pack thanks you.', 'One more thing — little Momo wandered off into the northern woods. Find the cub.'], () => { game.stage = 5; updateHUD(); });
  }
  function winGame() { game.running = false; el.winText.textContent = `You collected ${game.coins} JIMO and reunited the Trash Pack. Short spine, big adventure.`; el.win.classList.remove('hidden'); }

  // ---- Update --------------------------------------------------------------
  function update(t) {
    const inp = readInput();
    let vx = (inp.r ? 1 : 0) - (inp.l ? 1 : 0), vy = (inp.d ? 1 : 0) - (inp.u ? 1 : 0);
    player.moving = !!(vx || vy);
    if (vx || vy) {
      const len = Math.hypot(vx, vy) || 1; vx = vx / len * player.speed; vy = vy / len * player.speed;
      if (vx < 0) player.flip = false; else if (vx > 0) player.flip = true;
      if (canMove(player.x + vx, player.y, player.w, player.h)) player.x += vx;
      if (canMove(player.x, player.y + vy, player.w, player.h)) player.y += vy;
      player.walk += 0.25;
    }

    for (let i = coins.length - 1; i >= 0; i--) { const c = coins[i]; if (Math.hypot(player.x - c.x, player.y - c.y) < 26) { coins.splice(i, 1); game.coins += 1; updateHUD(); } }

    if (game.stage === 3) for (const tr of trash) if (!tr.got && Math.hypot(player.x - tr.x, player.y - tr.y) < 28) { tr.got = true; player.carrying += 1; updateHUD(); say('You', ['Picked up a trash bag. Take it to the recycling bin.']); }

    if (game.stage === 5 && !momo.following && Math.hypot(player.x - momo.x, player.y - momo.y) < 40) { momo.following = true; updateHUD(); say('Momo', ['(happy chirp)', 'Momo waddles out and follows close behind you. Take them to Rocky.']); }
    if (momo.following) { const tx = player.x - (player.flip ? 30 : -30), ty = player.y + 6; momo.x += (tx - momo.x) * 0.08; momo.y += (ty - momo.y) * 0.08; momo.flip = (tx > momo.x); if (player.moving) momo.walk += 0.2; }

    const dp = Math.hypot(player.x - dog.x, player.y - dog.y);
    dog.chase = dp < 160 && game.stage >= 1;
    if (dog.chase) {
      const ang = Math.atan2(player.y - dog.y, player.x - dog.x), ndx = Math.cos(ang) * 2.1, ndy = Math.sin(ang) * 2.1;
      if (canMove(dog.x + ndx, dog.y, dog.w, dog.h)) dog.x += ndx;
      if (canMove(dog.x, dog.y + ndy, dog.w, dog.h)) dog.y += ndy;
      dog.flip = ndx > 0; dog.walk += 0.3;
      if (dp < 26) spooked();
    } else {
      const nx = dog.x + dog.dir * 1.1;
      if (Math.abs(nx - dog.home.x) > 120 || !canMove(nx, dog.y, dog.w, dog.h)) dog.dir *= -1; else dog.x = nx;
      dog.flip = dog.dir > 0; dog.walk += 0.12;
    }

    for (const bf of world.butterflies) { bf.phase += 0.03; bf.x += Math.cos(bf.phase * 1.3) * 0.5; bf.y += Math.sin(bf.phase) * 0.4; }
    game.t = t;
  }
  function spooked() {
    const lost = Math.min(game.coins, 3); game.coins -= lost; player.carrying = 0;
    player.x = world.spawn.x; player.y = world.spawn.y; dog.x = dog.home.x; dog.y = dog.home.y; dog.chase = false; updateHUD();
    say('Yikes', [`The dog spooked Jimothy. You dropped ${lost} JIMO and any trash. Waddle back and try again.`]);
  }

  // ---- Render --------------------------------------------------------------
  const cam = { x: 0, y: 0 };
  function render(t) {
    resize();
    const vw = canvas.width / DPR, vh = canvas.height / DPR;
    cam.x = clamp(player.x - vw / 2, 0, Math.max(0, WORLD_W - vw));
    cam.y = clamp(player.y - vh / 2, 0, Math.max(0, WORLD_H - vh));
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, vw, vh);
    ctx.save(); ctx.translate(-cam.x, -cam.y);

    const vx0 = cam.x, vy0 = cam.y, vx1 = cam.x + vw, vy1 = cam.y + vh;
    drawTerrain(vx0, vy0, vx1, vy1);
    drawPaths();
    drawWater(t);

    // flat ground deco
    for (const f of world.flowers) if (f.x > vx0 - 10 && f.x < vx1 + 10 && f.y > vy0 - 10 && f.y < vy1 + 10) drawFlower(f);
    for (const m of world.mushrooms) drawMushroom(m);

    // coins & trash on ground
    for (const c of coins) drawCoin(c, t);
    if (game.stage <= 3) for (const tr of trash) if (!tr.got) drawTrashBag(tr);

    // depth-sorted layer
    const draws = [];
    for (const b of world.bushes) draws.push({ y: b.y, fn: () => drawBush(b) });
    for (const tr of world.trees) draws.push({ y: tr.y, fn: () => drawTree(tr, t) });
    for (const r of world.rocks) draws.push({ y: r.y, fn: () => drawRock(r) });
    for (const h of world.houses) draws.push({ y: h.y + h.h, fn: () => drawHouse(h) });
    draws.push({ y: bin.y, fn: () => drawBin(bin) });
    draws.push({ y: sign.y, fn: () => drawSign(sign) });
    for (const n of npcs) draws.push({ y: n.y, fn: () => drawRaccoon(n.x, n.y, n.palette, 1, n.walk + n.bob, n.flip, SPRITES.npc) });
    if (game.stage === 5 && !momo.following) draws.push({ y: momo.y, fn: () => drawMomoHidden(momo) });
    if (momo.following) draws.push({ y: momo.y, fn: () => drawRaccoon(momo.x, momo.y, PAL_MOMO, 0.72, momo.walk, momo.flip, SPRITES.momo) });
    draws.push({ y: dog.y, fn: () => drawDog(dog) });
    draws.push({ y: player.y, fn: () => drawRaccoon(player.x, player.y, PAL_PLAYER, 1, player.walk, player.flip, SPRITES.player) });
    draws.sort((a, b) => a.y - b.y);
    for (const d of draws) d.fn();

    // butterflies above
    for (const bf of world.butterflies) if (bf.x > vx0 && bf.x < vx1 && bf.y > vy0 && bf.y < vy1) drawButterfly(bf, t);

    // interaction prompt
    const near = nearestInteractable();
    if (near && !el.dialog.classList.contains('show')) {
      const r = near.ref, bx = r.x, by = (near.kind === 'bin' ? r.y - 44 : r.y - 58);
      ctx.fillStyle = 'rgba(20,26,34,.92)'; roundedRect(bx - 13, by - 13, 26, 22, 6);
      ctx.fillStyle = '#ffd23f'; ctx.font = '700 13px Fredoka, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('E', bx, by - 1);
    }
    ctx.restore();
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // ---- Canvas sizing -------------------------------------------------------
  let DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    if (canvas.width !== Math.floor(w * DPR) || canvas.height !== Math.floor(h * DPR)) { canvas.width = Math.floor(w * DPR); canvas.height = Math.floor(h * DPR); }
  }
  window.addEventListener('resize', resize);

  // ---- Main loop -----------------------------------------------------------
  function frame(t) {
    if (game && game.running) update(t || 0);
    render(t || 0);
    if (actEdge) { actEdge = false; if (el.dialog.classList.contains('show')) advanceDialog(); else if (game.running) interact(); }
    requestAnimationFrame(frame);
  }

  // ---- Boot ----------------------------------------------------------------
  function start() { resetGame(); game.running = true; el.intro.classList.add('hidden'); el.win.classList.add('hidden'); }
  el.playBtn.addEventListener('click', start);
  el.replayBtn.addEventListener('click', start);
  resetGame(); game.running = false;
  requestAnimationFrame(frame);
  window.JIMOTHY = { SPRITES, loadImg, dbg: () => ({ player, npcs, stage: game.stage, coins: game.coins }) };
})();
