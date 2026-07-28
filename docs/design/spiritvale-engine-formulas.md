# SpiritVale's combat math, from its own client

A community fan site publishes SpiritVale's formulas read out of the game client
itself. The published database (`data/spiritvale-raw/mechanics.json`) names the
engine method behind every rule and lists the numeric constants found in it, and
its header records exactly which build it was read from:

```
game    SpiritVale, appid 3767850, build 24274182, label "0.30.0 Early Access"
data    build 24221798, "artifacts.json (DLL outside steamapps)"
source  node dev/build-mechanics.mjs, generated 2026-07-26
```

Thirty-seven formulas, sixty-five engine methods. Transcribed here in July 2026
from the JSON, not from the rendered page, so the numbers below are the numbers
in the file.

Treat it as a careful community reading rather than as source: the site says so
itself, and nothing here is verified against a decompile by us. Early Access
means it moves; re-fetch rather than trusting a stale copy.

## The one finding that explains why it feels easier

Both games give attack power a Strength breakpoint at every ten points. The
reference SQUARES it; SpiritVale makes it one percent.

```
reference   statusATK = STR + FLOOR(STR/10)^2 + DEX/5 + LUK/5
SpiritVale  ATK       = (Lv/4 + STR*1.5 + DEX/5 + LUK/5 + ...) * (1 + FLOOR(STR/10)/100)
```

At 99 Strength the reference's square term alone adds **81** on top of the 99,
so the last ten points of Strength are worth more than the first fifty.
SpiritVale's breakpoint multiplier reaches **1.09x** across the entire range.

That is the difference between a game where hitting 99 in one stat is the whole
build, and a game where spreading points is reasonable. Every other flattening
below is a variation on it.

## Offense

```
ATK (melee)   ( Lv/4 + STR*1.5 + DEX/5 + LUK/5 + ATKflat*(1 + DEX/200) )
              * (1 + FLOOR(STR/10)/100) * (1 + ATK%)              Formula$$GetAttack

ATK (ranged)  ( Lv/4 + DEX + STR/5 + LUK/5 + ATKflat*(1 + DEX/200) )
              * (1 + FLOOR(DEX/10)/100) * (1 + ATK%)              Formula$$GetAttack

MATK          ( Lv/4 + INT*1.5 + DEX/5 + LUK/5 + MatkPerStr*STR
                + MATKflat*(1 + INT/200) )
              * (1 + FLOOR(INT/10)/100) * (1 + MATK%)             Formula$$MagicAttack

Status DoT    (Lv + STR + AGI + INT) / 10  [ * stacks ]           Formula$$GetStatusDamage
```

- **Character level is a term in all three** (`Lv/4`). The reference's status
  attack has no level term at all, which is why a high-level character there
  with poor Strength hits like a beginner.
- `ATKflat` is weapon attack plus mastery plus flat gear attack, and Dexterity
  amplifies it by `1 + DEX/200`. Dexterity therefore pays twice.
- The ranged branch fires for Bow, Pistol, Rifle, Shotgun, Gatling and Launcher:
  Dexterity leads and drives the breakpoint. Same shape otherwise.
- A two-handed weapon with an empty off-hand multiplies by the
  `TwohandedStanceBonus`, **1.25**.
- Dual wield runs the whole formula again with the off-hand's own weapon state
  (`Formula.AttackOffhand`), so each swing lands two packets and the character
  sheet only shows the mainhand number.
- Every mace grants `MatkPerStr` 1, which is how a Strength build gets magic.

Three auto-attack multipliers sit on top:

| Rule | Effect | Engine |
|---|---|---|
| Multistrike | each packet `* (1 + DoubleAttack/100)`, a flat multiplier, NOT a proc | `Formula$$DoubleAttack` |
| Chain | arcs to `Chain` extra enemies within 8 m, each a fresh independent roll | `Formula$$AttackChain` |
| Splash | reuses the already-rolled damage against everything within `Splash` m | `Formula$$AttackSplash` |

Chain re-rolls, splash does not. Both ride the weapon state, so a dual-wield
off-hand chains and multistrikes on its own values.

## Defence, and the cliff this game just fell off

```
DEF           gearDEF  * (1 + DEF%)          Formula$$Def    (no Vitality term at all)
MDEF          gearMDEF * (1 + MDEF%)         Formula$$MDef   (no Vitality term at all)
damageTaken   100 / (DEF + 100)              Formula$$DamageReduction
Block         NoBlock -> 0; Block >= 100 -> 100; else min(75, Block + shieldBlock)
```

A hyperbola. 100 defence halves damage, 300 quarters it, and **no amount ever
reaches immunity**, so the formula needs no cap and no clamp.

The reference instead applies hard defence as a straight percentage capped at
100 and then subtracts soft defence as a flat amount. That cap is a cliff: reach
it and you take nothing. This game hit exactly that cliff in July 2026, when
Fiesta augments granting 250 to 600 armour on a scale whose ceiling is 100 made
an augmented player physically immune (fixed in `f134970`).

SpiritVale's curve makes that bug structurally impossible.

Block is the one place SpiritVale keeps a cliff of its own, and it is
deliberate: the chance caps at 75%, except that a base Block stat of exactly 100
snaps to a guaranteed 100%. Nothing lands in between.

## Accuracy, evasion, criticals

```
Hit            round( (Lv + 2*DEX + LUK/5 + flatHit + 25) * (1 + Hit%) )   Formula$$Hit
Flee           ( Lv + FLOOR(AGI/2) + flatFlee ) * (1 + Flee%)              Formula$$Flee
               -10% per attacker beyond the FOURTH   (GetFleePenaltyCount)
Perfect dodge  clamp(0, 100, PerfectDodge)      a plain stat, not derived
Crit rate      ( FLOOR(LUK/3) + FLOOR(LUK/10) + flatCrit ) * (1 + Crit%)   uncapped
Crit damage    120 + FLOOR(LUK/5) + CritDamage%
Crit defence   FLOOR(LUK/5) + CritDef          subtracted from the attacker's crit rate
```

Against the reference (`hit = level + DEX`, `flee = level + AGI`, perfect dodge
`(1 + LUK/10)%`, crit `10 + LUK*10/3` per mille and NO damage multiplier at all):

- Dexterity is worth **two** Hit here, and everyone starts from a flat **+25**.
- Agility is worth **half** a Flee, so evasion is far harder to stack.
- The crowd penalty starts at the **fifth** attacker, not the third.
- **Criticals multiply damage** (120% and up). The reference's pre-renewal
  critical does not multiply at all; it takes the top of the weapon range and
  ignores defence. Two completely different designs.
- Perfect dodge is a plain stat here, not a Luck derivation.
- Crit rate is uncapped, but the defender's crit defence subtracts from it, so
  the arms race resolves between two characters rather than against a ceiling.

## Attack and cast speed

```
ASPD          round( 200 - 50*BAD*(1 - (AGI + FLOOR(DEX/4))/250)/(1 + ASPD%)
                     + 0.5*FLOOR(AGI/10) + AtkSpdFlat )            Formula$$AttackSpeed
ASPD cap      min( 193, 185 + FLOOR(AGI/30) + AtkSpdLimit )        Formula$$AttackSpeedLimit
Attack delay  (200 - ASPD) / 50   seconds                          Formula$$AttackDelay
Dual wield    BAD = (BAD1 + BAD2) * 0.8

Cast speed    200 - 50*(1 - (DEX + INT/2)/400)/(1 + CastSpd%)
              + 0.5*(FLOOR(DEX/10) + CastTimeReduction)            Formula$$CastSpeed
CTR           round( (1 - (200 - CastSpeed)/50) * 100 )
CTR cap       min( 90% + CastTimeReductionLimit, CTR )             Formula$$MaxCastTimeReduction
Cast mult     (100 - CTR) / 100
```

Same 200-point scale as the reference, and the same "delay converts to a rate"
idea this game already implements (`aspdDisplay`). Different formula: the
reference cuts a per-job base motion by `(4*AGI + DEX)/1000`; SpiritVale scales a
per-WEAPON base delay by `(AGI + DEX/4)/250` and adds a small Agility bonus on
top. The reference's ceiling is 190, SpiritVale's is 193.

Cast speed reuses the identical shape one scale down, with Dexterity and half of
Intelligence over 400 rather than 250. One idea, two applications.

Base attack delay by weapon (lower is faster), all 23 rows:

| BAD | Weapons |
|---|---|
| 0.90 | Unarmed |
| 1.00 | Dagger, Katar |
| 1.10 | Sword, Sword2H, Book |
| 1.15 | Mace, Mace2H, Instrument |
| 1.20 | Spear, Spear2H, Wand, Wand2H, Scythe, Pistol, Twinblade |
| 1.30 | Axe, Axe2H |
| 1.40 | Bow, GatlingGun |
| 1.50 | Rifle |
| 2.00 | Shotgun, Launcher |

Note it is per WEAPON, not per job-and-weapon. The reference's table is
two-dimensional; this one is a single column.

Which weapons can dual wield: Sword, Dagger, Axe, Pistol, Twinblade, Katar.
Which are inherently two-handed: Bow, Scythe, Instrument, Rifle, Shotgun,
Launcher, GatlingGun. Which count as ranged: Pistol, Bow, Rifle, Shotgun,
Launcher, GatlingGun.

## Resources and sustain

```
Max HP   max(1, round( ((Tri(L)*Arch% + 10*Lv + 200) * (1 + VIT/100) + flatHP) * (1 + HP%) ))
         Tri(n) = n*(n+1)/2, L = clamp(Lv, 1, 130)              Formula$$MaxHealth
Max MP   [ (45 + 5*Lv) * (1 + INT/100) + flatMP ] * (1 + MP%)   Formula$$MaxMana

HP regen round( (MaxHP/200 + VIT/5 + flatRegen) * (1 + VIT/200 + HpRegen%/2)
                + MaxHP * MaxHpRegen% )                          Formula$$HealthRegen
MP regen round( ( (MaxMP/100 + INT/5 + flatRegen) * (1 + INT/200 + MpRegen%/2)
                  + MaxMP * MaxMpRegen% ) * (1 + MpRegen%) )     Formula$$ManaRegen

Healing  (Lv + INT + VIT) * 2.5 * Healing%                       Formula$$GetHealing
Siphon   HP: Siphon * (Lv + VIT) / 50   ·   MP: Siphon * (Lv + INT) / 50
Leech    HP/hit = round( dmg * Leech/100 * 0.2 * (1 + HealingReceived/100) )
         MP/hit = round( dmg * ManaLeech/100 * 0.02 )      CombatComponent$$ApplyLeech
Reflect  (Lv + DEF/2 + flatDEF/2 + ATK/2) * 4 * Reflect%         Formula$$GetReflectDamage
Resist   attribute * 0.66% per point, cutting both chance and duration
```

Health is quadratic in level through the triangular number, scaled by a
per-class multiplier. Spell points are linear. Vitality and Intelligence are
plain percentage multipliers on their own pool, which is far simpler than the
reference's per-job table.

Three details in the sustain block are easy to get wrong and worth pinning:

- The regen multiplier stats enter **halved**, because the engine averages
  `(1 + VIT/100)` with `(1 + HpRegenMult/100)`. On the mana side the same stat
  then applies a SECOND time in full on the finished total, so mana regeneration
  percentage is worth appreciably more than its health twin. The health side
  divides max health by 200, the mana side by 100.
- Leech converts a **fifth** of its face value (the 0.2), banks into a reserve
  rather than healing instantly, and that reserve pays out at most 20% of max
  health per second. Past a certain attack speed the per-second ceiling is the
  real cap, not the per-hit amount. Only Melee, Magic and Ranged hits that
  connect steal; Status and True damage never do, a miss banks nothing, a
  blocked hit still banks, and at most 3 targets per attack contribute.
- Status resistance maps one attribute per status pair: Strength resists
  bleed and stagger, Agility slow and freeze, Vitality stun and decay,
  Intelligence silence and burn, Dexterity poison and blind, Luck curse and
  weaken.

## Archetypes: the class table

The seven base classes, complete:

| Class | HP mult | STR | VIT | AGI | DEX | INT | LUK | Max job |
|---|---|---|---|---|---|---|---|---|
| Warrior | 130% | 12 | 9 | 9 | 1 | 1 | 1 | 50 |
| Knight | 100% | 9 | 12 | 1 | 9 | 1 | 1 | 50 |
| Rogue | 85% | 9 | 1 | 12 | 9 | 1 | 1 | 50 |
| Acolyte | 75% | 1 | 9 | 1 | 9 | 12 | 1 | 50 |
| Scout | 70% | 1 | 1 | 9 | 12 | 9 | 1 | 50 |
| Summoner | 70% | 9 | 9 | 1 | 1 | 12 | 1 | 50 |
| Mage | 50% | 1 | 1 | 9 | 9 | 12 | 1 | 50 |

Every base class starts with **12 in its lead attribute, 9 in two supports, 1 in
the rest**, and nobody starts with Luck. The health multiplier spreads 50% to
130%, which is the entire durability difference between a Warrior and a Mage.

The archetype table holds 31 entries. The other 24 are advanced classes and
crafting professions: all run job level 1 to **70**, all carry a health
multiplier of 1.0 except Weaver at 0.5, and all publish their starting
attributes as zero, which reads as "not authored in this table" rather than as a
real reset. An advanced class does NOT inherit its parent's health multiplier
(Berserker is 1.0 where its parent Warrior is 1.3).

Of the 31, fifteen have real skill trees in the export (see
`spiritvale-data-schema.md`): the seven base classes minus Warrior's and
Summoner's overlap, plus Berserker, Gunslinger, Necromancer, Paladin, Priest,
Shinobi, Weaver and Wizard. The rest are announced but not yet in the files.

The reference starts every job at 1 across the board and separates jobs by their
health and spell-point tables instead.

## Elements: a 10x10 table with three values

```
        NEU  POI  SHA  HOL  FIR  WAT  WIN  EAR  UND  GHO
Neutral   -  0.75 0.75   -    -    -    -    -    -  0.75
Poison  1.25 0.5    -    -    -    -    -    -  0.75 0.75
Shadow  1.25   -  0.5  1.25   -    -    -    -    -  1.25
Holy      -    -  1.25 0.5    -    -    -    -  1.25 0.75
Fire      -    -    -    -  0.5  0.75   -  1.25   -    -
Water     -    -    -    -  1.25 0.5  0.75   -    -    -
Wind      -    -    -    -    -  1.25 0.5  0.75   -    -
Earth     -    -    -    -  0.75   -  1.25 0.5    -    -
Undead    -  1.25   -  0.75   -    -    -    -  0.5  1.25
Ghost   1.25   -  0.75   -    -    -    -    -  1.25 0.75
```

Blank is 1.0. **Only three values exist: 1.25, 0.75, 0.5.** No attribute levels,
no immunity, and nothing ever heals.

The reference's chart is 4 levels deep with values from -100 to +200, where a
level-4 undead is HEALED by shadow and poison. This game just replaced its
invented chart with that real one (`02cfb38`), all 400 cells.

SpiritVale flattened the same ten-by-ten relationship into a single table with
three multipliers. It is the element triangle without the homework.

Monster races are the reference's ten, unchanged: Angel, Beast, Demon, Dragon,
Fish, Formless, Humanoid, Insect, Plant, Undead. Sizes run 0 to 3.

## Ceilings

| Cap | Value | Engine |
|---|---|---|
| ASPD | 193 hard, `185 + FLOOR(AGI/30)` soft | `AttackSpeedLimit` |
| Cast-time reduction | 90% + `CastTimeReductionLimit` | `MaxCastTimeReduction` |
| Block | 75%, or a hard snap to 100% at exactly 100 Block | `BlockRate` |
| Perfect dodge / perfect hit | 100% | `PerfectDodge` |
| Elemental resistance | 75% | authored, not read from the engine |
| Status resistance | 100% (bosses sit at a flat 100%, immune) | authored |
| Defence pierce | 100% | authored, community-sourced |
| Leech payout | 20% of max health per second | `ApplyLeech` |

The last three rows are marked `authored` in the source file rather than
`engine`, meaning the site could not read them out of a method and recorded them
from play. Weight them accordingly.

## Party, and the level-gap brake

```
expMult       1 + ScalingBonus * (N - 1) * 0.20
coinMult      1 + ScalingBonus * (N - 1) * 0.10
ScalingBonus  clamp(0, 1, 1 - 0.05 * clamp(0, 100, LevelGap - 30))
```

A tight party of 2, 3 or 4 earns +20%, +40%, +60% experience and half that in
coin. The pool then splits either evenly or by damage contribution, the player's
choice. The brake is the level gap: full value up to a 30-level spread, then 5%
lost per extra level, zero at 50. That is a real answer to power-levelling that
this game currently has nothing equivalent to.

## Experience

Base level runs to **150**; the published curve carries 161 entries, so it is
padded past the cap. The first twenty steps:

| Level | To next | Cumulative |
|---|---|---|
| 1 | 40 | 0 |
| 5 | 1,620 | 1,706 |
| 10 | 7,981 | 20,343 |
| 15 | 24,193 | 86,092 |
| 20 | 61,439 | 271,558 |

Full table: `data/spiritvale-base-exp.tsv`. The last two entries approach the
signed 32-bit ceiling, which suggests the curve was fitted rather than authored.

## Progression: what a level actually buys

Neither number is in `mechanics.json`; both come from a second community wiki
(spiritvale.info), which states them as rules rather than deriving them from the
binary. Weight them one notch below everything above.

**Attribute points, from base level:**

```
level 1          27 points pre-spent by class, NOT reallocatable
levels 2 to 100  3 per level    297
levels 101 to 130  2 per level   60
levels 131 to 150  1 per level   20
                                ----
total earned                     404
```

The 27 reconciles with the archetype table exactly: every base class sums to 33
across the six attributes, all six start at 1, and 33 minus 6 is 27. Two
independent sources agreeing on a number neither derived from the other is the
strongest confirmation available here.

**The cost curve, which is the answer to the open question:**

```
value  1 to 50    1 point per step
value 51 to 98    2 points per step
value 99          3 points
maximum allocation 99; anything above 99 must come from gear or artifacts
```

So raising one attribute from 1 to 99 costs `49 + 96 + 3 = 148`. Two capped
attributes cost 296, leaving 108 of the 404 for the other four. (The source page
says 110 rather than 108; its own cost table gives 108. The discrepancy is
theirs and is left unresolved rather than patched.)

This is Ragnarok's escalating-cost idea with a far gentler slope: the reference
charges `(value/10) + 2` per point, reaching 11 per point near 99, where
SpiritVale never charges more than 3. Same mechanic, one third the punishment,
which is the same flattening as the Strength breakpoint.

**Skill points, from job level:** one per job level, including the point granted
at job level 1.

```
base class            job 1 to 50    50 points
after advancement     job 1 to 70    70 more, spendable on EITHER tree
career total                        120
a class with no advanced form       70
```

And the part worth noticing: **120 points does not max a career.** Summing every
skill's max level, a base tree costs 65 to 75 and an advanced tree 85 to 126, so
both together run 150 to 198. Every build ends 30 to 78 points short (the
per-class table is in `spiritvale-data-schema.md`). SpiritVale flattened its
stat math; it did not flatten its skill budget.

## Item economy

```
Card removal   (cardsOnItem + 4) * 5000    coins, strips EVERY card at once
Gem removal    (gemsOnArtifact + 4) * 5000 coins, same shape
```

Essence, the substat re-roll system, is fully published: five types with a coin
cost, a potential range and a drop weight each.

| Essence | Coin | Potential | Weight | What it does |
|---|---|---|---|---|
| Flow | 25,000 | 2 to 3 | 20 | re-rolls the VALUE of one chosen substat |
| Growth | 35,000 | 3 to 4 | 30 | ADDS a new random substat line |
| Destruction | 45,000 | 4 to 5 | 25 | REPLACES one chosen substat |
| Rebirth | 55,000 | 5 to 6 | 15 | wipes and re-rolls EVERY substat |
| Chaos | 100,000 | n/a | 10 | the wildcard slot |

Every roll has a floor of two thirds of the range, so a re-roll can disappoint
but never bricks the line. Substat caps: 5 plus one Chaos on weapons, 4 plus one
Chaos on other gear, 4 and no Chaos slot on artifacts. Potential is the currency
the roll spends; 10,000 coins buys a point of it.

## What to take, and what not to

Recommended for this game, in order of how much they buy:

1. **`damageTaken = 100 / (DEF + 100)`.** Removes the immunity cliff outright and
   makes every point of defence worth something forever. The one change here
   that fixes a class of bug rather than a number.
2. **A level term in attack power** (`Lv/4`). Levelling should never feel inert.
3. **Per-class starting attributes** (12 / 9 / 9 / 1 / 1 / 1). A new character is
   playable immediately instead of being a blank slate.
4. **Health as `Tri(level) * classMultiplier`** rather than a per-job table.
5. **The party level-gap brake.** Fourteen characters of arithmetic that solves
   power-levelling without a rule anyone has to read.

Deliberately NOT recommended:

- **The linear Strength breakpoint.** It is why SpiritVale is flatter, and
  flatter is not automatically better: the reference's square is what makes a
  99-Strength build feel like an achievement. This is a taste call, not a
  correctness one, and it should be made on purpose.
- **The three-value element table.** This game just spent a commit putting the
  real 400-cell chart in. Trading it for three values throws away the depth that
  makes an attribute card matter.
- **Multiplying criticals.** Pre-renewal's critical (top of range, ignores
  defence, no multiplier) is a genuinely different and more interesting rule,
  and it is already implemented here.
- **Base level 150.** Would require rebuilding the experience curve and moving
  every content level gate.

## The job experience table: unpublished, but the shape is constrained

No job curve appears in any of the site's 28 data files, its page source, its
changelog, or the two other community wikis. What follows is a working
hypothesis with its evidence and its remaining gap stated, NOT a transcription.
Do not implement it as if it were read from the binary.

**Hypothesis: job level reuses the base curve, and one kill feeds both pools.**

Four independent things point that way:

1. **A monster publishes exactly one `exp` field.** Ragnarok publishes two
   (`BaseExp` and `JobExp`, separately tuned per mob). Whatever job experience
   is in SpiritVale, it is derived from that single number rather than authored
   alongside it.
2. **The published curve is one table, not two concatenated.** All 161 entries
   are strictly increasing with no discontinuity anywhere, so there is no second
   curve hiding in its tail. The 11 entries past the level-150 cap are padding.
3. **The array is named `ExpRequirement`, singular,** and the extraction that
   pulled it out of `GameServerConfig.asset` found no sibling.
4. **The resulting shape is coherent.** Under the hypothesis job 50 lands at
   exactly base 50, the advanced track restarts at job 1 and reaches job 70 at
   base 73, and base level then runs another 77 levels with no further skill
   points. Job capping early while base keeps going is an ordinary design, and
   the numbers land in a sensible place rather than an absurd one.

**The gap.** "Same curve" and "job exp equals base exp per kill" are two claims,
and only the first is supported. If job experience were a fraction `f` of the
same number on the same curve, job 50 would land at a different base level:

| Job 50 lands at base | implies `f` |
|---|---|
| 40 | 2.63x |
| 45 | 1.59x |
| 48 | 1.20x |
| **50** | **1.00x** |
| 55 | 0.66x |
| 60 | 0.44x |

Community guides report hitting job 50 "around base level 45 to 50", which puts
`f` between roughly 1.0 and 1.6 and makes `f = 1.0` the low edge of the reported
window. Those guides read as machine-generated SEO pages, so weight that as a
hint, not a measurement. One player's screenshot of a job-50 character's base
level would settle it.

For contrast, the reference goes the other way. Reading
`db/pre-re/mob_db.yml` directly, across the 595 mobs carrying both fields the
`JobExp / BaseExp` ratio has a **median of 0.62** (p10 0.36, p90 1.00), so job
level LAGS base level in Ragnarok by design. If SpiritVale really runs `f = 1.0`
the two levels move in lockstep, which is a different feel and matches the rest
of its "fewer things to fall behind on" design.

**If we adopt it:** implement job experience as its own curve constant seeded
from the base curve, not as a call into the base curve. They are the same
numbers today by hypothesis, not by definition, and a shared reference would
make a future correction touch both.

## What is still missing

Only the item above. Everything else the database raised has been resolved and
recorded, in this file or in `spiritvale-data-schema.md`.

Resolved since the first pass, and recorded where they belong:

- The **status-point cost curve** and points-per-level: above, under
  Progression.
- The **Grimoire slot**: an equippable passive, 39 of them, one `GrantSkill`
  line each. See `spiritvale-data-schema.md`.
- **`targetType` and `castType`**: labelled, from the wiki renderer's own lookup
  arrays. **`exclusiveType`**: still unlabelled, but its membership partitions
  into six coherent groups and two independent fields corroborate the split.
  Both in `spiritvale-data-schema.md`.
