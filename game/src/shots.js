// SOLARA BAY — deterministic screenshot staging.
// Written in this revision pass. Each shot is a different system, staged
// so it reads instantly at thumbnail size, with the HUD and minimap
// visible in every frame. The game freezes its simulation while a shot
// is staged (normal play is untouched): traffic, police and Mara hold
// exactly the pose this file sets, and the camera is rebuilt from that
// pose every frame instead of drifting on the follow lerp.
//
//   ?shot=start&seed=1  title over the bay skyline at golden hour
//   ?shot=chase&seed=1  bridge chase, 3 stars, police right behind
//   ?shot=play&seed=1   on-foot street life on the beach boulevard
//   ?shot=end&seed=1    heist moment on Gull Island, boat + $40,000
'use strict';

import { PED_COLORS, pick } from './config.js';

// Pure staging data: where Mara, the car, the police and the crowd stand,
// and what the HUD should say. main.js applies it; nothing here touches
// the DOM or the renderer, so the staging stays testable on its own.
export function getShotSetup(shot) {
  if (shot === 'start') {
    return {
      mode: 'start',
      camera: { x: 62, y: 46, z: 238, lookX: 0, lookY: 26, lookZ: -70 },
      missionIndex: 0, stepIndex: 0, cash: 0, wanted: 0,
      showStartOverlay: true,
    };
  }
  if (shot === 'chase') {
    // On the bridge deck, heading south toward Gull Island: open sky and
    // water on both sides, no building canyon, police in frame behind.
    return {
      mode: 'chase',
      camera: { dist: 24, height: 10, lookAhead: 26 },
      playerCar: { x: 0, z: 196, heading: 0, speed: 24 },
      wanted: 3, missionIndex: 2, stepIndex: 0, cash: 5500,
      police: [
        { x: -4, z: 186, heading: 0, speed: 26 },
        { x: 4, z: 188, heading: 0, speed: 26 },
        { x: 0, z: 190, heading: 0, speed: 24 },
      ],
      trafficAhead: [
        { x: -3, z: 232, heading: 0 },
        { x: 4, z: 248, heading: 0 },
      ],
      showStartOverlay: false,
    };
  }
  if (shot === 'play') {
    // Beach boulevard: Mara on foot ON road 40 facing north up the palm
    // row, crowd around her. (Never on a block: the waterfront shops at
    // z=156 fill the frame if the camera sits inside one — the old shot
    // was a flat wall for exactly that reason.)
    return {
      mode: 'play',
      camera: { dist: 10.5, height: 5.2, lookAhead: 5 },
      player: { x: 40, z: 140, heading: Math.PI },
      missionIndex: 0, stepIndex: 0, cash: 0, wanted: 0,
      hasPistol: true, ammo: 12,
      crowd: [
        { dx: -4, dz: -8 }, { dx: 3, dz: -10 }, { dx: 7, dz: -6 },
        { dx: -8, dz: -4 }, { dx: 9, dz: -12 }, { dx: -2, dz: -14 },
        { dx: 5, dz: -16 }, { dx: -6, dz: -16 }, { dx: 1, dz: -20 },
        { dx: -11, dz: -10 }, { dx: 12, dz: -8 }, { dx: 0, dz: -24 },
      ],
      showStartOverlay: false,
    };
  }
  if (shot === 'end') {
    // Gull Island dock, Mara facing north toward the camera with the
    // city skyline and the bridge behind her; the boat sits to her left,
    // never between her and the camera.
    return {
      mode: 'end',
      camera: { x: 8, y: 4.5, z: 311, lookX: 8, lookY: 2.5, lookZ: 296 },
      player: { x: 8, z: 296, heading: 0 },
      missionIndex: 5, stepIndex: 0, cash: 40000, wanted: 0,
      banner: { title: 'MISSION COMPLETE', text: '5. ONE LAST DRIVE \u2014 +$40,000' },
      showStartOverlay: false,
    };
  }
  return null;
}

// Applies a staging plan to the live world. Kept in this file so main.js
// never has to know where a shot puts anything.
export function applyShotSetup(setup, ctx) {
  const { state, player, world, camera, pickRng } = ctx;
  state.started = true;
  state.missionIndex = setup.missionIndex;
  state.stepIndex = setup.stepIndex;
  state.cash = setup.cash || 0;
  state.wanted = setup.wanted || 0;

  if (setup.mode === 'start') {
    camera.position.set(setup.camera.x, setup.camera.y, setup.camera.z);
    camera.lookAt(setup.camera.lookX, setup.camera.lookY, setup.camera.lookZ);
    return;
  }
  if (setup.mode === 'chase') {
    const pk = world.parked.find((p) => !p.stolen);
    if (pk) ctx.enterCarSilent(pk);
    state.car.mesh.position.set(setup.playerCar.x, 0, setup.playerCar.z);
    state.car.heading = setup.playerCar.heading;
    state.car.speed = setup.playerCar.speed;
    state.speed = Math.abs(setup.playerCar.speed) * 2.2;
    while (world.police.length < setup.police.length) ctx.spawnPolice();
    setup.police.forEach((pos, i) => {
      const po = world.police[i];
      if (!po) return;
      po.mesh.position.set(pos.x, 0, pos.z);
      po.heading = pos.heading;
      po.speed = pos.speed;
    });
    setup.trafficAhead.forEach((pos, i) => {
      const t = world.traffic[i];
      if (!t) return;
      t.mesh.position.set(pos.x, 0, pos.z);
      t.mesh.rotation.y = pos.heading;
      t.axis = 'z'; t.dir = 1; t.speed = 10;
    });
    return;
  }
  if (setup.mode === 'play') {
    player.x = setup.player.x;
    player.z = setup.player.z;
    player.heading = setup.player.heading;
    player.mesh.position.set(player.x, 0, player.z);
    state.hasPistol = true;
    state.ammo = setup.ammo;
    setup.crowd.forEach((c) => {
      const mesh = world.makePed(setup.player.x + c.dx, setup.player.z + c.dz, pick(pickRng, PED_COLORS));
      world.peds.push({
        mesh, x: setup.player.x + c.dx, z: setup.player.z + c.dz,
        heading: pickRng() * Math.PI * 2, speed: 1.4, down: false, downT: 0, road: 150,
      });
    });
    return;
  }
  if (setup.mode === 'end') {
    player.x = setup.player.x;
    player.z = setup.player.z;
    player.heading = setup.player.heading;
    player.mesh.position.set(player.x, 0, player.z);
    camera.position.set(setup.camera.x, setup.camera.y, setup.camera.z);
    camera.lookAt(setup.camera.lookX, setup.camera.lookY, setup.camera.lookZ);
    return;
  }
}
