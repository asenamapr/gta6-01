// SOLARA BAY: One Last Drive — a 3D open-world crime game.
// Written in this session. three.js r152 (global THREE) renders the city;
// plain ES modules, no network requests, keyboard + mouse.
'use strict';

// ---------- utils ----------
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, lo, hi) => v < lo ? lo : v > hi ? hi : v;
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
function angDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }

// ---------- URL / shot params ----------
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') || '';
const SEED = parseInt(params.get('seed') || '1', 10) || 1;
const rng = mulberry32(SEED * 7919 + 13);

// ---------- game state ----------
const SAVE_KEY = 'solara-bay-save-v1';
const state = {
  started: false, paused: false, over: false,
  health: 100, cash: 0, wanted: 0,
  missionIndex: 0, stepIndex: 0, stepTimer: 0,
  hasPistol: false, ammo: 0,
  inCar: false, car: null, speed: 0,
  time: 18.7, // golden hour, hours
  radio: 0, muted: false,
  crimes: 0, lastCrimeT: -999, carsStolen: 0, pedsHit: 0,
  dannyInCar: false, ending: null,
  shot: SHOT,
};
function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: state.cash, missionIndex: state.missionIndex,
      health: state.health, hasPistol: state.hasPistol, ammo: state.ammo,
    }));
  } catch (e) { /* private mode */ }
}
function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

// ---------- audio: WebAudio synth SFX + moody radio loop ----------
const AudioSys = {
  ctx: null, master: null, engineOsc: null, engineGain: null, radioStep: 0,
  init() {
    if (this.ctx) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 40;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 320;
      this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
      this.startRadio();
    } catch (e) { this.ctx = null; }
  },
  setEngine(rpm01) {
    if (!this.ctx) return;
    this.engineOsc.frequency.value = 38 + rpm01 * 130;
    this.engineGain.gain.value = state.inCar ? 0.05 + rpm01 * 0.05 : 0.012;
  },
  blip(freq, dur, type, vol) {
    if (!this.ctx || state.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur);
  },
  noise(dur, vol, freq) {
    if (!this.ctx || state.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 900;
    const g = this.ctx.createGain(); g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  },
  sfx(name) {
    if (!this.ctx) return;
    if (name === 'punch') { this.noise(0.12, 0.35, 500); this.blip(90, 0.12, 'sine', 0.3); }
    if (name === 'shot') { this.noise(0.18, 0.5, 2400); this.blip(160, 0.1, 'square', 0.2); }
    if (name === 'cash') { this.blip(880, 0.12, 'sine', 0.22); setTimeout(() => this.blip(1320, 0.2, 'sine', 0.22), 110); }
    if (name === 'complete') { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.25, 'triangle', 0.25), i * 130)); }
    if (name === 'fail') { this.blip(220, 0.3, 'sawtooth', 0.2); setTimeout(() => this.blip(165, 0.4, 'sawtooth', 0.2), 180); }
    if (name === 'siren') { this.blip(750, 0.4, 'sine', 0.06); setTimeout(() => this.blip(980, 0.4, 'sine', 0.06), 420); }
    if (name === 'pickup') { this.blip(660, 0.1, 'triangle', 0.22); setTimeout(() => this.blip(990, 0.16, 'triangle', 0.22), 90); }
    if (name === 'crash') { this.noise(0.25, 0.4, 700); }
  },
  // moody radio: slow Am — F — C — G pad loop, one chord per bar
  startRadio() {
    const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 196, 246.9]];
    const stations = ['RADIO SOLARA 94.1 — “Golden Hour Drive”', 'RADIO SOLARA 94.1 — “Palms at Dusk”', 'RADIO SOLARA 94.1 — “Tide Out Slow”'];
    const step = () => {
      if (!this.ctx) return;
      if (!state.muted && state.started) {
        const chord = chords[this.radioStep % chords.length];
        const t = this.ctx.currentTime;
        chord.forEach((f) => {
          const o = this.ctx.createOscillator(), g = this.ctx.createGain();
          o.type = 'triangle'; o.frequency.value = f / 2;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.linearRampToValueAtTime(0.045, t + 0.6);
          g.gain.linearRampToValueAtTime(0.0001, t + 2.6);
          o.connect(g); g.connect(this.master);
          o.start(t); o.stop(t + 2.7);
        });
        const el = document.getElementById('radio');
        if (el) el.textContent = '♪ ' + stations[this.radioStep % stations.length];
      }
      this.radioStep++;
      setTimeout(step, 2700);
    };
    step();
  },
};

// ---------- input ----------
const keys = {};
addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.code === 'KeyM') { state.muted = !state.muted; toast(state.muted ? 'Sound muted' : 'Sound on'); }
  if (e.code === 'KeyR') { AudioSys.radioStep++; toast('Radio station changed'); }
  if (e.code === 'KeyP' || e.code === 'Escape') togglePause();
  if (e.code === 'Enter' && !state.started) startGame();
  if (e.code === 'KeyE') onInteract();
  if (e.code === 'KeyF') onPunch();
});
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('mousedown', () => { onShoot(); });

// ---------- renderer / scene ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xef9a68, 150, 560);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 1200);
camera.position.set(40, 26, 120);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// late-afternoon golden hour: warm orange horizon -> dusk pink -> teal zenith
(function makeSky() {
  const cv = document.createElement('canvas'); cv.width = 4; cv.height = 256;
  const g = cv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#0e5a68'); grad.addColorStop(0.16, '#2e8f8f');
  grad.addColorStop(0.32, '#e58aa0'); grad.addColorStop(0.48, '#ff8a66');
  grad.addColorStop(0.66, '#ff9e45'); grad.addColorStop(1, '#ffc46b');
  g.fillStyle = grad; g.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(cv);
  scene.background = tex;
})();
// low evening sun disc, just above the horizon
(function makeSun() {
  const cv = document.createElement('canvas'); cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,214,140,1)'); grad.addColorStop(0.35, 'rgba(255,150,70,0.95)');
  grad.addColorStop(1, 'rgba(255,110,50,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
  spr.scale.set(380, 380, 1);
  spr.position.set(-280, 46, -430);
  scene.add(spr);
})();

const hemi = new THREE.HemisphereLight(0xf2a88e, 0x8a5f3d, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xff9440, 2.0);
sun.position.set(-300, 78, -190);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
sun.shadow.camera.far = 700;
scene.add(sun);

// ---------- world layout ----------
const CITY = 200;            // land half-extent in x
const SOUTH = 180;           // land ends here; bay to the south
const ROADS = [-160, -120, -80, -40, 0, 40, 80, 120, 160];
const colliders = [];        // {x,z,hx,hz}
function addCollider(x, z, hx, hz) { colliders.push({ x, z, hx, hz }); }
function collideCircle(p, r) {
  for (const c of colliders) {
    const dx = p.x - c.x, dz = p.z - c.z;
    const px = c.hx + r - Math.abs(dx), pz = c.hz + r - Math.abs(dz);
    if (px > 0 && pz > 0) {
      if (px < pz) p.x = c.x + Math.sign(dx || 1) * (c.hx + r);
      else p.z = c.z + Math.sign(dz || 1) * (c.hz + r);
    }
  }
}
const world = new THREE.Group();
scene.add(world);
const MAT = {};
function mat(color, opts) {
  const key = color + JSON.stringify(opts || {});
  if (!MAT[key]) MAT[key] = new THREE.MeshLambertMaterial(Object.assign({ color }, opts || {}));
  return MAT[key];
}
function box(w, h, d, color, x, y, z, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  world.add(m);
  return m;
}

// ground: land slab + bay water + beach strip
(function buildGround() {
  const land = new THREE.Mesh(new THREE.BoxGeometry(CITY * 2 + 60, 2, SOUTH + CITY + 30),
    mat(0x8f9a8a));
  land.position.set(0, -1, -10); land.receiveShadow = true; world.add(land);
  // sidewalk base, then dark road strips along every road line
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(CITY * 2, SOUTH + CITY), mat(0x7d8478));
  asphalt.rotation.x = -Math.PI / 2; asphalt.position.set(0, 0.02, -10); asphalt.receiveShadow = true; world.add(asphalt);
  const roadMat = mat(0x3a4148);
  for (const r of ROADS) {
    const stripX = new THREE.Mesh(new THREE.PlaneGeometry(13, SOUTH + CITY), roadMat);
    stripX.rotation.x = -Math.PI / 2; stripX.position.set(r, 0.04, -10); stripX.receiveShadow = true; world.add(stripX);
    const stripZ = new THREE.Mesh(new THREE.PlaneGeometry(CITY * 2, 13), roadMat);
    stripZ.rotation.x = -Math.PI / 2; stripZ.position.set(0, 0.04, r); stripZ.receiveShadow = true; world.add(stripZ);
  }
  // bay water (south + west)
  const water = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), mat(0x1e7d8c, { transparent: true, opacity: 0.92 }));
  water.rotation.x = -Math.PI / 2; water.position.set(-100, -0.4, 260); world.add(water);
  // beach strip along the south edge
  const beach = new THREE.Mesh(new THREE.PlaneGeometry(CITY * 2, 26), mat(0xe8cf9e));
  beach.rotation.x = -Math.PI / 2; beach.position.set(0, 0.05, SOUTH - 8); beach.receiveShadow = true; world.add(beach);
  const beachW = new THREE.Mesh(new THREE.PlaneGeometry(26, SOUTH + CITY), mat(0xe8cf9e));
  beachW.rotation.x = -Math.PI / 2; beachW.position.set(-CITY + 2, 0.05, -10); beachW.receiveShadow = true; world.add(beachW);
  // road markings: dashed center lines on every road
  const lineGeo = new THREE.BoxGeometry(0.7, 0.06, 6);
  const lineMat = mat(0xf5e9c8);
  for (const r of ROADS) {
    for (let t = -190; t <= 170; t += 16) {
      const a = new THREE.Mesh(lineGeo, lineMat); a.position.set(r, 0.06, t); world.add(a);
      const b = new THREE.Mesh(lineGeo, lineMat); b.position.set(t, 0.06, r); world.add(b);
    }
  }
})();

// buildings: pastel towers downtown, art-deco blocks elsewhere
const PASTEL = [0xffb3a0, 0x7fd8c8, 0xffd9a0, 0xf2f0e4, 0x9adbe8, 0xff9d8a, 0xc9e8b8, 0xf7c8d8];
const buildingRects = [];
(function buildCity() {
  const winMat = mat(0x2a3f4a, { emissive: 0xffc37a, emissiveIntensity: 0.55 });
  for (let ix = 0; ix < ROADS.length - 1; ix++) {
    for (let iz = 0; iz < ROADS.length - 1; iz++) {
      const cx = (ROADS[ix] + ROADS[ix + 1]) / 2;
      const cz = (ROADS[iz] + ROADS[iz + 1]) / 2;
      if (cz > 150) continue;                       // beach row stays open
      if (Math.abs(cx) < 12 && Math.abs(cz) > 150) continue;
      const downtown = Math.abs(cx) < 90 && Math.abs(cz) < 90;
      const n = downtown ? 1 : (rng() < 0.6 ? 2 : 1);
      for (let k = 0; k < n; k++) {
        const w = downtown ? 18 + rng() * 6 : 12 + rng() * 5;
        const d = downtown ? 18 + rng() * 6 : 12 + rng() * 5;
        const h = downtown ? 34 + rng() * 58 : 9 + rng() * 20;
        const ox = n === 2 ? (k === 0 ? -8 : 8) : 0;
        const oz = n === 2 ? (k === 0 ? -8 : 8) : 0;
        const bx = cx + ox, bz = cz + oz;
        if (Math.abs(bx) > 185 || bz > 165 || bz < -185) continue;
        const color = pick(rng, PASTEL);
        const b = box(w, h, d, color, bx, h / 2, bz);
        // rooftop trim + lit windows band
        box(w + 0.6, 1.2, d + 0.6, 0xffffff, bx, h + 0.4, bz);
        const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, Math.min(h * 0.5, 10), 0.4), winMat);
        win.position.set(bx, h * 0.55, bz + d / 2 + 0.25); world.add(win);
        const win2 = win.clone(); win2.position.z = bz - d / 2 - 0.25; world.add(win2);
        addCollider(bx, bz, w / 2 + 0.4, d / 2 + 0.4);
        buildingRects.push({ x: bx, z: bz, w, d, h });
        // art-deco fin on some towers
        if (downtown && rng() < 0.5) box(3, 10, 3, 0xff7a5c, bx, h + 6, bz);
      }
    }
  }
  // Solara Trust bank (mission 5) — coral tower with gold trim
  const bank = box(30, 46, 30, 0xff7a5c, 40, 23, -40);
  box(32, 2, 32, 0xffd34d, 40, 47, -40);
  addCollider(40, -40, 16, 16);
  buildingRects.push({ x: 40, z: -40, w: 30, d: 30, h: 46 });
  // Reef's Garage (start / safehouse) — teal low block with sign
  box(24, 10, 18, 0x2a9d8f, -140, 5, -140);
  addCollider(-140, -140, 13, 10);
  buildingRects.push({ x: -140, z: -140, w: 24, d: 18, h: 10 });
})();

// palms along boulevards + beach, lamps, benches, hydrants
const palmTops = [];
(function buildProps() {
  const trunkMat = mat(0x8a6a4d);
  const leafMat = mat(0x3fae7a);
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 9, 6);
  const leafGeo = new THREE.ConeGeometry(3.2, 4.5, 6);
  for (let i = 0; i < 90; i++) {
    let x, z;
    if (i < 30) { x = -190 + rng() * 380; z = 158 + rng() * 14; }        // beach row
    else if (i < 45) { x = -188 + rng() * 8; z = -180 + rng() * 330; }   // west strip
    else { const r = pick(rng, ROADS); x = r + 13 + rng() * 4; z = -180 + rng() * 330; }
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 4.5, z); trunk.castShadow = true; world.add(trunk);
    const top = new THREE.Mesh(leafGeo, leafMat);
    top.position.set(x, 10.5, z); top.castShadow = true; world.add(top);
    palmTops.push(top);
  }
  // street lamps
  const poleMat = mat(0x2e3438);
  const lampMat = mat(0xffe9a8, { emissive: 0xffd34d, emissiveIntensity: 0.9 });
  for (const r of ROADS) {
    for (let t = -160; t <= 160; t += 80) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 8, 5), poleMat);
      pole.position.set(r + 11, 4, t); world.add(pole);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), lampMat);
      lamp.position.set(r + 11, 8.2, t); world.add(lamp);
    }
  }
  // benches + hydrants + crates near the harbor
  for (let i = 0; i < 24; i++) {
    const r = pick(rng, ROADS);
    box(3.4, 0.5, 1.2, 0x6a4a3a, r + 12, 0.6, -170 + rng() * 320);
  }
  for (let i = 0; i < 10; i++) {
    box(1.2, 1.6, 1.2, 0xffd34d, 150 + rng() * 20, 0.8, -140 + rng() * 280);
  }
})();

// harbor bridge: causeway from the beach out to Gull Island (mission 3 + 5)
(function buildBridge() {
  const deck = new THREE.Mesh(new THREE.BoxGeometry(18, 0.4, 120), mat(0x9aa4a8));
  deck.position.set(0, 0.2, 235); deck.receiveShadow = true; world.add(deck);
  // railings
  box(0.6, 1.4, 120, 0xff7a5c, -8.6, 1.1, 235);
  box(0.6, 1.4, 120, 0xff7a5c, 8.6, 1.1, 235);
  // support pillars under the deck
  for (let z = 195; z <= 270; z += 25) {
    for (const sx of [-6, 6]) {
      const pil = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 5, 8), mat(0x7a8a90));
      pil.position.set(sx, -2.2, z); world.add(pil);
    }
  }
  // Gull Island: sand platform + dock + boat
  const island = new THREE.Mesh(new THREE.BoxGeometry(90, 0.5, 60), mat(0xe8cf9e));
  island.position.set(0, -0.05, 300); island.receiveShadow = true; world.add(island);
  box(4, 0.5, 24, 0x6a4a3a, -14, 0.4, 300); // dock
  const boat = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.BoxGeometry(5, 2.4, 12), mat(0xffffff));
  hull.position.y = 1.2; boat.add(hull);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2, 5), mat(0x2a9d8f));
  cab.position.set(0, 3.2, -1); boat.add(cab);
  boat.position.set(14, 0.2, 306); boat.rotation.y = 0.5;
  boat.traverse((o) => { o.castShadow = true; });
  world.add(boat);
  // lighthouse on the island
  const lh = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.2, 22, 10), mat(0xf2f0e4));
  lh.position.set(-28, 12, 288); lh.castShadow = true; world.add(lh);
  const lhTop = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 3, 10), mat(0xff5c5c, { emissive: 0xffd34d, emissiveIntensity: 1 }));
  lhTop.position.set(-28, 24, 288); world.add(lhTop);
})();

// ---------- entities ----------
const CAR_COLORS = [0xff7a5c, 0x2a9d8f, 0xffd34d, 0xf2f0e4, 0x5fb3a8, 0xe86a92, 0x4a7ab8, 0xffb3a0, 0x8a6fd8, 0x3a4148];
const CAR_NAMES = ['Coral GT', 'Bay Cruiser', 'Sunset Coupe', 'Palm Sedan', 'Harbor Hatch', 'Tide Runner'];
function makeCar(color, isPolice) {
  const g = new THREE.Group();
  const bodyMat = mat(isPolice ? 0xf2f0e4 : color);
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.6), bodyMat);
  body.position.y = 0.65; body.castShadow = true; g.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2.3), mat(isPolice ? 0x2e3438 : 0x22303a));
  cab.position.set(0, 1.3, -0.3); cab.castShadow = true; g.add(cab);
  if (isPolice) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.3, 4.64), mat(0x1a1a1a));
    stripe.position.y = 0.55; g.add(stripe);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 0.5), mat(0xff2020, { emissive: 0xff2020, emissiveIntensity: 1.6 }));
    bar.position.set(0, 1.85, -0.3); g.add(bar);
    g.userData.lightBar = bar;
  }
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = mat(0x14181c);
  const wheels = [];
  [[-1, 1.5], [1, 1.5], [-1, -1.5], [1, -1.5]].forEach(([sx, sz]) => {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(sx * 1.0, 0.42, sz); g.add(w); wheels.push(w);
  });
  g.userData.wheels = wheels;
  // headlights
  const hl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.25, 0.15), mat(0xffe9a8, { emissive: 0xffd34d, emissiveIntensity: 1 }));
  hl.position.set(0, 0.7, 2.32); g.add(hl);
  scene.add(g);
  return g;
}

// player (Mara "Reef" Calloway — coral jacket)
const player = { x: -140, z: -120, heading: 0, mesh: null, walkPhase: 0 };
(function buildPlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.5), mat(0xff5c5c));
  jacket.position.y = 1.05; jacket.castShadow = true; g.add(jacket);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), mat(0xd9a583));
  head.position.y = 1.85; head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.37, 10, 8), mat(0x2a1a12));
  hair.position.set(0, 1.95, -0.08); hair.scale.set(1, 0.85, 1); g.add(hair);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.45), mat(0x2a3f4a));
  legs.position.y = 0.45; g.add(legs);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.22), mat(0xff5c5c));
  armL.position.set(-0.55, 1.05, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.55; g.add(armR);
  g.userData.armL = armL; g.userData.armR = armR;
  player.mesh = g;
  scene.add(g);
})();

// waypoint beacon (vertical light pillar + floating diamond)
const beacon = new THREE.Group();
(function buildBeacon() {
  const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 90, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
  pillar.position.y = 45; beacon.add(pillar);
  const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(1.6), mat(0xffd34d, { emissive: 0xffd34d, emissiveIntensity: 1 }));
  diamond.position.y = 8; beacon.add(diamond);
  beacon.userData.diamond = diamond;
  scene.add(beacon);
})();
let beaconTarget = { x: 120, z: -120 };

// cars: traffic + parked + police + special
const traffic = [];   // {mesh, axis, dir, speed, road}
const parked = [];    // {mesh, x, z, heading, name, stolen}
const police = [];    // {mesh, speed, heading, state}
let courierCar = null, dannyPed = null;
function spawnTrafficCar(x, z, axis, dir) {
  const mesh = makeCar(pick(rng, CAR_COLORS), false);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
  scene.add(mesh);
  const c = { mesh, axis, dir, speed: 8 + rng() * 7, road: axis === 'x' ? z : x };
  traffic.push(c);
  return c;
}
(function seedTraffic() {
  for (let i = 0; i < 26; i++) {
    const axis = rng() < 0.5 ? 'x' : 'z';
    const road = pick(rng, ROADS);
    const t = -180 + rng() * 340;
    const dir = rng() < 0.5 ? 1 : -1;
    const lane = dir > 0 ? 3 : -3;
    spawnTrafficCar(axis === 'x' ? t : road + lane, axis === 'x' ? road + lane : t, axis, dir);
  }
  // parked cars on side streets
  for (let i = 0; i < 12; i++) {
    const road = pick(rng, ROADS);
    const t = -170 + rng() * 330;
    const mesh = makeCar(pick(rng, CAR_COLORS), false);
    const x = road + 8, z = t;
    mesh.position.set(x, 0, z);
    mesh.rotation.y = (rng() < 0.5 ? 0 : Math.PI) + (rng() - 0.5) * 0.2;
    parked.push({ mesh, x, z, heading: mesh.rotation.y, name: pick(rng, CAR_NAMES), stolen: false });
  }
  // the Vega courier car (mission 2) — gold, parked by the harbor
  courierCar = makeCar(0xffd34d, false);
  courierCar.position.set(120, 0, 140);
  courierCar.rotation.y = Math.PI / 2;
  parked.push({ mesh: courierCar, x: 120, z: 140, heading: Math.PI / 2, name: 'Vega Courier', courier: true, stolen: false });
})();

// pedestrians
const peds = [];
function makePed(x, z, color) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.42), mat(color));
  body.position.y = 1.0; body.castShadow = true; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), mat(0xd9a583));
  head.position.y = 1.75; g.add(head);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.4), mat(0x3a4148));
  legs.position.y = 0.4; g.add(legs);
  g.position.set(x, 0, z);
  scene.add(g);
  return g;
}
const PED_COLORS = [0xffd34d, 0x7fd8c8, 0xe86a92, 0xf2f0e4, 0x9adbe8, 0xff9d8a, 0xc9e8b8];
(function seedPeds() {
  for (let i = 0; i < 34; i++) {
    const road = pick(rng, ROADS);
    const t = -180 + rng() * 340;
    const mesh = makePed(road + 12 + (rng() < 0.5 ? 0 : 2), t, pick(rng, PED_COLORS));
    peds.push({ mesh, x: mesh.position.x, z: mesh.position.z, heading: rng() * TAU, speed: 1.2 + rng() * 1.4, down: false, downT: 0, road });
  }
  // Danny — waiting at Palm Court (mission 4)
  dannyPed = makePed(-120, 120, 0x2a9d8f);
  dannyPed.scale.setScalar(1.05);
  peds.push({ mesh: dannyPed, x: -120, z: 120, heading: 0, speed: 0, down: false, downT: 0, danny: true });
})();

// pistol pickup (glowing case near the garage)
const pistolPickup = new THREE.Group();
(function buildPickup() {
  const c = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.7), mat(0x2e3438));
  c.position.y = 0.4; pistolPickup.add(c);
  const glow = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.2, 0.9), mat(0xffd34d, { emissive: 0xffd34d, emissiveIntensity: 1.4 }));
  glow.position.y = 0.75; pistolPickup.add(glow);
  pistolPickup.position.set(-128, 0, -128);
  scene.add(pistolPickup);
})();

// ---------- police ----------
function spawnPolice() {
  const mesh = makeCar(0, true);
  const a = rng() * TAU;
  mesh.position.set(player.x + Math.cos(a) * 70, 0, player.z + Math.sin(a) * 70);
  police.push({ mesh, speed: 0, heading: 0 });
}
function wantedLabel() {
  return state.wanted === 0 ? 'CLEAN' : state.wanted <= 2 ? 'WANTED' : state.wanted <= 4 ? 'ON THE RUN' : 'MAX HEAT';
}
function addWanted(n, why) {
  const before = state.wanted;
  state.wanted = clamp(state.wanted + n, 0, 5);
  if (state.wanted > before) {
    state.lastCrimeT = elapsed;
    toast(why + ' — wanted level ' + state.wanted + '★');
    AudioSys.sfx('siren');
    while (police.length < state.wanted) spawnPolice();
  }
}

// ---------- player control ----------
let elapsed = 0;
function playerPos() { return state.inCar && state.car ? { x: state.car.mesh.position.x, z: state.car.mesh.position.z } : { x: player.x, z: player.z }; }
function distTo(x, z) { const p = playerPos(); return Math.hypot(p.x - x, p.z - z); }

function updatePlayer(dt) {
  const p = player.mesh;
  if (state.inCar && state.car) {
    const c = state.car;
    const fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 0.55 : 0);
    const steer = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
    const target = fwd > 0 ? 30 : fwd < 0 ? -12 : 0;
    const accel = fwd !== 0 ? 14 : 0;
    c.speed = clamp(c.speed + (target - c.speed) * 0.5 * dt + accel * Math.sign(fwd || 1) * 0 * dt, -12, 32);
    if (fwd > 0) c.speed = Math.min(c.speed + 16 * dt, 32);
    else if (fwd < 0) c.speed = Math.max(c.speed - 18 * dt, -12);
    else c.speed *= Math.pow(0.4, dt);
    if (keys.Space) c.speed *= Math.pow(0.05, dt); // handbrake
    const turn = steer * clamp(Math.abs(c.speed) / 14, 0, 1) * 1.9 * dt * Math.sign(c.speed || 1);
    c.heading -= turn;
    const nx = c.mesh.position.x + Math.sin(c.heading) * c.speed * dt;
    const nz = c.mesh.position.z + Math.cos(c.heading) * c.speed * dt;
    const prev = { x: c.mesh.position.x, z: c.mesh.position.z };
    c.mesh.position.x = clamp(nx, -210, 210);
    c.mesh.position.z = clamp(nz, -210, 330);
    collideCircle(c.mesh.position, 2.2);
    if (Math.hypot(c.mesh.position.x - prev.x, c.mesh.position.z - prev.z) < Math.abs(c.speed) * dt * 0.4 && Math.abs(c.speed) > 6) {
      c.speed *= 0.55; // hit something solid
      if (Math.abs(c.speed) > 8) AudioSys.sfx('crash');
    }
    c.mesh.rotation.y = c.heading;
    c.mesh.rotation.z = -steer * 0.03 * clamp(Math.abs(c.speed) / 20, 0, 1);
    c.mesh.userData.wheels.forEach((w, i) => { w.rotation.x += c.speed * dt * 2; });
    state.speed = Math.abs(c.speed) * 2.2;
    // run over pedestrians
    for (const pd of peds) {
      if (pd.down || pd.danny) continue;
      const d = Math.hypot(pd.x - c.mesh.position.x, pd.z - c.mesh.position.z);
      if (d < 2.4 && Math.abs(c.speed) > 4) {
        pd.down = true; pd.downT = 0;
        pd.mesh.rotation.x = -Math.PI / 2; pd.mesh.position.y = 0.4;
        state.pedsHit++;
        addWanted(1, 'Pedestrian hit');
        AudioSys.sfx('crash');
      }
    }
    // ram traffic cars (shove them)
    for (const t of traffic) {
      const d = Math.hypot(t.mesh.position.x - c.mesh.position.x, t.mesh.position.z - c.mesh.position.z);
      if (d < 4.5) {
        const push = 6;
        t.mesh.position.x += Math.sin(c.heading) * push * dt * 4;
        t.mesh.position.z += Math.cos(c.heading) * push * dt * 4;
        if (Math.abs(c.speed) > 12) { c.speed *= 0.7; AudioSys.sfx('crash'); }
      }
    }
    AudioSys.setEngine(clamp(Math.abs(c.speed) / 32, 0, 1));
  } else {
    const mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    const mz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
    const run = keys.ShiftLeft || keys.ShiftRight;
    const spd = run ? 9 : 5.2;
    if (mx || mz) {
      const len = Math.hypot(mx, mz);
      const camH = camHeading;
      // move relative to camera
      const fx = Math.sin(camH), fz = Math.cos(camH);
      const rx = Math.cos(camH), rz = -Math.sin(camH);
      const dx = (fx * -mz + rx * mx) / len;
      const dz = (fz * -mz + rz * mx) / len;
      player.x += dx * spd * dt;
      player.z += dz * spd * dt;
      player.x = clamp(player.x, -210, 210);
      player.z = clamp(player.z, -210, 330);
      player.heading = Math.atan2(dx, dz);
      player.walkPhase += dt * spd * 1.6;
    }
    collideCircle(player, 0.8);
    p.position.set(player.x, 0, player.z);
    p.rotation.y = player.heading;
    p.userData.armL.rotation.x = Math.sin(player.walkPhase) * 0.5 * (mx || mz ? 1 : 0);
    p.userData.armR.rotation.x = -Math.sin(player.walkPhase) * 0.5 * (mx || mz ? 1 : 0);
    state.speed = 0;
    AudioSys.setEngine(0);
  }
}

function nearestStealable() {
  let best = null, bestD = 5;
  for (const pk of parked) {
    if (pk.stolen) continue;
    const d = Math.hypot(pk.x - player.x, pk.z - player.z);
    if (d < bestD) { bestD = d; best = pk; }
  }
  if (!best) {
    for (const t of traffic) {
      const d = Math.hypot(t.mesh.position.x - player.x, t.mesh.position.z - player.z);
      if (d < bestD) { bestD = d; best = { mesh: t.mesh, traffic: t, x: t.mesh.position.x, z: t.mesh.position.z, heading: t.mesh.rotation.y, name: 'Traffic car', stolen: false }; }
    }
  }
  return best;
}
function enterCar(pk) {
  if (pk.traffic) {
    const idx = traffic.indexOf(pk.traffic);
    if (idx >= 0) traffic.splice(idx, 1);
    const pd = { mesh: makePed(pk.x, pk.z, pick(rng, PED_COLORS)), x: pk.x, z: pk.z, heading: 0, speed: 1.5, down: false, downT: 0, road: 0 };
    peds.push(pd); // driver gets out, annoyed
  }
  pk.stolen = true;
  state.inCar = true;
  state.car = { mesh: pk.mesh, heading: pk.heading, speed: 0, name: pk.name, courier: !!pk.courier, parkedRef: pk };
  player.mesh.visible = false;
  if (!pk.courier && !pk.traffic) { /* parked car taken */ }
  if (pk.courier) { state.carsStolen++; }
  else { state.carsStolen++; addWanted(1, 'Car stolen'); }
  AudioSys.sfx('pickup');
  toast('You took the ' + pk.name + ' — drive!');
}
function exitCar() {
  if (!state.car) return;
  const c = state.car;
  player.x = c.mesh.position.x - Math.sin(c.heading) * 3.5;
  player.z = c.mesh.position.z - Math.cos(c.heading) * 3.5;
  player.heading = c.heading;
  player.mesh.visible = true;
  player.mesh.position.set(player.x, 0, player.z);
  state.inCar = false;
  state.car = null;
  state.speed = 0;
}
function onInteract() {
  if (!state.started || state.paused || state.over) return;
  if (state.inCar) { exitCar(); return; }
  const pk = nearestStealable();
  if (pk) { enterCar(pk); return; }
  // mission interact (vault / Danny pickup handled by mission engine via proximity)
  checkMissionInteract();
}
function onPunch() {
  if (!state.started || state.paused || state.over || state.inCar) return;
  AudioSys.sfx('punch');
  let hit = false;
  for (const pd of peds) {
    if (pd.down || pd.danny) continue;
    const d = Math.hypot(pd.x - player.x, pd.z - player.z);
    if (d < 2.6) {
      pd.down = true; pd.downT = 0;
      pd.mesh.rotation.x = -Math.PI / 2; pd.mesh.position.y = 0.4;
      hit = true;
    }
  }
  if (hit) addWanted(1, 'Assault');
}
function onShoot() {
  if (!state.started || state.paused || state.over || !state.hasPistol || state.ammo <= 0) return;
  state.ammo--;
  AudioSys.sfx('shot');
  // hitscan toward camera center: nearest ped/police within a cone ahead
  const p = playerPos();
  const dirX = Math.sin(camHeading), dirZ = Math.cos(camHeading);
  let best = null, bestD = 60;
  const targets = [];
  for (const pd of peds) if (!pd.down) targets.push({ x: pd.x, z: pd.z, ref: pd, kind: 'ped' });
  for (const po of police) targets.push({ x: po.mesh.position.x, z: po.mesh.position.z, ref: po, kind: 'police' });
  for (const t of targets) {
    const dx = t.x - p.x, dz = t.z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > 60 || d < 1) continue;
    const dot = (dx * dirX + dz * dirZ) / d;
    if (dot > 0.92 && d < bestD) { bestD = d; best = t; }
  }
  if (best) {
    if (best.kind === 'ped') {
      const pd = best.ref;
      pd.down = true; pd.downT = 0;
      pd.mesh.rotation.x = -Math.PI / 2; pd.mesh.position.y = 0.4;
    } else {
      const po = best.ref;
      po.mesh.position.x += (Math.random() - 0.5) * 4;
      po.mesh.position.z += (Math.random() - 0.5) * 4;
    }
    addWanted(1, 'Shots fired');
  }
}

// ---------- traffic / ped / police updates ----------
function updateTraffic(dt) {
  for (const t of traffic) {
    // slow down for the player's car ahead
    let slow = false;
    const px = state.inCar && state.car ? state.car.mesh.position.x : player.x;
    const pz = state.inCar && state.car ? state.car.mesh.position.z : player.z;
    const dx = px - t.mesh.position.x, dz = pz - t.mesh.position.z;
    const ahead = t.axis === 'x' ? dx * t.dir : dz * t.dir;
    const side = t.axis === 'x' ? Math.abs(dz) : Math.abs(dx);
    if (ahead > 0 && ahead < 12 && side < 4) slow = true;
    const v = slow ? t.speed * 0.25 : t.speed;
    if (t.axis === 'x') t.mesh.position.x += t.dir * v * dt;
    else t.mesh.position.z += t.dir * v * dt;
    // at an intersection, sometimes turn
    const along = t.axis === 'x' ? t.mesh.position.x : t.mesh.position.z;
    const nearGrid = ROADS.some((r) => Math.abs(along - r) < v * dt + 0.6);
    if (nearGrid && rng() < 0.004) {
      const newAxis = t.axis === 'x' ? 'z' : 'x';
      const newDir = rng() < 0.5 ? 1 : -1;
      const lane = newDir > 0 ? 3 : -3;
      if (newAxis === 'x') { t.mesh.position.z = Math.round(t.mesh.position.z / 40) * 40 + lane; }
      else { t.mesh.position.x = Math.round(t.mesh.position.x / 40) * 40 + lane; }
      t.axis = newAxis; t.dir = newDir;
      t.mesh.rotation.y = newAxis === 'x' ? (newDir > 0 ? Math.PI / 2 : -Math.PI / 2) : (newDir > 0 ? 0 : Math.PI);
    }
    // wrap around the map edges
    if (t.mesh.position.x > 205) t.mesh.position.x = -205;
    if (t.mesh.position.x < -205) t.mesh.position.x = 205;
    if (t.mesh.position.z > 335) t.mesh.position.z = -205;
    if (t.mesh.position.z < -205) t.mesh.position.z = 335;
    t.mesh.userData.wheels.forEach((w) => { w.rotation.x += v * dt * 2; });
  }
}
function updatePeds(dt) {
  for (const pd of peds) {
    if (pd.down) { pd.downT += dt; if (pd.downT > 14) { pd.down = false; pd.mesh.rotation.x = 0; pd.mesh.position.y = 0; } continue; }
    if (pd.danny && !state.dannyInCar) continue; // Danny waits
    if (pd.speed === 0) continue;
    if (rng() < 0.002) pd.heading += (rng() - 0.5) * 2.4;
    pd.x += Math.sin(pd.heading) * pd.speed * dt;
    pd.z += Math.cos(pd.heading) * pd.speed * dt;
    pd.x = clamp(pd.x, -195, 195); pd.z = clamp(pd.z, -195, 320);
    pd.mesh.position.set(pd.x, 0, pd.z);
    pd.mesh.rotation.y = pd.heading;
  }
}
function updatePolice(dt) {
  // keep the fleet at the wanted level
  while (police.length < state.wanted) spawnPolice();
  while (police.length > state.wanted) {
    const po = police.pop();
    scene.remove(po.mesh);
  }
  const p = playerPos();
  for (const po of police) {
    const dx = p.x - po.mesh.position.x, dz = p.z - po.mesh.position.z;
    const d = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    po.heading += clamp(angDiff(po.heading, want), -2.2 * dt, 2.2 * dt);
    const targetSpeed = d > 60 ? 34 : d > 10 ? 26 : 14;
    po.speed = lerp(po.speed, targetSpeed, dt * 0.8);
    po.mesh.position.x += Math.sin(po.heading) * po.speed * dt;
    po.mesh.position.z += Math.cos(po.heading) * po.speed * dt;
    collideCircle(po.mesh.position, 2.2);
    po.mesh.rotation.y = po.heading;
    po.mesh.userData.wheels.forEach((w) => { w.rotation.x += po.speed * dt * 2; });
    if (po.mesh.userData.lightBar) {
      const m = po.mesh.userData.lightBar.material;
      m.color.setHex(Math.floor(elapsed * 4) % 2 === 0 ? 0xff2020 : 0x2040ff);
      m.emissive.setHex(m.color.getHex());
    }
    // ramming: damage + shove
    if (d < 4.2) {
      if (state.inCar && state.car) {
        state.car.speed *= 0.6;
        state.car.mesh.position.x += Math.sin(po.heading) * 3 * dt * 8;
        state.car.mesh.position.z += Math.cos(po.heading) * 3 * dt * 8;
      } else {
        state.health = Math.max(0, state.health - 22 * dt);
        player.x += Math.sin(po.heading) * 6 * dt;
        player.z += Math.cos(po.heading) * 6 * dt;
      }
      if (rng() < 0.02) AudioSys.sfx('crash');
    }
  }
  // wanted decays when quiet and no police close
  if (state.wanted > 0 && elapsed - state.lastCrimeT > 25) {
    let nearest = 999;
    for (const po of police) nearest = Math.min(nearest, Math.hypot(po.mesh.position.x - p.x, po.mesh.position.z - p.z));
    if (nearest > 55) {
      state.wanted = Math.max(0, state.wanted - dt * 0.12);
      if (state.wanted < 1) { state.wanted = 0; toast('You lost the heat — for now.'); }
    }
  }
}

// ---------- camera ----------
let camHeading = 0; // behind the player: camera sits opposite the facing direction
let camDist = 11, camHeight = 6.5;
function updateCamera(dt) {
  const p = playerPos();
  let targetHeading = camHeading;
  if (state.inCar && state.car) targetHeading = state.car.heading;
  else if (keys.KeyQ) targetHeading = player.heading;
  // gentle auto-follow: swing behind the car, free-ish on foot
  camHeading += angDiff(camHeading, targetHeading) * (state.inCar ? 2.2 : 0.6) * dt;
  const dist = state.inCar ? 16 : 8.5;
  const h = state.inCar ? 7 : 4.8;
  const cx = p.x - Math.sin(camHeading) * dist;
  const cz = p.z - Math.cos(camHeading) * dist;
  camera.position.x = lerp(camera.position.x, cx, 1 - Math.pow(0.001, dt));
  camera.position.y = lerp(camera.position.y, h + (state.inCar ? Math.abs(state.speed) * 0.03 : 0), 1 - Math.pow(0.001, dt));
  camera.position.z = lerp(camera.position.z, cz, 1 - Math.pow(0.001, dt));
  camera.lookAt(p.x, 2.2, p.z);
}

// ---------- missions ----------
const MISSIONS = [
  {
    name: '1. THE CALL',
    intro: 'Vega’s fixer wants to meet. Drive to Coral Court — and shake the tail.',
    steps: [
      { type: 'goto', x: 120, z: -120, text: 'Drive to the meet at Coral Court', needCar: true, label: 'CORAL COURT' },
      { type: 'survive', seconds: 18, text: 'Lose the tail — stay clear of the police for 18 seconds', wanted: 1, label: 'LOSE THE TAIL' },
    ],
    reward: 1500,
  },
  {
    name: '2. HARBOR LIGHTS',
    intro: 'A Vega courier car is parked by the harbor. Take it — quietly, or not.',
    steps: [
      { type: 'steal', text: 'Steal the gold Vega courier car by the harbor', label: 'VEGA COURIER' },
      { type: 'goto', x: -160, z: -160, text: 'Deliver the courier car to Reef’s Garage', needCar: true, label: 'REEF’S GARAGE' },
    ],
    reward: 4000,
  },
  {
    name: '3. TOLL OF THE BAY',
    intro: 'The bridge is the only way across. Vega’s boys tipped off the cops — 2 stars, no stopping.',
    steps: [
      { type: 'goto', x: 0, z: 235, text: 'Cross the harbor bridge to Gull Island', needCar: true, wanted: 2, label: 'HARBOR BRIDGE' },
      { type: 'goto', x: -120, z: 120, text: 'Get back across — lose them on Palm Court', needCar: true, label: 'PALM COURT' },
    ],
    reward: 6000,
  },
  {
    name: '4. REEF’S RUN',
    intro: 'Danny is hiding at Palm Court and the cops are circling. Pick him up. Three stars.',
    steps: [
      { type: 'pickup', x: -120, z: 120, text: 'Pick up Danny at Palm Court (walk up to him)', label: 'DANNY' },
      { type: 'goto', x: -140, z: -140, text: 'Get Danny to Reef’s Garage — 3 stars on your tail', needCar: true, wanted: 3, label: 'REEF’S GARAGE' },
    ],
    reward: 9000,
  },
  {
    name: '5. ONE LAST DRIVE',
    intro: 'Solara Trust, 19:00. Take what Vega owes Danny, then run for the boat. Your choice at the end.',
    steps: [
      { type: 'goto', x: 40, z: -8, text: 'Reach Solara Trust bank downtown', needCar: false, label: 'SOLARA TRUST' },
      { type: 'interact', x: 40, z: -8, text: 'Walk to the bank doors and press E — grab the bag', label: 'THE VAULT' },
      { type: 'goto', x: 14, z: 306, text: 'Escape to the boat on Gull Island — 4 stars, everything on the line', needCar: true, wanted: 4, label: 'THE BOAT' },
      { type: 'choice', text: 'The money is in the bag. Danny is free — if you pay.', label: 'THE CHOICE' },
    ],
    reward: 40000,
  },
];
function currentMission() { return MISSIONS[state.missionIndex] || null; }
function currentStep() { const m = currentMission(); return m ? m.steps[state.stepIndex] : null; }
function stepTarget() {
  const s = currentStep();
  if (!s) return null;
  if (s.type === 'steal') return { x: 120, z: 140 };
  if (s.type === 'pickup') return { x: s.x, z: s.z };
  if (s.type === 'goto' || s.type === 'interact') return { x: s.x, z: s.z };
  return null;
}
function setStepWanted() {
  const s = currentStep();
  if (s && s.wanted && state.wanted < s.wanted) {
    state.wanted = s.wanted;
    state.lastCrimeT = elapsed;
    while (police.length < state.wanted) spawnPolice();
    AudioSys.sfx('siren');
  }
}
function advanceStep() {
  const m = currentMission();
  state.stepIndex++;
  state.stepTimer = 0;
  if (state.stepIndex >= m.steps.length) {
    completeMission();
  } else {
    setStepWanted();
    toast(m.steps[state.stepIndex].text);
  }
}
function completeMission() {
  const m = currentMission();
  state.cash += m.reward;
  AudioSys.sfx('complete');
  AudioSys.sfx('cash');
  showBanner('MISSION COMPLETE', m.name + ' — +$' + m.reward.toLocaleString());
  state.missionIndex++;
  state.stepIndex = 0;
  state.stepTimer = 0;
  saveGame();
  if (state.missionIndex >= MISSIONS.length) {
    // final mission's choice step handles the ending; this is for earlier missions
    showBanner('SOLARA BAY', 'All jobs done. The bay remembers.');
  } else {
    const next = MISSIONS[state.missionIndex];
    setTimeout(() => toast(next.name + ': ' + next.intro), 2600);
  }
}
function updateMissions(dt) {
  const m = currentMission();
  if (!m) return;
  const s = currentStep();
  if (!s) return;
  state.stepTimer += dt;
  if (s.type === 'goto') {
    const t = stepTarget();
    if (distTo(t.x, t.z) < 12) advanceStep();
  } else if (s.type === 'steal') {
    if (state.car && state.car.courier) advanceStep();
  } else if (s.type === 'survive') {
    let nearest = 999;
    for (const po of police) nearest = Math.min(nearest, Math.hypot(po.mesh.position.x - player.x, po.mesh.position.z - player.z));
    const p = playerPos();
    let near = 999;
    for (const po of police) near = Math.min(near, Math.hypot(po.mesh.position.x - p.x, po.mesh.position.z - p.z));
    if (near > 45) {
      if (state.stepTimer >= s.seconds) advanceStep();
    } else {
      state.stepTimer = Math.max(0, state.stepTimer - dt * 0.5); // heat stalls the timer
    }
  } else if (s.type === 'pickup') {
    const d = Math.hypot(player.x - s.x, player.z - s.z);
    if (d < 4 && !state.inCar) {
      state.dannyInCar = true;
      dannyPed.visible = false;
      toast('Danny’s in the car. GO!');
      AudioSys.sfx('pickup');
      advanceStep();
    }
  } else if (s.type === 'interact') {
    // waits for checkMissionInteract (E key)
  } else if (s.type === 'choice') {
    if (!state.ending) {
      state.over = true;
      document.getElementById('ending').style.display = 'flex';
    }
  }
  // beacon follows the current objective
  const t = stepTarget();
  if (t) {
    beaconTarget = t;
    beacon.visible = true;
    beacon.position.set(t.x, 0, t.z);
    beacon.userData.diamond.rotation.y += dt * 2;
    beacon.userData.diamond.position.y = 8 + Math.sin(elapsed * 2.5) * 0.8;
  } else if (s.type === 'survive') {
    beacon.visible = false;
  }
}
function checkMissionInteract() {
  const s = currentStep();
  if (!s) return;
  if (s.type === 'interact') {
    const d = Math.hypot(player.x - s.x, player.z - s.z);
    if (d < 14) {
      state.cash += 0; // reward lands at mission end
      toast('Bag grabbed — $40,000 of Vega money. RUN!');
      AudioSys.sfx('cash');
      advanceStep();
    } else {
      toast('Get to the bank doors first.');
    }
  }
  if (s.type === 'pickup') toast('Walk up to Danny — on foot.');
}

// ---------- HUD / minimap ----------
const $ = (id) => document.getElementById(id);
let toastTimer = null;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.textContent = ''; }, 3400);
}
let bannerTimer = null;
function showBanner(title, text) {
  $('bannertitle').textContent = title;
  $('bannertext').textContent = text;
  $('banner').style.display = 'block';
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => { $('banner').style.display = 'none'; }, 3600);
}
const mapCtx = $('map').getContext('2d');
function drawMinimap() {
  const S = 184, scale = S / 560; // world -260..300 -> map
  const toMap = (x, z) => [92 + (x + 30) * scale, 92 + (z + 20) * scale];
  mapCtx.clearRect(0, 0, S, S);
  // bay water
  mapCtx.fillStyle = '#1e7d8c';
  mapCtx.fillRect(0, 0, S, S);
  // land
  mapCtx.fillStyle = '#5a6a5e';
  const [lx, ly] = toMap(-210, -210);
  mapCtx.fillRect(lx, ly, 420 * scale, 400 * scale);
  // beach
  mapCtx.fillStyle = '#e8cf9e';
  mapCtx.fillRect(lx, toMap(0, 168)[1], 420 * scale, 22 * scale);
  // bridge + island
  mapCtx.fillStyle = '#9aa4a8';
  mapCtx.fillRect(toMap(-9, 180)[0], toMap(0, 180)[1], 18 * scale, 115 * scale);
  mapCtx.fillStyle = '#e8cf9e';
  mapCtx.fillRect(toMap(-45, 270)[0], toMap(0, 270)[1], 90 * scale, 60 * scale);
  // buildings
  mapCtx.fillStyle = '#3a4148';
  for (const b of buildingRects) {
    const [bx, bz] = toMap(b.x - b.w / 2, b.z - b.d / 2);
    mapCtx.fillRect(bx, bz, Math.max(2, b.w * scale), Math.max(2, b.d * scale));
  }
  // roads
  mapCtx.strokeStyle = 'rgba(245,233,200,0.55)';
  mapCtx.lineWidth = 1;
  for (const r of ROADS) {
    const [x1, y1] = toMap(r, -200); const [x2, y2] = toMap(r, 180);
    mapCtx.beginPath(); mapCtx.moveTo(x1, y1); mapCtx.lineTo(x2, y2); mapCtx.stroke();
    const [ax1, ay1] = toMap(-200, r); const [ax2, ay2] = toMap(200, r);
    mapCtx.beginPath(); mapCtx.moveTo(ax1, ay1); mapCtx.lineTo(ax2, ay2); mapCtx.stroke();
  }
  // traffic (white) + police (red)
  mapCtx.fillStyle = '#ffffff';
  for (const t of traffic) { const [x, y] = toMap(t.mesh.position.x, t.mesh.position.z); mapCtx.fillRect(x - 1, y - 1, 2, 2); }
  mapCtx.fillStyle = '#ff4040';
  for (const po of police) { const [x, y] = toMap(po.mesh.position.x, po.mesh.position.z); mapCtx.beginPath(); mapCtx.arc(x, y, 2.5, 0, TAU); mapCtx.fill(); }
  // Danny (gold) when waiting
  if (!state.dannyInCar && state.missionIndex >= 3) {
    const [x, y] = toMap(-120, 120);
    mapCtx.fillStyle = '#ffd34d'; mapCtx.beginPath(); mapCtx.arc(x, y, 3, 0, TAU); mapCtx.fill();
  }
  // waypoint (pulsing gold diamond)
  const t = stepTarget();
  if (t && currentMission()) {
    const [x, y] = toMap(t.x, t.z);
    const r = 4 + Math.sin(elapsed * 4) * 1.5;
    mapCtx.fillStyle = '#ffd34d';
    mapCtx.beginPath(); mapCtx.moveTo(x, y - r); mapCtx.lineTo(x + r, y); mapCtx.lineTo(x, y + r); mapCtx.lineTo(x - r, y); mapCtx.closePath(); mapCtx.fill();
  }
  // player arrow (north-up map: heading -> angle)
  const p = playerPos();
  const [px, py] = toMap(p.x, p.z);
  const h = state.inCar && state.car ? state.car.heading : player.heading;
  mapCtx.fillStyle = '#ff5c5c';
  mapCtx.save();
  mapCtx.translate(px, py);
  mapCtx.rotate(Math.PI - h);
  mapCtx.beginPath(); mapCtx.moveTo(0, -6); mapCtx.lineTo(4.5, 5); mapCtx.lineTo(-4.5, 5); mapCtx.closePath(); mapCtx.fill();
  mapCtx.restore();
  // compass ring
  mapCtx.strokeStyle = 'rgba(255,255,255,0.7)';
  mapCtx.beginPath(); mapCtx.arc(92, 92, 90, 0, TAU); mapCtx.stroke();
}
function updateHUD() {
  $('healthbar').style.width = clamp(state.health, 0, 100) + '%';
  $('cash').textContent = state.cash.toLocaleString();
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < Math.floor(state.wanted) ? '★' : '<span class="off">★</span>';
  $('stars').innerHTML = stars;
  $('wantedlabel').textContent = wantedLabel();
  const m = currentMission();
  if (m) {
    $('mtitle').textContent = m.name + '  ·  $' + m.reward.toLocaleString();
    const s = currentStep();
    $('mobj').textContent = s ? s.text : 'All jobs done.';
  } else {
    $('mtitle').textContent = 'SOLARA BAY — FREE ROAM';
    $('mobj').textContent = 'All five jobs complete. The bay is yours — drive, steal, survive.';
  }
  $('speed').textContent = Math.round(state.speed);
  $('vehname').textContent = state.inCar && state.car ? state.car.name.toUpperCase() + (state.car.courier ? ' ★ COURIER' : '') : 'ON FOOT' + (state.hasPistol ? ' · PISTOL ' + state.ammo : '');
  const hh = Math.floor(state.time), mm = Math.floor((state.time - hh) * 60);
  $('clocktime').textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  // context prompt
  const pr = $('prompt');
  if (!state.started) { pr.style.display = 'none'; return; }
  let msg = '';
  if (!state.inCar) {
    const pk = nearestStealable();
    if (pk) msg = 'Press E — steal the ' + pk.name;
    else if (currentStep() && currentStep().type === 'interact' && distTo(40, -8) < 14) msg = 'Press E — grab the bag';
    else if (currentStep() && currentStep().type === 'pickup' && Math.hypot(player.x + 120, player.z - 120) < 6) msg = 'Danny is here — walk to him';
    else if (!state.hasPistol && Math.hypot(player.x + 128, player.z + 128) < 3) msg = 'Pistol case here — walk over it to pick it up';
  } else {
    msg = 'E exit car · SPACE handbrake';
  }
  pr.style.display = msg ? 'block' : 'none';
  pr.textContent = msg;
}

// ---------- start / pause / ending ----------
function startGame() {
  if (state.started) return;
  state.started = true;
  $('start').style.display = 'none';
  AudioSys.init();
  const saved = loadGame();
  if (saved && saved.missionIndex > 0 && SHOT === '') {
    state.cash = saved.cash || 0;
    state.missionIndex = saved.missionIndex || 0;
    state.health = saved.health || 100;
    state.hasPistol = !!saved.hasPistol;
    state.ammo = saved.ammo || 0;
    toast('Save loaded — ' + (MISSIONS[state.missionIndex] ? MISSIONS[state.missionIndex].name : 'free roam'));
  }
  const m = currentMission();
  if (m) { toast(m.name + ': ' + m.intro); setStepWanted(); }
  // starter car: Mara's Coral GT parked by the garage
  const starter = parked.find((pk) => !pk.stolen);
  if (starter && !state.inCar) {
    starter.x = -136; starter.z = -122; starter.mesh.position.set(-136, 0, -122);
  }
}
function togglePause() {
  if (!state.started || state.over) return;
  state.paused = !state.paused;
  $('pause').style.display = state.paused ? 'flex' : 'none';
}
$('startBtn').addEventListener('click', startGame);
$('resumeBtn').addEventListener('click', togglePause);
$('payBtn').addEventListener('click', () => {
  state.cash = Math.max(0, state.cash); // the $40,000 goes to Vega — Danny walks free
  state.ending = 'pay';
  document.getElementById('ending').style.display = 'none';
  state.over = false;
  showBanner('DANNY WALKS FREE', 'You paid Vega. The bay lets go — this time.');
  toast('Ending: PAY VEGA — Danny is free. Free roam unlocked.');
  state.missionIndex = MISSIONS.length;
  state.wanted = 0;
  saveGame();
});
$('keepBtn').addEventListener('click', () => {
  state.cash += 40000;
  state.ending = 'keep';
  document.getElementById('ending').style.display = 'none';
  state.over = false;
  showBanner('BURN THE BRIDGE', 'You kept the money. Vega will come for it — and for Danny.');
  toast('Ending: KEEP THE MONEY — +$40,000. Wanted level 5.');
  state.missionIndex = MISSIONS.length;
  state.wanted = 5;
  while (police.length < 5) spawnPolice();
  saveGame();
});

// ---------- deterministic screenshot hooks ----------
function applyShot() {
  if (!SHOT) return;
  state.started = true;
  $('start').style.display = 'none';
  AudioSys.init = () => {}; // no audio in headless shots
  if (SHOT === 'start') {
    // cinematic skyline view, title overlay on
    $('start').style.display = 'flex';
    camera.position.set(60, 62, 258);
    camera.lookAt(0, 20, -60);
    state.missionIndex = 0; state.stepIndex = 0;
    return;
  }
  if (SHOT === 'play') {
    // on-foot street scene: Mara on a palm boulevard, peds + traffic around
    player.x = 6; player.z = 40; player.heading = Math.PI;
    player.mesh.position.set(6, 0, 40);
    state.missionIndex = 0; state.stepIndex = 0;
    state.hasPistol = true; state.ammo = 12;
    // crowd the shot: extra peds near the player
    for (let i = 0; i < 8; i++) {
      const pd = { mesh: makePed(2 + i * 3, 28 + (i % 3) * 6, pick(rng, PED_COLORS)), x: 2 + i * 3, z: 28 + (i % 3) * 6, heading: rng() * TAU, speed: 1.5, down: false, downT: 0, road: 40 };
      peds.push(pd);
    }
    camHeading = Math.PI;
    return;
  }
  if (SHOT === 'chase') {
    // driving chase: Mara in the Coral GT on the bridge approach, 3 stars, police behind
    const pk = parked.find((p) => !p.stolen);
    if (pk) enterCarSilent(pk);
    state.car.mesh.position.set(0, 0, 100);
    state.car.heading = 0; // heading south toward the bridge
    state.car.speed = 24;
    state.wanted = 3;
    while (police.length < 3) spawnPolice();
    police.forEach((po, i) => {
      po.mesh.position.set([-6, 6, 0][i], 0, 88 - i * 4);
      po.heading = 0;
      po.speed = 26;
    });
    state.missionIndex = 2; state.stepIndex = 0; // Toll of the Bay
    camHeading = 0;
    return;
  }
  if (SHOT === 'end') {
    // heist moment: mission 5 complete, Mara on foot by the boat with the bag
    state.missionIndex = 5;
    state.cash = 40000;
    player.x = 8; player.z = 296; player.heading = Math.PI * 0.15;
    player.mesh.position.set(8, 0, 296);
    showBanner('MISSION COMPLETE', '5. ONE LAST DRIVE — +$40,000');
    $('banner').style.display = 'block';
    camHeading = Math.PI * 0.15;
    return;
  }
}
function enterCarSilent(pk) {
  pk.stolen = true;
  state.inCar = true;
  state.car = { mesh: pk.mesh, heading: pk.heading, speed: 0, name: pk.name, courier: !!pk.courier, parkedRef: pk };
  player.mesh.visible = false;
}

// ---------- main loop ----------
const clock = new THREE.Clock();
let saveTimer = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (state.started && !state.paused && !state.over) {
    elapsed += dt;
    state.time = 18.7 + elapsed / 2400; // slow drift through golden hour
    updatePlayer(dt);
    updateTraffic(dt);
    updatePeds(dt);
    updatePolice(dt);
    updateMissions(dt);
    // pistol pickup
    if (!state.hasPistol && Math.hypot(player.x + 128, player.z + 128) < 2.5 && !state.inCar) {
      state.hasPistol = true; state.ammo = 24;
      pistolPickup.visible = false;
      toast('Pistol picked up — 24 rounds. Click to shoot.');
      AudioSys.sfx('pickup');
    }
    // pistol glow pulse
    if (pistolPickup.visible) pistolPickup.rotation.y += dt * 2;
    // palm sway
    for (let i = 0; i < palmTops.length; i++) palmTops[i].rotation.z = Math.sin(elapsed * 0.8 + i) * 0.08;
    // health regen when clean and calm
    if (state.wanted === 0 && state.health < 100) state.health = Math.min(100, state.health + dt * 2);
    if (state.health <= 0) {
      state.health = 0;
      showBanner('BUSTED / DOWN', 'Mara wakes up at the hospital — $500 lighter.');
      state.cash = Math.max(0, state.cash - 500);
      state.health = 100; state.wanted = 0;
      player.x = -140; player.z = -120;
      if (state.inCar) exitCar();
      player.mesh.position.set(player.x, 0, player.z);
      saveGame();
    }
    saveTimer += dt;
    if (saveTimer > 10) { saveTimer = 0; saveGame(); }
  }
  if (SHOT === 'start') {
    // slow cinematic orbit for the title shot
    const t = elapsed * 0.05 + 0.6;
    camera.position.set(Math.sin(t) * 70, 62 + Math.sin(t * 0.7) * 5, 250 + Math.cos(t) * 22);
    camera.lookAt(0, 20, -60);
  } else if (state.started && !state.paused) {
    updateCamera(dt);
  }
  if (SHOT === 'end') { $('banner').style.display = 'block'; $('bannertitle').textContent = 'MISSION COMPLETE'; $('bannertext').textContent = '5. ONE LAST DRIVE — +$40,000'; }
  drawMinimap();
  updateHUD();
  renderer.render(scene, camera);
}

// debug handle (read-only state for testing / verification)
window.SOLARA = { state, player, get car() { return state.car; }, get pos() { return playerPos(); } };

// ---------- init ----------
applyShot();
if (SHOT === 'chase' || SHOT === 'play' || SHOT === 'end') {
  // keep the shot's staged pose: hold the camera close for the first frames
  updateCamera(0.5);
}
frame();
