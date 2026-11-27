# Architecture

## Runtime model

The production trainer is browser-only and takeover-only:

```text
user opens slither.io
  -> user starts a run
  -> user injects trainer.js (DevTools, userscript or bookmarklet)
  -> panel appears
  -> "Take over" attaches to the live snake
       reads:  window.slither, window.slithers, window.foods,
               window.grd, window.flux_grd, window.real_flux_grd
       writes: window.xm, window.ym       (steering offsets)
               window.slither.wmd, window.wmd (boost)
  -> "Release" or death stops control
```

The trainer never launches a browser, navigates, clicks **Play**, reconnects or
creates a run. Playwright is used only by the offline test harness. There is no
production Python driver in this path.

The client derives its target heading from the viewport-centre offsets:

```js
eang = Math.atan2(ym, xm)
```

The trainer writes that integer-free absolute vector directly. It does not emit
synthetic mouse events, and it temporarily shields the game's own mouse/touch
handlers while takeover is active.

## Source layout

The checked-in `panel/trainer/trainer.js` is a generated bundle. The maintained
source is split under `panel/trainer/src/`; `panel/trainer/build.py` concatenates
the modules in dependency order. The userscript, bookmarklet and tests all load
the bundle, so there is only one runtime.

| Module | Role |
| --- | --- |
| `00-foundation.js` | version, tunables, persisted settings, math helpers, shared state |
| `10-world.js` | self/arena readers, threats, bodies, food, corpse detection, kills |
| `15-map.js` | visited grid, sampled trail, coverage, calm-area frontier |
| `20-hunt.js` | target selection, peer rules, tail bait, danger, open-sector choice |
| `25-feed.js` | grid-based food-cluster density pass |
| `30-planner.js` | rollout scoring, hunt maneuvers, food lanes, boost gates |
| `40-control.js` | steering writes, release, snapshots, control tick |
| `50-panel.js` | shadow-DOM controls, radar, status, map readout |
| `60-input.js` | input shielding, takeover/release, auto-arm, hotkeys |
| `70-main.js` | animation loop, session lifecycle, public API, boot |

See [`TRAINER_MODULES.md`](TRAINER_MODULES.md) for build commands and the
module-by-module data flow.

## Planner tick

Each `requestAnimationFrame` callback inside takeover:

1. **Read state** from the client's own globals. `window.slithers` is treated as
   the visible snake list, not a server query. A body is collected even when its
   head is outside the threat radius.
2. **Sample the map** into a coarse visited grid and choose a frontier. This is
   instrumentation plus a calm-area steering vote, never a safety override.
3. **Collect threats** as head capsules and bounded nearest body points. The
   per-snake heap keeps the closest `64` points; the global body budget is `460`.
4. **Collect food** over the radar range, then rank it by distance, size, corpse
   membership and local density.
5. **Assess danger** with time-to-collision, closest-approach, wall distance,
   crowd size, and a persistent faster-chaser check. Tiny snakes are low-danger.
6. **Select a hunt target** only after passing size, distance, isolation, wall,
   flee, boost and cooldown gates.
7. **Choose an escape line** when danger is urgent. A head-on escape commits to a
   perpendicular world heading for `1.8 s`; other escapes commit for `1.1 s`.
8. **Generate headings** over the full circle plus a fine fan around the previous
   choice. Each is rolled out for `1.4 s`.
9. **Score the rollout**: head/body clearance, wall clearance, food lanes, hunt
   lead-intercept, body-trap geometry, escape bias, open-sector bias, map
   frontier, continuity and the final safety bonus/penalty.
10. **Refine** the winner with a narrow final fan.
11. **Gate boost** on clearance and wall margin. Boost is reserved for a close
    escape, a cut/chase on a valid target, or a committed peer hunt.
12. **Write steering** to `window.xm` / `window.ym` and the optional boost flag.

The strategic map, food and hunt terms can only choose among rollout paths that
keep clearance and wall margins; they do not bypass the safety checks.

## Key tunables

Defined in the tunables block in `panel/trainer/src/00-foundation.js`.

| Constant | Default | Meaning |
| --- | ---: | --- |
| `HORIZON` | `1.4 s` | Rollout lookahead |
| `STEPS` | `15` | Rollout samples |
| `CONTROL_LAG` | `0.24 s` | Steering/server delay before a turn applies |
| `TURN_RATE` | `4.125 rad/s` | Base client turn rate |
| `SPEED_MULT` | `31.25` | World units/s per `sp` unit |
| `BOOST_SPEED` | `430` | Boost speed assumed by the rollout |
| `COARSE_N` / `FINE_N` / `ULTRA_N` | `24` / `14` / `8` | Candidate counts |
| `THREAT_RANGE` | `2400` | Head/threat and radar range |
| `HEAD_MARGIN` | `26` | Extra head capsule margin |
| `BODY_HALF` | `14.5` | Rendered body half-width at `sc = 1` |
| `WALL_MARGIN` | `360` | Preferred wall clearance |
| `FOOD_RANGE` | `1900` | Food-lane range |
| `FOOD_REACH` | `360` | Rollout food catch radius |
| `FOOD_WEIGHT` / `FOOD_LANE_WEIGHT` | `24` / `12` | Food scoring weights |
| `HUNT_MIN_LEN` | `6` | Earliest deliberate hunt |
| `HUNT_MAX_RATIO` | `1.0` | No deliberate target longer than the player |
| `TAIL_BAIT_RATIO` | `1.0` | Equal-size chaser can be tail-baited |
| `HUNT_MAX_DIST` | `900` | Base hunt acquisition range |
| `HUNT_LOCK_MS` | `4200` | Target lock duration |
| `HUNT_FOOD_SCALE` | `0.08` | Food vote while a hunt is live |
| `MAP_BIAS` | `34` | Maximum calm-area frontier vote |
| `MAP_CELL` | `620` | Coverage grid cell size |
| `MAP_WALL_PAD` | `500` | Grid cells excluded near the wall |

## Feeding

- Food is collected out to the radar range, then ranked by distance discounted
  by value.
- A 3x3 spatial bucket pass adds a local density multiplier, so a pellet stream
  is worth more than an isolated pellet of the same size.
- Large pellets and corpse-cluster pellets are weighted super-linearly.
- A visible kill or a dense big-pellet cluster creates a timed feast site.
- Food pull defaults to `1.15`; while a hunt is live it is cut to `8%` so a
  pellet ring cannot pull the snake off a committed kill.

## Hunting

- Deliberate hunts reject snakes longer than the player.
- Peer prey up to `100%` of the player's length is eligible when it is slower or
  crossing. A target running directly away at the player's speed or faster is
  skipped.
- A same-size or smaller fast/boosting chaser behind the player is tail-baited:
  the trainer holds its line and lets the chaser's head hit the trailing body.
- Close head-contact against a peer, larger snake or booster triggers a `1.2 s`
  bailout and a short reacquisition cooldown. A tail-bait chaser is exempt
  because the body is the trap.
- Maneuvers: `hunt` (lead-intercept), `chase` (flank and close), `coil`
  (stand-off), `cut` (cross the nose), `bait` (hold for the body trap).
- A target that boosts away or becomes uncatchable is dropped rather than chased
  across the map.
- Food attraction is strongly reduced during a hunt; the cut/chase/peer boosts
  are gated by path clearance and wall margin.

## Map and exploration

The map layer marks the sampled trail on a coarse grid inside the arena wall
(`WALL_MARGIN +` extra pad). It reports:

- coverage (`visited / reachable cells`);
- visited and total cells;
- the current frontier target and distance.

The frontier vote is active only when no hunt or feast is running, danger is
calm, and the nearby food field is thin. The **Explore** slider scales that
vote. The map is built only from state the client already received; it does not
reveal hidden snakes or food and does not query the server.

## Takeover and input

- The panel lives in a shadow root, so game CSS cannot reach it.
- While active, the trainer writes `xm`/`ym`, sets boost on the snake and legacy
  global, and temporarily replaces the game's mouse/touch handlers.
- Outside-panel game input is blocked while takeover is active.
- Release restores the original handlers and clears legacy keyboard flags.
- Death stops control, cancels boost, optionally stays armed, and never clicks
  **Play Again**. A new run started by the user is taken over only when
  auto-arm is enabled.

## Client-state surface

All fields are on `window`; they are read for planning and diagnostics.

| Global | Use |
| --- | --- |
| `window.slither` | self: `id`, `xx`, `yy`, `ang`, `sp`, `sc`, `scang`, `sct`, `pts` |
| `window.slithers` | visible snakes with the same shape plus `dead` |
| `window.foods` | pellets: `xx`, `yy`, `sz` |
| `window.grd` | arena centre, normally `(grd, grd)` |
| `window.flux_grd`, `window.real_flux_grd` | arena radius candidates; the smaller valid value is used |
| `window.playing` | whether a run is live |
| `window.rank` | leaderboard rank, display only |

`panel/cheats/state_probe.js` is a read-only probe for this surface. It never
writes game fields or sends packets. See [`CLIENT_PROBE.md`](CLIENT_PROBE.md).

## Panel and radar

- Six status cells: length, score, rank, nearby threats, FPS, clearance.
- Frozen `Kills` count and current target/feast line.
- Map line: coverage, cell count and frontier distance.
- Local radar: enemy heads, enemy body points, target, food/corpse food, self
  body and planned path.
- Controls: hunt toggle, safety, food pull, explore, aggression, radar range,
  boost permission, auto-arm, takeover/release, minimize/hide.
- Hotkeys: `Alt+B` panel, `Alt+T` takeover, `Alt+Shift+X` release.

## Tests

The offline suite is test-only and never contacts slither.io:

```text
python panel/trainer/tests/run_all.py
```

It covers 31 closed-loop modes, 31 takeover/input checks, 42 hunt/radar/UI
checks, and a 5-enemy FPS benchmark. See
[`TRAINER_TESTING.md`](TRAINER_TESTING.md) and
[`TRAINER_MODULES.md`](TRAINER_MODULES.md).

## Limits

- The client is server-authoritative. The trainer only requests legitimate
  local steering and boost; it does not edit length, speed, health, collision
  results, packets or another snake's state.
- The map only knows what the client has received.
- A perfect equal-speed kiter can still avoid a body trap in open space.
- A live head-on chase against a faster or larger snake can still end a run.
- Live rank and growth are server-dependent; offline tests prove geometry and
  safety invariants, not a leaderboard result.
