---
name: Bug report
about: Report a repeatable planner, driver, or documentation problem
title: "[bug] "
labels: bug
assignees: ""
---

## Summary

What went wrong, and what did you expect instead?

## Result state

- [ ] `DIED` — collision
- [ ] `CANCELLED` — process ended by the host, not a game death
- [ ] `FILTERED` — crowded spawn rejected
- [ ] `NO-DEATH` — survived the time limit but behaved incorrectly
- [ ] Other:

## Reproduction

```bash
# exact command, including server and flags
python run_v2.py --headless --seconds 600 --verbose \
  --server IP:PORT --start-max-threats 6 --abort-attempts 5
```

- Server: `ip:port`
- Duration / starts / deaths:
- Best length / score / kills:
- Feature flags changed from default:

## Evidence

Paste the relevant log lines (`[DEATH]`, `[THREATS]`, `[PLAN]`, `[FAST]`,
`[HUNT]`, `[SELFGRID]`). Remove any unrelated local paths or personal data.

```text
[paste log]
```

## Environment

- OS:
- Python version:
- Playwright version:
- Chromium path/version (if overridden):
- Commit or version:

## Additional context

Was this a one-off, or did it reproduce more than once? If you changed a
constant, include the old and new values.
