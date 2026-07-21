/* ============================================================
   Jimothy — pixel art + "Trash Dash" mini runner
   All art is drawn procedurally on <canvas>, no image assets.
   ============================================================ */

/* ---- Shared pixel-raccoon painter ----
   Draws a hunched, short-spine trash panda into a grid.
   `s` = pixel size, (ox, oy) = top-left origin, `step` toggles legs. */
function drawJimothy(ctx, ox, oy, s, step) {
  const C = {
    fur:  '#8a8f96',   // grey body
    fur2: '#6f747b',   // shadow
    mask: '#2b2b30',   // dark eye mask
    face: '#e9e6df',   // light face
    nose: '#1a1a1d',
    eye:  '#ffffff',
    ring: '#3a3a40',   // tail rings
  };
  // Pixel map. Each row is a string; chars map to colors (space = empty).
  // Short spine = big round hunched back, low head, stubby legs.
  const map = [
    '     kkkk      kkkk ',
    '    kFFFFk    kFFFFk ',
    '    kFFFFk    kFFFFk ',
    '   kkFFkkkkkkkkFFkk  ',
    '  kFFFFFFFFFFFFFFFFk ',
    ' kFFFFMMFFFFMMFFFFFFk',
    ' kFFMMWWMMFMMWWMMFFFk',
    ' kFFMMWeMMFMMWeMMFFFk',
    ' kFFFFMMFFFFMMFFFFFbk',   // b = start of tail
    ' kAFFFFFFnnFFFFFFFbrk',
    'kAAFFFFFFnnFFFFFFbrrk',
    'kAAFFFFFFFFFFFFFbrrbk',
    ' kFFFFFFFFFFFFFbrrbrk',
    '  kFFFFFFFFFFFbrrbrrk',
    '   kkFFkkFFkk brrbrk ',
    '   kLLk  kLLk  brbk  ',
  ];
  const legStep = [
    '   kLLk  kLLk ',  // frame 0
    '  kLLk    kLLk',  // frame 1
  ];
  const colorFor = {
    k: '#20232a', F: C.fur, M: C.mask, W: C.face, e: C.nose,
    n: C.face, A: C.face, L: C.fur2, b: C.fur2, r: C.ring,
  };
  for (let y = 0; y < map.length; y++) {
    const row = (y === 15) ? legStep[step % 2] : map[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === ' ') continue;
      const col = colorFor[ch] || C.fur;
      ctx.fillStyle = col;
      ctx.fillRect(ox + x * s, oy + y * s, s, s);
    }
  }
  // nose highlight
  ctx.fillStyle = C.face;
}

/* ---- Mascot: rendered into any canvas that wants it, gently animated ---- */
(function mascot() {
  const targets = [
    { cv: document.getElementById('mascot'), s: 13, ox: 22, oy: 40 },
    { cv: document.getElementById('mascotPlay'), s: 9, ox: 20, oy: 40 },
  ].filter(t => t.cv);
  if (!targets.length) return;
  let step = 0;
  function paint() {
    for (const t of targets) {
      const ctx = t.cv.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, t.cv.width, t.cv.height);
      drawJimothy(ctx, t.ox, t.oy, t.s, step);
    }
    step++;
  }
  paint();
  setInterval(paint, 320); // slow leg shuffle
})();

/* ============================================================
   TRASH DASH — endless runner
   ============================================================ */
(function trashDash() {
  const cv = document.getElementById('game');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;

  const W = cv.width, H = cv.height;
  const GROUND = H - 60;
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const overlay = document.getElementById('gameOverlay');
  const overlayTitle = document.getElementById('overlayTitle');
  const overlayText = document.getElementById('overlayText');
  const startBtn = document.getElementById('startBtn');

  let best = Number(localStorage.getItem('jimothy_best') || 0);
  bestEl.textContent = best;

  const jim = { x: 90, y: GROUND, vy: 0, w: 52, h: 44, onGround: true };
  const GRAV = 0.9, JUMP = -15;
  let obstacles, coins, speed, score, running, frame, clouds;

  function reset() {
    jim.y = GROUND; jim.vy = 0; jim.onGround = true;
    obstacles = []; coins = [];
    speed = 6; score = 0; frame = 0;
    clouds = [{x: 200, y: 60}, {x: 520, y: 100}, {x: 780, y: 50}];
    running = true;
  }

  function jump() {
    if (!running) { start(); return; }
    if (jim.onGround) { jim.vy = JUMP; jim.onGround = false; }
  }

  function spawn() {
    // trash can obstacle
    if (frame % Math.floor(90 - Math.min(speed * 3, 45)) === 0) {
      const h = 30 + Math.random() * 26;
      obstacles.push({ x: W + 20, y: GROUND, w: 30, h });
    }
    // floating coin
    if (frame % 70 === 0) {
      coins.push({ x: W + 20, y: GROUND - 70 - Math.random() * 90, r: 11, got: false });
    }
  }

  function collideRect(a, bx, by, bw, bh) {
    return a.x < bx + bw && a.x + a.w > bx && a.y - a.h < by && a.y > by - bh;
  }

  function update() {
    frame++;
    speed += 0.0015;               // gradual ramp
    score += 1;

    jim.vy += GRAV;
    jim.y += jim.vy;
    if (jim.y >= GROUND) { jim.y = GROUND; jim.vy = 0; jim.onGround = true; }

    spawn();

    for (const c of clouds) { c.x -= speed * 0.25; if (c.x < -60) c.x = W + 60; }

    obstacles.forEach(o => o.x -= speed);
    coins.forEach(c => c.x -= speed);
    obstacles = obstacles.filter(o => o.x + o.w > -10);
    coins = coins.filter(c => c.x > -20);

    // collisions
    const jbx = jim.x + 8, jbw = jim.w - 18, jby = jim.y, jbh = jim.h - 6;
    for (const o of obstacles) {
      if (jbx < o.x + o.w && jbx + jbw > o.x && jby > o.y - o.h && jby - jbh < o.y) {
        return gameOver();
      }
    }
    for (const c of coins) {
      if (!c.got) {
        const cx = jim.x + jim.w / 2, cy = jim.y - jim.h / 2;
        if (Math.hypot(cx - c.x, cy - c.y) < c.r + 22) { c.got = true; score += 25; }
      }
    }
    coins = coins.filter(c => !c.got);

    scoreEl.textContent = Math.floor(score / 5);
  }

  function drawBg() {
    // sky gradient
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#243a52'); g.addColorStop(1, '#16222f');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // moon
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.arc(W - 90, 70, 34, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#243a52'; ctx.beginPath(); ctx.arc(W - 76, 62, 30, 0, Math.PI * 2); ctx.fill();
    // clouds
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    for (const c of clouds) {
      ctx.beginPath(); ctx.ellipse(c.x, c.y, 42, 18, 0, 0, Math.PI * 2);
      ctx.ellipse(c.x + 34, c.y + 6, 30, 14, 0, 0, Math.PI * 2); ctx.fill();
    }
    // ground
    ctx.fillStyle = '#2e241d'; ctx.fillRect(0, GROUND, W, H - GROUND);
    ctx.fillStyle = '#3a2d24'; ctx.fillRect(0, GROUND, W, 6);
  }

  function drawTrashCan(o) {
    ctx.fillStyle = '#5a6169';
    ctx.fillRect(o.x, o.y - o.h, o.w, o.h);
    ctx.fillStyle = '#454b52';
    ctx.fillRect(o.x, o.y - o.h, o.w, 6);           // lid
    ctx.fillRect(o.x + o.w / 2 - 3, o.y - o.h - 6, 6, 6); // handle
    ctx.fillStyle = '#3d4248';                       // ribs
    for (let i = 8; i < o.h; i += 8) ctx.fillRect(o.x, o.y - i, o.w, 2);
  }

  function drawCoin(c) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e0a92b';
    ctx.beginPath(); ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2); ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#7a5a12'; ctx.font = 'bold 12px Fredoka, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('J', c.x, c.y + 1);
  }

  function draw() {
    drawBg();
    for (const o of obstacles) drawTrashCan(o);
    for (const c of coins) drawCoin(c);
    // Jimothy — scaled pixel painter, anchored to feet
    const s = 3;
    const step = jim.onGround ? Math.floor(frame / 6) : 0;
    drawJimothy(ctx, jim.x, jim.y - 16 * s, s, step);
  }

  function loop() {
    if (!running) return;
    update();
    if (!running) return; // gameOver may have flipped it
    draw();
    requestAnimationFrame(loop);
  }

  function start() {
    reset();
    overlay.classList.add('hidden');
    loop();
  }

  function gameOver() {
    running = false;
    const final = Math.floor(score / 5);
    if (final > best) { best = final; localStorage.setItem('jimothy_best', best); bestEl.textContent = best; }
    overlayTitle.textContent = 'Jimothy tripped! 🦝';
    overlayText.textContent = `Score: ${final} — the short spine strikes again. Tap to run it back.`;
    startBtn.textContent = '▶ Run again';
    overlay.classList.remove('hidden');
    draw();
  }

  // Controls
  startBtn.addEventListener('click', (e) => { e.stopPropagation(); start(); });
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); jump(); }
  });
  cv.addEventListener('mousedown', jump);
  cv.addEventListener('touchstart', (e) => { e.preventDefault(); jump(); }, { passive: false });

  // initial idle frame
  reset(); running = false; draw();
})();
