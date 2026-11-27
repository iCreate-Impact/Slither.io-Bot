# Changelog

All notable changes to the planner, driver and test documentation are recorded here. The format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Results are per-run displayed scores, not cumulative across restarts. See [docs/PERFORMANCE.md](docs/PERFORMANCE.md) for the full table and result-state definitions.

---

## [v0.4.0] - 2026-11-27

### Added

- **Modular source:** the trainer is split into foundation, world, map, hunt,
  feed, planner, control, panel and input modules under `panel/trainer/src/`.
  `panel/trainer/build.py` concatenates them into the checked-in `trainer.js`
  bundle; `--check` catches a stale bundle. The userscript, bookmarklet and
  tests still consume one runtime.
- **Strategic map/frontier layer:** a coarse visited grid, a sampled trail,
  coverage percentage and nearest-unvisited frontier. The frontier heading is
  a planner vote only when no hunt/feast is active, danger is calm and the
  nearby food field is thin. Coverage and frontier distance are shown in the
  panel; the **Explore** slider controls the vote.
- **Food-density value:** tight pellet streams and corpse clusters get a
  grid-based density boost. Food lanes reach farther, the default food pull is
  `1.15`, and food attraction is cut to `8%` while a hunt is live so a farm
  cannot pull the snake off a kill.
- **Peer hunting:** target selection now allows prey up to `100%` of the
  trainer's length when it is slower or crossing. A longer snake is still
  rejected, and the close-range head-on bailout still applies to peers.
- **Equal-size tail bait:** a same-size chaser behind the player is eligible
  for the trailing-body trap. This is a common live shape that the old `0.9`
  ratio gate ignored.
- **Client-state probe:** `panel/cheats/state_probe.js` is a read-only probe
  for visible arena, snake, food and trainer map state. It never writes
  steering/boost, sends packets, touches memory or starts a run. See
  `docs/CLIENT_PROBE.md`.

### Changed

- `hunt_peer` and `hunt_equal` now assert a kill; `tail_equal` covers the
  same-size chaser; `map_probe` asserts frontier coverage without food.
- The panel labels the hunt toggle **Hunt snakes** and adds an **Explore**
  slider and a map coverage/frontier line.
- Version is `0.4.0` in the trainer and userscript loader.

### Validated

- Closed-loop suite: `31/31` modes passed in installed Chrome and Edge,
  including the new peer, equal-tail and map modes, with zero simulated
  collisions.
- Takeover/input-shield suite: `31/31` checks passed in Chrome and Edge,
  including transient reconnect retention and grace-period death handling.
- Hunt/radar/UI suite: `42/42` checks passed in Chrome and Edge, including the
  new Explore control, map line, food-density weighting and arena-jitter map
  retention.
- Benchmark: `60 fps` with five enemies x `120` points.
- The production trainer still never launches a browser, navigates, clicks
  **Play**, reconnects, or creates a run.

### Known limitations

- The map is built only from client-visible state. It cannot reveal snakes or
  food the client has not received, and it does not add a server query.
- Equal peer kills remain harder than smaller-prey kills. The added tail bait
  does not make a head-on trade safe.
- No live v0.4.0 result is recorded in this changelog yet.

---

## [v0.3.0] - 2026-11-27

### Added

- **Earlier, wider hunting:** the trainer starts hunting at trainer length `6`
  instead of waiting for a long snake, the default aggression is `1.2`, the
  radar and threat range default to `2,400`, and the hunt lock is `4.2 s`.
- **Lead-intercept chase and stable flank:** a fleeing target is approached
  beside its nose instead of tail-first, and the chosen side is committed while
  that maneuver lasts.
- **Close cut and gated boost:** a close target gets a cut across its path, the
  cut boost is available from trainer length `12`, hunt boost is `700 ms` with a
  `450 ms` cooldown, and head-on escape boost is `1,200 ms`.
- **Tail-bait handling:** when a smaller, fast or boosting snake is chasing
  from behind, the trainer holds its current line instead of cutting across the
  chaser's nose.
  The body already behind the head becomes the trap, and the trainer does not
  boost away from a target that is trying to run into its tail.
- **Evasive-prey simulations:** `hunt_evasive` and `hunt_evasive_peer` exercise a
  target that flees the player's head and repels from its body. They are
  pressure/survival scenarios, not kill assertions. `tail_boost` and
  `tail_chase` assert the opposite case: a smaller chaser behind the player is
  killed by the trailing body.

### Changed

- **Fleeing runners are no longer free food.** A target that runs directly away
  at the trainer's speed or faster is skipped. A locked target that boosts or
  becomes an uncatchable runner is dropped instead of being chased across the
  map.
- **Head-contact bailout:** when the target is within `self radius + target
  radius + 70` and is at least `max(16, 75% of self length)` or boosting, the
  hunt is abandoned for `1.2 s`. This prevents the close-range coin flip where
  the trainer's head reaches the target body while the target's head is also
  close. A tail-bait chaser behind the player is exempt because the body is the
  trap; a genuinely tiny snake remains exempt as well.
- **Body-trap commitment:** a slower target can be pressed to zero clearance;
  an equal or faster target is dropped at half the normal danger clearance.
- **Hunt-cost handling:** food attraction is reduced to `25%` while a hunt is
  locked, and the uncatchable-target check applies before a new lock is taken.

### Fixed

- The trainer no longer reacquires the same target immediately after bailing
  out at head-contact range.
- A target that boosts away while locked no longer drags the trainer into a
  long, unwinnable chase.

### Validated

- Closed-loop suite: `28/28` modes passed in both installed Chrome and Edge,
  with zero simulated collisions.
- Takeover/input-shield suite: `29/29` checks passed in Chrome and Edge.
- Hunt/radar/UI suite: `38/38` checks passed in Chrome and Edge.
- Benchmark: `60 fps` with five enemies x `120` points and with 24 enemies x
  `140` points.
- Live pre-arm harness: a `180 s` run reached game-displayed length `666`
  (trainer score `647`, trainer length `39`) and rank `70` of `319` before the
  harness released it while still alive. A separate v0.3.0 death screen shows
  game final length `318`; the trainer stopped, stayed armed and did not click
  **Play Again**. No live kills were confirmed; see the limitations below.
- A later tail-bait live attempt survived `63 s` before a larger boosting snake
  closed in; it exercised the new mode but did not confirm a live kill.
- The production trainer still never launches a browser, navigates, clicks
  **Play**, reconnects, or creates a run. Only the test harness starts runs.

### Known limitations

- The live runs did not produce a confirmed kill. A target that flees perfectly
  and matches the trainer's speed can usually avoid a body trap in open space;
  the trainer now survives those pursuits instead of ramming them.
- Live rank and growth remain server-dependent. The best observed v0.3.0 score
  beat the prior `213` result, but it was not rank `1`. Short runs can still end
  in a crowded spawn or against a larger boosting snake.
- The live harness used bundled Chromium for local injection because the
  installed Edge channel blocked the local script fetch. The offline suite ran
  under both installed Chrome and Edge.

---

## [v0.2.1] - 2026-11-26

### Fixed

- **Trainer body ramming:** enemy bodies are collected independently of head
  distance, so a long snake whose head is outside the 2,400-unit threat range
  can no longer hide a body crossing directly in front of the player.
- **Body-point budget:** each snake keeps a bounded heap of its nearest body
  points, and the locked hunt target's body is prioritized before other bodies.
  This prevents a crowded scene or a long tail from dropping the body the
  planner is about to cross.
- **Planner/snapshot/radar consistency:** static head points and prioritized
  body points are separate lists; the planner, snapshots and radar all use the
  same body obstacle set.

### Added

- **Playwright regression suite (`panel/trainer/tests/`):** installed default
  Chrome/Edge detection, 18 closed-loop scenarios, 29 takeover/input-shield
  checks, 37 hunt/radar/UI checks, and a 5/24-snake FPS benchmark.
- **Body regressions:** `body_far_head`, `body_far_moving`,
  `body_target_last` and `body_many` cover static and moving head-far
  crossings, target-body priority under budget pressure, and multiple long
  bodies.
- **[docs/TRAINER_TESTING.md](docs/TRAINER_TESTING.md):** root cause, fix,
  test setup, validation results, live checklist and limitations.

### Validated

- Trainer v0.2.1 closed-loop suite: 18/18 modes passed with zero simulated
  collisions. `body_far_head` measured about 200 units minimum enemy clearance;
  `body_far_moving` about 221; `body_target_last` about 114; `body_many` about
  401.
- Trainer takeover suite: 29/29 checks passed.
- Trainer hunt/radar/UI suite: 37/37 checks passed.
- Trainer benchmark: 60 fps with five enemies x 120 points, and 60 fps with
  24 enemies x 140 points, using Playwright 1.59.0 with Chrome 155 and Edge
  158.0.4370.45.
- Live Edge run: the test harness started a run with the nickname `test`,
  injected v0.2.1 and took over. The first run reached length 213 and ended; the
  trainer stopped control, waited for a user-started run and did not click
  **Play Again**. An instrumented follow-up died in a head-on chase, not a
  head-far body crossing; the trainer was already escaping and stopped on
  death. A later run was released while alive and returned to manual control.
  The production trainer did not start any run. The game logged IPv6 WebSocket
  fallback errors during server selection; those were not trainer errors.

### Known limitations

- The offline mock does not reproduce live server collision resolution or
  latency. A short live test is still required before publishing.
- A live head-on chase against a faster or larger player can still end a run.
  v0.2.1 fixes body visibility, not every possible collision.
- A body with more than 64 sampled points inside the 2,520-unit body range
  keeps only its 64 closest points. Points farther along the same body can be
  omitted; the target body is prioritized and the closest crossing is retained.

---

## [Unreleased]

### Added

- **Browser trainer panel (`panel/trainer/`):** inject a control panel into an existing slither.io tab and take over the snake that is already on screen. It never launches a browser, navigates, clicks Play, reconnects, or creates a new run. Includes a Tampermonkey loader, a bookmarklet, hotkeys, a local radar, and a self-contained live-state planner.
- **Trainer v0.2.0 hunting and radar:** threat range expanded to 2,400 units with time-to-collision, closest-approach, crowd, wall and persistent faster-chaser detection; lead-intercept hunting with chase, coil, cut-across and body-trap maneuvers for smaller isolated snakes; corpse/feast detection from kills or dense big-pellet clusters; target locking, hunt-aware food weighting, and gated cut-off boost.
- **Trainer radar and controls:** 800–2,400 unit radar range slider, hunt toggle, aggression slider, target/feast overlays, and an emergency 40 ms panic turn for urgent head-on threats.
- **Self-body collision modeling:** above `SELF_COLLISION_MIN_LEN = 140`, the visible own-body trail is inserted into the planner grid with neck skipping, cumulative trail arc, tail-death expiry and a 120-segment cap.
- **Future-path self check:** candidates whose own rollout loops back within two body radii of an older self point are rejected. Active at length 140+.
- **Per-target reaction lag:** predicted enemy headings are held for roughly 0.05 s for fast tiny boosters and 0.09 to 0.11 s for ordinary and long snakes.
- **Open-sector escape bias:** eight surrounding sectors are scored every 400 ms from enemy and wall clearance and smoothed. Low-clearance sectors bias ordinary farming without diluting escape behaviour.
- **Proactive boosted-snake evasion:** the tiny-booster geometry is now applied to non-tiny boosters within about 1.1k units: run from a trail-side approach, cut perpendicular to a head-on approach.
- **Kill re-engage:** a confirmed kill or target disappearance opens a 10 s local window before returning to ordinary farming.
- **Result states:** `NO-DEATH`, `DIED`, `CANCELLED` and `FILTERED` are recorded explicitly in the README and performance log.
- **Contributor workflow:** `tools/sync_embedded.py`, CI syntax and sync checks, issue and PR templates, and an expanded contributor guide.
- `recon/recon_food.py` now accepts `--out`.

### Changed

- Recon scripts write to the current directory by default instead of a fixed temporary path.

### Fixed

- Reset `reengage`, `openBias`, `openSectorScores` and `lastOpenScan` on death, stall recovery and new-run paths.
- Target acquisition is gated off while a corpse lock is active.
- Body-collision kills use the previous head position as the corpse drop-search centre instead of losing the mass claim.

### Validated

- Trainer v0.2.0 closed-loop scenarios: `walls`, `wall`, `headon`, `cross`, `behind`, `hunt`, `hunt_cut`, `hunt_far`, `hunt_kill`, `hunt_flee`, `hunt_bigger`, `hunt_crowd`, `feast` and `radar` all survived 10 s with zero self-collisions; hunting scenarios scored kills.
- Trainer smoke suite: 29/29 checks passed, including takeover/release, handler restoration, input shielding, death handling and auto-rearm.
- Trainer behavior/UI suite: 37/37 checks passed, including chase/cut kills, corpse feasts, larger-snake and crowd rejection, radar range, and panel controls.
- Trainer benchmark: 60 fps with five large enemy snakes and 120 body points each.
- Lowered-threshold self-grid test: `[SELFGRID] len=8 segs=5 stride=1 body=235 skip=95`. Grid insertion and tail expiry were exercised.
- Path-self geometry tests: straight, 90°, 180° and 270° candidate turns kept positive self-clearance.
- Test 58: 4 min, 0 deaths, length 39, score 647, 1 kill.
- Test 63: length 62, score 1,093, 3 kills. Died in a 9 to 12 snake box-in.
- Test 64: 17 min across 3 starts, best length 59 / score 1,038, 2 kills.
- Test 65: 4 starts, best length 36 / score 589.
- Test 66: cancelled by the host at length 28 / score 433, no death.

### Known limitations

- Survival is the main limit. Best hunting-enabled run: length 102 / score 2,053. Latest planner best: length 62 / score 1,093. Longest zero-death run: 15 min, length 108 / score 2,244.
- Production self-grid behaviour at length 140+ has not been exercised in a live run.
- Multi-snake box-ins, boosted side and rear attacks, and boosted tiny snakes remain the dominant failures.
- Two long attempts were cancelled by the host environment, not by the game.

---

## [v2.1] — hunting planner

### Added

- **Offensive coil** (`window.__slitherHuntCoil`, default on): acquire smaller, slower targets at `me.sct >= 26`, lead-intercept approach, then spiral inward. Locks last up to 9 s and drop on crowd, big, fast or flee conditions.
- **Boost intercept** (`window.__slitherHuntBoost`, default on): two-phase cut-off gated on target ratio, range, rollout value and clearance. It stays dormant in most runs.
- **Corpse sweep** (`window.__slitherCorpseSweep`, default on): detect a rival kill from a burst of large pellets, lock the position for 9.5 s and weight corpse pellets 12x in path evaluation.
- **BIGRUN is opt-in** (`window.__slitherBigRun`, default off). The pre-BIGRUN baseline survived 15 min with zero deaths (length 108, score 2,244), while the BIGRUN era never passed length 60.
- Crowded-spawn filtering (`--start-max-threats`, `--abort-attempts`) and forced server selection (`--server ip:port`).
- Server sampler `probe_tops.py`.

### Changed

- 2.2 s rollout, 48 coarse + 64 fine candidates, 240 ms control lag.
- Threat capsules use birth-stamped moving head trails and velocity-dependent safety halos.
- Food is a soft attraction only when the neighbourhood is calm. Pellets inside a 220 to 420 unit enemy-head/body bubble are rejected.
- Crowd escape commits to one heading for about 1.1 s, and big-snake escape takes priority over crowd escape.

---

## [v2.0] — bot_v2.js

Full rewrite of the steering engine from the embedded v1 planner.

### Added

- 48 candidate headings with a 1.8 s rollout and 20 path steps.
- Spatial grid for static body capsules and moving head trails.
- Kill counter and stats fields in `window.__slitherBotStats`.
- Preferred-server hint and stall detection.
- Crowded-spawn reconnect filter.
- Nearby threat directions veto headings that steer into a body.
- Escape candidates ranked by first predicted overlap time, not exit clearance.
- Wall evasion cuts inward rather than hugging the rim.

### Results

- test 29 (pre-BIGRUN): 15 min, 0 deaths, length 108, score 2,244, 4 kills.
- test 32 (pre-BIGRUN): 20 min, length 78, score 1,449, 5 kills.

---

## [v1] — embedded BOT_JS (tests 1 to 28)

The original planner, embedded as a string in `slither_bot.py`.

### Behaviour

- Arena orbit at 0.64x radius with inward and outward corrections.
- Fixed flee radius when the nearest threat is inside alert range.
- Boost used only as an escape, never held.
- Food attraction disabled near threat bodies.
- Crowd term pushes away from the local centre of mass of nearby snakes.

### Best results

- Best score: 1,393 (test 28, length 75, 1 death).
- Median death length: 27.
