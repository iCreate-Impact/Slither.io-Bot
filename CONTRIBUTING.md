# Contributing

Contributions are welcome. This project is a browser-side trainer for
[slither.io](https://slither.io), not a game server or a headless driver. Keep
changes focused on planning, collision avoidance, feeding, hunting, map use,
the panel and the test harness.

## Before you start

- Open an issue for large planner or behaviour changes so the scenario and
  success criteria can be discussed first.
- Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md),
  [docs/TRAINER_MODULES.md](docs/TRAINER_MODULES.md) and
  [docs/TRAINER_TESTING.md](docs/TRAINER_TESTING.md).
- Use only your own runs and do not disrupt other players, the server or the
  game's normal operation.
- The production trainer is **takeover-only**. It never launches a browser,
  navigates, clicks **Play**, reconnects or creates a run. Do not add any of
  those actions to `panel/trainer/`.

## Repository layout

```text
panel/trainer/
  src/                maintained modules; no imports or exports
  trainer.js          generated single-file bundle
  build.py            ordered concatenation and --check
  trainer.user.js     userscript loader
  bookmarklet.txt     loader for a published copy
  tests/              offline Playwright suites and FPS benchmark
panel/cheats/
  state_probe.js      read-only client-state probe
docs/                 architecture, modules, testing and performance notes
assets/               curated screenshots
```

## Development setup

```bash
python -m pip install -r panel/trainer/tests/requirements.txt
```

The test harness prefers the installed default browser (Chrome or Edge via
Playwright channels). Bundled Chromium can be installed only if neither channel
is available:

```bash
python -m playwright install chromium
```

## Change workflow

1. **Edit a source module under `panel/trainer/src/`.** The maintained source is
   split in dependency order; do not edit the generated `trainer.js` directly.
2. **Rebuild the bundle.**

   ```bash
   python panel/trainer/build.py
   python panel/trainer/build.py --check
   node --check panel/trainer/trainer.js
   ```

3. **Add or update a focused test.** Movement, collision, peer rules, input
   shielding, map state and UI changes need a scenario in
   `panel/trainer/tests/sim_modes.html` or an assertion in an existing suite.
4. **Run the full suites.**

   ```bash
   python panel/trainer/tests/run_all.py
   TRAINER_BROWSER=msedge python panel/trainer/tests/run_all.py
   ```

   Expected counts are `31/31` modes, `31/31` takeover checks and `42/42`
   hunt/radar/map/UI checks per browser. The benchmark is informational.
5. **Run a live check** when the change affects behaviour rather than only UI or
   tests. See [Live validation](#live-validation).

## Testing rules

- Offline tests must not connect to slither.io. They load local mock/simulation
  pages and the generated bundle.
- The test harness may launch a browser; the trainer itself must not.
- A scenario must fail for the old behaviour and pass for the fix. Avoid adding
  a pass/fail scenario whose geometry is effectively unwinnable.
- Keep deterministic scenarios deterministic. Do not rely on random spawns or a
  particular server population for an offline assertion.
- If a short scenario needs extra time for a legitimate cut-and-circle, give it
  an explicit minimum window rather than weakening the collision assertion.
- Do not add a retry to hide a flaky scenario; fix the geometry or the timing.

### Useful commands

```bash
# One mode, headed, longer window
python panel/trainer/tests/test_modes.py --modes hunt_peer --headed --seconds 10

# One group only
python panel/trainer/tests/test_modes.py --modes body_far_head,body_many,feast

# Takeover and input shielding
python panel/trainer/tests/test_takeover.py

# Hunt, radar, map and panel UI
python panel/trainer/tests/test_hunt_radar.py

# FPS benchmark
python panel/trainer/tests/bench.py
```

## Live validation

Live runs are evidence, not a unit test. A useful report includes:

- browser name and version, headed or headless, and commit/version;
- server population bucket and spawn conditions;
- duration and whether the run ended by death, release or cancellation;
- trainer length, displayed length/score, rank and confirmed kills;
- the death geometry (wall, single head, body, multi-snake box, boosted peer);
- relevant mode/clearance/threat samples around a death;
- a curated screenshot when available.

### Manual protocol

1. Open <https://slither.io> yourself and start a run with nickname `test` when
   a generic nickname is appropriate.
2. Inject `panel/trainer/trainer.js` through DevTools, or use the userscript.
3. Click **Take over** and confirm the panel says `Takeover active`.
4. Let the run continue until a real death or the chosen time limit. Do not
   click **Play Again** from the trainer; it has no such action.
5. Release or let death stop control, then record the values above.
6. Save only curated screenshots. Keep probe logs, traces and temporary death
   captures out of git; they are covered by `.gitignore`.

A separate local automation harness can start a browser for testing, but it
must remain outside `panel/trainer/` and must not be required by the production
trainer. Prefer the installed default browser for parity with the userscript.

## Planner and safety guidelines

- Safety outranks food, map and hunt terms. A hunt may be aggressive, but it
  must not ignore an imminent wall, a second head, or a closing body.
- Do not target a snake larger than the player. Peer-sized prey is allowed only
  under the documented slower/crossing rules.
- Preserve escape clearance when adding attraction. If a new score term can
  pull the nose into a negative-clearance pocket, add a test for the conflict.
- Keep the planner deterministic given the same snapshot and settings; avoid
  hidden state that makes tests depend on wall-clock randomness.
- Keep tunables in `00-foundation.js` and name them for their unit and role.
- Comments should explain *why* a threshold exists, especially when it protects
  a previous live failure.

## Code style

- The source fragments share one IIFE. Do not use `import`/`export`, top-level
  `await`, or module-level syntax that would break concatenation.
- Match the existing ES5-compatible style (`var`, function declarations) in the
  trainer source.
- The panel is rendered in a shadow root. Keep DOM queries scoped to it.
- Do not add network calls, packet writes, memory writes or edits to another
  player's state. The only legitimate writes are the game's local steering and
  boost fields while takeover is active.
- Restore every handler or global changed during takeover; input shielding must
  be removable without a reload.
- Never add `play_btn`, `resetGame`, `connect` or reconnect calls.

## Documentation

Tracked documentation lives under `docs/` unless it is a top-level project file
such as `README.md` or `CHANGELOG.md`. Update the relevant document when a
threshold, scenario, test count or live result changes. Avoid machine-specific
absolute paths in tracked files. Use relative repository paths.

## Pull request checklist

- [ ] Source modules changed; bundle rebuilt with `build.py` and `--check`
      passes.
- [ ] `node --check` passes.
- [ ] Full Chrome suite passes (`31/31`, `31/31`, `42/42`).
- [ ] Full Edge suite passes (`31/31`, `31/31`, `42/42`).
- [ ] New behaviour has a focused failing-before/passing-after test.
- [ ] No production launch/navigation/**Play**/reconnect action was added.
- [ ] Takeover, release, death and input shielding still work.
- [ ] Docs and changelog updated; no stale file references or absolute paths.
- [ ] Live evidence included when behaviour changed, with limitations stated.
- [ ] Screenshots curated; probe logs/traces not committed.

## Reporting bugs

Include the version, browser, exact reproduction steps, expected vs actual
behaviour, and whether the issue is reproducible offline. For a live death,
include duration, trainer length, displayed score, rank, kills and the final
threat/clearance/mode samples. Remove personal data and unrelated local paths.

## License

By contributing, you agree that your contribution is licensed under the
repository's MIT license.
