# SpiritVale conversion: progress

**This file is state, not prose.** The master `/goal` run reads it to find what
to do next and writes it back after every phase. Keep it accurate; if it lies,
the run repeats work or skips it.

Spec: `spiritvale-conversion-plan.md`. Systems and UI: `spiritvale-systems-and-ui.md`.

## Status

| Phase | What | Status | Landed at |
|---|---|---|---|
| 0 | Finish what is half-done: cut card duel, finish talent removal, simple aggro | IN PROGRESS | |
| 1 | The stat core: six pure modules, no call sites | NOT STARTED | |
| 2 | Wire the stat core, retire the Ragnarok one | NOT STARTED | |
| 3 | Progression: cap 150, attribute ladder, job pools, refund | NOT STARTED | |
| 4 | The seven base classes and the skill-tree window | NOT STARTED | |
| 5 | Statuses and passives as data | NOT STARTED | |
| 6 | Drops, artifacts, grimoires, gems, essence | NOT STARTED | |
| 7 | World shape and monster inspect | NOT STARTED | |
| 8 | The eight advanced classes and summons | NOT STARTED | |
| 9 | Retire what is left of WoC | NOT STARTED | |

Statuses: `NOT STARTED`, `IN PROGRESS`, `BLOCKED`, `DONE`.

## Per-phase notes

Written by the run as it goes. Anything the plan did not anticipate goes here,
not in the commit message alone, so the next phase inherits it.

### Phase 0
Job 1 of 3 landed: the card duel is gone (cc3fd43, goldens 393cbf3).

Two findings the plan did not anticipate, both corrected in the plan itself:

- The plan claimed twenty dead modules in src/sim/combat/. There are NONE. The
  original scan matched the `.../combat/<name>` import form and missed
  same-directory relative imports. A real import-graph walk from all 125 entry
  points finds one unreachable module, weapon_class_atk, and that one is a live
  content guard for three item-balance tests. It moves to phase 6, where the
  item model changes and it genuinely becomes wrong.
- The card-duel removal shifts the world-init entity sequence by one (the Card
  Master NPC), so all 50 parity goldens moved. The diff is 4,415 lines in and
  4,415 out, a pure one-for-one rewrite: an id shift, not a behavior change.

Jobs 2 (finish the talent removal: D0-2, D0-4 through D0-7) and 3 (M1c simple
aggro) are NOT started.

Baseline note for whoever picks this up: the suite carries 38 to 39 pre-existing
failing files unrelated to any of this, several flaky under parallel load and
one (server/static_sfx_serving) an EPERM on Windows. Always diff the failing SET
against a baseline worktree rather than reading the count.

### Phase 1
(nothing yet)

## Decisions taken mid-run

When the run hits a genuine ambiguity, it picks the behavior-preserving reading
and records the assumption here with the phase it was made in. A later phase
that contradicts one of these must say so.

(nothing yet)

## Blocked on

Anything that needs a human. Empty means the run can continue unattended.

(nothing)
