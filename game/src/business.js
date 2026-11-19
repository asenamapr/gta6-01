// SOLARA BAY — business ownership (Round 5, new system).
//
// Mara stops being only a driver and starts owning the bay: three
// buyable fronts — the Velvet Reef casino on Neon Row, Warehouse 7
// in Port Solara, and the Salt & Smoke beach bar. Each one pays a
// passive income per in-game day into an uncollected pot, takes three
// upgrade tiers that multiply that income, and sooner or later draws
// a Vega takeover-defense event the player has to answer in person.
//
// This module is pure game logic: no THREE, no DOM, no audio. It
// takes a plain state object and the defs from config.js, and the
// game loop in main.js calls it once per frame (tick) plus on player
// actions (buy / upgrade / collect / defend). That keeps the rules
// testable from the debug handle without booting the renderer.
'use strict';

import { BUSINESS_DEFS, BIZ_DAY_SECONDS, BIZ_DEFENSE, dist2d } from './config.js';

// ------------------------------------------------------------------
// State
// ------------------------------------------------------------------

// Fresh business state: nothing owned, nothing owed, no crew at the
// door. The game loop owns one of these inside its save blob.
export function createBizState() {
  return {
    owned: {},        // id -> tier (0 = bought, un-upgraded; 1..3 = upgrades)
    uncollected: {},  // id -> dollars waiting to be collected
    lifetime: 0,      // total income ever earned across all businesses
    collected: 0,     // total income ever collected
    spent: 0,         // total cash ever spent on purchases + upgrades
    defense: null,    // active takeover event, or null
    defenseCooldown: 0, // seconds until the next event may fire
    defenseWins: 0,
    defenseLosses: 0,
    eventsSeen: 0,
  };
}

export function bizDef(id) {
  return BUSINESS_DEFS.find((b) => b.id === id) || null;
}

export function isOwned(biz, id) {
  return Object.prototype.hasOwnProperty.call(biz.owned, id);
}

export function ownedIds(biz) {
  return Object.keys(biz.owned);
}

export function ownedCount(biz) {
  return Object.keys(biz.owned).length;
}

// ------------------------------------------------------------------
// Income
// ------------------------------------------------------------------

// Income per in-game day for one business at its current tier. Tier
// 0 pays the base rate; each upgrade multiplies it by that tier's
// multiplier (multipliers compound from the base, they do not stack
// with each other — tier 3 pays base x 3.1, not base x 1.5 x 2.2).
export function incomePerDay(biz, def) {
  const tier = biz.owned[def.id] || 0;
  if (tier === 0) return def.income;
  const up = def.upgrades[tier - 1];
  return Math.round(def.income * up.mult);
}

// What the whole portfolio earns per in-game day, right now.
export function portfolioPerDay(biz) {
  let total = 0;
  for (const def of BUSINESS_DEFS) {
    if (isOwned(biz, def.id)) total += incomePerDay(biz, def);
  }
  return total;
}

// Total dollars sitting uncollected across every owned business.
export function uncollectedTotal(biz) {
  let total = 0;
  for (const id of ownedIds(biz)) total += biz.uncollected[id] || 0;
  return total;
}

// The frame tick: income accrues continuously, a day's pay spread
// over BIZ_DAY_SECONDS of real play. Called with the frame dt while
// the game is running and not paused. Nothing accrues while Mara
// owns nothing, and nothing accrues during a defense event — the
// staff are hiding, not working.
export function tickBiz(biz, dt) {
  if (ownedCount(biz) === 0) return 0;
  if (biz.defense) return 0;
  let earned = 0;
  for (const def of BUSINESS_DEFS) {
    if (!isOwned(biz, def.id)) continue;
    const slice = (incomePerDay(biz, def) * dt) / BIZ_DAY_SECONDS;
    biz.uncollected[def.id] = (biz.uncollected[def.id] || 0) + slice;
    biz.lifetime += slice;
    earned += slice;
  }
  return earned;
}

// ------------------------------------------------------------------
// Buying and upgrading
// ------------------------------------------------------------------

// Try to buy a business. Returns { ok, cost } on success or
// { ok: false, why } when the player cannot buy it — already owned,
// or short on cash. The caller moves the cash; this function only
// decides and records.
export function buyBiz(biz, def, cash) {
  if (isOwned(biz, def.id)) return { ok: false, why: 'You already own ' + def.name + '.' };
  if (cash < def.cost) {
    return { ok: false, why: def.name + ' costs $' + def.cost.toLocaleString() + ' — you have $' + Math.floor(cash).toLocaleString() + '.' };
  }
  biz.owned[def.id] = 0;
  biz.uncollected[def.id] = 0;
  biz.spent += def.cost;
  return { ok: true, cost: def.cost };
}

// The next upgrade for a business, or null when it is maxed out.
export function nextUpgrade(biz, def) {
  const tier = biz.owned[def.id];
  if (tier === undefined) return null;
  if (tier >= def.upgrades.length) return null;
  return def.upgrades[tier];
}

// Try to buy the next upgrade tier. Same contract as buyBiz.
export function upgradeBiz(biz, def, cash) {
  if (!isOwned(biz, def.id)) return { ok: false, why: 'Buy ' + def.name + ' first.' };
  const up = nextUpgrade(biz, def);
  if (!up) return { ok: false, why: def.name + ' is fully upgraded.' };
  if (cash < up.cost) {
    return { ok: false, why: up.name + ' costs $' + up.cost.toLocaleString() + ' — you have $' + Math.floor(cash).toLocaleString() + '.' };
  }
  biz.owned[def.id] += 1;
  biz.spent += up.cost;
  return { ok: true, cost: up.cost, upgrade: up };
}

// Collect every uncollected dollar into cash. Returns the whole
// dollars collected (floored per business, so the pot never pays
// fractions of a dollar and never double-pays a remainder).
export function collectBiz(biz) {
  let total = 0;
  for (const id of ownedIds(biz)) {
    const pot = biz.uncollected[id] || 0;
    const whole = Math.floor(pot);
    if (whole > 0) {
      total += whole;
      biz.uncollected[id] = pot - whole;
      biz.collected += whole;
    }
  }
  return total;
}

// ------------------------------------------------------------------
// Finding a business from the street
// ------------------------------------------------------------------

// The business whose front door Mara is standing at, within 14
// metres, or null. Used by the E interact key: at a door, E buys (or
// collects from) the business instead of stealing a car.
export function nearestBizDoor(x, z, radius) {
  const r = radius || 14;
  let best = null;
  let bestD = r;
  for (const def of BUSINESS_DEFS) {
    const d = dist2d(x, z, def.x, def.z);
    if (d < bestD) { bestD = d; best = def; }
  }
  return best;
}

// One-line status for a business, for the HUD panel and toasts.
export function bizLine(biz, def) {
  if (!isOwned(biz, def.id)) {
    return def.short + ' — FOR SALE $' + def.cost.toLocaleString() + ' · $' + def.income.toLocaleString() + '/day';
  }
  const tier = biz.owned[def.id];
  const pot = Math.floor(biz.uncollected[def.id] || 0);
  const up = nextUpgrade(biz, def);
  const upText = up ? ' · next: ' + up.name + ' $' + up.cost.toLocaleString() : ' · MAXED';
  return def.short + ' · T' + tier + ' · $' + incomePerDay(biz, def).toLocaleString() + '/day · waiting $' + pot.toLocaleString() + upText;
}

// ------------------------------------------------------------------
// Takeover-defense events
// ------------------------------------------------------------------

// Should an event fire now? Only when Mara owns at least one
// business, no event is running, the cooldown has expired, and the
// roll hits. The caller passes its own rng so staging stays
// deterministic; chance is per second of play, so the rate does not
// depend on frame rate.
export function maybeStartDefense(biz, rng, dt) {
  if (biz.defense) return null;
  if (ownedCount(biz) < BIZ_DEFENSE.minOwnedForEvent) return null;
  if (biz.defenseCooldown > 0) return null;
  // Roughly one crew visit every four minutes of owned play.
  if (rng() >= 0.0042 * dt) return null;
  return startDefense(biz, rng);
}

// Force-start an event (debug handle, and the mission-8 lead-in).
// Picks a random owned business as the target and a random event
// template for the flavour text.
export function startDefense(biz, rng) {
  const owned = ownedIds(biz);
  if (owned.length === 0) return null;
  const pickRng = rng || Math.random;
  const targetId = owned[Math.floor(pickRng() * owned.length)];
  const tpl = BIZ_DEFENSE.events[Math.floor(pickRng() * BIZ_DEFENSE.events.length)];
  const def = bizDef(targetId);
  biz.defense = {
    eventId: tpl.id,
    title: tpl.title,
    text: tpl.text,
    bizId: targetId,
    bizName: def.name,
    x: def.x,
    z: def.z,
    timer: BIZ_DEFENSE.windowSeconds,
    window: BIZ_DEFENSE.windowSeconds,
  };
  biz.eventsSeen += 1;
  return biz.defense;
}

// Advance the active defense timer. Returns 'expired' when the
// window runs out (the caller applies the skim), 'arrived' when Mara
// reaches the door in time, or null while it is still running.
export function updateDefense(biz, dt, px, pz) {
  const ev = biz.defense;
  if (!ev) return null;
  ev.timer -= dt;
  if (dist2d(px, pz, ev.x, ev.z) < 12) return 'arrived';
  if (ev.timer <= 0) return 'expired';
  return null;
}

// Mara got there in time: the crew backs off and pays her off for
// the trouble. Returns the bonus dollars.
export function resolveDefenseWin(biz) {
  const ev = biz.defense;
  if (!ev) return 0;
  biz.defense = null;
  biz.defenseCooldown = BIZ_DEFENSE.cooldownSeconds;
  biz.defenseWins += 1;
  return BIZ_DEFENSE.winBonus;
}

// Mara missed the window: the crew skims half of every uncollected
// pot and leaves. Returns the dollars skimmed.
export function resolveDefenseLoss(biz) {
  const ev = biz.defense;
  if (!ev) return 0;
  let skimmed = 0;
  for (const id of ownedIds(biz)) {
    const pot = biz.uncollected[id] || 0;
    const cut = Math.floor(pot * BIZ_DEFENSE.skimFraction);
    biz.uncollected[id] = pot - cut;
    skimmed += cut;
  }
  biz.defense = null;
  biz.defenseCooldown = BIZ_DEFENSE.cooldownSeconds;
  biz.defenseLosses += 1;
  return skimmed;
}

// ------------------------------------------------------------------
// Ledger and reports — the numbers Mara checks at the end of a night
// ------------------------------------------------------------------

// One row per owned business: what it earns, what is waiting, what
// Mara has sunk into it. The HUD panel renders these rows; the
// end-of-night report below turns them into a sentence.
export function bizLedger(biz) {
  const rows = [];
  for (const def of BUSINESS_DEFS) {
    if (!isOwned(biz, def.id)) continue;
    const tier = biz.owned[def.id];
    let invested = def.cost;
    for (let i = 0; i < tier; i++) invested += def.upgrades[i].cost;
    rows.push({
      id: def.id,
      name: def.short,
      tier,
      perDay: incomePerDay(biz, def),
      waiting: Math.floor(biz.uncollected[def.id] || 0),
      invested,
    });
  }
  return rows;
}

// The single best earner in the portfolio, or null when Mara owns
// nothing yet. Used by the HUD hint that tells her where the next
// upgrade dollar earns the most.
export function bestEarner(biz) {
  let best = null;
  let bestPay = 0;
  for (const def of BUSINESS_DEFS) {
    if (!isOwned(biz, def.id)) continue;
    const pay = incomePerDay(biz, def);
    if (pay > bestPay) { bestPay = pay; best = def; }
  }
  return best;
}

// Days of income for a business to repay everything Mara put into
// it (purchase plus upgrades so far). Infinity when it earns nothing
// — which only happens before the first purchase.
export function daysToPayback(biz, def) {
  const pay = incomePerDay(biz, def);
  if (pay <= 0) return Infinity;
  const tier = biz.owned[def.id] || 0;
  let invested = def.cost;
  for (let i = 0; i < tier; i++) invested += def.upgrades[i].cost;
  return Math.ceil(invested / pay);
}

// Every upgrade still to buy for a business, with the running total
// — so Mara can see the full road to max tier before she starts.
export function upgradePath(biz, def) {
  const tier = biz.owned[def.id];
  if (tier === undefined) return [];
  const path = [];
  let running = 0;
  for (let i = tier; i < def.upgrades.length; i++) {
    const up = def.upgrades[i];
    running += up.cost;
    path.push({ name: up.name, cost: up.cost, mult: up.mult, cumulative: running, blurb: up.blurb });
  }
  return path;
}

// The end-of-night summary: one line per business plus the totals.
// Shown after the finale and used by the save summary.
export function bizNightReport(biz) {
  const rows = bizLedger(biz);
  if (rows.length === 0) return 'No businesses yet. The bay is for sale — start with Salt & Smoke.';
  const lines = rows.map((r) => r.name + ' T' + r.tier + ': $' + r.perDay.toLocaleString() + '/day, $' + r.waiting.toLocaleString() + ' waiting, $' + r.invested.toLocaleString() + ' invested');
  lines.push('Portfolio: $' + portfolioPerDay(biz).toLocaleString() + '/day · $' + Math.floor(uncollectedTotal(biz)).toLocaleString() + ' waiting · lifetime $' + Math.floor(biz.lifetime).toLocaleString() + ' · net worth $' + bizNetWorth(biz).toLocaleString());
  lines.push('Defense: ' + biz.defenseWins + ' held, ' + biz.defenseLosses + ' skimmed, ' + biz.eventsSeen + ' crews faced.');
  return lines.join('\n');
}

// ------------------------------------------------------------------
// Save / load
// ------------------------------------------------------------------

// Plain-data snapshot for the save blob (save format v4). The state
// object is already plain data, but the copy keeps a save from ever
// holding a live reference to the running state.
export function serializeBiz(biz) {
  return JSON.parse(JSON.stringify(biz));
}

// Restore a saved snapshot, tolerating older or partial saves: any
// missing field falls back to the fresh default, so a v3 save that
// never had businesses still loads cleanly into v4.
export function deserializeBiz(saved) {
  const fresh = createBizState();
  if (!saved || typeof saved !== 'object') return fresh;
  for (const key of Object.keys(fresh)) {
    if (saved[key] !== undefined) fresh[key] = saved[key];
  }
  if (!fresh.owned) fresh.owned = {};
  if (!fresh.uncollected) fresh.uncollected = {};
  return fresh;
}

// Portfolio net worth for the end-of-night summary: cash value of
// everything Mara owns (purchase price, not resale — there is no
// resale; the bay does not give refunds) plus what is waiting.
export function bizNetWorth(biz) {
  let worth = 0;
  for (const def of BUSINESS_DEFS) {
    if (!isOwned(biz, def.id)) continue;
    worth += def.cost;
    const tier = biz.owned[def.id];
    for (let i = 0; i < tier; i++) worth += def.upgrades[i].cost;
    worth += Math.floor(biz.uncollected[def.id] || 0);
  }
  return worth;
}
