# Restatting the existing roster onto Ragnarok's curve

Phase 1 of `world-shape.md`: take the monsters already in the tree, give them
fixed Ragnarok stat blocks with race, element and size, and spread them across a
band of levels that is actually FULL rather than a thin line reaching to 99.

Nothing here needs a new name, a new model, or D1. Every monster in the roster
already carries a name cleared through `ip-refactor/NAME-MAP.md`, and all of them
draw on one of twelve shared visual builds.

## What the roster actually is

Counted from `src/sim/content/zone*/mobs.ts`, and the split matters more than the
total. Of the monsters in the tree, roughly half are named individuals rather
than things that populate a field:

| | Roughly | Examples |
|---|---|---|
| field monsters | 31 | Forest Wolf, Sableweb Lurker, Mire Prowler, Thornpeak Ogre |
| bosses, rares and dungeon-only | 29 | Old Greyjaw, Sister Nhalia, Voskar the Emberwing, the three Visions, Training Dummy |

Ragnarok's field maps carry a median of **6.9 distinct monsters** each (measured
over 162 pre-renewal field maps). Thirty-one field monsters therefore fill
**about six to eight areas properly**, not the thirty in the island plan, and
certainly not a spread to level 99, which would leave every area with two things
to fight.

The bosses are not spare. One per area is exactly the shape SpiritVale uses (a
boss sub-area attached to each map), and eight areas need eight of them; the rest
belong to the dungeons that already exist.

**So phase 1 covers levels 1 to 30 across the first eight islands.** A complete
early game, not a hollow whole one.

## The curve

Medians from the pre-renewal monster database, by five-level band. These are
aggregate statistics used to calibrate our own numbers, not records to copy: our
monsters are different creatures with different names, and the only thing being
taken across is the SHAPE of the difficulty ramp. See
`ro-reference-source.md` for the standing rule on `db/`.

| Level | HP | ATK min-max | DEF | MDEF | AGI | VIT | DEX | LUK |
|---|---|---|---|---|---|---|---|---|
| 1-5 | 55 | 1-2 | 20 | 20 | 0 | 0 | 8 | 10 |
| 6-10 | 182 | 22-28 | 0 | 0 | 9 | 9 | 15 | 15 |
| 11-15 | 471 | 39-43 | 0 | 10 | 12 | 13 | 35 | 5 |
| 16-20 | 733 | 64-75 | 5 | 5 | 19 | 25 | 32 | 15 |
| 21-25 | 1,176 | 118-140 | 10 | 5 | 24 | 25 | 36 | 10 |
| 26-30 | 2,282 | 150-208 | 5 | 10 | 26 | 29 | 45 | 15 |

Three properties of that table are load-bearing, and each one contradicts an
assumption the current per-level scaling model makes.

- **Monster STR is zero almost everywhere.** A monster's attack is the authored
  min-max pair; it is not derived from Strength the way a player's is. That is
  already what `combat/weapon_damage.ts` implements, and the data confirms it.
- **DEF is tiny.** The median sits between 0 and 10 across the whole early game.
  Monsters survive on hit points, not on armour, so the hard-DEF percentage layer
  barely applies to them and the flat Vitality subtraction does most of the work.
- **Dexterity is the monster's main attribute**, rising from 8 to 45 while
  Strength stays at zero. Monsters are accurate. A player who wants to be missed
  has to buy Agility for it; there is no low-accuracy early monster to coast off.

Our own scale already matches, so the HP column transfers with no adjustment: a
Swordman has 123 hit points at level 10, 282 at 20 and 3,997 at 99 on the curves
in `src/sim/job_vitals.ts`, which are Ragnarok's own. A monster of your level
out-tanking you early is correct rather than a mistake.

## Authoring a block

Do NOT hand-tune thirty-one blocks. Read the base off the band for the monster's
level, then apply ONE archetype multiplier. That is both how the variation inside
a Ragnarok band actually reads and the only version of this that stays editable.

| Archetype | HP | ATK | AGI | Reads as |
|---|---|---|---|---|
| `standard` | x1 | x1 | x1 | the baseline for the band |
| `brute` | x1.4 | x0.9 | x0.7 | slow and heavy: ogres, trolls, boars |
| `swift` | x0.7 | x1.0 | x1.5 | hard to hit, dies fast: wolves, stalkers, spiders |
| `caster` | x0.8 | x0.7 | x0.9 | fights with magic: cultists, elementals, necromancers |
| `boss` | x6 | x1.5 | x1 | the area's named individual |

The boss multiplier is a starting point, not a result. A boss is tuned against
its fight.

## Experience is authored too, and both kinds of it

The same shape mismatch as hit points, in a place that is easy to miss. Our
experience is DERIVED from the monster's level (`mobXpBase` in `types.ts`, a
division of the level's own curve), so every monster of a level is worth exactly
the same. Ragnarok authors it per monster, which is what lets a slow tanky thing
be worth more than a fast weak one at the same level.

Medians from the same database, and the ratio is the interesting column:

| Level | Base EXP | Job EXP | Job/Base | Base per 100 HP |
|---|---|---|---|---|
| 1-5 | 5 | 4 | 0.80 | 6.0 |
| 6-10 | 23 | 16 | 0.70 | 11.6 |
| 11-15 | 59 | 40 | 0.68 | 12.5 |
| 16-20 | 134 | 86 | 0.64 | 18.3 |
| 21-25 | 264 | 160 | 0.61 | 22.4 |
| 26-30 | 461 | 266 | 0.58 | 20.2 |

Those medians are an ANCHOR and nothing more. The variance around them is the
actual finding, and it is large enough to rule out deriving either number:

    Job/Base ratio     p10 0.50 · median 0.63 · p90 0.86 · range 0.20 to 2.00

    Base EXP among monsters of the SAME level
      level 10   6 monsters    3 to 100     a 33x spread
      level 15   7 monsters    1 to  84     an 84x spread
      level 25   9 monsters  233 to 465

**Two monsters of one level can be worth eighty times different experience**,
because experience is priced against how hard the thing is to KILL, not against
the number on it. A level-15 creature that dies to one hit and one that takes
three minutes are not the same reward, and Ragnarok says so directly.

That is fatal to the model in the tree today: `mobXpBase(mobLevel)` divides the
level's own curve, so every monster of a level is worth exactly the same and
nothing a designer does can change it. Both numbers have to be authored per
monster. Use the band medians to start from and expect to land far off them.

The last column of the table shapes play in a different way: experience per hit
point RISES with level, roughly tripling across these six bands. A higher-level
monster is worth more PER SWING, not merely more, which is why the right answer
in Ragnarok is always to fight the strongest thing you can still kill.

**Author `jobExp` in this pass even though nothing reads it yet.** Job levels are
`D5` and do not exist; the field will sit unused. Authoring it now costs one more
number per record and saves walking all thirty-one records again later.

## Assigning the three classifications

Every monster needs `race`, `element` (plus its attribute level) and `size`, and
**not one of them carries any today**, which is why the element chart, the size
table and the whole card system currently have nothing to act on.

Assign from what the creature IS, not from where it lives:

- **race** from the family it already has (`beast` to brute, `spider` to insect,
  `undead` to undead, `humanoid` to demi-human, `elemental` to formless,
  `troll`/`ogre` to demi-human, `mudfin` to fish, `burrower` to brute,
  `dragonkin` to dragon, `demon` to demon)
- **element** from the creature's nature, spread so that no area is single
  element. Ragnarok's areas mix two or three, which is the entire reason a
  player carries a second weapon
- **size** from the model: small for insects and critters, large for ogres,
  trolls and dragonkin, medium for everything else

Element level starts at 1 for everything in this band. Levels 2 and above sharpen
the chart in BOTH directions (`combat/elements.ts`) and belong to content built
around them, not to a first pass.

## What is deliberately left out

- **Levels 31 to 99.** Phase 3 in `world-shape.md`. Growing the roster is a data
  task on the twelve existing builds, so it costs no art, but it is a separate
  piece of work and pretending the current roster stretches that far would make
  every area thin.
- **Cards and rare drops.** `B4` and the rest of `B5`. See the drop model below:
  the material arm is authored HERE, the other two arms are not.
- **`MOB_AP_PER_DPS`.** It exists only because monster attack power is on the
  pre-conversion scale. Retiring it is `C6` and it becomes possible the moment
  the blocks above are authored, not before.

## The drop model, in three arms

Settled here rather than deferred, because one of the three arms has to be
authored in the SAME pass as the stat blocks: a material keyed to an area is one
more line on a record we are already editing, and revisiting thirty-one records
to add it later is pure waste.

The mechanism needs nothing new. `MobTemplate.loot` is already a `LootEntry[]`
with a chance, a money arm and exclusive `rollGroup` partitioning, and crafting
already exists as a whole subsystem (`src/sim/professions/crafting.ts` against
`src/sim/content/recipes.ts`).

| Arm | What drops | Rate | When |
|---|---|---|---|
| **material** | one or two per AREA, from most things in it | common, above 50% | **this pass** |
| **rare** | a finished piece, from a specific monster | 0.1% to a few percent | `B5` |
| **card** | the monster's own card | see below | `B4` |

**Materials are the floor.** An area's material is what makes the area worth
standing in, and taking it to an NPC to craft that area's gear is what turns
"I killed things here" into a reward you chose rather than one you rolled for.
It also solves a problem sitting in the tree right now that has nothing to do
with Ragnarok: **deleting the quest system orphaned about 130 items**, which have
no source in the world at all any more. Scattering 130 items across drop tables
would turn every table into noise; making them craft OUTPUTS is a list, and each
one lands somewhere on purpose.

**Rare drops are the ceiling**, and the reason not to stop at the floor. A purely
deterministic material-to-craft loop has no moment in it. Ragnarok's drop rates
are deliberately spread across four orders of magnitude: 12% of its drops are
above 50% and 22% are below 0.1%, which is the same table holding both the thing
you always get and the thing you tell people about.

### Cards, crafting and refining have their own document

The card rates, the rarity tiers, the forge, the crafting stations and the
refining ladder are all settled, and all of them follow SpiritVale rather than
Ragnarok. They live in `drops-and-crafting.md` because they are a subsystem
rather than part of this authoring pass.

The only arm that belongs HERE is the material one, because it is one more line
on a record already being edited.
