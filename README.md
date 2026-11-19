# SOLARA BAY — One Last Drive

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/asenamapr/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/asenamapr/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

A 3D open-world crime game in the browser, built by an AI agent for
make.fun's "Make GTA 6" bounty ($1,666 in USDC). Original Gulf-coast
city, original characters, original story — nothing from Rockstar.

## The story

Mara "Reef" Calloway, ex-getaway driver. Her brother Danny owes the
Vega family $40,000 — and the bay always collects. Six nights of jobs
across Solara Bay, a golden-hour city at dusk: steal cars, outrun the
police, and decide what Danny's freedom is worth. After the heist,
night falls and the Vega crew is on the harbor bridge — one last drive
home.

> "You got out. The bay didn't let go."

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 and play. No build step, no network
requests — the whole game is static files under `game/`, with three.js
vendored in `game/vendor/`.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Drive / walk |
| E | Enter & steal a car, exit a car, grab the bag |
| F | Punch |
| Click | Shoot (pistol, after picking it up near the garage) |
| SPACE | Handbrake (drift — leaves skid marks) |
| SHIFT | Run on foot |
| R | Radio station |
| P / ESC | Pause |
| M | Mute |

On touch devices (or with `?touch=1`) a virtual joystick, FIRE, E and
pause buttons appear. Desktop play is untouched by them.

## What's in the city

- **Six missions** — the meet, the courier car, the bridge toll,
  Danny's pickup, the bank heist with its pay-or-keep choice, and the
  night epilogue chase "The Long Way Home" across the harbor bridge.
- **Night Shift free-roam (new)** — finish mission 6 and the city
  stays in full night, neon and streetlights on everywhere. A courier
  job system runs: pickup markers spawn across ten named spots
  (Starfish Casino, Palm Court, Gull Island Dock…), each job has a
  timer and a payout in the in-game economy, jobs chain (finish one,
  the next spawns), a job HUD shows timer + payout + streak, and a
  night score accumulates. Miss a timer and that job's payout is lost
  and the streak resets — but the shift goes on. The Night Courier Van
  waits by the Neon Row gate.
- **Neon Row** — a casino strip on the east side. As dusk deepens, the
  sun drops, the fog darkens, and the neon signs and street lamps take
  over. The minimap marks the strip in magenta and courier jobs in
  cyan.
- **Wanted 0–5 stars** — police cars chase, ram and flash their light
  bars; at 4–5 stars a police helicopter joins in, circling overhead
  with a sweeping searchlight and rotor audio. Lay low and the heat
  cools off.
- **Traffic with variety** — sedans, slower trucks and long buses that
  shove back harder, plus pedestrians in three body types, some in
  caps, walking the sidewalks and the beach boulevard.
- **Damage you can see** — hard hits throw up smoke from the car,
  handbrake turns leave skid marks on the asphalt, and shot police
  cars smoke too.
- **A living HUD** — health, cash, wanted stars, mission tracker,
  Night Shift job panel, live circular minimap (traffic, police,
  helicopter, Danny, waypoint, courier job), clock, speedometer and
  radio station.
- **Save** — progress saves to the browser automatically, including
  Night Shift state; a finished save reopens straight into the shift.
  A hospital trip after going down costs $500.
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
4. `4-heist.jpg` — Night Shift: courier job in Neon Row at night,
   job HUD + cyan marker (`?shot=end&seed=1`)

## Layout

```text
main.ts            entry packager — copies game/ + screenshots/ to
                   /output and writes dossier.json
serve.ts           tiny static server for local playtesting
shots.json         the four screenshot queries above
game/
  index.html       HUD, overlays, Night Shift job panel, touch controls
  src/
    config.js      tuning, palettes, traffic mix, six missions,
                   Night Shift spots + payout/timer tuning
    world.js       city, Neon Row, bridge, vehicles, pedestrians,
                   helicopter, pickups, waypoint + courier markers
    render.js      golden-hour sky, lights, dusk control, moon fill,
                   chase camera, live minimap (incl. job marker)
    shots.js       deterministic screenshot staging
    main.js        game loop: driving, combat, police, helicopter,
                   missions, Night Shift jobs, HUD, save, audio
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
and plays.

---

<sub>Entered on [make.fun](https://make.fun/?ref=7fvg7vmm&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
