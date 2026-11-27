# Slither.io Trainer Panel

A browser-injectable control panel for a **live** slither.io run. You start the
game normally in your own browser, spawn your snake, then inject the panel. The
panel attaches to that page and takes over the snake that is already on screen.

It does **not** launch Playwright or Chromium, open a tab, navigate, click
**Play**, reconnect, or start a new snake. If there is no live run, it waits.
If the snake dies, it stops steering and never restarts the game for you.

```text
you open slither.io  ->  you press Play  ->  you inject trainer.js
                                             |
                                             +-> "Take over" drives that snake
                                             +-> "Release" returns control
```

The distributed trainer is a self-contained bundle; users do not need Python
or a build step. The source is modular for maintenance, and rebuilding the
bundle is only needed after editing `panel/trainer/src/`. There is no
production Python driver in this repository; Python and Playwright are used
only by the offline test harness and diagnostics.

### What is new in v0.4.0

- **Peer hunting:** deliberate hunts now allow prey up to `100%` of the
  trainer's length when it is slower or crossing. A snake longer than the
  player is still rejected, and head-on peers still trigger the close bailout.
- **Equal-size tail bait:** a same-size chaser behind the player can be killed
  by the trailing body. The old `0.9` length gate was the only reason this
  common live shape was ignored.
- **Map exploration:** a coarse visited grid and a low-coverage frontier now
  give the planner a calm-area sweep target. Coverage and frontier distance are
  shown above the radar. The **Explore** slider controls the vote.
- **Better feeding:** food lanes are wider, tight pellet streams are weighted by
  local density instead of distance alone, and the default food pull is `1.15`.
  Food attraction is cut to `8%` while a hunt is live so a farm cannot pull the
  snake off a committed kill.
- **Fast-peer bailout:** a target at least `55%` of the player's length that is
  closing at `92%` of the player's speed is dropped at a `240`-unit contact
  margin. A slower peer still gets the normal close cut, so the trainer does
  not turn every winnable hunt into a stalemate.
- **Body-pressure caution:** after a no-target frame with less than `30` units
  of clearance, feast/farm attraction is suppressed for `900 ms`. The guard is
  disabled while an active hunt is committing, where a close cut is expected.
- **Stable map persistence:** the visited grid compares against the actual
  arena geometry with a `650`-unit tolerance instead of a rounded bucket key.
  Live `flux_grd` drift no longer resets coverage to one cell.
- **Source modules:** the trainer source is split into planner, world, map,
  feed, hunt, control, panel and input files. `trainer.js` remains the single
  bundle consumed by the userscript, bookmarklet and tests.

### What was new in v0.3.0

- Hunting starts at length `6`, default aggression is `1.2`, and the radar,
  threat range and default radar view are all `2,400` units.
- Lead-intercept chase, a committed flank, a close cut, and a gated hunt boost
  make the trainer press smaller targets instead of following them forever.
- A target that runs directly away at the trainer's speed or faster is skipped.
  A locked target that boosts away or turns into an uncatchable runner is
  dropped instead of being chased across the map.
- At head-contact range the trainer bails out for `1.6 s` against a peer,
  larger snake or booster, so it cannot turn straight back into the body it
  just escaped. A genuinely tiny snake is still fair game.
- Fixed the v0.2.1 body-ramming failure: a long snake's body is collected even
  when its head is outside the `2,400`-unit threat range, and the target's body
  is prioritized in the shared body-point budget.
- Added evasive-prey simulations. They are survival/pressure scenarios: a
  perfect equal-speed kiter can avoid a body trap in open space, so those modes
  do not require a kill.
- Added tail-bait handling and regression modes. A smaller, fast or boosting
  snake chasing from behind is now allowed to run into the trailing body; the
  trainer holds its line instead of cutting its own body out of the way.

### Earlier features

- Threat range expanded from `1,200` to `2,400` units, with time-to-collision,
  closest-approach, crowd, wall and faster-chaser detection.
- Hunt smaller, isolated snakes with lead-intercept, chase, coil, cut-across and
  body-trap behaviour. It still flees real danger.
- Corpse/feast detection: a kill or a dense big-pellet cluster becomes a
  temporary high-value food site.
- Radar range slider (`800`–`2,400`), hunt toggle, aggression slider and a
  clearer target/feast overlay.
- Panic turns for urgent head-on threats and a gated cut-off boost that is only
  used when the path is already clear.

---

## Quick start (DevTools, works immediately)

1. Open <https://slither.io> in your browser and start a run manually.
2. Press `F12` (or `Ctrl+Shift+I`) to open DevTools, then open the **Console**.
3. Open `panel/trainer/trainer.js`, copy the whole file, paste it into the
   console, and press `Enter`.
4. The **SLITHER TRAINER** panel appears in the top-right corner.
5. Click **Take over**. The bot now drives the snake you already spawned.
6. Click **Release** (or press `Alt+Shift+X`) to give control back instantly.

The panel is injected into the current page only. Reloading the page removes it;
paste it again if needed.

> Chrome may ask you to type `allow pasting` the first time you paste code into
> the DevTools console. That is normal.

---

## Userscript (auto-inject on every visit)

1. Install [Tampermonkey](https://www.tampermonkey.net/) or a compatible
   userscript manager.
2. Create a new userscript and paste the contents of
   [`trainer.user.js`](trainer.user.js).
3. Save it, then reload <https://slither.io>.

`trainer.user.js` loads `trainer.js` through its `@require` URL. If you use a
fork or a different branch, change that URL to your copy. The userscript also
shows a small warning if the `@require` file could not be loaded.

---

## Bookmarklet

[`bookmarklet.txt`](bookmarklet.txt) contains a one-line bookmarklet that loads
`trainer.js` from jsDelivr. Create a bookmark and paste that line as its URL.
It requires the file to be published at the URL in the bookmarklet. If the
site's Content Security Policy blocks external scripts, use the DevTools
method instead.

> **Published URL required.** The userscript and bookmarklet default to the
> `main` branch of `ichidera/Slither.io-Bot`. Those URLs only serve the trainer
> after `panel/trainer/` has been committed and pushed there. Until then, or for
> a fork, point the loader at your own published copy, or use the DevTools
> method above.

---

## Controls

| Control | What it does |
| --- | --- |
| **Take over** | Starts steering the live snake. If no snake is live, it arms and waits for the next run you start. |
| **Release** | Stops steering and restores the game's own mouse/touch handlers. |
| **Re-arm after death** | When checked, a death stops control but leaves the trainer armed. When you start the next run yourself, it takes over automatically. |
| **Hunt snakes** | Enables target selection. Peer-sized prey is eligible when it is slower or crossing; a longer snake is still rejected. |
| **Safety** | Extra clearance in world units added to every obstacle. Higher is more cautious. |
| **Food pull** | How strongly the planner is attracted to pellets. `0` disables farming; `2` is aggressive. Food pull is reduced to `8%` while a hunt target is locked. |
| **Explore** | `0` disables map-frontier steering; `1` sweeps unexplored ground aggressively when the local farm is thin and no hunt/feast is active. |
| **Aggro** | `0` disables hunting. Higher values allow a longer target range and, above `1.5`, one extra nearby head. |
| **Radar range** | Rendered radar radius from `800` to `2,400` world units. The planner itself always watches up to `2,400`. |
| **Allow gated boost** | Allows short boost bursts for a close escape or a gated cut-off on a smaller target. It never boosts just to chase food. |
| **Radar** | Local view: pink = enemy heads, orange = enemy body points, red/pink target = locked prey, green = food, amber = corpse/feast food, teal = your body and planned path. |
| **Map line** | Coverage percentage, visited grid cells and distance to the current exploration frontier. |
| **Header drag** | Move the panel. The position is saved for the next injection. |
| **Minimize / hide** | Collapse the panel to its header, or hide it to the round **T** button (`Alt+B` restores it). |

### Hotkeys

| Keys | Action |
| --- | --- |
| `Alt+B` | Show or hide the panel |
| `Alt+T` | Take over / release |
| `Alt+Shift+X` | Emergency release (always returns control) |

The hotkeys work while the panel is hidden and while the game has focus.

---

## How takeover works

The slither.io client reads steering from two globals:

```js
window.xm, window.ym   // mouse offset from the centre of the viewport
window.slither.wmd     // boost (the current client stores it on the snake)
```

`window.onmousemove` normally writes `xm = clientX - innerWidth / 2` and
`ym = clientY - innerHeight / 2`; the client then uses
`Math.atan2(ym, xm)` as the target angle. While takeover is active the panel:

1. Saves and temporarily replaces the game's `onmousemove`, `onmousedown`,
   `ontouchstart`, `ontouchmove` and `ontouchend` handlers.
2. Adds capture-phase guards for mouse, pointer, touch, click, wheel and the
   boost/steering keys, so the game cannot overwrite the bot's steering.
3. Writes `xm` / `ym` every animation frame and sets
   `window.slither.wmd` (plus `window.wmd` for older builds) only when a
   gated escape or cut-off boost is wanted.
4. Leaves all events that target the panel alone, so the panel stays usable.
5. On release, restores the saved handlers, clears boost, and leaves the snake
   heading in its current direction. The next real mouse move takes over.

The panel never calls `play_btn`, `resetGame`, `connect`, or any socket method.
Death detection only reads `window.playing`, `window.slither.id` and the game
state. A death ends control; it does not click **Play Again**.

### Session behaviour

| Situation | Panel behaviour |
| --- | --- |
| Start screen, no snake | `Waiting for a run — start it yourself` |
| Live snake, trainer idle | Shows stats; radar updates; no steering |
| Take over clicked while live | Control starts immediately |
| Take over clicked while not live | Arms; control starts when a live snake appears |
| Snake dies while controlling | Control stops. With **Re-arm after death** on, it waits armed for the next run you start. It never creates that run. |
| Release clicked / hotkey | Control stops, handlers restore, trainer disarms |

---

## Hunting, feasts and threat model

The trainer does not flee from every snake. It measures each nearby head with a
time-to-collision model: relative velocity, closest approach, crowd pressure,
wall distance, boost state and size. A snake that is moving away or passing wide
is ignored; a faster snake sitting behind you is treated as a persistent chase
threat even before it starts closing.

Body points are collected independently of the head distance. A head 2,600
units away does not hide a body crossing 300 units in front of you. Within the
body budget, the locked target's body is always planned against first; other
bodies follow nearest-first. This matters in a crowd, where a long tail or a
different snake could otherwise consume every available body point.

When hunting is enabled, a target must pass all of these gates:

- It is no longer than you: peer prey up to `100%` of your length is eligible,
  but only when it is slower or crossing. The trainer never deliberately hunts a
  snake longer than itself.
- It is isolated: at most one other head within `520` units of the target by
  default.
- It is within the hunt range (`900` units before the aggression scaling) and
  not sitting against the arena wall.
- It is not a fast booster far away, and it is not a snake running directly
  away at the trainer's speed or faster.

A locked target is kept for up to `4.2 s` so the trainer does not flicker
between two candidates. While locked, food attraction is cut to `8%`. A
locked target that boosts away or becomes an uncatchable runner is dropped
rather than followed. A slower target is pressed all the way in; an equal or
faster target is dropped at half the normal danger clearance. If another snake
becomes an urgent threat, the hunt is abandoned first.

| Maneuver | When it is used | What it does |
| --- | --- | --- |
| **hunt** | Target is far or crossing | Lead-intercept toward its future position. |
| **chase** | Target is running away and is catchable | Overtakes alongside the target's body instead of rear-ending its tail, then closes the gap. |
| **coil** | A close, equal-or-faster target is not fleeing | Spirals at a stand-off distance to make it turn into your body. |
| **cut** | Target is head-on, you are ahead of it, or it is slow and close | Cuts across its nose; a smaller snake that hits your trailing body dies. |
| **bait** | A fast or boosting snake of equal-or-smaller length is chasing from behind | Holds the current line so the trailing body stays in the chaser's path; no boost. |
| **bailout** | Head-contact range against a peer, larger snake or booster | Abandons the hunt for `1.6 s` and lets the body planner handle the threat. |

A target is not worth a head-on coin flip. The close bailout uses the player
radius plus the target radius plus a contact margin, and does not reacquire
that target for `1.6 s`:

- **Peer:** target length at least `max(16, 75% of self length)`. The normal
  closing margin is `70` units.
- **Fast peer:** target length at least `max(5, 55% of self length)` and speed
  at least `92%` of the player's base speed. A target closing toward the player
  gets a `240`-unit margin, so the cut is abandoned while an escape line still
  exists.
- **Booster:** a boosting target closing toward the player gets a `150`-unit
  margin.

A tail-bait chaser already behind the player is exempt because the trailing
body is the trap. A genuinely tiny, slower snake also keeps the close cut,
because its short body cannot cover the same distance. If the best rollout is
still below half the normal `18`-unit danger clearance, the trainer drops the
hunt and treats the situation as a survival problem. When an urgent head-on
threat is inside `340` units, the rollout uses a short `40 ms` panic reaction
instead of the normal `240 ms` control lag so it can still turn away.

A confirmed kill, or any visible death within `900` units, creates a feast site
for `12 s`. Large pellets around that site are weighted much more heavily than
ordinary food. A dense cluster of big pellets can also be recognised as a
corpse without seeing the kill. A corpse expires normally; it is not re-created
just because the local field is still dense.

---

## Planner

The trainer uses a compact live-state planner, not the full 2.2 s / 112-candidate
rollout described in the main project docs. It reads the game's own state
(`window.slither`, `window.slithers`, `window.foods`, `window.flux_grd`,
`window.grd`) and scores candidate headings:

- 24 coarse headings over the full circle, 14 fine headings around the previous
  choice, and 8 ultra-fine refinements around the winner.
- A 1.4 s rollout with the client's turn-rate scaling (`scang`), a 240 ms
  control lag, and a 40 ms panic lag for urgent head-on threats.
- Clearance to enemy heads, predicted head ghosts, local enemy body points and
  the local part of the player's own body.
- Time-to-collision, closest-approach and persistent faster-chaser checks for
  every visible head inside `2,400` units.
- Arena-wall clearance, crowd pressure, and a committed escape heading.
- Soft food attraction, weighted by pellet size, with corpse pellets and tight
  pellet clusters boosted.
- A map-frontier vote for unexplored ground when the local farm is thin, no
  hunt/feast is active and the trainer is not escaping. The frontier is only a
  score; the rollout can refuse it.
- Hunt scoring for lead-intercept, chase, coil, cut-across and body-trap paths.
  Target avoidance is softened above `26` units so a cut can close, but below
  the `18`-unit danger margin it becomes a hard safety penalty again.
- A small continuity bonus to avoid oscillating between two equally safe paths.
- Gated boost bursts only for a close escape or a clear cut-off; never for
  ordinary food.

The planner is deliberately conservative about body clearance. It is intended
for experimenting with a live session, not for unattended leaderboard farming.
Raise **Safety** if it feels reckless, lower **Aggro** to reduce hunting, or
turn **Hunt snakes** off entirely.

### Live validation

The test harness injects the trainer after the snake is live and clicks
**Take over**. The production trainer itself never starts, navigates or
restarts a run.

| Result | Observation |
| --- | --- |
| Best v0.4.0 run | `180.8 s`, trainer length `36`, game-displayed length/score `585`, rank `51`, `0` confirmed kills; harness released it while still alive. |
| Earlier v0.4.0 run | Ended at `66.6 s`; the trainer stopped and stayed armed. The final panel values were not captured cleanly because the death screen cleared the live fields. |
| Best v0.3.0 run | `180 s`, game-displayed length/score `666`, trainer score `647`, trainer length `39`, rank `70` of `319`; released while still alive. |
| Death screen | A separate v0.3.0 run ended at game final length `318`; the trainer stopped, stayed armed and did not click **Play Again**. |
| Kills | No live kill has been confirmed. Fleeing equal-speed targets, perfect kiters and boosting near-peers are still the weak case. |
| Map | `1.9%` coverage (`13` of `673` cells) in the best v0.4.0 run. The frontier is a calm-area vote; repeated crowd pressure kept the run farming locally. |

| Screenshot | What it shows |
| --- | --- |
| [`assets/trainer_v040_headed_180s.png`](../../assets/trainer_v040_headed_180s.png) | Best v0.4.0 run at `180 s`: trainer length `36`, displayed length/score `585`, rank `51`. |
| [`assets/trainer_v040_headed_release.png`](../../assets/trainer_v040_headed_release.png) | The same run after **Release**: control returns without restarting. |
| [`assets/trainer_v030_prearm3_start.png`](../../assets/trainer_v030_prearm3_start.png) | v0.3.0 takeover on a fresh run at length `2` with nearby threats and the `2,400` radar. |
| [`assets/trainer_v030_prearm3_end.png`](../../assets/trainer_v030_prearm3_end.png) | The `180 s` v0.3.0 run at trainer length `39`, displayed length `666`, rank `70`. |
| [`assets/trainer_v030_prearm3_death.png`](../../assets/trainer_v030_prearm3_death.png) | Game final length `318`; trainer armed and waiting, **Play Again** untouched. |

The best v0.4.0 live run used headed Chrome. Edge automation was blocked by the
site's local-script fetch (`net::ERR_BLOCKED_BY_CLIENT`), while the offline Edge
suite runs normally. Rank `1` was not reached, and the displayed length target
was exceeded in v0.3.0 but not in every run.

---

## Tests

The offline Playwright suite is in [`tests/`](tests/README.md). It uses the
installed default browser (Chrome or Edge) and never contacts slither.io. The
trainer itself still never launches a browser; the harness is test-only.

```bash
python -m pip install -r panel/trainer/tests/requirements.txt
python panel/trainer/tests/run_all.py

# Force the suite through Edge
TRAINER_BROWSER=msedge python panel/trainer/tests/run_all.py
```

Use `--headed` to watch a run, or run one suite directly:

```bash
python panel/trainer/tests/test_modes.py
python panel/trainer/tests/test_takeover.py
python panel/trainer/tests/test_hunt_radar.py
python panel/trainer/tests/bench.py --enemies 24 --segments 140
```

The `31`-scenario closed-loop suite includes `body_far_head`,
`body_far_moving`, `body_target_last` and `body_many` for the body fix,
`hunt_evasive` and `hunt_evasive_peer` for close pursuit against a target that
flees and repels from the body, `hunt_peer`/`hunt_equal` for peer kills,
`tail_boost`/`tail_chase`/`tail_equal` for a chaser behind the player, and
`map_probe` for frontier coverage. The evasive modes are survival/pressure
scenarios, not kill assertions; the tail and peer modes assert a kill. See
[`docs/TRAINER_TESTING.md`](../../docs/TRAINER_TESTING.md) for geometry and
validation, and [`docs/TRAINER_MODULES.md`](../../docs/TRAINER_MODULES.md) for
the source layout.

### Build

The checked-in `trainer.js` is generated from `panel/trainer/src/`. After
editing a module:

```bash
python panel/trainer/build.py
python panel/trainer/build.py --check
```

The userscript, bookmarklet and tests all consume the bundle, so there is no
second runtime with different behaviour.

---

## Files

| File | Purpose |
| --- | --- |
| `trainer.js` | Self-contained generated bundle. Paste this into the DevTools console or serve it as a script. |
| `src/` | Maintainable source modules; rebuild the bundle after edits. |
| `build.py` | Concatenates the modules into `trainer.js`; `--check` detects a stale bundle. |
| `trainer.user.js` | Tampermonkey/Greasemonkey loader. Loads `trainer.js` with `@require`. |
| `bookmarklet.txt` | One-line bookmarklet for a published copy of `trainer.js`. |
| `tests/` | Offline Playwright scenarios, takeover/UI checks and the FPS benchmark. |
| `../cheats/state_probe.js` | Read-only client-state probe; see `docs/CLIENT_PROBE.md`. |
| `README.md` | This file. |

---

## Troubleshooting

**The panel does not appear.**
Check the DevTools console for errors. Make sure you are on `https://slither.io`
and that the whole `trainer.js` file was pasted, including the final `})();`.
If a userscript manager is installed, its `@require` URL may be wrong.

**The status says "Waiting for a run".**
Start a run manually. The panel requires `window.playing` and a positive
`window.slither.id`. It will not press Play for you.

**The snake does not move after Take over.**
Another userscript or injected planner may also be writing `xm`/`ym`. Run only
one planner at a time. Reload the page to clear the other one.

**Clicking the panel boosts the snake.**
That should not happen. Panel events are shielded whether takeover is active
or idle. If it still happens, another injected script is also handling mouse
input; remove it and reload.

**The panel disappeared after a reload.**
Injected scripts do not survive navigation. Use the userscript if you want it
to load automatically, or paste `trainer.js` again.

**Can I use it on a phone or tablet?**
The panel uses touch input shields and should render, but it is designed for a
desktop browser with DevTools. The userscript route is the practical option on
mobile.

---

## Responsible use

This is a research tool for planning and collision avoidance. It is not
affiliated with Slither.io or Lowtech Studios. Using bots may break the game's
terms of service. Run it sparingly, one instance at a time, and do not use it to
disrupt other players or to hammer the game's servers. Use it at your own risk.
