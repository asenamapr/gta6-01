// SOLARA BAY — the city itself: ground, buildings, skyline, props,
// harbor bridge, cars, pedestrians and the waypoint beacon.
// Written in this revision pass. Density is the point: taller downtown
// towers with varied heights, a distant skyline silhouette, a waterfront
// row, far more palms, lamps, billboards and parked cars, and almost
// twice the traffic and pedestrians of the first build.
'use strict';

import {
  CITY, SOUTH, ROADS, TAU, DENSITY, PASTEL, CAR_COLORS, CAR_NAMES, PED_COLORS, pick,
} from './config.js';

export function buildWorld(scene, rng) {
  const colliders = [];
  const buildingRects = [];
  const palmTops = [];
  const traffic = [];
  const parked = [];
  const peds = [];
  const police = [];
  let courierCar = null;
  let dannyPed = null;

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
  function box(w, h, d, color, x, y, z, opts, noShadow) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
    m.position.set(x, y, z);
    if (!noShadow) { m.castShadow = true; m.receiveShadow = true; }
    world.add(m);
    return m;
  }

  // ---- ground: land, asphalt, roads, bay, beach ----
  (function ground() {
    const land = new THREE.Mesh(new THREE.BoxGeometry(CITY * 2 + 60, 2, SOUTH + CITY + 30), mat(0x8f9a8a));
    land.position.set(0, -1, -10); land.receiveShadow = true; world.add(land);
    const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(CITY * 2, SOUTH + CITY), mat(0x7d8478));
    asphalt.rotation.x = -Math.PI / 2; asphalt.position.set(0, 0.02, -10); asphalt.receiveShadow = true; world.add(asphalt);
    const roadMat = mat(0x3a4148);
    for (const r of ROADS) {
      const sx = new THREE.Mesh(new THREE.PlaneGeometry(13, SOUTH + CITY), roadMat);
      sx.rotation.x = -Math.PI / 2; sx.position.set(r, 0.04, -10); sx.receiveShadow = true; world.add(sx);
      const sz = new THREE.Mesh(new THREE.PlaneGeometry(CITY * 2, 13), roadMat);
      sz.rotation.x = -Math.PI / 2; sz.position.set(0, 0.04, r); sz.receiveShadow = true; world.add(sz);
    }
    const water = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400), mat(0x1e7d8c, { transparent: true, opacity: 0.92 }));
    water.rotation.x = -Math.PI / 2; water.position.set(-100, -0.4, 260); world.add(water);
    const beach = new THREE.Mesh(new THREE.PlaneGeometry(CITY * 2, 26), mat(0xe8cf9e));
    beach.rotation.x = -Math.PI / 2; beach.position.set(0, 0.05, SOUTH - 8); beach.receiveShadow = true; world.add(beach);
    const beachW = new THREE.Mesh(new THREE.PlaneGeometry(26, SOUTH + CITY), mat(0xe8cf9e));
    beachW.rotation.x = -Math.PI / 2; beachW.position.set(-CITY + 2, 0.05, -10); beachW.receiveShadow = true; world.add(beachW);
    const lineGeo = new THREE.BoxGeometry(0.7, 0.06, 6);
    const lineMat = mat(0xf5e9c8);
    for (const r of ROADS) {
      for (let t = -190; t <= 170; t += 16) {
        const a = new THREE.Mesh(lineGeo, lineMat); a.position.set(r, 0.06, t); world.add(a);
        const b = new THREE.Mesh(lineGeo, lineMat); b.position.set(t, 0.06, r); world.add(b);
      }
    }
    // crosswalks at the downtown intersections
    const walkMat = mat(0xf2f0e4);
    for (const rx of [-40, 0, 40]) {
      for (const rz of [-40, 0, 40]) {
        for (let i = -2; i <= 2; i++) {
          const s = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 5), walkMat);
          s.position.set(rx + i * 2.4, 0.06, rz + 9); world.add(s);
        }
      }
    }
  })();

  // ---- buildings: pastel towers downtown, low blocks elsewhere ----
  (function city() {
    const winMat = mat(0x2a3f4a, { emissive: 0xffc37a, emissiveIntensity: 0.55 });
    const winMat2 = mat(0x2a4a3f, { emissive: 0x7ef0d4, emissiveIntensity: 0.4 });
    for (let ix = 0; ix < ROADS.length - 1; ix++) {
      for (let iz = 0; iz < ROADS.length - 1; iz++) {
        const cx = (ROADS[ix] + ROADS[ix + 1]) / 2;
        const cz = (ROADS[iz] + ROADS[iz + 1]) / 2;
        if (cz > 150) continue;
        const downtown = Math.abs(cx) < 90 && Math.abs(cz) < 90;
        const nearDowntown = Math.abs(cx) < 130 && Math.abs(cz) < 130;
        const n = downtown ? (rng() < 0.55 ? 2 : 1) : (rng() < 0.6 ? 2 : 1);
        for (let k = 0; k < n; k++) {
          const w = downtown ? 17 + rng() * 7 : 12 + rng() * 5;
          const d = downtown ? 17 + rng() * 7 : 12 + rng() * 5;
          const h = downtown ? 42 + rng() * 62 : nearDowntown ? 14 + rng() * 26 : 9 + rng() * 18;
          const ox = n === 2 ? (k === 0 ? -8 : 8) : 0;
          const oz = n === 2 ? (k === 0 ? -8 : 8) : 0;
          const bx = cx + ox, bz = cz + oz;
          if (Math.abs(bx) > 185 || bz > 165 || bz < -185) continue;
          const color = pick(rng, PASTEL);
          box(w, h, d, color, bx, h / 2, bz);
          box(w + 0.6, 1.2, d + 0.6, 0xffffff, bx, h + 0.4, bz);
          // rooftop AC boxes so flat roofs read as roofs, not slabs
          box(3, 1.6, 3, 0x9aa4a8, bx - w / 4, h + 1.6, bz - d / 4);
          box(2.4, 1.2, 2.4, 0x7a8a90, bx + w / 4, h + 1.4, bz + d / 4);
          const wm = rng() < 0.5 ? winMat : winMat2;
          const winH = Math.min(h * 0.5, 12);
          const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, winH, 0.4), wm);
          win.position.set(bx, h * 0.55, bz + d / 2 + 0.25); world.add(win);
          const win2 = win.clone(); win2.position.z = bz - d / 2 - 0.25; world.add(win2);
          const win3 = new THREE.Mesh(new THREE.BoxGeometry(0.4, winH, d * 0.82), wm);
          win3.position.set(bx + w / 2 + 0.25, h * 0.55, bz); world.add(win3);
          addCollider(bx, bz, w / 2 + 0.4, d / 2 + 0.4);
          buildingRects.push({ x: bx, z: bz, w, d, h });
          if (downtown && rng() < 0.5) box(3, 10, 3, 0xff7a5c, bx, h + 6, bz);
          if (downtown && rng() < 0.3) box(w * 0.5, 6, d * 0.5, color, bx, h + 3.5, bz); // stepped crown
        }
      }
    }
    // Distant skyline silhouette behind the city, north edge: tall muted
    // towers that make the horizon read as a real city from the beach.
    for (let i = 0; i < 20; i++) {
      const x = -260 + i * 27 + rng() * 10;
      const h = 55 + rng() * 75;
      const w = 16 + rng() * 10;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 16), mat(pick(rng, PASTEL), { color: pick(rng, PASTEL) }));
      m.position.set(x, h / 2, -235 - rng() * 45);
      world.add(m);
      buildingRects.push({ x, z: m.position.z, w, d: 16, h, distant: true });
    }
    // Waterfront row: low art-deco shops along the beach, awnings included.
    for (let x = -170; x <= 170; x += 42) {
      const h = 8 + rng() * 6;
      const color = pick(rng, PASTEL);
      box(22, h, 12, color, x, h / 2, 156);
      box(23, 1, 13, 0xffffff, x, h + 0.4, 156);
      box(22, 1.4, 4, 0xff7a5c, x, h * 0.45, 156 + 7); // awning stripe
      addCollider(x, 156, 12, 7);
      buildingRects.push({ x, z: 156, w: 22, d: 12, h });
    }
    // Solara Trust bank (mission 5) — coral tower with gold trim
    box(30, 46, 30, 0xff7a5c, 40, 23, -40);
    box(32, 2, 32, 0xffd34d, 40, 47, -40);
    box(20, 8, 2, 0xffd34d, 40, 30, -40 + 16); // bank sign band
    addCollider(40, -40, 16, 16);
    buildingRects.push({ x: 40, z: -40, w: 30, d: 30, h: 46 });
    // Reef's Garage (start / safehouse) — teal low block
    box(24, 10, 18, 0x2a9d8f, -140, 5, -140);
    box(25, 1.2, 19, 0xffd34d, -140, 10.6, -140);
    addCollider(-140, -140, 13, 10);
    buildingRects.push({ x: -140, z: -140, w: 24, d: 18, h: 10 });
  })();

  // ---- palms, lamps, benches, billboards, traffic lights ----
  (function props() {
    const trunkMat = mat(0x8a6a4d);
    const leafMat = mat(0x3fae7a);
    const leafMat2 = mat(0x57c98a);
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 9, 6);
    const leafGeo = new THREE.ConeGeometry(3.2, 4.5, 6);
    for (let i = 0; i < DENSITY.palms; i++) {
      let x, z;
      if (i < 44) { x = -190 + rng() * 380; z = 158 + rng() * 14; }
      else if (i < 64) { x = -188 + rng() * 8; z = -180 + rng() * 330; }
      else if (i < 84) { x = 188 + rng() * 8; z = -180 + rng() * 330; }
      else { const r = pick(rng, ROADS); x = r + 13 + rng() * 4; z = -180 + rng() * 330; }
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.set(x, 4.5, z); trunk.castShadow = true; world.add(trunk);
      const top = new THREE.Mesh(leafGeo, rng() < 0.5 ? leafMat : leafMat2);
      top.position.set(x, 10.5, z); top.castShadow = true; world.add(top);
      palmTops.push(top);
    }
    const poleMat = mat(0x2e3438);
    const lampMat = mat(0xffe9a8, { emissive: 0xffd34d, emissiveIntensity: 0.9 });
    for (const r of ROADS) {
      for (let t = -160; t <= 160; t += DENSITY.lampsEvery) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 8, 5), poleMat);
        pole.position.set(r + 11, 4, t); world.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), lampMat);
        lamp.position.set(r + 11, 8.2, t); world.add(lamp);
        const pole2 = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 8, 5), poleMat);
        pole2.position.set(r - 11, 4, t + 20); world.add(pole2);
        const lamp2 = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), lampMat);
        lamp2.position.set(r - 11, 8.2, t + 20); world.add(lamp2);
      }
    }
    for (let i = 0; i < DENSITY.benches; i++) {
      const r = pick(rng, ROADS);
      box(3.4, 0.5, 1.2, 0x6a4a3a, r + 12, 0.6, -170 + rng() * 320);
    }
    for (let i = 0; i < 12; i++) box(1.2, 1.6, 1.2, 0xffd34d, 150 + rng() * 20, 0.8, -140 + rng() * 280);
    // crates + planters near the harbor
    for (let i = 0; i < 14; i++) box(2, 2, 2, 0x8a6a4d, 100 + rng() * 60, 1, 120 + rng() * 40);
    for (let i = 0; i < 16; i++) box(2.4, 1, 2.4, 0x2a9d8f, pick(rng, ROADS) + 12, 0.5, -160 + rng() * 300);
    // billboards on tall poles — bright teal/coral faces
    const boardColors = [0xff7a5c, 0x2a9d8f, 0xffd34d, 0xe86a92];
    [[-120, -160], [120, -80], [-80, 80], [80, 160]].forEach(([x, z], i) => {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 14, 6), poleMat);
      pole.position.set(x, 7, z); world.add(pole);
      box(16, 7, 0.8, boardColors[i % boardColors.length], x, 17, z);
      box(17, 1, 1.2, 0xffffff, x, 21, z);
    });
    // traffic lights at downtown intersections
    for (const rx of [-40, 0, 40]) {
      for (const rz of [-40, 0, 40]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 7, 5), poleMat);
        pole.position.set(rx + 8, 3.5, rz + 8); world.add(pole);
        const housing = new THREE.Mesh(new THREE.BoxGeometry(1, 2.6, 0.8), mat(0x1a1a1a));
        housing.position.set(rx + 8, 7.4, rz + 8); world.add(housing);
        const light = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6),
          mat((rx + rz) % 80 === 0 ? 0x2dd47a : 0xff4040, { emissive: (rx + rz) % 80 === 0 ? 0x2dd47a : 0xff4040, emissiveIntensity: 1.2 }));
        light.position.set(rx + 8, 7.9, rz + 8.4); world.add(light);
      }
    }
    // beach umbrellas on the sand
    const umbColors = [0xff7a5c, 0x2a9d8f, 0xffd34d];
    for (let i = 0; i < 10; i++) {
      const x = -170 + rng() * 340, z = 168 + rng() * 8;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3, 5), poleMat);
      pole.position.set(x, 1.5, z); world.add(pole);
      const top = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.4, 8), mat(umbColors[i % 3]));
      top.position.set(x, 3.4, z); top.castShadow = true; world.add(top);
    }
  })();

  // ---- harbor bridge to Gull Island ----
  (function bridge() {
    const deck = new THREE.Mesh(new THREE.BoxGeometry(18, 0.4, 120), mat(0x9aa4a8));
    deck.position.set(0, 0.2, 235); deck.receiveShadow = true; world.add(deck);
    box(0.6, 1.4, 120, 0xff7a5c, -8.6, 1.1, 235);
    box(0.6, 1.4, 120, 0xff7a5c, 8.6, 1.1, 235);
    for (let z = 195; z <= 270; z += 25) {
      for (const sx of [-6, 6]) {
        const pil = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 5, 8), mat(0x7a8a90));
        pil.position.set(sx, -2.2, z); world.add(pil);
      }
    }
    const island = new THREE.Mesh(new THREE.BoxGeometry(90, 0.5, 60), mat(0xe8cf9e));
    island.position.set(0, -0.05, 300); island.receiveShadow = true; world.add(island);
    box(4, 0.5, 24, 0x6a4a3a, -14, 0.4, 300);
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(5, 2.4, 12), mat(0xffffff));
    hull.position.y = 1.2; boat.add(hull);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2, 5), mat(0x2a9d8f));
    cab.position.set(0, 3.2, -1); boat.add(cab);
    boat.position.set(14, 0.2, 306); boat.rotation.y = 0.5;
    boat.traverse((o) => { o.castShadow = true; });
    world.add(boat);
    const lh = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.2, 22, 10), mat(0xf2f0e4));
    lh.position.set(-28, 12, 288); lh.castShadow = true; world.add(lh);
    const lhTop = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 3, 10), mat(0xff5c5c, { emissive: 0xffd34d, emissiveIntensity: 1 }));
    lhTop.position.set(-28, 24, 288); world.add(lhTop);
  })();

  // ---- cars ----
  function makeCar(color, isPolice) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.6), mat(isPolice ? 0xf2f0e4 : color));
    body.position.y = 0.65; body.castShadow = true; g.add(body);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 2.3), mat(isPolice ? 0x2e3438 : 0x22303a));
    cab.position.set(0, 1.3, -0.3); cab.castShadow = true; g.add(cab);
    if (isPolice) {
      // black doors band + white body = instantly readable as a cop car,
      // even at thumbnail size; dual red/blue bar flashes in the loop.
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.14, 0.34, 4.64), mat(0x1a1a1a));
      stripe.position.y = 0.55; g.add(stripe);
      const push = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.5, 0.3), mat(0x1a1a1a));
      push.position.set(0, 0.55, 2.4); g.add(push);
      const red = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.32, 0.5), mat(0xff2020, { emissive: 0xff2020, emissiveIntensity: 1.6 }));
      red.position.set(-0.38, 1.85, -0.3); g.add(red);
      const blue = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.32, 0.5), mat(0x2040ff, { emissive: 0x2040ff, emissiveIntensity: 1.6 }));
      blue.position.set(0.38, 1.85, -0.3); g.add(blue);
      g.userData.lightRed = red;
      g.userData.lightBlue = blue;
      g.userData.lightBar = red;
    }
    const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
    const wheelMat = mat(0x14181c);
    const wheels = [];
    [[-1, 1.5], [1, 1.5], [-1, -1.5], [1, -1.5]].forEach(([sx, sz]) => {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.rotation.z = Math.PI / 2; w.position.set(sx * 1.0, 0.42, sz); g.add(w); wheels.push(w);
    });
    g.userData.wheels = wheels;
    const hl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.25, 0.15), mat(0xffe9a8, { emissive: 0xffd34d, emissiveIntensity: 1 }));
    hl.position.set(0, 0.7, 2.32); g.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.25, 0.15), mat(0xff4040, { emissive: 0xff4040, emissiveIntensity: 0.9 }));
    tl.position.set(0, 0.7, -2.32); g.add(tl);
    scene.add(g);
    return g;
  }

  function spawnTrafficCar(x, z, axis, dir) {
    const mesh = makeCar(pick(rng, CAR_COLORS), false);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
    const c = { mesh, axis, dir, speed: 8 + rng() * 7, road: axis === 'x' ? z : x };
    traffic.push(c);
    return c;
  }

  (function seedCars() {
    for (let i = 0; i < DENSITY.trafficCars; i++) {
      const axis = rng() < 0.5 ? 'x' : 'z';
      const road = pick(rng, ROADS);
      const t = -180 + rng() * 340;
      const dir = rng() < 0.5 ? 1 : -1;
      const lane = dir > 0 ? 3 : -3;
      spawnTrafficCar(axis === 'x' ? t : road + lane, axis === 'x' ? road + lane : t, axis, dir);
    }
    for (let i = 0; i < DENSITY.parkedCars; i++) {
      const road = pick(rng, ROADS);
      const t = -170 + rng() * 330;
      const mesh = makeCar(pick(rng, CAR_COLORS), false);
      const x = road + 8, z = t;
      mesh.position.set(x, 0, z);
      mesh.rotation.y = (rng() < 0.5 ? 0 : Math.PI) + (rng() - 0.5) * 0.2;
      parked.push({ mesh, x, z, heading: mesh.rotation.y, name: pick(rng, CAR_NAMES), stolen: false });
    }
    courierCar = makeCar(0xffd34d, false);
    courierCar.position.set(120, 0, 140);
    courierCar.rotation.y = Math.PI / 2;
    parked.push({ mesh: courierCar, x: 120, z: 140, heading: Math.PI / 2, name: 'Vega Courier', courier: true, stolen: false });
  })();

  // ---- pedestrians ----
  const SKINS = [0xd9a583, 0xc98d64, 0x8a5a3b, 0xf0c8a0];
  function makePed(x, z, color) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.42), mat(color));
    body.position.y = 1.0; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), mat(pick(rng, SKINS)));
    head.position.y = 1.75; g.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.31, 8, 6), mat(pick(rng, [0x2a1a12, 0x4a2a12, 0x111111, 0x8a6a4d])));
    hair.position.set(0, 1.82, -0.05); hair.scale.set(1, 0.7, 1); g.add(hair);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.4), mat(pick(rng, [0x3a4148, 0x2a3f4a, 0x6a4a3a, 0x22303a])));
    legs.position.y = 0.4; g.add(legs);
    g.position.set(x, 0, z);
    scene.add(g);
    return g;
  }
  (function seedPeds() {
    for (let i = 0; i < DENSITY.pedestrians; i++) {
      const road = pick(rng, ROADS);
      const t = -180 + rng() * 340;
      const mesh = makePed(road + 12 + (rng() < 0.5 ? 0 : 2), t, pick(rng, PED_COLORS));
      peds.push({ mesh, x: mesh.position.x, z: mesh.position.z, heading: rng() * TAU, speed: 1.2 + rng() * 1.4, down: false, downT: 0, road });
    }
    dannyPed = makePed(-120, 120, 0x2a9d8f);
    dannyPed.scale.setScalar(1.05);
    peds.push({ mesh: dannyPed, x: -120, z: 120, heading: 0, speed: 0, down: false, downT: 0, danny: true });
  })();

  // ---- pistol pickup, waypoint beacon ----
  const pistolPickup = new THREE.Group();
  (function pickup() {
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.5, 0.7), mat(0x2e3438));
    c.position.y = 0.4; pistolPickup.add(c);
    const glow = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.2, 0.9), mat(0xffd34d, { emissive: 0xffd34d, emissiveIntensity: 1.4 }));
    glow.position.y = 0.75; pistolPickup.add(glow);
    pistolPickup.position.set(-128, 0, -128);
    scene.add(pistolPickup);
  })();

  const beacon = new THREE.Group();
  (function beaconBuild() {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 90, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }));
    pillar.position.y = 45; beacon.add(pillar);
    const diamond = new THREE.Mesh(new THREE.OctahedronGeometry(1.6), mat(0xffd34d, { emissive: 0xffd34d, emissiveIntensity: 1 }));
    diamond.position.y = 8; beacon.add(diamond);
    beacon.userData.diamond = diamond;
    scene.add(beacon);
  })();

  return {
    world, colliders, buildingRects, palmTops, traffic, parked, peds, police,
    courierCar, dannyPed, pistolPickup, beacon,
    collideCircle, makeCar, makePed, spawnTrafficCar,
  };
}
