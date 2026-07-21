/* ============================================================================
   JIMOTHY RUN 3D — side-view endless runner in real 3D (Three.js r128)
   Low-poly models built from primitives (no external assets). Real ground
   with gaps, AABB collisions, shadows, fog, biome blend, a chasing dog that
   physically hops obstacles and chasms. Score = distance + loot. Local board.
   ============================================================================ */
(function () {
  'use strict';
  const T = window.THREE;

  // ---- DOM -----------------------------------------------------------------
  const el = {
    dist: document.getElementById('distVal'), score: document.getElementById('scoreVal'),
    lead: document.getElementById('leadFill'), ammo: document.getElementById('ammoVal'),
    power: document.getElementById('powerBadge'),
    start: document.getElementById('start'), over: document.getElementById('over'),
    playBtn: document.getElementById('playBtn'), retryBtn: document.getElementById('retryBtn'),
    fDist: document.getElementById('fDist'), fScore: document.getElementById('fScore'), overTitle: document.getElementById('overTitle'),
    nameRow: document.getElementById('nameRow'), nameInput: document.getElementById('nameInput'), saveBtn: document.getElementById('saveBtn'),
    lbStart: document.getElementById('lbStart'), lbOver: document.getElementById('lbOver'),
    touch: document.getElementById('touch'), jumpBtn: document.getElementById('jumpBtn'), throwBtn: document.getElementById('throwBtn'),
  };

  // ---- renderer / scene ----------------------------------------------------
  const canvas = document.getElementById('game');
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputEncoding = T.sRGBEncoding;

  const scene = new T.Scene();
  const SKY_F = new T.Color('#bfe3ff'), SKY_C = new T.Color('#c7d5e8');
  scene.background = SKY_F.clone();
  scene.fog = new T.Fog(SKY_F.clone(), 26, 68);

  const camera = new T.PerspectiveCamera(50, 1, 0.1, 200);
  function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  window.addEventListener('resize', resize); resize();

  // lights
  const hemi = new T.HemisphereLight(0xffffff, 0x88aa77, 0.85); scene.add(hemi);
  const sun = new T.DirectionalLight(0xfff2d6, 1.05);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -18; sun.shadow.camera.right = 18; sun.shadow.camera.top = 18; sun.shadow.camera.bottom = -18;
  sun.shadow.bias = -0.0005;
  scene.add(sun); scene.add(sun.target);

  // ---- shared materials ----------------------------------------------------
  const L = (c, opts) => new T.MeshLambertMaterial(Object.assign({ color: new T.Color(c) }, opts || {}));
  const MAT = {
    fur: L('#8b9099'), fur2: L('#9aa0a8'), belly: L('#d9d6cf'), dark: L('#22222b'), ear: L('#6c7178'),
    dogBody: L('#6a4b33'), dogDark: L('#3a2e24'), chaser: L('#5e4230'),
    skin: L('#e8b98f'), cloth: L('#c14b3a'), pants: L('#2e3a4a'), hair: L('#4a3526'),
    wood: L('#7c5836'), woodDark: L('#5b3f24'), leaf1: L('#3f8f2f'), leaf2: L('#4ea33a'), leaf3: L('#5cb343'),
    stone: L('#8a8f96'), bin: L('#5a6169'), binLid: L('#454b52'), red: L('#c14b3a'), crate: L('#a97c46'),
    gold: L('#ffd23f'), goldEdge: L('#e0a92b'), can: L('#4f7cff'),
    grass: L('#62a83a'), dirt: L('#7c5836'),
    bldg: L('#8794a6'), bldg2: L('#6f7c90'), win: L('#ffe79a'),
    pow: { can: L('#4f7cff'), shield: L('#8a97a6'), speed: L('#e0a92b'), magnet: L('#e0483c'), food: L('#c8783a') },
  };
  MAT.pow.shield.emissive = new T.Color('#223');
  const GRASS_F = new T.Color('#62a83a'), GRASS_C = new T.Color('#9aa1a8');
  const DIRT_F = new T.Color('#7c5836'), DIRT_C = new T.Color('#6f767d');

  // ---- shared geometries ---------------------------------------------------
  const box = (w, h, d) => new T.BoxGeometry(w, h, d);
  const sph = (r, a, b) => new T.SphereGeometry(r, a || 12, b || 10);
  const cyl = (rt, rb, h, s) => new T.CylinderGeometry(rt, rb, h, s || 12);

  function mesh(geo, mat, cast) { const m = new T.Mesh(geo, mat); if (cast !== false) { m.castShadow = true; } return m; }

  // ---- model builders ------------------------------------------------------
  function buildRaccoon(palBody, palBody2, palEar, dogTailDark) {
    const g = new T.Group(); g.legs = [];
    // tail (segments, angled back = -X)
    const tail = new T.Group(); tail.position.set(-0.5, 0.55, 0);
    for (let i = 0; i < 5; i++) { const seg = mesh(sph(0.22 - i * 0.02), i % 2 ? MAT.dark : palBody); seg.position.set(-i * 0.2, i * 0.12, 0); tail.add(seg); }
    tail.rotation.z = 0.5; g.add(tail); g.tail = tail;
    // legs
    const legGeo = cyl(0.1, 0.09, 0.4, 8);
    const legPos = [[-0.28, 0.2], [0.05, 0.2], [-0.28, -0.2], [0.05, -0.2]];
    for (const [lx, lz] of legPos) { const leg = mesh(legGeo, MAT.dark); leg.position.set(lx, 0.2, lz); const piv = new T.Group(); piv.position.set(lx, 0.4, lz); leg.position.set(0, -0.2, 0); piv.add(leg); g.add(piv); g.legs.push(piv); }
    // body (lean forward +X)
    const body = mesh(sph(0.5), palBody2); body.scale.set(1.15, 1, 0.95); body.position.set(0, 0.62, 0); body.rotation.z = -0.12; g.add(body);
    const belly = mesh(sph(0.32), MAT.belly); belly.scale.set(1, 0.8, 0.9); belly.position.set(0.18, 0.5, 0); g.add(belly);
    // head at front (+X)
    const head = mesh(sph(0.34), palBody2); head.position.set(0.5, 0.85, 0); g.add(head);
    const snout = mesh(sph(0.18), MAT.belly); snout.scale.set(1.2, 0.9, 0.9); snout.position.set(0.78, 0.78, 0); g.add(snout);
    const nose = mesh(sph(0.07), MAT.dark); nose.position.set(0.92, 0.78, 0); g.add(nose);
    // mask (dark band) + eyes on both sides
    for (const sz of [-1, 1]) {
      const mask = mesh(sph(0.13), MAT.dark); mask.scale.set(0.8, 0.9, 0.5); mask.position.set(0.6, 0.92, sz * 0.16); g.add(mask);
      const eye = mesh(sph(0.06), MAT.belly); eye.position.set(0.66, 0.93, sz * 0.16); g.add(eye);
      const pup = mesh(sph(0.03), MAT.dark, false); pup.position.set(0.71, 0.93, sz * 0.16); g.add(pup);
      const ear = mesh(sph(0.13), palEar); ear.scale.set(0.7, 1, 0.5); ear.position.set(0.4, 1.12, sz * 0.2); g.add(ear);
    }
    return g;
  }
  function buildDog(bodyMat, faceDir) {
    const g = new T.Group(); g.legs = [];
    const legGeo = cyl(0.09, 0.08, 0.36, 8);
    for (const [lx, lz] of [[-0.32, 0.16], [0.2, 0.16], [-0.32, -0.16], [0.2, -0.16]]) { const piv = new T.Group(); piv.position.set(lx, 0.36, lz); const leg = mesh(legGeo, MAT.dogDark); leg.position.set(0, -0.18, 0); piv.add(leg); g.add(piv); g.legs.push(piv); }
    const body = mesh(sph(0.42), bodyMat); body.scale.set(1.3, 0.9, 0.8); body.position.set(0, 0.55, 0); g.add(body);
    const head = mesh(sph(0.3), bodyMat); head.position.set(0.55, 0.62, 0); g.add(head);
    const snout = mesh(box(0.28, 0.16, 0.2), MAT.dogDark); snout.position.set(0.82, 0.55, 0); g.add(snout);
    for (const sz of [-1, 1]) { const ear = mesh(sph(0.1), MAT.dogDark); ear.scale.set(0.6, 1, 0.5); ear.position.set(0.5, 0.86, sz * 0.16); g.add(ear); const eye = mesh(sph(0.04), MAT.dark, false); eye.position.set(0.66, 0.66, sz * 0.13); g.add(eye); }
    const tail = mesh(cyl(0.04, 0.08, 0.4, 6), bodyMat); tail.position.set(-0.5, 0.7, 0); tail.rotation.z = -0.8; g.add(tail);
    g.rotation.y = faceDir < 0 ? Math.PI : 0;   // faceDir -1 → face -X
    return g;
  }
  function buildHuman() {
    const g = new T.Group(); g.legs = [];
    for (const lx of [-0.14, 0.14]) { const piv = new T.Group(); piv.position.set(lx, 0.9, 0); const leg = mesh(cyl(0.11, 0.1, 0.9, 8), MAT.pants); leg.position.set(0, -0.45, 0); piv.add(leg); g.add(piv); g.legs.push(piv); }
    const torso = mesh(box(0.5, 0.7, 0.32), MAT.cloth); torso.position.set(0, 1.3, 0); g.add(torso);
    const head = mesh(sph(0.22), MAT.skin); head.position.set(0, 1.85, 0); g.add(head);
    const hair = mesh(sph(0.24, 10, 6), MAT.hair); hair.scale.set(1, 0.7, 1); hair.position.set(0, 1.95, 0); g.add(hair);
    for (const sx of [-1, 1]) { const arm = mesh(cyl(0.08, 0.07, 0.6, 6), MAT.skin); arm.position.set(sx * 0.33, 1.3, 0); g.add(arm); }
    g.rotation.y = Math.PI; // face -X (toward the runner)
    return g;
  }
  function buildObstacle(ty) {
    const g = new T.Group(); let box2;
    if (ty === 'log') { const m = mesh(cyl(0.35, 0.35, 1.6, 12), MAT.wood); m.rotation.x = Math.PI / 2; m.position.y = 0.35; g.add(m); const r = mesh(cyl(0.36, 0.36, 0.05, 12), MAT.woodDark); r.rotation.z = Math.PI / 2; r.position.set(0, 0.35, 0.8); g.add(r); box2 = { hw: 0.42, hh: 0.35 }; }
    else if (ty === 'rock') { const m = mesh(new T.IcosahedronGeometry(0.55, 0), MAT.stone); m.position.y = 0.45; m.rotation.set(0.4, 0.6, 0.2); g.add(m); box2 = { hw: 0.5, hh: 0.5 }; }
    else if (ty === 'bin') { const m = mesh(cyl(0.32, 0.28, 1.0, 12), MAT.bin); m.position.y = 0.5; g.add(m); const lid = mesh(cyl(0.36, 0.36, 0.1, 12), MAT.binLid); lid.position.y = 1.02; g.add(lid); box2 = { hw: 0.34, hh: 0.6 }; }
    else if (ty === 'hydrant') { const m = mesh(cyl(0.2, 0.24, 0.8, 10), MAT.red); m.position.y = 0.4; g.add(m); const cap = mesh(sph(0.22), MAT.red); cap.position.y = 0.82; g.add(cap); const arm = mesh(box(0.6, 0.14, 0.14), MAT.red); arm.position.y = 0.55; g.add(arm); box2 = { hw: 0.3, hh: 0.5 }; }
    else { const m = mesh(box(0.8, 0.8, 0.8), MAT.crate); m.position.y = 0.4; g.add(m); box2 = { hw: 0.4, hh: 0.4 }; }
    g.userData.box = box2; return g;
  }
  function buildCoin() { const g = new T.Group(); const m = mesh(cyl(0.32, 0.32, 0.08, 18), MAT.gold); m.rotation.x = Math.PI / 2; g.add(m); const rim = mesh(new T.TorusGeometry(0.32, 0.04, 8, 20), MAT.goldEdge); g.add(rim); g.position.y = 1; return g; }
  function buildPowerup(kind) { const g = new T.Group(); const core = mesh(new T.IcosahedronGeometry(0.34, 0), MAT.pow[kind]); g.add(core); g.position.y = 1; g.userData.kind = kind; return g; }
  function buildFood() { const g = new T.Group(); const b = mesh(box(0.5, 0.3, 0.4), MAT.pow.food); b.position.y = 0.2; g.add(b); const top = mesh(box(0.52, 0.12, 0.42), MAT.crate); top.position.y = 0.4; g.add(top); g.position.y = 0.7; return g; }
  function buildCan() { const g = new T.Group(); const m = mesh(cyl(0.12, 0.12, 0.34, 10), MAT.can); g.add(m); return g; }
  function buildTree() { const g = new T.Group(); const tr = mesh(cyl(0.18, 0.24, 2.2, 8), MAT.wood); tr.position.y = 1.1; g.add(tr); const cols = [MAT.leaf1, MAT.leaf2, MAT.leaf3]; for (let i = 0; i < 3; i++) { const c = mesh(sph(1.1 - i * 0.22, 10, 8), cols[i]); c.position.y = 2.4 + i * 0.5; g.add(c); } return g; }
  function buildBuilding(h) { const g = new T.Group(); const b = mesh(box(2.4, h, 2.4), Math.random() < 0.5 ? MAT.bldg : MAT.bldg2); b.position.y = h / 2; g.add(b); for (let wy = 1; wy < h - 0.6; wy += 1.1) for (let wx = -0.7; wx <= 0.7; wx += 0.7) { const w = mesh(box(0.4, 0.5, 0.05), MAT.win, false); w.position.set(wx, wy, 1.21); g.add(w); } return g; }
  function buildShadow() { const m = new T.Mesh(new T.CircleGeometry(0.55, 16), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22 })); m.rotation.x = -Math.PI / 2; m.position.y = 0.02; return m; }

  // ---- world state ---------------------------------------------------------
  let player, playerModel, chaser, chaserModel, ground, deco, obstacles, enemies, coins, pickups, cans, particles;
  let scrollSpeed, lead, coinsN, score, ammo, jumps, running, over, nextSpawn, lastKind, nextDeco, groundTiles, invuln, magnetT, speedT, shieldOn, powerTO;
  const LANE = 0, GRAV = 34, JUMP_V = 12.4;

  function clearGroup(arr) { for (const o of arr) scene.remove(o.mesh || o); arr.length = 0; }

  function reset() {
    // clean up
    if (obstacles) { clearGroup(obstacles); clearGroup(enemies); clearGroup(coins); clearGroup(pickups); clearGroup(cans); clearGroup(particles); clearGroup(deco); for (const k in groundTiles) scene.remove(groundTiles[k]); }
    obstacles = []; enemies = []; coins = []; pickups = []; cans = []; particles = []; deco = []; groundTiles = {};

    player = { x: 0, y: 0, vy: 0, onGround: true, run: 0 };
    if (!playerModel) { playerModel = buildRaccoon(MAT.fur, MAT.fur2, MAT.ear); playerModel.pShadow = buildShadow(); scene.add(playerModel); scene.add(playerModel.pShadow); }
    playerModel.position.set(0, 0, LANE);

    chaser = { x: -6, y: 0, vy: 0, onGround: true, run: 0 };
    if (!chaserModel) { chaserModel = buildDog(MAT.chaser, 1); chaserModel.cShadow = buildShadow(); scene.add(chaserModel); scene.add(chaserModel.cShadow); }

    scrollSpeed = 9; lead = 74; coinsN = 0; score = 0; ammo = 0; jumps = 0;
    nextSpawn = 16; lastKind = 'flat'; nextDeco = 6; invuln = 0; magnetT = 0; speedT = 0; shieldOn = false;
    running = true; over = false;
    ensureGround(); setHUD();
  }

  // ---- ground with gaps ----------------------------------------------------
  const TILE = 2, HALF = 30;
  let pits = [];
  function inPit(x) { for (const p of pits) if (x > p.x0 && x < p.x1) return true; return false; }
  function ensureGround() {
    const i0 = Math.floor((player.x - 12) / TILE), i1 = Math.floor((player.x + HALF) / TILE);
    for (let i = i0; i <= i1; i++) {
      const cx = i * TILE + TILE / 2;
      if (inPit(cx)) { if (groundTiles[i]) { scene.remove(groundTiles[i]); delete groundTiles[i]; } continue; }
      if (!groundTiles[i]) {
        const g = new T.Group();
        const grass = mesh(box(TILE + 0.02, 0.3, 6), MAT.grass, false); grass.position.y = -0.15; grass.receiveShadow = true; g.add(grass);
        const dirt = mesh(box(TILE + 0.02, 2.4, 6), MAT.dirt, false); dirt.position.y = -1.5; g.add(dirt);
        g.position.x = cx; scene.add(g); groundTiles[i] = g;
      }
    }
    for (const k in groundTiles) { if (+k < i0 - 1 || +k > i1 + 1) { scene.remove(groundTiles[k]); delete groundTiles[k]; } }
    pits = pits.filter(p => p.x1 > player.x - 14);
  }

  // ---- spawning ------------------------------------------------------------
  function biomeName(x) { return (Math.floor(x / 120) % 2 === 0) ? 'forest' : 'city'; }
  function add(list, model, x, extra) { model.position.x = x; if (model.position.z === 0 && (extra && extra.z !== undefined)) model.position.z = extra.z; scene.add(model); const o = Object.assign({ mesh: model, x }, extra || {}); list.push(o); return o; }
  function spawnFeature() {
    const x = nextSpawn, diff = Math.min(1, player.x / 400), b = biomeName(x);
    let kind;
    if (lastKind === 'pit') kind = Math.random() < 0.6 ? 'coins' : 'flat';
    else { const r = Math.random(); if (r < 0.2) kind = 'pit'; else if (r < 0.48) kind = 'obstacle'; else if (r < 0.66) kind = 'enemy'; else if (r < 0.85) kind = 'coins'; else if (r < 0.92) kind = 'food'; else kind = 'power'; }
    let gap = 7 + Math.random() * 4 - diff * 2;
    if (kind === 'pit') { const w = 2.4 + Math.random() * (1.4 + diff * 1.6); pits.push({ x0: x - w / 2, x1: x + w / 2 }); gap = w + 5 + Math.random() * 3; }
    else if (kind === 'obstacle') { const set = b === 'forest' ? ['log', 'rock', 'crate'] : ['bin', 'hydrant', 'crate']; const ty = set[(Math.random() * set.length) | 0]; const m = buildObstacle(ty); const o = add(obstacles, m, x); o.box = m.userData.box; o.sh = buildShadow(); o.sh.position.set(x, 0.02, 0); scene.add(o.sh); gap = 6 + Math.random() * 4 - diff * 1.5; }
    else if (kind === 'enemy') { const ty = (b === 'city' && Math.random() < 0.5) ? 'human' : 'dog'; const m = ty === 'dog' ? buildDog(MAT.dogBody, -1) : buildHuman(); const o = add(enemies, m, x, { ty, dead: false, vx: ty === 'dog' ? -3 : -0.6, run: 0 }); o.sh = buildShadow(); scene.add(o.sh); gap = 8 + Math.random() * 4; }
    else if (kind === 'coins') { const n = 3 + ((Math.random() * 4) | 0), arc = Math.random() < 0.5; for (let i = 0; i < n; i++) { const m = buildCoin(); m.position.y = 1 + (arc ? Math.sin(i / (n - 1) * Math.PI) * 1.4 : 0.3); add(coins, m, x + i * 1.1); } gap = n * 1.1 + 5; }
    else if (kind === 'food') { add(pickups, buildFood(), x, { kind: 'food' }); gap = 8; }
    else if (kind === 'power') { const k = ['can', 'shield', 'speed', 'magnet'][(Math.random() * 4) | 0]; add(pickups, buildPowerup(k), x, { kind: k }); gap = 8; }
    else gap = 5 + Math.random() * 4;
    lastKind = kind; nextSpawn += Math.max(4, gap);
  }
  function spawnDeco() {
    const b = biomeName(nextDeco), far = -6 - Math.random() * 9;
    if (b === 'forest') { const t = buildTree(); const s = 0.7 + Math.random() * 0.7; t.scale.setScalar(s); add(deco, t, nextDeco, { z: far }); if (Math.random() < 0.4) { const t2 = buildTree(); t2.scale.setScalar(0.6); add(deco, t2, nextDeco + 2, { z: 5 + Math.random() * 3 }); } }
    else { const h = 4 + Math.random() * 7; add(deco, buildBuilding(h), nextDeco, { z: far - 2 }); }
    nextDeco += 4 + Math.random() * 4;
  }

  // ---- input ---------------------------------------------------------------
  function doJump() { if (!running) return; if (jumps < 2) { player.vy = JUMP_V * (jumps === 0 ? 1 : 0.9); player.onGround = false; jumps++; } }
  function doThrow() { if (!running || ammo <= 0) return; ammo--; setHUD(); const m = buildCan(); const o = add(cans, m, player.x + 0.6, { y: player.y + 1, vx: scrollSpeed + 9, vy: 3 }); m.position.set(player.x + 0.6, player.y + 1, LANE); }
  window.addEventListener('keydown', e => { const k = e.key.toLowerCase(); if (k === ' ' || k === 'arrowup' || k === 'w') { e.preventDefault(); doJump(); } else if (k === 'f' || k === 'arrowdown' || k === 's') { e.preventDefault(); doThrow(); } });
  canvas.addEventListener('mousedown', doJump);
  canvas.addEventListener('touchstart', e => { e.preventDefault(); doJump(); }, { passive: false });
  const hold = (btn, fn) => { btn.addEventListener('touchstart', e => { e.preventDefault(); fn(); }, { passive: false }); btn.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); fn(); }); };
  hold(el.jumpBtn, doJump); hold(el.throwBtn, doThrow);
  if ('ontouchstart' in window) el.touch.classList.add('on');

  // ---- combat / effects ----------------------------------------------------
  function takeHit() { if (invuln > 0) return; invuln = 0.8; if (shieldOn) { shieldOn = false; showPower('Shield broke!', '#7a8a9c'); return; } lead -= 16; puff(player.x, player.y + 1, 0xe0483c); }
  function applyPickup(k) {
    if (k === 'food') { lead = Math.min(100, lead + 26); showPower('Snack! Dog falls back', '#2fa96b'); puff(player.x, player.y + 1, 0x2fa96b); }
    else if (k === 'can') { ammo += 3; showPower('+3 cans to throw', '#4f7cff'); }
    else if (k === 'shield') { shieldOn = true; showPower('Shield up', '#7a8a9c'); }
    else if (k === 'speed') { speedT = 4.5; showPower('Speed boost!', '#e0a92b'); }
    else if (k === 'magnet') { magnetT = 6; showPower('Coin magnet!', '#e0483c'); }
    setHUD();
  }
  function puff(x, y, color) { for (let i = 0; i < 8; i++) { const m = new T.Mesh(new T.SphereGeometry(0.08, 6, 6), new T.MeshBasicMaterial({ color })); m.position.set(x, y, LANE); scene.add(m); particles.push({ mesh: m, vx: (Math.random() - 0.5) * 4, vy: Math.random() * 4, vz: (Math.random() - 0.5) * 3, life: 0.5 }); } }

  // ---- update --------------------------------------------------------------
  function update(dt) {
    const diff = Math.min(1, player.x / 400);
    scrollSpeed = (9 + diff * 6) * (speedT > 0 ? 1.3 : 1);
    player.x += scrollSpeed * dt;
    lead -= (0.6 * (1 + player.x / 260)) * dt;
    if (speedT > 0) speedT -= dt; if (magnetT > 0) magnetT -= dt; if (invuln > 0) invuln -= dt;

    // player physics
    player.vy -= GRAV * dt; player.y += player.vy * dt;
    const overPit = inPit(player.x);
    if (!overPit && player.y <= 0) { player.y = 0; player.vy = 0; player.onGround = true; jumps = 0; }
    else player.onGround = false;
    if (player.y < -4) return gameOver('fell');
    if (player.onGround) player.run += scrollSpeed * dt * 1.4;

    // spawn
    while (nextSpawn < player.x + 46) spawnFeature();
    while (nextDeco < player.x + 60) spawnDeco();
    ensureGround();

    // chaser: closer when your lead is LOW; hops obstacles & gaps so it never clips through
    const targetX = player.x - (2.0 + Math.max(0, lead) * 0.08);
    chaser.x += (targetX - chaser.x) * Math.min(1, dt * 6);
    chaser.vy -= GRAV * dt; chaser.y += chaser.vy * dt;
    const cOverPit = inPit(chaser.x + 0.4);
    if (!cOverPit && chaser.y <= 0) { chaser.y = 0; chaser.vy = 0; chaser.onGround = true; }
    else chaser.onGround = false;
    if (chaser.onGround) { // auto-hop upcoming hazard
      let hazard = inPit(chaser.x + 1.6) || inPit(chaser.x + 2.4);
      for (const o of obstacles) if (Math.abs(o.x - (chaser.x + 1.8)) < 0.9) hazard = true;
      if (hazard) { chaser.vy = JUMP_V * 0.92; chaser.onGround = false; }
      chaser.run += scrollSpeed * dt * 1.5;
    }
    if (chaser.y < -4) { chaser.x = player.x - 3; chaser.y = 0; chaser.vy = 0; } // relentless: climbs back out

    // enemies
    for (const e of enemies) { if (e.dead) continue; e.x += e.vx * dt; e.run += dt * 8; }

    // cans
    for (let i = cans.length - 1; i >= 0; i--) { const c = cans[i]; c.x += c.vx * dt; c.vy -= GRAV * dt; c.y += c.vy * dt; c.mesh.position.set(c.x, c.y, LANE); c.mesh.rotation.z += dt * 12;
      let hit = false;
      for (const e of enemies) if (!e.dead && Math.abs(e.x - c.x) < 0.7 && c.y < 1.6) { e.dead = true; hit = true; score += 15; puff(e.x, 0.8, 0xffd23f); scene.remove(e.mesh); if (e.sh) scene.remove(e.sh); }
      if (hit || c.y < 0 || c.x < player.x - 6) { scene.remove(c.mesh); cans.splice(i, 1); }
    }

    // collisions with obstacles / enemies (AABB in x,y)
    const pHalfW = 0.42, pTop = player.y + 1.3, pBot = player.y + 0.1;
    for (const o of obstacles) { const b = o.box; if (Math.abs(o.x - player.x) < b.hw + pHalfW && pBot < b.hh * 2 && pBot < b.hh * 2) { if (Math.abs(o.x - player.x) < b.hw + pHalfW && player.y < b.hh * 2 - 0.1) takeHit(); } }
    for (const e of enemies) { if (e.dead) continue; const eh = e.ty === 'human' ? 1.9 : 0.9; if (Math.abs(e.x - player.x) < 0.6 && player.y < eh - 0.1) { takeHit(); } }

    // coins
    for (let i = coins.length - 1; i >= 0; i--) { const c = coins[i]; c.mesh.rotation.y += dt * 4;
      if (magnetT > 0 && Math.abs(c.x - player.x) < 4) { c.x += (player.x - c.x) * dt * 5; c.mesh.position.y += ((player.y + 1) - c.mesh.position.y) * dt * 5; }
      if (Math.abs(c.x - player.x) < 0.7 && Math.abs(c.mesh.position.y - (player.y + 1)) < 1.2) { scene.remove(c.mesh); coins.splice(i, 1); coinsN++; score += 5; puff(c.x, c.mesh.position.y, 0xffd23f); }
    }
    // pickups
    for (let i = pickups.length - 1; i >= 0; i--) { const p = pickups[i]; p.mesh.rotation.y += dt * 2; p.mesh.position.y = (p.kind === 'food' ? 0.7 : 1) + Math.sin(performance.now() / 300 + p.x) * 0.12;
      if (Math.abs(p.x - player.x) < 0.8 && player.y < 1.6) { scene.remove(p.mesh); pickups.splice(i, 1); applyPickup(p.kind); }
    }

    // cleanup behind
    const cut = player.x - 14;
    const cull = (arr) => { for (let i = arr.length - 1; i >= 0; i--) if (arr[i].x < cut) { scene.remove(arr[i].mesh); if (arr[i].sh) scene.remove(arr[i].sh); arr.splice(i, 1); } };
    cull(obstacles); cull(enemies); cull(coins); cull(pickups); cull(deco);

    // particles
    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.vy -= 12 * dt; p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt; p.life -= dt; if (p.life <= 0) { scene.remove(p.mesh); particles.splice(i, 1); } }

    score = Math.max(score, Math.floor(player.x) + coinsN * 5);
    if (lead <= 0) return gameOver('caught');

    syncModels(dt);
    updateBiome();
    setHUD();
  }

  function animLegs(model, run, air) { if (!model.legs) return; for (let i = 0; i < model.legs.length; i++) { model.legs[i].rotation.x = air ? -0.5 : Math.sin(run + i * Math.PI) * 0.7; } }
  function syncModels(dt) {
    playerModel.position.set(player.x, player.y, LANE);
    playerModel.rotation.z = player.onGround ? 0 : -0.1;
    animLegs(playerModel, player.run, !player.onGround);
    if (playerModel.tail) playerModel.tail.rotation.x = Math.sin(player.run) * 0.15;
    playerModel.pShadow.position.set(player.x, 0.02, LANE); playerModel.pShadow.material.opacity = 0.22 * Math.max(0, 1 - player.y / 3);
    if (playerModel.shield !== shieldOn) { playerModel.shield = shieldOn; }
    chaserModel.position.set(chaser.x, chaser.y, LANE);
    animLegs(chaserModel, chaser.run, !chaser.onGround);
    chaserModel.cShadow.position.set(chaser.x, 0.02, LANE); chaserModel.cShadow.material.opacity = 0.22 * Math.max(0, 1 - chaser.y / 3);
    for (const e of enemies) { if (e.dead) continue; e.mesh.position.set(e.x, 0, LANE); animLegs(e.mesh, e.run, false); if (e.sh) e.sh.position.set(e.x, 0.02, LANE); }
    for (const o of obstacles) o.mesh.position.x = o.x;
    for (const c of coins) c.mesh.position.x = c.x;
    for (const p of pickups) p.mesh.position.x = p.x;

    // camera + sun follow (player sits ~1/3 from the left; the chaser stays visible behind)
    camera.position.set(player.x - 0.5, 5.2, 18);
    camera.lookAt(player.x + 3.5, 2.2, 0);
    sun.position.set(player.x + 6, 16, 10); sun.target.position.set(player.x + 4, 0, 0);
  }

  const _cA = new T.Color(), _cB = new T.Color();
  function updateBiome() {
    const pos = ((player.x % 120) + 120) % 120, idx = Math.floor(player.x / 120);
    let t = 0; if (pos > 100) t = (pos - 100) / 20;
    const forestCur = idx % 2 === 0;
    const skyA = forestCur ? SKY_F : SKY_C, skyB = forestCur ? SKY_C : SKY_F;
    _cA.copy(skyA).lerp(skyB, t); scene.background.copy(_cA); scene.fog.color.copy(_cA);
    _cA.copy(forestCur ? GRASS_F : GRASS_C).lerp(forestCur ? GRASS_C : GRASS_F, t); MAT.grass.color.copy(_cA);
    _cA.copy(forestCur ? DIRT_F : DIRT_C).lerp(forestCur ? DIRT_C : DIRT_F, t); MAT.dirt.color.copy(_cA);
  }

  // ---- HUD -----------------------------------------------------------------
  function setHUD() { el.dist.textContent = Math.floor(player.x); el.score.textContent = score; el.ammo.textContent = ammo; const pct = Math.max(0, Math.min(100, lead)); el.lead.style.width = pct + '%'; el.lead.classList.toggle('low', pct <= 32); }
  function showPower(txt, c) { el.power.textContent = txt; el.power.style.background = c; el.power.classList.add('show'); clearTimeout(powerTO); powerTO = setTimeout(() => el.power.classList.remove('show'), 1500); }

  // ---- leaderboard ---------------------------------------------------------
  const LB_KEY = 'jimothy_run_lb';
  function loadLB() { try { return JSON.parse(localStorage.getItem(LB_KEY)) || []; } catch (e) { return []; } }
  function saveLB(l) { try { localStorage.setItem(LB_KEY, JSON.stringify(l.slice(0, 10))); } catch (e) {} }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  function renderLB(node, hl) { const l = loadLB(); node.innerHTML = ''; if (!l.length) { const li = document.createElement('li'); li.className = 'lb-empty'; li.textContent = 'No runs yet — be the first!'; li.style.gridColumn = '1/-1'; node.appendChild(li); return; } l.forEach((r, i) => { const li = document.createElement('li'); if (i === hl) li.className = 'you'; li.innerHTML = `<span class="nm">${esc(r.name)}</span><span class="sc">${r.score}</span>`; node.appendChild(li); }); }

  // ---- lifecycle -----------------------------------------------------------
  let last = 0, pending = null;
  function frame(now) { const dt = Math.min(0.04, (now - last) / 1000); last = now; if (running && !over && player) update(dt); if (player) renderer.render(scene, camera); requestAnimationFrame(frame); }

  function gameOver(reason) {
    if (over) return; over = true; running = false;
    const fs = Math.floor(player.x) + coinsN * 5;
    el.overTitle.textContent = reason === 'fell' ? 'Down the hole!' : 'The dog got you!';
    el.fDist.textContent = Math.floor(player.x); el.fScore.textContent = fs;
    const list = loadLB(); const q = list.length < 10 || fs > (list[list.length - 1] ? list[list.length - 1].score : 0);
    pending = { score: fs, dist: Math.floor(player.x) };
    el.nameRow.classList.toggle('hidden', !q || fs <= 0);
    renderLB(el.lbOver, -1); el.over.classList.remove('hidden');
  }
  function saveScore() { if (!pending) return; const name = (el.nameInput.value || 'Jimothy').slice(0, 12); const l = loadLB(); l.push({ name, score: pending.score, dist: pending.dist }); l.sort((a, b) => b.score - a.score); saveLB(l); renderLB(el.lbOver, l.findIndex(r => r.name === name && r.score === pending.score)); el.nameRow.classList.add('hidden'); pending = null; try { localStorage.setItem('jimothy_run_name', name); } catch (e) {} }
  el.saveBtn.addEventListener('click', saveScore);
  el.nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveScore(); });
  function startRun() { el.start.classList.add('hidden'); el.over.classList.add('hidden'); reset(); }
  el.playBtn.addEventListener('click', startRun);
  el.retryBtn.addEventListener('click', startRun);

  try { const nm = localStorage.getItem('jimothy_run_name'); if (nm) el.nameInput.value = nm; } catch (e) {}
  reset(); running = false; over = false; syncModels(0);
  renderLB(el.lbStart, -1);
  requestAnimationFrame(frame);

  window.RUN3D = { state: function () { return { x: Math.round(player.x), lead: Math.round(lead), score: score, coins: coinsN, ammo: ammo, obstacles: obstacles.length, enemies: enemies.length, pits: pits.length, coins3: coins.length, y: +player.y.toFixed(2), onGround: player.onGround, chaserX: +chaser.x.toFixed(1), over: over }; }, give: function (k) { applyPickup(k); }, setLead: function (v) { lead = v; }, hit: function () { takeHit(); } };
})();
