---
name: Feature or tuning proposal
about: Propose a survival, tooling, or documentation improvement
title: "[idea] "
labels: enhancement
assignees: ""
---

## Area

- [ ] Survival / collision avoidance
- [ ] Boosted-snake prediction
- [ ] Optional behaviours (coil / boost cut-off / corpse / re-engage)
- [ ] Server selection
- [ ] Result logging / tests / tooling
- [ ] Documentation / contributor experience

## Problem

What failure or gap does this address? Include the result state and the log
signature you see at death if applicable.

## Proposed behavior

Describe the change. Keep survival invariants explicit: what must the bot never
do while executing this feature?

## Evidence (if available)

- Relevant run(s), server, length, score:
- `[THREATS]` or `[FAST]` context:
- Existing A/B comparison:

## Test plan

How should this be validated? Which server/duration/flags, and what result would
count as success?

## Scope

Is this a good first issue, or does it need design discussion first? Does it
need a feature flag and a default-off rollout?
