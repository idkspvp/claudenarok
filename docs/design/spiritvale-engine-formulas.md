# SpiritVale's combat math, from its own client

A community fan site publishes SpiritVale's formulas read out of the game
client itself, naming engine symbols as it goes (`Formula.GetDamage`,
`Formula.StatusResist`, `CombatComponent.ApplyHit`, `Formula.AttackOffhand`,
`StatusComponent.Level`). Last updated 2026-07-26. Transcribed here in July 2026.

This supersedes the assessment in `spiritvale-skill-reference.md` that the
SpiritVale data was structure-only and about 40% as complete as the reference's.
With this page it is close to comparable: what is missing now is per-skill
effect detail, not the engine.

Treat it as a careful community reading rather than as source: the site says so
itself. Nothing here is verified against a decompile by us.

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
              * (1 + FLOOR(STR/10)/100) * (1 + ATK%)

ATK (ranged)  ( Lv/4 + DEX + STR/5 + LUK/5 + ATKflat*(1 + DEX/200) )
              * (1 + FLOOR(DEX/10)/100) * (1 + ATK%)

MATK          ( Lv/4 + INT*1.5 + DEX/5 + LUK/5 + MatkPerStr*STR
                + MATKflat*(1 + INT/200) )
              * (1 + FLOOR(INT/10)/100) * (1 + MATK%)
```

- **Character level is a term in all three** (`Lv/4`). The reference's status
  attack has no level term at all, which is why a high-level character there
  with poor Strength hits like a beginner.
- A two-handed weapon with an empty off-hand multiplies by **1.25**.
- Dual wield runs the whole formula twice, once per weapon, and lands two
  packets per swing.
- Ranged swaps which attribute leads and which drives the breakpoint. Same shape.
- Damage over time is one flat expression: `(Lv + STR + AGI + INT) / 10`.

## Defence, and the cliff this game just fell off

```
DEF           gearDEF  * (1 + DEF%)          (no Vitality term at all)
MDEF          gearMDEF * (1 + MDEF%)         (no Vitality term at all)
damageTaken   100 / (DEF + 100)
```

A hyperbola. 100 defence halves damage, 300 quarters it, and **no amount ever
reaches immunity**, so the formula needs no cap and no clamp.

The reference instead applies hard defence as a straight percentage capped at
100 and then subtracts soft defence as a flat amount. That cap is a cliff: reach
it and you take nothing. This game hit exactly that cliff in July 2026, when
Fiesta augments granting 250 to 600 armour on a scale whose ceiling is 100 made
an augmented player physically immune (fixed in `f134970`).

SpiritVale's curve makes that bug structurally impossible.

## Accuracy, evasion, criticals

```
Hit            round( (Lv + 2*DEX + LUK/5 + flatHit + 25) * (1 + Hit%) )
Flee           ( Lv + FLOOR(AGI/2) + flatFlee ) * (1 + Flee%)
               -10% per attacker beyond the FOURTH
Perfect dodge  clamp(0, 100, PerfectDodge)      a plain stat, not derived
Crit rate      ( FLOOR(LUK/3) + FLOOR(LUK/10) + flatCrit ) * (1 + Crit%)
Crit damage    120 + FLOOR(LUK/5) + CritDamage%
Crit defence   FLOOR(LUK/5) + CritDef
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

## Attack speed

```
ASPD          round( 200 - 50*BAD*(1 - (AGI + FLOOR(DEX/4))/250)/(1 + ASPD%)
                     + 0.5*FLOOR(AGI/10) + AtkSpdFlat )
ASPD cap      min( 193, 185 + FLOOR(AGI/30) + AtkSpdLimit )
Attack delay  (200 - ASPD) / 50   seconds
Dual wield    BAD = (BAD1 + BAD2) * 0.8
```

Same 200-point scale as the reference, and the same "delay converts to a rate"
idea this game already implements (`aspdDisplay`). Different formula: the
reference cuts a per-job base motion by `(4*AGI + DEX)/1000`; SpiritVale scales a
per-WEAPON base delay by `(AGI + DEX/4)/250` and adds a small Agility bonus on
top. The reference's ceiling is 190, SpiritVale's is 193.

Base attack delay by weapon (lower is faster):

| BAD | Weapons |
|---|---|
| 0.90 | Unarmed |
| 1.00 | Dagger, Katar |
| 1.10 | Book, Sword, Sword2H |
| 1.15 | Instrument, Mace, Mace2H |
| 1.20 | Pistol, Scythe, Spear, Spear2H, Twinblade, Wand, Wand2H |
| 1.30 | Axe, Axe2H |
| 1.40 | Bow, GatlingGun |
| 1.50 | Rifle |
| 2.00 | Launcher, Shotgun |

Note it is per WEAPON, not per job-and-weapon. The reference's table is
two-dimensional; this one is a single column.

## Resources

```
Max HP   max(1, round( ((Tri(L)*Arch% + 10*Lv + 200) * (1 + VIT/100) + flatHP) * (1 + HP%) ))
         Tri(n) = n*(n+1)/2, L = clamp(Lv, 1, 130)
Max MP   [ (45 + 5*Lv) * (1 + INT/100) + flatMP ] * (1 + MP%)
```

Health is quadratic in level through the triangular number, scaled by a
per-class multiplier. Spell points are linear. Vitality and Intelligence are
plain percentage multipliers on their own pool, which is far simpler than the
reference's per-job table.

Healing is `(Lv + INT + VIT) * 2.5 * Healing%`, so Vitality helps a healer.

## Archetypes: the class table

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
the rest**, and the health multiplier spreads 50% to 130%. An advanced class
inherits its parent's health multiplier but **resets every attribute to 1** and
runs job level 1 to 70.

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

## Ceilings

| Cap | Value |
|---|---|
| Elemental resistance | 75% |
| Status resistance | 100% (bosses sit at a flat 100%, immune) |
| ASPD | 193 |
| Cast-time reduction | 90% |
| Block | 75%, or a hard snap to 100% at exactly 100 Block |
| Perfect dodge / perfect hit | 100% |
| Defence pierce | 100% |
| Leech payout | 20% of max health per second |

Status resistance builds from a `StatusResist` stat plus about two thirds of one
attribute, which attribute depending on the status.

## Experience

Base level runs to 150. The first twenty steps:

| Level | To next | Cumulative |
|---|---|---|
| 1 | 40 | 0 |
| 5 | 1,620 | 1,706 |
| 10 | 7,981 | 20,343 |
| 15 | 24,193 | 86,092 |
| 20 | 61,439 | 271,558 |

## What to take, and what not to

Recommended for this game, in order of how much they buy:

1. **`damageTaken = 100 / (DEF + 100)`.** Removes the immunity cliff outright and
   makes every point of defence worth something forever. The one change here
   that fixes a class of bug rather than a number.
2. **A level term in attack power** (`Lv/4`). Levelling should never feel inert.
3. **Per-class starting attributes** (12 / 9 / 9 / 1 / 1 / 1). A new character is
   playable immediately instead of being a blank slate.
4. **Health as `Tri(level) * classMultiplier`** rather than a per-job table.

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

## What is still missing

- Per-skill effect detail: what `Firebolt 0 (+2/Lv)` multiplies is still
  unstated, though the ATK/MATK formulas above make "a multiplier on MATK" the
  obvious reading.
- The status-point cost curve and points-per-level.
- The job experience table (only base level is published).
- What the Grimoire layer does.
