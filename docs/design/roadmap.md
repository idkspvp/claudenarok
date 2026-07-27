# Claudenarok Online: the road from here to a Ragnarok-shaped game

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
| **C1 HIT against FLEE** | `level + DEX + LUK/3` vs `level + AGI + LUK/5`, `80 + HIT - FLEE`, perfect dodge separate |
| **C3 Hard DEF and soft DEF** | capped percentage from equipment, then the flat Vitality subtraction, in that order, floored at 1 |
| **C2 The real damage formula** | weapon roll with its Dexterity floor plus status ATK, size on the weapon share only, `STATUS_AP_PER_DPS` retired |
| **The critical strike, whole** | no multiplier, cannot miss, ignores defence, denied by the target's Luck, magic and heals cannot crit at all |
| **A1 The job tree** | Novice, six first jobs, twelve second jobs, read off `e_mapid`; Super Novice cut by decision |
| Weapon class + the size table | why a player carries more than one weapon |
| Refine ladder | value per weapon level, safe limit, over-refine bonus |
| Quest system removed | and the public wiki stopped advertising it |

---

## The blocker in front of everything

**A1 is done**, which clears the item that used to block the most. What now
blocks the most is not naming at all: it is the **talent and spec system**. All
nine classes carry three specs, twenty-seven in total, plus masteries and
`spec_baselines`, and Ragnarok has no equivalent concept. Every class-shaped
step below has to route around it until it is gone, so it goes first.

**Phase A: naming.** The rest of it still gates Phase B, and it is not
engineering work.

| # | Step | Size | Blocks |
|---|---|---|---|
| A1 | ~~18 job names~~ **DONE** (`src/sim/content/jobs.ts`) | S | - |
| A2 | Monster names | M | monster records, cards, drop tables |
| A3 | Weapon and armour names | M | weapon records, the gear rebalance |
| A4 | Card names and effects | M | the whole card system |
| A5 | Map and zone names | S | the map graph |

Every name goes through `tests/ip_scrub.test.ts` and is recorded in
`ip-refactor/NAME-MAP.md`. The scanner has already rejected one proposed name as
verbatim WoW, so this is a real gate and not a formality.

**Naming is still the critical path for CONTENT** (Phases B and E), and it is
the only thing on it that cannot be parallelised or automated. It is no longer
the critical path for the CLASS work, which is now the talent teardown above.

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
| C1 | ~~HIT against FLEE~~ **DONE** | M | - |
| C2 | ~~The real damage formula~~ **DONE** | L | C1 |
| C3 | ~~Hard DEF and soft DEF as separate terms~~ **DONE** | M | C2 |
| C4 | ASPD from weapon class + AGI + DEX, replacing the authored per-weapon speed | M | B2 |
| C5a | ~~Magic cannot crit~~ **DONE** (heals too) | M | C2 |
| C5b | MATK against MDEF, which works differently from ATK against DEF | M | C2 |
| C6 | Retire `MOB_AP_PER_DPS`, the last calibration constant, when monster records carry an authored ATK pair | S | B1 |
| C7 | Restore the three heroic difficulty floors, which fell about 1.3% short when armour stopped losing value against a higher-level attacker | S | B1 |

C1 and C2 are the two that most change how the game feels, and neither needs a
single name. **They are the best thing to work on while naming is in flight.**

## Phase D: progression

| # | Step | Size | Needs |
|---|---|---|---|
| D0 | **Retire the talent and spec system**: 27 specs, masteries, `spec_baselines`. Ragnarok has no equivalent, and every step below routes around it until it is gone | L | - |
| D1 | Collapse the nine classes onto the **six first jobs**. `PlayerClass` is referenced in 93 files with 169 hardcoded class literals, so this is the wide one | L | D0 |
| D2 | Character creation picks a first job. Novice is CUT as a playable state; the picker and both server validation lists derive from `JOBS` instead of the three hardcoded HTML copies | M | D1 |
| D3 | Job advancement as a FIELD, not a new class: a first job plus an optional 2-1/2-2 that unlocks skills. Keeps every `Record<PlayerClass, X>` table at six entries | M | D1 |
| D4 | Re-home the 279 abilities onto the job tree | XL | D1 |
| D5 | Job EXP as a second pool, and job levels | M | D3 |
| D6 | Skill points separate from status points | M | D5 |
| D7 | Warlock, Druid, and Shaman as a seventh first job with two branches. Deliberately AFTER the eighteen, because nothing depends on it | L | D4 |

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

**Start now, without waiting for a single name:** D0 (the talent teardown),
then D1 to D3. E1, E2, and F2 are still unblocked and can run beside them.
