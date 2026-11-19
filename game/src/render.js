// SOLARA BAY — renderer, golden-hour sky, lights, chase camera, minimap.
// Round 3 rewrite. The palette is the user's direction and does not move:
// low sun near 5 degrees, orange-pink-teal gradient, long warm shadows.
// New: setDusk(f) deepens the evening as the clock runs — the sun drops,
// the fog darkens, and the street lamps and neon signs take over.
'use strict';

import { GRID, TAU, clamp, lerp, angDiff } from './config.js';

export function setupRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

function skyTexture() {
  const cv = document.createElement('canvas');
  cv.width = 4; cv.height = 256;
  const g = cv.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#0e5a68');
  grad.addColorStop(0.16, '#2e8f8f');
  grad.addColorStop(0.32, '#e58aa0');
  grad.addColorStop(0.48, '#ff8a66');
  grad.addColorStop(0.66, '#ff9e45');
  grad.addColorStop(1, '#ffc46b');
  g.fillStyle = grad;
  g.fillRect(0, 0, 4, 256);
  return new THREE.CanvasTexture(cv);
}

function sunSprite() {
  const cv = document.createElement('canvas');
  cv.width = 128; cv.height = 128;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,214,140,1)');
  grad.addColorStop(0.35, 'rgba(255,150,70,0.95)');
  grad.addColorStop(1, 'rgba(255,110,50,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false,
  }));
  spr.scale.set(380, 380, 1);
  spr.position.set(-280, 46, -430);
  return spr;
}

export function setupScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xef9a68, 150, 560);
  scene.background = skyTexture();
  const sunDisc = sunSprite();
  scene.add(sunDisc);

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

  const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
  camera.position.set(40, 26, 120);

  // f = 0 is golden hour, f = 1 is full night. Called every frame from
  // the game loop with the clock's dusk factor.
  let dusk = -1;
  const fogDay = new THREE.Color(0xef9a68);
  const fogNight = new THREE.Color(0x1a2440);
  function setDusk(f, neonMeshes, lampGlows) {
    f = clamp(f, 0, 1);
    if (Math.abs(f - dusk) < 0.01 && dusk >= 0) return;
    dusk = f;
    scene.fog.color.copy(fogDay).lerp(fogNight, f);
    hemi.intensity = lerp(0.95, 0.32, f);
    sun.intensity = lerp(2.0, 0.25, f);
    sun.position.set(-300, lerp(78, 18, f), -190);
    sunDisc.material.opacity = lerp(1, 0.12, f);
    if (neonMeshes) for (const m of neonMeshes) m.material.emissiveIntensity = lerp(0.35, 2.4, f);
    if (lampGlows) for (const b of lampGlows) b.material.emissiveIntensity = lerp(0.25, 2.2, f);
  }
  return { scene, camera, sun, hemi, setDusk };
}

// Chase camera rebuilt from the car every tick, so a screenshot always
// shows the car, the road ahead and the police behind it — never a wall.
export function makeCameraRig(camera) {
  let heading = 0;
  function follow(dt, pos, targetHeading, inCar, speed, playerHeading, moving) {
    let want = heading;
    if (inCar) want = targetHeading;
    else if (moving) want = playerHeading;
    heading += angDiff(heading, want) * (inCar ? 2.2 : 0.6) * dt;
    const dist = inCar ? 16 : 8.5;
    const h = inCar ? 7 : 4.8;
    const cx = pos.x - Math.sin(heading) * dist;
    const cz = pos.z - Math.cos(heading) * dist;
    const k = 1 - Math.pow(0.001, dt);
    camera.position.x = lerp(camera.position.x, cx, k);
    camera.position.y = lerp(camera.position.y, h + (inCar ? Math.abs(speed) * 0.03 : 0), k);
    camera.position.z = lerp(camera.position.z, cz, k);
    camera.lookAt(pos.x, 2.2, pos.z);
    return heading;
  }
  function snapTo(pos, headingValue, dist, height, lookAhead) {
    heading = headingValue;
    camera.position.set(
      pos.x - Math.sin(headingValue) * dist,
      height,
      pos.z - Math.cos(headingValue) * dist,
    );
    camera.lookAt(
      pos.x + Math.sin(headingValue) * (lookAhead || 0),
      2.2,
      pos.z + Math.cos(headingValue) * (lookAhead || 0),
    );
    return heading;
  }
  function place(x, y, z, lx, ly, lz) {
    camera.position.set(x, y, z);
    camera.lookAt(lx, ly, lz);
  }
  return {
    get heading() { return heading; },
    set heading(v) { heading = v; },
    follow, snapTo, place,
  };
}

// Live minimap: bay, land, beach, bridge, island, buildings, roads,
// traffic dots, police dots, Danny, the pulsing waypoint and the player
// arrow. Neon Row shows as a magenta block so the strip reads on the map.
export function drawMinimap(ctx, data) {
  const S = 200, scale = S / 560;
  const toMap = (x, z) => [100 + (x + 30) * scale, 100 + (z + 20) * scale];
  ctx.clearRect(0, 0, S, S);
  ctx.fillStyle = '#1e7d8c';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#5a6a5e';
  const [lx, ly] = toMap(-210, -210);
  ctx.fillRect(lx, ly, 420 * scale, 400 * scale);
  ctx.fillStyle = '#e8cf9e';
  ctx.fillRect(lx, toMap(0, 168)[1], 420 * scale, 22 * scale);
  ctx.fillStyle = '#9aa4a8';
  ctx.fillRect(toMap(-9, 180)[0], toMap(0, 180)[1], 18 * scale, 115 * scale);
  ctx.fillStyle = '#e8cf9e';
  ctx.fillRect(toMap(-45, 270)[0], toMap(0, 270)[1], 90 * scale, 60 * scale);
  for (const b of data.buildings) {
    const [bx, bz] = toMap(b.x - b.w / 2, b.z - b.d / 2);
    ctx.fillStyle = b.neon ? '#ff2e88' : '#2e3438';
    ctx.fillRect(bx, bz, Math.max(2, b.w * scale), Math.max(2, b.d * scale));
  }
  ctx.strokeStyle = 'rgba(245,233,200,0.6)';
  ctx.lineWidth = 1;
  for (const r of GRID) {
    const [x1, y1] = toMap(r, -200); const [x2, y2] = toMap(r, 180);
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    const [ax1, ay1] = toMap(-200, r); const [ax2, ay2] = toMap(200, r);
    ctx.beginPath(); ctx.moveTo(ax1, ay1); ctx.lineTo(ax2, ay2); ctx.stroke();
  }
  ctx.fillStyle = '#ffffff';
  for (const t of data.traffic) {
    const [x, y] = toMap(t.mesh.position.x, t.mesh.position.z);
    ctx.fillRect(x - 1, y - 1, 2.5, 2.5);
  }
  ctx.fillStyle = '#ff4040';
  for (const po of data.police) {
    const [x, y] = toMap(po.mesh.position.x, po.mesh.position.z);
    ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
  }
  if (data.heli) {
    const [x, y] = toMap(data.heli.x, data.heli.z);
    ctx.fillStyle = '#ff2e88';
    ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#ff2e88'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, 6.5, 0, TAU); ctx.stroke();
  }
  if (!data.dannyInCar && data.missionIndex >= 3) {
    const [x, y] = toMap(-120, 120);
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fill();
  }
  if (data.waypoint) {
    const [x, y] = toMap(data.waypoint.x, data.waypoint.z);
    const r = 5 + Math.sin(data.elapsed * 4) * 1.8;
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y);
    ctx.closePath(); ctx.fill();
  }
  const [px, py] = toMap(data.player.x, data.player.z);
  ctx.fillStyle = '#ff5c5c';
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(Math.PI - data.playerHeading);
  ctx.beginPath(); ctx.moveTo(0, -7); ctx.lineTo(5, 5.5); ctx.lineTo(-5, 5.5); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.75)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(100, 100, 97, 0, TAU); ctx.stroke();
}
