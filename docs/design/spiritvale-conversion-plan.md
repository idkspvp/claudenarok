# Converting Claudenarok to SpiritVale

The plan for the rule change from "numbers from Ragnarok, play from SpiritVale"
to **SpiritVale end to end**. Written July 2026, after the reference data was
collected in full (27 files, `data/spiritvale-raw/`, audited in
`spiritvale-coverage.md`).

This is a plan, not a spec. It states the order, the seams, the acceptance check
per phase, and the four decisions that have to be made before phase 1 because
they change what the later phases even are.

## What the rule change costs

Worth stating once, plainly, so the decision is made with open eyes rather than
discovered in phase 6. These are already built, correct, and verified against
rAthena source, and going full SpiritVale discards or rewrites them:

| Built | Where | Fate under SpiritVale |
|---|---|---|
| The 400-cell pre-renewal element chart | `src/sim/combat/elements.ts` | replaced by a 10x10 with three values |
| Pre-renewal critical (top of range, ignores DEF, no multiplier) | `src/sim/combat/crit.ts` | replaced by a 120%+ multiplier |
| Ragnarok ASPD (per job-and-weapon base motion) | `src/sim/combat/aspd.ts` | replaced by a per-weapon delay table |
| Hard-DEF-percent then soft-DEF-flat | `src/sim/combat/defence.ts` | replaced by `100/(DEF+100)` |
| The status-point cost curve `2 + (v-1)/10` | `src/sim/types.ts` | replaced by a 1 / 2 / 3 ladder |
| The 1-99 XP curve on Ragnarok pacing | `src/sim/progression/xp.ts` | replaced or rescaled |
| Weapon size modifiers | `src/sim/combat/weapon_size.ts` | SpiritVale has no size modifier |

That is real work being thrown away, and it is the user's call to make. It has
been made. The rest of this document assumes it.

Two things survive the change and should be said so nobody re-does them: the
**six attributes** are the same six, and the **job-level track granting one
skill point per level** is the same idea. Those two were the expensive parts.

## Decisions: made

Answered 2026-07-29. Recorded here so no phase re-opens them.

| # | Decision | Chosen |
|---|---|---|
| D1 | Level cap | **150.** Take SpiritVale's scale wholesale. |
| D2 | Element chart | **Take SpiritVale's three-value table.** Overrides the recommendation below; "100%" was meant literally. |
| D3 | Class set | **All 15, in two waves.** 7 base in phase 4, 8 advanced in phase 8. |
| D4 | Item economy | Artifact-to-grimoire loop and the drop ladder in phase 6; the rest of our economy left alone until phase 9. |
| -- | Starting point | **Phase 0.** |

D2 is the one that went against the recommendation. That is the user's call and
it is the consistent reading of the rule change: a "100% SpiritVale" game does
not keep Ragnarok's element chart. The 400-cell table stays in git history
(`02cfb38`) if it is ever wanted back.

The reasoning behind each option is kept below, unedited, because a later phase
may need to know why a road was not taken.

## The decisions, as they were framed

Each of these changes what later phases are, so they could not be deferred.

### D1. Level cap: keep 99, or go to 150?

SpiritVale runs base level to 150 with a 161-entry curve. This game just
rebuilt its curve for 1 to 99 on Ragnarok pacing.

Going to 150 means: a new XP curve, every content level gate moved, the deed
catalogue re-banded, `MAX_LEVEL` and everything reading it, and the attribute
budget rebuilt (SpiritVale grants 404 points across three bands keyed to 100 and
130, which are meaningless at cap 99).

Keeping 99 means: SpiritVale's attribute budget and both of its band boundaries
have to be re-derived for a 99 cap, and the published EXP table is unusable.

**There is no cheap option.** Recommendation: **go to 150**, because every
SpiritVale number downstream (attribute bands, monster levels 1 to 155, the map
chain to 140, the Eternal Tower at 101 to 201) is expressed in that scale, and
re-deriving all of them for 99 is more work than moving the cap once.

### D2. Element chart: keep the real 400-cell one, or take the three-value one?

`elements.ts` currently holds `db/pre-re/attr_fix.yml` verbatim: 4 attribute
levels, values from -100 to +200, undead healed by shadow at level 4.
SpiritVale's is 10x10 with only 1.25, 0.75 and 0.5, no levels, no absorption.

Recommendation: **keep the 400-cell chart.** It is strictly a superset, it
already works, and the thing it buys (an element card mattering) is a depth this
game wants. Taking the flat one is the only item in the whole conversion that
makes the game measurably shallower for no gain. If "100%" is meant literally,
say so and it goes; otherwise this is the one recorded exception.

### D3. Class set: 5 Ragnarok first jobs, or SpiritVale's 7 base plus 8 advanced?

The game has 5 (swordman, mage, thief, archer, acolyte) and 179 abilities.
SpiritVale has 7 base (adds Knight and Summoner as their own base classes) plus
8 advanced, 15 trees and 258 placed skills, on a 7-wide grid with
prerequisites, plus 111 passives and 29 summons.

Recommendation: **take all 15**, in two waves. The 7 base trees are phase 4; the
8 advanced trees are phase 8 and can ship later. Summoner is the expensive one
(19 skills, and it needs the summon system that does not exist here at all).

### D4. Do we take the item economy, or keep ours?

SpiritVale's is: 518 equipment on three level tiers, 269 cards, 129 gems, 34
four-piece artifacts, 24 sets, 9 substat pools, essence re-rolls, one-material
recipes, and the artifact-to-grimoire loop.

This game has its own items, augments, enchants, professions, market, delves,
heroic variants and card minigame. Those are WoC-derived and mostly unrelated.

Recommendation: **take the artifact-to-grimoire loop and the drop ladder first**
(phase 6), leave the rest of our economy alone until phase 9. That loop is the
highest-value single import in the dataset and it does not depend on anything
else.

## The phases

Each phase is independently shippable, ends green, and states its own acceptance
check. Nothing here is a rewrite: every step lands as a module behind an
existing seam, per the repo's module-first rule.

### Phase 0. Clear the dead weight (prerequisite, no design content)

Twenty of the 57 modules in `src/sim/combat/` have no importer:

```
area_echo  armor_slot_def  attribute_damage  auto_cast_ability  cast_hooks
convergence  dot_mutation  empower_next  equip_procs  exclusive_aura  forms
gear_proc  glacial_front  group_targeting  haste_burst  mass_resurrection
proc_state  sure_crit  weapon_class_atk  weapon_size
```

Some are correct code that was never wired (`gear_proc`, `auto_cast_ability`,
`weapon_size` are all from this year's work); some are WoC leftovers. Every one
is either wired in the phase that needs it or deleted now. Carrying twenty dead
modules through a conversion this size is how a conversion stalls.

Also finish the pending task list already open: the talent removal (`D0-2`,
`D0-4` through `D0-7`) and the aggro replacement (`M1c`). Those are half-done and
will conflict with everything below.

**Accept:** `npx vitest run tests/architecture.test.ts` green, no module in
`src/sim/combat/` without an importer, `npm run gate` green.

### Phase 1. The stat core

The formulas everything else reads. One module per formula group, all pure, all
Node-testable, none of them touching `sim.ts`.

```
src/sim/stats/attack.ts        ATK melee + ranged, MATK, the FLOOR(x/10)/100 breakpoint
src/sim/stats/defence_curve.ts 100/(DEF+100)
src/sim/stats/accuracy.ts      Hit, Flee with the 5th-attacker penalty, crit rate/damage/defence
src/sim/stats/attack_speed.ts  the per-weapon BAD table, ASPD, cast speed, both caps
src/sim/stats/resources.ts     Max HP with Tri(level), Max MP, both regen curves
src/sim/stats/sustain.ts       healing, siphon, leech with its 20%/sec ceiling, reflect
```

`defence_curve.ts` is the one that fixes a class of bug rather than a number: it
removes the immunity cliff that the Fiesta augments fell off in July 2026.

**Accept:** each module has `tests/<name>.test.ts` pinning the published example
values from `spiritvale-engine-formulas.md`; `defence_curve` has an explicit test
that no defence value reaches immunity.

### Phase 2. Wire the stat core, retire the Ragnarok one

Replace the call sites in `entity.ts` and `sim.ts` one formula at a time, each
its own commit, each with the parity trace regenerated LAST on the branch.

Order matters: defence first (it is the bug fix), then attack, then accuracy,
then attack speed, then resources. Attack speed last because it is the one that
changes the feel of every existing encounter.

**Accept:** `tests/world_api_parity.test.ts` green, the golden traces regenerated
in their own reviewed commit, and a before/after damage table for a level 1, 50
and 99 character committed to the PR.

### Phase 3. Progression

```
level cap                per D1
attribute cost ladder    1 through 50, 2 through 98, 3 for 99
attribute budget         27 pre-spent, then 3 / 2 / 1 per level band
per-class starting block  12 / 9 / 9 / 1 / 1 / 1
job levels               50 base, 70 advanced, SEPARATE pools
free refund              shift or right-click for -1, per the reference's own UI
```

The refund is the smallest item here and the one a player notices first.

**Accept:** a test that a level-150 character can cap exactly two attributes and
has the published remainder left; a test that base points cannot buy an advanced
skill.

### Phase 4. The seven base classes

The biggest phase. A skill record here needs fields `AbilityDef` does not carry:
power as a percentage of ATK / MATK / both, hits scaling with level, a cooldown
that FALLS with level, `ignoreFlee` / `ignoreBlock` / `ignoreDefence` as three
separate permissions, and the status list with its own duration, chance and
stack scaling.

That is an extension of `AbilityDef`, not a replacement, and it lands as a new
`src/sim/content/skills/` directory with an `index.ts` barrel, one file per
class, generated from `data/spiritvale-raw/spiritvale-all-classes.json` plus
`skills-combat.json` rather than hand-typed.

The 7-wide grid layout comes across verbatim, so the skill window never has to
lay out a graph.

**Accept:** every skill in the 7 base trees resolves, prerequisites gate
correctly, and a generated-vs-source freshness test in the shape of
`tests/guide.test.ts` fails if the JSON moves and the content is not regenerated.

### Phase 5. Statuses and passives

The structural import, and the one worth doing carefully because it replaces
hand-written code with data:

- **A status is a bundle of `{stat, base, per, q}` modifiers with a duration.**
  185 of them. The denial flags (`NoAction`, `NoMove`, `NoCast`, `NoFlee`) mean a
  stun is data, not a special case.
- **A passive is one row of a 4 x 17 x 4 cross product** (trigger, event,
  condition) plus a reference. 111 of them. Today this repo writes a function per
  proc; after this it writes a row.

This subsumes `gear_effects.ts` and `gear_proc.ts`, which are the same idea one
level less general, and it is what finally wires `gear_proc` rather than
deleting it.

**Accept:** the trigger table drives at least the existing gear procs with no
bespoke code left, and `tests/architecture.test.ts` still passes sim purity.

### Phase 6. Drops, and the loop that makes it worth it

```
the drop ladder      card 0.5 / 3, gem 0.1 / 0.3, equip 0.3-5 / 10-30
guaranteed material  one 100% zone material on every monster
artifacts            34 sets of 4 pieces, dropping from MOBS only
grimoires            39, each crafted from four pieces of one artifact
```

The grimoire loop is the single highest-value import in the dataset: it gives
ordinary monsters an endgame reason to exist and it puts a passive layer outside
the skill-point budget. It needs phase 5 (passives) and nothing else.

**Accept:** a drop-rate test that every category only ever emits a value from
its published ladder; a test that no kill is empty.

### Phase 7. World shape

Maps on five-level bands in an unbroken chain, monster population derived from
area and density rather than authored, and monster stats from the growth-rate
rule (`data/spiritvale-monster-stats.tsv`).

Our zones are not SpiritVale's zones and should not become them: what imports is
the SHAPE (band width, one to four maps per band, density as the only tuning
knob, roughly one monster per 200 square units).

**Accept:** every zone declares a five-level band, the chain has no gap, and a
test asserts population against the area rule.

### Phase 8. The eight advanced classes

Job 50 advancement, attributes reset to 1 with points returned, the parent's
health multiplier inherited, a second skill-point pool, and the eight trees.
Weaver is freeform (one tree drawn from all base classes, no prerequisites) and
should ship last or not at all.

Summoner and Necromancer need the summon system: 29 summons, each a stat block
plus an autonomous rotation with per-skill cast chance and a `targetStatus`
gate. That is its own subsystem behind `SimContext`.

### Phase 9. Retire what is left of WoC

Decide, per system, whether it stays: professions, market, delves, heroic
variants, the card minigame, vale cup, yumi, chronomancy, the pet systems.
Nothing in SpiritVale corresponds to most of these. This is a separate
conversation and it comes last because none of it blocks the rest.

## Order of dependency

```
Phase 0  ─┬─> Phase 1 ──> Phase 2 ──> Phase 3 ──> Phase 4 ─┬─> Phase 5 ──> Phase 6
          │                                                 │
          └─────────────────────────> Phase 7 ──────────────┴─> Phase 8 ──> Phase 9
```

Phase 7 only needs phase 0 and can run in parallel with 1 through 4.

## What this does NOT change

Stated so it is not re-opened: the sim stays deterministic at 20 Hz through
`Rng`, the server stays authoritative, `IWorld` stays the only seam, `src/sim/`
stays DOM-free, and every phase lands through `npm run gate`. The conversion is
a content and formula change, not an architecture change, and any phase that
starts wanting an architecture change has been scoped wrong.

## What we still do not know

Carried from `spiritvale-coverage.md` so a phase does not stall on it:

- **Monster ATK** and the `AttackSpeedRanks` values. Phase 7 needs a stand-in.
  Use the reference's monster attack until SpiritVale's surfaces.
- **The job experience curve.** Phase 3 needs one. The evidence for reusing the
  base curve is in `spiritvale-engine-formulas.md`; implement it as its own
  constant seeded from the base curve, never as a call into it, so a later
  correction touches one place.
- **No healing consumables exist in the dataset.** Whatever SpiritVale uses
  instead is not published. Keep ours until it is.
