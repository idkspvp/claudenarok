# SpiritVale's skill system, measured

Read directly off the public wiki's own skill pages (219 of them) and the build
planner, in July 2026. Every number here is transcribed, not estimated. Where a
source disagreed with another, the planner's live UI wins, and the disagreement
is recorded.

This exists because the project rule is "numbers from Ragnarok, play from
SpiritVale", and until now we had SpiritVale decisions recorded for equipment
slots, maps, materials, card rates, refining and sets, but nothing at all for
skills.

## The shape of the whole catalogue

219 skills, shared across 15 classes and also used by monsters.

| Maximum level | Skills | Share |
|---|---|---|
| 5 | 151 | 69% |
| 10 | 45 | 21% |
| 3 | 8 | 4% |
| 1 | 8 | 4% |
| 2 | 2 | 1% |
| 0 (unlevelled) | 5 | 2% |

**Five is the default and ten is the exception.** Ragnarok's first-job tree is
the opposite: ten is the default. The tens here are almost all weapon masteries
and the workhorse attack a class spams.

| Element | Skills |
|---|---|
| Neutral | 172 |
| Holy | 17 |
| Fire | 8 |
| Water | 6 |
| Wind | 5 |
| Earth | 4 |
| Undead | 3 |
| Shadow | 2 |
| Poison | 2 |

Four fifths of the catalogue is Neutral. The elements concentrate almost
entirely in the caster classes.

| Damage type | Skills |
|---|---|
| (none: passive, buff or utility) | 130 |
| Magic | 45 |
| Melee | 22 |
| Ranged | 22 |

**Three fifths of every skill tree is not an attack.** That is the single most
surprising number in this document.

**128 of 219 skills (58%) have a prerequisite**, always of the form
`<skill> Lv N`, and in practice almost always `Lv 1`: the chain gates ACCESS,
not investment.

## The three formulas

Every skill states its scaling the same way, and all three are linear:

```
Damage      base (+X/Lv)        a multiplier on the attack, not a flat amount
Cooldown    base (-X/Lv)        cooldown FALLS as the skill levels
Cost        base (+X/Lv)        spell points RISE as the skill levels
```

Ragnarok publishes a per-level table instead (Heal is 13/16/19/22/25/28/31/34/37).
SpiritVale replaces the table with two numbers. Same idea, a tenth of the data.

A worked comparison, the same skill in both:

| | Ragnarok Heal | SpiritVale Heal |
|---|---|---|
| Levels | 10 | 5 |
| Spell points | 13/16/19/.../37 | 10 (+5/Lv), so 10/15/20/25/30 |
| Element | Holy | Holy |
| Type | Magic | Magic |

Note the base cost is nearly identical (13 against 10). SpiritVale did not
rescale Ragnarok's economy; it shortened the ladder and straightened the curve.

## Skill points and what a tree can absorb

The planner shows a base class as `Mage (0/50)`: **50 points for the base
class**, then a further ~50 in the advanced tree after job 50, for ~120 at job
70. (A fan wiki reports 70 for the base tree. The planner says 50, and the
planner is the live tool.)

| Class | Tier | Skills | Points the tree absorbs | Share 50 points fills |
|---|---|---|---|---|
| Scout | base | 9 | 60 | 83% |
| Acolyte | base | 12 | 65 | 77% |
| Warrior | base | 10 | 65 | 77% |
| Rogue | base | 12 | 66 | 76% |
| Summoner | base | 18 | 67 | 75% |
| Mage | base | 13 | 70 | 71% |
| Knight | base | 14 | 75 | 67% |
| Berserker | adv | 16 | 85 | |
| Wizard | adv | 14 | 90 | |
| Shinobi | adv | 17 | 103 | |
| Paladin | adv | 17 | 105 | |
| Gunslinger | adv | 18 | 115 | |
| Priest | adv | 18 | 115 | |
| Necromancer | adv | 23 | 126 | |
| Weaver | special | 41 | 230 | |

**The base trees are deliberately tight: 60 to 75 points against a 50-point
budget.** A player fills two thirds to five sixths of their tree. Compare
Ragnarok's first jobs, which range from 52 (Archer) to 122 (Mage) against 49
points, so a mage fills 40% and an archer 94%. SpiritVale compressed that spread
from 54 points wide to 15.

## The five base trees that match our five jobs

Format: `name · maxLv · element · type · damage · cooldown · cost · requires`.
A dash means the field is absent (a passive has no cost and no cooldown).

### Warrior (10 skills, absorbs 65)

| Skill | Lv | Type | Damage | CD | Cost | Requires |
|---|---|---|---|---|---|---|
| Axe Mastery | 10 | passive | | | 0 | |
| Honed Blade | 5 | passive | | | 0 | |
| Natural Resistance | 5 | passive | | | 0 | |
| Dual Wield Mastery | 5 | passive | | | 0 | |
| Bash | 5 | Melee | 1 (+0.6/Lv) | 0 | 3 (+1/Lv) | |
| Twin Cleave | 10 | Melee | 0 (+0.5/Lv) | 4 | 5 (+2/Lv) | Bash Lv1 |
| Stomp | 5 | Melee | 0 (+1/Lv) | 4 | 10 (+5/Lv) | Twin Cleave Lv1 |
| Vortex Slash | 5 | Melee | 0 (+1.2/Lv) | 4 | 10 (+5/Lv) | Twin Cleave Lv1 |
| Whirlwind | 10 | Melee | 0 (+0.75/Lv) | 6 | 10 (+5/Lv) | Vortex Slash Lv1 |
| Axe Quicken | 5 | buff | | 0 | 20 | Stomp Lv1 |

### Mage (13 skills, absorbs 70)

| Skill | Lv | Element | Type | Damage | CD | Cost | Requires |
|---|---|---|---|---|---|---|---|
| Wand Mastery | 10 | | passive | | | 0 | |
| Free Cast | 5 | | passive | | | 0 | |
| Increased Recovery | 5 | | passive | | | 0 | |
| Firebolt | 5 | Fire | Magic | 0 (+2/Lv) | 1 | 10 (+5/Lv) | |
| Fireball | 5 | Fire | Magic | 0 (+1/Lv) | 1 | 30 (+15/Lv) | Firebolt Lv1 |
| Icebolt | 5 | Water | Magic | 0 (+2/Lv) | 1 | 10 (+5/Lv) | |
| Ice Shard | 5 | Water | Magic | 0 (+1/Lv) | 1 | 15 (+7/Lv) | Icebolt Lv1 |
| Thunderbolt | 5 | Wind | Magic | 0 (+2/Lv) | 1 | 10 (+5/Lv) | |
| Thunder Storm | 5 | Wind | Magic | 0 (+2.5/Lv) | 1 | 30 (+15/Lv) | Thunderbolt Lv1 |
| Earthbolt | 5 | Earth | Magic | 0 (+2/Lv) | 1 | 10 (+5/Lv) | |
| Earth Spikes | 5 | Earth | Magic | 0 (+0.8/Lv) | 1 | 20 (+10/Lv) | Earthbolt Lv1 |
| Energy Shield | 5 | | buff | | 0 | 20 | Wand Mastery Lv1 |
| Blink | 5 | | utility | | 10 (-1/Lv) | 20 | Energy Shield Lv1 |

Four elements, each a bolt at 10 spell points feeding one bigger spell. That is
Ragnarok's mage compressed: same four chains, two steps instead of three, and
the wind school that Ragnarok has and this game does not.

### Acolyte (12 skills, absorbs 65)

| Skill | Lv | Element | Type | Damage | CD | Cost | Requires |
|---|---|---|---|---|---|---|---|
| Codex Mastery | 10 | | passive | | | 0 | |
| Faith | 5 | | passive | | | 0 | |
| Increased Recovery | 5 | | passive | | | 0 | |
| Heal | 5 | Holy | Magic | -0.25 (-0.25/Lv) | 1 | 10 (+5/Lv) | |
| Holy Light | 5 | Holy | Magic | 0 (+1/Lv) | 0 | 10 (+5/Lv) | |
| Divine Grace | 5 | | buff | | 0 | 30 (+15/Lv) | |
| Sacred Aegis | 5 | | buff | | 3 | 20 (+10/Lv) | Divine Grace Lv1 |
| Arcanum Ward | 5 | | ward | | 15 (-1/Lv) | 20 (+10/Lv) | Sacred Aegis Lv1 |
| Benediction | 5 | | buff | | 0 | 20 (+10/Lv) | |
| Resurrection | 5 | | utility | | 10 (-1/Lv) | 60 (+30/Lv) | Faith Lv1 |
| Cure | 5 | | utility | | 5 (-1/Lv) | 10 | |
| Haste | 5 | | buff | | 0 | 20 | |

Heal carries a NEGATIVE damage coefficient rather than a separate heal field:
`-0.25 (-0.25/Lv)`. One number does both jobs.

### Scout (9 skills, absorbs 60)

| Skill | Lv | Type | Damage | CD | Cost | Requires |
|---|---|---|---|---|---|---|
| Steady Hands | 10 | passive | | | 0 | |
| Precise Aim | 5 | passive | | | 0 | Steady Hands Lv1 |
| Strafing Volley | 5 | Ranged | 1 (+0.5/Lv) | 0 | 3 (+1/Lv) | Steady Hands Lv1 |
| Arrow Shower | 10 | Ranged | 0 (+0.3/Lv) | 4 | 7 (+3/Lv) | Steady Hands Lv1 |
| Volatile Bolt | 10 | Ranged | 0 (+0.75/Lv) | 4 | 10 (+5/Lv) | Arrow Shower Lv1 |
| Force Shot | 5 | Ranged | 0 (+1/Lv) | 1 | 5 (+2/Lv) | Strafing Volley Lv1 |
| Mark Target | 5 | debuff | | 0 | 10 | Strafing Volley Lv1 |
| Slow Trap | 5 | control | | 4 | 10 | Arrow Shower Lv1 |
| Inner Focus | 5 | buff | | 0 | 20 | Precise Aim Lv1 |

The tightest tree in the game: nine skills, and every one of the eight after the
mastery hangs off it.

### Rogue (12 skills, absorbs 66)

| Skill | Lv | Type | Damage | CD | Cost | Requires |
|---|---|---|---|---|---|---|
| Blade Mastery | 10 | passive | | | 0 | |
| Multistrike | 5 | passive | | | 0 | |
| Dual Wield Mastery | 5 | passive | | | 0 | |
| Venom Strike | 5 | Melee | 1 (+0.2/Lv) | 0 | 3 (+1/Lv) | |
| Venom Coating | 5 | buff | | 0 | 20 | Venom Strike Lv1 |
| Enchant Poison | 1 | buff | | 0 | 20 | Venom Coating Lv1 |
| Shadow Step | 5 | utility | | | | |
| Cloaking | 5 | utility | | 8 (-1/Lv) | 20 | Shadow Step Lv1 |
| Blade Dance | 10 | Melee | 0 (+0.75/Lv) | 3 | 10 (+5/Lv) | Cloaking Lv1 |
| Smoke Screen | 5 | utility | | 10 (-1/Lv) | 20 | |
| Lightning Reflexes | 5 | buff | | 0 | 20 | Smoke Screen Lv1 |
| Cure, Haste | 5 | | | | | shared with Acolyte |

## Six structural decisions worth copying

1. **Skills are shared between classes.** Cure and Haste belong to both Acolyte
   and Rogue; Increased Recovery to both Acolyte and Mage; Dual Wield Mastery to
   both Rogue and Warrior. A skill is a record, not a class member.
2. **Monsters cast player skills.** Heal is used by twelve monsters, from
   Butterfly Hue at level 31 to Echo Priest at 155. Ragnarok does this too.
3. **Every tree opens with a weapon mastery at level 10** which costs nothing to
   cast and gates the rest of the tree. It is the point sink that makes the
   budget bite.
4. **Cooldown falls with level.** This is the reward that keeps a levelled
   utility worth the points once its magnitude has stopped mattering.
5. **A negative damage coefficient is a heal.** No separate healing field.
6. **The refund is free and per-point.** The planner's own control reads
   `CLICK +1 · SHIFT/RIGHT-CLICK -1`, and the game's official account confirms
   right-click refunds in the live skill tree. A Waybinder NPC in Nevaris also
   sells a full stat or skill reset, separately, for gold, with no cooldown.

## Stats, from the planner

Six attributes, LUK included: `STR VIT AGI DEX INT LUK`, capped at **99 plus
gear**, which is Ragnarok's cap exactly and the one this game already uses.

An earlier fan-wiki reading of five attributes with no LUK was WRONG; the
planner shows six.

Starting spreads are per class rather than a flat 1. A Mage starts
`STR 1 · VIT 1 · AGI 9 · DEX 9 · INT 12 · LUK 1`.

The planner reports 297 stat points at its level-100 snapshot. Base level caps
at 150, job level at 70 (50 base then 70 advanced).

The derived readout it shows is: HP, MP, ATK, MATK, DEF (hard + soft), MDEF
(hard + soft), HIT, FLEE, CRIT, BLOCK, ASPD, CTR. That is very nearly the panel
this game just built, including the hard-plus-soft pairs and attack speed as a
rate rather than an interval.

## Equipment slots

Ten worn slots plus four sockets:

```
Head · Eyewear · Chest · Back · Legs · Feet · Main Hand · Off Hand · Accessory x2
Rune · Jewel · Scroll · Relic
```

The ten match this game's ten exactly. The four sockets have no counterpart here.

## What could not be confirmed

- Whether the base tree is 50 points (planner) or 70 (a fan wiki). Recorded as
  50 and flagged.
- The Acolyte class page lists True Sight, which no skill page attributes to
  Acolyte. Either the page is stale or the skill moved.
- What the Grimoire layer (six per class, listed beside the Acolyte tree) does,
  and whether it spends skill points.
- The damage coefficient's units. `Firebolt 0 (+2/Lv)` reaching 10 at level 5
  reads like a multiplier on magic attack, but no source states the formula.
