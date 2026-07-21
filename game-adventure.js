/* ============================================================================
   JIMOTHY'S BIG ADVENTURE — top-down 2D adventure
   Pure vanilla canvas, no dependencies, no image assets required.

   >>> WANT THE PAINTED CARTOON LOOK? <<<
   Drop real sprite PNGs into /assets and set them in SPRITES below.
   If a sprite Image is present it is used instead of the vector drawing.
   (e.g. SPRITES.player = loadImg('assets/jimothy.png'))
   ============================================================================ */
(function () {
  'use strict';

  const canvas = document.getElementById('world');
  const ctx = canvas.getContext('2d');

  // ---- Optional real-art hook (leave null to use built-in vector art) ------
  const SPRITES = { player: null, npc: null, momo: null, dog: null };
  function loadImg(src) { const i = new Image(); i.src = src; return i; }
  // Example: SPRITES.player = loadImg('assets/jimothy.png');

  // ---- World constants -----------------------------------------------------
  const TILE = 48, COLS = 30, ROWS = 20;
  const WORLD_W = COLS * TILE, WORLD_H = ROWS * TILE;
  const GRASS = 0, PATH = 1, WATER = 2, SAND = 3;

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

  // ---- Terrain generation --------------------------------------------------
  const terrain = [];
  function buildTerrain() {
    terrain.length = 0;
    for (let r = 0; r < ROWS; r++) {
      const row = [];
      for (let c = 0; c < COLS; c++) row.push(GRASS);
      terrain.push(row);
    }
    // Pond in the top-right
    for (let r = 2; r <= 5; r++)
      for (let c = 22; c <= 27; c++) {
        terrain[r][c] = WATER;
        if (r === 5 || c === 22) terrain[r][c] = (Math.abs(r - c) % 2 === 0) ? WATER : SAND;
      }
    for (let c = 22; c <= 27; c++) if (terrain[6] && terrain[6][c] === GRASS) terrain[6][c] = SAND;
    // Cross paths
    for (let c = 3; c < COLS - 3; c++) terrain[10][c] = PATH;
    for (let r = 5; r < ROWS - 3; r++) terrain[r][14] = PATH;
    for (let c = 12; c <= 16; c++) terrain[15][c] = PATH;
  }

  function tileAt(px, py) {
    const c = Math.floor(px / TILE), r = Math.floor(py / TILE);
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return WATER; // out of bounds = blocked
    return terrain[r][c];
  }

  // ---- Objects (trees, houses, bin) with base-collision boxes --------------
  let objects = [];
  function buildObjects() {
    objects = [];
    const tree = (c, r) => objects.push({ type: 'tree', x: c * TILE + TILE / 2, y: r * TILE + TILE, solid: { w: 22, h: 14 } });
    // Border ring of trees
    for (let c = 0; c < COLS; c++) { tree(c, 0); tree(c, ROWS - 1); }
    for (let r = 1; r < ROWS - 1; r++) { tree(0, r); tree(COLS - 1, r); }
    // Clusters
    [[4, 3], [5, 3], [4, 4], [6, 15], [7, 16], [8, 15], [24, 14], [25, 15], [26, 14], [3, 15], [3, 16]]
      .forEach(([c, r]) => tree(c, r));
    // Houses
    objects.push({ type: 'house', x: 6 * TILE, y: 8 * TILE, solid: { w: 84, h: 60 }, tint: '#c76b3f' });
    objects.push({ type: 'house', x: 22 * TILE, y: 12 * TILE, solid: { w: 84, h: 60 }, tint: '#5b8fb0' });
    // Recycling bin (interactable)
    bin = { type: 'bin', x: 14 * TILE + 24, y: 7 * TILE + 24, solid: { w: 30, h: 26 } };
    objects.push(bin);
    // Sign
    objects.push({ type: 'sign', x: 12 * TILE, y: 10 * TILE + 20, solid: { w: 8, h: 8 } });
  }

  // ---- Entities ------------------------------------------------------------
  let player, npcs, coins, trash, momo, dog, bin, game;

  function resetGame() {
    buildTerrain();
    buildObjects();

    player = { x: 14 * TILE, y: 12 * TILE, w: 34, h: 26, speed: 2.6, flip: false, walk: 0, moving: false, carrying: 0 };

    npcs = [
      { name: 'Rocky', x: 15 * TILE, y: 9 * TILE, flip: false, walk: 0, palette: PAL_ROCKY, bob: 0 },
      { name: 'Pip', x: 20 * TILE, y: 14 * TILE, flip: true, walk: 0, palette: PAL_PIP, bob: 1.5 },
    ];

    coins = [];
    [[8, 6], [11, 6], [17, 12], [19, 8], [10, 13], [21, 6], [7, 12], [16, 16], [24, 9], [13, 13], [18, 15], [9, 9]]
      .forEach(([c, r]) => coins.push({ x: c * TILE + 24, y: r * TILE + 24, got: false, bob: Math.random() * 6 }));

    trash = [];
    [[6, 6], [8, 8], [5, 12]].forEach(([c, r]) => trash.push({ x: c * TILE + 24, y: r * TILE + 24, got: false }));

    momo = { x: 26 * TILE + 10, y: 16 * TILE, found: false, following: false, flip: true, walk: 0 };

    dog = { x: 22 * TILE, y: 10 * TILE, home: { x: 22 * TILE, y: 10 * TILE }, w: 40, h: 26, dir: 1, flip: false, walk: 0, chase: false };

    game = { coins: 0, stage: 0, running: false, dialogQueue: [], onDialogEnd: null };
    updateHUD();
  }

  // ---- Palettes ------------------------------------------------------------
  const PAL_PLAYER = { body: '#7f848c', body2: '#9aa0a8', belly: '#d9d6cf', mask: '#1d1d21', eyering: '#efece5', leg: '#26262b', ear: '#6c7178', tail: '#7f848c', ring: '#232327', nose: '#141416' };
  const PAL_ROCKY = { ...PAL_PLAYER, body: '#8b7d6b', body2: '#a89a86', belly: '#e2d8c6', ear: '#766a5a', tail: '#8b7d6b' };
  const PAL_PIP   = { ...PAL_PLAYER, body: '#6b7f7a', body2: '#87a099', belly: '#d3ddd6', ear: '#5b6c68', tail: '#6b7f7a' };
  const PAL_MOMO  = { ...PAL_PLAYER, body: '#9298a0', body2: '#adb3ba', belly: '#e6e3dc' };

  // ---- Cartoon raccoon painter --------------------------------------------
  // Anchored at feet (x = center, y = ground). scale ~ size, flip mirrors L/R.
  function drawRaccoon(x, y, pal, scale, walk, flip, sprite) {
    ctx.save();
    ctx.translate(x, y);
    if (flip) ctx.scale(-1, 1);
    ctx.scale(scale, scale);

    if (sprite && sprite.complete && sprite.naturalWidth) {
      const w = 60, h = 56;
      ctx.drawImage(sprite, -w / 2, -h, w, h);
      ctx.restore();
      return;
    }

    const bob = Math.sin(walk) * 1.4;
    const legSwing = Math.sin(walk) * 3;

    // ---- Tail (behind body, back-left) ----
    ctx.save();
    ctx.translate(-16, -20 + bob);
    ctx.rotate(-0.5);
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.ellipse(-i * 7, -i * 3, 9 - i * 0.6, 7 - i * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = (i % 2 === 0) ? pal.tail : pal.ring;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.ellipse(-5 * 7, -5 * 3, 5, 4, 0, 0, Math.PI * 2);
    ctx.fillStyle = pal.ring; ctx.fill();
    ctx.restore();

    // ---- Legs (dark, animated) ----
    ctx.fillStyle = pal.leg;
    roundedRect(-13, -10 - legSwing, 8, 12, 3);
    roundedRect(6, -10 + legSwing, 8, 12, 3);
    roundedRect(-8, -8 + legSwing, 8, 11, 3);
    roundedRect(2, -8 - legSwing, 8, 11, 3);

    ctx.translate(0, bob);

    // ---- Body ----
    const g = ctx.createRadialGradient(-4, -26, 4, 0, -22, 26);
    g.addColorStop(0, pal.body2); g.addColorStop(1, pal.body);
    ctx.fillStyle = g;
    ellipse(0, -22, 22, 18);
    ctx.strokeStyle = 'rgba(0,0,0,.15)'; ctx.lineWidth = 1.5; ctx.stroke();

    // belly
    ctx.fillStyle = pal.belly;
    ellipse(0, -13, 12, 9);

    // ---- Head (front-lower, facing viewer) ----
    // ears
    ctx.fillStyle = pal.ear;
    ellipse(-11, -30, 6, 7); ellipse(11, -30, 6, 7);
    ctx.fillStyle = pal.mask;
    ellipse(-11, -31, 3.2, 4); ellipse(11, -31, 3.2, 4);

    // head base
    ctx.fillStyle = pal.body2;
    ellipse(0, -20, 15, 13);
    // light muzzle
    ctx.fillStyle = pal.belly;
    ellipse(0, -15, 9, 8);

    // mask (two eye patches joined)
    ctx.fillStyle = pal.mask;
    ctx.beginPath();
    ctx.ellipse(-7, -22, 6.5, 6, 0.25, 0, Math.PI * 2);
    ctx.ellipse(7, -22, 6.5, 6, -0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -24, 4, 3, 0, 0, Math.PI * 2); ctx.fill(); // brow bridge

    // eye rings (light)
    ctx.fillStyle = pal.eyering;
    ellipse(-6.5, -22, 3.6, 3.4); ellipse(6.5, -22, 3.6, 3.4);
    // pupils
    ctx.fillStyle = '#111';
    ellipse(-6, -22, 1.9, 2.1); ellipse(7, -22, 1.9, 2.1);
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ellipse(-6.6, -22.8, .7, .7); ellipse(6.4, -22.8, .7, .7);

    // nose + mouth
    ctx.fillStyle = pal.nose;
    ellipse(0, -14, 2.6, 2);
    ctx.strokeStyle = pal.nose; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -12.5); ctx.quadraticCurveTo(-2.5, -10.5, -4, -11.5);
    ctx.moveTo(0, -12.5); ctx.quadraticCurveTo(2.5, -10.5, 4, -11.5); ctx.stroke();

    ctx.restore();
  }

  function ellipse(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.fill();
  }

  // ---- Prop painters -------------------------------------------------------
  function drawTree(o) {
    const x = o.x, y = o.y;
    ctx.fillStyle = '#4a3626';
    roundedRect(x - 5, y - 22, 10, 22, 3);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i === 0 ? '#3f7d4a' : i === 1 ? '#4f9459' : '#5fa869';
      ellipse(x, y - 34 - i * 8, 26 - i * 4, 20 - i * 3);
    }
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    ellipse(x - 8, y - 48, 8, 6);
  }
  function drawHouse(o) {
    const x = o.x, y = o.y, w = 84, h = 60;
    ctx.fillStyle = '#6a5744';
    roundedRect(x - w / 2, y - h, w, h, 6);
    ctx.fillStyle = o.tint;                         // roof
    ctx.beginPath();
    ctx.moveTo(x - w / 2 - 8, y - h + 8);
    ctx.lineTo(x, y - h - 26);
    ctx.lineTo(x + w / 2 + 8, y - h + 8);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#3a2f24';                       // door
    roundedRect(x - 12, y - 34, 24, 34, 4);
    ctx.fillStyle = '#ffd23f';                        // window
    roundedRect(x - w / 2 + 12, y - h + 20, 16, 16, 3);
    roundedRect(x + w / 2 - 28, y - h + 20, 16, 16, 3);
  }
  function drawBin(o) {
    const x = o.x, y = o.y;
    ctx.fillStyle = '#3f7d4a';
    roundedRect(x - 16, y - 28, 32, 30, 5);
    ctx.fillStyle = '#356b40';
    for (let i = 6; i < 28; i += 7) { ctx.fillRect(x - 16, y - i, 32, 2); }
    ctx.fillStyle = '#2c5a35';
    roundedRect(x - 19, y - 32, 38, 7, 3);           // lid
    ctx.fillStyle = '#eaf5ec';                         // recycle mark
    ctx.font = 'bold 16px Fredoka, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('♻', x, y - 13);
  }
  function drawSign(o) {
    const x = o.x, y = o.y;
    ctx.fillStyle = '#6a5744'; ctx.fillRect(x - 2, y - 20, 4, 20);
    ctx.fillStyle = '#8a7050'; roundedRect(x - 20, y - 40, 40, 22, 4);
    ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 10px Press Start 2P, monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('$JIMO', x, y - 29);
  }
  function drawCoin(c, t) {
    const y = c.y - 6 - Math.sin(t / 260 + c.bob) * 4;
    ctx.save(); ctx.translate(c.x, y);
    const sx = Math.abs(Math.cos(t / 300 + c.bob));    // spin
    ctx.scale(sx * 0.7 + 0.3, 1);
    ctx.fillStyle = '#ffd23f'; ellipse(0, 0, 10, 10);
    ctx.strokeStyle = '#e0a92b'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(0, 0, 10, 10, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#7a5a12'; ctx.font = 'bold 12px Fredoka, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('J', 0, 1);
    ctx.restore();
  }
  function drawTrashBag(o) {
    ctx.save(); ctx.translate(o.x, o.y);
    ctx.fillStyle = '#3a3f45'; ellipse(0, -6, 11, 12);
    ctx.fillStyle = '#2b2f34'; ellipse(-3, -8, 4, 4);
    ctx.fillStyle = '#4a5057'; roundedRect(-4, -18, 8, 6, 2);  // tie
    ctx.restore();
  }
  function drawDog(d) {
    ctx.save(); ctx.translate(d.x, d.y);
    if (d.flip) ctx.scale(-1, 1);
    const sw = Math.sin(d.walk) * 3;
    ctx.fillStyle = '#3a2e24';                         // legs
    roundedRect(-14, -8 - sw, 6, 10, 2); roundedRect(8, -8 + sw, 6, 10, 2);
    roundedRect(-4, -8 + sw, 6, 10, 2);
    ctx.fillStyle = d.chase ? '#7a4a34' : '#6a4b33';   // body
    ellipse(0, -16, 18, 12);
    ellipse(16, -20, 10, 9);                            // head
    ctx.fillStyle = '#3a2e24'; ellipse(20, -28, 4, 6);  // ear
    ctx.fillStyle = '#111'; ellipse(20, -21, 1.8, 2);   // eye
    ctx.fillStyle = '#1a1a1a'; ellipse(25, -19, 3, 2.5);// snout
    ctx.strokeStyle = '#6a4b33'; ctx.lineWidth = 4; ctx.beginPath();
    ctx.moveTo(-16, -18); ctx.quadraticCurveTo(-26, -22, -22, -30); ctx.stroke(); // tail
    if (d.chase) { ctx.fillStyle = '#fff'; ctx.font = 'bold 14px Fredoka'; ctx.textAlign = 'center'; ctx.fillText('!', 16, -36); }
    ctx.restore();
  }

  // ---- Input ---------------------------------------------------------------
  const keys = {};
  const dir = { up: false, down: false, left: false, right: false };
  let actEdge = false;

  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k)) e.preventDefault();
    keys[k] = true;
    if (k === 'e' || k === ' ' || k === 'enter') actEdge = true;
  });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  // Mobile
  function bindHold(btn, d) {
    const on = (e) => { e.preventDefault(); dir[d] = true; };
    const off = (e) => { e.preventDefault(); dir[d] = false; };
    btn.addEventListener('touchstart', on, { passive: false });
    btn.addEventListener('touchend', off); btn.addEventListener('touchcancel', off);
    btn.addEventListener('mousedown', on); btn.addEventListener('mouseup', off); btn.addEventListener('mouseleave', off);
  }
  document.querySelectorAll('.dpad button').forEach(b => bindHold(b, b.dataset.dir));
  el.actBtn.addEventListener('touchstart', (e) => { e.preventDefault(); actEdge = true; }, { passive: false });
  el.actBtn.addEventListener('mousedown', () => { actEdge = true; });
  if ('ontouchstart' in window) el.touch.classList.add('on');

  function readInput() {
    const u = keys['w'] || keys['arrowup'] || dir.up;
    const d = keys['s'] || keys['arrowdown'] || dir.down;
    const l = keys['a'] || keys['arrowleft'] || dir.left;
    const r = keys['d'] || keys['arrowright'] || dir.right;
    return { u, d, l, r };
  }

  // ---- Collision -----------------------------------------------------------
  function solidAt(px, py) {
    const t = tileAt(px, py);
    if (t === WATER) return true;
    for (const o of objects) {
      if (!o.solid) continue;
      const s = o.solid;
      if (px > o.x - s.w / 2 && px < o.x + s.w / 2 && py > o.y - s.h && py < o.y) return true;
    }
    return false;
  }
  function canMove(px, py, w, h) {
    // check the character's foot box corners
    return !(solidAt(px - w / 2, py) || solidAt(px + w / 2, py) ||
             solidAt(px - w / 2, py - h) || solidAt(px + w / 2, py - h));
  }

  // ---- Interaction & quests ------------------------------------------------
  function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

  function nearestInteractable() {
    let best = null, bestD = 56;
    for (const n of npcs) { const dd = dist(player, n); if (dd < bestD) { best = { kind: 'npc', ref: n }; bestD = dd; } }
    const db = Math.hypot(player.x - bin.x, player.y - (bin.y - 12));
    if (db < 60 && db < bestD) { best = { kind: 'bin', ref: bin }; bestD = db; }
    return best;
  }

  function say(who, lines, onEnd) {
    game.dialogQueue = lines.slice();
    game.dialogWho = who;
    game.onDialogEnd = onEnd || null;
    advanceDialog();
  }
  function advanceDialog() {
    if (game.dialogQueue.length === 0) {
      el.dialog.classList.remove('show');
      const cb = game.onDialogEnd; game.onDialogEnd = null;
      if (cb) cb();
      return;
    }
    el.dWho.textContent = game.dialogWho;
    el.dLine.textContent = game.dialogQueue.shift();
    el.dialog.classList.add('show');
  }

  const QUESTS = {
    0: { name: 'Meet the Pack', obj: 'Talk to Rocky in the clearing.' },
    1: { name: 'Waddle & Collect', obj: () => `Collect $JIMO coins — <b>${Math.min(game.coins, 8)}/8</b>` },
    2: { name: 'Report Back', obj: 'Return to Rocky.' },
    3: { name: 'Clean the Alley', obj: () => `Grab trash bags & dump them in the bin — <b>${3 - trash.filter(t => !t.got).length + 0}/3</b> collected, carrying <b>${player.carrying}</b>` },
    4: { name: 'Report Back', obj: 'Return to Rocky.' },
    5: { name: 'Find Momo', obj: () => momo.following ? 'Bring Momo back to Rocky.' : 'Search the far corners for the lost cub Momo.' },
    6: { name: 'All done!', obj: 'Adventure complete.' },
  };

  function updateHUD() {
    el.coin.textContent = game.coins;
    const q = QUESTS[game.stage];
    if (q) { el.qName.textContent = q.name; el.qObj.innerHTML = (typeof q.obj === 'function') ? q.obj() : q.obj; }
  }

  function interact() {
    const near = nearestInteractable();
    if (!near) return;

    if (near.kind === 'bin') {
      if (game.stage === 3 && player.carrying > 0) {
        game.coins += player.carrying * 5;
        const dumped = player.carrying; player.carrying = 0;
        say('You', [`Dumped ${dumped} trash bag(s). ♻ +${dumped * 5} $JIMO!`], () => {
          if (trash.every(t => t.got)) { game.stage = 4; }
          updateHUD();
        });
      } else {
        say('Recycling Bin', ['A sturdy green bin. Bring trash bags here to recycle them.']);
      }
      return;
    }

    const n = near.ref;
    if (n.name === 'Pip') {
      say('Pip', ['Pip the raccoon, at your service!', 'Rocky runs the quests around here. Go say hi — he\'s by the sign.']);
      return;
    }

    // Rocky = quest giver
    switch (game.stage) {
      case 0:
        say('Rocky', [
          'Well, waddle my whiskers — a hero with a short spine and a big heart!',
          'The Trash Pack could use your help, Jimothy.',
          'First job: scoop up 8 shiny $JIMO coins scattered around the clearing.',
        ], () => { game.stage = 1; updateHUD(); });
        break;
      case 1:
        if (game.coins >= 8) { game.stage = 2; advanceStage(); }
        else say('Rocky', [`Not yet! You\'ve got ${game.coins}. Find ${8 - game.coins} more shiny coins.`]);
        break;
      case 2: advanceStage(); break;
      case 3:
        say('Rocky', ['The alley\'s a mess. Grab those trash bags and dump them in the recycling bin!']);
        break;
      case 4: advanceStage(); break;
      case 5:
        if (momo.following) {
          say('Rocky', ['MOMO! You found the little rascal!', 'The whole pack owes you, Jimothy. Short spine, biggest hero.'],
            () => { game.stage = 6; updateHUD(); winGame(); });
        } else {
          say('Rocky', ['Momo the cub wandered off near the far trees. Please find them!']);
        }
        break;
      default:
        say('Rocky', ['Thanks for everything, hero. Enjoy the adventure!']);
    }
  }

  function advanceStage() {
    if (game.stage === 2) {
      say('Rocky', ['Ha! Eight coins already? Fastest waddler in the west.', 'Next: the alley\'s full of trash. Collect 3 bags and recycle them at the bin.'],
        () => { game.stage = 3; updateHUD(); });
    } else if (game.stage === 4) {
      say('Rocky', ['Spotless! The pack thanks you.', 'One more thing — little Momo wandered off. Find the cub near the far trees!'],
        () => { game.stage = 5; updateHUD(); });
    }
  }

  function winGame() {
    game.running = false;
    el.winText.textContent = `You collected ${game.coins} $JIMO and reunited the Trash Pack. Short spine, big adventure. 🦝`;
    el.win.classList.remove('hidden');
  }

  // ---- Update loop ---------------------------------------------------------
  let last = 0;
  function update(dt, t) {
    const inp = readInput();
    let vx = (inp.r ? 1 : 0) - (inp.l ? 1 : 0);
    let vy = (inp.d ? 1 : 0) - (inp.u ? 1 : 0);
    player.moving = !!(vx || vy);
    if (vx || vy) {
      const len = Math.hypot(vx, vy) || 1;
      vx = vx / len * player.speed; vy = vy / len * player.speed;
      if (vx < 0) player.flip = false; else if (vx > 0) player.flip = true;
      if (canMove(player.x + vx, player.y, player.w, player.h)) player.x += vx;
      if (canMove(player.x, player.y + vy, player.w, player.h)) player.y += vy;
      player.walk += 0.25;
    }
    player.x = Math.max(TILE, Math.min(WORLD_W - TILE, player.x));
    player.y = Math.max(TILE + 10, Math.min(WORLD_H - 6, player.y));

    // coins
    for (const c of coins) {
      if (!c.got && Math.hypot(player.x - c.x, player.y - (c.y)) < 26) {
        c.got = true; game.coins += 1; updateHUD();
        if (game.stage === 1 && game.coins >= 8) updateHUD();
      }
    }
    coins = coins.filter(c => !c.got);

    // trash pickup (stage 3, walk over)
    if (game.stage === 3) {
      for (const tr of trash) {
        if (!tr.got && Math.hypot(player.x - tr.x, player.y - tr.y) < 28) {
          tr.got = true; player.carrying += 1; updateHUD();
          say('You', ['Picked up a trash bag! Take it to the recycling bin.']);
        }
      }
    }

    // find momo (stage 5)
    if (game.stage === 5 && !momo.following) {
      if (Math.hypot(player.x - momo.x, player.y - momo.y) < 34) {
        momo.following = true; updateHUD();
        say('Momo', ['*happy chirp!*', 'Momo waddles out and follows close behind you. Take them to Rocky!']);
      }
    }
    if (momo.following) {
      // follow with lag
      const tx = player.x - (player.flip ? 30 : -30), ty = player.y + 6;
      momo.x += (tx - momo.x) * 0.08; momo.y += (ty - momo.y) * 0.08;
      momo.flip = (tx > momo.x);
      if (player.moving) momo.walk += 0.2;
    }

    // dog AI: patrol; chase if player near; catch = penalty
    const dp = Math.hypot(player.x - dog.x, player.y - dog.y);
    dog.chase = dp < 150 && game.stage >= 1;
    if (dog.chase) {
      const ang = Math.atan2(player.y - dog.y, player.x - dog.x);
      const ndx = Math.cos(ang) * 2.0, ndy = Math.sin(ang) * 2.0;
      if (canMove(dog.x + ndx, dog.y, dog.w, dog.h)) dog.x += ndx;
      if (canMove(dog.x, dog.y + ndy, dog.w, dog.h)) dog.y += ndy;
      dog.flip = ndx > 0; dog.walk += 0.3;
      if (dp < 26) { spooked(); }
    } else {
      // patrol horizontally around home
      const nx = dog.x + dog.dir * 1.1;
      if (Math.abs(nx - dog.home.x) > 90 || !canMove(nx, dog.y, dog.w, dog.h)) dog.dir *= -1;
      else dog.x = nx;
      dog.flip = dog.dir > 0; dog.walk += 0.12;
    }

    for (const n of npcs) n.walk += player.moving ? 0 : 0; // idle
    game.t = t;
  }

  function spooked() {
    const lost = Math.min(game.coins, 3);
    game.coins -= lost;
    player.carrying = 0;
    player.x = 14 * TILE; player.y = 12 * TILE;
    dog.x = dog.home.x; dog.y = dog.home.y; dog.chase = false;
    updateHUD();
    say('Yikes!', [`The dog spooked Jimothy! You dropped ${lost} $JIMO and any trash. Waddle back and try again.`]);
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
    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    // terrain
    const c0 = Math.max(0, Math.floor(cam.x / TILE)), c1 = Math.min(COLS - 1, Math.ceil((cam.x + vw) / TILE));
    const r0 = Math.max(0, Math.floor(cam.y / TILE)), r1 = Math.min(ROWS - 1, Math.ceil((cam.y + vh) / TILE));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const tt = terrain[r][c];
      ctx.fillStyle = tt === WATER ? '#2f6d86' : tt === PATH ? '#b79a6a' : tt === SAND ? '#cdb079' : ((r + c) % 2 ? '#57933f' : '#5c9a43');
      ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
      if (tt === WATER) { ctx.fillStyle = 'rgba(255,255,255,.10)'; ctx.fillRect(c * TILE + 6, r * TILE + ((Math.sin(t / 400 + c) > 0) ? 10 : 20), TILE - 12, 3); }
      if (tt === GRASS && (r * 7 + c * 3) % 5 === 0) { ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fillRect(c * TILE + 14, r * TILE + 16, 4, 8); }
    }

    // coins & trash on ground first
    for (const c of coins) drawCoin(c, t);
    if (game.stage <= 3) for (const tr of trash) if (!tr.got) drawTrashBag(tr);

    // depth-sorted drawables
    const draws = [];
    for (const o of objects) if (o.type !== 'bin') draws.push({ y: o.y, fn: () => propDraw(o) });
    draws.push({ y: bin.y, fn: () => drawBin(bin) });
    for (const n of npcs) draws.push({ y: n.y, fn: () => drawRaccoon(n.x, n.y, n.palette, 1, n.walk + n.bob, n.flip, SPRITES.npc) });
    if (game.stage === 5 && !momo.following) draws.push({ y: momo.y, fn: () => drawMomoHidden() });
    if (momo.following) draws.push({ y: momo.y, fn: () => drawRaccoon(momo.x, momo.y, PAL_MOMO, 0.72, momo.walk, momo.flip, SPRITES.momo) });
    draws.push({ y: dog.y, fn: () => drawDog(dog) });
    draws.push({ y: player.y, fn: () => drawRaccoon(player.x, player.y, PAL_PLAYER, 1, player.walk, player.flip, SPRITES.player) });

    draws.sort((a, b) => a.y - b.y);
    for (const d of draws) d.fn();

    // interaction prompt
    const near = nearestInteractable();
    if (near && !el.dialog.classList.contains('show')) {
      const r = near.ref;
      const bx = near.kind === 'bin' ? r.x : r.x, by = near.kind === 'bin' ? r.y - 40 : r.y - 56;
      ctx.fillStyle = 'rgba(20,16,14,.9)'; roundedRect(bx - 14, by - 14, 28, 22, 6);
      ctx.fillStyle = '#ffd23f'; ctx.font = 'bold 12px Press Start 2P, monospace';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('E', bx, by - 2);
    }

    ctx.restore();
  }

  function propDraw(o) {
    if (o.type === 'tree') drawTree(o);
    else if (o.type === 'house') drawHouse(o);
    else if (o.type === 'sign') drawSign(o);
  }
  function drawMomoHidden() {
    // just ears peeking near the tree
    ctx.fillStyle = PAL_MOMO.ear; ellipse(momo.x - 5, momo.y - 6, 5, 6); ellipse(momo.x + 5, momo.y - 6, 5, 6);
    ctx.fillStyle = PAL_MOMO.mask; ellipse(momo.x - 5, momo.y - 7, 2.4, 3); ellipse(momo.x + 5, momo.y - 7, 2.4, 3);
    ctx.fillStyle = '#fff'; ellipse(momo.x - 3, momo.y - 2, 1.6, 1.8); ellipse(momo.x + 3, momo.y - 2, 1.6, 1.8);
    ctx.fillStyle = '#111'; ellipse(momo.x - 3, momo.y - 2, .8, 1); ellipse(momo.x + 3, momo.y - 2, .8, 1);
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  // ---- Canvas sizing -------------------------------------------------------
  let DPR = 1;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth, h = window.innerHeight;
    if (canvas.width !== Math.floor(w * DPR) || canvas.height !== Math.floor(h * DPR)) {
      canvas.width = Math.floor(w * DPR); canvas.height = Math.floor(h * DPR);
    }
  }
  window.addEventListener('resize', resize);

  // ---- Main loop -----------------------------------------------------------
  function frame(t) {
    const dt = Math.min(32, t - last); last = t;
    if (game && game.running) update(dt, t);
    render(t || 0);
    if (actEdge) {
      actEdge = false;
      if (el.dialog.classList.contains('show')) advanceDialog();
      else if (game.running) interact();
    }
    requestAnimationFrame(frame);
  }

  // ---- Boot ----------------------------------------------------------------
  function start() {
    resetGame();
    game.running = true;
    el.intro.classList.add('hidden');
    el.win.classList.add('hidden');
  }
  el.playBtn.addEventListener('click', start);
  el.replayBtn.addEventListener('click', start);

  resetGame();          // build world so it renders behind the intro
  game.running = false;
  requestAnimationFrame(frame);

  // expose a couple hooks for tuning / sprite swap from console
  window.JIMOTHY = { SPRITES, loadImg, dbg: () => ({ player, npcs, stage: game.stage, coins: game.coins }) };
})();
