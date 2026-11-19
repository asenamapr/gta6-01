// SOLARA BAY: One Last Drive — a 3D open-world crime game.
// Rewritten in this revision pass around config.js / world.js / render.js
// / shots.js. three.js r152 (global THREE) renders the city; plain ES
// modules, no network requests, keyboard + mouse.
'use strict';

import {
  ROADS, TAU, SAVE_KEY, MISSIONS, CAR_COLORS, PED_COLORS,
  clamp, lerp, angDiff, mulberry32, pick,
} from './config.js';
import { setupRenderer, setupScene, makeCameraRig, drawMinimap } from './render.js';
import { buildWorld } from './world.js';
import { getShotSetup, applyShotSetup } from './shots.js';

// ---------- URL / shot params ----------
const params = new URLSearchParams(location.search);
const SHOT = params.get('shot') || '';
const SEED = parseInt(params.get('seed') || '1', 10) || 1;
const rng = mulberry32(SEED * 7919 + 13);

// ---------- game state ----------
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
let elapsed = 0;
let camHeading = 0;

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
    return raw ? JSON.parse(raw) : null;
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
  startRadio() {
    const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 196, 246.9]];
    const stations = ['RADIO SOLARA 94.1 \u2014 \u201cGolden Hour Drive\u201d', 'RADIO SOLARA 94.1 \u2014 \u201cPalms at Dusk\u201d', 'RADIO SOLARA 94.1 \u2014 \u201cTide Out Slow\u201d'];
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
        if (el) el.textContent = '\u266a ' + stations[this.radioStep % stations.length];
      }
      this.radioStep++;
      setTimeout(step, 2700);
    };
    step();
  },
};

// ---------- renderer / scene / world ----------
const canvas = document.getElementById('c');
const renderer = setupRenderer(canvas);
const { scene, camera } = setupScene();
const camRig = makeCameraRig(camera);
const world = buildWorld(scene, rng);
const { traffic, parked, peds, police } = world;
addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- player (Mara "Reef" Calloway — coral jacket) ----------
const player = { x: -140, z: -120, heading: 0, mesh: null, walkPhase: 0 };
(function buildPlayerMesh() {
  const g = new THREE.Group();
  const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
  const jacket = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.05, 0.5), lam(0xff5c5c));
  jacket.position.y = 1.05; jacket.castShadow = true; g.add(jacket);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 10, 8), lam(0xd9a583));
  head.position.y = 1.85; head.castShadow = true; g.add(head);
  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.37, 10, 8), lam(0x2a1a12));
  hair.position.set(0, 1.95, -0.08); hair.scale.set(1, 0.85, 1); g.add(hair);
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.85, 0.45), lam(0x2a3f4a));
  legs.position.y = 0.45; g.add(legs);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.9, 0.22), lam(0xff5c5c));
  armL.position.set(-0.55, 1.05, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.55; g.add(armR);
  g.userData.armL = armL; g.userData.armR = armR;
  player.mesh = g;
  scene.add(g);
})();

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

// ---------- touch controls (mobile) ----------
// Only shown on touch devices, or with ?touch=1. Desktop is untouched:
// no touch element exists in the layout unless body.touch is set, and
// the joystick only feeds the same fwd/steer values the keyboard feeds.
const touchInput = { x: 0, y: 0, active: false };
function setupTouch() {
  const forced = params.get('touch') === '1';
  const isTouch = forced || ('ontouchstart' in window) || navigator.maxTouchPoints > 0
    || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
  if (!isTouch) return;
  document.body.classList.add('touch');
  const joy = document.getElementById('joy');
  const knob = document.getElementById('joyKnob');
  let joyId = null;
  function setKnob(dx, dy) { knob.style.transform = 'translate(' + (dx * 38) + 'px,' + (dy * 38) + 'px)'; }
  function track(t) {
    const r = joy.getBoundingClientRect();
    let dx = (t.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let dy = (t.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    touchInput.x = dx; touchInput.y = dy; touchInput.active = true;
    setKnob(dx, dy);
  }
  function reset() { touchInput.x = 0; touchInput.y = 0; touchInput.active = false; setKnob(0, 0); }
  joy.addEventListener('touchstart', (e) => {
    e.preventDefault();
    joyId = e.changedTouches[0].identifier;
    track(e.changedTouches[0]);
  }, { passive: false });
  joy.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) if (t.identifier === joyId) track(t);
  }, { passive: false });
  const endTouch = (e) => {
    for (const t of e.changedTouches) if (t.identifier === joyId) { joyId = null; reset(); }
  };
  joy.addEventListener('touchend', endTouch);
  joy.addEventListener('touchcancel', endTouch);
  function bindBtn(id, fn) {
    const el = document.getElementById(id);
    el.addEventListener('touchstart', (e) => { e.preventDefault(); fn(); }, { passive: false });
    el.addEventListener('click', (e) => { e.preventDefault(); });
  }
  bindBtn('btnFire', () => { onShoot(); });
  bindBtn('btnAct', () => { onInteract(); });
  bindBtn('btnPauseT', () => { togglePause(); });
  window.SOLARA_TOUCH = touchInput; // debug handle for verification
}

// ---------- helpers ----------
function playerPos() {
  return state.inCar && state.car
    ? { x: state.car.mesh.position.x, z: state.car.mesh.position.z }
    : { x: player.x, z: player.z };
}
function distTo(x, z) { const p = playerPos(); return Math.hypot(p.x - x, p.z - z); }

// ---------- police ----------
function spawnPolice() {
  const mesh = world.makeCar(0, true);
  const a = rng() * TAU;
  const p = playerPos();
  mesh.position.set(p.x + Math.cos(a) * 70, 0, p.z + Math.sin(a) * 70);
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
    toast(why + ' \u2014 wanted level ' + state.wanted + '\u2605');
    AudioSys.sfx('siren');
    while (police.length < state.wanted) spawnPolice();
  }
}

// ---------- player control ----------
function updatePlayer(dt) {
  const p = player.mesh;
  if (state.inCar && state.car) {
    const c = state.car;
    // Keyboard first; the touch joystick overrides it while it is held.
    let fwd = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 0.55 : 0);
    let steer = (keys.KeyA || keys.ArrowLeft ? 1 : 0) - (keys.KeyD || keys.ArrowRight ? 1 : 0);
    if (touchInput.active) {
      fwd = clamp(-touchInput.y, -0.55, 1);
      steer = clamp(-touchInput.x, -1, 1);
      if (Math.abs(touchInput.x) < 0.12 && Math.abs(touchInput.y) < 0.12) { fwd = 0; steer = 0; }
    }
    if (fwd > 0) c.speed = Math.min(c.speed + 16 * dt, 32);
    else if (fwd < 0) c.speed = Math.max(c.speed - 18 * dt, -12);
    else c.speed *= Math.pow(0.4, dt);
    if (keys.Space) c.speed *= Math.pow(0.05, dt);
    const turn = steer * clamp(Math.abs(c.speed) / 14, 0, 1) * 1.9 * dt * Math.sign(c.speed || 1);
    c.heading -= turn;
    const nx = c.mesh.position.x + Math.sin(c.heading) * c.speed * dt;
    const nz = c.mesh.position.z + Math.cos(c.heading) * c.speed * dt;
    const prev = { x: c.mesh.position.x, z: c.mesh.position.z };
    c.mesh.position.x = clamp(nx, -210, 210);
    c.mesh.position.z = clamp(nz, -210, 330);
    world.collideCircle(c.mesh.position, 2.2);
    if (Math.hypot(c.mesh.position.x - prev.x, c.mesh.position.z - prev.z) < Math.abs(c.speed) * dt * 0.4 && Math.abs(c.speed) > 6) {
      c.speed *= 0.55;
      if (Math.abs(c.speed) > 8) AudioSys.sfx('crash');
    }
    c.mesh.rotation.y = c.heading;
    c.mesh.rotation.z = -steer * 0.03 * clamp(Math.abs(c.speed) / 20, 0, 1);
    c.mesh.userData.wheels.forEach((w) => { w.rotation.x += c.speed * dt * 2; });
    state.speed = Math.abs(c.speed) * 2.2;
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
    for (const t of traffic) {
      const d = Math.hypot(t.mesh.position.x - c.mesh.position.x, t.mesh.position.z - c.mesh.position.z);
      if (d < 4.5) {
        t.mesh.position.x += Math.sin(c.heading) * 24 * dt;
        t.mesh.position.z += Math.cos(c.heading) * 24 * dt;
        if (Math.abs(c.speed) > 12) { c.speed *= 0.7; AudioSys.sfx('crash'); }
      }
    }
    AudioSys.setEngine(clamp(Math.abs(c.speed) / 32, 0, 1));
  } else {
    let mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
    let mz = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
    if (touchInput.active) { mx += touchInput.x; mz += touchInput.y; }
    const run = keys.ShiftLeft || keys.ShiftRight;
    const spd = run ? 9 : 5.2;
    if (mx || mz) {
      const len = Math.hypot(mx, mz);
      const fx = Math.sin(camHeading), fz = Math.cos(camHeading);
      const rx = Math.cos(camHeading), rz = -Math.sin(camHeading);
      const dx = (fx * -mz + rx * mx) / len;
      const dz = (fz * -mz + rz * mx) / len;
      player.x += dx * spd * dt;
      player.z += dz * spd * dt;
      player.x = clamp(player.x, -210, 210);
      player.z = clamp(player.z, -210, 330);
      player.heading = Math.atan2(dx, dz);
      player.walkPhase += dt * spd * 1.6;
    }
    world.collideCircle(player, 0.8);
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
    const pd = { mesh: world.makePed(pk.x, pk.z, pick(rng, PED_COLORS)), x: pk.x, z: pk.z, heading: 0, speed: 1.5, down: false, downT: 0, road: 0 };
    peds.push(pd);
  }
  pk.stolen = true;
  state.inCar = true;
  state.car = { mesh: pk.mesh, heading: pk.heading, speed: 0, name: pk.name, courier: !!pk.courier, parkedRef: pk };
  player.mesh.visible = false;
  state.carsStolen++;
  if (!pk.courier) addWanted(1, 'Car stolen');
  AudioSys.sfx('pickup');
  toast('You took the ' + pk.name + ' \u2014 drive!');
}
function enterCarSilent(pk) {
  pk.stolen = true;
  state.inCar = true;
  state.car = { mesh: pk.mesh, heading: pk.heading, speed: 0, name: pk.name, courier: !!pk.courier, parkedRef: pk };
  player.mesh.visible = false;
}
function exitCar() {
  if (!state.car) return;
  const c = state.car;
  player.x = clamp(c.mesh.position.x - Math.sin(c.heading) * 3.5, -210, 210);
  player.z = clamp(c.mesh.position.z - Math.cos(c.heading) * 3.5, -210, 330);
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
  checkMissionInteract();
}
function knockDown(pd) {
  pd.down = true; pd.downT = 0;
  pd.mesh.rotation.x = -Math.PI / 2; pd.mesh.position.y = 0.4;
}
function onPunch() {
  if (!state.started || state.paused || state.over || state.inCar) return;
  AudioSys.sfx('punch');
  let hit = false;
  for (const pd of peds) {
    if (pd.down || pd.danny) continue;
    if (Math.hypot(pd.x - player.x, pd.z - player.z) < 2.6) { knockDown(pd); hit = true; }
  }
  if (hit) addWanted(1, 'Assault');
}
function onShoot() {
  if (!state.started || state.paused || state.over || !state.hasPistol || state.ammo <= 0) return;
  state.ammo--;
  AudioSys.sfx('shot');
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
    if (best.kind === 'ped') knockDown(best.ref);
    else {
      best.ref.mesh.position.x += (Math.random() - 0.5) * 4;
      best.ref.mesh.position.z += (Math.random() - 0.5) * 4;
    }
    addWanted(1, 'Shots fired');
  }
}

// ---------- traffic / peds / police updates ----------
function updateTraffic(dt) {
  const px = state.inCar && state.car ? state.car.mesh.position.x : player.x;
  const pz = state.inCar && state.car ? state.car.mesh.position.z : player.z;
  for (const t of traffic) {
    let slow = false;
    const dx = px - t.mesh.position.x, dz = pz - t.mesh.position.z;
    const ahead = t.axis === 'x' ? dx * t.dir : dz * t.dir;
    const side = t.axis === 'x' ? Math.abs(dz) : Math.abs(dx);
    if (ahead > 0 && ahead < 12 && side < 4) slow = true;
    const v = slow ? t.speed * 0.25 : t.speed;
    if (t.axis === 'x') t.mesh.position.x += t.dir * v * dt;
    else t.mesh.position.z += t.dir * v * dt;
    const along = t.axis === 'x' ? t.mesh.position.x : t.mesh.position.z;
    const nearGrid = ROADS.some((r) => Math.abs(along - r) < v * dt + 0.6);
    // Per-second turn chance, so the rate no longer depends on frame rate.
    if (nearGrid && rng() < 0.25 * dt) {
      const newAxis = t.axis === 'x' ? 'z' : 'x';
      const newDir = rng() < 0.5 ? 1 : -1;
      const lane = newDir > 0 ? 3 : -3;
      if (newAxis === 'x') t.mesh.position.z = Math.round(t.mesh.position.z / 40) * 40 + lane;
      else t.mesh.position.x = Math.round(t.mesh.position.x / 40) * 40 + lane;
      t.axis = newAxis; t.dir = newDir;
      t.mesh.rotation.y = newAxis === 'x' ? (newDir > 0 ? Math.PI / 2 : -Math.PI / 2) : (newDir > 0 ? 0 : Math.PI);
    }
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
    if (pd.danny && !state.dannyInCar) continue;
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
    world.collideCircle(po.mesh.position, 2.2);
    po.mesh.rotation.y = po.heading;
    po.mesh.userData.wheels.forEach((w) => { w.rotation.x += po.speed * dt * 2; });
    // Dual light bar: red and blue alternate, never both dark.
    const phase = Math.floor(elapsed * 4) % 2 === 0;
    if (po.mesh.userData.lightRed && po.mesh.userData.lightBlue) {
      po.mesh.userData.lightRed.material.emissiveIntensity = phase ? 2.2 : 0.25;
      po.mesh.userData.lightBlue.material.emissiveIntensity = phase ? 0.25 : 2.2;
    }
    if (d < 4.2) {
      if (state.inCar && state.car) {
        state.car.speed *= 0.6;
        state.car.mesh.position.x += Math.sin(po.heading) * 24 * dt;
        state.car.mesh.position.z += Math.cos(po.heading) * 24 * dt;
      } else {
        state.health = Math.max(0, state.health - 22 * dt);
        player.x += Math.sin(po.heading) * 6 * dt;
        player.z += Math.cos(po.heading) * 6 * dt;
      }
      if (rng() < 0.02) AudioSys.sfx('crash');
    }
  }
  if (state.wanted > 0 && elapsed - state.lastCrimeT > 25) {
    let nearest = 999;
    for (const po of police) nearest = Math.min(nearest, Math.hypot(po.mesh.position.x - p.x, po.mesh.position.z - p.z));
    if (nearest > 55) {
      state.wanted = Math.max(0, state.wanted - dt * 0.12);
      if (state.wanted < 1) { state.wanted = 0; toast('You lost the heat \u2014 for now.'); }
    }
  }
}

// ---------- missions ----------
function currentMission() { return MISSIONS[state.missionIndex] || null; }
function currentStep() { const m = currentMission(); return m ? m.steps[state.stepIndex] : null; }
function stepTarget() {
  const s = currentStep();
  if (!s) return null;
  if (s.type === 'steal') return { x: 120, z: 140 };
  if (s.type === 'pickup' || s.type === 'goto' || s.type === 'interact') return { x: s.x, z: s.z };
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
let needCarHintT = -999;
function advanceStep() {
  const m = currentMission();
  state.stepIndex++;
  state.stepTimer = 0;
  if (state.stepIndex >= m.steps.length) completeMission();
  else { setStepWanted(); toast(m.steps[state.stepIndex].text); }
}
function completeMission() {
  const m = currentMission();
  state.cash += m.reward;
  AudioSys.sfx('complete');
  AudioSys.sfx('cash');
  showBanner('MISSION COMPLETE', m.name + ' \u2014 +$' + m.reward.toLocaleString());
  state.missionIndex++;
  state.stepIndex = 0;
  state.stepTimer = 0;
  saveGame();
  if (state.missionIndex >= MISSIONS.length) {
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
    if (distTo(t.x, t.z) < 12) {
      if (s.needCar && !state.inCar) {
        if (elapsed - needCarHintT > 5) { needCarHintT = elapsed; toast('You need a car for this one \u2014 press E near a parked car.'); }
      } else advanceStep();
    }
  } else if (s.type === 'steal') {
    if (state.car && state.car.courier) advanceStep();
  } else if (s.type === 'survive') {
    const p = playerPos();
    let near = 999;
    for (const po of police) near = Math.min(near, Math.hypot(po.mesh.position.x - p.x, po.mesh.position.z - p.z));
    if (near > 45) {
      if (state.stepTimer >= s.seconds) advanceStep();
    } else {
      state.stepTimer = Math.max(0, state.stepTimer - dt * 0.5);
    }
  } else if (s.type === 'pickup') {
    const d = Math.hypot(player.x - s.x, player.z - s.z);
    if (d < 4 && !state.inCar) {
      state.dannyInCar = true;
      world.dannyPed.visible = false;
      toast('Danny\u2019s in the car. GO!');
      AudioSys.sfx('pickup');
      advanceStep();
    }
  } else if (s.type === 'choice') {
    if (!state.ending) {
      state.over = true;
      document.getElementById('ending').style.display = 'flex';
    }
  }
  const t = stepTarget();
  if (t) {
    world.beacon.visible = true;
    world.beacon.position.set(t.x, 0, t.z);
    world.beacon.userData.diamond.rotation.y += dt * 2;
    world.beacon.userData.diamond.position.y = 8 + Math.sin(elapsed * 2.5) * 0.8;
  } else if (s.type === 'survive') {
    world.beacon.visible = false;
  }
}
function checkMissionInteract() {
  const s = currentStep();
  if (!s) return;
  if (s.type === 'interact') {
    const d = Math.hypot(player.x - s.x, player.z - s.z);
    if (d < 14) {
      toast('Bag grabbed \u2014 $40,000 of Vega money. RUN!');
      AudioSys.sfx('cash');
      advanceStep();
    } else toast('Get to the bank doors first.');
  }
  if (s.type === 'pickup') toast('Walk up to Danny \u2014 on foot.');
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
function updateHUD() {
  $('healthbar').style.width = clamp(state.health, 0, 100) + '%';
  $('cash').textContent = state.cash.toLocaleString();
  let stars = '';
  for (let i = 0; i < 5; i++) stars += i < Math.floor(state.wanted) ? '\u2605' : '<span class="off">\u2605</span>';
  $('stars').innerHTML = stars;
  $('wantedlabel').textContent = wantedLabel();
  const m = currentMission();
  if (m) {
    $('mtitle').textContent = m.name + '  \u00b7  $' + m.reward.toLocaleString();
    const s = currentStep();
    $('mobj').textContent = s ? s.text : 'All jobs done.';
  } else {
    $('mtitle').textContent = 'SOLARA BAY \u2014 FREE ROAM';
    $('mobj').textContent = 'All five jobs complete. The bay is yours \u2014 drive, steal, survive.';
  }
  $('speed').textContent = Math.round(state.speed);
  $('vehname').textContent = state.inCar && state.car
    ? state.car.name.toUpperCase() + (state.car.courier ? ' \u2605 COURIER' : '')
    : 'ON FOOT' + (state.hasPistol ? ' \u00b7 PISTOL ' + state.ammo : '');
  const hh = Math.floor(state.time), mm = Math.round(state.time * 60) % 60;
  $('clocktime').textContent = String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  const pr = $('prompt');
  if (!state.started) { pr.style.display = 'none'; return; }
  let msg = '';
  if (!state.inCar) {
    const pk = nearestStealable();
    if (pk) msg = 'Press E \u2014 steal the ' + pk.name;
    else if (currentStep() && currentStep().type === 'interact' && distTo(40, -8) < 14) msg = 'Press E \u2014 grab the bag';
    else if (currentStep() && currentStep().type === 'pickup' && Math.hypot(player.x + 120, player.z - 120) < 6) msg = 'Danny is here \u2014 walk to him';
    else if (!state.hasPistol && Math.hypot(player.x + 128, player.z + 128) < 3) msg = 'Pistol case here \u2014 walk over it to pick it up';
  } else {
    msg = 'E exit car \u00b7 SPACE handbrake';
  }
  pr.style.display = msg ? 'block' : 'none';
  pr.textContent = msg;
}
function refreshMinimap() {
  drawMinimap(mapCtx, {
    buildings: world.buildingRects,
    traffic, police,
    dannyInCar: state.dannyInCar,
    missionIndex: state.missionIndex,
    waypoint: stepTarget(),
    player: { x: playerPos().x, z: playerPos().z },
    playerHeading: state.inCar && state.car ? state.car.heading : player.heading,
    elapsed,
  });
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
    toast('Save loaded \u2014 ' + (MISSIONS[state.missionIndex] ? MISSIONS[state.missionIndex].name : 'free roam'));
  }
  const m = currentMission();
  if (m) { toast(m.name + ': ' + m.intro); setStepWanted(); }
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
  // The $40,000 bag was already added to cash by completeMission, so paying
  // Vega really does cost it — the old code left the money in the wallet.
  state.cash = Math.max(0, state.cash - 40000);
  state.ending = 'pay';
  document.getElementById('ending').style.display = 'none';
  state.over = false;
  showBanner('DANNY WALKS FREE', 'You paid Vega. The bay lets go \u2014 this time.');
  toast('Ending: PAY VEGA \u2014 Danny is free. Free roam unlocked.');
  state.missionIndex = MISSIONS.length;
  state.wanted = 0;
  saveGame();
});
$('keepBtn').addEventListener('click', () => {
  // Keep: the $40,000 already in cash stays — no second payout.
  state.ending = 'keep';
  document.getElementById('ending').style.display = 'none';
  state.over = false;
  showBanner('BURN THE BRIDGE', 'You kept the money. Vega will come for it \u2014 and for Danny.');
  toast('Ending: KEEP THE MONEY \u2014 $40,000 kept. Wanted level 5.');
  state.missionIndex = MISSIONS.length;
  state.wanted = 5;
  while (police.length < 5) spawnPolice();
  saveGame();
});

// ---------- deterministic screenshot hooks ----------
let shotSetup = null;
function applyShot() {
  if (!SHOT) return;
  const setup = getShotSetup(SHOT);
  if (!setup) return;
  shotSetup = setup;
  state.started = true;
  AudioSys.init = () => {}; // no audio in headless shots
  $('start').style.display = setup.showStartOverlay ? 'flex' : 'none';
  applyShotSetup(setup, {
    state, player, world, camera, pickRng: rng,
    enterCarSilent, spawnPolice,
  });
  if (setup.mode === 'chase') camRig.heading = 0;
  if (setup.mode === 'play') camRig.heading = Math.PI;
  if (setup.mode === 'end') {
    showBanner(setup.banner.title, setup.banner.text);
    $('banner').style.display = 'block';
  }
  // Staged poses are frozen: the frame loop rebuilds the camera from the
  // pose every tick instead of letting the follow camera drift away.
  updateHUD();
  refreshMinimap();
}

// ---------- main loop ----------
const clock = new THREE.Clock();
let saveTimer = 0;
function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);
  if (SHOT && shotSetup) {
    // Frozen shot: only the ambient animation moves (palms, beacon,
    // police light bars), so the screenshot matches the staged pose.
    elapsed += dt;
    for (let i = 0; i < world.palmTops.length; i++) world.palmTops[i].rotation.z = Math.sin(elapsed * 0.8 + i) * 0.08;
    if (world.beacon.visible) {
      world.beacon.userData.diamond.rotation.y += dt * 2;
      world.beacon.userData.diamond.position.y = 8 + Math.sin(elapsed * 2.5) * 0.8;
    }
    for (const po of police) {
      const phase = Math.floor(elapsed * 4) % 2 === 0;
      if (po.mesh.userData.lightRed) po.mesh.userData.lightRed.material.emissiveIntensity = phase ? 2.2 : 0.25;
      if (po.mesh.userData.lightBlue) po.mesh.userData.lightBlue.material.emissiveIntensity = phase ? 0.25 : 2.2;
    }
    if (shotSetup.mode === 'start') {
      camera.position.set(shotSetup.camera.x, shotSetup.camera.y, shotSetup.camera.z);
      camera.lookAt(shotSetup.camera.lookX, shotSetup.camera.lookY, shotSetup.camera.lookZ);
    } else if (shotSetup.mode === 'chase' && state.car) {
      camRig.snapTo(state.car.mesh.position, 0, shotSetup.camera.dist, shotSetup.camera.height, shotSetup.camera.lookAhead);
    } else if (shotSetup.mode === 'play') {
      camRig.snapTo({ x: player.x, z: player.z }, Math.PI, shotSetup.camera.dist, shotSetup.camera.height, shotSetup.camera.lookAhead);
    } else if (shotSetup.mode === 'end') {
      camera.position.set(shotSetup.camera.x, shotSetup.camera.y, shotSetup.camera.z);
      camera.lookAt(shotSetup.camera.lookX, shotSetup.camera.lookY, shotSetup.camera.lookZ);
      $('banner').style.display = 'block';
      $('bannertitle').textContent = shotSetup.banner.title;
      $('bannertext').textContent = shotSetup.banner.text;
    }
  } else if (state.started && !state.paused && !state.over) {
    elapsed += dt;
    state.time = 18.7 + elapsed / 2400;
    updatePlayer(dt);
    updateTraffic(dt);
    updatePeds(dt);
    updatePolice(dt);
    updateMissions(dt);
    if (!state.hasPistol && Math.hypot(player.x + 128, player.z + 128) < 2.5 && !state.inCar) {
      state.hasPistol = true; state.ammo = 24;
      world.pistolPickup.visible = false;
      toast('Pistol picked up \u2014 24 rounds. Click to shoot.');
      AudioSys.sfx('pickup');
    }
    if (world.pistolPickup.visible) world.pistolPickup.rotation.y += dt * 2;
    for (let i = 0; i < world.palmTops.length; i++) world.palmTops[i].rotation.z = Math.sin(elapsed * 0.8 + i) * 0.08;
    if (state.wanted === 0 && state.health < 100) state.health = Math.min(100, state.health + dt * 2);
    if (state.health <= 0) {
      state.health = 0;
      showBanner('BUSTED / DOWN', 'Mara wakes up at the hospital \u2014 $500 lighter.');
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
  if (!SHOT && state.started && !state.paused) {
    const p = playerPos();
    camHeading = camRig.follow(dt, p, state.car ? state.car.heading : player.heading, state.inCar, state.speed, !!keys.KeyQ, player.heading);
  }
  refreshMinimap();
  updateHUD();
  renderer.render(scene, camera);
}

// debug handle (read-only state for testing / verification)
window.SOLARA = { state, player, get car() { return state.car; }, get pos() { return playerPos(); } };

// ---------- init ----------
setupTouch();
applyShot();
frame();
