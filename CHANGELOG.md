# Changelog

All notable changes to the browser trainer, planner and test documentation are
recorded here. The format loosely follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

Results are per-run displayed scores, not cumulative across restarts. See
[docs/PERFORMANCE.md](docs/PERFORMANCE.md) for the run table and result-state
definitions.

---

## [v0.4.0] - 2026-11-27

### Added

- **Modular source:** the trainer is split into foundation, world, map, hunt,
  feed, planner, control, panel and input modules under `panel/trainer/src/`.
  `panel/trainer/build.py` concatenates them into the checked-in `trainer.js`
  bundle; `--check` catches a stale bundle. The userscript, bookmarklet and
  tests still consume one runtime.
- **Strategic map/frontier layer:** a coarse visited grid, a sampled trail,
  coverage percentage and nearest-unvisited frontier. Coverage and frontier
  distance are shown in the panel; the **Explore** slider controls the vote.
- **Stable map persistence:** the grid is compared against the actual arena
  geometry with a `650`-unit tolerance instead of a rounded bucket key. Live
  `flux_grd` drift no longer resets coverage to a single cell.
- **Food-density value:** tight pellet streams and corpse clusters get a
  grid-based density boost. Food lanes reach farther, the default food pull is
  `1.15`, and food attraction is cut to `8%` while a hunt is live so a farm
  cannot pull the snake off a kill.
- **Peer hunting:** target selection allows prey up to `100%` of the trainer's
  length when it is slower or crossing. A longer snake is still rejected.
- **Equal-size tail bait:** a same-size chaser behind the player is eligible for
  the trailing-body trap. This common live shape was ignored by the old `0.9`
  ratio gate.
- **Fast-peer bailout:** a target at least `55%` of the player's length and
  closing at `92%` of base speed is dropped at a `240`-unit contact margin. A
  closing booster gets a `150`-unit margin; a slower peer keeps the normal
  `70`-unit close cut. Reacquisition cooldown is `1600 ms`.
- **Body-pressure caution:** after a no-target frame with less than `30` units
  of clearance, farming/feast attraction is suppressed for `900 ms`. The guard
  is not applied while an active hunt is committing to a close cut.
- **Composite escape vector:** escape scoring now combines weighted vectors from
  every nearby non-target head, with boosted and larger heads counting more,
  instead of relying on a single nearest head.
- **Boost-path safety:** every boost gate re-evaluates the chosen line at boost
  speed and refuses a burst that would enter a body or wall. A burst is also
  cancelled when the planned line has negative clearance.
- **Client-state probe:** `panel/cheats/state_probe.js` is a read-only probe for
  visible arena, snake, food and trainer map state. It never writes
  steering/boost, sends packets, touches memory or starts a run. See
  `docs/CLIENT_PROBE.md`.

### Changed

- `hunt_peer` and `hunt_equal` assert a kill; `tail_equal` covers the same-size
  chaser; `map_probe` asserts frontier coverage without food.
- `hunt_early` receives a minimum `20 s` window. A `16 s` window occasionally
  ended with the trainer still circling a live target; that was a timing flake,
  not a collision or target-selection failure.
- The map arena-jitter UI check now moves the arena radius by `500` units,
  crossing the old `250`-unit bucket boundary while staying inside the new
  geometry tolerance.
- The panel labels the hunt toggle **Hunt snakes** and adds an **Explore**
  slider and a map coverage/frontier line.
- Version is `0.4.0` in the trainer and userscript loader.

### Removed

- Legacy Python recon scripts that imported a removed headless driver were
  retired. The read-only `panel/cheats/state_probe.js` is the current way to
  inspect the client surface; see `docs/CLIENT_PROBE.md`.

### Validated

- Closed-loop suite: `31/31` modes passed in installed Chrome and Edge,
  including peer, equal-tail, early-hunt and map modes, with zero simulated
  collisions.
- Takeover/input-shield suite: `31/31` checks passed in Chrome and Edge,
  including transient reconnect retention and grace-period death handling.
- Hunt/radar/UI suite: `42/42` checks passed in Chrome and Edge, including the
  Explore control, map line, food-density weighting and arena-jitter map
  retention.
- Benchmark: `60 fps` with five enemies x `120` points.
- Best v0.4.0 live run: `180.8 s`, trainer length `36`, displayed
  length/score `585`, rank `51`, `0` confirmed kills; released while alive.
  Coverage was `1.9%` (`13` of `673` cells). See
  [docs/PERFORMANCE.md](docs/PERFORMANCE.md).
- Earlier v0.4.0 safety runs ended at `66.6 s`, `94.6 s` and `60.1 s`. The
  `94.6 s` and `60.1 s` runs tested a feast-cooldown experiment that was
  reverted because it did not produce meaningful live coverage and the best
  survival run did not use it.
- The production trainer still never launches a browser, navigates, clicks
  **Play**, reconnects, or creates a run.

### Known limitations

- No live kill has been confirmed. Equal-speed kiters and boosted peers remain
  harder than the deterministic simulations.
- Rank `1` has not been reached. Server population and multi-snake box-ins still
  dominate live outcomes.
- The map is built only from client-visible state. It cannot reveal snakes or
  food the client has not received, and live crowd pressure can keep a run
  farming locally despite the frontier vote.
- A fast peer head-on now has an early bailout, but no live peer ram has been
  isolated as a confirmed save.

---

## [v0.3.0] - 2026-11-27

### Added

- **Earlier, wider hunting:** hunting starts at trainer length `6`, default
  aggression is `1.2`, radar/threat range defaults to `2,400`, and the hunt lock
  is `4.2 s`.
- **Lead-intercept chase and stable flank:** a fleeing target is approached
  beside its nose instead of tail-first, and the chosen side is committed while
  that maneuver lasts.
- **Close cut and gated boost:** a close target gets a cut across its path; cut
  boost is available from trainer length `12`, hunt boost is `700 ms` with a
  `450 ms` cooldown, and head-on escape boost is `1,200 ms`.
- **Tail-bait handling:** when a smaller, fast or boosting snake is chasing from
  behind, the trainer holds its current line instead of cutting across the
  chaser's nose. The body behind the head becomes the trap.
- **Evasive-prey simulations:** `hunt_evasive` and `hunt_evasive_peer` exercise
  a target that flees the player's head and repels from its body. They are
  survival/pressure scenarios, not kill assertions. `tail_boost` and
  `tail_chase` assert the opposite case: a smaller chaser behind the player is
  killed by the trailing body.

### Changed

- **Fleeing runners are no longer free food.** A target that runs directly away
  at the trainer's speed or faster is skipped. A locked target that boosts or
  becomes an uncatchable runner is dropped instead of chased across the map.
- **Head-contact bailout:** when the target is within `self radius + target
  radius + 70` and is at least `max(16, 75% of self length)` or boosting, the
  hunt is abandoned for `1.2 s`. This prevents the close-range coin flip where
  the trainer's head reaches the target body while the target's head is also
  close. A tail-bait chaser behind the player is exempt because the body is the
  trap; a genuinely tiny snake remains exempt as well. v0.4.0 extends this with
  the fast-peer and booster margins and the `1.6 s` cooldown.
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
- Live: a `180 s` run reached displayed length/score `666` (trainer score
  `647`, trainer length `39`) and rank `70` of `319` before release while still
  alive. A separate v0.3.0 death screen shows game final length `318`; the
  trainer stopped, stayed armed and did not click **Play Again**. No live kill
  was confirmed.
- A later tail-bait live attempt survived `63 s` before a larger boosting snake
  closed in; it exercised the new mode but did not confirm a live kill.
- The production trainer still never launches a browser, navigates, clicks
  **Play**, reconnects, or creates a run.

### Known limitations

- The live runs did not produce a confirmed kill. A target that flees perfectly
  and matches the trainer's speed can usually avoid a body trap in open space;
  the trainer survives those pursuits instead of ramming them.
- Live rank and growth remain server-dependent. The best observed v0.3.0 score
  beat the prior `213` result, but it was not rank `1`. Short runs can still end
  in a crowded spawn or against a larger boosting snake.

---

## [v0.2.1] - 2026-11-26

### Fixed

- **Trainer body ramming:** enemy bodies are collected independently of head
  distance, so a long snake whose head is outside the `2,400`-unit threat range
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
  Chrome/Edge detection, closed-loop scenarios, takeover/input-shield checks,
  hunt/radar/UI checks, and a 5/24-snake FPS benchmark.
- **Body regressions:** `body_far_head`, `body_far_moving`,
  `body_target_last` and `body_many` cover static and moving head-far
  crossings, target-body priority under budget pressure, and multiple long
  bodies.
- **[docs/TRAINER_TESTING.md](docs/TRAINER_TESTING.md):** root cause, fix, test
  setup, validation results, live checklist and limitations.

### Validated

- Trainer v0.2.1 closed-loop suite: 18/18 modes passed with zero simulated
  collisions. `body_far_head` measured about 200 units minimum enemy clearance;
  `body_far_moving` about 221; `body_target_last` about 114; `body_many` about
  401.
- Trainer takeover suite: 29/29 checks passed.
- Trainer hunt/radar/UI suite: 37/37 checks passed.
- Trainer benchmark: 60 fps with five enemies x 120 points, and 60 fps with
  24 enemies x 140 points.
- Live: the trainer reached displayed length `213`; the first run ended and the
  trainer stopped control, waited for a user-started run and did not click
  **Play Again**. An instrumented follow-up died in a head-on chase, not a
  head-far body crossing. A later run was released while alive and returned to
  manual control. The production trainer did not start any run.

### Known limitations

- The offline mock does not reproduce live server collision resolution or
  latency. A short live test is still required before publishing.
- A live head-on chase against a faster or larger player can still end a run.
  v0.2.1 fixes body visibility, not every possible collision.
- A body with more than 64 sampled points inside the body range keeps only its
  64 closest points. Points farther along the same body can be omitted; the
  target body is prioritized and the closest crossing is retained.

---

## Earlier history

Versions before v0.2.1 were headless planners. Their code and results are
retained in git history, but they are not part of the current browser-trainer
runtime and their scores are not directly comparable. The current product is the
takeover-only panel under `panel/trainer/`.
