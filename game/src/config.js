// SOLARA BAY — tuning, palettes and the six-mission story.
// Round 4 rewrite. One home for every number the world builder, the
// shot stager and the game loop share, so a balance tweak is made once
// and lands everywhere. The palette does not move: golden-hour dusk,
// low sun, teal water, pink-orange sky — the direction from the start.
// New in this round: the Night Shift courier system (see below) —
// named pickup spots, payout and timer tuning, streak rules.
'use strict';

export const HALF = 200;        // city half-extent along x
export const SHORE = 180;       // land ends here; the bay begins
export const GRID = [-160, -120, -80, -40, 0, 40, 80, 120, 160];
export const SAVE_KEY = 'solara-bay-save-v3';
export const TAU = Math.PI * 2;

// The sun sits near 5 degrees above the horizon at 18:42; every hour
// of game time after that deepens the dusk until Neon Row lights up.
export const DUSK_START = 18.7;
export const NIGHT_HOUR = 21.0;

export const PASTEL = [
  0xffb3a0, 0x7fd8c8, 0xffd9a0, 0xf2f0e4,
  0x9adbe8, 0xff9d8a, 0xc9e8b8, 0xf7c8d8, 0xffc46b, 0x8fd0e8,
];
export const PAINT = [
  0xff7a5c, 0x2a9d8f, 0xffd34d, 0xf2f0e4, 0x5fb3a8,
  0xe86a92, 0x4a7ab8, 0xffb3a0, 0x8a6fd8, 0x3a4148, 0xff9d2e, 0x7a9e4a,
];
export const CAR_NAMES = [
  'Coral GT', 'Bay Cruiser', 'Sunset Coupe', 'Palm Sedan',
  'Harbor Hatch', 'Tide Runner', 'Dusk Coupe', 'Marina GT',
];
export const SHIRTS = [
  0xffd34d, 0x7fd8c8, 0xe86a92, 0xf2f0e4, 0x9adbe8,
  0xff9d8a, 0xc9e8b8, 0xff7a5c, 0x4a7ab8, 0xffffff, 0x2a9d8f, 0xffb3a0,
];
export const SKINS = [0xd9a583, 0xc98d64, 0x8a5a3b, 0xf0c8a0];
export const HAIR = [0x2a1a12, 0x4a2a12, 0x111111, 0x8a6a4d, 0xd8d8d8];
export const NEON = [0xff2e88, 0x2ee8ff, 0xffd34d, 0x7dff5c, 0xb46bff, 0xff7a5c];

// Traffic mix: mostly sedans, with slower trucks and long buses that
// hit harder and shove back less when you hit them.
export const VEHICLE_KINDS = ['sedan', 'sedan', 'sedan', 'sedan', 'truck', 'bus'];
export const VEHICLE_STATS = {
  sedan: { length: 4.6, width: 2.1, cruise: 8, top: 15, mass: 1 },
  truck: { length: 7.2, width: 2.4, cruise: 6, top: 11, mass: 2.2 },
  bus:   { length: 9.4, width: 2.6, cruise: 5, top: 10, mass: 2.8 },
};

export const DENSITY = {
  traffic: 48,
  parked: 26,
  walkers: 64,
  palms: 170,
  lampGap: 40,
  benches: 36,
  neonSigns: 14,
};

// Neon Row: the casino strip on the east side, along the 120 road
// between the cross streets at -40 and 80. Dusk turns its signs on.
export const NEON_ROW = { x: 120, zMin: -40, zMax: 80, name: 'NEON ROW' };

// ------------------------------------------------------------------
// NIGHT SHIFT — the courier job system, unlocked after mission 6.
// The city stays in full night, neon and lamps on everywhere. Jobs
// chain: finish one and the next spawns. Each job is a pickup, then a
// drop-off, against a timer; the payout is in-game cash, and a streak
// multiplier rewards back-to-back deliveries. Missing a timer forfeits
// that job's payout and resets the streak, but the shift goes on.
// ------------------------------------------------------------------
export const NIGHT_JOB_SPOTS = [
  { name: 'STARFISH CASINO', x: 120, z: -40 },
  { name: 'REEF\u2019S GARAGE', x: -140, z: -140 },
  { name: 'SOLARA TRUST', x: 40, z: -40 },
  { name: 'PALM COURT', x: -120, z: 120 },
  { name: 'CORAL COURT', x: 120, z: -120 },
  { name: 'GULL ISLAND DOCK', x: 14, z: 306 },
  { name: 'BEACH BOULEVARD', x: -160, z: 160 },
  { name: 'NEON ROW GATE', x: 120, z: 80 },
  { name: 'HARBOR BRIDGE', x: 0, z: 235 },
  { name: 'MARINA WEST', x: -160, z: -160 },
];
export const NIGHT_JOB = {
  basePay: 220,          // flat part of every payout
  payPerMetre: 6,        // payout grows with the pickup-to-drop distance
  payPerStreak: 40,      // extra per job in the current streak
  pickupRadius: 7,       // how close to count as "arrived"
  dropRadius: 8,
  timeBase: 55,          // seconds before distance is added
  timePerMetre: 0.45,    // extra seconds per metre of the leg
  timeMin: 45,
  timeMax: 150,
  betweenJobs: 3,        // seconds of quiet before the next job spawns
};

export const MISSIONS = [
  {
    name: '1. THE CALL',
    intro: 'Vega\u2019s fixer wants to meet. Drive to Coral Court \u2014 and shake the tail.',
    steps: [
      { type: 'goto', x: 120, z: -120, text: 'Drive to the meet at Coral Court', needCar: true, label: 'CORAL COURT' },
      { type: 'survive', seconds: 18, text: 'Lose the tail \u2014 stay clear of the police for 18 seconds', wanted: 1, label: 'LOSE THE TAIL' },
    ],
    reward: 1500,
  },
  {
    name: '2. HARBOR LIGHTS',
    intro: 'A Vega courier car is parked by the harbor. Take it \u2014 quietly, or not.',
    steps: [
      { type: 'steal', text: 'Steal the gold Vega courier car by the harbor', label: 'VEGA COURIER' },
      { type: 'goto', x: -160, z: -160, text: 'Deliver the courier car to Reef\u2019s Garage', needCar: true, label: 'REEF\u2019S GARAGE' },
    ],
    reward: 4000,
  },
  {
    name: '3. TOLL OF THE BAY',
    intro: 'The bridge is the only way across. Vega\u2019s boys tipped off the cops \u2014 2 stars, no stopping.',
    steps: [
      { type: 'goto', x: 0, z: 235, text: 'Cross the harbor bridge to Gull Island', needCar: true, wanted: 2, label: 'HARBOR BRIDGE' },
      { type: 'goto', x: -120, z: 120, text: 'Get back across \u2014 lose them on Palm Court', needCar: true, label: 'PALM COURT' },
    ],
    reward: 6000,
  },
  {
    name: '4. REEF\u2019S RUN',
    intro: 'Danny is hiding at Palm Court and the cops are circling. Pick him up. Three stars.',
    steps: [
      { type: 'pickup', x: -120, z: 120, text: 'Pick up Danny at Palm Court (walk up to him)', label: 'DANNY' },
      { type: 'goto', x: -140, z: -140, text: 'Get Danny to Reef\u2019s Garage \u2014 3 stars on your tail', needCar: true, wanted: 3, label: 'REEF\u2019S GARAGE' },
    ],
    reward: 9000,
  },
  {
    name: '5. ONE LAST DRIVE',
    intro: 'Solara Trust, 19:00. Take what Vega owes Danny, then run for the boat. Your choice at the end.',
    steps: [
      { type: 'goto', x: 40, z: -8, text: 'Reach Solara Trust bank downtown', needCar: false, label: 'SOLARA TRUST' },
      { type: 'interact', x: 40, z: -8, text: 'Walk to the bank doors and press E \u2014 grab the bag', label: 'THE VAULT' },
      { type: 'goto', x: 14, z: 306, text: 'Escape to the boat on Gull Island \u2014 4 stars, everything on the line', needCar: false, wanted: 4, label: 'THE BOAT' },
      { type: 'choice', text: 'The money is in the bag. Danny is free \u2014 if you pay.', label: 'THE CHOICE' },
    ],
    reward: 40000,
  },
  {
    name: '6. THE LONG WAY HOME',
    intro: 'The choice is made, but Vega\u2019s crew is already on the bridge. Night has fallen. Outrun them across the harbor \u2014 the long way home.',
    steps: [
      { type: 'goto', x: 0, z: 235, text: 'Fight through to the harbor bridge \u2014 5 stars, helicopter overhead', needCar: true, wanted: 5, label: 'HARBOR BRIDGE' },
      { type: 'survive', seconds: 20, text: 'Outrun the Vega crew \u2014 stay ahead for 20 seconds', wanted: 5, label: 'OUTRUN THEM' },
      { type: 'goto', x: 14, z: 306, text: 'Reach the boat on Gull Island and go home', needCar: false, label: 'THE BOAT' },
    ],
    reward: 10000,
  },
];

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function damp(a, b, lambda, dt) { return lerp(a, b, 1 - Math.exp(-lambda * dt)); }
export function angDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
export function chance(rng, p) { return rng() < p; }
export function dist2d(ax, az, bx, bz) { return Math.hypot(ax - bx, az - bz); }
export function fmtClock(seconds) {
  const s = Math.max(0, Math.ceil(seconds));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
