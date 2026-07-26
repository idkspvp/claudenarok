# SpiritVale: the road from here to a Ragnarok-shaped game

Where the conversion stands, what is left, and in what order. Companion to
`ro-classic-conversion.md` (stats and progression) and
`ro-weapons-maps-monsters.md` (the three content pillars).

Sizes below are honest: **S** is a day or less, **M** is a few days, **L** is a
week or more, **XL** is content work measured in weeks and bounded by how fast
things can be written rather than built.

---

## Done

| | |
|---|---|
| Six Ragnarok attributes replacing five | STR/AGI/VIT/INT/DEX/LUK, all derivations |
| Status points | 1,225 + 48 at creation, `floor(stat/10)+2` cost curve, two 99s exactly one point short |
| Level cap 99 and the EXP curve | fitted to Ragnarok's pacing, our own numbers |
| Attribute derivations | ATK with its squared term, MATK, MaxHP/MaxSP as multipliers, crit from LUK, defence from VIT |
| The allocation UI | place points, reset, the sheet shows all six |
| Element, race, size + the chart | the foundation the rest sits on |
| Weapon class + the size table | why a player carries more than one weapon |
| Refine ladder | value per weapon level, safe limit, over-refine bonus |
| Quest system removed | and the public wiki stopped advertising it |

---

## The blocker in front of everything

**Phase A: naming.** Almost nothing below can start without it, and it is not
engineering work.

| # | Step | Size | Blocks |
|---|---|---|---|
| A1 | 18 job names (Novice, 6 first, 12 second) | S | the job tree, every ability re-home |
| A2 | Monster names | M | monster records, cards, drop tables |
| A3 | Weapon and armour names | M | weapon records, the gear rebalance |
| A4 | Card names and effects | M | the whole card system |
| A5 | Map and zone names | S | the map graph |

Every name goes through `tests/ip_scrub.test.ts` and is recorded in
`ip-refactor/NAME-MAP.md`. The scanner has already rejected one proposed name as
verbatim WoW, so this is a real gate and not a formality.

**This is the critical path.** Naming is the only thing on it that cannot be
parallelised or automated, and four of the five phases below wait on it.

---

## Phase B: content on the new foundation

| # | Step | Size | Needs |
|---|---|---|---|
| B1 | Monster records: fixed stat blocks, race, element+level, size | XL | A2 |
| B2 | Weapon records: class, weapon level, element | L | A3 |
| B3 | Gear rebalance: retire the per-slot budget ladder, curate stat lines onto a minority of items | L | A3 |
| B4 | Cards: card items, sockets, the insert action, race/element/size effects | L | A4, B1 |
| B5 | Drop tables: per-mille rates, card slot, MVP pools | M | B1 |

B3 is specced with measurements in `ro-classic-conversion.md`; it is not a
constant to tune, it is the ladder to retire.

## Phase C: the combat model

| # | Step | Size | Needs |
|---|---|---|---|
| C1 | HIT against FLEE, replacing the flat dodge fraction | M | - |
| C2 | The real damage formula: weapon ATK + status ATK against DEF, retiring `STATUS_AP_PER_DPS` | L | C1 |
| C3 | Hard DEF (percentage, from equipment) and soft DEF (flat, from VIT) as separate terms | M | C2 |
| C4 | ASPD from weapon class + AGI + DEX, replacing the authored per-weapon speed | M | B2 |
| C5 | Magic: pre-renewal magic cannot crit, and MATK works differently from ATK | M | C2 |

C1 and C2 are the two that most change how the game feels, and neither needs a
single name. **They are the best thing to work on while naming is in flight.**

## Phase D: progression

| # | Step | Size | Needs |
|---|---|---|---|
| D1 | The job tree: Novice, 6 first jobs, 12 second jobs, with the JL gates | L | A1 |
| D2 | Re-home 317 abilities onto that tree | XL | D1 |
| D3 | Job EXP as a second pool, and job levels | M | D1 |
| D4 | Skill points separate from status points | M | D3 |

## Phase E: the world

| # | Step | Size | Needs |
|---|---|---|---|
| E1 | `MapDef` and warp portals, on the coordinate-district seam dungeons already use | M | - |
| E2 | Minimap and world map show one map at a time | M | E1 |
| E3 | New maps, authored as ours | XL | A5, E1 |
| E4 | Per-map spawn tables with respawn timers | M | E1, B1 |
| E5 | Save points and the Ragnarok death model, replacing the graveyard run | M | E1 |
| E6 | **Content for levels 21 to 99** | XL | everything above |

E1 is small and unblocked: the engine already runs a map graph as coordinate
districts (`instanceOrigin`), terrain is a pure function so a bigger world costs
nothing, and interest management is radius-based so maps isolate for free. **E1
is the other good thing to do while naming is in flight.**

## Phase F: Ragnarok systems with no equivalent yet

| # | Step | Size |
|---|---|---|
| F1 | Cart and merchant vending | M |
| F2 | Storage (the bank exists and can be adapted) | S |
| F3 | Homunculus (pets exist and can be adapted) | M |
| F4 | WoE and castles, if wanted | XL |

---

## The short answer

**About 25 steps.** Six are S or M and unblocked today; the rest wait on naming
or on each other. The three XL items (B1 monster records, D2 ability re-home,
E6 content for 21-99) are the real length of the project, and **E6 is the single
largest piece in the whole conversion**: three zones, six dungeons, and 119
monsters were all built for a cap of 20. Everything else makes the existing
content Ragnarok-shaped; only E6 makes there be more of it.

**Start now, without waiting for a single name:** C1, C2, E1, E2, F2.
