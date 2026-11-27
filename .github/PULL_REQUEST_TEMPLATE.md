## What changed

Describe the behaviour change, the failure it addresses, and the live or offline
evidence that motivated it.

## Type

- [ ] Survival / collision avoidance
- [ ] Hunting / tail bait / peer bailout
- [ ] Feeding / corpse feast / map exploration
- [ ] Boosted-snake prediction
- [ ] Takeover, input shielding or panel UI
- [ ] Tooling / tests / docs
- [ ] Refactor with no behaviour change

## Validation

- Browser/channel:
- Duration / whether the run was released or died:
- Trainer length / displayed length-score / rank / kills:
- Offline suites (Chrome and Edge):
- A/B comparison (if tuning):

## Checklist

- [ ] Source edited under `panel/trainer/src/`; bundle rebuilt.
- [ ] `python panel/trainer/build.py --check` passes.
- [ ] `node --check panel/trainer/trainer.js` passes.
- [ ] Full Chrome suite passes (`31/31`, `31/31`, `42/42` plus benchmark).
- [ ] Full Edge suite passes (`31/31`, `31/31`, `42/42` plus benchmark).
- [ ] New behaviour has a focused failing-before/passing-after test.
- [ ] Live result, if any, is recorded in `docs/PERFORMANCE.md`.
- [ ] `CHANGELOG.md` updated for user-visible behaviour.
- [ ] No production launch, navigation, **Play**, reconnect or socket action.
- [ ] No leftover debug logging, local paths, generated JSON or credentials.
- [ ] Results are described as measured, with the run's state and stats.

## Survival invariants

If this touches steering, hunting or boost, explain how it preserves wall
clearance, enemy-body clearance, input shielding and release/death handling.
New behaviours should be behind a setting until measured, unless the change is a
strict safety fix.
