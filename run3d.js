/* ============================================================================
   JIMOTHY RUN 3D — side-view endless runner in real 3D (Three.js r128)
   Detailed low-poly models (raccoon-coloured chunky Jimothy, dogs, catchers),
   a richly dressed track (curbs, stripes, roadside props, clouds, hills),
   in-world control signs, precise AABB collision with stumble + camera shake.
   ============================================================================ */
(function () {
  'use strict';
  const T = window.THREE;

  const el = {
    dist: document.getElementById('distVal'), score: document.getElementById('scoreVal'),
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
  const renderer = new T.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputEncoding = T.sRGBEncoding;

  const scene = new T.Scene();
  const SKY_F = new T.Color('#a9dcf2'), SKY_C = new T.Color('#c3cede');
  scene.background = SKY_F.clone();
  scene.fog = new T.Fog(SKY_F.clone(), 30, 78);

  const camera = new T.PerspectiveCamera(50, 1, 0.1, 220);
  function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
  window.addEventListener('resize', resize); resize();

  const hemi = new T.HemisphereLight(0xffffff, 0x8a9a70, 0.8); scene.add(hemi);
  const sun = new T.DirectionalLight(0xfff1d4, 1.05);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1; sun.shadow.camera.far = 70;
  sun.shadow.camera.left = -20; sun.shadow.camera.right = 20; sun.shadow.camera.top = 20; sun.shadow.camera.bottom = -20; sun.shadow.bias = -0.0005;
  scene.add(sun); scene.add(sun.target);

  // ---- materials -----------------------------------------------------------
  const L = (c, o) => new T.MeshLambertMaterial(Object.assign({ color: new T.Color(c) }, o || {}));
  const B = (c, o) => new T.MeshBasicMaterial(Object.assign({ color: new T.Color(c) }, o || {}));
  const MAT = {
    // raccoon — grizzled grey-brown with black mask, cream face, ringed tail
    fur: L('#948f83'), fur2: L('#a8a296'), belly: L('#d9d3c4'), mask: L('#1b1b1f'), face: L('#efe9db'),
    nose: L('#131316'), ear: L('#6f6a5e'), paw: L('#26241e'), ring: L('#2a2720'),
    // dogs
    dog: L('#7a5636'), dogDark: L('#4a3524'), dogChase: L('#5a3f2b'), collar: L('#c53a2f'), tongue: L('#e06a7a'),
    // catcher (human)
    skin: L('#e6b48a'), cap: L('#2f6d4a'), shirt: L('#3c6ea5'), pants: L('#39434f'), shoe: L('#20242b'), net: L('#c9cdd2'), pole: L('#8a7150'),
    // props
    wood: L('#7c5836'), woodDark: L('#5b3f24'), leaf1: L('#3f8f2f'), leaf2: L('#4ea33a'), leaf3: L('#5cb343'),
    stone: L('#8b8f96'), stoneDk: L('#6f747c'), bin: L('#586069'), binLid: L('#454b52'), hyd: L('#c14b3a'), crate: L('#a97c46'), crateDk: L('#7f5d33'),
    gold: L('#ffd23f'), goldEdge: L('#e0a92b'), can: L('#4f7cff'), canLip: L('#cdd9f5'),
    mush: L('#e0563e'), flower1: L('#f2739e'), flower2: L('#f6c343'), flowerC: L('#fff2c4'), bush: L('#3f9142'), bushHi: L('#57b95a'),
    lamp: L('#3a4048'), lampGlow: L('#ffe79a'), bench: L('#8a6a44'), benchLeg: L('#3a4048'), bag: L('#33383e'),
    curb: L('#b9bcc0'), curbF: L('#7d6b4a'), line: B('#f2ede0'),
    grassA: L('#5fa437'), grassB: L('#6cb040'), dirt: L('#7c5836'), cloud: L('#ffffff'), hill: L('#9fd4a6'),
    bldg: L('#93a0b2'), bldg2: L('#79879b'), win: L('#ffe79a'), winOff: L('#5b6675'),
    pow: { can: L('#4f7cff'), shield: L('#8a97a6'), speed: L('#e0a92b'), magnet: L('#e0483c'), food: L('#c8783a') },
    signBoard: L('#fdf3d6'), signPost: L('#8a6a44'),
  };
  MAT.pow.shield.emissive = new T.Color('#223'); MAT.lampGlow.emissive = new T.Color('#7a6a2a');
  const GRASSA_F = new T.Color('#5fa437'), GRASSA_C = new T.Color('#8f969d'), GRASSB_F = new T.Color('#6cb040'), GRASSB_C = new T.Color('#a1a8ae');
  const DIRT_F = new T.Color('#7c5836'), DIRT_C = new T.Color('#666d75'), CURB_F = new T.Color('#8a7a55'), CURB_C = new T.Color('#c2c5c9');

  const box = (w, h, d) => new T.BoxGeometry(w, h, d), sph = (r, a, b) => new T.SphereGeometry(r, a || 12, b || 10), cyl = (a, b, h, s) => new T.CylinderGeometry(a, b, h, s || 12);
  function M(geo, mat, cast) { const m = new T.Mesh(geo, mat); if (cast) m.castShadow = true; return m; }

  // ---- Jimothy: chunky, short-bodied, blunt big head, raccoon-coloured -----
  function buildRaccoon() {
    const g = new T.Group(); g.legs = [];
    // full ringed tail, stubby & thick, angled up-back
    const tail = new T.Group(); tail.position.set(-0.42, 0.48, 0); tail.rotation.z = 0.7;
    for (let i = 0; i < 6; i++) { const s = M(sph(0.26 - i * 0.02, 10, 8), i % 2 ? MAT.ring : MAT.fur, true); s.position.set(-i * 0.17, i * 0.05, 0); tail.add(s); }
    g.add(tail); g.tail = tail;
    // stubby legs
    const legGeo = cyl(0.13, 0.12, 0.32, 8);
    for (const [lx, lz] of [[-0.26, 0.22], [0.12, 0.22], [-0.26, -0.22], [0.12, -0.22]]) { const piv = new T.Group(); piv.position.set(lx, 0.32, lz); const leg = M(legGeo, MAT.paw, true); leg.position.y = -0.16; const paw = M(sph(0.13, 8, 6), MAT.paw); paw.position.y = -0.3; paw.scale.set(1, 0.6, 1.1); piv.add(leg); piv.add(paw); g.add(piv); g.legs.push(piv); }
    // chunky short body (hunched, low, wide)
    const body = M(sph(0.56), MAT.fur, true); body.scale.set(1.12, 0.9, 1.06); body.position.set(-0.02, 0.5, 0); g.add(body);
    const back = M(sph(0.4), MAT.fur2, true); back.scale.set(1, 0.8, 1); back.position.set(-0.18, 0.66, 0); g.add(back); // rounded hump
    const belly = M(sph(0.34), MAT.belly); belly.scale.set(1.05, 0.8, 0.95); belly.position.set(0.16, 0.4, 0); g.add(belly);
    // BIG blunt head, close to body (short neck), tilted slightly down
    const head = new T.Group(); head.position.set(0.4, 0.74, 0); head.rotation.z = -0.12; g.add(head); g.head = head;
    const skull = M(sph(0.44), MAT.fur2, true); skull.scale.set(1, 0.98, 1.02); head.add(skull);
    const forehead = M(sph(0.34), MAT.face); forehead.scale.set(0.9, 0.7, 0.95); forehead.position.set(0.16, 0.16, 0); head.add(forehead); // cream forehead
    const snout = M(sph(0.22, 10, 8), MAT.face); snout.scale.set(1.1, 0.82, 0.92); snout.position.set(0.34, -0.12, 0); head.add(snout); // short blunt muzzle
    const nose = M(sph(0.09, 8, 6), MAT.nose); nose.position.set(0.53, -0.14, 0); head.add(nose);
    // black mask band across the eyes
    const maskGeo = sph(0.17, 10, 8);
    for (const sz of [-1, 1]) {
      const mk = M(maskGeo, MAT.mask); mk.scale.set(0.85, 0.7, 0.55); mk.position.set(0.2, 0.02, sz * 0.2); head.add(mk);
      const eye = M(sph(0.075, 8, 6), MAT.face); eye.position.set(0.27, 0.03, sz * 0.2); head.add(eye);
      const pup = M(sph(0.038, 6, 6), MAT.nose); pup.position.set(0.33, 0.03, sz * 0.2); head.add(pup);
      const ear = M(sph(0.16, 10, 8), MAT.ear, true); ear.scale.set(0.7, 0.9, 0.5); ear.position.set(-0.02, 0.4, sz * 0.26); head.add(ear);
      const earIn = M(sph(0.09, 8, 6), MAT.mask); earIn.scale.set(0.6, 0.8, 0.4); earIn.position.set(0.02, 0.4, sz * 0.28); head.add(earIn);
    }
    // dark bridge joining the mask
    const bridge = M(box(0.16, 0.12, 0.34), MAT.mask); bridge.position.set(0.22, 0.06, 0); head.add(bridge);
    return g;
  }

  // ---- Dog (enemy / chaser): floppy ears, muzzle, collar, tail -------------
  function buildDog(bodyMat, faceDir, chase) {
    const g = new T.Group(); g.legs = [];
    const legGeo = cyl(0.1, 0.09, 0.4, 8);
    for (const [lx, lz] of [[-0.34, 0.17], [0.24, 0.17], [-0.34, -0.17], [0.24, -0.17]]) { const piv = new T.Group(); piv.position.set(lx, 0.4, lz); const leg = M(legGeo, MAT.dogDark, true); leg.position.y = -0.2; const paw = M(box(0.16, 0.1, 0.18), MAT.dogDark); paw.position.y = -0.4; piv.add(leg); piv.add(paw); g.add(piv); g.legs.push(piv); }
    const body = M(sph(0.46), bodyMat, true); body.scale.set(1.35, 0.92, 0.86); body.position.set(0, 0.6, 0); g.add(body);
    const chest = M(sph(0.34), bodyMat, true); chest.position.set(0.36, 0.56, 0); g.add(chest);
    const neck = M(cyl(0.22, 0.26, 0.4, 10), bodyMat, true); neck.position.set(0.5, 0.72, 0); neck.rotation.z = -0.7; g.add(neck);
    const head = M(sph(0.3, 12, 10), bodyMat, true); head.position.set(0.72, 0.9, 0); g.add(head);
    const muzzle = M(box(0.34, 0.2, 0.24), MAT.dogDark); muzzle.position.set(1.0, 0.82, 0); g.add(muzzle);
    const nose = M(sph(0.08, 8, 6), MAT.nose); nose.position.set(1.18, 0.86, 0); g.add(nose);
    for (const sz of [-1, 1]) { const ear = M(box(0.1, 0.28, 0.16), MAT.dogDark, true); ear.position.set(0.64, 1.02, sz * 0.2); ear.rotation.z = 0.4; g.add(ear); const eye = M(sph(0.05, 6, 6), chase ? MAT.hyd : MAT.nose); eye.position.set(0.86, 0.98, sz * 0.15); g.add(eye); }
    if (chase) { const tongue = M(box(0.1, 0.04, 0.16), MAT.tongue); tongue.position.set(1.08, 0.72, 0); g.add(tongue); }
    const collar = M(new T.TorusGeometry(0.26, 0.05, 8, 16), MAT.collar); collar.position.set(0.56, 0.74, 0); collar.rotation.y = Math.PI / 2; g.add(collar);
    const tag = M(sph(0.05, 6, 6), MAT.gold); tag.position.set(0.56, 0.5, 0); g.add(tag);
    const tail = M(cyl(0.05, 0.1, 0.5, 6), bodyMat, true); tail.position.set(-0.6, 0.85, 0); tail.rotation.z = -1.1; g.add(tail);
    g.rotation.y = faceDir < 0 ? Math.PI : 0;
    return g;
  }

  // ---- Human catcher: cap, swinging arms/legs, a net on a pole ------------
  function buildHuman() {
    const g = new T.Group(); g.legs = []; g.arms = [];
    for (const lx of [-0.15, 0.15]) { const piv = new T.Group(); piv.position.set(lx, 0.92, 0); const leg = M(cyl(0.12, 0.1, 0.92, 8), MAT.pants, true); leg.position.y = -0.46; const shoe = M(box(0.2, 0.14, 0.34), MAT.shoe); shoe.position.set(0.04, -0.9, 0.05); piv.add(leg); piv.add(shoe); g.add(piv); g.legs.push(piv); }
    const torso = M(box(0.52, 0.72, 0.34), MAT.shirt, true); torso.position.set(0, 1.32, 0); g.add(torso);
    const belt = M(box(0.54, 0.1, 0.36), MAT.pants); belt.position.set(0, 0.98, 0); g.add(belt);
    const neck = M(cyl(0.1, 0.1, 0.14, 8), MAT.skin); neck.position.set(0, 1.74, 0); g.add(neck);
    const head = M(sph(0.23, 12, 10), MAT.skin, true); head.position.set(0, 1.94, 0); g.add(head);
    const cap = M(sph(0.25, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.cap); cap.position.set(0, 2.0, 0); g.add(cap);
    const brim = M(box(0.34, 0.05, 0.22), MAT.cap); brim.position.set(0.18, 1.98, 0); g.add(brim);
    for (const sz of [-1, 1]) { const eye = M(sph(0.03, 6, 6), MAT.nose); eye.position.set(0.16, 1.94, sz * 0.09); g.add(eye); }
    // arms (front arm holds the net pole)
    const armL = new T.Group(); armL.position.set(-0.32, 1.55, 0); const la = M(cyl(0.09, 0.08, 0.66, 6), MAT.shirt, true); la.position.y = -0.33; const lh = M(sph(0.09, 6, 6), MAT.skin); lh.position.y = -0.66; armL.add(la); armL.add(lh); g.add(armL); g.arms.push(armL);
    const armR = new T.Group(); armR.position.set(0.32, 1.55, 0); const ra = M(cyl(0.09, 0.08, 0.66, 6), MAT.shirt, true); ra.position.y = -0.33; const rh = M(sph(0.09, 6, 6), MAT.skin); rh.position.y = -0.66; armR.add(ra); armR.add(rh); armR.rotation.z = 0.5; g.add(armR); g.arms.push(armR);
    // the net on a pole, held forward toward the runner
    const net = new T.Group(); net.position.set(0.5, 1.0, 0); net.rotation.z = 0.5;
    const pole = M(cyl(0.04, 0.04, 1.4, 6), MAT.pole); pole.rotation.z = Math.PI / 2; net.add(pole);
    const ring = M(new T.TorusGeometry(0.28, 0.03, 6, 16), MAT.net); ring.position.set(0.8, 0, 0); net.add(ring);
    const bag = M(sph(0.26, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), MAT.net, false); bag.rotation.x = Math.PI; bag.position.set(0.86, 0, 0); bag.material = new T.MeshLambertMaterial({ color: 0xc9cdd2, transparent: true, opacity: 0.5, side: T.DoubleSide }); net.add(bag);
    g.add(net);
    g.rotation.y = Math.PI; // face -X toward the runner
    return g;
  }

  // ---- obstacles (proper collision box: {hw, top}) -------------------------
  function buildObstacle(ty) {
    const g = new T.Group(); let bx;
    if (ty === 'log') { const m = M(cyl(0.36, 0.36, 1.7, 14), MAT.wood, true); m.rotation.x = Math.PI / 2; m.position.y = 0.36; g.add(m); for (const zz of [-0.85, 0.85]) { const r = M(cyl(0.37, 0.37, 0.06, 14), MAT.woodDark); r.rotation.x = Math.PI / 2; r.position.set(0, 0.36, zz); g.add(r); } const rings = M(new T.TorusGeometry(0.18, 0.04, 6, 12), MAT.woodDark); rings.position.set(0, 0.36, 0.86); g.add(rings); bx = { hw: 0.42, top: 0.72 }; }
    else if (ty === 'rock') { const m = M(new T.DodecahedronGeometry(0.56, 0), MAT.stone, true); m.position.y = 0.42; m.rotation.set(0.5, 0.6, 0.2); g.add(m); const m2 = M(new T.DodecahedronGeometry(0.3, 0), MAT.stoneDk, true); m2.position.set(0.4, 0.24, 0.2); g.add(m2); bx = { hw: 0.5, top: 0.9 }; }
    else if (ty === 'bin') { const m = M(cyl(0.34, 0.3, 1.05, 14), MAT.bin, true); m.position.y = 0.52; g.add(m); const lid = M(cyl(0.38, 0.38, 0.1, 14), MAT.binLid, true); lid.position.y = 1.06; g.add(lid); const h = M(box(0.1, 0.06, 0.16), MAT.binLid); h.position.y = 1.14; g.add(h); for (let i = 0.2; i < 1; i += 0.2) { const rib = M(cyl(0.345, 0.315, 0.03, 14), MAT.binLid); rib.position.y = i; g.add(rib); } bx = { hw: 0.36, top: 1.1 }; }
    else if (ty === 'hydrant') { const m = M(cyl(0.2, 0.26, 0.7, 12), MAT.hyd, true); m.position.y = 0.35; g.add(m); const cap = M(sph(0.22, 10, 8), MAT.hyd); cap.position.y = 0.74; g.add(cap); const bolt = M(sph(0.09, 6, 6), MAT.hyd); bolt.position.set(0, 0.86, 0); g.add(bolt); const arm = M(cyl(0.07, 0.07, 0.7, 8), MAT.hyd); arm.rotation.z = Math.PI / 2; arm.position.y = 0.5; g.add(arm); for (const sx of [-0.35, 0.35]) { const c = M(cyl(0.1, 0.1, 0.08, 10), MAT.hyd); c.rotation.z = Math.PI / 2; c.position.set(sx, 0.5, 0); g.add(c); } bx = { hw: 0.3, top: 0.86 }; }
    else { const m = M(box(0.82, 0.82, 0.82), MAT.crate, true); m.position.y = 0.41; g.add(m); const frame = M(box(0.86, 0.12, 0.86), MAT.crateDk); frame.position.y = 0.41; g.add(frame); for (const sy of [0.1, 0.72]) { const f = M(box(0.86, 0.1, 0.86), MAT.crateDk); f.position.y = sy; g.add(f); } bx = { hw: 0.42, top: 0.82 }; }
    g.userData.box = bx; return g;
  }

  function buildCoin() { const g = new T.Group(); const m = M(cyl(0.32, 0.32, 0.08, 20), MAT.gold, true); m.rotation.x = Math.PI / 2; g.add(m); const rim = M(new T.TorusGeometry(0.32, 0.045, 8, 22), MAT.goldEdge); g.add(rim); g.position.y = 1; return g; }
  function buildPowerup(kind) { const g = new T.Group(); const core = M(new T.IcosahedronGeometry(0.34, 0), MAT.pow[kind], true); g.add(core); const ring = M(new T.TorusGeometry(0.42, 0.03, 6, 20), MAT.pow[kind]); ring.rotation.x = 1.2; g.add(ring); g.position.y = 1; g.userData.kind = kind; return g; }
  function buildFood() { const g = new T.Group(); const b = M(box(0.52, 0.28, 0.4), MAT.pow.food, true); b.position.y = 0.2; g.add(b); const top = M(box(0.54, 0.12, 0.42), MAT.crate); top.position.y = 0.4; g.add(top); const bone = M(cyl(0.05, 0.05, 0.3, 6), MAT.face); bone.rotation.z = Math.PI / 2; bone.position.y = 0.52; g.add(bone); g.position.y = 0.7; return g; }
  function buildCan() { const g = new T.Group(); const m = M(cyl(0.12, 0.12, 0.34, 12), MAT.can, true); g.add(m); const lip = M(cyl(0.125, 0.125, 0.05, 12), MAT.canLip); lip.position.y = 0.17; g.add(lip); return g; }

  // ---- roadside props ------------------------------------------------------
  function buildTree() { const g = new T.Group(); const tr = M(cyl(0.2, 0.28, 2.4, 8), MAT.wood, true); tr.position.y = 1.2; g.add(tr); const cols = [MAT.leaf1, MAT.leaf2, MAT.leaf3]; for (let i = 0; i < 3; i++) { const c = M(sph(1.15 - i * 0.22, 10, 8), cols[i], true); c.position.y = 2.6 + i * 0.5; g.add(c); } return g; }
  function buildBush() { const g = new T.Group(); for (let i = 0; i < 3; i++) { const s = M(sph(0.4 - i * 0.06, 8, 6), i ? MAT.bushHi : MAT.bush, true); s.position.set((i - 1) * 0.32, 0.32 + (i === 2 ? 0.14 : 0), 0); g.add(s); } return g; }
  function buildMushroom() { const g = new T.Group(); const st = M(cyl(0.07, 0.09, 0.24, 8), MAT.face); st.position.y = 0.12; g.add(st); const cap = M(sph(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), MAT.mush); cap.position.y = 0.24; g.add(cap); return g; }
  function buildFlower(c) { const g = new T.Group(); const st = M(cyl(0.02, 0.02, 0.3, 5), MAT.leaf1); st.position.y = 0.15; g.add(st); for (let i = 0; i < 5; i++) { const p = M(sph(0.06, 6, 5), c); const a = i / 5 * 6.28; p.position.set(Math.cos(a) * 0.08, 0.32, Math.sin(a) * 0.08); g.add(p); } const mid = M(sph(0.05, 6, 5), MAT.flowerC); mid.position.y = 0.32; g.add(mid); return g; }
  function buildStreetlamp() { const g = new T.Group(); const pole = M(cyl(0.08, 0.11, 3.2, 8), MAT.lamp, true); pole.position.y = 1.6; g.add(pole); const arm = M(cyl(0.06, 0.06, 0.7, 6), MAT.lamp); arm.rotation.z = Math.PI / 2; arm.position.set(0.3, 3.15, 0); g.add(arm); const head = M(box(0.5, 0.16, 0.28), MAT.lamp); head.position.set(0.62, 3.05, 0); g.add(head); const glow = M(box(0.4, 0.08, 0.2), MAT.lampGlow); glow.position.set(0.62, 2.95, 0); g.add(glow); return g; }
  function buildBench() { const g = new T.Group(); const seat = M(box(1.4, 0.1, 0.5), MAT.bench, true); seat.position.y = 0.5; g.add(seat); const backr = M(box(1.4, 0.4, 0.1), MAT.bench); backr.position.set(0, 0.75, -0.2); g.add(backr); for (const sx of [-0.6, 0.6]) { const leg = M(box(0.1, 0.5, 0.5), MAT.benchLeg); leg.position.set(sx, 0.25, 0); g.add(leg); } return g; }
  function buildTrashbag() { const g = new T.Group(); const b = M(sph(0.3, 8, 6), MAT.bag, true); b.scale.set(1, 1.2, 1); b.position.y = 0.32; g.add(b); const tie = M(cyl(0.05, 0.09, 0.14, 6), MAT.bag); tie.position.y = 0.62; g.add(tie); return g; }
  function buildCloud() { const g = new T.Group(); for (let i = 0; i < 4; i++) { const s = M(sph(0.8 + Math.random() * 0.6, 8, 6), MAT.cloud, false); s.position.set((i - 1.5) * 0.9, Math.random() * 0.4, Math.random() * 0.5); g.add(s); } return g; }
  function buildHill() { const g = new T.Group(); const s = M(sph(6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), MAT.hill, false); s.scale.set(1.6, 0.5, 1); g.add(s); return g; }
  function buildBuilding(h) { const g = new T.Group(); const b = M(box(2.6, h, 2.6), Math.random() < 0.5 ? MAT.bldg : MAT.bldg2, true); b.position.y = h / 2; g.add(b); for (let wy = 1; wy < h - 0.7; wy += 1.1) for (let wx = -0.75; wx <= 0.75; wx += 0.75) { const w = M(box(0.42, 0.55, 0.06), Math.random() < 0.6 ? MAT.win : MAT.winOff, false); w.position.set(wx, wy, 1.31); g.add(w); } const roof = M(box(2.7, 0.3, 2.7), MAT.bldg2); roof.position.y = h; g.add(roof); return g; }

  // ---- in-world control sign ----------------------------------------------
  function makeTextTexture(title, sub) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 160; const x = c.getContext('2d');
    x.fillStyle = '#fdf3d6'; x.strokeStyle = '#7c5836'; x.lineWidth = 10;
    x.beginPath(); x.rect(6, 6, 244, 148); x.fill(); x.stroke();
    x.fillStyle = '#2f6d4a'; x.font = '700 40px Fredoka, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(title, 128, 56); x.fillStyle = '#3a2a1a'; x.font = '600 26px Fredoka, sans-serif'; x.fillText(sub, 128, 108);
    const tex = new T.CanvasTexture(c); tex.anisotropy = 4; return tex;
  }
  function buildSign(title, sub) {
    const g = new T.Group();
    const post = M(cyl(0.06, 0.06, 1.6, 6), MAT.signPost, true); post.position.y = 0.8; g.add(post);
    const board = M(box(1.3, 0.82, 0.08), MAT.signBoard, true); board.position.y = 1.7; g.add(board);
    const face = new T.Mesh(new T.PlaneGeometry(1.25, 0.78), new T.MeshBasicMaterial({ map: makeTextTexture(title, sub) })); face.position.set(0, 1.7, 0.05); g.add(face);
    return g;
  }

  function buildShadow() { const m = new T.Mesh(new T.CircleGeometry(0.6, 18), new T.MeshBasicMaterial({ color: 0x1a2410, transparent: true, opacity: 0.24 })); m.rotation.x = -Math.PI / 2; m.position.y = 0.02; return m; }

  // ---- state ---------------------------------------------------------------
  let player, playerModel, chaser, chaserModel, deco, obstacles, enemies, coins, pickups, cans, particles, signs, clouds;
  let scrollSpeed, lead, coinsN, score, ammo, jumps, running, over, nextSpawn, lastKind, nextDeco, groundTiles, invuln, magnetT, speedT, shieldOn, stumbleT, shakeT, powerTO;
  const LANE = 0, GRAV = 34, JUMP_V = 12.6, TILE = 2, HALF = 34;
  let pits = [];

  function clr(arr) { for (const o of arr) scene.remove(o.mesh || o); arr.length = 0; }
  function reset() {
    if (obstacles) { clr(obstacles); clr(enemies); clr(coins); clr(pickups); clr(cans); clr(particles); clr(deco); clr(signs); clr(clouds); for (const k in groundTiles) scene.remove(groundTiles[k]); }
    obstacles = []; enemies = []; coins = []; pickups = []; cans = []; particles = []; deco = []; signs = []; clouds = []; groundTiles = {}; pits = [];

    player = { x: 0, y: 0, vy: 0, onGround: true, run: 0 };
    if (!playerModel) { playerModel = buildRaccoon(); playerModel.pShadow = buildShadow(); scene.add(playerModel); scene.add(playerModel.pShadow); }
    playerModel.position.set(0, 0, LANE);
    chaser = { x: -6, y: 0, vy: 0, onGround: true, run: 0 };
    if (!chaserModel) { chaserModel = buildDog(MAT.dogChase, 1, true); chaserModel.cShadow = buildShadow(); scene.add(chaserModel); scene.add(chaserModel.cShadow); }

    scrollSpeed = 9; lead = 76; coinsN = 0; score = 0; ammo = 0; jumps = 0;
    nextSpawn = 34; lastKind = 'flat'; nextDeco = 8; invuln = 0; magnetT = 0; speedT = 0; shieldOn = false; stumbleT = 0; shakeT = 0;
    running = true; over = false;
    // control signs near the start (player reads them as they run past)
    [['JUMP', 'SPACE / UP / TAP'], ['DOUBLE-JUMP', 'TAP AGAIN IN AIR'], ['THROW CAN', 'F / DOWN / BTN'], ['WATCH OUT', 'GAPS · DOGS · PEOPLE']].forEach((s, i) => { const m = buildSign(s[0], s[1]); m.position.set(9 + i * 8, 0, 2.4); scene.add(m); signs.push({ mesh: m, x: 9 + i * 8 }); });
    for (let i = 0; i < 6; i++) { const c = buildCloud(); const cx = i * 14, cz = -14 - Math.random() * 10, cy = 12 + Math.random() * 6; c.position.set(cx, cy, cz); scene.add(c); clouds.push({ mesh: c, x: cx, y: cy, z: cz }); }
    ensureGround(); setHUD();
  }

  // ---- ground with gaps, curbs, stripes, city centre-line -----------------
  function inPit(x) { for (const p of pits) if (x > p.x0 && x < p.x1) return true; return false; }
  function biomeName(x) { return (Math.floor(x / 130) % 2 === 0) ? 'forest' : 'city'; }
  function ensureGround() {
    const i0 = Math.floor((player.x - 14) / TILE), i1 = Math.floor((player.x + HALF) / TILE);
    for (let i = i0; i <= i1; i++) {
      const cx = i * TILE + TILE / 2;
      if (inPit(cx)) { if (groundTiles[i]) { scene.remove(groundTiles[i]); delete groundTiles[i]; } continue; }
      if (!groundTiles[i]) {
        const g = new T.Group(); const city = biomeName(cx) === 'city';
        const top = M(box(TILE + 0.02, 0.3, 6.4), (i & 1) ? MAT.grassB : MAT.grassA, false); top.position.y = -0.15; top.receiveShadow = true; g.add(top);
        const dirt = M(box(TILE + 0.02, 2.6, 6.4), MAT.dirt, false); dirt.position.y = -1.6; g.add(dirt);
        for (const sz of [-2.9, 2.9]) { const curb = M(box(TILE + 0.02, 0.22, 0.5), MAT.curb, false); curb.position.set(0, -0.05, sz); g.add(curb); }
        if (city && (i & 1)) { const line = new T.Mesh(box(0.8, 0.02, 0.16), MAT.line); line.position.set(0, 0.01, 0); g.add(line); }
        g.position.x = cx; scene.add(g); groundTiles[i] = g;
      }
    }
    for (const k in groundTiles) { if (+k < i0 - 1 || +k > i1 + 1) { scene.remove(groundTiles[k]); delete groundTiles[k]; } }
    pits = pits.filter(p => p.x1 > player.x - 16);
  }

  function add(list, model, x, extra) { model.position.x = x; if (extra && extra.z !== undefined) model.position.z = extra.z; scene.add(model); const o = Object.assign({ mesh: model, x }, extra || {}); list.push(o); return o; }
  function spawnFeature() {
    const x = nextSpawn, diff = Math.min(1, player.x / 450), b = biomeName(x);
    let kind;
    if (lastKind === 'pit') kind = Math.random() < 0.6 ? 'coins' : 'flat';
    else { const r = Math.random(); if (r < 0.19) kind = 'pit'; else if (r < 0.47) kind = 'obstacle'; else if (r < 0.65) kind = 'enemy'; else if (r < 0.85) kind = 'coins'; else if (r < 0.92) kind = 'food'; else kind = 'power'; }
    let gap = 7 + Math.random() * 4 - diff * 2;
    if (kind === 'pit') { const w = 2.4 + Math.random() * (1.4 + diff * 1.6); pits.push({ x0: x - w / 2, x1: x + w / 2 }); gap = w + 5.5 + Math.random() * 3; }
    else if (kind === 'obstacle') { const set = b === 'forest' ? ['log', 'rock', 'crate'] : ['bin', 'hydrant', 'crate']; const ty = set[(Math.random() * set.length) | 0]; const m = buildObstacle(ty); const o = add(obstacles, m, x); o.box = m.userData.box; o.sh = buildShadow(); o.sh.position.set(x, 0.02, 0); scene.add(o.sh); gap = 6 + Math.random() * 4 - diff * 1.5; }
    else if (kind === 'enemy') { const ty = (b === 'city' && Math.random() < 0.5) ? 'human' : 'dog'; const m = ty === 'dog' ? buildDog(MAT.dog, -1, false) : buildHuman(); const o = add(enemies, m, x, { ty, dead: false, vx: ty === 'dog' ? -3 : -0.7, run: 0, top: ty === 'human' ? 2.0 : 0.95, hw: ty === 'human' ? 0.32 : 0.5 }); o.sh = buildShadow(); scene.add(o.sh); gap = 8 + Math.random() * 4; }
    else if (kind === 'coins') { const n = 3 + ((Math.random() * 4) | 0), arc = Math.random() < 0.5; for (let i = 0; i < n; i++) { const m = buildCoin(); m.position.y = 1 + (arc ? Math.sin(i / (n - 1) * Math.PI) * 1.5 : 0.3); add(coins, m, x + i * 1.15); } gap = n * 1.15 + 5; }
    else if (kind === 'food') { add(pickups, buildFood(), x, { kind: 'food' }); gap = 8; }
    else if (kind === 'power') { const k = ['can', 'shield', 'speed', 'magnet'][(Math.random() * 4) | 0]; add(pickups, buildPowerup(k), x, { kind: k }); gap = 8; }
    else gap = 5 + Math.random() * 4;
    lastKind = kind; nextSpawn += Math.max(4.5, gap);
  }
  function spawnDeco() {
    const b = biomeName(nextDeco);
    for (const side of [-1, 1]) {
      if (Math.random() < 0.5) continue;
      const z = side * (3.4 + Math.random() * 6);
      if (b === 'forest') { const r = Math.random(); const m = r < 0.4 ? buildTree() : r < 0.6 ? buildBush() : r < 0.75 ? buildMushroom() : r < 0.9 ? buildFlower(Math.random() < 0.5 ? MAT.flower1 : MAT.flower2) : buildBush(); if (r < 0.4) m.scale.setScalar(0.7 + Math.random() * 0.6); add(deco, m, nextDeco + Math.random() * 2, { z }); }
      else { const r = Math.random(); const m = r < 0.35 ? buildBuilding(4 + Math.random() * 7) : r < 0.6 ? buildStreetlamp() : r < 0.78 ? buildBench() : r < 0.9 ? buildTrashbag() : buildBush(); add(deco, m, nextDeco + Math.random() * 2, { z: r < 0.35 ? z * 1.6 - side * 3 : z }); }
    }
    // far scenery
    if (Math.random() < 0.5) { const m = b === 'forest' ? buildHill() : buildBuilding(6 + Math.random() * 9); add(deco, m, nextDeco + Math.random() * 6, { z: -24 - Math.random() * 10 }); }
    nextDeco += 5 + Math.random() * 4;
  }

  // ---- input ---------------------------------------------------------------
  function doJump() { if (!running) return; if (jumps < 2) { player.vy = JUMP_V * (jumps === 0 ? 1 : 0.92); player.onGround = false; jumps++; } }
  function doThrow() { if (!running || ammo <= 0) return; ammo--; setHUD(); const m = buildCan(); add(cans, m, player.x + 0.6, { y: player.y + 1.1, vx: scrollSpeed + 9, vy: 3 }); m.position.set(player.x + 0.6, player.y + 1.1, LANE); }
  window.addEventListener('keydown', e => { const k = e.key.toLowerCase(); if (k === ' ' || k === 'arrowup' || k === 'w') { e.preventDefault(); doJump(); } else if (k === 'f' || k === 'arrowdown' || k === 's') { e.preventDefault(); doThrow(); } });
  canvas.addEventListener('mousedown', doJump);
  canvas.addEventListener('touchstart', e => { e.preventDefault(); doJump(); }, { passive: false });
  const hold = (btn, fn) => { btn.addEventListener('touchstart', e => { e.preventDefault(); fn(); }, { passive: false }); btn.addEventListener('mousedown', e => { e.preventDefault(); e.stopPropagation(); fn(); }); };
  hold(el.jumpBtn, doJump); hold(el.throwBtn, doThrow);
  if ('ontouchstart' in window) el.touch.classList.add('on');

  // ---- effects -------------------------------------------------------------
  function takeHit() { if (invuln > 0) return; invuln = 0.9; if (shieldOn) { shieldOn = false; showPower('Shield broke!', '#7a8a9c'); shakeT = 0.2; return; } lead -= 16; stumbleT = 0.45; shakeT = 0.32; puff(player.x, player.y + 1, 0xe0483c); }
  function applyPickup(k) {
    if (k === 'food') { lead = Math.min(100, lead + 26); showPower('Snack! Dog falls back', '#2fa96b'); puff(player.x, player.y + 1, 0x2fa96b); }
    else if (k === 'can') { ammo += 3; showPower('+3 cans to throw', '#4f7cff'); }
    else if (k === 'shield') { shieldOn = true; showPower('Shield up', '#7a8a9c'); }
    else if (k === 'speed') { speedT = 4.5; showPower('Speed boost!', '#e0a92b'); }
    else if (k === 'magnet') { magnetT = 6; showPower('Coin magnet!', '#e0483c'); }
    setHUD();
  }
  function puff(x, y, color) { for (let i = 0; i < 9; i++) { const m = new T.Mesh(sph(0.08, 6, 5), B(color)); m.position.set(x, y, LANE); scene.add(m); particles.push({ mesh: m, vx: (Math.random() - 0.5) * 4, vy: Math.random() * 4.5, vz: (Math.random() - 0.5) * 3, life: 0.5 }); } }

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
    if (player.y < -4) return gameOver('fell');
    if (player.onGround) player.run += scrollSpeed * dt * 1.5;

    while (nextSpawn < player.x + 52) spawnFeature();
    while (nextDeco < player.x + 66) spawnDeco();
    ensureGround();

    // chaser: closer as lead drops; physically hops obstacles & chasms
    const targetX = player.x - (2.0 + Math.max(0, lead) * 0.08);
    chaser.x += (targetX - chaser.x) * Math.min(1, dt * 6);
    chaser.vy -= GRAV * dt; chaser.y += chaser.vy * dt;
    if (!inPit(chaser.x + 0.4) && chaser.y <= 0) { chaser.y = 0; chaser.vy = 0; chaser.onGround = true; } else chaser.onGround = false;
    if (chaser.onGround) { let hz = inPit(chaser.x + 1.6) || inPit(chaser.x + 2.4); for (const o of obstacles) if (Math.abs(o.x - (chaser.x + 1.9)) < 0.9) hz = true; if (hz) { chaser.vy = JUMP_V * 0.94; chaser.onGround = false; } chaser.run += scrollSpeed * dt * 1.6; }
    if (chaser.y < -4) { chaser.x = player.x - 3; chaser.y = 0; chaser.vy = 0; }

    for (const e of enemies) { if (e.dead) continue; e.x += e.vx * dt; e.run += dt * 9; }

    // cans
    for (let i = cans.length - 1; i >= 0; i--) { const c = cans[i]; c.x += c.vx * dt; c.vy -= GRAV * dt; c.y += c.vy * dt; c.mesh.position.set(c.x, c.y, LANE); c.mesh.rotation.z += dt * 14;
      let hit = false; for (const e of enemies) if (!e.dead && Math.abs(e.x - c.x) < 0.75 && c.y < e.top + 0.3) { e.dead = true; hit = true; score += 15; puff(e.x, 0.9, 0xffd23f); scene.remove(e.mesh); if (e.sh) scene.remove(e.sh); }
      if (hit || c.y < 0 || c.x < player.x - 6) { scene.remove(c.mesh); cans.splice(i, 1); }
    }

    // precise collision: hit only if inside the box AND not cleared by height
    const pw = 0.36, pBottom = player.y + 0.12;
    for (const o of obstacles) { const b = o.box; if (player.x + pw > o.x - b.hw && player.x - pw < o.x + b.hw && pBottom < b.top - 0.06) takeHit(); }
    for (const e of enemies) { if (e.dead) continue; if (player.x + pw > e.x - e.hw && player.x - pw < e.x + e.hw && pBottom < e.top - 0.06) takeHit(); }

    // coins
    for (let i = coins.length - 1; i >= 0; i--) { const c = coins[i]; c.mesh.rotation.y += dt * 4;
      if (magnetT > 0 && Math.abs(c.x - player.x) < 4.5) { c.x += (player.x - c.x) * dt * 5; c.mesh.position.y += ((player.y + 1) - c.mesh.position.y) * dt * 5; }
      if (Math.abs(c.x - player.x) < 0.7 && Math.abs(c.mesh.position.y - (player.y + 1)) < 1.3) { scene.remove(c.mesh); coins.splice(i, 1); coinsN++; score += 5; puff(c.x, c.mesh.position.y, 0xffd23f); }
    }
    for (let i = pickups.length - 1; i >= 0; i--) { const p = pickups[i]; p.mesh.rotation.y += dt * 2; p.mesh.position.y = (p.kind === 'food' ? 0.7 : 1) + Math.sin(performance.now() / 300 + p.x) * 0.12;
      if (Math.abs(p.x - player.x) < 0.85 && player.y < 1.7) { scene.remove(p.mesh); pickups.splice(i, 1); applyPickup(p.kind); }
    }

    const cut = player.x - 16;
    const cull = a => { for (let i = a.length - 1; i >= 0; i--) if (a[i].x < cut) { scene.remove(a[i].mesh); if (a[i].sh) scene.remove(a[i].sh); a.splice(i, 1); } };
    cull(obstacles); cull(enemies); cull(coins); cull(pickups); cull(deco); cull(signs);
    for (const cl of clouds) if (cl.x < player.x - 20) { cl.x += 14 * 6; cl.mesh.position.x = cl.x; }

    for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.vy -= 12 * dt; p.mesh.position.x += p.vx * dt; p.mesh.position.y += p.vy * dt; p.mesh.position.z += p.vz * dt; p.life -= dt; if (p.life <= 0) { scene.remove(p.mesh); particles.splice(i, 1); } }

    score = Math.max(score, Math.floor(player.x) + coinsN * 5);
    if (lead <= 0) return gameOver('caught');
    syncModels(dt); updateBiome(); setHUD();
  }

  function animLegs(m, run, air) { if (!m.legs) return; for (let i = 0; i < m.legs.length; i++) m.legs[i].rotation.x = air ? -0.5 : Math.sin(run + i * Math.PI) * 0.75; }
  function syncModels(dt) {
    playerModel.position.set(player.x, player.y, LANE);
    playerModel.rotation.z = player.onGround ? (stumbleT > 0 ? 0.12 : 0) : -0.12;
    animLegs(playerModel, player.run, !player.onGround);
    if (playerModel.head) playerModel.head.rotation.z = -0.12 + Math.sin(player.run) * 0.04;
    if (playerModel.tail) playerModel.tail.rotation.x = Math.sin(player.run) * 0.18;
    playerModel.pShadow.position.set(player.x, 0.02, LANE); playerModel.pShadow.material.opacity = 0.24 * Math.max(0, 1 - player.y / 3);
    chaserModel.position.set(chaser.x, chaser.y, LANE); animLegs(chaserModel, chaser.run, !chaser.onGround);
    chaserModel.cShadow.position.set(chaser.x, 0.02, LANE); chaserModel.cShadow.material.opacity = 0.24 * Math.max(0, 1 - chaser.y / 3);
    for (const e of enemies) { if (e.dead) continue; e.mesh.position.set(e.x, 0, LANE); animLegs(e.mesh, e.run, false); if (e.mesh.arms) { e.mesh.arms[0].rotation.x = Math.sin(e.run) * 0.5; e.mesh.arms[1].rotation.x = -Math.sin(e.run) * 0.3; } if (e.sh) e.sh.position.set(e.x, 0.02, LANE); }
    for (const o of obstacles) o.mesh.position.x = o.x;
    for (const c of coins) c.mesh.position.x = c.x;
    for (const p of pickups) p.mesh.position.x = p.x;
    // camera with shake
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
    _c.copy(f ? GRASSA_F : GRASSA_C).lerp(f ? GRASSA_C : GRASSA_F, t); MAT.grassA.color.copy(_c);
    _c.copy(f ? GRASSB_F : GRASSB_C).lerp(f ? GRASSB_C : GRASSB_F, t); MAT.grassB.color.copy(_c);
    _c.copy(f ? DIRT_F : DIRT_C).lerp(f ? DIRT_C : DIRT_F, t); MAT.dirt.color.copy(_c);
    _c.copy(f ? CURB_F : CURB_C).lerp(f ? CURB_C : CURB_F, t); MAT.curb.color.copy(_c);
  }

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
    pending = { score: fs, dist: Math.floor(player.x) }; el.nameRow.classList.toggle('hidden', !q || fs <= 0);
    renderLB(el.lbOver, -1); el.over.classList.remove('hidden');
  }
  function saveScore() { if (!pending) return; const name = (el.nameInput.value || 'Jimothy').slice(0, 12); const l = loadLB(); l.push({ name, score: pending.score, dist: pending.dist }); l.sort((a, b) => b.score - a.score); saveLB(l); renderLB(el.lbOver, l.findIndex(r => r.name === name && r.score === pending.score)); el.nameRow.classList.add('hidden'); pending = null; try { localStorage.setItem('jimothy_run_name', name); } catch (e) {} }
  el.saveBtn.addEventListener('click', saveScore); el.nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveScore(); });
  function startRun() { el.start.classList.add('hidden'); el.over.classList.add('hidden'); reset(); }
  el.playBtn.addEventListener('click', startRun); el.retryBtn.addEventListener('click', startRun);

  try { const nm = localStorage.getItem('jimothy_run_name'); if (nm) el.nameInput.value = nm; } catch (e) {}
  reset(); running = false; over = false; syncModels(0); renderLB(el.lbStart, -1);
  requestAnimationFrame(frame);

  window.RUN3D = { state: function () { return { x: Math.round(player.x), lead: Math.round(lead), score: score, coins: coinsN, ammo: ammo, obstacles: obstacles.length, enemies: enemies.length, pits: pits.length, deco: deco.length, y: +player.y.toFixed(2), onGround: player.onGround, chaserX: +chaser.x.toFixed(1), over: over }; }, give: function (k) { applyPickup(k); }, setLead: function (v) { lead = v; }, hit: function () { takeHit(); } };
})();
