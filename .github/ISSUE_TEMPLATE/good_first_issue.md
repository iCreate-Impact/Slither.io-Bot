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

- [ ] `bot_v2.js`
- [ ] `slither_bot.py`
- [ ] `tools/sync_embedded.py` / tests
- [ ] `docs/PERFORMANCE.md` / docs
- [ ] `recon/` or `probe_tops.py`

## Acceptance criteria

- [ ] The change is behind a flag if it affects steering.
- [ ] Syntax and embedded-sync checks pass.
- [ ] A short forced-server run or a deterministic unit test validates it.
- [ ] Result state and stats are recorded if it is a live run.
- [ ] Results are described as measured.

## Mentorship notes

Add hints, links to relevant constants, or a suggested first PR shape here.
