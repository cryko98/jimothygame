/* ============================================================================
   JIMOTHY RUN 3D — side-view endless runner in real 3D (Three.js r128)
   3 lives · solid ground on both sides (no floating props) · catchers that
   walk at you · clear labelled power-ups · eyes on the raccoon & dogs ·
   persistent on-screen controls · precise collision · mobile-optimised.
   ============================================================================ */
(function () {
  'use strict';
  const T = window.THREE;
  const MOBILE = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (('ontouchstart' in window) && Math.min(window.innerWidth, window.innerHeight) < 820);

  const el = {
    dist: document.getElementById('distVal'), score: document.getElementById('scoreVal'), lives: document.getElementById('lives'),
    lead: document.getElementById('leadFill'), ammo: document.getElementById('ammoVal'), power: document.getElementById('powerBadge'),
    start: document.getElementById('start'), over: document.getElementById('over'),
    playBtn: document.getElementById('playBtn'), retryBtn: document.getElementById('retryBtn'),
    fDist: document.getElementById('fDist'), fScore: document.getElementById('fScore'), overTitle: document.getElementById('overTitle'),
    nameRow: document.getElementById('nameRow'), nameInput: document.getElementById('nameInput'), saveBtn: document.getElementById('saveBtn'),
    lbStart: document.getElementById('lbStart'), lbOver: document.getElementById('lbOver'),
    touch: document.getElementById('touch'), jumpBtn: document.getElementById('jumpBtn'), throwBtn: document.getElementById('throwBtn'),
  };

  // ---- renderer / scene ----------------------------------------------------
  const canvas = document.getElementById('game');
  const renderer = new T.WebGLRenderer({ canvas, antialias: !MOBILE, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, MOBILE ? 1.5 : 2));
  renderer.shadowMap.enabled = !MOBILE; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputEncoding = T.sRGBEncoding;

  const scene = new T.Scene();
  const SKY_F = new T.Color('#a9dcf2'), SKY_C = new T.Color('#c3cede');
  scene.background = SKY_F.clone();
  scene.fog = new T.Fog(SKY_F.clone(), MOBILE ? 24 : 30, MOBILE ? 56 : 80);

  const camera = new T.PerspectiveCamera(50, 1, 0.1, 220);
  function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  window.addEventListener('resize', resize); resize();

  const hemi = new T.HemisphereLight(0xffffff, 0x8a9a70, 0.82); scene.add(hemi);
  const sun = new T.DirectionalLight(0xfff1d4, 1.0);
  if (!MOBILE) { sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.near = 1; sun.shadow.camera.far = 70; sun.shadow.camera.left = -20; sun.shadow.camera.right = 20; sun.shadow.camera.top = 20; sun.shadow.camera.bottom = -20; sun.shadow.bias = -0.0005; }
  scene.add(sun); scene.add(sun.target);

  // ---- materials -----------------------------------------------------------
  const L = (c, o) => new T.MeshLambertMaterial(Object.assign({ color: new T.Color(c) }, o || {}));
  const Bm = (c, o) => new T.MeshBasicMaterial(Object.assign({ color: new T.Color(c) }, o || {}));
  const MAT = {
    fur: L('#948f83'), fur2: L('#a8a296'), belly: L('#d9d3c4'), mask: L('#1b1b1f'), face: L('#efe9db'),
    nose: L('#131316'), ear: L('#6f6a5e'), paw: L('#26241e'), ring: L('#2a2720'),
    eyeW: L('#ffffff'), eyeP: L('#141318'), eyeR: L('#e0483c'),
    dog: L('#7a5636'), dogDark: L('#4a3524'), dogChase: L('#5a3f2b'), collar: L('#c53a2f'), tongue: L('#e06a7a'),
    skin: L('#e6b48a'), cap: L('#2f6d4a'), shirt: L('#3c6ea5'), pants: L('#39434f'), shoe: L('#20242b'), net: L('#c9cdd2'), pole: L('#8a7150'),
    wood: L('#7c5836'), woodDark: L('#5b3f24'), leaf1: L('#3f8f2f'), leaf2: L('#4ea33a'), leaf3: L('#5cb343'),
    stone: L('#8b8f96'), stoneDk: L('#6f747c'), bin: L('#586069'), binLid: L('#454b52'), hyd: L('#c14b3a'), crate: L('#a97c46'), crateDk: L('#7f5d33'),
    gold: L('#ffd23f'), goldEdge: L('#e0a92b'), can: L('#4f7cff'), canLip: L('#cdd9f5'),
    mush: L('#e0563e'), flower1: L('#f2739e'), flower2: L('#f6c343'), flowerC: L('#fff2c4'), bush: L('#3f9142'), bushHi: L('#57b95a'),
    lamp: L('#3a4048'), lampGlow: L('#ffe79a'), bench: L('#8a6a44'), benchLeg: L('#3a4048'), bag: L('#33383e'),
    curb: L('#b9bcc0'), line: Bm('#f2ede0'), chasm: L('#160f09'),
    field: L('#5fa437'), fieldB: L('#6cb040'), dirt: L('#7c5836'), cloud: L('#ffffff'), hill: L('#9fd4a6'),
    bldg: L('#93a0b2'), bldg2: L('#79879b'), win: L('#ffe79a'), winOff: L('#5b6675'),
    shield: L('#8fb4e8'), shieldEdge: L('#3c6ea5'), speed: L('#f6c343'), magnet: L('#e0483c'), magTip: L('#d7dade'), heart: L('#e0483c'),
    signBoard: L('#fdf3d6'),
  };
  MAT.lampGlow.emissive = new T.Color('#7a6a2a');
  const FIELD_F = new T.Color('#5fa437'), FIELD_C = new T.Color('#8f969d'), FIELDB_F = new T.Color('#6cb040'), FIELDB_C = new T.Color('#a1a8ae');
  const DIRT_F = new T.Color('#7c5836'), DIRT_C = new T.Color('#6b6f66'), CURB_F = new T.Color('#8a7a55'), CURB_C = new T.Color('#c2c5c9');
  // extra materials for a busier, more colourful world
  const CITY_MATS = ['#c8563e', '#2f9ea0', '#d99a2b', '#4f7cc0', '#d07a4a', '#7a5a9e', '#4fa05e', '#c94f6d', '#e07b3a'].map(c => L(c));
  const AWN_MATS = ['#e0483c', '#2f9ea0', '#e0a72b', '#4f7cc0', '#7a5a9e'].map(c => L(c));
  const CAR_MATS = ['#c8563e', '#2f6db0', '#e0a72b', '#3a9e5e', '#5a5f6a', '#c94f6d'].map(c => L(c));
  Object.assign(MAT, {
    cone: L('#e0672b'), coneW: L('#f2ede0'), mailbox: L('#2f6db0'), carGlass: L('#8fc0e0'), carDark: L('#2a2e35'),
    metal: L('#7a7f86'), metalDk: L('#4a4f56'), pot: L('#b5603a'), fern: L('#4a8f3a'), pine1: L('#2f7a44'), pine2: L('#3a8f50'),
    trunk2: L('#6b4a2a'), sign1: L('#e0483c'), sign2: L('#2f9ea0'), sign3: L('#e0a72b'), tank: L('#9aa0a8'), root: L('#4a3524'),
    holeDk: L('#0e0906'), rimDirt: L('#5b4126'), coverMetal: L('#6a6f76'),
  });

  const box = (w, h, d) => new T.BoxGeometry(w, h, d), sph = (r, a, b) => new T.SphereGeometry(r, a || 12, b || 10), cyl = (a, b, h, s) => new T.CylinderGeometry(a, b, h, s || 12);
  function M(geo, mat, cast) { const m = new T.Mesh(geo, mat); if (cast && !MOBILE) m.castShadow = true; return m; }
  function eyePair(parent, x, y, z, r, pupilMat) { for (const sz of [-1, 1]) { const w = M(sph(r, 8, 6), MAT.eyeW); w.position.set(x, y, sz * z); parent.add(w); const p = M(sph(r * 0.55, 6, 6), pupilMat || MAT.eyeP); p.position.set(x + r * 0.5, y, sz * z); parent.add(p); } }

  // ---- Jimothy: chunky short body, blunt big head, raccoon-coloured, eyes --
  function buildRaccoon() {
    const g = new T.Group(); g.legs = [];
    const tail = new T.Group(); tail.position.set(-0.42, 0.48, 0); tail.rotation.z = 0.7;
    for (let i = 0; i < 6; i++) { const s = M(sph(0.26 - i * 0.02, 10, 8), i % 2 ? MAT.ring : MAT.fur, true); s.position.set(-i * 0.17, i * 0.05, 0); tail.add(s); }
    g.add(tail); g.tail = tail;
    const legGeo = cyl(0.13, 0.12, 0.32, 8);
    for (const [lx, lz] of [[-0.26, 0.22], [0.12, 0.22], [-0.26, -0.22], [0.12, -0.22]]) { const piv = new T.Group(); piv.position.set(lx, 0.32, lz); const leg = M(legGeo, MAT.paw, true); leg.position.y = -0.16; const paw = M(sph(0.13, 8, 6), MAT.paw); paw.position.y = -0.3; paw.scale.set(1, 0.6, 1.1); piv.add(leg); piv.add(paw); g.add(piv); g.legs.push(piv); }
    const body = M(sph(0.56), MAT.fur, true); body.scale.set(1.12, 0.9, 1.06); body.position.set(-0.02, 0.5, 0); g.add(body);
    const back = M(sph(0.4), MAT.fur2, true); back.scale.set(1, 0.8, 1); back.position.set(-0.18, 0.66, 0); g.add(back);
    const belly = M(sph(0.34), MAT.belly); belly.scale.set(1.05, 0.8, 0.95); belly.position.set(0.16, 0.4, 0); g.add(belly);
    const head = new T.Group(); head.position.set(0.4, 0.74, 0); head.rotation.z = -0.12; g.add(head); g.head = head;
    head.add(function () { const s = M(sph(0.44), MAT.fur2, true); s.scale.set(1, 0.98, 1.02); return s; }());
    const forehead = M(sph(0.34), MAT.face); forehead.scale.set(0.9, 0.7, 0.95); forehead.position.set(0.16, 0.16, 0); head.add(forehead);
    const snout = M(sph(0.22, 10, 8), MAT.face); snout.scale.set(1.1, 0.82, 0.92); snout.position.set(0.34, -0.12, 0); head.add(snout);
    const nose = M(sph(0.09, 8, 6), MAT.nose); nose.position.set(0.53, -0.14, 0); head.add(nose);
    for (const sz of [-1, 1]) { const mk = M(sph(0.17, 10, 8), MAT.mask); mk.scale.set(0.85, 0.7, 0.55); mk.position.set(0.2, 0.02, sz * 0.2); head.add(mk); const ear = M(sph(0.16, 10, 8), MAT.ear, true); ear.scale.set(0.7, 0.9, 0.5); ear.position.set(-0.02, 0.4, sz * 0.26); head.add(ear); const earIn = M(sph(0.09, 8, 6), MAT.mask); earIn.scale.set(0.6, 0.8, 0.4); earIn.position.set(0.02, 0.4, sz * 0.28); head.add(earIn); }
    const bridge = M(box(0.16, 0.12, 0.34), MAT.mask); bridge.position.set(0.22, 0.06, 0); head.add(bridge);
    eyePair(head, 0.3, 0.04, 0.19, 0.088, MAT.eyeP);  // white eyes with pupils, set into the mask
    return g;
  }

  function buildDog(bodyMat, faceDir, chase) {
    const g = new T.Group(); g.legs = [];
    const legGeo = cyl(0.1, 0.09, 0.4, 8);
    for (const [lx, lz] of [[-0.34, 0.17], [0.24, 0.17], [-0.34, -0.17], [0.24, -0.17]]) { const piv = new T.Group(); piv.position.set(lx, 0.4, lz); const leg = M(legGeo, MAT.dogDark, true); leg.position.y = -0.2; const paw = M(box(0.16, 0.1, 0.18), MAT.dogDark); paw.position.y = -0.4; piv.add(leg); piv.add(paw); g.add(piv); g.legs.push(piv); }
    const body = M(sph(0.46), bodyMat, true); body.scale.set(1.35, 0.92, 0.86); body.position.set(0, 0.6, 0); g.add(body);
    const chest = M(sph(0.34), bodyMat, true); chest.position.set(0.36, 0.56, 0); g.add(chest);
    const neck = M(cyl(0.22, 0.26, 0.4, 10), bodyMat, true); neck.position.set(0.5, 0.72, 0); neck.rotation.z = -0.7; g.add(neck);
    const head = M(sph(0.3, 12, 10), bodyMat, true); head.position.set(0.72, 0.9, 0); g.add(head);
    if (chase) {
      const upper = M(box(0.34, 0.13, 0.26), MAT.dogDark); upper.position.set(1.0, 0.9, 0); g.add(upper);
      for (let i = 0; i < 3; i++) { const t = M(new T.ConeGeometry(0.035, 0.09, 4), MAT.eyeW); t.position.set(0.9 + i * 0.09, 0.82, 0); g.add(t); }
      const jaw = new T.Group(); jaw.position.set(0.84, 0.82, 0);
      const low = M(box(0.34, 0.12, 0.24), MAT.dogDark); low.position.set(0.18, -0.06, 0); jaw.add(low);
      const tongue = M(box(0.13, 0.04, 0.16), MAT.tongue); tongue.position.set(0.22, -0.02, 0); jaw.add(tongue);
      for (let i = 0; i < 3; i++) { const t = M(new T.ConeGeometry(0.035, 0.09, 4), MAT.eyeW); t.rotation.x = Math.PI; t.position.set(0.06 + i * 0.09, 0.02, 0); jaw.add(t); }
      g.add(jaw); g.jaw = jaw;
    } else { const muzzle = M(box(0.34, 0.2, 0.24), MAT.dogDark); muzzle.position.set(1.0, 0.82, 0); g.add(muzzle); }
    const nose = M(sph(0.08, 8, 6), MAT.nose); nose.position.set(1.18, 0.94, 0); g.add(nose);
    for (const sz of [-1, 1]) { const ear = M(box(0.1, 0.28, 0.16), MAT.dogDark, true); ear.position.set(0.64, 1.02, sz * 0.2); ear.rotation.z = 0.4; g.add(ear); }
    // white eyes with pupils (red for the chaser)
    for (const sz of [-1, 1]) { const w = M(sph(0.075, 8, 6), MAT.eyeW); w.position.set(0.88, 1.0, sz * 0.16); g.add(w); const p = M(sph(0.04, 6, 6), chase ? MAT.eyeR : MAT.eyeP); p.position.set(0.94, 1.0, sz * 0.16); g.add(p); const brow = M(box(0.12, 0.04, 0.1), MAT.dogDark); brow.position.set(0.86, 1.08, sz * 0.16); brow.rotation.z = sz * 0.2 - 0.3; g.add(brow); }
    const collar = M(new T.TorusGeometry(0.26, 0.05, 8, 16), MAT.collar); collar.position.set(0.56, 0.74, 0); collar.rotation.y = Math.PI / 2; g.add(collar);
    const tag = M(sph(0.05, 6, 6), MAT.gold); tag.position.set(0.56, 0.5, 0); g.add(tag);
    const tail = M(cyl(0.05, 0.1, 0.5, 6), bodyMat, true); tail.position.set(-0.6, 0.85, 0); tail.rotation.z = -1.1; g.add(tail);
    g.rotation.y = faceDir < 0 ? Math.PI : 0;
    return g;
  }

  function buildHuman() {
    const g = new T.Group(); g.legs = []; g.arms = [];
    for (const lx of [-0.15, 0.15]) { const piv = new T.Group(); piv.position.set(lx, 0.92, 0); const leg = M(cyl(0.12, 0.1, 0.92, 8), MAT.pants, true); leg.position.y = -0.46; const shoe = M(box(0.2, 0.14, 0.34), MAT.shoe); shoe.position.set(0.04, -0.9, 0.05); piv.add(leg); piv.add(shoe); g.add(piv); g.legs.push(piv); }
    const torso = M(box(0.54, 0.74, 0.36), MAT.shirt, true); torso.position.set(0, 1.32, 0); g.add(torso);
    const belt = M(box(0.56, 0.1, 0.38), MAT.pants); belt.position.set(0, 0.98, 0); g.add(belt);
    const neck = M(cyl(0.1, 0.1, 0.14, 8), MAT.skin); neck.position.set(0, 1.75, 0); g.add(neck);
    const head = M(sph(0.24, 12, 10), MAT.skin, true); head.position.set(0, 1.96, 0); g.add(head);
    const cap = M(sph(0.26, 12, 8), MAT.cap); cap.scale.set(1, 0.7, 1); cap.position.set(0, 2.06, 0); g.add(cap);
    const brim = M(box(0.34, 0.05, 0.24), MAT.cap); brim.position.set(-0.2, 2.0, 0); g.add(brim);
    // eyes + nose (facing -X toward the runner → features on -X side after the yaw)
    for (const sz of [-1, 1]) { const w = M(sph(0.045, 6, 6), MAT.eyeW); w.position.set(-0.18, 1.98, sz * 0.09); g.add(w); const p = M(sph(0.025, 6, 6), MAT.eyeP); p.position.set(-0.21, 1.98, sz * 0.09); g.add(p); }
    const nose = M(sph(0.04, 6, 6), MAT.skin); nose.position.set(-0.24, 1.92, 0); g.add(nose);
    const armL = new T.Group(); armL.position.set(-0.34, 1.55, 0); const la = M(cyl(0.09, 0.08, 0.66, 6), MAT.shirt, true); la.position.y = -0.33; const lh = M(sph(0.09, 6, 6), MAT.skin); lh.position.y = -0.66; armL.add(la); armL.add(lh); g.add(armL); g.arms.push(armL);
    const armR = new T.Group(); armR.position.set(0.34, 1.5, 0); const ra = M(cyl(0.09, 0.08, 0.66, 6), MAT.shirt, true); ra.position.y = -0.33; const rh = M(sph(0.09, 6, 6), MAT.skin); rh.position.y = -0.66; armR.add(ra); armR.add(rh); armR.rotation.z = 0.7; g.add(armR); g.arms.push(armR);
    // net on a pole, held forward (toward the runner, -X)
    const net = new T.Group(); net.position.set(-0.5, 1.05, 0); net.rotation.z = -0.5;
    const pole = M(cyl(0.04, 0.04, 1.5, 6), MAT.pole); pole.rotation.z = Math.PI / 2; net.add(pole);
    const ring = M(new T.TorusGeometry(0.3, 0.035, 6, 16), MAT.net); ring.position.set(-0.85, 0, 0); net.add(ring);
    const bag = new T.Mesh(sph(0.28, 8, 6), new T.MeshLambertMaterial({ color: 0xc9cdd2, transparent: true, opacity: 0.45, side: T.DoubleSide })); bag.position.set(-0.92, -0.05, 0); bag.scale.set(1, 1.1, 1); net.add(bag);
    g.add(net);
    g.rotation.y = Math.PI;
    return g;
  }

  // ---- obstacles -----------------------------------------------------------
  function buildObstacle(ty) {
    const g = new T.Group(); let bx;
    if (ty === 'log') { const m = M(cyl(0.36, 0.36, 1.7, 14), MAT.wood, true); m.rotation.x = Math.PI / 2; m.position.y = 0.36; g.add(m); for (const zz of [-0.85, 0.85]) { const r = M(cyl(0.37, 0.37, 0.06, 14), MAT.woodDark); r.rotation.x = Math.PI / 2; r.position.set(0, 0.36, zz); g.add(r); } const rings = M(new T.TorusGeometry(0.18, 0.04, 6, 12), MAT.woodDark); rings.position.set(0, 0.36, 0.86); g.add(rings); bx = { hw: 0.42, top: 0.72 }; }
    else if (ty === 'rock') { const m = M(new T.DodecahedronGeometry(0.56, 0), MAT.stone, true); m.position.y = 0.42; m.rotation.set(0.5, 0.6, 0.2); g.add(m); const m2 = M(new T.DodecahedronGeometry(0.3, 0), MAT.stoneDk, true); m2.position.set(0.4, 0.24, 0.2); g.add(m2); bx = { hw: 0.5, top: 0.9 }; }
    else if (ty === 'bin') { const m = M(cyl(0.34, 0.3, 1.05, 14), MAT.bin, true); m.position.y = 0.52; g.add(m); const lid = M(cyl(0.38, 0.38, 0.1, 14), MAT.binLid, true); lid.position.y = 1.06; g.add(lid); const h = M(box(0.1, 0.06, 0.16), MAT.binLid); h.position.y = 1.14; g.add(h); bx = { hw: 0.36, top: 1.1 }; }
    else if (ty === 'hydrant') { const m = M(cyl(0.2, 0.26, 0.7, 12), MAT.hyd, true); m.position.y = 0.35; g.add(m); const cap = M(sph(0.22, 10, 8), MAT.hyd); cap.position.y = 0.74; g.add(cap); const arm = M(cyl(0.07, 0.07, 0.7, 8), MAT.hyd); arm.rotation.z = Math.PI / 2; arm.position.y = 0.5; g.add(arm); for (const sx of [-0.35, 0.35]) { const c = M(cyl(0.1, 0.1, 0.08, 10), MAT.hyd); c.rotation.z = Math.PI / 2; c.position.set(sx, 0.5, 0); g.add(c); } bx = { hw: 0.3, top: 0.86 }; }
    else { const m = M(box(0.82, 0.82, 0.82), MAT.crate, true); m.position.y = 0.41; g.add(m); const frame = M(box(0.86, 0.12, 0.86), MAT.crateDk); frame.position.y = 0.41; g.add(frame); for (const sy of [0.1, 0.72]) { const f = M(box(0.86, 0.1, 0.86), MAT.crateDk); f.position.y = sy; g.add(f); } bx = { hw: 0.42, top: 0.82 }; }
    g.userData.box = bx; return g;
  }

  function buildCoin() { const g = new T.Group(); const m = M(cyl(0.32, 0.32, 0.08, 20), MAT.gold, true); m.rotation.x = Math.PI / 2; g.add(m); const rim = M(new T.TorusGeometry(0.32, 0.045, 8, 22), MAT.goldEdge); g.add(rim); g.position.y = 1; return g; }

  // ---- clear power-ups: distinct shape + floating label -------------------
  function makeLabel(text, color) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 80; const x = c.getContext('2d');
    x.fillStyle = 'rgba(27,36,48,0.86)'; roundRect(x, 8, 8, 240, 64, 18); x.fill();
    x.fillStyle = color || '#ffffff'; x.font = '700 46px Fredoka, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 128, 44);
    const tex = new T.CanvasTexture(c); tex.anisotropy = 2;
    const m = new T.Mesh(new T.PlaneGeometry(1.05, 0.33), new T.MeshBasicMaterial({ map: tex, transparent: true }));
    m.position.y = 0.72; return m;
  }
  function roundRect(x, a, b, w, h, r) { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); }
  function buildPowerup(kind) {
    const g = new T.Group(); g.userData.kind = kind;
    if (kind === 'can') { const c = M(cyl(0.16, 0.16, 0.44, 12), MAT.can, true); g.add(c); const lip = M(cyl(0.17, 0.17, 0.06, 12), MAT.canLip); lip.position.y = 0.23; g.add(lip); const band = M(cyl(0.165, 0.165, 0.1, 12), MAT.canLip); g.add(band); g.add(makeLabel('CAN', '#8fb4ff')); }
    else if (kind === 'shield') { const disc = M(cyl(0.34, 0.34, 0.1, 6), MAT.shield, true); disc.rotation.x = Math.PI / 2; g.add(disc); const rim = M(new T.TorusGeometry(0.34, 0.05, 6, 6), MAT.shieldEdge); g.add(rim); const cv = M(box(0.1, 0.34, 0.06), MAT.shieldEdge); cv.position.z = 0.06; g.add(cv); const ch = M(box(0.34, 0.1, 0.06), MAT.shieldEdge); ch.position.z = 0.06; g.add(ch); g.add(makeLabel('SHIELD', '#bcd4f7')); }
    else if (kind === 'speed') { for (let i = 0; i < 3; i++) { const ar = M(new T.ConeGeometry(0.2, 0.34, 4), MAT.speed, true); ar.rotation.z = -Math.PI / 2; ar.position.x = -0.2 + i * 0.24; g.add(ar); } g.add(makeLabel('SPEED', '#ffe08a')); }
    else if (kind === 'magnet') { for (const sx of [-0.16, 0.16]) { const bar = M(box(0.14, 0.5, 0.16), MAT.magnet, true); bar.position.set(sx, 0.06, 0); g.add(bar); const tip = M(box(0.14, 0.12, 0.16), MAT.magTip); tip.position.set(sx, -0.24, 0); g.add(tip); } const arc = M(new T.TorusGeometry(0.16, 0.07, 6, 8, Math.PI), MAT.magnet); arc.position.y = 0.3; g.add(arc); g.add(makeLabel('MAGNET', '#f6a6a0')); }
    else if (kind === 'heart') { for (const sx of [-0.13, 0.13]) { const s = M(sph(0.17, 10, 8), MAT.heart, true); s.position.set(sx, 0.1, 0); g.add(s); } const tip = M(new T.ConeGeometry(0.24, 0.34, 4), MAT.heart, true); tip.rotation.z = Math.PI; tip.position.y = -0.2; g.add(tip); g.add(makeLabel('LIFE', '#ffb0aa')); }
    g.position.y = 1; return g;
  }
  function buildFood() { const g = new T.Group(); const b = M(box(0.52, 0.28, 0.4), L('#c8783a'), true); b.position.y = 0.2; g.add(b); const top = M(box(0.54, 0.12, 0.42), MAT.crate); top.position.y = 0.4; g.add(top); const bone = M(cyl(0.05, 0.05, 0.3, 6), MAT.face); bone.rotation.z = Math.PI / 2; bone.position.y = 0.52; g.add(bone); const lbl = makeLabel('SNACK', '#ffd6a6'); lbl.position.y = 0.95; g.add(lbl); g.position.y = 0.7; return g; }
  function buildCan() { const g = new T.Group(); const m = M(cyl(0.12, 0.12, 0.34, 12), MAT.can, true); g.add(m); const lip = M(cyl(0.125, 0.125, 0.05, 12), MAT.canLip); lip.position.y = 0.17; g.add(lip); return g; }

  // ---- roadside props ------------------------------------------------------
  function buildTree() { const g = new T.Group(); const tr = M(cyl(0.2, 0.28, 2.4, 8), MAT.wood, true); tr.position.y = 1.2; g.add(tr); const cols = [MAT.leaf1, MAT.leaf2, MAT.leaf3]; for (let i = 0; i < 3; i++) { const c = M(sph(1.15 - i * 0.22, 10, 8), cols[i], true); c.position.y = 2.6 + i * 0.5; g.add(c); } return g; }
  function buildBush() { const g = new T.Group(); for (let i = 0; i < 3; i++) { const s = M(sph(0.4 - i * 0.06, 8, 6), i ? MAT.bushHi : MAT.bush, true); s.position.set((i - 1) * 0.32, 0.32 + (i === 2 ? 0.14 : 0), 0); g.add(s); } return g; }
  function buildMushroom() { const g = new T.Group(); const st = M(cyl(0.07, 0.09, 0.24, 8), MAT.face); st.position.y = 0.12; g.add(st); const cap = M(sph(0.2, 10, 6), MAT.mush); cap.scale.set(1, 0.7, 1); cap.position.y = 0.26; g.add(cap); return g; }
  function buildFlower(c) { const g = new T.Group(); const st = M(cyl(0.02, 0.02, 0.3, 5), MAT.leaf1); st.position.y = 0.15; g.add(st); for (let i = 0; i < 5; i++) { const p = M(sph(0.06, 6, 5), c); const a = i / 5 * 6.28; p.position.set(Math.cos(a) * 0.08, 0.32, Math.sin(a) * 0.08); g.add(p); } const mid = M(sph(0.05, 6, 5), MAT.flowerC); mid.position.y = 0.32; g.add(mid); return g; }
  function buildStreetlamp() { const g = new T.Group(); const pole = M(cyl(0.08, 0.11, 3.2, 8), MAT.lamp, true); pole.position.y = 1.6; g.add(pole); const arm = M(cyl(0.06, 0.06, 0.7, 6), MAT.lamp); arm.rotation.z = Math.PI / 2; arm.position.set(0.3, 3.15, 0); g.add(arm); const head = M(box(0.5, 0.16, 0.28), MAT.lamp); head.position.set(0.62, 3.05, 0); g.add(head); const glow = M(box(0.4, 0.08, 0.2), MAT.lampGlow); glow.position.set(0.62, 2.95, 0); g.add(glow); return g; }
  function buildBench() { const g = new T.Group(); const seat = M(box(1.4, 0.1, 0.5), MAT.bench, true); seat.position.y = 0.5; g.add(seat); const backr = M(box(1.4, 0.4, 0.1), MAT.bench); backr.position.set(0, 0.75, -0.2); g.add(backr); for (const sx of [-0.6, 0.6]) { const leg = M(box(0.1, 0.5, 0.5), MAT.benchLeg); leg.position.set(sx, 0.25, 0); g.add(leg); } return g; }
  function buildTrashbag() { const g = new T.Group(); const b = M(sph(0.3, 8, 6), MAT.bag, true); b.scale.set(1, 1.2, 1); b.position.y = 0.32; g.add(b); const tie = M(cyl(0.05, 0.09, 0.14, 6), MAT.bag); tie.position.y = 0.62; g.add(tie); return g; }
  function buildCloud() { const g = new T.Group(); for (let i = 0; i < 4; i++) { const s = new T.Mesh(sph(0.8 + Math.random() * 0.6, 8, 6), MAT.cloud); s.position.set((i - 1.5) * 0.9, Math.random() * 0.4, Math.random() * 0.5); g.add(s); } return g; }
  function buildHill() { const g = new T.Group(); const s = new T.Mesh(sph(6, 12, 8), MAT.hill); s.scale.set(1.6, 0.5, 1); g.add(s); return g; }
  function buildBuilding(h) {
    const g = new T.Group(); const mat = CITY_MATS[(Math.random() * CITY_MATS.length) | 0];
    const b = M(box(2.6, h, 2.6), mat, true); b.position.y = h / 2; g.add(b);
    for (let wy = 1.1; wy < h - 0.7; wy += 1.05) for (let wx = -0.78; wx <= 0.78; wx += 0.78) { const w = new T.Mesh(box(0.46, 0.58, 0.06), Math.random() < 0.55 ? MAT.win : MAT.winOff); w.position.set(wx, wy, 1.31); g.add(w); const frame = new T.Mesh(box(0.56, 0.68, 0.04), MAT.metalDk); frame.position.set(wx, wy, 1.3); g.add(frame); }
    const roof = M(box(2.74, 0.34, 2.74), MAT.metalDk); roof.position.y = h; g.add(roof);
    const awn = M(box(2.7, 0.12, 0.7), AWN_MATS[(Math.random() * AWN_MATS.length) | 0]); awn.position.set(0, 1.0, 1.5); awn.rotation.x = 0.35; g.add(awn);
    for (let ax = -1; ax <= 1; ax += 0.5) { const st = new T.Mesh(box(0.16, 0.13, 0.7), MAT.coneW); st.position.set(ax * 1.0, 1.0, 1.5); st.rotation.x = 0.35; g.add(st); }
    if (Math.random() < 0.5) { const tank = M(cyl(0.35, 0.35, 0.7, 10), MAT.tank); tank.position.set(0.6, h + 0.5, 0.4); g.add(tank); for (let i = 0; i < 3; i++) { const l = new T.Mesh(box(0.05, 0.35, 0.05), MAT.metalDk); l.position.set(0.6 + Math.cos(i * 2) * 0.3, h + 0.17, 0.4 + Math.sin(i * 2) * 0.3); g.add(l); } }
    else { const sign = M(box(0.12, 1.0, 1.6), [MAT.sign1, MAT.sign2, MAT.sign3][(Math.random() * 3) | 0]); sign.position.set(-1.2, h + 0.5, 0); g.add(sign); }
    const ac = M(box(0.5, 0.35, 0.3), MAT.metal); ac.position.set(-0.7, 1.9, 1.32); g.add(ac);
    return g;
  }
  function buildPine() { const g = new T.Group(); const tr = M(cyl(0.16, 0.24, 1.4, 7), MAT.trunk2, true); tr.position.y = 0.7; g.add(tr); for (let i = 0; i < 4; i++) { const c = M(new T.ConeGeometry(1.1 - i * 0.22, 1.1, 8), i < 2 ? MAT.pine1 : MAT.pine2, true); c.position.y = 1.4 + i * 0.66; g.add(c); } return g; }
  function buildFern() { const g = new T.Group(); for (let i = 0; i < 6; i++) { const a = i / 6 * 6.28; const bl = M(box(0.06, 0.5, 0.14), MAT.fern); bl.position.set(Math.cos(a) * 0.14, 0.25, Math.sin(a) * 0.14); bl.rotation.z = Math.cos(a) * 0.5; bl.rotation.x = Math.sin(a) * 0.5; g.add(bl); } return g; }
  function buildTallGrass() { const g = new T.Group(); for (let i = 0; i < 7; i++) { const bl = M(box(0.05, 0.4 + Math.random() * 0.2, 0.05), Math.random() < 0.5 ? MAT.leaf1 : MAT.bushHi); bl.position.set((Math.random() - 0.5) * 0.4, 0.22, (Math.random() - 0.5) * 0.4); bl.rotation.z = (Math.random() - 0.5) * 0.5; g.add(bl); } return g; }
  function buildFlowerPatch() { const g = new T.Group(); for (let i = 0; i < 5; i++) { const f = buildFlower([MAT.flower1, MAT.flower2][(Math.random() * 2) | 0]); f.position.set((Math.random() - 0.5) * 0.7, 0, (Math.random() - 0.5) * 0.7); g.add(f); } return g; }
  function buildRockCluster() { const g = new T.Group(); for (let i = 0; i < 3; i++) { const r = M(new T.DodecahedronGeometry(0.22 + Math.random() * 0.18, 0), i ? MAT.stoneDk : MAT.stone, true); r.position.set((Math.random() - 0.5) * 0.6, 0.16, (Math.random() - 0.5) * 0.6); r.rotation.set(Math.random(), Math.random(), Math.random()); g.add(r); } return g; }
  function buildCar() { const g = new T.Group(); const mat = CAR_MATS[(Math.random() * CAR_MATS.length) | 0]; const body = M(box(2.0, 0.5, 0.9), mat, true); body.position.y = 0.5; g.add(body); const cab = M(box(1.1, 0.44, 0.82), mat, true); cab.position.set(-0.1, 0.9, 0); g.add(cab); const glass = M(box(1.0, 0.36, 0.86), MAT.carGlass); glass.position.set(-0.1, 0.9, 0); g.add(glass); for (const [wx, wz] of [[-0.6, 0.48], [0.6, 0.48], [-0.6, -0.48], [0.6, -0.48]]) { const w = M(cyl(0.24, 0.24, 0.16, 12), MAT.carDark); w.rotation.x = Math.PI / 2; w.position.set(wx, 0.24, wz); g.add(w); } return g; }
  function buildCone() { const g = new T.Group(); const c = M(new T.ConeGeometry(0.24, 0.6, 10), MAT.cone, true); c.position.y = 0.3; g.add(c); const band = M(cyl(0.19, 0.15, 0.1, 10), MAT.coneW); band.position.y = 0.34; g.add(band); const base = M(box(0.5, 0.06, 0.5), MAT.cone); base.position.y = 0.03; g.add(base); return g; }
  function buildMailbox() { const g = new T.Group(); const post = M(cyl(0.06, 0.06, 1.0, 6), MAT.metalDk); post.position.y = 0.5; g.add(post); const b = M(box(0.4, 0.4, 0.5), MAT.mailbox, true); b.position.y = 1.1; g.add(b); const top = M(cyl(0.2, 0.2, 0.5, 10, 1), MAT.mailbox); top.rotation.z = Math.PI / 2; top.position.y = 1.3; g.add(top); return g; }
  function buildPlanter() { const g = new T.Group(); const p = M(box(1.2, 0.4, 0.5), MAT.pot, true); p.position.y = 0.2; g.add(p); for (let i = 0; i < 3; i++) { const b = M(sph(0.26, 8, 6), MAT.bush); b.position.set((i - 1) * 0.35, 0.55, 0); g.add(b); const f = buildFlower(MAT.flower1); f.position.set((i - 1) * 0.35, 0.4, 0.1); g.add(f); } return g; }
  function buildRoadSign() { const g = new T.Group(); const post = M(cyl(0.05, 0.05, 1.6, 6), MAT.metal); post.position.y = 0.8; g.add(post); const s = M(box(0.5, 0.5, 0.06), [MAT.sign1, MAT.sign2, MAT.sign3][(Math.random() * 3) | 0]); s.position.y = 1.5; g.add(s); return g; }
  function buildTreeLine() { const g = new T.Group(); for (let i = 0; i < 6; i++) { const t = Math.random() < 0.5 ? buildPine() : buildTree(); t.scale.setScalar(0.8 + Math.random() * 0.7); t.position.set((i - 3) * 2.4 + Math.random(), 0, (Math.random() - 0.5) * 4); g.add(t); } return g; }
  // ---- themed gaps ---------------------------------------------------------
  function buildPitForest(w) {
    const g = new T.Group();
    const deep = new T.Mesh(box(w, 7, LANE_HZ * 2), MAT.holeDk); deep.position.y = -3.5; g.add(deep);
    const N = 18; const shape = new T.Shape();
    for (let i = 0; i <= N; i++) { const a = i / N * Math.PI * 2; const rr = 0.72 + (Math.sin(i * 2.3) * 0.5 + 0.5) * 0.4; const px = Math.cos(a) * (w / 2) * rr, pz = Math.sin(a) * LANE_HZ * 0.92 * rr; if (i === 0) shape.moveTo(px, pz); else shape.lineTo(px, pz); }
    const hole = new T.Mesh(new T.ShapeGeometry(shape), MAT.holeDk); hole.rotation.x = -Math.PI / 2; hole.position.y = 0.03; g.add(hole);
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; const rr = 0.9 + Math.sin(i * 1.7) * 0.12; const lump = M(new T.DodecahedronGeometry(0.16 + Math.random() * 0.14, 0), i % 2 ? MAT.rimDirt : MAT.stoneDk); lump.position.set(Math.cos(a) * (w / 2) * rr, 0.04, Math.sin(a) * LANE_HZ * 0.95 * rr); lump.rotation.set(Math.random(), Math.random(), Math.random()); g.add(lump); }
    for (let i = 0; i < 3; i++) { const root = M(cyl(0.03, 0.05, 0.5, 5), MAT.root); root.position.set((Math.random() - 0.5) * w * 0.6, 0.02, (Math.random() - 0.5) * LANE_HZ); root.rotation.set(1.2, Math.random() * 3, 0.4); g.add(root); }
    return g;
  }
  function buildPitCity(w) {
    const g = new T.Group();
    const deep = new T.Mesh(box(w, 7, LANE_HZ * 2), MAT.holeDk); deep.position.y = -3.5; g.add(deep);
    const hole = new T.Mesh(new T.CircleGeometry(1, 24), MAT.holeDk); hole.rotation.x = -Math.PI / 2; hole.scale.set(w / 2, LANE_HZ * 0.92, 1); hole.position.y = 0.03; g.add(hole);
    const rim = M(new T.TorusGeometry(1, 0.12, 8, 26), MAT.coverMetal); rim.rotation.x = Math.PI / 2; rim.scale.set(w / 2, LANE_HZ * 0.92, 1); rim.position.y = 0.06; g.add(rim);
    // the cover, flipped off to the side on the curb
    const cover = new T.Group(); cover.position.set(-w / 2 - 0.2, 0.08, LANE_HZ - 0.5); cover.rotation.set(0.15, 0.4, 0.1);
    const disc = M(cyl(0.62, 0.62, 0.1, 20), MAT.coverMetal, true); cover.add(disc);
    for (let r = 0.2; r < 0.6; r += 0.18) { const ring = M(new T.TorusGeometry(r, 0.02, 5, 18), MAT.metalDk); ring.rotation.x = Math.PI / 2; ring.position.y = 0.06; cover.add(ring); }
    g.add(cover);
    return g;
  }
  function buildShadow() { const m = new T.Mesh(new T.CircleGeometry(0.6, 16), new T.MeshBasicMaterial({ color: 0x1a2410, transparent: true, opacity: 0.24 })); m.rotation.x = -Math.PI / 2; m.position.y = 0.02; return m; }

  // ---- persistent side ground (fields both sides — nothing floats) --------
  let sideL, sideR;
  function buildSide(zc) { const g = new T.Group(); const top = new T.Mesh(box(180, 0.3, 32), MAT.field); top.position.set(0, -0.15, zc); top.receiveShadow = !MOBILE; g.add(top); const dirt = new T.Mesh(box(180, 4, 32), MAT.dirt); dirt.position.set(0, -2.35, zc); g.add(dirt); return g; }

  // ---- state ---------------------------------------------------------------
  let player, playerModel, chaser, chaserModel, deco, obstacles, enemies, coins, pickups, cans, particles, clouds;
  let scrollSpeed, lead, lives, coinsN, score, ammo, jumps, running, over, nextSpawn, lastKind, nextDeco, groundTiles, invuln, magnetT, speedT, shieldOn, stumbleT, shakeT, powerTO;
  const LANE = 0, GRAV = 34, JUMP_V = 12.6, TILE = 2, HALF = 34, LANE_HZ = 3.1;
  let pits = [];

  function clr(arr) { for (const o of arr) scene.remove(o.mesh || o); arr.length = 0; }
  function reset() {
    if (obstacles) { clr(obstacles); clr(enemies); clr(coins); clr(pickups); clr(cans); clr(particles); clr(deco); clr(clouds); for (const k in groundTiles) scene.remove(groundTiles[k]); for (const p of pits) if (p.chasm) scene.remove(p.chasm); }
    obstacles = []; enemies = []; coins = []; pickups = []; cans = []; particles = []; deco = []; clouds = []; groundTiles = {}; pits = [];

    if (!sideL) { sideL = buildSide(-LANE_HZ - 16); sideR = buildSide(LANE_HZ + 16); scene.add(sideL); scene.add(sideR); }
    player = { x: 0, y: 0, vy: 0, onGround: true, run: 0 };
    if (!playerModel) { playerModel = buildRaccoon(); playerModel.pShadow = buildShadow(); scene.add(playerModel); scene.add(playerModel.pShadow); }
    playerModel.position.set(0, 0, LANE); playerModel.rotation.y = -0.34;   // 3/4 turn so the face & eyes show
    chaser = { x: -6, y: 0, vy: 0, onGround: true, run: 0 };
    if (!chaserModel) { chaserModel = buildDog(MAT.dogChase, 1, true); chaserModel.cShadow = buildShadow(); scene.add(chaserModel); scene.add(chaserModel.cShadow); }
    chaserModel.rotation.y = -0.28;

    scrollSpeed = 9; lead = 78; lives = 3; coinsN = 0; score = 0; ammo = 0; jumps = 0;
    nextSpawn = 26; lastKind = 'flat'; nextDeco = 8; invuln = 0; magnetT = 0; speedT = 0; shieldOn = false; stumbleT = 0; shakeT = 0;
    running = true; over = false;
    const nClouds = MOBILE ? 4 : 7;
    for (let i = 0; i < nClouds; i++) { const c = buildCloud(); const cx = i * 14, cz = -14 - Math.random() * 10, cy = 12 + Math.random() * 6; c.position.set(cx, cy, cz); scene.add(c); clouds.push({ mesh: c, x: cx, y: cy, z: cz }); }
    ensureGround(); renderLives(); setHUD();
  }

  // ---- ground: centre lane with gaps + curbs + city line; chasm per pit ----
  function inPit(x) { for (const p of pits) if (x > p.x0 && x < p.x1) return true; return false; }
  function biomeName(x) { return (Math.floor(x / 130) % 2 === 0) ? 'forest' : 'city'; }
  function ensureGround() {
    const i0 = Math.floor((player.x - 14) / TILE), i1 = Math.floor((player.x + HALF) / TILE);
    for (let i = i0; i <= i1; i++) {
      const cx = i * TILE + TILE / 2;
      if (inPit(cx)) { if (groundTiles[i]) { scene.remove(groundTiles[i]); delete groundTiles[i]; } continue; }
      if (!groundTiles[i]) {
        const g = new T.Group(); const city = biomeName(cx) === 'city';
        const top = new T.Mesh(box(TILE + 0.02, 0.3, LANE_HZ * 2), (i & 1) ? MAT.fieldB : MAT.field); top.position.y = -0.15; top.receiveShadow = !MOBILE; g.add(top);
        const dirt = new T.Mesh(box(TILE + 0.02, 2.6, LANE_HZ * 2), MAT.dirt); dirt.position.y = -1.6; g.add(dirt);
        for (const sz of [-LANE_HZ, LANE_HZ]) { const curb = new T.Mesh(box(TILE + 0.02, 0.22, 0.36), MAT.curb); curb.position.set(0, -0.05, sz); g.add(curb); }
        if (city && (i & 1)) { const line = new T.Mesh(box(0.9, 0.02, 0.16), MAT.line); line.position.set(0, 0.01, 0); g.add(line); }
        g.position.x = cx; scene.add(g); groundTiles[i] = g;
      }
    }
    for (const k in groundTiles) { if (+k < i0 - 1 || +k > i1 + 1) { scene.remove(groundTiles[k]); delete groundTiles[k]; } }
    for (const p of pits) if (p.chasm && p.x1 < player.x - 16) { scene.remove(p.chasm); p.chasm = null; }
    pits = pits.filter(p => p.x1 > player.x - 16);
    // fields follow the runner
    sideL.position.x = player.x + 30; sideR.position.x = player.x + 30;
  }

  function add(list, model, x, extra) { model.position.x = x; if (extra && extra.z !== undefined) model.position.z = extra.z; scene.add(model); const o = Object.assign({ mesh: model, x }, extra || {}); list.push(o); return o; }
  function spawnFeature() {
    const x = nextSpawn, diff = Math.min(1, player.x / 450), b = biomeName(x);
    let kind;
    if (lastKind === 'pit') kind = Math.random() < 0.6 ? 'coins' : 'flat';
    else { const r = Math.random(); if (r < 0.19) kind = 'pit'; else if (r < 0.47) kind = 'obstacle'; else if (r < 0.65) kind = 'enemy'; else if (r < 0.85) kind = 'coins'; else if (r < 0.92) kind = 'food'; else kind = 'power'; }
    let gap = 7 + Math.random() * 4 - diff * 2;
    if (kind === 'pit') { const w = 2.4 + Math.random() * (1.4 + diff * 1.6); const p = { x0: x - w / 2, x1: x + w / 2 }; const chasm = (b === 'city') ? buildPitCity(w) : buildPitForest(w); chasm.position.set(x, 0, 0); scene.add(chasm); p.chasm = chasm; pits.push(p); gap = w + 5.5 + Math.random() * 3; }
    else if (kind === 'obstacle') { const set = b === 'forest' ? ['log', 'rock', 'crate'] : ['bin', 'hydrant', 'crate']; const ty = set[(Math.random() * set.length) | 0]; const m = buildObstacle(ty); const o = add(obstacles, m, x); o.box = m.userData.box; o.sh = buildShadow(); o.sh.position.set(x, 0.02, 0); scene.add(o.sh); gap = 6 + Math.random() * 4 - diff * 1.5; }
    else if (kind === 'enemy') { const ty = (b === 'city' && Math.random() < 0.5) ? 'human' : 'dog'; const m = ty === 'dog' ? buildDog(MAT.dog, -1, false) : buildHuman(); const o = add(enemies, m, x, { ty, dead: false, vx: ty === 'dog' ? -3.2 : -2.4, run: 0, top: ty === 'human' ? 2.0 : 0.95, hw: ty === 'human' ? 0.34 : 0.5 }); o.sh = buildShadow(); scene.add(o.sh); gap = 8 + Math.random() * 4; }
    else if (kind === 'coins') { const n = 3 + ((Math.random() * 4) | 0), arc = Math.random() < 0.5; for (let i = 0; i < n; i++) { const m = buildCoin(); m.position.y = 1 + (arc ? Math.sin(i / (n - 1) * Math.PI) * 1.5 : 0.3); add(coins, m, x + i * 1.15); } gap = n * 1.15 + 5; }
    else if (kind === 'food') { add(pickups, buildFood(), x, { kind: 'food' }); gap = 8; }
    else if (kind === 'power') { const roll = Math.random(); const k = roll < 0.12 ? 'heart' : ['can', 'shield', 'speed', 'magnet'][(Math.random() * 4) | 0]; add(pickups, buildPowerup(k), x, { kind: k }); gap = 8; }
    else gap = 5 + Math.random() * 4;
    lastKind = kind; nextSpawn += Math.max(4.5, gap);
  }
  function decoAdd(m, x, z) { m.traverse(o => { o.castShadow = false; }); add(deco, m, x, { z }); }
  function spawnDeco() {
    const b = biomeName(nextDeco), skip = MOBILE ? 0.34 : 0.2;
    for (const side of [-1, 1]) {
      if (Math.random() < skip) continue;
      const r = Math.random(); let m, z;
      if (b === 'forest') {
        z = side * (3.8 + Math.random() * 8);
        m = r < 0.26 ? buildTree() : r < 0.4 ? buildPine() : r < 0.53 ? buildBush() : r < 0.64 ? buildFern() : r < 0.74 ? buildMushroom() : r < 0.86 ? buildFlowerPatch() : buildRockCluster();
        if (r < 0.4) m.scale.setScalar(0.7 + Math.random() * 0.6);
      } else {
        if (r < 0.32) { m = buildBuilding(4 + Math.random() * 8); z = side * (9 + Math.random() * 4); }
        else { m = r < 0.48 ? buildStreetlamp() : r < 0.6 ? buildBench() : r < 0.72 ? buildCar() : r < 0.8 ? buildMailbox() : r < 0.87 ? buildCone() : r < 0.94 ? buildPlanter() : buildRoadSign(); z = side * (3.8 + Math.random() * 4); }
      }
      decoAdd(m, nextDeco + Math.random() * 2, z);
    }
    // frequent small ground detail hugging the lane
    if (Math.random() < 0.7) { const side = Math.random() < 0.5 ? -1 : 1; const m = b === 'forest' ? (Math.random() < 0.55 ? buildTallGrass() : buildFlowerPatch()) : (Math.random() < 0.5 ? buildCone() : buildTallGrass()); decoAdd(m, nextDeco + Math.random() * 3, side * (3.5 + Math.random() * 1.3)); }
    // far backdrop
    if (Math.random() < (MOBILE ? 0.4 : 0.7)) { const m = b === 'forest' ? buildTreeLine() : buildBuilding(6 + Math.random() * 10); decoAdd(m, nextDeco + Math.random() * 6, (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 10)); }
    nextDeco += (MOBILE ? 4.4 : 3.2) + Math.random() * 3;
  }

  // ---- input ---------------------------------------------------------------
  function doJump() { if (!running) return; if (jumps < 2) { player.vy = JUMP_V * (jumps === 0 ? 1 : 0.92); player.onGround = false; jumps++; } }
  function doThrow() { if (!running || ammo <= 0) return; ammo--; setHUD(); const m = buildCan(); add(cans, m, player.x + 0.6, { y: player.y + 1.1, vx: scrollSpeed + 9, vy: 3 }); m.position.set(player.x + 0.6, player.y + 1.1, LANE); }
  window.addEventListener('keydown', e => { const k = e.key.toLowerCase(); if (k === ' ' || k === 'arrowup' || k === 'w') { e.preventDefault(); doJump(); } else if (k === 'f' || k === 'arrowdown' || k === 's') { e.preventDefault(); doThrow(); } });
  canvas.addEventListener('mousedown', doJump);
  canvas.addEventListener('touchstart', e => { e.preventDefault(); doJump(); }, { passive: false });
  const hold = (btn, fn) => { btn.addEventListener('touchstart', e => { e.preventDefault(); e.stopPropagation(); fn(); }, { passive: false }); btn.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); fn(); }); };
  hold(el.jumpBtn, doJump); hold(el.throwBtn, doThrow);
  if ('ontouchstart' in window) el.touch.classList.add('on');

  // ---- lives / hits --------------------------------------------------------
  function loseLife(reason) { lives--; renderLives(); invuln = 1.1; stumbleT = 0.4; shakeT = 0.34; if (lives <= 0) { gameOver(reason); return true; } return false; }
  function takeHit() { if (invuln > 0) return; if (shieldOn) { shieldOn = false; showPower('Shield saved you!', '#7a8a9c'); invuln = 0.9; shakeT = 0.2; return; } puff(player.x, player.y + 1, 0xe0483c); loseLife('caught'); }
  function applyPickup(k) {
    if (k === 'food') { lead = Math.min(100, lead + 26); showPower('Snack! Dog falls back', '#2fa96b'); puff(player.x, player.y + 1, 0x2fa96b); }
    else if (k === 'can') { ammo += 3; showPower('+3 cans to throw', '#4f7cff'); }
    else if (k === 'shield') { shieldOn = true; showPower('Shield up', '#7a8a9c'); }
    else if (k === 'speed') { speedT = 4.5; showPower('Speed boost!', '#e0a92b'); }
    else if (k === 'magnet') { magnetT = 6; showPower('Coin magnet!', '#e0483c'); }
    else if (k === 'heart') { lives = Math.min(3, lives + 1); renderLives(); showPower('+1 life!', '#e0483c'); puff(player.x, player.y + 1, 0xe0483c); }
    setHUD();
  }
  function puff(x, y, color) { for (let i = 0; i < 9; i++) { const m = new T.Mesh(sph(0.08, 6, 5), Bm(color)); m.position.set(x, y, LANE); scene.add(m); particles.push({ mesh: m, vx: (Math.random() - 0.5) * 4, vy: Math.random() * 4.5, vz: (Math.random() - 0.5) * 3, life: 0.5 }); } }

  // ---- update --------------------------------------------------------------
  function update(dt) {
    const diff = Math.min(1, player.x / 450);
    if (stumbleT > 0) stumbleT -= dt;
    scrollSpeed = (9 + diff * 6.5) * (speedT > 0 ? 1.3 : 1) * (stumbleT > 0 ? 0.55 : 1);
    player.x += scrollSpeed * dt;
    lead -= (0.58 * (1 + player.x / 300)) * dt;
    if (speedT > 0) speedT -= dt; if (magnetT > 0) magnetT -= dt; if (invuln > 0) invuln -= dt; if (shakeT > 0) shakeT -= dt;

    player.vy -= GRAV * dt; player.y += player.vy * dt;
    const overPit = inPit(player.x);
    if (!overPit && player.y <= 0) { player.y = 0; player.vy = 0; player.onGround = true; jumps = 0; }
    else player.onGround = false;
    if (player.y < -4.2) { // fell in a gap: lose a life & respawn past the pit
      let px1 = player.x + 2; for (const p of pits) if (player.x > p.x0 - 1 && player.x < p.x1 + 1) px1 = Math.max(px1, p.x1 + 0.8);
      if (loseLife('fell')) return; player.x = px1; player.y = 0.6; player.vy = 0;
    }
    if (player.onGround) player.run += scrollSpeed * dt * 1.5;

    while (nextSpawn < player.x + 52) spawnFeature();
    while (nextDeco < player.x + 66) spawnDeco();
    ensureGround();

    // chaser closes as lead drops; physically hops obstacles & chasms (kept close & snappy)
    const targetX = player.x - (1.5 + Math.max(0, lead) * 0.06);
    chaser.x += (targetX - chaser.x) * Math.min(1, dt * 6);
    chaser.vy -= GRAV * dt; chaser.y += chaser.vy * dt;
    if (!inPit(chaser.x + 0.4) && chaser.y <= 0) { chaser.y = 0; chaser.vy = 0; chaser.onGround = true; } else chaser.onGround = false;
    if (chaser.onGround) { let hz = inPit(chaser.x + 1.6) || inPit(chaser.x + 2.4); for (const o of obstacles) if (Math.abs(o.x - (chaser.x + 1.9)) < 0.9) hz = true; if (hz) { chaser.vy = JUMP_V * 0.94; chaser.onGround = false; } chaser.run += scrollSpeed * dt * 1.6; }
    if (chaser.y < -4) { chaser.x = player.x - 3; chaser.y = 0; chaser.vy = 0; }
    // dog catches you → lose a life, shove it back, refill the meter a bit
    if (lead <= 0) { lead = 62; chaser.x = player.x - 8; puff(player.x, player.y + 1, 0xc53a2f); if (loseLife('caught')) return; }

    for (const e of enemies) { if (e.dead) continue; e.x += e.vx * dt; e.run += dt * 9; }

    for (let i = cans.length - 1; i >= 0; i--) { const c = cans[i]; c.x += c.vx * dt; c.vy -= GRAV * dt; c.y += c.vy * dt; c.mesh.position.set(c.x, c.y, LANE); c.mesh.rotation.z += dt * 14;
      let hit = false; for (const e of enemies) if (!e.dead && Math.abs(e.x - c.x) < 0.75 && c.y < e.top + 0.3) { e.dead = true; hit = true; score += 15; puff(e.x, 0.9, 0xffd23f); scene.remove(e.mesh); if (e.sh) scene.remove(e.sh); }
      if (hit || c.y < 0 || c.x < player.x - 6) { scene.remove(c.mesh); cans.splice(i, 1); }
    }

    const pw = 0.36, pBottom = player.y + 0.12;
    for (const o of obstacles) { const b = o.box; if (player.x + pw > o.x - b.hw && player.x - pw < o.x + b.hw && pBottom < b.top - 0.06) takeHit(); }
    for (const e of enemies) { if (e.dead) continue; if (player.x + pw > e.x - e.hw && player.x - pw < e.x + e.hw && pBottom < e.top - 0.06) takeHit(); }

    for (let i = coins.length - 1; i >= 0; i--) { const c = coins[i]; c.mesh.rotation.y += dt * 4;
      if (magnetT > 0 && Math.abs(c.x - player.x) < 4.5) { c.x += (player.x - c.x) * dt * 5; c.mesh.position.y += ((player.y + 1) - c.mesh.position.y) * dt * 5; }
      if (Math.abs(c.x - player.x) < 0.7 && Math.abs(c.mesh.position.y - (player.y + 1)) < 1.3) { scene.remove(c.mesh); coins.splice(i, 1); coinsN++; score += 5; puff(c.x, c.mesh.position.y, 0xffd23f); }
    }
    for (let i = pickups.length - 1; i >= 0; i--) { const p = pickups[i]; p.mesh.rotation.y += dt * 1.6; p.mesh.position.y = (p.kind === 'food' ? 0.7 : 1) + Math.sin(performance.now() / 300 + p.x) * 0.12;
      if (Math.abs(p.x - player.x) < 0.85 && player.y < 1.7) { scene.remove(p.mesh); pickups.splice(i, 1); applyPickup(p.kind); }
    }

    const cut = player.x - 16;
    const cull = a => { for (let i = a.length - 1; i >= 0; i--) if (a[i].x < cut) { scene.remove(a[i].mesh); if (a[i].sh) scene.remove(a[i].sh); a.splice(i, 1); } };
    cull(obstacles); cull(enemies); cull(coins); cull(pickups); cull(deco);
    for (const cl of clouds) if (cl.x < player.x - 20) { cl.x += 14 * clouds.length; cl.mesh.position.x = cl.x; }

    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.vy -= 12 * dt; p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt; p.life -= dt; if (p.life <= 0) { scene.remove(p.mesh); particles.splice(i, 1); } }

    score = Math.max(score, Math.floor(player.x) + coinsN * 5);
    syncModels(dt); updateBiome(); setHUD();
  }

  function animLegs(m, run, air) { if (!m.legs) return; for (let i = 0; i < m.legs.length; i++) m.legs[i].rotation.x = air ? -0.5 : Math.sin(run + i * Math.PI) * 0.75; }
  function syncModels() {
    const blink = invuln > 0 && Math.floor(invuln * 12) % 2 === 0;
    playerModel.visible = !blink;
    playerModel.position.set(player.x, player.y, LANE);
    playerModel.rotation.z = player.onGround ? (stumbleT > 0 ? 0.12 : 0) : -0.12;
    animLegs(playerModel, player.run, !player.onGround);
    if (playerModel.head) playerModel.head.rotation.z = -0.12 + Math.sin(player.run) * 0.04;
    if (playerModel.tail) playerModel.tail.rotation.x = Math.sin(player.run) * 0.18;
    playerModel.pShadow.position.set(player.x, 0.02, LANE); playerModel.pShadow.material.opacity = 0.24 * Math.max(0, 1 - player.y / 3);
    chaserModel.position.set(chaser.x, chaser.y, LANE); animLegs(chaserModel, chaser.run, !chaser.onGround);
    if (chaserModel.jaw) { const spd = 0.011 + (100 - Math.max(0, lead)) * 0.00022; chaserModel.jaw.rotation.z = -(0.5 + 0.5 * Math.sin(performance.now() * spd)) * 0.6; }
    chaserModel.cShadow.position.set(chaser.x, 0.02, LANE); chaserModel.cShadow.material.opacity = 0.24 * Math.max(0, 1 - chaser.y / 3);
    for (const e of enemies) { if (e.dead) continue; e.mesh.position.set(e.x, 0, LANE); animLegs(e.mesh, e.run, false); if (e.mesh.arms) { e.mesh.arms[0].rotation.x = Math.sin(e.run) * 0.5; } if (e.sh) e.sh.position.set(e.x, 0.02, LANE); }
    for (const o of obstacles) o.mesh.position.x = o.x;
    for (const c of coins) c.mesh.position.x = c.x;
    for (const p of pickups) p.mesh.position.x = p.x;
    let sx = 0, sy = 0; if (shakeT > 0) { sx = (Math.random() - 0.5) * shakeT * 2.4; sy = (Math.random() - 0.5) * shakeT * 2.4; }
    camera.position.set(player.x - 0.5 + sx, 5.2 + sy, 18);
    camera.lookAt(player.x + 3.5, 2.2, 0);
    sun.position.set(player.x + 6, 17, 11); sun.target.position.set(player.x + 4, 0, 0);
  }

  const _c = new T.Color();
  function updateBiome() {
    const pos = ((player.x % 130) + 130) % 130, idx = Math.floor(player.x / 130); let t = 0; if (pos > 108) t = (pos - 108) / 22;
    const f = idx % 2 === 0;
    _c.copy(f ? SKY_F : SKY_C).lerp(f ? SKY_C : SKY_F, t); scene.background.copy(_c); scene.fog.color.copy(_c);
    _c.copy(f ? FIELD_F : FIELD_C).lerp(f ? FIELD_C : FIELD_F, t); MAT.field.color.copy(_c);
    _c.copy(f ? FIELDB_F : FIELDB_C).lerp(f ? FIELDB_C : FIELDB_F, t); MAT.fieldB.color.copy(_c);
    _c.copy(f ? DIRT_F : DIRT_C).lerp(f ? DIRT_C : DIRT_F, t); MAT.dirt.color.copy(_c);
    _c.copy(f ? CURB_F : CURB_C).lerp(f ? CURB_C : CURB_F, t); MAT.curb.color.copy(_c);
  }

  // ---- HUD -----------------------------------------------------------------
  const HEART = '<svg viewBox="0 0 24 24"><path fill="#e0483c" d="M12 21.3l-1.5-1.4C5.4 15.4 2 12.3 2 8.5 2 5.4 4.4 3 7.5 3c1.7 0 3.4.8 4.5 2.1C13.1 3.8 14.8 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.8-3.4 6.9-8.5 11.4L12 21.3z"/></svg>';
  function renderLives() { if (!el.lives) return; let h = ''; for (let i = 0; i < 3; i++) h += `<span class="heart ${i < lives ? '' : 'off'}">${HEART}</span>`; el.lives.innerHTML = h; }
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
    if (over) return; over = true; running = false; if (playerModel) playerModel.visible = true;
    const fs = Math.floor(player.x) + coinsN * 5;
    el.overTitle.textContent = reason === 'fell' ? 'Out of lives — down the hole!' : 'Out of lives — the dog got you!';
    el.fDist.textContent = Math.floor(player.x); el.fScore.textContent = fs;
    const list = loadLB(); const q = list.length < 10 || fs > (list[list.length - 1] ? list[list.length - 1].score : 0);
    pending = { score: fs, dist: Math.floor(player.x) }; el.nameRow.classList.toggle('hidden', !q || fs <= 0);
    renderLB(el.lbOver, -1); el.over.classList.remove('hidden');
  }
  function saveScore() { if (!pending) return; const name = (el.nameInput.value || 'Jimothy').slice(0, 12); const l = loadLB(); l.push({ name, score: pending.score, dist: pending.dist }); l.sort((a, b) => b.score - a.score); saveLB(l); renderLB(el.lbOver, l.findIndex(r => r.name === name && r.score === pending.score)); el.nameRow.classList.add('hidden'); pending = null; try { localStorage.setItem('jimothy_run_name', name); } catch (e) {} }
  el.saveBtn.addEventListener('click', saveScore); el.nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveScore(); });
  function startRun() { el.start.classList.add('hidden'); el.over.classList.add('hidden'); reset(); }
  el.playBtn.addEventListener('click', startRun); el.retryBtn.addEventListener('click', startRun);

  try { const nm = localStorage.getItem('jimothy_run_name'); if (nm) el.nameInput.value = nm; } catch (e) {}
  reset(); running = false; over = false; syncModels(); renderLB(el.lbStart, -1);
  requestAnimationFrame(frame);

  window.RUN3D = { state: function () { return { x: Math.round(player.x), lead: Math.round(lead), lives: lives, score: score, coins: coinsN, ammo: ammo, obstacles: obstacles.length, enemies: enemies.length, pits: pits.length, deco: deco.length, y: +player.y.toFixed(2), onGround: player.onGround, chaserX: +chaser.x.toFixed(1), over: over }; }, give: function (k) { applyPickup(k); }, setLead: function (v) { lead = v; }, hit: function () { takeHit(); }, mobile: MOBILE };
})();
