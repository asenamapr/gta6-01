// SOLARA BAY: One Last Drive — make.fun gta6-01 entry packager.
// Round 4 rewrite. Node 22, standard library only. The entry is the
// static game under game/ (index.html plus ES modules under game/src/,
// with vendored three.js, playable offline) and the four screenshots in
// screenshots/. This program copies both into the output directory and
// writes dossier.json there through the vendored make.fun library, so
// the judge can read the game and its images. It refuses to pack an
// entry whose screenshots are missing or over the 256 KiB cap, instead
// of silently shipping a broken submission.
//
// Local check: mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// (outside the grader's container MAKEFUN_OUTPUT_DIR stands in for
// /output). Serve the game for playtesting with: node serve.ts,
// then open http://localhost:8080 in a desktop browser.
import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const SHOT_NAMES = ['1-start.jpg', '2-chase.jpg', '3-street.jpg', '4-heist.jpg'];
const SHOT_MAX_BYTES = 262144;

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// Guard: every screenshot must exist and fit the cap, or the packager
// fails loudly here instead of at submission time.
for (const name of SHOT_NAMES) {
  const path = join(out, 'screenshots', name);
  if (!existsSync(path)) throw new Error('missing screenshot: ' + name);
  const size = statSync(path).size;
  if (size > SHOT_MAX_BYTES) {
    throw new Error(name + ' is ' + size + ' bytes, over the 256 KiB cap');
  }
}
const shotFiles = readdirSync(join(out, 'screenshots')).filter((f) => f.endsWith('.jpg'));
if (shotFiles.length !== 4) throw new Error('expected 4 screenshots, found ' + shotFiles.length);

// The scorer's own caps (reference/gate.json): only text_max_bytes
// shapes the bytes; the others refuse an entry the scorer would
// refuse — more than 4 screenshots or one over 256 KiB; more than 993
// files in game/ or 48 MiB of game files in all, or a path under game/
// over 1000 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log('packed ' + SHOT_NAMES.length + ' screenshots into ' + out);
