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

**Three recorded exceptions, all taken on the owner's explicit instruction.** In
each case the licensing concern was raised first, the owner reaffirmed, and the
decision is written down here rather than left as an undocumented divergence
between this rule and the tree.

| File read | Used by | Scope |
|---|---|---|
| `db/pre-re/job_stats.yml` | `src/sim/job_vitals.ts` | the four per-job HP and SP coefficients |
| `db/pre-re/job_aspd.yml` | `src/sim/job_aspd.ts` | the per-job, per-weapon base attack motions for the five first jobs |
| `db/pre-re/item_db_equip.yml` | `src/sim/combat/weapon_class_atk.ts` | AGGREGATE statistics only: the median attack per weapon class, measured over the file's 707 weapons. No individual record, name, or number is carried across |

The third is narrower than the first two and worth stating precisely: what was
taken is a set of seventeen medians, one per weapon class, computed over the whole
file. Our own weapons keep their own names and their own relative ordering, and
are placed inside a band around the median for their class; no authored row was
copied or transcribed.

`db/pre-re` is added to the reference clone's sparse checkout so these are
readable; it stays outside the working tree like everything else there.

**These are exceptions, not a general licence.** The rule above is unchanged for
everything else: monster records, item records, card effects, and their names and
numbers are still authored from scratch. Anything further needs its own explicit
decision and its own row in this table.

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

**The critical strike, whole** (`status_calc_bl_main`, `is_attack_critical`,
`is_attack_hitting`, `attack_ignores_def`). Rate is `10 + LUK x 10 / 3` in per
mille, so 1% plus a THIRD of a percent per point; the target's Luck subtracts 2
per mille per point, or 3 when a monster attacks a player, and the derived stat
is floored at 1 so it never reaches zero. A critical cannot miss, ignores both
defence layers, and takes atkmax with no multiplier. Magic never crits: all seven
`is_attack_critical` call sites are on the weapon path. A SKILL cannot crit
unless its record carries `NK_CRITICAL`, so the default for every skill is no.

**The job tree** (`e_mapid` in `src/map/map.hpp`). Classic is the Novice, six
first jobs (Swordman, Mage, Archer, Acolyte, Merchant, Thief), and each one's 2-1
and 2-2 advancement, plus Super Novice, which the source notes is the 2-1 of the
NOVICE. Everything transcendent, third, or expanded in that enum is a later era.
Transcribed to `src/sim/content/jobs.ts`: names and tree only, no stat blocks or
skill lists.

**MATK and MDEF** (`status_base_matk_min`/`_max` and the `status->mdef2`
derivation in `status.cpp`, the magic reduction in `battle_calc_magic_attack`,
all three under `#ifndef RENEWAL` / `#else`). Status MATK is a RANGE, not a
number: `INT + (INT/7)^2` to `INT + (INT/5)^2`, rolled half-open exactly as the
weapon roll is. Reduction has the same two-layer shape as physical, `damage x
(100 - MDEF) / 100 - MDEF2`, floored at 1.

Two things diverge from the physical side and both are easy to miss because
everything else lines up. **Soft MDEF carries no random term**: `mdef2` is a
plain `INT + VIT/2` and is subtracted as-is, where soft DEF rolls a quadratic
span. So the variance on the magic side lives entirely in the ATTACK and on the
physical side entirely in the DEFENCE. And **Intelligence pays into soft MDEF one
for one while Vitality pays half**, which makes a caster the hardest magic target
in the game and the softest to answer with a weapon. Converted in
`src/sim/combat/magic_defence.ts`.

**Attack speed** (`status_base_amotion_pc` `#else` arm, its clamp in
`status_calc_pc_`, the auto-attack timer in unit.cpp). The base delay is
`job->aspd_base[weaponType]`, indexed by JOB and by WEAPON TYPE together, so an
Archer and an Acolyte holding the same mace swing at different speeds. Attack
speed is a property of who holds the weapon, which is why this game's authored
per-weapon `speed` cannot express it. Dual wielding takes `(w1 + w2) x 7 / 10`,
seven tenths of the two ADDED, not their average, so two one-handers are slower
than either alone.

Stats then cut a percentage: `amotion -= amotion x (4 x AGI + DEX) / 1000`.
Agility is worth exactly four Dexterity, with no second term and no curve, and
the pair caps at a 49.5% reduction at 99 in both, so attributes alone can never
halve a swing.

Two values that a search or a memory gets wrong. The clamp is **[100, 4000]**
milliseconds, not 95 at the fast end: 100 is `max_aspd` 190 run through
`battle_adjust_conf`'s conversion `(2000 - 190 x 10) x 2 = 200` and then halved
by `AMOTION_DIVIDER_PC`. And the swing interval is **`adelay`, which is twice
`amotion`**: amotion is the animation and gates movement, while the auto-attack
timer is scheduled at `attackabletime = tick + adelay`. Reading the interval off
amotion makes every character attack twice as fast as Ragnarok does. Converted in
`src/sim/combat/aspd.ts`.

## Open items this reference has surfaced

- **Magic crit is deliberately not converted yet.** Verified that pre-renewal
  magic cannot crit, but the spell-crit rate is what most of the mage and priest
  talent trees are built on (Hot Streak, Combustion, Shatter, Ignite, the
  chronomancy row, the spec masteries) plus every healing critical, and Ragnarok
  has none of those talents either. Zeroing the rate ahead of the skills that
  replace them kills the trees without replacing them, so it lands with the skill
  rebuild in one piece. The finding is recorded at `Sim.spellCrit`.
- **Hard MDEF has no source in this engine yet.** `combat/magic_defence.ts` takes
  it as an argument rather than converting it, because unlike `Entity.armor`
  there is no magic-armour field on an entity or an `ItemDef` to convert FROM.
  Picking a divisor against a field that does not exist would be a guess. Every
  caller passes 0 until the gear records carry a real MDEF value (roadmap B3), so
  only the flat Intelligence layer bites, which is incomplete rather than wrong.
- **The magic module is not wired into the cast path.** The formulas are
  converted and tested; `spellPower` still carries the MIDPOINT of the MATK range
  as a single number (`statusMagicPower` in `entity.ts`) and no spell subtracts
  MDEF. Wiring it changes rng draw ORDER on every cast (the range roll is a new
  draw), so it lands with the parity-golden regeneration and not before.
- **The live class list is still the inherited nine**, not the Classic tree in
  `content/jobs.ts`. Attack speed is the system blocked on the migration: it is
  per JOB and per weapon class.
- **The ASPD table is authored but NOT wired, and the blocker moved.** The job
  half is solved: `AspdJob` is an alias of `PlayerClass` now that the collapse has
  landed, pinned by `tests/job_aspd.test.ts`. What blocks it now is the weapon
  half. The table is indexed by job AND weapon class, and **not one of the weapon
  records carries a `weaponType`**: the field is optional, every authored weapon
  omits it, and the only `weaponType` values in `content/` belong to
  `weapon_skins.ts`, which is a cosmetic skin type and a different union.

  Wiring it against that would give every job ONE cadence regardless of what it
  holds, which is strictly worse than the per-weapon `speed` already shipped: it
  would delete the distinction between a dagger and a two-handed sword to gain a
  distinction between a Swordman and a Mage. So attack speed waits on `B2`, the
  weapon records, and the same is true of the size table in `combat/weapon_size.ts`
  for the same reason (an unmarked weapon is treated as a sword, so the whole
  size chart is inert too). One authoring pass unblocks both.
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
