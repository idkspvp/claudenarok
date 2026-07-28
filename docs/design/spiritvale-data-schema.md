# SpiritVale's data schema

What shape every record in `data/spiritvale-raw/` has, and which fields carry
design weight. Read this before reading the numbers; the formulas are in
`spiritvale-engine-formulas.md`.

The load-bearing observation: **almost every value in the game is expressed as
`{stat, base, per, q}`**, where `stat` names an entry in the 219-key StatType
catalog (`data/spiritvale-stat-catalog.tsv`), `base` is the level-1 value, `per`
is the per-level step, and `q` is an optional qualifier naming the skill or
status the line applies to. Items, cards, gems, artifacts, sets, statuses,
passives and summons all use it. One vocabulary, one shape, seven consumers.
That is the single biggest structural idea in the data, and it is worth copying
whether or not any individual number is.

## Skill (`skills-combat.json` `.skills`, 279 records)

Fifty-two fields. Grouped by what they decide:

**Identity**

```
id  name  icon  maxLv          maxLv is 1, 2, 3, 5 or 10
damageType                      Magic | Melee | Ranged | True
element                         one of the ten
classes[]                       0 or more; ONE SKILL CAN BELONG TO SEVERAL CLASSES
weaponTypes[]                   which weapons may cast it, empty means any
```

The 15 class ids that appear: Acolyte, Berserker, Gunslinger, Knight, Mage,
Necromancer, Paladin, Priest, Rogue, Scout, Shinobi, Summoner, Warrior, Weaver,
Wizard. The 17 weapon ids: Axe, Book, Bow, Dagger, GatlingGun, Katar, Launcher,
Mace, Pistol, Rifle, Scythe, Shield, Shotgun, Spear, Sword, Twinblade, Wand.

**Numbers, every one a `{base, per}` pair scaled by skill level**

```
dmg              the power coefficient, a fraction of ATK / MATK
dmgFlat          added flat
dmgMax           damage ceiling
selfDmgMax       self-damage ceiling
damageSacrifice  cost paid in own health
dmgReflect       reflected share
threat            generated aggro
hits             packets per cast
castTime  cooldown  cost  delay
area  chains  charges  duration  velocity  hitLimit  instances
clone            how many copies of the caster
comboReady  comboFinisher
```

Note `per` is often NEGATIVE on cooldown: `Aegis` is `{base: 80, per: -10}`, so
its 80-second cooldown falls to 40 at level 5. Levelling a skill buys frequency
as often as it buys power.

**Booleans, the rules a skill breaks**

```
canCrit  piercing  ignoreBlock  ignoreFlee  ignoreDefence  ignoreDelay
triggerMultistrike  triggerAutocast  triggerHit  hybrid  attached
cloneCast  projectileZone
```

`hybrid` is the flag behind the ATK+MATK scaling base. `ignoreFlee`,
`ignoreBlock` and `ignoreDefence` are three separate permissions rather than one
"true damage" concept, which is finer-grained than this game's `ignoreDefence`
boolean.

**Enums, published as integers with no labels**

```
targetType   0 to 7
castType     0 to 3
exclusiveType 0 to 5
```

The site publishes the values, not their meanings. **Do not guess them.**

**References out**

```
statuses[]      { id, dur:{base,per}, chance:{base,per}, stacks:{base,per} }  applied to the target
selfStatuses[]  same shape, applied to the caster
events[]        { id, type, ev }   ev is a lifecycle hook such as "OnCast"
summon          { count:{base,per}, ref, exclusive }  or null
autocastMult    number
```

## Status (`skills-combat.json` `.statuses`, 185 records)

```
id  name  element  desc  effect
damage  damagePerc      the damage-over-time payload
tick                    seconds between ticks
dot                     boolean
maxStacks  stackable  stacksRefresh
category                0 or 1, unlabelled
mods[]     { stat, base, per, q }   what the status DOES, in catalog terms
procs[]    { id, dur, chance, stacks, self }   statuses this status applies
```

`mods` is where the design lives. `Aegis` is one line,
`{stat: "FinalDamageReduction", base: 100}`, and its rendered `effect` string is
just "+100% Damage Reduction". A status is not special-cased engine behavior; it
is a bundle of stat modifiers with a duration. That is why the stat catalog
carries denial flags like `NoAction`, `NoMove`, `NoCast` and `NoFlee`: a stun is
a status whose mods set `NoAction`.

Seven statuses carry `procs`, so a status can apply another status.

## Passive (`skills-combat.json` `.passives`, 111 records)

```
id  name  desc  maxLv  toggle
values[]    { stat, base, per, q }        the flat modifiers
effects[]   pre-rendered English strings for each value line
triggers[]  the interesting part
```

A trigger:

```json
{ "trigger": "Autocast", "event": "OnCast", "eventValue": "Heal",
  "condition": "None", "conditionValue": "",
  "ref": "SanctuaryField", "refType": "skill",
  "base": 0, "per": 0, "chance": 0, "self": false,
  "text": "Autocast Litany of Sanctuary when casting Heal" }
```

The vocabulary, complete:

| Field | Values |
|---|---|
| `trigger` | Autocast, Cooldown, RecoverMp, Status |
| `event` | OnApplyHit, OnApplyStatus, OnAutoAttack, OnBlock, OnCast, OnCharge, OnCrit, OnDodge, OnEndStatus, OnHeal, OnHealthLow, OnKill, OnMaxStacks, OnRemoveStatus, OnRevive, OnTakePhysicalHit, OnTeleport |
| `condition` | None, SingleTargetMagic, Status, StatusSelf |
| `refType` | skill, effect, or empty |

Seventeen events against four trigger kinds. Every passive in the game is one
row of that cross product plus a reference, which means a new passive is a data
edit and never code. This is the same shape as this game's `gear_effects.ts`
on-hit table, one level more general.

## Summon (`skills-combat.json` `.summons`, 29 records)

```
id  name
stats[]   { stat, base, per }   per is per summoner level: Str base 15, per 0.6
skills[]  { id, lv, chance, ct, cd, targetStatus, castType }
```

A summon is a stat block plus an autonomous skill rotation with per-skill cast
chance, cast time and cooldown. `targetStatus` gates a skill on the target
already carrying a named status, which is how a summon is made to behave rather
than spam.

## Class tree (`spiritvale-all-classes.json`, 15 classes, 258 skills)

```
slug  gameId  displayName  description
type              base | advanced
maxJobLevel       50 for base, 70 for advanced
advancedClasses[] what this class promotes into
gridLayout        { "<row>": [7 skill ids, "" for empty ] }
skills[]          { position:{row,col}, id, name, description, maxLevel,
                    isPassive, requirements:[{id, name, level}], values }
```

**The grid is seven columns wide** and 4 to 6 rows deep, and the tree is
authored as a literal layout rather than as a graph the UI has to lay out. A
skill states its own `position` and the grid states what sits at each cell, so
the two agree by construction.

`requirements` is a list of `{skill id, minimum level}`. Prerequisites are the
only gate; there is no per-tier point spend.

| Class | Type | Job | Skills | Rows | Promotes to |
|---|---|---|---|---|---|
| Warrior | base | 50 | 10 | 4 | Berserker |
| Knight | base | 50 | 14 | 4 | Paladin |
| Rogue | base | 50 | 13 | 5 | Shinobi |
| Acolyte | base | 50 | 13 | 5 | Priest |
| Scout | base | 50 | 10 | 4 | Gunslinger |
| Mage | base | 50 | 14 | 4 | Wizard |
| Summoner | base | 50 | 19 | 4 | Necromancer |
| Berserker | advanced | 70 | 16 | 6 | |
| Paladin | advanced | 70 | 17 | 5 | |
| Shinobi | advanced | 70 | 17 | 5 | |
| Priest | advanced | 70 | 18 | 6 | |
| Gunslinger | advanced | 70 | 18 | 5 | |
| Wizard | advanced | 70 | 14 | 6 | |
| Necromancer | advanced | 70 | 23 | 6 | |
| Weaver | advanced | 70 | 42 | 6 | |

**Base classes do NOT get equal skill counts**: 10 to 19. That answers the
question directly. A Summoner has nearly twice a Warrior's tree because a
summoner's skills include the summons themselves. Weaver at 42 is an outlier and
sits outside the seven-parent structure entirely.

Note the arithmetic: a base class caps at job 50, so 49 skill points against a
10-to-19-skill tree with max levels of 5 or 10. A base class can very nearly max
its whole tree. The choice lives in the ORDER, not in the final build, which is
another face of the same "easier" design.

`class-roadmap.json` records 14 announced classes with a parent, an intended
damage type, the attributes and weapons they will key off, and whether they are
in the game files yet. It is a Discord roadmap post, not data: read it as intent.

## Monster (`monsters.json`, 319 records)

```
id  name  slug  desc
element  race  level  exp  size  boss  hostile  essence
skills[]  { id, level, chance }
combat    { arch, str, vit, agi, dex, int, luk, def, mdef, ms, as, ranged }
drops     { equip[], material[], consumable[], gem[], card[], artifact[] }
```

The attribute fields in `combat` are **multipliers on the archetype**, not
absolute values: `{arch: "Defender", str: 1.5, vit: 1.75, agi: 0.25}`. Level and
archetype supply the magnitude and the multipliers supply the character. Adding
a monster means picking an archetype and six numbers near 1.0, which is a far
cheaper authoring step than filling a stat block.

`ms` and `as` are movement and attack speed ranks. `essence` is the drop chance
for the substat re-roll currency.

Races are the reference's ten unchanged: Angel, Beast, Demon, Dragon, Fish,
Formless, Humanoid, Insect, Plant, Undead. Sizes are 0 to 3.

## Equipment (`equip-configs.json`, 518 records)

```
id  name  sprite  prefab  note  unique
slot        one of 25: 10 armour/accessory slots plus 15 weapon types
lvl  element  set  cardSlots
arch[]      class restriction, empty means any
primary[]   { stat, base, per, q }
secondary[] { stat, base, per, q }
substatPool which pool an essence re-roll draws from
```

`per` here scales with REFINE, not level. Slots: Accessory, Back, Chest,
Eyewear, Feet, Grimoire, Head, Legs, Shield, plus one slot per weapon type
(Axe, Book, Bow, Dagger, GatlingGun, Katar, Launcher, Mace, Pistol, Rifle,
Scythe, Shotgun, Spear, Sword, Twinblade, Wand).

The weapon type IS the slot. There is no generic "weapon" slot with a subtype
field, which makes a class restriction on weapons redundant with the slot.

## The rest, briefly

| File | Shape |
|---|---|
| `card-configs.json` (269) | `{ id, name, sprite, eqClass, affix, stats[], unique }`. `eqClass` is which equipment slot the card fits. |
| `gem-configs.json` (129) | `{ id, name, sprite, affix, isBoss, stats[] }`. Mostly per-skill damage: `{stat: "SkillDamage", per: 2, q: "AerialShot"}`. |
| `artifact-configs.json` (34) | `{ id, name, fullSet[], perPiece[], perRefine[], individual[], descriptions[] }`. Four separate bonus tracks per artifact. |
| `set-configs.json` (24) | `{ id, name, fullSet[] }`. |
| `substat-pools.json` (9) | pool name to a list of GROUPS, each a list of `{stat, value}`; a roll picks a group then a line. |
| `maps.json` (46) | `{ id, name, slug, biome, type, minLevel, maxLevel, density, pool[], bosses[], bossRespawn }`. |
| `spawns.json` (295) | monster slug to the maps it appears on. The reverse of `maps.pool`. |
| `spawn-meta.json` | global interval 10 s, density 0.5, respawn jitter 1.0 to 1.5x, plus per-map and tower overrides. |
| `drops.json` (966) | item id to `{monster, slug, chance, level, boss}[]`. The reverse index of `monsters.drops`. |
| `crafting.json` | `byResult` (474), `byMaterial` (31), `classCraft` (39). A recipe is `{crafter, kind, materials:[{id,count}]}`; the crafter is a PLACE, not an NPC. |
| `materials.json` (49) | `{ id, name, slug, sprite, desc, rarity, sell }`. |
| `consumables.json` (27) | `{ id, name, slug, sprite, desc, type, value, reusable }`. |
| `npcs.json` (43) | per-zone `{ name, type, role }`. |
| `map-pins.json` (44) | per-map `{ t, to, x, y }` where `t` is "portal" and x/y are percentages. |
| `worldmap.json` | `{ gridW, gridH, tile, offX, offY, tiles }`. |
| `dungeons.json` | one entry, the Eternal Tower: 100 monsters per floor, level offset 100, per-floor monster lists and bosses. |

## What is worth copying, structurally

Ranked by what it buys, independent of any number:

1. **`{stat, base, per, q}` as the universal modifier.** One vocabulary, one
   shape, and every content system (items, cards, gems, sets, statuses,
   passives, summons) becomes a table rather than code. This game already has
   the pieces (`gear_effects.ts`, the augment and enchant tables) but each
   invented its own shape.
2. **The trigger cross product** (4 triggers x 17 events x 4 conditions). A new
   passive is a data row. This game currently writes a function per proc.
3. **Monster attributes as archetype multipliers.** Adding a monster becomes six
   numbers near 1.0.
4. **The literal skill grid.** The tree is authored as a 7-wide layout so the UI
   never has to lay out a graph.
5. **`ignoreFlee` / `ignoreBlock` / `ignoreDefence` as three permissions** rather
   than one "true damage" flag.

## What this data does not answer

The status-point cost curve, the job experience table, what the Grimoire slot
does, and the meanings of the `targetType` / `castType` / `exclusiveType`
integers. Those are listed in `spiritvale-engine-formulas.md` under "What is
still missing" and should not be filled in by guessing.
