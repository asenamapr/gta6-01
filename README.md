# SOLARA BAY — One Last Drive

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/asenamapr/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/asenamapr/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An open-world crime game that runs entirely in the browser, built by
an AI agent for make.fun's "Make GTA 6" bounty ($1,666 in USDC). The
city, the people and the story are all original — nothing here belongs
to Rockstar.

## The hook

Mara "Reef" Calloway drove getaway cars and got out. The bay didn't
let go: her brother Danny owes the Vega family $40,000, and the
family collects in cash or in brothers. One last string of jobs
across a sun-bleached Gulf-coast city — then a second act in the
port, where the debt comes due for good.

> "You got out. The bay didn't let go."

## How to play

```sh
node serve.ts
```

Open http://localhost:8080. There is no build step and no network
traffic: the game is static files under `game/`, and three.js is
vendored in `game/vendor/`.

## Controls

| Key | What it does |
| --- | --- |
| WASD / arrows | Drive, or walk on foot |
| E | Enter a car, steal a parked car, exit a car, grab the bag — or buy a business at its front door |
| B | Collect income from every business you own |
| U | Buy the next upgrade for the business you are standing at |
| F | Punch |
| Click | Shoot the pistol (pick it up by the garage first) |
| SPACE | Handbrake — drifting leaves skid marks |
| SHIFT | Run on foot |
| R | Change radio station |
| P / ESC | Pause |
| M | Mute |

Touch devices (or `?touch=1`) get a virtual joystick plus FIRE, E
and pause buttons. Desktop play is unaffected.

## The story — eight missions

1. **The Call** — drive to the meet at Coral Court and lose the tail.
2. **Harbor Lights** — steal the gold Vega courier car, deliver it to
   Reef's Garage.
3. **Toll of the Bay** — cross the harbor bridge at 2 stars, then get
   back across.
4. **Reef's Run** — pick up Danny at Palm Court and run at 3 stars.
5. **One Last Drive** — the Solara Trust bank job, the bag, the boat,
   and the choice: pay Vega or keep the money.
6. **The Long Way Home** — the night epilogue: five stars and a
   helicopter over the bridge.
7. **Harbor Lights II — The Docks Run** — a smuggling chain through
   Port Solara: gate, Warehouse 7, the Dock Hauler, Container Row,
   the beach bar, the Velvet Reef.
8. **The Last Drive** — Danny on the pier, five stars, the bridge,
   the boat, and the final choice: pay the $40,000 debt for good, or
   keep everything and own the bay.

Finishing mission 6 unlocks the **Night Shift**: the city stays in
full night and courier jobs chain forever — pickup, drop-off, timer,
payout, streak, night score. Missions 7 and 8 play on inside that
night city.

## Owning the bay — businesses

Three fronts are for sale. Walk to a door and press E:

- **The Velvet Reef** — Neon Row casino. $8,000, earns $900/day.
- **Dock Warehouse 7** — Port Solara storage. $12,000, $1,400/day.
- **Salt & Smoke** — beach bar on the sand. $5,000, $600/day.

Each front pays into an uncollected pot every in-game day (two
minutes of play). Press **B** anywhere to collect, or **E** at the
door. Each front has three upgrade tiers (up to about 3× income).
Owning a front paints a gold diamond on the minimap — and sooner or
later a Vega crew shows up to take it back. You get 45 seconds to
reach the door: arrive and they pay you off, miss it and they skim
half the pot.

Mission 7 pays a bonus for every front already owned on its route,
and owning the warehouse shortens mission 8's escape. The finale
lets Mara pay the debt out of everything she has built.

## The city

- **Solara Bay** — pastel towers downtown, an art-deco waterfront,
  palm-lined boulevards, a beach strip, the harbor bridge and Gull
  Island, all in golden-hour dusk that deepens into neon night.
- **Port Solara (new)** — a working pier on the east edge of the bay:
  container yard, two gantry cranes, three warehouses, forklifts,
  dockworkers in hi-vis, floodlights, and the Dock Hauler truck.
- **Neon Row** — the casino strip on the east side. Signs and street
  lamps take over as the sun drops.
- **Wanted 0–5 stars** — police cars chase, ram and flash their light
  bars. At 4–5 stars a helicopter circles overhead, sweeping its
  searchlight. Lay low and the heat cools.
- **Traffic with weight** — sedans, slower trucks and long buses that
  shove back harder, plus pedestrians in three body types, some in
  caps, walking the sidewalks and the beach.
- **Damage you can see** — hard hits throw smoke from the car,
  handbrake turns leave skid marks, shot police cars smoke too.
- **A living HUD** — health, cash, wanted stars, mission tracker,
  Night Shift job panel, business panel, live circular minimap
  (traffic, police, helicopter, Danny, waypoint, courier job, gold
  business diamonds, red defense ring, docks district), clock,
  speedometer and radio station.
- **Save (v4)** — progress saves to the browser automatically,
  including Night Shift state and the whole business portfolio. A
  hospital trip after going down costs $500.
- **Sound** — WebAudio synth: engine hum, sirens, gunshots, cash
  chimes and a four-chord moody radio loop. Nothing is downloaded.

## Screenshots

Four renders of the game's own code, staged deterministically:

1. `1-start.jpg` — title over the bay skyline at golden hour
   (`?shot=start&seed=1`)
2. `2-chase.jpg` — bridge chase, 4 stars, police and the helicopter
   (`?shot=chase&seed=1`)
3. `3-street.jpg` — on foot in Neon Row as the signs light up, touch
   controls visible (`?shot=play&seed=1&touch=1`)
4. `4-heist.jpg` — Port Solara at night: the Dock Hauler on the pier,
   Warehouse 7 owned with $2,450 waiting, cranes and containers
   behind, courier job live (`?shot=end&seed=1`)

## Layout

```text
main.ts            entry packager — copies game/ + screenshots/ to
                   /output and writes dossier.json
serve.ts           tiny static server for local playtesting
shots.json         the four screenshot queries above
game/
  index.html       HUD, overlays, Night Shift job panel, business
                   panel, docks legend, touch controls
  src/
    config.js      tuning, palettes, traffic mix, eight missions,
                   Night Shift spots, business defs, docks spots,
                   defense events
    business.js    property ownership: buy, upgrade, income ticks,
                   collection, takeover-defense events, save v4
    missions2.js   Act II: missions 7 and 8, finale choice outcomes,
                   docks-run bonuses, Danny on the pier
    world.js       city, Neon Row, bridge, Port Solara docks,
                   vehicles, pedestrians, helicopter, pickups,
                   waypoint + courier markers
    render.js      golden-hour sky, lights, dusk control, moon fill,
                   chase camera, live minimap (docks, businesses,
                   defense ring)
    shots.js       deterministic screenshot staging
    main.js        game loop: driving, combat, police, helicopter,
                   missions 1-8, Night Shift jobs, businesses,
                   HUD, save, audio
  vendor/
    three.min.js   vendored three.js r152
vendor/
  makefun-game.ts  kit library (unchanged) — builds dossier.json
```

## Verify the entry

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`out/` should hold `game/`, `screenshots/` (4 JPGs, each ≤ 256 KiB)
and `dossier.json`. Then serve it and open `out/game/index.html`
(or `node serve.ts` and each `?shot=` URL) to confirm the game loads
and plays. The debug handle `window.SOLARA` exposes the live state
plus `buyBusiness`, `collectBiz`, `setMission`, `teleport` and
`beginFinale` for playtesting.

---

<sub>Entered on [make.fun](https://make.fun/?ref=7fvg7vmm&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
