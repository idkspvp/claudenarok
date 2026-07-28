# How much of SpiritVale we actually have

Measured, not estimated, in July 2026 against the 25 files in
`data/spiritvale-raw/`. Two different questions get two different answers, and
conflating them is the easy mistake:

- **Is the data we hold internally complete?** Yes: 99.94% of its own
  cross-references resolve, and the handful that do not are explainable.
- **Is it the whole game?** No. Four systems are absent outright and one of them
  blocks real work.

## The internal-consistency measure

Every id one record uses to point at another, checked against the set it should
land in. 9,616 references across every dataset:

| Reference | Resolved | Dangling |
|---|---|---|
| monster.skills to skill | 670 | 0 |
| monster.drops to equip / material / consumable / gem | 3,490 | 0 |
| equip.stat to StatType | 2,273 | 0 |
| equip.substatPool to pool | 478 | 0 |
| equip.set to set | 75 | 0 |
| skill.statuses to status | 294 | 0 |
| skill.summon to summon | 9 | 0 |
| status.mods to StatType | 307 | 1 |
| status.procs to status | 7 | 0 |
| passive.values to StatType | 209 | 0 |
| passive.trigger to skill / status | 56 | 0 |
| summon.stats to StatType, summon.skills to skill | 306 | 0 |
| card and gem stat to StatType | 478 | 0 |
| artifact / set stat to StatType | 263 | 0 |
| classTree prerequisite | 145 | 6 |
| recipe material | 550 | 0 |
| **total** | **9,610** | **6** |

Both dangling groups turn out to be real structure rather than missing data:

- The **6 class-tree prerequisites** are all Weaver's, and all six resolve in a
  DIFFERENT class's tree (`endure` needs Knight's `taunt`, `stomp` needs
  Warrior's `twin-cleave`, and so on). Weaver takes cross-class prerequisites,
  which is consistent with it being the one class outside the seven-parent
  structure. Nothing is missing; the check was too strict.
- The **1 unresolved stat** is `SetAtkSpd`, used by a status and absent from the
  220-key StatType catalog. The ASPD formula's own note names it (Launcher Boost
  replaces the computed attack speed outright), so the engine has it and the
  published catalog is one row short.

So the datasets are mutually complete. Nothing points at a record we do not
hold.

## What we have, by domain

| Domain | Held | Completeness |
|---|---|---|
| Combat formulas | 37, each naming its engine method and constants | essentially total for player math |
| Stat vocabulary | 220 StatType keys | 1 row short (`SetAtkSpd`) |
| Skills | 279, 52 fields each | total |
| Statuses | 185 | total |
| Passives | 111 | total |
| Summons | 29 with stat blocks and rotations | total |
| Class trees | 15 classes, 258 placed skills, grid layout, prerequisites | total for the 15 shipped; 14 more announced but not in the files |
| Equipment | 518, 513 carrying stat lines | total |
| Cards / gems / artifacts / sets | 269 / 129 / 34 / 24 | total |
| Substat pools | 9 pools plus the essence economy | total |
| Monsters | 319: element, race, level, exp, size, boss, skills, drops | **records total, stats NOT computable, see below** |
| Drops | 966-item reverse index, 316 of 319 monsters carry a table | total |
| Crafting | 474 recipes by result, 31 by material, 39 class crafts | total |
| Maps | 46 with level band, density, spawn pool, bosses | total as metadata, no geometry |
| Spawns | 295 groups plus global and per-map rules | total |
| NPCs | 43 zones, name / type / role only | names only, no dialogue |
| Cosmetics | 447 | its own note says Hidden and founder-exclusive entries are excluded |
| Experience | base curve, 161 entries to a cap of 150 | base only |
| Progression | attribute points and their cost curve, skill points per job level | total, from a second wiki |

## What is absent, ranked by how much it blocks

**1. Monster archetype definitions. This is the one that blocks work.**

A monster's attributes are published as MULTIPLIERS on an archetype:
`{arch: "Defender", str: 1.5, vit: 1.75, agi: 0.25, def: 5, mdef: 1, ms: 1, as: 2}`.
Twelve archetypes are referenced across the 319 monsters:

```
Archer  Brute  Caster  Critter  Defender  Egg
Flyer   Hybrid  Plant   Ravager  Runner    Undead
```

**None of the twelve is defined anywhere.** The `archetypes` table in
`mechanics.json` holds 31 entries and every one is a player class. Without the
base values a multiplier multiplies, not a single monster's actual Strength,
defence or attack speed can be computed. We have the shape of all 319 monsters
and the magnitude of none.

**2. The monster health rule.** The Max HP formula's own note says a monster
that is not a summon is handed to a different rule entirely, and that rule is
not published. Combined with (1), monster durability is fully unknown.

**3. `AttackSpeedRanks`.** The ASPD formula divides the weapon delay by
`AttackSpeedRanks[SpeedRank]`, notes that the player-effective value is 1.0, and
says monsters ride their archetype rank instead. The table's values are not
published. `ms` and `as` on a monster are ranks 0 to 5 with no meanings.

**4. The job experience curve.** Covered in
`spiritvale-engine-formulas.md`: unpublished, with a hypothesis and the evidence
for it recorded separately from any claim of fact.

## Unlabelled integers, the smaller gap

The same pattern as `targetType` before its labels were found: the values are
published, the meanings are not.

| Field | Values | Status |
|---|---|---|
| `skill.targetType` | 0 to 7 | **resolved** (Enemy, Ally, AllyNotSelf, Self, Any, Summon, SummonNotSelf, Grave) |
| `skill.castType` | 0 to 3 | **resolved** (None, Target, Ground, Toggle) |
| `skill.exclusiveType` | 0 to 5 | grouping derived from membership; the names are ours |
| `skill.events[].type` | -1, 1, 2, 3 | open |
| `status.category` | 0, 1 | open |
| `monster.size` | 0 to 3 | open (the reference has 3 sizes, this has 4) |
| `monster.combat.ms` / `.as` | 0 to 5 | open, blocked on `AttackSpeedRanks` |
| `map.biome` | 0 to 6 | open |
| `map.type` | 0 to 3 | open |
| `consumable.type` | 1, 2, 3 | open |

None of these blocks a decision; each costs one lookup when it matters. They are
listed so nobody fills one in by guessing.

## Never collected, on purpose or by nature

- **Art.** Sprites and prefabs are referenced by name; the files are the
  SpiritVale developers' assets. Ours are authored through the `image-to-glb`
  pipeline.
- **Map geometry.** `map-pins.json` gives portal coordinates as percentages and
  `worldmap.json` gives a 5x5 tile grid. There is no terrain, no collision, no
  spawn coordinates.
- **Dialogue, story and quests.** `npcs.json` carries a name, a type and a
  one-line role per NPC and nothing else. Monster `desc` exists as a field and
  is empty on all 319.
- **Refinement rates.** Not in this set. They were recorded separately earlier in
  this project and live in `docs/design/drops-and-crafting.md`.

## The honest answer to "what percentage"

Split it, because one number would mislead:

- **Player-facing combat math: effectively complete.** 37 formulas naming their
  engine methods, every cap, the full stat vocabulary, and both progression
  budgets. This is the half the project actually needs, since the rule is
  "numbers from Ragnarok, play from SpiritVale".
- **Content records: complete in count, complete in shape.** Every monster,
  item, card, gem, artifact, set, skill, status, passive, summon, map, recipe
  and drop table the wiki publishes, with no dangling reference between them.
- **Monster combat values: zero.** Not partial. The multipliers are useless
  without the twelve archetype base blocks, and those are not published
  anywhere.
- **World content (geometry, dialogue, quests, art): near zero,** and mostly by
  design rather than by omission.

For designing this game's systems that is enough and then some. For copying
SpiritVale's monster balance directly it is not, and no amount of re-fetching
this site will fix it: the archetype table would have to come from the client.

## Re-verifying this

The audit is a single pass over the raw files. Re-run it after any re-fetch:
walk every id-shaped field, resolve it against the set it names, and report the
dangling ones. A number other than 6 dangling means the upstream data moved, and
the six are enumerated above so a diff is meaningful.
