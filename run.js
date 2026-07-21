/* ============================================================================
   JIMOTHY RUN — endless side-scrolling runner
   Vanilla canvas, no dependencies, no image assets. Uses the Jimothy raccoon.
   Score = distance + collected. Local leaderboard (localStorage).
   ============================================================================ */
(function () {
  'use strict';
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const el = {
    dist: document.getElementById('distVal'), score: document.getElementById('scoreVal'),
    lead: document.getElementById('leadFill'), ammo: document.getElementById('ammoVal'),
    power: document.getElementById('powerBadge'),
    start: document.getElementById('start'), over: document.getElementById('over'),
    playBtn: document.getElementById('playBtn'), retryBtn: document.getElementById('retryBtn'),
    fDist: document.getElementById('fDist'), fScore: document.getElementById('fScore'),
    overTitle: document.getElementById('overTitle'),
    nameRow: document.getElementById('nameRow'), nameInput: document.getElementById('nameInput'), saveBtn: document.getElementById('saveBtn'),
    lbStart: document.getElementById('lbStart'), lbOver: document.getElementById('lbOver'),
    touch: document.getElementById('touch'), jumpBtn: document.getElementById('jumpBtn'), throwBtn: document.getElementById('throwBtn'),
  };

  // ---- layout --------------------------------------------------------------
  let W = 0, H = 0, DPR = 1, groundY = 0, PLAYER_X = 180;
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    groundY = Math.round(H * 0.80); PLAYER_X = Math.max(150, Math.round(W * 0.24));
  }
  window.addEventListener('resize', resize); resize();

  // ---- constants -----------------------------------------------------------
  const GRAV = 0.86, JUMP_V = -15.2, MAX_JUMPS = 2, PPM = 10;
  const FOOD_HEAL = 26, HIT_COST = 16;

  // ---- state ---------------------------------------------------------------
  let player, scrollX, speed, lead, coins, score, ammo, jumps, running, over;
  let obstacles, pits, enemies, coinsArr, pickups, cans, fx;
  let nextSpawn, lastKind, shakeT, shakeMag, magnetT, speedT, shieldOn, invuln, powerTO;

  function reset() {
    player = { y: groundY, vy: 0, onGround: true, run: 0 };
    scrollX = 0; speed = 5.4; lead = 74; coins = 0; score = 0; ammo = 0; jumps = 0;
    obstacles = []; pits = []; enemies = []; coinsArr = []; pickups = []; cans = []; fx = [];
    nextSpawn = W + 300; lastKind = 'flat'; shakeT = 0; shakeMag = 0;
    magnetT = 0; speedT = 0; shieldOn = false; invuln = 0;
    over = false; running = true;
    setHUD();
  }

  // ---- leaderboard ---------------------------------------------------------
  const LB_KEY = 'jimothy_run_lb';
  function loadLB() { try { return JSON.parse(localStorage.getItem(LB_KEY)) || []; } catch (e) { return []; } }
  function saveLB(list) { try { localStorage.setItem(LB_KEY, JSON.stringify(list.slice(0, 10))); } catch (e) {} }
  function renderLB(node, hlIdx) {
    const list = loadLB(); node.innerHTML = '';
    if (!list.length) { const li = document.createElement('li'); li.className = 'lb-empty'; li.textContent = 'No runs yet — be the first!'; li.style.gridColumn = '1/-1'; node.appendChild(li); return; }
    list.forEach((r, i) => { const li = document.createElement('li'); if (i === hlIdx) li.className = 'you'; li.innerHTML = `<span class="nm">${escapeHtml(r.name)}</span><span class="sc">${r.score}</span>`; node.appendChild(li); });
  }
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // ---- spawning ------------------------------------------------------------
  const OB = {
    log: { w: 44, h: 30 }, rock: { w: 40, h: 34 }, bin: { w: 34, h: 46 }, hydrant: { w: 26, h: 40 }, crate: { w: 40, h: 40 },
  };
  function biomeName(x) { return (Math.floor(x / 5000) % 2 === 0) ? 'forest' : 'city'; }
  function spawnFeature() {
    const x = nextSpawn, diff = Math.min(1, scrollX / 12000);
    const b = biomeName(x);
    let kind;
    if (lastKind === 'pit') kind = Math.random() < 0.6 ? 'coins' : 'flat';   // give landing room after a gap
    else { const r = Math.random();
      if (r < 0.22) kind = 'pit'; else if (r < 0.5) kind = 'obstacle'; else if (r < 0.68) kind = 'enemy';
      else if (r < 0.86) kind = 'coins'; else if (r < 0.93) kind = 'food'; else kind = 'power';
    }
    let gap = 300 + Math.random() * 240 - diff * 90;
    if (kind === 'pit') {
      const w = 90 + Math.random() * (90 + diff * 90);
      pits.push({ x, w }); gap = w + 120 + Math.random() * 120;
    } else if (kind === 'obstacle') {
      const set = b === 'forest' ? ['log', 'rock', 'crate'] : ['bin', 'hydrant', 'crate'];
      const ty = set[(Math.random() * set.length) | 0]; const o = OB[ty];
      obstacles.push({ x, w: o.w, h: o.h, ty }); gap = 260 + Math.random() * 220 - diff * 70;
    } else if (kind === 'enemy') {
      const ty = (b === 'city' && Math.random() < 0.5) ? 'human' : 'dog';
      enemies.push({ x, ty, dead: false, vx: ty === 'dog' ? -1.4 : 0, phase: Math.random() * 6 });
      gap = 300 + Math.random() * 240;
    } else if (kind === 'coins') {
      const n = 3 + ((Math.random() * 4) | 0), arc = Math.random() < 0.5;
      for (let i = 0; i < n; i++) coinsArr.push({ x: x + i * 34, y: groundY - 40 - (arc ? Math.sin(i / (n - 1) * Math.PI) * 70 : 26) });
      gap = n * 34 + 180;
    } else if (kind === 'food') {
      pickups.push({ x, y: groundY - 46, kind: 'food' }); gap = 300;
    } else if (kind === 'power') {
      const k = ['can', 'shield', 'speed', 'magnet'][(Math.random() * 4) | 0];
      pickups.push({ x, y: groundY - 52, kind: k }); gap = 320;
    } else { gap = 200 + Math.random() * 160; }
    lastKind = kind;
    nextSpawn += Math.max(150, gap);
  }

  // ---- input ---------------------------------------------------------------
  function doJump() { if (!running) return; if (jumps < MAX_JUMPS) { player.vy = JUMP_V * (jumps === 0 ? 1 : 0.9); player.onGround = false; jumps++; } }
  function doThrow() {
    if (!running || ammo <= 0) return; ammo--; setHUD();
    cans.push({ x: scrollX + PLAYER_X + 14, y: player.y - 30, vx: speed + 8, vy: -4.5 });
  }
  window.addEventListener('keydown', e => {
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'arrowup' || k === 'w') { e.preventDefault(); doJump(); }
    else if (k === 'f' || k === 'arrowdown' || k === 's') { e.preventDefault(); doThrow(); }
  });
  canvas.addEventListener('mousedown', doJump);
  canvas.addEventListener('touchstart', e => { e.preventDefault(); doJump(); }, { passive: false });
  const hold = (btn, fn) => { btn.addEventListener('touchstart', e => { e.preventDefault(); fn(); }, { passive: false }); btn.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); fn(); }); };
  hold(el.jumpBtn, doJump); hold(el.throwBtn, doThrow);
  if ('ontouchstart' in window) el.touch.classList.add('on');

  // ---- helpers -------------------------------------------------------------
  function ellipse(x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.283); ctx.fill(); }
  function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.fill(); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function hx(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(c1, c2, t) { const a = hx(c1), b = hx(c2); return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(lerp(a[1], b[1], t))},${Math.round(lerp(a[2], b[2], t))})`; }
  function overlap(ax, ay, aw, ah, bx, by, bw, bh) { return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by; }

  // ---- biome / colors ------------------------------------------------------
  const FOREST = { skyTop: '#bfe3ff', skyBot: '#e3f5ea', hills: '#a9dcb4', ground: '#7c5836', grass: '#6fae3f' };
  const CITY = { skyTop: '#c7d5e8', skyBot: '#eef2f6', hills: '#9fb0c4', ground: '#6f767d', grass: '#9aa1a8' };
  function biomeBlend() {
    const pos = scrollX % 5000, idx = Math.floor(scrollX / 5000);
    const cur = idx % 2 === 0 ? FOREST : CITY, nxt = idx % 2 === 0 ? CITY : FOREST;
    let t = 0; if (pos > 4100) t = (pos - 4100) / 900;
    return { cur, nxt, t };
  }
  function col(key) { const { cur, nxt, t } = biomeBlend(); return mix(cur[key], nxt[key], t); }

  // ---- update --------------------------------------------------------------
  function update(dt) {
    const dtf = dt / 16.67;
    const diff = Math.min(1, scrollX / 12000);
    speed = (5.4 + diff * 4.2) * (speedT > 0 ? 1.32 : 1);
    scrollX += speed * dtf;

    // lead drains; dog relentless
    lead -= (0.62 * (1 + scrollX / 3000)) * (dt / 1000);
    if (speedT > 0) speedT -= dt; if (magnetT > 0) magnetT -= dt;

    // physics
    player.vy += GRAV * dtf; player.y += player.vy * dtf;
    const pWorld = scrollX + PLAYER_X;
    const overPit = pits.some(p => pWorld + 8 > p.x && pWorld - 8 < p.x + p.w);
    if (!overPit && player.y >= groundY) { player.y = groundY; player.vy = 0; player.onGround = true; jumps = 0; }
    else player.onGround = false;
    if (player.y > H + 80) return gameOver('fell');
    if (player.onGround) player.run += speed * 0.05 * dtf;

    // spawn
    while (nextSpawn < scrollX + W + 300) spawnFeature();

    // enemies move
    for (const e of enemies) if (!e.dead) { e.x += (e.vx || 0) * dtf; e.phase += 0.2 * dtf; }

    // cans
    for (let i = cans.length - 1; i >= 0; i--) { const c = cans[i]; c.x += c.vx * dtf; c.vy += GRAV * dtf; c.y += c.vy * dtf;
      let hit = false;
      for (const e of enemies) if (!e.dead && Math.abs((e.x) - c.x) < 24 && Math.abs((groundY - 20) - c.y) < 40) { e.dead = true; hit = true; score += 15; addFx(e.x - scrollX, groundY - 24, '#ffd23f'); }
      if (hit || c.y > groundY || c.x - scrollX > W + 40) cans.splice(i, 1);
    }

    const pb = { x: pWorld - 18, y: player.y - 44, w: 36, h: 44 };
    // obstacle collisions
    if (invuln > 0) invuln -= dt;
    for (const o of obstacles) if (overlap(pb.x, pb.y, pb.w, pb.h, o.x - o.w / 2, groundY - o.h, o.w, o.h)) takeHit();
    for (const e of enemies) if (!e.dead) { const ew = e.ty === 'human' ? 26 : 34, eh = e.ty === 'human' ? 56 : 30; if (overlap(pb.x, pb.y, pb.w, pb.h, e.x - ew / 2, groundY - eh, ew, eh)) { takeHit(); e.dead = e.ty === 'dog' ? false : e.dead; } }

    // coins
    for (let i = coinsArr.length - 1; i >= 0; i--) { const c = coinsArr[i];
      if (magnetT > 0) { const d = Math.hypot((c.x - scrollX) - PLAYER_X, c.y - (player.y - 24)); if (d < 200) { c.x += ((scrollX + PLAYER_X) - c.x) * 0.18 * dtf; c.y += ((player.y - 24) - c.y) * 0.18 * dtf; } }
      if (overlap(pb.x, pb.y, pb.w, pb.h, c.x - 10, c.y - 10, 20, 20)) { coinsArr.splice(i, 1); coins++; score += 5; addFx(c.x - scrollX, c.y, '#ffd23f'); }
    }
    // pickups
    for (let i = pickups.length - 1; i >= 0; i--) { const p = pickups[i];
      if (overlap(pb.x, pb.y, pb.w, pb.h, p.x - 14, p.y - 14, 28, 28)) { pickups.splice(i, 1); applyPickup(p.kind); }
    }

    // cleanup behind
    const cut = scrollX - 120;
    obstacles = obstacles.filter(o => o.x + o.w > cut); pits = pits.filter(p => p.x + p.w > cut);
    enemies = enemies.filter(e => e.x > cut && !(e.dead && e.ty !== 'dog')); coinsArr = coinsArr.filter(c => c.x > cut);
    pickups = pickups.filter(p => p.x > cut); enemies = enemies.filter(e => e.x > cut);

    score = Math.floor(scrollX / PPM) + coins * 5;
    if (shakeT > 0) shakeT -= dt;
    for (let i = fx.length - 1; i >= 0; i--) { const f = fx[i]; f.x += f.vx * dtf; f.y += f.vy * dtf; f.vy += 0.3 * dtf; f.life -= dt; if (f.life <= 0) fx.splice(i, 1); }

    if (lead <= 0) return gameOver('caught');
    setHUD();
  }
  function takeHit() {
    if (invuln > 0) return;
    invuln = 800;
    if (shieldOn) { shieldOn = false; showPower('Shield broke!', '#7a8a9c'); shake(6); return; }
    lead -= HIT_COST; shake(9);
    addFx(PLAYER_X, player.y - 30, '#e0483c');
  }
  function applyPickup(k) {
    if (k === 'food') { lead = Math.min(100, lead + FOOD_HEAL); showPower('Snack! Dog falls back', '#2fa96b'); addFx(PLAYER_X + 20, player.y - 30, '#2fa96b'); }
    else if (k === 'can') { ammo += 3; showPower('+3 cans to throw', '#4f7cff'); }
    else if (k === 'shield') { shieldOn = true; showPower('Shield up', '#7a8a9c'); }
    else if (k === 'speed') { speedT = 4500; showPower('Speed boost!', '#e0a92b'); }
    else if (k === 'magnet') { magnetT = 6000; showPower('Coin magnet!', '#e0483c'); }
    setHUD();
  }
  function shake(m) { shakeT = 260; shakeMag = m; }
  function addFx(sx, y, c) { for (let i = 0; i < 6; i++) fx.push({ x: sx, y, vx: (Math.random() - 0.5) * 4, vy: -Math.random() * 4 - 1, life: 420, c }); }

  // ---- drawing -------------------------------------------------------------
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, groundY); g.addColorStop(0, col('skyTop')); g.addColorStop(1, col('skyBot'));
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, groundY + 4);
    // sun
    ctx.fillStyle = 'rgba(255,224,138,.9)'; ellipse(W - 90, 84, 34, 34);
    const { cur, nxt, t } = biomeBlend();
    drawFar(cur, 1 - t); drawFar(nxt, t);
    drawMid(cur, 1 - t); drawMid(nxt, t);
  }
  function drawFar(biome, alpha) {
    if (alpha <= 0.02) return; ctx.globalAlpha = alpha;
    const isForest = biome === FOREST, off = (scrollX * 0.2) % 320;
    if (isForest) {
      ctx.fillStyle = biome.hills;
      for (let x = -off - 320; x < W + 320; x += 320) { ctx.beginPath(); ctx.moveTo(x, groundY); ctx.quadraticCurveTo(x + 160, groundY - 150, x + 320, groundY); ctx.fill(); }
    } else {
      for (let x = -((scrollX * 0.2) % 90) - 90, i = 0; x < W + 90; x += 90, i++) {
        const hh = ((Math.floor((scrollX * 0.2) / 90) + i) * 2654435761) >>> 0; const bh = 120 + (hh % 140);
        ctx.fillStyle = biome.hills; ctx.fillRect(x, groundY - bh, 70, bh);
        ctx.fillStyle = 'rgba(255,255,255,.15)'; for (let wy = groundY - bh + 12; wy < groundY - 12; wy += 22) for (let wx = x + 8; wx < x + 62; wx += 18) ctx.fillRect(wx, wy, 8, 10);
      }
    }
    ctx.globalAlpha = 1;
  }
  function drawMid(biome, alpha) {
    if (alpha <= 0.02) return; ctx.globalAlpha = alpha;
    const isForest = biome === FOREST, off = (scrollX * 0.5) % 220;
    for (let x = -off - 220, i = 0; x < W + 220; x += 220, i++) {
      if (isForest) { const bx = x + 110; ctx.fillStyle = '#5b3f24'; ctx.fillRect(bx - 6, groundY - 90, 12, 90); ctx.fillStyle = '#3f8f2f'; ellipse(bx, groundY - 96, 44, 40); ctx.fillStyle = '#4ea33a'; ellipse(bx - 16, groundY - 104, 26, 24); }
      else { const bx = x + 60; const hh = ((Math.floor((scrollX * 0.5) / 220) + i) * 40503) >>> 0; const bh = 150 + (hh % 120); ctx.fillStyle = mix('#7f8ea3', '#6a7890', 0.5); ctx.fillRect(bx, groundY - bh, 96, bh); ctx.fillStyle = 'rgba(255,235,150,.35)'; for (let wy = groundY - bh + 16; wy < groundY - 18; wy += 26) for (let wx = bx + 12; wx < bx + 84; wx += 22) ctx.fillRect(wx, wy, 10, 12); }
    }
    ctx.globalAlpha = 1;
  }
  function drawGround() {
    ctx.fillStyle = col('ground'); ctx.fillRect(0, groundY, W, H - groundY);
    ctx.fillStyle = col('grass'); ctx.fillRect(0, groundY, W, 12);
    ctx.fillStyle = 'rgba(0,0,0,.06)'; const off = scrollX % 40; for (let x = -off; x < W; x += 40) ctx.fillRect(x, groundY + 16, 3, 8);
    // pits (chasms)
    for (const p of pits) { const sx = p.x - scrollX; if (sx > W || sx + p.w < 0) continue;
      const g = ctx.createLinearGradient(0, groundY, 0, H); g.addColorStop(0, '#20140c'); g.addColorStop(1, '#0d0906');
      ctx.fillStyle = g; ctx.fillRect(sx, groundY, p.w, H - groundY);
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(sx - 4, groundY, 4, 14); ctx.fillRect(sx + p.w, groundY, 4, 14);
      ctx.fillStyle = col('grass'); ctx.fillRect(sx - 6, groundY, 6, 12); ctx.fillRect(sx + p.w, groundY, 6, 12);
    }
  }
  function drawObstacle(o) {
    const sx = o.x - scrollX, y = groundY - o.h;
    if (o.ty === 'log') { ctx.fillStyle = '#7c5836'; rrect(sx - o.w / 2, y, o.w, o.h, 8); ctx.fillStyle = '#8a6440'; ellipse(sx - o.w / 2 + 8, y + o.h / 2, 7, o.h / 2 - 3); ctx.strokeStyle = '#5b3f24'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx - o.w / 2 + 8, y + o.h / 2, 4, o.h / 2 - 6, 0, 0, 6.283); ctx.stroke(); }
    else if (o.ty === 'rock') { ctx.fillStyle = '#8a8f96'; ellipse(sx, y + o.h * 0.6, o.w / 2, o.h * 0.55); ctx.fillStyle = '#a4a9b0'; ellipse(sx - 6, y + o.h * 0.4, o.w * 0.3, o.h * 0.3); }
    else if (o.ty === 'bin') { ctx.fillStyle = '#5a6169'; rrect(sx - o.w / 2, y + 6, o.w, o.h - 6, 5); ctx.fillStyle = '#454b52'; rrect(sx - o.w / 2 - 2, y, o.w + 4, 8, 3); ctx.fillStyle = '#3d4249'; for (let i = 12; i < o.h; i += 8) ctx.fillRect(sx - o.w / 2, y + i, o.w, 2); }
    else if (o.ty === 'hydrant') { ctx.fillStyle = '#c14b3a'; rrect(sx - o.w / 2, y + 8, o.w, o.h - 8, 4); ctx.fillStyle = '#d55b49'; ellipse(sx, y + 8, o.w / 2, 8); ctx.fillRect(sx - o.w / 2 - 4, y + 16, o.w + 8, 6); }
    else { ctx.fillStyle = '#a97c46'; rrect(sx - o.w / 2, y, o.w, o.h, 4); ctx.strokeStyle = '#8a6337'; ctx.lineWidth = 2; ctx.strokeRect(sx - o.w / 2 + 3, y + 3, o.w - 6, o.h - 6); ctx.beginPath(); ctx.moveTo(sx - o.w / 2, y); ctx.lineTo(sx + o.w / 2, y + o.h); ctx.moveTo(sx + o.w / 2, y); ctx.lineTo(sx - o.w / 2, y + o.h); ctx.stroke(); }
  }
  function drawEnemyDog(e) {
    const sx = e.x - scrollX, sw = Math.sin(e.phase) * 3;
    ctx.save(); ctx.translate(sx, groundY); // faces left (toward player)
    ctx.fillStyle = '#3a2e24'; rrect(-10 - sw, -9, 5, 10, 2); rrect(6 + sw, -9, 5, 10, 2);
    ctx.fillStyle = '#6a4b33'; ellipse(0, -16, 15, 10); ellipse(-14, -19, 9, 8);
    ctx.fillStyle = '#3a2e24'; ellipse(-17, -25, 4, 5);
    ctx.fillStyle = '#111'; ellipse(-17, -19, 1.8, 2);
    ctx.fillStyle = '#1a1a1a'; ellipse(-21, -17, 3, 2.4);
    ctx.strokeStyle = '#6a4b33'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(14, -16); ctx.quadraticCurveTo(24, -20, 20, -28); ctx.stroke();
    ctx.restore();
  }
  function drawEnemyHuman(e) {
    const sx = e.x - scrollX, sw = Math.sin(e.phase) * 2;
    ctx.save(); ctx.translate(sx, groundY);
    ctx.fillStyle = '#2e3a4a'; rrect(-8, -22 + sw, 7, 22, 3); rrect(1, -22 - sw, 7, 22, 3);   // legs
    ctx.fillStyle = '#c14b3a'; rrect(-11, -46, 22, 26, 6);                                     // torso
    ctx.fillStyle = '#e8b98f'; ellipse(0, -54, 9, 9);                                          // head
    ctx.fillStyle = '#4a3526'; ctx.beginPath(); ctx.arc(0, -56, 9, Math.PI, 0); ctx.fill();     // hair
    ctx.fillStyle = '#e8b98f'; rrect(-15, -44, 5, 20, 2);                                       // arm
    ctx.restore();
  }
  function drawCoin(c) { const sx = c.x - scrollX; ctx.fillStyle = '#ffd23f'; ellipse(sx, c.y, 10, 10); ctx.strokeStyle = '#e0a92b'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(sx, c.y, 10, 0, 6.283); ctx.stroke(); ctx.fillStyle = '#7a5a12'; ctx.font = '700 12px Fredoka'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('J', sx, c.y + 1); }
  function drawPickup(p) {
    const sx = p.x - scrollX, y = p.y + Math.sin(scrollX / 40 + p.x) * 3;
    if (p.kind === 'food') { ctx.fillStyle = '#c8783a'; rrect(sx - 11, y - 7, 22, 14, 4); ctx.fillStyle = '#e0a05a'; rrect(sx - 11, y - 7, 22, 5, 3); ctx.fillStyle = '#7a4a24'; ellipse(sx - 4, y + 2, 2, 2); ellipse(sx + 4, y + 1, 2, 2); return; }
    const map = { can: ['#4f7cff', 'C'], shield: ['#7a8a9c', 'D'], speed: ['#e0a92b', 'S'], magnet: ['#e0483c', 'M'] };
    const m = map[p.kind]; ctx.fillStyle = '#fff'; ellipse(sx, y, 15, 15); ctx.fillStyle = m[0]; ellipse(sx, y, 12, 12); ctx.fillStyle = '#fff'; ctx.font = '700 14px Fredoka'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(m[1], sx, y + 1);
  }
  function drawCan(c) { const sx = c.x - scrollX; ctx.save(); ctx.translate(sx, c.y); ctx.rotate(scrollX * 0.02 + c.x); ctx.fillStyle = '#4f7cff'; rrect(-6, -9, 12, 18, 3); ctx.fillStyle = '#cdd9f5'; ctx.fillRect(-6, -3, 12, 3); ctx.restore(); }

  // side-view running Jimothy (faces right)
  function drawJimothy(sx, feetY) {
    const air = !player.onGround, ph = player.run;
    ctx.save(); ctx.translate(sx, feetY);
    ctx.fillStyle = 'rgba(15,23,42,.16)'; ellipse(0, air ? 3 : 2, 22, 6);
    // tail (behind, left, ringed)
    ctx.save(); ctx.translate(-18, -22); ctx.rotate(-0.4 + Math.sin(ph) * 0.06);
    for (let i = 0; i < 5; i++) { ctx.fillStyle = i % 2 ? '#232327' : '#7f848c'; ellipse(-i * 6, -i * 3, 8 - i * 0.5, 7 - i * 0.4); }
    ctx.restore();
    // legs
    ctx.fillStyle = '#26262b';
    if (air) { rrect(-12, -8, 8, 10, 3); rrect(4, -8, 8, 10, 3); }
    else { const s = Math.sin(ph) * 7, s2 = Math.sin(ph + Math.PI) * 7; rrect(-11 + s, -9, 7, 11 - Math.abs(s) * 0.3, 3); rrect(4 + s2, -9, 7, 11 - Math.abs(s2) * 0.3, 3); }
    // body (leaning forward)
    const g = ctx.createRadialGradient(4, -30, 4, 0, -26, 26); g.addColorStop(0, '#9aa0a8'); g.addColorStop(1, '#7f848c');
    ctx.fillStyle = g; ctx.save(); ctx.rotate(0.12); ellipse(0, -26, 20, 16); ctx.restore();
    ctx.fillStyle = '#d9d6cf'; ellipse(2, -18, 11, 8);
    // head (right)
    ctx.fillStyle = '#6c7178'; ellipse(16, -34, 6, 7);                 // ear
    ctx.fillStyle = '#20202a'; ellipse(16, -35, 3, 4);
    ctx.fillStyle = '#9aa0a8'; ellipse(20, -28, 13, 12);               // head
    ctx.fillStyle = '#d9d6cf'; ellipse(28, -26, 7, 6);                 // snout
    ctx.fillStyle = '#20202a'; ctx.beginPath(); ctx.ellipse(20, -31, 8, 6, 0.2, 0, 6.283); ctx.fill();  // mask
    ctx.fillStyle = '#efece5'; ellipse(22, -31, 3.4, 3.2);
    ctx.fillStyle = '#111'; ellipse(23, -31, 1.7, 2);
    ctx.fillStyle = '#141416'; ellipse(33, -26, 2.4, 2);              // nose
    if (invuln > 0 && Math.floor(invuln / 100) % 2 === 0) { ctx.globalAlpha = 0.5; }
    ctx.restore();
    if (shieldOn) { ctx.strokeStyle = 'rgba(120,180,255,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(sx + 4, feetY - 26, 30, 30, 0, 0, 6.283); ctx.stroke(); }
  }

  // chasing dog behind the player — closeness driven by `lead`
  function drawChaser() {
    const gap = 30 + lead * 2.1, cx = PLAYER_X - gap;
    if (cx < -70) return;
    const feetY = groundY, sw = Math.sin(scrollX * 0.06) * 4;
    ctx.save(); ctx.translate(cx, feetY);
    ctx.fillStyle = 'rgba(15,23,42,.18)'; ellipse(0, 2, 26, 7);
    ctx.fillStyle = '#2b221a'; rrect(-14 - sw, -11, 7, 13, 3); rrect(8 + sw, -11, 7, 13, 3);
    ctx.fillStyle = lead < 30 ? '#7a3a2a' : '#5e4230'; ellipse(0, -20, 22, 14); ellipse(20, -26, 13, 12);   // body + head (faces right, toward player)
    ctx.fillStyle = '#2b221a'; ellipse(24, -36, 5, 7);
    ctx.fillStyle = '#111'; ellipse(24, -26, 2.2, 2.6);
    ctx.fillStyle = '#1a1a1a'; ellipse(31, -23, 4, 3);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(28, -20); ctx.lineTo(33, -19); ctx.lineTo(28, -17); ctx.fill();  // teeth
    ctx.strokeStyle = '#5e4230'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(-20, -22); ctx.quadraticCurveTo(-32, -28, -26, -38); ctx.stroke();
    ctx.restore();
  }

  function render() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    let ox = 0, oy = 0; if (shakeT > 0) { ox = (Math.random() - 0.5) * shakeMag; oy = (Math.random() - 0.5) * shakeMag; }
    ctx.clearRect(0, 0, W, H); ctx.save(); ctx.translate(ox, oy);
    drawBackground();
    drawGround();
    for (const o of obstacles) if (o.x - scrollX > -60 && o.x - scrollX < W + 60) drawObstacle(o);
    for (const p of pickups) if (p.x - scrollX > -40 && p.x - scrollX < W + 40) drawPickup(p);
    for (const c of coinsArr) if (c.x - scrollX > -30 && c.x - scrollX < W + 30) drawCoin(c);
    for (const e of enemies) if (!e.dead && e.x - scrollX > -60 && e.x - scrollX < W + 60) (e.ty === 'dog' ? drawEnemyDog : drawEnemyHuman)(e);
    for (const c of cans) drawCan(c);
    drawChaser();
    drawJimothy(PLAYER_X, player.y);
    for (const f of fx) { ctx.globalAlpha = Math.max(0, f.life / 420); ctx.fillStyle = f.c; ellipse(f.x, f.y, 3, 3); ctx.globalAlpha = 1; }
    ctx.restore();
  }

  // ---- HUD -----------------------------------------------------------------
  function setHUD() {
    el.dist.textContent = Math.floor(scrollX / PPM);
    el.score.textContent = score;
    el.ammo.textContent = ammo;
    const pct = Math.max(0, Math.min(100, lead));
    el.lead.style.width = pct + '%'; el.lead.classList.toggle('low', pct <= 32);
  }
  function showPower(txt, c) { el.power.textContent = txt; el.power.style.background = c; el.power.classList.add('show'); clearTimeout(powerTO); powerTO = setTimeout(() => el.power.classList.remove('show'), 1500); }

  // ---- lifecycle -----------------------------------------------------------
  let last = 0;
  function frame(now) { const dt = Math.min(42, now - last); last = now; if (running && !over) update(dt); if (player) render(); requestAnimationFrame(frame); }

  function gameOver(reason) {
    if (over) return; over = true; running = false;
    const finalScore = Math.floor(scrollX / PPM) + coins * 5, finalDist = Math.floor(scrollX / PPM);
    el.overTitle.textContent = reason === 'fell' ? 'Down the hole!' : 'The dog got you!';
    el.fDist.textContent = finalDist; el.fScore.textContent = finalScore;
    const list = loadLB(); const qualifies = list.length < 10 || finalScore > (list[list.length - 1] ? list[list.length - 1].score : 0);
    pendingScore = { score: finalScore, dist: finalDist };
    el.nameRow.classList.toggle('hidden', !qualifies || finalScore <= 0);
    renderLB(el.lbOver, -1);
    el.over.classList.remove('hidden');
  }
  let pendingScore = null;
  function saveScore() {
    if (!pendingScore) return;
    const name = (el.nameInput.value || 'Jimothy').slice(0, 12);
    const list = loadLB(); list.push({ name, score: pendingScore.score, dist: pendingScore.dist });
    list.sort((a, b) => b.score - a.score); saveLB(list);
    const idx = list.findIndex(r => r.name === name && r.score === pendingScore.score);
    renderLB(el.lbOver, idx); el.nameRow.classList.add('hidden'); pendingScore = null;
    try { localStorage.setItem('jimothy_run_name', name); } catch (e) {}
  }
  el.saveBtn.addEventListener('click', saveScore);
  el.nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveScore(); });

  function startRun() { el.start.classList.add('hidden'); el.over.classList.add('hidden'); reset(); }
  el.playBtn.addEventListener('click', startRun);
  el.retryBtn.addEventListener('click', startRun);

  // boot
  try { const nm = localStorage.getItem('jimothy_run_name'); if (nm) el.nameInput.value = nm; } catch (e) {}
  reset(); running = false; over = false;
  renderLB(el.lbStart, -1);
  requestAnimationFrame(frame);

  window.RUN = { state: function () { return { scrollX: Math.round(scrollX), lead: lead, score: score, coins: coins, ammo: ammo, obstacles: obstacles.length, pits: pits.length, enemies: enemies.length, y: Math.round(player.y), onGround: player.onGround, over: over }; }, give: function (k) { applyPickup(k); }, setLead: function (v) { lead = v; }, hit: function () { takeHit(); }, thrw: function () { doThrow(); } };
})();
