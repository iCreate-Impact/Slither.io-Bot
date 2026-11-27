# Trainer modules and planner layers

The browser trainer is shipped as one file because the userscript, bookmarklet
and Playwright harness all need to load exactly the same runtime. The source is
split into small modules in `panel/trainer/src/`; `panel/trainer/build.py`
concatenates them in dependency order into `panel/trainer/trainer.js`.

```text
python panel/trainer/build.py          # rebuild trainer.js
python panel/trainer/build.py --check  # fail if the bundle is stale
```

Tests continue to load the bundle. This keeps the takeover boundary honest:
there is no second runtime with different behaviour.

## Module map

| Source | Responsibility |
| --- | --- |
| `00-foundation.js` | version, planner constants, persisted settings, math helpers, shared state |
| `10-world.js` | game-state readers: arena, self, threats, enemy bodies, food, corpse clusters, kill confirmation |
| `15-map.js` | coarse visited grid, sample trail, coverage metric, calm-area frontier heading |
| `20-hunt.js` | hunt target selection, peer rules, equal-size tail bait, danger assessment, open-sector choice |
| `25-feed.js` | food-cluster density pass and value weighting |
| `30-planner.js` | rollout evaluation, collision/wall scoring, food lanes, hunt maneuvers, boost gates |
| `40-control.js` | input writes, release, snapshots, control/sample ticks |
| `50-panel.js` | shadow-DOM panel, controls, radar, status and map readout |
| `60-input.js` | input shielding, takeover/release, auto-arm, hotkeys |
| `70-main.js` | animation loop, session lifecycle, public API, boot |

The modules share one closure. A module can call a function declared in a later
module because the bundle is a single script and function declarations are
hoisted; the ordering above is for readability and state initialisation, not a
runtime module system.

## Planner flow

```text
live snake
  -> read threats / bodies / self body / food
  -> update map coverage and frontier
  -> select a hunt target (or none)
  -> decide whether danger overrides the hunt
  -> build a short-horizon rollout for 24 coarse + 14 fine + 8 ultra headings
  -> score collisions, walls, food, hunt geometry, body traps, escape, frontier
  -> write one heading and an optional boost request
```

The final safety constraint is the rollout, not the strategic layer. Food,
map and hunt scores can only choose among paths that keep clearance and wall
margins.

## Feeding layer

- Local food collection reaches the radar range, then ranks by distance and
  value rather than distance alone.
- A grid-based density pass boosts tight pellet streams and corpse clusters
  without an O(n^2) scan.
- Default food pull is `1.15`; food attraction is cut to `8%` while a hunt is
  live so a dense farm ring cannot pull the snake off a committed kill.
- Large pellets and corpse sites keep super-linear value; a detected corpse
  cluster still creates a timed feast mode.

## Hunting layer

- Deliberate hunts still reject snakes longer than the player.
- Peer-sized prey (up to `100%` of the player's length) is now eligible when it
  is slower or crossing; a fleeing equal-speed runner is still dropped.
- Equal-size chasers behind the player can be tail-baited. The kill comes from
  the chaser's head meeting the body already behind the player, not from a
  head-on trade.
- Close-range contacts against peers and larger snakes still trigger the
  `1.2 s` bailout; a head-on coin flip is not a kill plan.
- Cut, chase and peer-target boosts are gated by clearance and wall margin.

## Map layer

`15-map.js` keeps a coarse grid of the arena within `500` units of the wall. It
marks the trail between samples, reports coverage in the panel, and chooses the
nearest unvisited frontier. The frontier heading becomes a planner vote only
when:

- no hunt target or feast is active;
- danger is not urgent and the threat level is calm;
- the nearby food field is thin enough that a sweep is worth the time.

The map is built only from globals the client already received. It does not
query the server, reveal hidden state, or alter another snake.

## Probe

`panel/cheats/state_probe.js` is a separate read-only client probe. It captures
the arena, self, visible snakes, visible food and trainer map state without
writing any game field. See `docs/CLIENT_PROBE.md` for its boundaries and usage.

## Validation

The offline suite is run with:

```text
python panel/trainer/tests/run_all.py
```

It covers closed-loop hunt/escape/tail/map scenarios, takeover and input
shielding, corpse/radar/UI checks, and a synthetic 5-enemy FPS budget. Live
runs remain server-dependent and are not asserted by the offline suite.
