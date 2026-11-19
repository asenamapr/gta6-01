// SOLARA BAY — the city: ground, skyline, Neon Row, bridge, vehicles,
// pedestrians, pickups and the waypoint beacon. Round 4 rewrite.
// New here: a courier job marker (cyan beacon, distinct from the gold
// mission beacon) for the Night Shift courier system, plus a night
// courier van parked by Neon Row that the shift can use.
// The rest carries over: the Neon Row casino strip (signs light up at
// dusk), trucks and buses in traffic, three pedestrian body types, and
// a police helicopter the game can spawn at four and five stars.
'use strict';

import {
  HALF, SHORE, GRID, TAU, DENSITY, PASTEL, PAINT, CAR_NAMES, SHIRTS,
  SKINS, HAIR, NEON, VEHICLE_KINDS, VEHICLE_STATS, NEON_ROW, DOCKS, DOCK_SPOTS, pick, chance,
} from './config.js';

export function buildWorld(scene, rng) {
  const solids = [];       // AABB colliders {x,z,hx,hz}
  const facades = [];      // building rects for the minimap {x,z,w,d,h}
  const palmCrowns = [];
  const traffic = [];
  const parked = [];
  const walkers = [];
  const police = [];
  const neonMeshes = [];   // emissive sign faces, lit by dusk
  const lampGlows = [];    // street lamp bulbs, lit by dusk
  let courierCar = null;
  let danny = null;

  const root = new THREE.Group();
  scene.add(root);

  // One shared Lambert material per colour/option pair, so the city
  // does not create a new material for every wall and window.
  const cache = new Map();
  function paint(color, opts) {
    const key = color + '|' + JSON.stringify(opts || {});
    if (!cache.has(key)) cache.set(key, new THREE.MeshLambertMaterial({ color, ...(opts || {}) }));
    return cache.get(key);
  }
  function solid(w, h, d, color, x, y, z, opts, flat) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), paint(color, opts));
    m.position.set(x, y, z);
    if (!flat) { m.castShadow = true; m.receiveShadow = true; }
    root.add(m);
    return m;
  }
  function block(x, z, hx, hz) { solids.push({ x, z, hx, hz }); }
  function pushOut(p, r) {
    for (const c of solids) {
      const dx = p.x - c.x, dz = p.z - c.z;
      const ox = c.hx + r - Math.abs(dx), oz = c.hz + r - Math.abs(dz);
      if (ox > 0 && oz > 0) {
        if (ox < oz) p.x = c.x + Math.sign(dx || 1) * (c.hx + r);
        else p.z = c.z + Math.sign(dz || 1) * (c.hz + r);
      }
    }
  }

  // ---------- ground, roads, bay, beach ----------
  {
    const land = new THREE.Mesh(new THREE.BoxGeometry(HALF * 2 + 60, 2, SHORE + HALF + 30), paint(0x8f9a8a));
    land.position.set(0, -1, -10); land.receiveShadow = true; root.add(land);
    const slab = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, SHORE + HALF), paint(0x7d8478));
    slab.rotation.x = -Math.PI / 2; slab.position.set(0, 0.02, -10); slab.receiveShadow = true; root.add(slab);
    const tar = paint(0x3a4148);
    for (const r of GRID) {
      const ns = new THREE.Mesh(new THREE.PlaneGeometry(13, SHORE + HALF), tar);
      ns.rotation.x = -Math.PI / 2; ns.position.set(r, 0.04, -10); ns.receiveShadow = true; root.add(ns);
      const ew = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, 13), tar);
      ew.rotation.x = -Math.PI / 2; ew.position.set(0, 0.04, r); ew.receiveShadow = true; root.add(ew);
    }
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), paint(0x1e7d8c, { transparent: true, opacity: 0.92 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(-100, -0.4, 260); root.add(sea);
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, 26), paint(0xe8cf9e));
    sand.rotation.x = -Math.PI / 2; sand.position.set(0, 0.05, SHORE - 8); sand.receiveShadow = true; root.add(sand);
    const sandW = new THREE.Mesh(new THREE.PlaneGeometry(26, SHORE + HALF), paint(0xe8cf9e));
    sandW.rotation.x = -Math.PI / 2; sandW.position.set(-HALF + 2, 0.05, -10); sandW.receiveShadow = true; root.add(sandW);
    const dashGeo = new THREE.BoxGeometry(0.7, 0.06, 6);
    const dashMat = paint(0xf5e9c8);
    for (const r of GRID) {
      for (let t = -190; t <= 170; t += 16) {
        const a = new THREE.Mesh(dashGeo, dashMat); a.position.set(r, 0.06, t); root.add(a);
        const b = new THREE.Mesh(dashGeo, dashMat); b.position.set(t, 0.06, r); root.add(b);
      }
    }
    const walkMat = paint(0xf2f0e4);
    for (const rx of [-40, 0, 40]) for (const rz of [-40, 0, 40]) {
      for (let i = -2; i <= 2; i++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 5), walkMat);
        s.position.set(rx + i * 2.4, 0.06, rz + 9); root.add(s);
      }
    }
  }

  // ---------- buildings ----------
  const glowA = paint(0x2a3f4a, { emissive: 0xffc37a, emissiveIntensity: 0.55 });
  const glowB = paint(0x2a4a3f, { emissive: 0x7ef0d4, emissiveIntensity: 0.4 });
  {
    for (let ix = 0; ix < GRID.length - 1; ix++) {
      for (let iz = 0; iz < GRID.length - 1; iz++) {
        const cx = (GRID[ix] + GRID[ix + 1]) / 2;
        const cz = (GRID[iz] + GRID[iz + 1]) / 2;
        if (cz > 150) continue;
        // Neon Row owns the blocks hugging the 120 road on the east side.
        if (Math.abs(cx - NEON_ROW.x) < 25 && cz >= NEON_ROW.zMin - 20 && cz <= NEON_ROW.zMax + 20) continue;
        const core = Math.abs(cx) < 90 && Math.abs(cz) < 90;
        const ring = Math.abs(cx) < 130 && Math.abs(cz) < 130;
        const n = core ? (chance(rng, 0.55) ? 2 : 1) : (chance(rng, 0.6) ? 2 : 1);
        for (let k = 0; k < n; k++) {
          const w = core ? 17 + rng() * 7 : 12 + rng() * 5;
          const d = core ? 17 + rng() * 7 : 12 + rng() * 5;
          const h = core ? 42 + rng() * 62 : ring ? 14 + rng() * 26 : 9 + rng() * 18;
          const ox = n === 2 ? (k === 0 ? -8 : 8) : 0;
          const oz = n === 2 ? (k === 0 ? -8 : 8) : 0;
          const bx = cx + ox, bz = cz + oz;
          if (Math.abs(bx) > 185 || bz > 165 || bz < -185) continue;
          const color = pick(rng, PASTEL);
          solid(w, h, d, color, bx, h / 2, bz);
          solid(w + 0.6, 1.2, d + 0.6, 0xffffff, bx, h + 0.4, bz);
          solid(3, 1.6, 3, 0x9aa4a8, bx - w / 4, h + 1.6, bz - d / 4);
          solid(2.4, 1.2, 2.4, 0x7a8a90, bx + w / 4, h + 1.4, bz + d / 4);
          const wm = chance(rng, 0.5) ? glowA : glowB;
          const winH = Math.min(h * 0.5, 12);
          const w1 = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, winH, 0.4), wm);
          w1.position.set(bx, h * 0.55, bz + d / 2 + 0.25); root.add(w1);
          const w2 = w1.clone(); w2.position.z = bz - d / 2 - 0.25; root.add(w2);
          const w3 = new THREE.Mesh(new THREE.BoxGeometry(0.4, winH, d * 0.82), wm);
          w3.position.set(bx + w / 2 + 0.25, h * 0.55, bz); root.add(w3);
          block(bx, bz, w / 2 + 0.4, d / 2 + 0.4);
          facades.push({ x: bx, z: bz, w, d, h });
          if (core && chance(rng, 0.5)) solid(3, 10, 3, 0xff7a5c, bx, h + 6, bz);
          if (core && chance(rng, 0.3)) solid(w * 0.5, 6, d * 0.5, color, bx, h + 3.5, bz);
        }
      }
    }
    // Far skyline, north edge — tall muted towers behind the city.
    for (let i = 0; i < 20; i++) {
      const x = -260 + i * 27 + rng() * 10;
      const h = 55 + rng() * 75;
      const w = 16 + rng() * 10;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 16), paint(pick(rng, PASTEL)));
      m.position.set(x, h / 2, -235 - rng() * 45);
      root.add(m);
      facades.push({ x, z: m.position.z, w, d: 16, h, distant: true });
    }
    // Waterfront shops along the beach, awnings included.
    for (let x = -170; x <= 170; x += 42) {
      const h = 8 + rng() * 6;
      const color = pick(rng, PASTEL);
      solid(22, h, 12, color, x, h / 2, 156);
      solid(23, 1, 13, 0xffffff, x, h + 0.4, 156);
      solid(22, 1.4, 4, 0xff7a5c, x, h * 0.45, 163);
      block(x, 156, 12, 7);
      facades.push({ x, z: 156, w: 22, d: 12, h });
    }
    // Solara Trust bank — coral tower, gold trim (mission 5).
    solid(30, 46, 30, 0xff7a5c, 40, 23, -40);
    solid(32, 2, 32, 0xffd34d, 40, 47, -40);
    solid(20, 8, 2, 0xffd34d, 40, 30, -24);
    block(40, -40, 16, 16);
    facades.push({ x: 40, z: -40, w: 30, d: 30, h: 46 });
    // Reef's Garage — teal safehouse block (start).
    solid(24, 10, 18, 0x2a9d8f, -140, 5, -140);
    solid(25, 1.2, 19, 0xffd34d, -140, 10.6, -140);
    block(-140, -140, 13, 10);
    facades.push({ x: -140, z: -140, w: 24, d: 18, h: 10 });
  }

  // ---------- Neon Row: casino strip on the 120 road ----------
  {
    const stripX = NEON_ROW.x;
    // The Starfish Casino — the tall anchor at the north end of the strip.
    solid(26, 34, 22, 0x3a2a5e, stripX, 17, NEON_ROW.zMin - 4);
    solid(28, 1.6, 24, 0xff2e88, stripX, 35, NEON_ROW.zMin - 4);
    const star = solid(14, 4, 1, 0xff2e88, stripX, 26, NEON_ROW.zMin + 8, { emissive: 0xff2e88, emissiveIntensity: 1.4 });
    neonMeshes.push(star);
    const star2 = solid(1, 4, 14, 0x2ee8ff, stripX - 13, 26, NEON_ROW.zMin - 4, { emissive: 0x2ee8ff, emissiveIntensity: 1.2 });
    neonMeshes.push(star2);
    block(stripX, NEON_ROW.zMin - 4, 14, 12);
    facades.push({ x: stripX, z: NEON_ROW.zMin - 4, w: 26, d: 22, h: 34, neon: true });
    // Low neon-fronted clubs marching down both sides of the road.
    let sign = 0;
    for (let z = NEON_ROW.zMin + 24; z <= NEON_ROW.zMax; z += 28) {
      for (const side of [-1, 1]) {
        const bx = stripX + side * 22;
        const h = 9 + rng() * 5;
        const color = pick(rng, [0x2a2a3a, 0x3a2a3a, 0x1e3a3a, 0x402a4a]);
        solid(16, h, 12, color, bx, h / 2, z);
        solid(17, 1, 13, 0xffffff, bx, h + 0.4, z);
        const glow = pick(rng, NEON);
        const face = solid(12, 2.2, 0.6, glow, bx, h * 0.62, z - side * 6.4, { emissive: glow, emissiveIntensity: 1.6 });
        neonMeshes.push(face);
        const edge = solid(0.6, 2.2, 12, glow, bx - side * 8.4, h * 0.62, z, { emissive: glow, emissiveIntensity: 1.1 });
        neonMeshes.push(edge);
        block(bx, z, 9, 7);
        facades.push({ x: bx, z, w: 16, d: 12, h, neon: true });
        sign++;
        if (sign >= DENSITY.neonSigns) break;
      }
      if (sign >= DENSITY.neonSigns) break;
    }
    // A neon arch over the road at the strip's south gate.
    solid(1.4, 9, 1.4, 0x2e3438, stripX - 10, 4.5, NEON_ROW.zMax + 6);
    solid(1.4, 9, 1.4, 0x2e3438, stripX + 10, 4.5, NEON_ROW.zMax + 6);
    const arch = solid(21.4, 1.8, 1.2, 0xff2e88, stripX, 9.6, NEON_ROW.zMax + 6, { emissive: 0xff2e88, emissiveIntensity: 1.8 });
    neonMeshes.push(arch);
  }

  // ---------- palms, lamps, benches, billboards, traffic lights ----------
  {
    const trunkMat = paint(0x8a6a4d);
    const leafA = paint(0x3fae7a);
    const leafB = paint(0x57c98a);
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 9, 6);
    const leafGeo = new THREE.ConeGeometry(3.2, 4.5, 6);
    for (let i = 0; i < DENSITY.palms; i++) {
      let x, z;
      if (i < 44) { x = -190 + rng() * 380; z = 158 + rng() * 14; }
      else if (i < 64) { x = -188 + rng() * 8; z = -180 + rng() * 330; }
      else if (i < 84) { x = 188 + rng() * 8; z = -180 + rng() * 330; }
      else { const r = pick(rng, GRID); x = r + 13 + rng() * 4; z = -180 + rng() * 330; }
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, 4.5, z); trunk.castShadow = true; root.add(trunk);
      const top = new THREE.Mesh(leafGeo, chance(rng, 0.5) ? leafA : leafB);
      top.position.set(x, 10.5, z); top.castShadow = true; root.add(top);
      palmCrowns.push(top);
    }
    const poleMat = paint(0x2e3438);
    const bulbMat = paint(0xffe9a8, { emissive: 0xffd34d, emissiveIntensity: 0.9 });
    for (const r of GRID) {
      for (let t = -160; t <= 160; t += DENSITY.lampGap) {
        for (const [ox, oz] of [[11, 0], [-11, 20]]) {
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 8, 5), poleMat);
          pole.position.set(r + ox, 4, t + oz); root.add(pole);
          const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), bulbMat);
          bulb.position.set(r + ox, 8.2, t + oz); root.add(bulb);
          lampGlows.push(bulb);
        }
      }
    }
    for (let i = 0; i < DENSITY.benches; i++) {
      const r = pick(rng, GRID);
      solid(3.4, 0.5, 1.2, 0x6a4a3a, r + 12, 0.6, -170 + rng() * 320);
    }
    for (let i = 0; i < 12; i++) solid(1.2, 1.6, 1.2, 0xffd34d, 150 + rng() * 20, 0.8, -140 + rng() * 280);
    for (let i = 0; i < 14; i++) solid(2, 2, 2, 0x8a6a4d, 100 + rng() * 60, 1, 120 + rng() * 40);
    for (let i = 0; i < 16; i++) solid(2.4, 1, 2.4, 0x2a9d8f, pick(rng, GRID) + 12, 0.5, -160 + rng() * 300);
    const boardColors = [0xff7a5c, 0x2a9d8f, 0xffd34d, 0xe86a92];
    [[-120, -160], [120, -80], [-80, 80], [80, 160]].forEach(([x, z], i) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 14, 6), poleMat);
      pole.position.set(x, 7, z); root.add(pole);
      solid(16, 7, 0.8, boardColors[i % boardColors.length], x, 17, z);
      solid(17, 1, 1.2, 0xffffff, x, 21, z);
    });
    for (const rx of [-40, 0, 40]) for (const rz of [-40, 0, 40]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 7, 5), poleMat);
      pole.position.set(rx + 8, 3.5, rz + 8); root.add(pole);
      solid(1, 2.6, 0.8, 0x1a1a1a, rx + 8, 7.4, rz + 8);
      const green = (rx + rz) % 80 === 0;
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6),
        paint(green ? 0x2dd47a : 0xff4040, { emissive: green ? 0x2dd47a : 0xff4040, emissiveIntensity: 1.2 }));
      light.position.set(rx + 8, 7.9, rz + 8.4); root.add(light);
    }
    const umb = [0xff7a5c, 0x2a9d8f, 0xffd34d];
    for (let i = 0; i < 10; i++) {
      const x = -170 + rng() * 340, z = 168 + rng() * 8;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 5), poleMat);
      pole.position.set(x, 1.5, z); root.add(pole);
      const top = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.4, 8), paint(umb[i % 3]));
      top.position.set(x, 3.4, z); top.castShadow = true; root.add(top);
    }
  }

  // ---------- harbor bridge + Gull Island ----------
  {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(18, 0.4, 120), paint(0x9aa4a8));
    deck.position.set(0, 0.2, 235); deck.receiveShadow = true; root.add(deck);
    solid(0.6, 1.4, 120, 0xff7a5c, -8.6, 1.1, 235);
    solid(0.6, 1.4, 120, 0xff7a5c, 8.6, 1.1, 235);
    for (let z = 195; z <= 270; z += 25) {
      for (const sx of [-6, 6]) {
        const pil = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 5, 8), paint(0x7a8a90));
        pil.position.set(sx, -2.2, z); root.add(pil);
      }
    }
    const island = new THREE.Mesh(new THREE.BoxGeometry(90, 0.5, 60), paint(0xe8cf9e));
    island.position.set(0, -0.05, 300); island.receiveShadow = true; root.add(island);
    solid(4, 0.5, 24, 0x6a4a3a, -14, 0.4, 300);
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(5, 2.4, 12), paint(0xffffff));
    hull.position.y = 1.2; boat.add(hull);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2, 5), paint(0x2a9d8f));
    cab.position.set(0, 3.2, -1); boat.add(cab);
    boat.position.set(14, 0.2, 306); boat.rotation.y = 0.5;
    boat.traverse((o) => { o.castShadow = true; });
    root.add(boat);
    const lh = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.2, 22, 10), paint(0xf2f0e4));
    lh.position.set(-28, 12, 288); lh.castShadow = true; root.add(lh);
    const lhTop = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 3, 10), paint(0xff5c5c, { emissive: 0xffd34d, emissiveIntensity: 1 }));
    lhTop.position.set(-28, 24, 288); root.add(lhTop);
  }

  // ---------- Port Solara / The Docks (Round 5) ----------
  // A working port on the east edge of the bay, past the beach: a
  // pier deck over the water, a container yard, two gantry cranes,
  // three warehouses (one of them buyable — Warehouse 7), dockworker
  // peds in hi-vis, forklifts, and the Dock Hauler truck mission 7
  // needs. A causeway joins the pier to the beach so cars can drive
  // in through the gate at (186, 196). The smuggling crates glow
  // gold at the mission-7 spots so the run reads at a glance.
  const docks = { spots: DOCK_SPOTS, workers: [], crates: [], forklifts: [] };
  {
    // Causeway from the beach to the pier gate, then the pier deck.
    solid(16, 0.3, 26, 0x8a8f96, DOCKS.gateX, -0.05, 188, null, true);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(44, 0.3, 126), paint(0x7d8478));
    deck.position.set(190, -0.05, 259); deck.receiveShadow = true; root.add(deck);
    // Pier edge fenders — rust-red blocks along both sides.
    for (let z = 200; z <= 318; z += 14) {
      solid(1.2, 1, 2.4, 0x8a4a3a, 168.6, 0.4, z, null, true);
      solid(1.2, 1, 2.4, 0x8a4a3a, 211.4, 0.4, z, null, true);
    }
    // Bollards along the water edge.
    for (let z = 204; z <= 316; z += 28) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.6, 1.1, 8), paint(0xffd34d));
      b.position.set(210.4, 0.55, z); b.castShadow = true; root.add(b);
    }
    // Warehouses: 7 is the big one mid-pier (buyable), A north, B by the gate.
    const wh7 = solid(30, 11, 22, 0x4a6a7a, 186, 5.5, 244);
    solid(31, 1, 23, 0x2a3f4a, 186, 11.4, 244);
    solid(12, 5, 0.6, 0x22303a, 186, 2.5, 232.6);
    const sign7 = solid(16, 2.4, 0.6, 0xffd34d, 186, 9, 232.6, { emissive: 0xffd34d, emissiveIntensity: 1.1 });
    neonMeshes.push(sign7);
    block(186, 244, 16, 12);
    facades.push({ x: 186, z: 244, w: 30, d: 22, h: 11, docks: true });
    solid(24, 9, 18, 0x7a5a4a, 178, 4.5, 292);
    solid(25, 1, 19, 0x3a2a2a, 178, 9.4, 292);
    solid(9, 4.4, 0.6, 0x22303a, 178, 2.2, 282.6);
    block(178, 292, 13, 10);
    facades.push({ x: 178, z: 292, w: 24, d: 18, h: 9, docks: true });
    solid(20, 8, 16, 0x5a6a5a, 200, 4, 206);
    solid(21, 1, 17, 0x2a3a2a, 200, 8.4, 206);
    solid(8, 4, 0.6, 0x22303a, 200, 2, 197.6);
    block(200, 206, 11, 9);
    facades.push({ x: 200, z: 206, w: 20, d: 16, h: 8, docks: true });
    // Container yard: two rows of stacked boxes in port colours.
    const contColors = [0xb84a2e, 0x2a7a8a, 0xc8a02e, 0x3a4a6a, 0x7a8a3a, 0x8a3a4a];
    function containerStack(x, z, levels) {
      for (let l = 0; l < levels; l++) {
        const c = solid(6, 2.6, 2.6, pick(rng, contColors), x, 1.3 + l * 2.6, z);
        c.rotation.y = (rng() - 0.5) * 0.06;
      }
      block(x, z, 3.4, 1.7);
      facades.push({ x, z, w: 6, d: 2.6, h: 2.6 * levels, docks: true });
    }
    containerStack(174, 258, 3);
    containerStack(174, 266, 2);
    containerStack(174, 274, 3);
    containerStack(180, 262, 1);
    containerStack(204, 272, 2);
    containerStack(204, 280, 3);
    containerStack(204, 288, 1);
    containerStack(176, 306, 2);
    containerStack(196, 312, 2);
    // Gantry cranes: four legs, a top beam spanning the pier, a
    // trolley and a hanging cable with a container on the hook.
    function gantryCrane(x, z) {
      const legMat = paint(0xffd34d);
      for (const [lx, lz] of [[-15, -4], [15, -4], [-15, 4], [15, 4]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(1.4, 22, 1.4), legMat);
        leg.position.set(x + lx, 11, z + lz); leg.castShadow = true; root.add(leg);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(36, 2, 3), legMat);
      beam.position.set(x, 22.5, z); beam.castShadow = true; root.add(beam);
      const top = new THREE.Mesh(new THREE.BoxGeometry(36, 1, 1.2), paint(0x2a3f4a));
      top.position.set(x, 24, z); root.add(top);
      const trolley = new THREE.Mesh(new THREE.BoxGeometry(3, 1.6, 2.6), paint(0x22303a));
      trolley.position.set(x + 6, 21, z); root.add(trolley);
      const cable = new THREE.Mesh(new THREE.BoxGeometry(0.18, 12, 0.18), paint(0x111111));
      cable.position.set(x + 6, 14, z); root.add(cable);
      const hookBox = new THREE.Mesh(new THREE.BoxGeometry(5, 2.2, 2.4), paint(0xb84a2e));
      hookBox.position.set(x + 6, 7.4, z); hookBox.castShadow = true; root.add(hookBox);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.8, 8, 6),
        paint(0xffe9a8, { emissive: 0xffd34d, emissiveIntensity: 1.4 }));
      lamp.position.set(x, 21, z + 2); root.add(lamp);
      lampGlows.push(lamp);
      block(x - 15, z, 1.2, 4.5);
      block(x + 15, z, 1.2, 4.5);
    }
    gantryCrane(190, 262);
    gantryCrane(190, 300);
    // Forklifts parked by the container rows — small, yellow, with
    // a mast and forks, so the yard reads as worked, not abandoned.
    function forklift(x, z, heading) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1, 2.4), paint(0xffd34d));
      body.position.y = 0.7; body.castShadow = true; g.add(body);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1, 1.2), paint(0x22303a));
      cab.position.set(0, 1.6, -0.3); g.add(cab);
      const mast = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.6, 0.2), paint(0x2e3438));
      mast.position.set(0, 1.5, 1.25); g.add(mast);
      const forkL = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 1.4), paint(0x8a8f96));
      forkL.position.set(-0.5, 0.15, 1.9); g.add(forkL);
      const forkR = forkL.clone(); forkR.position.x = 0.5; g.add(forkR);
      const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.3, 8);
      const wheelMat = paint(0x14181c);
      for (const [wx, wz] of [[-0.8, 0.8], [0.8, 0.8], [-0.8, -0.8], [0.8, -0.8]]) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.z = Math.PI / 2; w.position.set(wx, 0.35, wz); g.add(w);
      }
      g.position.set(x, 0, z);
      g.rotation.y = heading;
      scene.add(g);
      docks.forklifts.push(g);
      return g;
    }
    forklift(182, 268, 0.4);
    forklift(198, 276, -0.6);
    forklift(184, 296, 2.2);
    // Dockworker peds in hi-vis: standing posts, not wanderers —
    // the yard is fenced and the update loop clamps walkers to the
    // city grid, so standing workers stay exactly where staged.
    const hiVis = [0xffd34d, 0xff7a2e, 0x7dff5c, 0x2ee8ff];
    const posts = [
      [176, 250], [192, 258], [200, 292], [178, 284],
      [186, 216], [206, 262], [172, 302], [196, 318],
    ];
    for (const [wx, wz] of posts) {
      const mesh = makeWalker(wx, wz, pick(rng, hiVis));
      walkers.push({ mesh, x: wx, z: wz, heading: rng() * TAU, speed: 0, down: false, downT: 0, dock: true });
      docks.workers.push(mesh);
    }
    // Smuggling crates: gold-glowing stacks at the mission-7 spots,
    // so the run's pickups read at a glance even at night.
    for (const spot of DOCK_SPOTS) {
      if (spot.name === 'DOCKS GATE') continue;
      const g = new THREE.Group();
      const crate = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 2.2), paint(0x8a6a4d));
      crate.position.y = 0.8; crate.castShadow = true; g.add(crate);
      const glow = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 2.4),
        paint(0xffd34d, { emissive: 0xffd34d, emissiveIntensity: 1.6 }));
      glow.position.y = 1.75; g.add(glow);
      const crate2 = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.6), paint(0x6a4a3a));
      crate2.position.set(1.8, 0.6, 0.6); crate2.castShadow = true; g.add(crate2);
      g.position.set(spot.x, 0, spot.z);
      scene.add(g);
      docks.crates.push(g);
    }
    // Dock floodlight poles — tall, so the yard is readable at night
    // when Act II plays in full dark.
    for (const [fx, fz] of [[172, 210], [208, 240], [172, 280], [208, 310]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 14, 5), paint(0x2e3438));
      pole.position.set(fx, 7, fz); root.add(pole);
      const head = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 1), paint(0xffe9a8, { emissive: 0xffd34d, emissiveIntensity: 1.6 }));
      head.position.set(fx, 14.2, fz); root.add(head);
      lampGlows.push(head);
    }
    // Moored boats at the pier end — small workboats tied up where
    // the pier meets the water, so the docks feel used, not staged.
    // They sit just off the deck edge, hulls in the water.
    function mooredBoat(x, z, heading, color) {
      const g = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.6, 8), paint(color));
      hull.position.y = 0.4; hull.castShadow = true; g.add(hull);
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 3), paint(0xf2f0e4));
      cab.position.set(0, 1.7, -1); g.add(cab);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4, 5), paint(0x2e3438));
      mast.position.set(0, 3.4, 1.5); g.add(mast);
      const rope = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 3), paint(0x8a6a4d));
      rope.position.set(1.4, 0.6, -4.5); rope.rotation.x = 0.5; g.add(rope);
      g.position.set(x, -0.2, z);
      g.rotation.y = heading;
      scene.add(g);
      return g;
    }
    mooredBoat(214, 292, 0.3, 0x2a9d8f);
    mooredBoat(214, 306, -0.2, 0xff7a5c);
    mooredBoat(166, 300, 2.8, 0xffd34d);
    // Fuel tank by Warehouse A — a rust-red cylinder with a hazard
    // band, the reason the TORCH THREAT defense event exists.
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 7, 12), paint(0x8a3a2a));
    tank.position.set(206, 3.5, 316); tank.castShadow = true; root.add(tank);
    const tankBand = new THREE.Mesh(new THREE.CylinderGeometry(4.05, 4.05, 1, 12), paint(0xffd34d));
    tankBand.position.set(206, 5.5, 316); root.add(tankBand);
    block(206, 316, 4.5, 4.5);
    facades.push({ x: 206, z: 316, w: 8, d: 8, h: 7, docks: true });
    // PORT SOLARA gate sign over the causeway — teal letters on the
    // dark, lit at night like the Neon Row signs.
    solid(1.2, 8, 1.2, 0x2e3438, 178, 4, 196);
    solid(1.2, 8, 1.2, 0x2e3438, 194, 4, 196);
    const gateSign = solid(17, 2.2, 1, 0x2ee8ff, 186, 8.6, 196, { emissive: 0x2ee8ff, emissiveIntensity: 1.5 });
    neonMeshes.push(gateSign);
    // One more container row by the gate, so the yard is dense from
    // the moment Mara drives in.
    containerStack(206, 214, 2);
    containerStack(206, 222, 1);
    containerStack(172, 218, 2);
    // The Dock Hauler — mission 7's truck, parked in the yard by
    // Crane Row. Flagged courier so the mission engine's steal step
    // recognises it, like the gold Vega courier car in mission 2.
    const hauler = makeVehicle(0xff7a2e, false, 'truck');
    hauler.position.set(200, 0, 280);
    hauler.rotation.y = Math.PI / 2;
    parked.push({ mesh: hauler, x: 200, z: 280, heading: Math.PI / 2, name: 'Dock Hauler', courier: true, stolen: false });
  }

  // ---------- vehicles ----------
  function makeVehicle(color, cop, kind) {
    const g = new THREE.Group();
    const stats = VEHICLE_STATS[kind || 'sedan'];
    const L = stats.length, W = stats.width;
    const body = new THREE.Mesh(new THREE.BoxGeometry(W, 0.75, L), paint(cop ? 0xf2f0e4 : color));
    body.position.y = 0.65; body.castShadow = true; g.add(body);
    if (kind === 'truck') {
      const cab = new THREE.Mesh(new THREE.BoxGeometry(W * 0.9, 1.5, 1.8), paint(0x22303a));
      cab.position.set(0, 1.4, L / 2 - 1); cab.castShadow = true; g.add(cab);
      const bed = new THREE.Mesh(new THREE.BoxGeometry(W * 0.92, 1.1, L - 2.6), paint(0x8a8f96));
      bed.position.set(0, 1.25, -1); bed.castShadow = true; g.add(bed);
    } else if (kind === 'bus') {
      const cab = new THREE.Mesh(new THREE.BoxGeometry(W * 0.92, 1.5, L * 0.8), paint(0x22303a));
      cab.position.set(0, 1.35, 0); cab.castShadow = true; g.add(cab);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.3, L * 0.82), paint(0xffd34d));
      stripe.position.set(0, 0.9, 0); g.add(stripe);
    } else {
      const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2.3), paint(cop ? 0x2e3438 : 0x22303a));
      cab.position.set(0, 1.3, -0.3); cab.castShadow = true; g.add(cab);
    }
    if (cop) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.34, L + 0.04), paint(0x1a1a1a));
      band.position.y = 0.55; g.add(band);
      const push = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 0.3), paint(0x1a1a1a));
      push.position.set(0, 0.55, L / 2 + 0.1); g.add(push);
      const red = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.32, 0.5), paint(0xff2020, { emissive: 0xff2020, emissiveIntensity: 1.6 }));
      red.position.set(-0.38, 1.85, -0.3); g.add(red);
      const blue = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.32, 0.5), paint(0x2040ff, { emissive: 0x2040ff, emissiveIntensity: 1.6 }));
      blue.position.set(0.38, 1.85, -0.3); g.add(blue);
      g.userData.lightRed = red;
      g.userData.lightBlue = blue;
    }
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
    const wheelMat = paint(0x14181c);
    const wheels = [];
    const axles = kind === 'sedan' ? [L / 2 - 0.8, -L / 2 + 0.8] : [L / 2 - 0.9, 0, -L / 2 + 0.9];
    for (const az of axles) for (const sx of [-1, 1]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2; w.position.set(sx * (W / 2), 0.42, az); g.add(w); wheels.push(w);
    }
    g.userData.wheels = wheels;
    g.userData.kind = kind || 'sedan';
    const hl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.25, 0.15), paint(0xffe9a8, { emissive: 0xffd34d, emissiveIntensity: 1 }));
    hl.position.set(0, 0.7, L / 2 + 0.02); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.25, 0.15), paint(0xff4040, { emissive: 0xff4040, emissiveIntensity: 0.9 }));
    tl.position.set(0, 0.7, -L / 2 - 0.02); g.add(tl);
    scene.add(g);
    return g;
  }

  function spawnTraffic(x, z, axis, dir, kind) {
    const mesh = makeVehicle(pick(rng, PAINT), false, kind);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const stats = VEHICLE_STATS[kind];
    const c = { mesh, axis, dir, kind, speed: stats.cruise + rng() * 4, road: axis === 'x' ? z : x, mass: stats.mass };
    traffic.push(c);
    return c;
  }

  {
    for (let i = 0; i < DENSITY.traffic; i++) {
      const axis = chance(rng, 0.5) ? 'x' : 'z';
      const road = pick(rng, GRID);
      const t = -180 + rng() * 340;
      const dir = chance(rng, 0.5) ? 1 : -1;
      const lane = dir > 0 ? 3 : -3;
      spawnTraffic(axis === 'x' ? t : road + lane, axis === 'x' ? road + lane : t, axis, dir, pick(rng, VEHICLE_KINDS));
    }
    for (let i = 0; i < DENSITY.parked; i++) {
      const road = pick(rng, GRID);
      const t = -170 + rng() * 330;
      const mesh = makeVehicle(pick(rng, PAINT), false, 'sedan');
      const x = road + 8, z = t;
      mesh.position.set(x, 0, z);
      mesh.rotation.y = (chance(rng, 0.5) ? 0 : Math.PI) + (rng() - 0.5) * 0.2;
      parked.push({ mesh, x, z, heading: mesh.rotation.y, name: pick(rng, CAR_NAMES), stolen: false });
    }
    courierCar = makeVehicle(0xffd34d, false, 'sedan');
    courierCar.position.set(120, 0, 140);
    courierCar.rotation.y = Math.PI / 2;
    parked.push({ mesh: courierCar, x: 120, z: 140, heading: Math.PI / 2, name: 'Vega Courier', courier: true, stolen: false });
    // Night Shift van — a teal truck parked by the Neon Row gate, the
    // shift's own ride for players who want it.
    const van = makeVehicle(0x2ee8ff, false, 'truck');
    van.position.set(108, 0, 96);
    van.rotation.y = Math.PI;
    parked.push({ mesh: van, x: 108, z: 96, heading: Math.PI, name: 'Night Courier Van', courier: false, stolen: false });
  }

  // ---------- pedestrians: three body types, varied dress ----------
  function makeWalker(x, z, shirt) {
    const g = new THREE.Group();
    const build = chance(rng, 0.3) ? 'tall' : chance(rng, 0.35) ? 'stocky' : 'slim';
    const bw = build === 'stocky' ? 0.95 : build === 'tall' ? 0.7 : 0.6;
    const bh = build === 'tall' ? 1.15 : build === 'stocky' ? 0.9 : 1.0;
    const body = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.42), paint(shirt));
    body.position.y = 0.5 + bh / 2; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), paint(pick(rng, SKINS)));
    head.position.y = 0.5 + bh + 0.32; g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.31, 8, 6), paint(pick(rng, HAIR)));
    hair.position.set(0, 0.5 + bh + 0.4, -0.05); hair.scale.set(1, 0.7, 1); g.add(hair);
    if (chance(rng, 0.3)) {
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.5), paint(pick(rng, NEON)));
      cap.position.set(0, 0.5 + bh + 0.62, 0); g.add(cap);
    }
    const legs = new THREE.Mesh(new THREE.BoxGeometry(bw * 0.8, 0.5, 0.4),
      paint(pick(rng, [0x3a4148, 0x2a3f4a, 0x6a4a3a, 0x22303a])));
    legs.position.y = 0.25; g.add(legs);
    g.position.set(x, 0, z);
    g.userData.build = build;
    scene.add(g);
    return g;
  }
  {
    for (let i = 0; i < DENSITY.walkers; i++) {
      const road = pick(rng, GRID);
      const t = -180 + rng() * 340;
      const mesh = makeWalker(road + 12 + (chance(rng, 0.5) ? 0 : 2), t, pick(rng, SHIRTS));
      walkers.push({ mesh, x: mesh.position.x, z: mesh.position.z, heading: rng() * TAU, speed: 1.2 + rng() * 1.4, down: false, downT: 0, road });
    }
    danny = makeWalker(-120, 120, 0x2a9d8f);
    danny.scale.setScalar(1.05);
    walkers.push({ mesh: danny, x: -120, z: 120, heading: 0, speed: 0, down: false, downT: 0, danny: true });
  }

  // ---------- police helicopter ----------
  function makeHeli() {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.8, 6.5), paint(0x1a2a33));
    body.position.y = 0; body.castShadow = true; g.add(body);
    const glass = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 2.2), paint(0x9adbe8, { emissive: 0x2a6a7a, emissiveIntensity: 0.5 }));
    glass.position.set(0, 0.2, 2.6); g.add(glass);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 6), paint(0x1a2a33));
    tail.position.set(0, 0.4, -6); g.add(tail);
    const skidL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 5), paint(0x3a4148));
    skidL.position.set(-1.2, -1.3, 0.5); g.add(skidL);
    const skidR = skidL.clone(); skidR.position.x = 1.2; g.add(skidR);
    const rotor = new THREE.Mesh(new THREE.BoxGeometry(11, 0.12, 0.7), paint(0x111111));
    rotor.position.y = 1.4; g.add(rotor);
    const rotor2 = rotor.clone(); rotor2.rotation.y = Math.PI / 2; g.add(rotor2);
    g.userData.rotor = rotor; g.userData.rotor2 = rotor2;
    // Searchlight: a real spotlight plus a visible cone so the beam
    // reads in screenshots even where the light pool does not.
    const beam = new THREE.Mesh(
      new THREE.ConeGeometry(4.5, 42, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
    );
    beam.position.y = -21; g.add(beam);
    const spot = new THREE.SpotLight(0xfff2b0, 3.2, 90, 0.32, 0.45, 1.2);
    spot.position.set(0, -1, 0);
    g.add(spot);
    g.userData.spot = spot;
    g.userData.beam = beam;
    scene.add(g);
    return g;
  }

  // ---------- pistol pickup + waypoint beacon + courier marker ----------
  const pistolPickup = new THREE.Group();
  {
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.7), paint(0x2e3438));
    c.position.y = 0.4; pistolPickup.add(c);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.2, 0.9), paint(0xffd34d, { emissive: 0xffd34d, emissiveIntensity: 1.4 }));
    glow.position.y = 0.75; pistolPickup.add(glow);
    pistolPickup.position.set(-128, 0, -128);
    scene.add(pistolPickup);
  }
  const beacon = new THREE.Group();
  {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 90, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
    pillar.position.y = 45; beacon.add(pillar);
    const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(1.6), paint(0xffd34d, { emissive: 0xffd34d, emissiveIntensity: 1 }));
    diamond.position.y = 8; beacon.add(diamond);
    beacon.userData.diamond = diamond;
    scene.add(beacon);
  }
  // Courier marker: cyan, so a Night Shift job never reads as a
  // mission waypoint. Same shape language (pillar + spinning diamond)
  // in a different colour, plus a ground ring marking the arrival spot.
  function makeCourierMarker() {
    const g = new THREE.Group();
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 70, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0x2ee8ff, transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }));
    pillar.position.y = 35; g.add(pillar);
    const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(1.5), paint(0x2ee8ff, { emissive: 0x2ee8ff, emissiveIntensity: 1.2 }));
    diamond.position.y = 7; g.add(diamond);
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.2, 4.2, 24),
      new THREE.MeshBasicMaterial({ color: 0x2ee8ff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.08; g.add(ring);
    g.userData.diamond = diamond;
    g.userData.ring = ring;
    g.visible = false;
    scene.add(g);
    return g;
  }
  const courierMarker = makeCourierMarker();

  return {
    root, solids, facades, palmCrowns, traffic, parked, walkers, police,
    neonMeshes, lampGlows, courierCar, danny, pistolPickup, beacon,
    courierMarker, docks,
    pushOut, makeVehicle, makeWalker, spawnTraffic, makeHeli,
  };
}
