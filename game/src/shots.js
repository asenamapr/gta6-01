// SOLARA BAY — deterministic screenshot staging. Round 4 rewrite.
// Each shot is a different system, staged so it reads instantly at
// thumbnail size, HUD and minimap visible in every frame. The game
// freezes its simulation while a shot is staged (normal play is
// untouched): traffic, police, the helicopter and Mara hold exactly
// the pose this file sets, and the camera is rebuilt from that pose
// every frame instead of drifting on the follow lerp.
//
//   ?shot=start&seed=1  title over the bay skyline at golden hour
//   ?shot=chase&seed=1  bridge chase, 4 stars, police + helicopter
//   ?shot=play&seed=1   on-foot in Neon Row as the signs light up
//   ?shot=end&seed=1    Night Shift: courier job in Neon Row at night
'use strict';

import { SHIRTS, NIGHT_HOUR, pick } from './config.js';

// Pure staging data: where Mara, the car, the police, the helicopter
// and the crowd stand, and what the HUD should say. main.js applies
// it; nothing here touches the DOM or the renderer, so the staging
// stays testable on its own.
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
    // On the bridge deck, heading south toward Gull Island: open sky
    // and water on both sides, no building canyon, police in frame
    // behind, helicopter overhead with its searchlight on the car.
    return {
      mode: 'chase',
      camera: { dist: 24, height: 10, lookAhead: 26 },
      playerCar: { x: 0, z: 196, heading: 0, speed: 24 },
      wanted: 4, missionIndex: 5, stepIndex: 1, cash: 5500,
      police: [
        { x: -4, z: 186, heading: 0, speed: 26 },
        { x: 4, z: 188, heading: 0, speed: 26 },
        { x: 0, z: 190, heading: 0, speed: 24 },
      ],
      heli: { x: 10, y: 24, z: 214 },
      trafficAhead: [
        { x: -3, z: 232, heading: 0 },
        { x: 4, z: 248, heading: 0 },
      ],
      showStartOverlay: false,
    };
  }
  if (shot === 'play') {
    // Neon Row, east side: Mara on foot on the 120 road facing north
    // up the neon strip, crowd around her, signs lit. The camera sits
    // on the road itself, never inside a building.
    return {
      mode: 'play',
      camera: { dist: 10.5, height: 5.2, lookAhead: 5 },
      player: { x: 120, z: 62, heading: Math.PI },
      missionIndex: 0, stepIndex: 0, cash: 0, wanted: 0,
      hasPistol: true, ammo: 12,
      dusk: 0.85,
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
    // Night Shift, the Round 4 system: full night, Mara in the Night
    // Courier Van on the 120 road in Neon Row, a courier job live —
    // cyan marker at the Starfish Casino, job HUD showing the timer,
    // payout and streak. The camera looks north up the lit strip.
    return {
      mode: 'night',
      camera: { dist: 15, height: 7, lookAhead: 14 },
      playerCar: { x: 120, z: 46, heading: Math.PI, speed: 0 },
      missionIndex: 6, stepIndex: 0, cash: 12480, wanted: 0,
      dusk: 1,
      job: {
        phase: 'pickup', spot: 'STARFISH CASINO', x: 120, z: -40,
        dest: 'PALM COURT', dx: -120, dz: 120,
        payout: 1480, timer: 87, streak: 3, jobsDone: 7, nightScore: 9630,
      },
      banner: { title: 'NIGHT SHIFT', text: 'Courier job 8 \u2014 Starfish Casino \u2192 Palm Court \u00b7 $1,480 \u00b7 streak 3' },
      showStartOverlay: false,
    };
  }
  return null;
}

// Applies a staging plan to the live world. Kept in this file so
// main.js never has to know where a shot puts anything.
export function applyShotSetup(setup, ctx) {
  const { state, player, world, camera, pickRng } = ctx;
  state.started = true;
  state.missionIndex = setup.missionIndex;
  state.stepIndex = setup.stepIndex;
  state.cash = setup.cash || 0;
  state.wanted = setup.wanted || 0;
  if (setup.dusk !== undefined) state.duskOverride = setup.dusk;

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
    if (setup.heli) ctx.placeHeli(setup.heli.x, setup.heli.y, setup.heli.z);
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
      const mesh = world.makeWalker(setup.player.x + c.dx, setup.player.z + c.dz, pick(pickRng, SHIRTS));
      world.walkers.push({
        mesh, x: setup.player.x + c.dx, z: setup.player.z + c.dz,
        heading: pickRng() * Math.PI * 2, speed: 1.4, down: false, downT: 0, road: 150,
      });
    });
    return;
  }
  if (setup.mode === 'night') {
    // Night Shift staging: Mara in the teal Night Courier Van, a live
    // courier job with its cyan marker at the pickup, full night.
    state.nightShift = true;
    state.time = NIGHT_HOUR;
    state.nightScore = setup.job.nightScore;
    state.jobsDone = setup.job.jobsDone;
    state.streak = setup.job.streak;
    const van = world.parked.find((p) => p.name === 'Night Courier Van');
    if (van) ctx.enterCarSilent(van);
    else {
      const pk = world.parked.find((p) => !p.stolen);
      if (pk) ctx.enterCarSilent(pk);
    }
    state.car.mesh.position.set(setup.playerCar.x, 0, setup.playerCar.z);
    state.car.heading = setup.playerCar.heading;
    state.car.speed = setup.playerCar.speed;
    state.speed = 0;
    state.job = {
      active: true,
      phase: setup.job.phase,
      spot: setup.job.spot,
      x: setup.job.x, z: setup.job.z,
      dest: setup.job.dest, dx: setup.job.dx, dz: setup.job.dz,
      payout: setup.job.payout, timer: setup.job.timer,
      streak: setup.job.streak,
    };
    ctx.placeJobMarker(setup.job.x, setup.job.z);
    return;
  }
}
