---
name: Good first issue
about: Propose a small, well-scoped starter task
title: "[good first issue] "
labels: good first issue
assignees: ""
---

## Task

Describe the small, self-contained change. It should be doable without a full
planner rewrite.

## Files likely involved

- [ ] `panel/trainer/src/` module plus rebuilt `trainer.js`
- [ ] `panel/trainer/tests/sim_modes.html` or a suite assertion
- [ ] `panel/trainer/README.md`
- [ ] `docs/ARCHITECTURE.md` / `docs/TRAINER_MODULES.md`
- [ ] `docs/TRAINER_TESTING.md` / `docs/PERFORMANCE.md`
- [ ] `panel/cheats/state_probe.js` documentation

## Acceptance criteria

- [ ] The change is behind a setting if it affects steering.
- [ ] `python panel/trainer/build.py --check` and `node --check` pass.
- [ ] A deterministic scenario or assertion fails before and passes after.
- [ ] Chrome and Edge suites pass (`31/31`, `31/31`, `42/42`).
- [ ] A live result is recorded when the issue needs live evidence.
- [ ] The production trainer still never starts or restarts a run.

## Mentorship notes

Add hints, links to relevant constants, or a suggested first PR shape here.
