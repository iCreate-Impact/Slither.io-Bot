---
name: Bug report
about: Report a repeatable planner, takeover, test, or documentation problem
title: "[bug] "
labels: bug
assignees: ""
---

## Summary

What went wrong, and what did you expect instead?

## Result state

- [ ] `DIED` - real collision
- [ ] `RELEASED` - control returned while the snake was alive
- [ ] `CANCELLED` - host or browser ended the observation, not a game death
- [ ] `NO-DEATH` - reached the time limit but behaved incorrectly
- [ ] Offline test failure
- [ ] Other:

## Reproduction

- Start method (manual run, DevTools injection, userscript):
- Browser and version:
- Trainer version or commit:
- Settings changed from default:
- Server population/spawn conditions, if live:
- Duration and last mode/clearance/threat samples:
- Trainer length / displayed length-score / rank / kills:

For an offline failure:

```bash
python panel/trainer/tests/test_modes.py --modes <mode> --headed --seconds 10
node --check panel/trainer/trainer.js
```

## Evidence

Paste the relevant panel/telemetry lines and the exact failure mode. Remove
unrelated local paths, personal data and uncurated logs.

```text
[paste evidence]
```

## Environment

- OS:
- Browser/channel:
- Python and Playwright version (test harness only):
- Commit or bundle version:

## Additional context

Was this a one-off, or did it reproduce more than once? If you changed a
constant, include the old and new values. Confirm whether the issue reproduces
offline or only on the live server.
