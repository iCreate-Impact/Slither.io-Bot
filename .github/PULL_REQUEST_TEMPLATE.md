## What changed

Describe the behaviour change, the failure it addresses, and the result state
that motivated it.

## Type

- [ ] Survival / collision avoidance
- [ ] Boosted-snake prediction
- [ ] Optional behaviours (coil / boost cut-off / corpse)
- [ ] Server selection
- [ ] Tooling / tests / docs
- [ ] Refactor with no behaviour change

## Validation

- Command/server:
- Duration / starts / deaths:
- Result state: `NO-DEATH` / `DIED` / `CANCELLED` / `FILTERED`
- Best length / score / kills:
- A/B comparison (if tuning):

## Checklist

- [ ] `python -m py_compile slither_bot.py run_v2.py probe_tops.py recon/*.py tools/*.py`
- [ ] `node --check bot_v2.js`
- [ ] `python tools/sync_embedded.py --check`
- [ ] Ran at least `--seconds 600` on a forced server (or documented why not)
- [ ] Recorded the result state and stats in `docs/PERFORMANCE.md`
- [ ] Updated `CHANGELOG.md` for user-visible behaviour
- [ ] No leftover debug logging, local paths, generated JSON, or credentials
- [ ] Results are described as measured, with the run's state and stats

## Survival invariants

If this touches steering or boost, explain how it preserves the
existing survival checks. New behaviours should be behind a flag until measured.
