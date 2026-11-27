# Live performance log

This file records measured browser-trainer runs. Scores are the game's displayed
per-run values, not cumulative across sessions. Server population, spawn
geometry and other players' steering are uncontrolled variables.

The trainer is **takeover-only**. A person starts the run; the trainer attaches
to that live snake. Test automation may start the browser and click **Play** for
a validation run, but that automation is not part of the production trainer and
is not required at runtime.

For offline validation, see [TRAINER_TESTING.md](TRAINER_TESTING.md).

The current focus is **survival and growth**: stay alive through crowded
spawns, keep feeding, take safe kills, and eventually reach rank `1`. The
best-observed v0.4.0 run is `180.8 s`, released while alive, with trainer length
`36`, displayed length/score `585`, rank `51` and `0` confirmed kills.

---

## Result states

| State | Meaning |
| --- | --- |
| `RELEASED` | Control was released by the tester while the snake was alive. Not a death and not a time-limit result. |
| `DIED` | A real head/body collision ended the run. |
| `CANCELLED` | The host or browser ended the observation, not a game death. |
| `NO-DEATH` | The run reached the selected observation limit without a death. |

A run that died is recorded as `DIED` even if the page remains open on the death
screen. The trainer never clicks **Play Again**.

---

## v0.4.0 results

| Run | Browser | Duration | State | Trainer len | Displayed len/score | Rank | Kills | Map |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | --- |
| Best current build | headed Chrome | 180.8 s | `RELEASED` | 36 | 585 | 51 | 0 | 1.9% (`13/673`) |
| Fast-peer/body validation | headed Chrome | 66.6 s | `DIED` | 16* | — | — | 0 | — |
| Feast-cooldown experiment A | headed Chrome | 94.6 s | `DIED` | 38* | 617* | 36* | 0 | 2.5% (`13/524`) |
| Feast-cooldown experiment B | headed Chrome | 60.1 s | `DIED` | 14* | — | 172* | 0 | — |

`*` The death screen clears the live panel values. The length/score/rank shown
for a death row is the last clean sample before the death, not a final score.

The feast-cooldown experiment added a `6.5 s` no-feast window and a stronger
map vote. It was reverted: it did not produce meaningful live map coverage in
either run, and the current build's best survival result did not use it. The
map-persistence fix and body-caution guard remain in the shipped build.

### What the best run demonstrated

- Takeover stayed active through crowd pressure and repeated escape transitions.
- The trainer returned to farming and hunting after danger instead of freezing.
- A `585` displayed length/score and rank `51` were reached at `180.8 s`; the
  run was released alive, so it is a lower bound on what that spawn could have
  produced.
- Radar, map readout, FPS, target/feast line and release control all updated
  correctly in the live panel.
- No live kill was confirmed. Several hunts were started and abandoned or
  outrun; the score came primarily from food and corpse clusters.

### Death profile

Live deaths in this period were dominated by:

- multi-snake body pressure and box-ins, including negative-clearance pockets
  between two or more bodies;
- a fast approaching peer or larger snake when the trainer was already escaping;
- spawn crowding. Different servers produced very different threat counts
  within the first ten seconds.

The `66.6 s`, `94.6 s` and `60.1 s` runs all died before the next map/farm cycle
could complete. None was a wall collision or a takeover failure.

---

## v0.3.0 results

| Run | Browser | Duration | State | Trainer len | Displayed len/score | Rank | Kills |
| --- | --- | ---: | --- | ---: | ---: | ---: | ---: |
| Best v0.3.0 | headed Chrome | 180 s | `RELEASED` | 39 | 666 | 70 of 319 | 0 |
| Death-screen check | headed Chrome | 63 s | `DIED` | — | final 318 | — | 0 |
| Tail-bait attempt | headed Chrome | 63 s | `DIED` | — | — | — | 0 |

The best v0.3.0 run beat the earlier `213` displayed-length result and was
released alive. It did not reach rank `1`. The death-screen check confirmed that
the trainer stops control and leaves **Play Again** untouched; it does not
restart the game.

The tail-bait attempt exercised the held-line behavior but ended against a
larger boosting snake. No live kill was confirmed.

---

## Earlier result (historical)

The v0.2.1 era reached a displayed length of `213` before a live head-on chase
ended the run. That result is retained as a baseline only. The current trainer
has a different radar, body model, hunting layer and takeover panel; the old
headless driver results are not comparable and are not listed here.

---

## Open problems

| Problem | Current status |
| --- | --- |
| Reliable live kills | Not achieved. Simulated hunts and tail baits pass, but live equal-speed kiters and boosting peers escape or reverse the geometry. |
| Rank `1` | Not achieved. Rank depends on server population and total leaderboard score; a `180 s` run reached `51`. |
| Displayed length target | `585` was reached in v0.4.0 and `666` in v0.3.0, so the `213` baseline is beaten, but not consistently. |
| Full-map coverage | The map layer works, but live runs under crowd pressure still spend most of their time in a local farm. A feast-cooldown experiment did not fix it and was reverted. |
| Crowded spawns | Random spawns can place eight or more heads nearby before the snake has grown. Some runs end before the planner has room to operate. |
| Fast peer head-on | The fast-peer bailout is implemented and tested; a live peer ram has not yet been isolated as a confirmed save. |
| Deterministic live comparison | A single run cannot separate planner quality from server population. Use matched settings and repeat runs when comparing changes. |

---

## Screenshots

| Screenshot | What it shows |
| --- | --- |
| [`assets/trainer_v040_headed_180s.png`](../assets/trainer_v040_headed_180s.png) | Best v0.4.0 run at `180 s`: trainer length `36`, displayed `585`, rank `51`, map and radar live. |
| [`assets/trainer_v040_headed_release.png`](../assets/trainer_v040_headed_release.png) | The same run after **Release**: game still playing, trainer idle, no restart. |
| [`assets/trainer_v030_prearm3_end.png`](../assets/trainer_v030_prearm3_end.png) | Best v0.3.0 run at trainer length `39`, displayed `666`, rank `70` of `319`. |
| [`assets/trainer_v030_prearm3_death.png`](../assets/trainer_v030_prearm3_death.png) | Death screen with the trainer armed; **Play Again** untouched. |

Screenshots are curated from actual live runs. Probe logs, traces and temporary
death captures are ignored by git and should not be committed.

---

## Reporting a run

Use this template when adding a result:

```text
Build:        v0.4.0 <short commit or bundle hash>
Browser:      headed Chrome/Edge <version>
Server:       <population bucket or server id if available>
Duration:     <seconds>
State:        RELEASED / DIED / CANCELLED / NO-DEATH
Trainer len:  <sct>
Displayed:    <game length/score>
Rank:         <rank> of <population>
Kills:        <confirmed>
Map:          <percent, visited/total cells>
Death:        <wall / head / body / crowd / boosted peer / unknown>
Notes:        <settings changed, notable hunt or takeover event>
```

Remove unrelated local paths, personal data and uncurated logs before adding the
entry.
