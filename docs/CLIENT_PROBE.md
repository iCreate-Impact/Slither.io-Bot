# Client-state probe

The trainer needs an honest picture of what the browser client exposes before
planner changes can be measured. `panel/cheats/state_probe.js` is a read-only
probe for that job. It is deliberately separate from the trainer: the probe
reads state and the trainer is the only component that writes local input.

## Safety boundary

The probe does **not**:

- write `window.xm`, `window.ym` or `window.wmd`;
- send packets or open a second connection;
- touch game memory, the server, or another snake's fields;
- start, restart or reconnect a run.

The game client is server-authoritative. Changing a local copy of length,
speed, collision state or another player's position would desynchronise the
client and is not a legitimate control surface. The useful local controls are
the same ones the game already consumes:

| Surface | Meaning |
| --- | --- |
| `window.xm`, `window.ym` | viewport-centre offsets; `atan2(ym, xm)` is the requested heading |
| `window.wmd`, `slither.wmd` | boost request |
| keyboard flags such as `kd_u`, `kd_l`, `kd_r` | legacy keyboard steering |

The trainer uses the first two while takeover is active and restores input
handlers when it releases.

## Usage

1. Start a run manually.
2. Open DevTools and paste `panel/cheats/state_probe.js` into the console.
3. Call one of:

```js
__slitherProbe.summary()   // short human-readable summary
__slitherProbe.log()       // summary plus the full object
__slitherProbe.download()  // save a JSON snapshot locally
__slitherProbe.surface()   // report the local input fields
```

`trace()` / `snapshot()` returns the same object without logging it.

## Captured fields

- arena centre and radius from `grd`, `flux_grd` and `real_flux_grd`;
- the current snake's id, position, angle, speed, length, scale, body-point
  count and boost state;
- up to 48 visible snakes with distance from the arena centre;
- up to 240 visible food points with size and distance from the arena centre;
- rank and the count of visible big pellets (size `>= 6`);
- trainer mode, kills, map coverage, frontier target and current hunt target,
  when the trainer is loaded.

The cap keeps the dump usable in a crowded live arena. The full `window`
object is never serialised.

## Why not a "cheat" panel?

The trainer is a local planner and input layer. A separate panel that edits
health, length, speed, collision results or network traffic would be a
different product: it would be server-inconsistent, brittle across client
builds, and could affect other players. This repository keeps those controls
out of the trainer and uses the probe only to understand the client surface.
