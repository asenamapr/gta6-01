// SOLARA BAY — missions 7 and 8: Act II, Port Solara (Round 5).
//
// After mission 6 the Night Shift unlocks and the city stays in full
// night — but the story is not over. Vega lost the courier car, the
// bridge toll and the bank bag, and the family does not forgive a
// driver who walks away. Act II moves the fight to the docks: a
// smuggling run through Port Solara (mission 7), then the finale
// (mission 8) — Danny is on the pier, five stars are on Mara, and
// the $40,000 debt comes due one last time, payable now out of
// everything Mara has built, businesses included.
//
// These two missions use the same step shapes the mission engine in
// main.js already understands (goto / steal / pickup / interact /
// survive / choice), so no new step type was needed — only new
// places, new stakes and a new ending. The finale choice is routed
// separately from mission 5's choice: paying Vega here ends the debt
// for good, keeping the money ends the story with Mara owning the
// bay outright.
'use strict';

import { DOCK_SPOTS } from './config.js';

// Danny's debt to the Vega family. It has been $40,000 since the
// start screen; mission 8 is the night Mara can finally clear it.
export const DANNY_DEBT = 40000;

// The docks run is a chain across five named spots in Port Solara.
// Each leg is one mission step; the spots are shared with the world
// builder so the crates, the warehouse door and the pier end are the
// same coordinates in the mission text and on the ground.
export const SMUGGLE_SPOTS = DOCK_SPOTS;

export const MISSIONS_2 = [
  {
    name: '7. HARBOR LIGHTS II — THE DOCKS RUN',
    intro: 'Vega lost the courier car, so now they move product through the port — and they want Mara to drive it. One run through Port Solara, no questions, big money. Or walk away and let Danny pay for it.',
    steps: [
      {
        type: 'goto', x: 186, z: 196,
        text: 'Get to the Port Solara gate — night shift, no headlights',
        needCar: false, label: 'DOCKS GATE',
        tip: 'The gate is on the east edge of the bay, past the beach. Walk or drive — just don\u2019t bring heat.',
      },
      {
        type: 'interact', x: 186, z: 224,
        text: 'Walk to Warehouse 7 and press E — grab the manifest',
        label: 'WAREHOUSE 7',
        tip: 'The manifest is the run: five drops, one night. It also tells you which crates are yours.',
      },
      {
        type: 'steal',
        text: 'Take the Dock Hauler — the only truck that fits the manifest',
        label: 'DOCK HAULER',
        tip: 'It is parked in the yard by Crane Row. Vega\u2019s boys signed it out to you. Probably.',
      },
      {
        type: 'goto', x: 176, z: 258,
        text: 'Load the crates at Container Row',
        needCar: true, label: 'CONTAINER ROW',
        tip: 'Drive the Hauler into the row and the dock crew loads you. They don\u2019t ask. You don\u2019t tell.',
      },
      {
        type: 'goto', x: -128, z: 170,
        text: 'Drop the first load at Salt & Smoke — the beach bar',
        needCar: true, label: 'SALT & SMOKE',
        tip: 'The bar is a front. It is also, as of tonight, maybe yours — buy it and the drop pays twice.',
      },
      {
        type: 'goto', x: 100, z: -44,
        text: 'Hand the manifest to the Velvet Reef — the last drop',
        needCar: true, label: 'THE VELVET REEF',
        tip: 'Neon Row at night. The casino takes the manifest, the Reef takes the cut, and you take the rest.',
      },
    ],
    reward: 12000,
    dialogue: [
      { who: 'VEGA FIXER', line: 'One run, Reef. The port, the bar, the Reef. No cops, no questions.' },
      { who: 'MARA', line: 'Last time you said one job, I stole a car and lost a bridge. What\u2019s the catch?' },
      { who: 'VEGA FIXER', line: 'No catch. The catch is your brother. Same as always.' },
      { who: 'MARA', line: 'Then it\u2019s the last one. After tonight I own something in this town — or I own nothing and I\u2019m gone.' },
    ],
  },
  {
    name: '8. THE LAST DRIVE',
    intro: 'Danny is on the pier at Port Solara and Vega\u2019s whole crew is coming to collect him — or the $40,000. Five stars, one boat, one choice left. This is the drive the whole bay has been about.',
    steps: [
      {
        type: 'pickup', x: 186, z: 312,
        text: 'Pick up Danny at the end of the pier (walk up to him)',
        label: 'DANNY',
        tip: 'He is standing where the pier meets the water. The same water you were going to leave on.',
      },
      {
        type: 'goto', x: 0, z: 235,
        text: 'Fight through to the harbor bridge — 5 stars, helicopter overhead',
        needCar: true, wanted: 5, label: 'HARBOR BRIDGE',
        tip: 'Everything Vega has is between you and the bridge. Don\u2019t stop. Stopping is how drivers die.',
      },
      {
        type: 'survive', seconds: 15,
        text: 'Outrun the Vega crew — stay ahead for 15 seconds',
        wanted: 5, label: 'OUTRUN THEM',
        tip: 'Fifteen seconds is forever at five stars. Use the bridge, use the water, use the dark.',
      },
      {
        type: 'goto', x: 14, z: 306,
        text: 'Reach the boat on Gull Island and go home',
        needCar: false, label: 'THE BOAT',
        tip: 'The boat has been waiting since mission 5. It does not wait forever.',
      },
      {
        type: 'choice',
        text: 'The debt is due. Danny is free — if you pay. Or keep everything and own the bay.',
        label: 'THE LAST CHOICE',
        tip: 'Paying clears the debt for good. Keeping it buys the bay — and buys Vega\u2019s attention forever.',
      },
    ],
    reward: 15000,
    dialogue: [
      { who: 'DANNY', line: 'Mara. They said if you didn\u2019t come, I\u2019m the payment. Don\u2019t let me be the payment.' },
      { who: 'MARA', line: 'You were never the payment. Get in the car. We\u2019re going home the long way.' },
      { who: 'VEGA FIXER', line: 'Forty thousand, Reef. Tonight. Or the bay keeps your brother.' },
      { who: 'MARA', line: 'Then tonight\u2019s the night it ends. One way or the other, it ends.' },
    ],
  },
];

// ------------------------------------------------------------------
// Finale choice outcomes
// ------------------------------------------------------------------

// What each ending of mission 8 does, in money. Paying Vega clears
// the debt: Mara hands over the $40,000 (or everything she has, if
// the businesses have not paid out enough yet — the debt is settled
// either way, because the family takes the cash and the equity). The
// businesses keep paying afterwards: a clean owner collects clean.
// Keeping the money banks Vega's $40,000 as Mara's own, plus a
// $15,000 mission reward — but the family never forgets, so the heat
// never fully cools: wanted level 5 on the drive out.
export function finaleOutcome(choice, cash, uncollected) {
  if (choice === 'pay') {
    const available = cash + uncollected;
    const paid = Math.min(DANNY_DEBT, available);
    return {
      choice: 'pay',
      paid,
      cashAfter: Math.max(0, cash - paid),
      wantedAfter: 0,
      bannerTitle: 'DANNY WALKS FREE',
      bannerText: 'The debt is paid — $' + paid.toLocaleString() + ' to Vega, and the bay is yours. Clean.',
      toast: 'Ending: PAY THE DEBT — Danny is free. The businesses are yours, and so is the morning.',
    };
  }
  return {
    choice: 'keep',
    paid: 0,
    cashAfter: cash + DANNY_DEBT,
    wantedAfter: 5,
    bannerTitle: 'QUEEN OF THE BAY',
    bannerText: 'You kept the $40,000. Vega will come for it — and for the businesses. Let them come.',
    toast: 'Ending: KEEP EVERYTHING — $40,000 kept. The bay is yours. So is the heat.',
  };
}

// The epilogue line shown after the finale, once the Night Shift
// resumes. It changes with the choice Mara made on the pier.
export function epilogueLine(choice) {
  if (choice === 'pay') {
    return 'Debt paid. The bay runs on couriers now — and the couriers work for you.';
  }
  return 'Debt kept. The bay runs on couriers now — and Vega is still out there, counting.';
}

// ------------------------------------------------------------------
// Act II helpers for the game loop
// ------------------------------------------------------------------

// Index of mission 7 inside the combined mission list (the six
// original missions, then these two).
export function actTwoStartIndex() {
  return 6;
}

// How many missions the full story has: six from the original list
// plus these two.
export function totalMissionCount() {
  return 8;
}

// The dialogue for a mission, one line at a time, for the toast
// chain that plays when the mission starts. Returns an empty list
// for anything that is not Act II.
export function dialogueFor(missionIndex) {
  if (missionIndex === 6) return MISSIONS_2[0].dialogue;
  if (missionIndex === 7) return MISSIONS_2[1].dialogue;
  return [];
}

// The smuggling chain as plain coordinates, for the minimap and for
// the mission tracker: every stop of mission 7 in order.
export function docksRunLegs() {
  return SMUGGLE_SPOTS.map((s) => ({ name: s.name, x: s.x, z: s.z }));
}

// A one-line brief for each Act II mission, used by the HUD when the
// mission tracker needs more than the current step text.
export function actTwoBrief(missionIndex) {
  if (missionIndex === 6) return 'Act II — the port run. Five drops, one night, no questions.';
  if (missionIndex === 7) return 'Act II — the finale. Danny, the bridge, the boat, the choice.';
  return '';
}

// ------------------------------------------------------------------
// Field notes — what Mara knows about each leg of the docks run
// ------------------------------------------------------------------

// One note per mission-7 step, in order. The loop shows the note
// for the current step in the mission tracker so the run reads as a
// story, not a checklist.
export const DOCKS_RUN_NOTES = [
  'The gate guard knows your face. He also knows your brother\u2019s name. Don\u2019t give him a reason to use it.',
  'The manifest is in a locker behind the office door. It lists five drops — and one crate that isn\u2019t on any list. That one is yours.',
  'The Hauler is the only truck on the manifest. The keys are in it. Vega\u2019s boys signed it out to you. Probably.',
  'The dock crew loads you without a word. They\u2019ve loaded a hundred trucks like this. They don\u2019t ask. You don\u2019t tell.',
  'The bar takes the first load through the back. If you own the bar, the drop pays twice — once as a drop, once as a till.',
  'The Reef takes the manifest and the cut. The casino doesn\u2019t count the money in front of you. That\u2019s respect. That\u2019s also a warning.',
];

// Beat-by-beat finale script: the five moments of mission 8, for
// the banner rotation that plays as each step lands.
export const FINALE_BEATS = [
  { step: 0, title: 'THE PIER', line: 'Danny is standing where the pier meets the water.' },
  { step: 1, title: 'THE BRIDGE', line: 'Five stars. Everything Vega has is between you and the bridge.' },
  { step: 2, title: 'FIFTEEN SECONDS', line: 'Stay ahead. Fifteen seconds is forever at five stars.' },
  { step: 3, title: 'THE BOAT', line: 'The boat has been waiting since the bank job. It does not wait forever.' },
  { step: 4, title: 'THE CHOICE', line: 'Pay the debt, or keep everything. There is no third option.' },
];

// The full briefing for an Act II mission: intro plus every step's
// text and tip, joined for the pause screen and the save summary.
export function missionBriefing(missionIndex) {
  const m = MISSIONS_2[missionIndex - 6];
  if (!m) return '';
  const parts = [m.name, m.intro];
  m.steps.forEach((s, i) => {
    parts.push((i + 1) + '. ' + s.text + (s.tip ? ' — ' + s.tip : ''));
  });
  parts.push('Reward: $' + m.reward.toLocaleString() + ' (plus $1,500 per business owned on the docks run).');
  return parts.join('\n');
}

// The finale beat for the current step, or null outside mission 8.
export function finaleBeat(stepIndex) {
  return FINALE_BEATS.find((b) => b.step === stepIndex) || null;
}

// ------------------------------------------------------------------
// Danny on the pier
// ------------------------------------------------------------------

// Mission 8 moves Danny from Palm Court (where mission 4 left him)
// to the end of the pier. The walker itself is the same Danny the
// world built; only his standing spot changes, so the game loop
// teleports him when mission 8 starts and the pickup step reads his
// new position. These are the coordinates the loop uses.
export const DANNY_PIER = { x: 186, z: 312 };

// The boat is the same Gull Island boat from mission 5. The finale
// reuses its coordinates — no new prop, just a new reason to reach it.
export const FINALE_BOAT = { x: 14, z: 306 };

// ------------------------------------------------------------------
// Business tie-ins
// ------------------------------------------------------------------

// Mission 7 pays better when Mara already owns the fronts on its
// route: the bar drop and the casino hand-off are worth a bonus per
// business owned, because the money stays in the family — hers.
// The loop adds this to the mission-7 reward on completion.
export function docksRunBonus(ownedCount) {
  return ownedCount * 1500;
}

// Mission 8's survive step is shorter when Mara owns the warehouse:
// the dock crew jams the gate behind her and buys her seconds. The
// loop reads this when the step starts.
export function surviveSeconds(ownsWarehouse) {
  return ownsWarehouse ? 10 : 15;
}

// The line the mission tracker shows while Mara holds businesses
// during Act II — a reminder that the fronts are earning while she
// drives, and that Vega may come for them mid-mission.
export function bizReminder(ownedCount, perDay) {
  if (ownedCount === 0) return 'No businesses yet — the Velvet Reef, Warehouse 7 and Salt & Smoke are for sale.';
  return ownedCount + (ownedCount === 1 ? ' business' : ' businesses') + ' earning $' + perDay.toLocaleString() + '/day. Press B to collect.';
}
