---
name: Feature or tuning proposal
about: Propose a survival, hunting, map, tooling, or documentation improvement
title: "[idea] "
labels: enhancement
assignees: ""
---

## Area

- [ ] Survival / collision avoidance
- [ ] Hunting / tail bait / peer bailout
- [ ] Feeding / corpse feast / map exploration
- [ ] Boosted-snake prediction
- [ ] Takeover, input shielding or panel UI
- [ ] Offline tests / tooling
- [ ] Documentation / contributor experience

## Problem

What failure or gap does this address? Include the mode, clearance and threat
context if the idea came from a live death.

## Proposed behavior

Describe the change. Keep the safety invariants explicit: what must the trainer
never do while executing this feature? The production trainer must remain
takeover-only and must never start, navigate, click **Play**, reconnect or write
another player's state.

## Evidence (if available)

- Relevant run(s), browser, duration and spawn conditions:
- Trainer length / displayed length-score / rank / kills:
- Mode, clearance and threat samples:
- Existing A/B comparison:

## Test plan

Which deterministic scenario should be added or changed? Which Chrome and Edge
suites should pass? If a live check is needed, state the expected duration and
what would count as success.

## Scope

Is this a good first issue, or does it need design discussion first? Does it
need a setting or a default-off rollout until measured?
