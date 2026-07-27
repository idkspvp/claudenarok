# The pre-renewal reference checkout

A shallow, source-only clone of rAthena lives OUTSIDE this repository at:

    E:/ro-reference/rathena

Sparse-checked out to `src/` and `doc/` only, about 27 MB. It exists so a
Ragnarok mechanic can be read from the implementation rather than reconstructed
from memory or from a web search.

## Why it is outside the repo, and why `db/` is not checked out

rAthena is **GPL-3.0**, and Claudenarok Online is MIT and intended to be
commercial. Reading GPL source to understand a mechanic is fine and is what this
checkout is for. Two things are not:

- **Never copy code from it.** Read the mechanic, then write our own.
- **Never copy `db/`.** That is Gravity's authored dataset (monster records, item
  records, their specific numbers), which is why the sparse checkout deliberately
  excludes it. Mechanics are fair to reimplement; datasets are not.

Keeping the clone outside the working tree is what stops it becoming part of
anything this project distributes. Do not move it in, and do not add it as a
submodule.

## Why it beats searching

A web search for a Ragnarok formula returns the **Renewal** version by default.
That has now happened three times on this project:

1. The ATK formula: a search returned Renewal's `BaseLevel/4 + STR + DEX/5 +
   LUK/3`, which was caught only because pre-renewal's squared terms were
   already known.
2. The physical damage formula: same `BaseLevel/4` tell, same trap.
3. The DEF formula: a search returned `damage x (4000 + DEF) / (4000 + DEF x 10)`
   described as pre-renewal. It is not. That expression sits under `#ifdef
   RENEWAL` in `battle.cpp` with the comment "RE DEF Reduction".

The source has an explicit `#ifndef RENEWAL` / `#else` split, so it answers the
era question in one look rather than by weighing sources against each other.

## How to use it

Find the mechanic and read the NON-renewal branch:

```bash
grep -n "#ifndef RENEWAL" /e/ro-reference/rathena/src/map/battle.cpp
```

`src/map/battle.cpp` holds the damage pipeline, `status.cpp` the stat
derivations, `pc.cpp` the character/job logic, `mob.cpp` monster behaviour.

## What has been settled here so far

**Defence, pre-renewal** (`battle_calc_defense_reduction`, the `#else` branch):

- **Hard DEF** (equipment) is capped at 100 and applied as a straight percentage:
  `damage x (100 - DEF) / 100`. It is NOT the diminishing-returns curve; that is
  Renewal's.
- **Soft DEF** (from VIT) is a FLAT subtraction applied AFTER the percentage.
- A player's soft DEF is `(3 x VIT)/10 + rnd(0, max(0, VIT^2/150 - (3 x VIT)/10
  - 1)) + VIT/2`.
- A monster's is `VIT + rnd(0, (VIT/20)^2)`.

Note the **random component** in both. Any implementation of it must draw from
the sim's `Rng`, never `Math.random`, or it breaks determinism and the parity
gate (root `CLAUDE.md`, Invariants).

**Accuracy, pre-renewal**: HIT is `level + DEX + LUK/3`, FLEE is `level + AGI +
LUK/5`, with NO baseline terms; hit chance is `80 + HIT - FLEE` clamped to
5..100%, and perfect dodge is `1 + LUK x 0.1` percent rolled separately. This one
was shipped wrong first (invented `+175` / `+100` baselines) and corrected after
verification.
