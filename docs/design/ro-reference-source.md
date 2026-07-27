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

**The post-defence floor is 1, not 0** (`battle_calc_attack_post_defense`).
Damage is allowed to go NEGATIVE after DEF, the weapon's refine bonus is added
against that negative value, and only the total is capped to 1. Digging out of a
negative is what makes over-refining worth anything against a high-DEF target.
Flooring at 0 instead let soft DEF absorb a whole hit, which is how a druid's
Swipe on an arena opponent resolved to exactly no damage; `combat/defence.ts`
holds the floor until refining becomes a term in the physical pipeline.

**Weapon damage, pre-renewal** (`battle_calc_base_damage`, the PC branch):
`atkmax` is the weapon's attack power. A player's `atkmin` is NOT a weapon stat:
it is `DEX x (80 + weaponLevel x 20) / 100`, clamped to atkmax. For a BOW it then
becomes `atkmin x atkmax / 100`, and if that exceeds atkmax the CEILING rises to
meet it, so a high-Dexterity archer rolls above the weapon's own attack power. A
non-critical rolls uniformly over `[atkmin, atkmax)`, excluding the top; a
critical takes atkmax with no roll and no multiplier (the x1.4 is Renewal's).
Monsters roll an authored min/max pair with no Dexterity term. Size scales the
weapon portion only; status ATK is added AFTER it.

**A critical ignores DEF outright** (`attack_ignores_def`, first branch under
`#ifndef RENEWAL`). That plus taking atkmax is the entire pre-renewal critical.
Removing the x2 without this would have been a straight nerf; with it, criticals
are the answer to an armoured target.

**`status_base_atk` has no separate ranged formula.** For the bow family
(`W_BOW`, `W_MUSICAL`, `W_WHIP`, and the guns) it feeds the SAME formula with STR
and DEX swapped, so Dexterity leads and takes the squared term. This project's
`statusRangedAttackPower` already matched that exactly; an earlier note here
called it invented, which was wrong. Note the two sets differ: instruments and
whips swap their attack stats but are not ammunition weapons, so only bows take
the arrow damage-floor rule.

## Open items this reference has surfaced

- **Ability criticals still multiply by 2** (`combat/effect_dispatch.ts`), while
  auto-attacks no longer do. In Ragnarok most skills simply cannot crit at all,
  and the ones that can use atkmax like any other critical, so the fix is part of
  authoring the skill list rather than a change to the damage pipeline.
- **`MOB_AP_PER_DPS` is the last calibration constant left.** Monster attack power
  is still on the pre-conversion scale, so it is divided down where a player's
  adds raw. It goes away when the monster records carry an authored ATK pair.
- **Three heroic difficulty floors now fall about 1.3% short** (`hollow_crypt`
  494 against 500, `sunken_bastion` 148 against 150, the Nythraxis heroic boss
  988 against 1000; `tests/heroic_difficulty_floors.test.ts`). Cause: the old
  armour curve normalized by the ATTACKER's level, so a level-22 heroic mob used
  to punch through the reference tank's armour harder than a level-20 one. It
  does not any more, which is the correction, not a regression. Restoring the
  floors means scaling the heroic damage dials by about 1.5%, which cascades into
  a dozen derived tuning pins; deliberately NOT done here, because the monster
  records are being rebuilt for Ragnarok anyway and retuning them twice is waste.
