# EVALUATION — gta6-01 intake rejections and fixes (rounds 2–6)

A running record of what the make.fun server rejected at intake,
why it happened, and what changed in response. The game itself has
never been judged — every rejection below happened before scoring.
Retry is allowed until 2026-11-24T15:00:00Z.

## Round 2 — rejected on transcripts_witnessed (2026-11-19)

Submission 01a1f1e8. One check failed: `transcripts_witnessed`
(422). README.md was already sitting in the repo in its final form
when the recording began, and the recorded agent wrote no line of
it. The other 28 checks passed, including thinking_reproduces at
36.3% authored. The lesson that stuck: the rule is not "the
sessions must be live", it is "every counted file in the snapshot
must be authored by the recorded agent during the recording". The
local pre-submit check (4 pass / 0 fail) never caught it, and a
local green check is not proof of an intake pass. Contributing
factor: the kit was level 21 while the site was at level 26.

## Round 3 — recording unsubmittable (2026-11-19)

The code was built and pushed (mission 6, the helicopter, Neon Row)
and the recording sealed — but the submit was refused locally. The
sealed recording held a scheduler-spawned cron worker session that
opened as a hand-off with no parent chain back to a user prompt,
because the build had read a file that worker wrote. The kit's
parent-chain rule demands a chain for every session in the
recording, and no flag fixes it. Lesson: a recording is
contaminated when any scheduler-spawned session writes a file the
build reads during the window. From round 4 on, the builder reads
only the repo, the kit, the skill, and the pre-written brief — never
memory, sweep files, or other builds.

## Round 4 — rejected on thinking_reproduces (2026-11-19)

Submission 01a1f3d3. Two checks failed: `thinking_reproduces` and
`transcripts_witnessed`. thinking_reproduces: the agent's own
writing accounted for 366 of 2,399 counted lines (15.2%), under the
30% required. Root cause: the builder read the existing game and
rewrote it, so most lines counted as read, not authored — "rewrite
every counted file in-session" is not enough, because a line counts
as authored only if the agent's own write first carried it. The fix
for round 5 was to author genuinely new content (new systems, not a
re-skin) and to estimate the authored share before submitting, with
a ~35% floor. Second lesson: owner-view "submitted + intake pass"
at submit time is not intake passed — the transcript checks land
hours later in the status JSON.

## Round 5 — genuine rebuild, then rejected (2026-11-19)

Builder commit 9924c6e, fresh level-27 kit, fresh recording: a new
business.js (393 lines) and missions2.js (297 lines), the Port
Solara docks district, main.js +401, a README rewrite, .gitignore
+3 — +1,616/−117 across 17 files, an authored-share estimate of
about 40%. Screenshots regenerated in-session and sha256-verified.
Submitted 2026-11-19 ~21:22 WIB as 01a1f42f.

## Addendum — Round 5 REJECTED on transcripts_witnessed

- **Submission 01a1f42f, stage rejected.** thinking_reproduces
  PASSED this time: authored coverage 31.19% (1,122 of 3,597 lines).
  Exactly one check failed: `transcripts_witnessed`.
- **Exactly 2 counted files failed it: EVALUATION-R2.md and
  SUBMISSION.md.** Their final content was written outside the
  round-5 recording. The other 17 text files in the snapshot were
  witnessed.
- **Root cause.** The snapshot is the remote GitHub tree at the
  commit, and those two files sat on remote in their round-4 form,
  unwitnessed. The round-5 record sections were written in a session
  whose working tree never reached the remote: the local clone and
  origin had diverged after round 4 (two parallel round-5 rebuild
  commits with identical trees, plus a screenshots commit), the
  record commit sat on the local branch only, and the remote tree
  the server snapshotted still held the round-4 versions of both
  files. The coordinator's in-recording writing did not matter,
  because the bytes never landed on remote.
- **Fix in round 6.** This session rewrites both files live, on a
  base that is merged with origin/main so the round-6 commit is a
  descendant of the remote tip. The rewritten EVALUATION-R2.md is
  pushed to remote. SUBMISSION.md is DELETED from remote — it holds
  claim codes and must never be pushed — so it is no longer a
  counted file at all. The local copy stays on disk as the record,
  kept out of the git index.

## Re-record — the first round-6 recording could not be sealed

The first round-6 attempt built the radio and rewrote both record
files (local commit 859d06f), but its recording — 01a1f6ca-7ae0 —
could not be sealed: the record process was stopped the wrong way
and its state is gone. None of that session's writing counts as
witnessed, so the round-6 files are re-authored here, under a fresh
recording, in this session: radio.js is deleted and written anew
from the spec, the main.js / config.js wiring is removed and
re-added by this session's own edits, EVALUATION-R2.md is rewritten
in full below in fresh prose, and SUBMISSION.md's Round 6 section
is updated in this session. The 859d06f commit stays in local
history as the record of the lost attempt; this session's commit
supersedes it with the same message, re-authored.

## Round 6 — genuine fix (2026-11-20)

One small genuine new system, written fresh in this session:
Solara Bay Radio (game/src/radio.js, ~200 lines, no audio files).
Three procedural WebAudio stations — VICE FM (synthwave arpeggio
over Am–F–C–G), NEON NIGHTS (slow pads), HARBOR TALK (talk-radio
murmur from filtered noise plus sparse station-ID blips) — switched
with the R key or a HUD button inside the existing radio chip, with
the current station and track title shown in the HUD. The track
rolls every 8 bars. The choice is saved with the game and restored
on load; the radio ducks while any full-screen overlay is open
(title/briefing, pause, ending) or sound is muted. Wiring is
minimal: radio init + save/load + R key + HUD button in main.js,
station defaults in config.js. No visuals, screenshots, shots.json,
README, LICENSE, vendor files, serve.ts, main.ts, .gitignore, or
.makefun/owner.json changed; the only visual delta is the small
station-switch button inside the existing radio chip.

Verified live in this session: `node --check` clean on radio.js,
main.js, and config.js; a Node smoke test of the radio against a
fake AudioContext (19/19 passed — station switching, wrap-around,
track roll after 8 bars, duck/unduck gain targets, stop clears
timers); headless Chrome serving the game (17/17 checks passed) — page load with no exceptions, console
errors, or failed requests, R-key and HUD-button switching, toast
announcement, the station recorded in the save file, and the saved
station restored after a reload; shot mode loads clean with no
radio created. The packager (`MAKEFUN_OUTPUT_DIR=out node main.ts`)
packs: manifest ok, 4 screenshots, radio.js shipped in
out/game/src/. Note: the dossier text is capped at 163,840 bytes,
so with ~188,000 bytes of game source the dossier leaves out
missions2.js and radio.js from its text — the game files themselves
ship whole, and the radio wiring is visible in main.js, which is in
the dossier. The cap already cut the R5 dossier too.

## Lessons folded forward

- `transcripts_witnessed` = every counted snapshot file must be
  authored live during the recording AND present on remote at the
  snapshotted commit. A local-only commit does not count.
- Check that the local branch is a descendant of origin/main before
  building, and push the record files — a diverged local clone is
  how round 5 lost two files.
- SUBMISSION.md (claim codes) must never be in the remote tree.
- A recording stopped the wrong way is unsealable and its state is
  lost — when that happens, re-author everything under a fresh
  recording; the lost session's files do not count.
- Local pre-submit green ≠ intake pass. The only proof is the
  transcript checks appearing with a pass in the status JSON, hours
  after submit. Never report intake passed before that.
- Keep the kit current: a stale kit uploads run records the site
  may reject.
- Estimate the authored share before submitting and do not submit
  below ~35% estimated; genuinely new content is the only thing
  that raises it.
