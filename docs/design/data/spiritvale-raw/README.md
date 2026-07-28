# SpiritVale's published data, complete

Every JSON file the community wiki at spiritvalers.com loads, fetched verbatim
in July 2026. The site describes them as "game data extracted from the game
client", so treat them as a careful community reading of a closed, still-
changing Early Access build rather than as source. Re-fetch rather than trusting
a stale copy: the URLs are `https://spiritvalers.com/<name>.json` and
`https://spiritvalers.com/wiki-data/<name>.json`.

Held here because the project rule is "numbers from Ragnarok, play from
SpiritVale" and the play half had no data behind it until now.

## What each file is

| File | Shape | Contents |
|---|---|---|
| `monsters.json` | list[319] | every monster: element, race, level, exp, size, boss flag, per-monster skill list with cast chances, a combat block, and its drop table |
| `equip-configs.json` | list[518] | every equipment piece: slot, level, element, set, card slots, class restriction, primary and secondary stat lines, substat pool |
| `gem-configs.json` | list[129] | gems: affix, stats, boss flag |
| `card-configs.json` | list[269] | cards: which equipment class they fit, affix, stats, unique flag |
| `artifact-configs.json` | list[34] | artifacts: full-set, per-piece and per-refine bonuses |
| `set-configs.json` | list[24] | equipment sets and their full-set bonuses |
| `substat-pools.json` | dict[9] | which substats each slot may roll |
| `skills-combat.json` | dict[9] | the big one, four databases in a wrapper: 279 `skills` (52 fields each), 185 `statuses`, 111 `passives`, 29 `summons` |
| `skills.json` | dict[279] | skill index |
| `spiritvale-all-classes.json` | dict[5] | 15 classes with their full skill trees, grid layouts and prerequisites (258 skills) |
| `maps.json` | list[46] | maps: biome, type, level band, density |
| `spawns.json` | dict[295] | what spawns where |
| `spawn-meta.json` | dict[3] | global, per-map and tower spawn rules |
| `drops.json` | dict[966] | reverse index: item to the monsters that drop it |
| `crafting.json` | dict[3] | 474 recipes by result, 31 by material, 39 class crafts |
| `materials.json` | list[49] | crafting materials with rarity and sell value |
| `consumables.json` | list[27] | 24 boss lures, 1 loot box, 2 mystery eggs. No healing items exist in this set |
| `npcs.json` | dict[43] | NPCs per map |
| `map-pins.json` | dict[44] | points of interest per map |
| `worldmap.json` | dict[6] | world grid and tiles |
| `dungeons.json` | dict[1] | dungeon definitions |
| `mechanics.json` | dict[15] | the authoritative one: 37 formulas with the engine method and constants behind each, 65 engine method names, the 10x10 element matrix, 31 archetypes, the weapon delay table, the caps, the 161-entry exp curve, the 220-key stat catalog, and the essence economy |
| `class-roadmap.json` | dict[9] | the developers' announced class plans |
| `cosmetics.json` | list[447] | the premium-currency cosmetic catalogue: 14 slots including Pet, Mount, Emote and Stall, with tier and price |
| `game-info.json` | dict[2] | which client build the whole set was read from |
| `wiki-strings-en.json` | dict[1024] | the wiki's own English UI strings. Not decoration: the `mech.*` (73) and `sim.*` (290) keys carry rule statements the JSON does not, including how an advanced class inherits its parent and redistributes attributes, what makes Weaver freeform, and the separate base and advanced skill-point pools |
| `data-changelog.json` | list[11] | the generator's own diff log between game builds: which records were added, removed or changed, with old and new values. Design history for free |

## The record shapes worth knowing before you read

A monster:

```json
{ "id": "Abomination", "element": "Undead", "race": "Undead", "level": 60,
  "exp": 8700, "size": 3, "boss": false, "hostile": true, "essence": 0.1,
  "skills": [ { "id": "NPC_Berserk", "level": 1, "chance": 0.5 } ],
  "combat": { "arch": "Defender", "str": 1.5, "vit": 1.75, "agi": 0.25,
              "dex": 1, "int": 0.5, "luk": 1, "def": 5, "mdef": 1,
              "ms": 1, "as": 2, "ranged": false },
  "drops": { "equip": [ { "id": "BerserkFeet", "chance": 4 } ] } }
```

Two things follow from that shape. A monster's attributes are GROWTH RATES
multiplied by level (`str: 1.5` on a level-60 monster is Strength 90), not
absolute numbers; `arch` is a display label and carries no numbers. And a
monster carries a real skill list with per-skill cast chances, which is why the
skill database includes NPC-only skills. The full derivation and the computed
values for all 319 are in `../../spiritvale-engine-formulas.md` and
`../spiritvale-monster-stats.tsv`.

A piece of equipment:

```json
{ "id": "Amber Bow", "slot": "Accessory", "lvl": 0, "element": "Neutral",
  "set": "", "cardSlots": 1, "arch": [],
  "primary":   [ { "stat": "Def", "base": 1, "per": 1, "q": "" } ],
  "secondary": [ { "stat": "AllStats", "base": 1, "per": 0, "q": "" } ],
  "substatPool": "Accessory" }
```

`primary` and `secondary` are lists of `{stat, base, per}` where `per` scales
with refine, and every `stat` is a key from the StatType catalog
(`../spiritvale-stat-catalog.tsv`). `substatPool` names which pool an essence
re-roll draws from.

## What is deliberately NOT here

The game's art. Sprites are referenced by name (`"sprite": "HairAcc_2"`) and the
image files are the SpiritVale developers' copyrighted assets, not published
data. Models, icons and textures for this game are authored here (see the
`image-to-glb` skill and `docs/image-to-glb-asset-workflow.md`).

One file arrived carrying art anyway: `gem-configs.json` shipped a base64 WebP
icon inline on all 129 gems, about 310 KB of the file. Those `icon` fields were
stripped on the way in, which is why the file here is 30 KB and why a re-fetch
will not match byte for byte. Nothing else in the set embeds an image.

## Reading it

- `../../spiritvale-data-schema.md` explains every record shape and which fields
  carry design weight. Read it before the numbers.
- `../../spiritvale-engine-formulas.md` transcribes all 37 formulas from
  `mechanics.json` with the engine method behind each, and compares them to the
  reference implementation.

The human-readable extracts alongside this directory came from the same source
and are quicker to scan while designing:

- `../spiritvale-skills.tsv` (226 skills, one row each)
- `../spiritvale-stat-catalog.tsv` (219 stats)
- `../spiritvale-status-effects.tsv` (156 statuses)
- `../spiritvale-base-exp.tsv` (150 levels)
- `../spiritvale-monster-stats.tsv` (319 monsters, computed not transcribed)

Where an extract and a raw file disagree, the raw file wins: the extracts were
transcribed from the rendered site, the JSON is what the site loads.
