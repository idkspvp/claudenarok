# Phase 2: what the numbers actually did

The before/after the plan's Phase 2 acceptance asks for. Both columns are
MEASURED, not derived by hand: the "before" row set was produced by running the
retired formulas in a worktree at `371a779` (the last Phase 1 commit) and the
"after" set by running the live ones, with the same inputs on both sides.

## The character measured

A swordman with an EVEN attribute spread, all six at `floor(level/2)`, which is
roughly what the point budget buys a player who does not commit. Sword in hand,
20 armour, no gear bonuses, no buffs. Magic attack is read off the same block so
the two sides of the sheet can be compared; spell points are a mage's, since the
old table gave each class its own pool and a swordman had none.

The even spread is deliberate. A committed build (everything into one attribute)
is where the two models differ MOST, because the old one squared its per-ten
term; the even spread is the honest middle and understates the change.

## Before

| Lv | Attr | ATK | MATK | Max HP | Max MP | Swing (s) | DR at 20 armour | Hit chance |
|---|---|---|---|---|---|---|---|---|
| 1 | 1 | 1 | 1 | 40 | 16 | 1.096 | 20.0% | 80% |
| 50 | 25 | 39 | 42 | 1,473 | 388 | 0.964 | 20.0% | 80% |
| 99 | 49 | 83 | 114 | 5,956 | 900 | 0.832 | 20.0% | 80% |

## After

| Lv | Attr | ATK | MATK | Max HP | Max MP | ASPD | Swing (s) | DR at 20 armour | Hit chance |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | 2 | 2 | 213 | 51 | 145 | 1.100 | 16.7% | 82% |
| 50 | 25 | 61 | 61 | 2,947 | 369 | 153 | 0.940 | 16.7% | 100% |
| 99 | 49 | 123 | 123 | 11,361 | 805 | 160 | 0.800 | 16.7% | 100% |

## What moved, and whether it should have

**Attack roughly doubles at every level.** 83 to 123 at the cap, 39 to 61 at
fifty, and 1 to 2 at level 1. Two causes, both intended: Strength leads at 1.5
rather than 1.0, and the level term (`Lv/4`) adds a floor the old formula did not
have. Note it is a smaller multiple at the cap than in the middle, which is the
linear breakpoint showing: the old model was catching up through its square.

**Magic attack falls relative to melee.** Before, a level-99 caster read 114
against a melee 83, a 37% lead bought entirely by the `INT/5` squared term. After,
both read 123. Magic and melee now use the same shape with the same weights, so a
caster's advantage has to come from its kit rather than from the stat formula.
That is the model's design, and it is the single largest balance consequence in
this phase.

**Health nearly doubles, and starts far higher.** 40 to 213 at level 1 is the
flat 200 base the reference gives everyone. 5,956 to 11,361 at the cap is the
quadratic plus the swordman's 1.3. Combined with defence no longer being a
percentage, a character is both bulkier and less mitigated, which is the trade
the reference makes.

**Spell points fall slightly.** 900 to 805 at the cap. The pool has no class
term now, so a mage loses the caster-specific table it used to get.

**Swings get faster at the top and slower at the bottom.** 1.096 to 1.100 at
level 1, 0.832 to 0.800 at 99. Small either way. The ASPD column is new: it is
the 200-point scale the reference expresses speed on, and the cap of 193 is far
above what an even spread reaches.

**Damage reduction falls from 20% to 16.7% at 20 armour.** The old model read
armour as a straight percentage; the curve reads `100/(20+100)`. Armour is worth
slightly less at the low end and, critically, never reaches immunity at the high
end, which is the bug this phase fixed.

## The one number that needs work, stated plainly

**Hit chance reaches 100% by level 50 and stays there.**

That is not a rounding artifact. Accuracy pays two per Dexterity and evasion pays
half per Agility, so an evenly built attacker out-scales an evenly built defender
by four to one, and the stand-in contest (`clamp(5, 100, 55 + HIT - FLEE)`) hits
its ceiling. At level 50 with 25 in everything the attacker brings 50 + 50 + 5 +
25 = 130 against a defender's 50 + 12 = 62.

Two things are true about this and both matter:

1. The RATINGS are transcribed and correct. The four-to-one split is the
   reference's, not ours.
2. The CONTEST is a stand-in. SpiritVale does not publish one, which is recorded
   in `spiritvale-coverage.md`. A linear `BASE + HIT - FLEE` was calibrated for
   symmetric ratings and cannot absorb a four-to-one split across a 1-to-150
   range.

So the fix is not to retune the ratings. It is that the stand-in contest is the
wrong SHAPE for these ratings, and it needs replacing with something that
degrades rather than clamping, most likely a ratio. That is a design decision
with no published answer behind it, so it is left for a phase that can make it
deliberately rather than being invented here.

Until then a level-50-plus fight lands every swing, which is playable but flat.
Perfect dodge (still on Luck, itself a stand-in) is the only avoidance left at
that point.

## Reproducing this

Both halves are a throwaway Vitest that runs the formulas and fails on a
sentinel so the values print in the diff. The "before" half needs a worktree at
`371a779`, because the formulas it calls were deleted in this phase.
