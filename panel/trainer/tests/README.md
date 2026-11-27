# Trainer tests

Offline Playwright tests for `panel/trainer/trainer.js`. The trainer itself
never launches or controls a browser; only this test harness does. The test
pages are local files, so the closed-loop suite does not connect to slither.io.

The harness prefers the browser that owns the default HTTP handler on Windows:
`ChromeHTML` uses Playwright's installed Chrome channel, and `MSEdgeHTM` uses
Edge. It falls back to the other installed channel, then to bundled Chromium.
Override detection with `TRAINER_BROWSER=chrome`, `msedge`, or `chromium`.

## Setup

```bash
python -m pip install -r panel/trainer/tests/requirements.txt
```

Installed Chrome/Edge is used directly. Bundled Chromium is only needed when
neither channel is available:

```bash
python -m playwright install chromium
```

## Run everything

```bash
python panel/trainer/tests/run_all.py

# Force the full suite through Edge
TRAINER_BROWSER=msedge python panel/trainer/tests/run_all.py
```

On PowerShell, set the environment variable first:

```powershell
$env:TRAINER_BROWSER='msedge'; python panel/trainer/tests/run_all.py
```

`--headed` shows the browser. `--quick` cuts the closed-loop scenarios to four
seconds each. The full suite is about two to three minutes on the reference
machine.

## Run individual suites

```bash
# 31 closed-loop collision, wall, hunting, peer/equal, tail-bait, map, body, feast and radar scenarios
python panel/trainer/tests/test_modes.py

# 31 takeover, release, transient reconnect, death-handling and input-shield checks
python panel/trainer/tests/test_takeover.py

# 42 hunt, corpse-feast, radar, map/Explore and panel-control checks
python panel/trainer/tests/test_hunt_radar.py

# planner FPS with a synthetic crowd
python panel/trainer/tests/bench.py
python panel/trainer/tests/bench.py --enemies 24 --segments 140 --min-fps 50
```

Useful options:

```bash
python panel/trainer/tests/test_modes.py --seconds 5
python panel/trainer/tests/test_modes.py --modes body_far_head,body_target_last
python panel/trainer/tests/test_takeover.py --headed
```

## Body regression scenarios

| Scenario | What it proves |
| --- | --- |
| `body_far_head` | A body crossing 300 units in front is avoided even when its head is outside the 2,400-unit threat range. |
| `body_far_moving` | A head-far body sweeps sideways through the path and remains visible to the planner. |
| `body_target_last` | The locked target's body is planned against first when eight head-far bodies compete for the body-point budget. The test also asserts that the target body appears in the snapshot. |
| `body_many` | Ten long, head-far bodies around the spawn do not cause a body collision. |

`body_far_head` reproduced the live ramming bug before the v0.2.1 fix: the
enemy head was 2,600 units away, its body crossed the trainer's path, and the
trainer died with one collision. After the fix it completes with zero
collisions and roughly 200 units of minimum enemy clearance.

## Evasive-prey scenarios

| Scenario | What it proves |
| --- | --- |
| `hunt_evasive` | An equal-speed target flees the trainer's head and repels from its body. The trainer must survive and keep pressure without ramming. |
| `hunt_evasive_peer` | The same behaviour with a near-peer target. The trainer must survive the close pursuit; a kill is not required. |

These are deliberately not kill assertions. A target that always turns away and
matches the trainer's speed can avoid a body trap in open space; the useful
regression is that the trainer no longer cuts into its body while trying.

`tail_boost`, `tail_chase` and `tail_equal` cover the opposite geometry: a
fast or boosting snake of equal-or-smaller length is behind the player, driving
toward it, and is committed enough to catch the tail. The trainer must hold its
line and let the trailing body kill the chaser, without a collision or a boost
escape. These modes do assert `kills >= 1`.

`hunt_peer` and `hunt_equal` add slower/crossing peer targets. A longer snake is
still not a deliberate target. These modes assert a kill and zero collisions.

`map_probe` runs with no food and no threats, so the only steering signal is the
map frontier. The test asserts that the sampled trail covers more than `1%` of
the reachable grid and at least three cells. A frontier path still has to pass
the normal rollout clearance and wall checks.

`hunt_early` gets a minimum `16 s` window because the first cut can overshoot the
short target. `hunt_peer`, `hunt_equal`, `hunt_evasive` and `hunt_evasive_peer`
get at least `12 s`; the tail and map modes get at least `10 s`; the runner still
accepts a larger `--seconds` value.

## Reference result

Validated with Playwright 1.59.0, headless mode, using the installed Chrome
and Edge channels:

```text
test_modes.py       31/31 modes passed (Chrome and Edge)
test_takeover.py    31/31 checks passed (Chrome and Edge)
test_hunt_radar.py  42/42 checks passed (Chrome and Edge)
bench.py             60 fps, 5 enemies x 120 points (Chrome and Edge)
```

Console and page errors are treated as failures. The closed-loop suite also
fails on any simulated collision, a non-positive wall clearance, or a missing
takeover.

## Limits

These are geometry and UI tests, not a replacement for a live run. The mock
pages approximate the client's trail, turn, speed and collision model, but they
do not reproduce server latency, other players' decisions, anti-cheat, or the
live server's exact collision resolution. A live head-on chase against a faster
or larger player can still end a run; these tests prove the body-ramming
regression and the close-pursuit safety checks, not invincibility.

The v0.3.0 live harness reached game-displayed length `666` (trainer score
`647`, rank `70` of `319`) in a `180 s` run and released the live snake. A
separate death screen showed game final length `318`; the trainer stayed armed
and did not press **Play Again**. No live kill was confirmed; a perfect
equal-speed kiter is still the hard case. The live harness used bundled
Chromium for local injection because the installed Edge channel blocked the
local fetch; the offline suite ran in both installed Chrome and Edge. Run a
short manual live session before publishing a trainer change. See
[`docs/TRAINER_TESTING.md`](../../../docs/TRAINER_TESTING.md) for the full test
protocol, live results and screenshots.
