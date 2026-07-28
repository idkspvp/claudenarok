# SpiritVale's world, spawning, drops and item economy

The loop half of "numbers from Ragnarok, play from SpiritVale". Everything here
is measured off `data/spiritvale-raw/` in July 2026, not summarised from prose.
Combat math is in `spiritvale-engine-formulas.md`; record shapes are in
`spiritvale-data-schema.md`.

The through-line: **almost every rate in this game is one of a handful of fixed
values.** A card is 0.5% or 3%. A gem is 0.1% or 0.3%. Equipment level
requirement is 0, 50 or 100 and nothing else. Where Ragnarok tunes per item,
SpiritVale picks from a short ladder, and the design reads as deliberately
legible rather than deeply tuned.

## The world: 46 maps on a five-level grid

```
type    0 field (42)   1 town (2)   2 arena (1)   3 tower (1)
biome   0 to 6, seven values, labels unpublished
```

Town is Nevaris and Wayfarer's Landing. Arena is the PvP map. Tower is The
Echoing Spire, the Eternal Tower's boss arena.

**Every field map spans exactly five levels**, in an unbroken chain from 1 to
140, with two deliberate exceptions: Sanctum of Light covers 76 to 85 (ten
levels) and The Echoing Spire covers 146 to 155.

| Band | Maps |
|---|---|
| 1-5 | Sunny Meadows 1 |
| 6-10 | Sunny Meadows 2 |
| 11-15 | Forest Field 1 |
| 16-20 | Forest Field 2, Nevaris Sewers, Treant Trail |
| 21-25 | Bunny Woods, Festering Woods 1 |
| 26-30 | Festering Woods 2, Lake Field, Windy Desert |
| 31-35 | Fairy Glen, Mystic Lake 1, Windy Desert North, Windy Desert South |
| 36-40 | Mystic Lake 2, Swamp |
| 41-45 | Forgotten Depths 1, Goblin Field |
| 46-50 | Forgotten Depths 2, Goblin Village |
| 51-55 | Goblin Cave 1 |
| 56-60 | Goblin Cave 2 |
| 61-65 | Stormreef Isle |
| 66-70 | Swamp Wilderness |
| 71-75 | Crystal Cave |
| 76-85 | Sanctum of Light |
| 86-90 | Underground Cavern |
| 91-95 | Dark Forest |
| 96-100 | Demon's Maw |
| 101-105 | Sunken Depths |
| 106-110 | Abyss Castle Dungeon |
| 111-115 | Abyss Castle Keep |
| 116-120 | Abyss Castle Crypt |
| 121-125 | Abyss Castle Library, Goblin Warcamp |
| 126-130 | Night Garden, The Forge |
| 131-135 | Starfall Tundra, Turtle Nexus |
| 136-140 | Ancient Ruins |
| 146-155 | The Echoing Spire |

One to four maps per band, so a player at any level has somewhere to go and
occasionally a choice, and never more than four. Note 141 to 145 is empty: the
Eternal Tower covers it instead.

`bossRespawn` is **3600 seconds on all 46 maps**. Not tuned per map, and not the
"2 to 3 hours" the community wiki reports, which is worth flagging as a
disagreement rather than resolving.

**Biome labels are not published.** Grouping the maps by their biome value gives
a clean read, offered as inference, not fact:

| Value | n | Maps | Reads as |
|---|---|---|---|
| 0 | 13 | Sunny Meadows, Forest Field, Treant Trail, Bunny Woods, Fairy Glen, Dark Forest, Night Garden, the towns | grass and forest, the default |
| 1 | 8 | Windy Desert x3, Swamp, Swamp Wilderness, Goblin Field / Village / Warcamp | arid and wasteland |
| 2 | 3 | Goblin Cave 1, Goblin Cave 2, Underground Cavern | cave |
| 3 | 2 | Demon's Maw, The Forge | fire |
| 4 | 2 | Crystal Cave, Starfall Tundra | ice |
| 5 | 12 | Nevaris Sewers, Festering Woods, Forgotten Depths, Sanctum of Light, Abyss Castle x4, Ancient Ruins, Echoing Spire | ruin and dungeon |
| 6 | 6 | Lake Field, Mystic Lake x2, Stormreef Isle, Sunken Depths, Turtle Nexus | water |

Six of the seven read cleanly. Value 1 mixes desert with swamp and the goblin
maps, so treat that one as unresolved.

## Spawning: area drives population

Three numbers per map, in `spawn-meta.json`:

```
spawners     2 to 20      how many spawn points
spawnArea    9,948 to 106,875     the total area they cover
monsterCap   50 to 450    how many can be alive at once
```

Plus a `density` on the map itself (0.5, 0.75, 1.0 or 1.25) and one global rule:

```
monsterSpawnInterval  10 seconds
monsterSpawnDensity   0.5
respawnJitter         x1.0 to x1.5
```

The cap is not authored independently. Solving `monsterCap = spawnArea/1000 * K
* density` across all 41 maps gives K in a tight band of **4.44 to 5.07**, so
the rule is approximately:

```
monsterCap ~= spawnArea / 200 * density
```

One monster per 200 square units at density 1. It does not land exactly (24 of
41 within 1), which suggests the published `spawnArea` is a sum of per-spawner
areas each rounded on its own. Read the relationship, not the formula.

**Across the whole world 7,371 monsters are alive at once.** Density is the only
hand-tuned knob and it moves in quarters.

The densest maps are Sunken Depths, Turtle Nexus and Swamp Wilderness at the
full 5.00 per 1000; the deliberately sparse one is Festering Woods 1 at 2.49
(density 0.5, the only map set that low).

Spawn placement is a two-way index: `maps[].pool` lists what spawns there (2 to
19 monsters per map) and `spawns.json` inverts it, monster to maps. 295 monsters
have a placement.

## The Eternal Tower

```
floors             101
monsters per floor 100
level offset       +100, so floor 1 is level 101 and floor 101 is level 201
boss floors        every 5th, plus floor 101: F5 F10 ... F95 F101, 20 in all
boss arena         The Echoing Spire
```

Each floor names its monsters and a count that sums to 100 (floor 1 is 50 Egg
plus 50 Egglet). This is the entire endgame past level 140 and it is authored as
a flat list, not generated.

## Drops: a fixed ladder, not per-item tuning

Every drop rate in the game comes from a short set of values, and which set
depends only on the category and whether the killer's target was a boss.

| Category | Mob rates | Boss rates | Median mob / boss |
|---|---|---|---|
| Equipment | 0.3, 1, 2, 3, 4, 5 | 10, 15, 20, 25, 30 | 2% / 10% |
| Material | 0.01 to 10, plus 50 and 100 | same ladder | 0.01% / 0.1% |
| Consumable | 0.1, 1, 10 | same | 1% / 1% |
| Gem | **0.1** | **0.3** | two values, no exceptions |
| Card | **0.5** | **3** | two values, no exceptions |
| Artifact | 1, 2, 3, 4, 5, 10 | **none, mobs only** | 3% / n/a |

**Cards are 0.5% from a mob and 3% from a boss. Full stop.** Pre-renewal
Ragnarok runs card rates near 0.01%, fifty times rarer, and tunes them per mob.
This is the single clearest expression of the "legible rather than punishing"
design, and it is the number most worth copying.

**Artifacts drop from normal monsters and never from bosses,** which inverts the
usual expectation and is what makes ordinary grinding worth doing at every
level.

### What one monster's loot table looks like

Not a strict template, but a consistent shape. 286 non-boss monsters produce 48
distinct drop shapes, and the recurring one is:

```
1 armour piece      4 to 5%
1 to 3 weapons      1 to 4%
1 accessory or back 1 to 3%
1 rare headgear     0.3%          only 36 monsters, the "Drooping" family
1 zone material     100%          GUARANTEED, 30 distinct materials
1 refine shard      2 to 10%      Vulkanite, Gravion or Lunaris
Cosmetic Converter  0.01%         283 of 286 monsters carry it
its own card        0.5%
1 gem               0.1%
1 artifact piece    1 to 10%
```

Three of those are near-universal and load-bearing:

- **A guaranteed 100% zone material.** 256 of 286 monsters drop one, and there
  are 30 distinct ones, so each zone has its own currency and no kill is empty.
  This is the crafting economy's whole input.
- **Cosmetic Converter at 0.01% on 283 of 286 monsters.** A single world-wide
  ultra-rare that any kill anywhere can produce.
- **Three refine shards** (Vulkanite, Gravion, Lunaris) at 2, 4, 6, 8 or 10%
  scaling with zone. Refining materials are common by design.

Equipment drop rate tracks slot: Chest, Legs and Feet run 4 to 5%, weapons 3 to
4%, accessories and backs 1 to 3%, and the 0.3% tier is reserved for one
headgear family.

## Equipment: 518 pieces, three level gates

```
slot       25 values: 9 armour and accessory slots, Grimoire, and 15 weapon types
lvl        0, 50 or 100.  THREE VALUES for the whole game
element    489 Neutral, 29 elemental
cardSlots  0 to 4
set        75 pieces across 24 sets
```

**The weapon type IS the slot.** There is no generic weapon slot with a subtype,
which makes a class restriction on a weapon redundant (only 1 of 518 pieces has
one).

**Equipment has only three level requirements: 0, 50 and 100.** Ragnarok gates
per item; this gates in three tiers and lets the stat lines do the rest.

Card slots split cleanly by role:

| Slot family | Card slots |
|---|---|
| Head, Chest, Legs, Feet, Back, Shield, Eyewear, Accessory | almost always **1** |
| Every weapon type | **2 to 4** |
| Grimoire | **0**, always |

So weapon customisation is the deep axis and armour is the shallow one, which is
the opposite of Ragnarok, where a four-slot armour is a build-defining item.

Sets run 2 to 4 pieces (most are 3) with one full-set bonus each. There are 24
sets covering 75 of 518 pieces, so most equipment is standalone.

## Cards: 269, one per monster

```
eqClass  which slot it fits: Head 59, Weapon 60, Accessory 40, Legs 37,
         Chest 28, Shield 27, Feet 18
affix    a name the item takes on
stats    205 cards have exactly ONE stat line; 47 have two
unique   29 cards, all rendered gold
```

255 of 319 monsters drop a card, and the card is named after the monster. The
most-used stat is `DamageElement` (31 cards), then `MpMult`, `GrantSkill` (21
cards grant a skill outright) and `ElementResist`.

**16 cards carry a negative stat.** The Cosmic Entity Card is +10% attack and
+10% magic attack for -25% health and -25% mana. A card is allowed to be a
tradeoff, not just a bonus.

## Gems: 129, and 100 of them are one idea

```
100 gems   { stat: "SkillDamage", per: 2, q: "<SkillId>" }
           +2% damage to ONE named skill, per refine
 36 gems   isBoss, carrying a general stat instead
```

A gem sockets into an artifact rather than into equipment. The overwhelming
majority are per-skill damage, which is how a build commits to a rotation. The
36 boss gems carry the general stats instead: attack speed, crit damage, perfect
dodge, reflect, threat, weight limit, one each.

## Artifacts: 34 sets of four pieces

```
ART_PIECES = [ Rune, Jewel, Scroll, Relic ]
```

Every artifact has four pieces, and a monster's artifact drop names which piece
index it gives. Four bonus tracks per artifact:

| Track | Present on | What it is |
|---|---|---|
| `fullSet` | 34 of 34 | the bonus for holding all four |
| `perPiece` | 24 | scales with how many pieces you hold |
| `perRefine` | 24 | scales with refine level |
| `individual` | 9 | per-skill lines, on the class artifacts |

The 34 are named for what they do (`Atk`, `Crit`, `Leech`, `Vampiric`) or for a
class (`Acolyte`, `Knight`, `Mage`, `Rogue`, `Scout`, `Summoner`, `Warrior`,
`Novice`).

### The loop this closes

**All 39 grimoires are crafted from the four pieces of one artifact.** Every
`classCraft` recipe, without exception:

```
Acolyte_6  <-  Acolyte artifact slots 0, 1, 2, 3
```

So the chain is: grind normal monsters, collect four artifact pieces of a class
set, craft a grimoire, equip a passive. That is the entire acquisition path for
the passive layer that sits outside the skill-point budget, and it runs on the
one drop type that comes from ordinary mobs rather than bosses. The design is
tight, and it is the single best structural idea in the whole dataset.

## Substat re-rolls: pick a group, then a line

Nine pools, one per slot family. A pool is a list of GROUPS and each group is a
list of alternatives, so a roll picks a group and then a line inside it.

| Pool | Groups |
|---|---|
| Headgear | [HpMult 2 \| MpMult 2] [AtkMult 2 \| MatkMult 2] [Atk 3 \| Matk 3] [Def 5 \| Mdef 5] |
| Chest | [HpMult 10 \| MpMult 10] [Def 10 \| Mdef 10] [DefMult 5 \| MdefMult 5] [DamageFromMelee -5 \| DamageFromMagic -5] [HealingReceived 10 \| PerfectDodge 5] |
| Legs | [HpRegenMult 25 \| MpRegenMult 25] [Leech 5 \| CastSpd 10] [Flee 15 \| PerfectDodge 5] [MpCost -10] |
| Feet | [AtkSpd 10] [MoveSpd 10] [CastSpd 10] [AtkSpdLimit 1] |
| Accessory | [HpMult 2 \| MpMult 2] [AtkMult 2 \| MatkMult 2] [Crit 5 \| Hit 10 \| AtkSpd 5] |
| Artifact | [HpMult 2 \| MpMult 2] [AtkMult 2 \| MatkMult 2] |
| Melee / Ranged / Magic | 4 groups each, offence-shaped |

Feet is the interesting one: four single-line groups, so a boot rolls exactly
one of movement, attack speed, cast speed or the attack-speed cap. No overlap,
no dilution.

The essence economy that drives these rolls (five essence types, costs,
potential ranges, drop weights, the two-thirds roll floor) is in
`spiritvale-engine-formulas.md`.

## Crafting: the simplest system in the game

```
474 recipes by result, 550 total recipe rows, 41 crafters
kinds:      526 equipment, 24 consumable
materials:  EVERY recipe uses exactly ONE material type
count:      5 to 500, median 100
```

**The crafter is a PLACE, not an NPC.** `crafter: "Bunny Woods"` names the zone,
so crafting is unlocked by getting there.

Every single recipe is "N of one material". Combined with the guaranteed 100%
zone material, the loop is: kill anything in a zone, accumulate its material,
buy that zone's equipment outright. No sub-components, no trees, no fail chance.

The 24 consumable recipes are almost all boss Lures at 5 Memory Fragments each,
which is how a player forces a boss spawn instead of waiting out the hour.

Materials have three rarities (Common 31, Rare 9, Epic 9) and **`sell` is 0 on
all 49**, so the field is unused and materials cannot be vendored.

## Consumables: 27, three types

| Type | n | What |
|---|---|---|
| 1 | 24 | boss Lures (ids are literally `Lure Eyeball Monster`) |
| 2 | 1 | Box of Origins, "contains a random base class artifact" |
| 3 | 2 | Mystery Mount Egg, Mystery Pet Egg |

There are no healing potions in this dataset. Every consumable is a spawn, a
loot box or a cosmetic roll.

## Cosmetics: 447, premium currency only

```
slots   14, including Pet 24, Mount 17, Emote 4 and Stall 1
tiers   0: 86,  1: 280,  2: 67,  3: 14
prices  200, 300, 400, 500, 600, 700, 800, 1000 premium
```

`Stall` as a cosmetic slot implies player vending, which nothing else in the
dataset describes. The file's own note says Hidden entries and founder-exclusive
items were excluded, so 447 is a floor, not the total.

## What to take

Ranked by what it buys this game, on the same "gameplay from SpiritVale" rule:

1. **The artifact-to-grimoire loop.** Four pieces from ordinary mobs, craft a
   passive. It gives normal monsters an endgame reason to exist and it puts the
   passive layer outside the skill-point budget. Nothing here is cheaper to
   implement or does more work.
2. **A guaranteed 100% zone material on every monster.** No kill is empty, and
   it makes one-material crafting possible. Two lines of data per monster.
3. **Card at 0.5% mob and 3% boss, flat.** Fifty times more generous than
   pre-renewal and immediately legible to a player.
4. **Five-level map bands in an unbroken chain.** A player always knows where to
   go, and it takes no quest system to tell them.
5. **Weapons carry 2 to 4 card slots and armour carries 1.** Puts build depth in
   the slot a player replaces most often.
6. **One material per recipe.** The whole crafting system stays readable.

Deliberately not recommended:

- **Three level tiers on equipment (0, 50, 100).** Too coarse for a game whose
  level cap is 99 and whose gear progression is the reference's.
- **No healing consumables.** Whatever replaces potions in SpiritVale is not in
  this data, and dropping potions without knowing the replacement would be
  copying half a system.
- **`sell: 0` on every material.** Almost certainly an unfinished field rather
  than a design, and not something to reproduce.

## Open

`biome` value 1 (desert plus swamp plus goblin maps does not read cleanly),
`map.type` beyond the four observed uses, and whether `bossRespawn` really is a
uniform hour given the community wiki says two to three hours.
