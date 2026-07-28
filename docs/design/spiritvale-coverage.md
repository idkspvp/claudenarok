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
| Monsters | 319 records, plus computed health, attributes, defence, hit and flee for every one | total except attack power |
| Drops | 966-item reverse index, 316 of 319 monsters carry a table | total |
| Crafting | 474 recipes by result, 31 by material, 39 class crafts | total |
| Maps | 46 with level band, density, spawn pool, bosses | total as metadata, no geometry |
| Spawns | 295 groups plus global and per-map rules | total |
| NPCs | 43 zones, name / type / role only | names only, no dialogue |
| Cosmetics | 447 | its own note says Hidden and founder-exclusive entries are excluded |
| Experience | base curve, 161 entries to a cap of 150 | base only |
| Progression | attribute points and their cost curve, skill points per job level | total, from a second wiki |

## Correction: monster stats are NOT missing

The first version of this audit called unpublished monster archetype definitions
the biggest gap in the dataset, on the reasoning that a monster's attributes are
multipliers on an archetype and none of the twelve archetypes is defined
anywhere.

**That was wrong.** The archetype name is a display label. The multipliers apply
straight to level, so there is no base table to be missing. The wiki's own page
source computes and shows every monster's health, defence, accuracy and evasion
from a `monStats()` function, and prints a prose tooltip beside the numbers that
states the same rule independently.

Every monster's combat values are therefore derivable, and
`data/spiritvale-monster-stats.tsv` now holds all 319 of them (health, six
attributes, soft and flat defence and magic defence, hit, flee, plus experience
and coin including the 50x boss payout). The derivation is in
`spiritvale-engine-formulas.md`.

What this cost: two claims in the previous commit, both retracted. Monster
combat coverage went from "zero" to "complete except attack power".

## What is absent, ranked by how much it blocks

**1. Monster ATK.** The one real hole left in the monster picture. The site's
own tooltip says attack scales with weapon and rank, and the site displays no
attack value, so it did not work that part out either. Everything else about a
monster computes.

**2. `AttackSpeedRanks`.** The ASPD formula divides the weapon delay by
`AttackSpeedRanks[SpeedRank]`, notes the player-effective value is 1.0, and says
monsters ride their archetype rank instead. The table's values are not
published, so a monster's `ms` and `as` stay ranks out of 5 with no seconds
attached. Same root cause as (1).

**3. The job experience curve.** Covered in
`spiritvale-engine-formulas.md`: unpublished, with a hypothesis and the evidence
for it recorded separately from any claim of fact.

**4. `SetAtkSpd`.** One stat the engine has and the published catalog does not.

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
| `map.biome` | 0 to 6 | six of seven read cleanly from map names, value 1 unresolved (see `spiritvale-world-and-economy.md`) |
| `map.type` | 0 to 3 | **resolved by content**: 0 field, 1 town, 2 arena, 3 tower |
| `consumable.type` | 1, 2, 3 | **resolved by content**: 1 boss lure, 2 loot box, 3 mystery egg |

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
- **Monster combat values: complete except attack power.** Health, the six
  attributes, soft and flat defence and magic defence, hit and flee for all 319,
  computed from a rule the wiki publishes twice (as code and as prose).
- **World content (geometry, dialogue, quests, art): near zero,** and mostly by
  design rather than by omission.

That is enough to design this game's systems on, and enough to copy SpiritVale's
monster balance if we want it. The one thing that would still have to come from
the client is monster attack power, and its companion the `AttackSpeedRanks`
table.

Two cautions on using the monster numbers. They are the community's
reverse-engineering, not a decompile we ran, so they inherit whatever that got
wrong. And `roundSig2` means every published health value is rounded to two
significant figures: 15,000 is a display value, not necessarily the engine's.

## Re-verifying this

The audit is a single pass over the raw files. Re-run it after any re-fetch:
walk every id-shaped field, resolve it against the set it names, and report the
dangling ones. A number other than 6 dangling means the upstream data moved, and
the six are enumerated above so a diff is meaningful.
