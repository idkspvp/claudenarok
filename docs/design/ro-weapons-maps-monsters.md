# Converting weapons, maps, and monsters to Ragnarok

Companion to `ro-classic-conversion.md`, which covers stats and progression. This
one surveys the three content pillars against pre-renewal Ragnarok and says what
each needs. Written after reading the live tables, not from memory: every "today"
line below is the actual shape in `src/sim/`.

Same sourcing rule as the stat work: rAthena and Hercules are GPL-3.0 including
their `db/`, and this game is MIT and commercial. Read them to avoid getting a
formula wrong; never copy code, a `db/*.yml`, or Gravity's authored records
(monster names, item names, their specific numbers). Mechanics are fair to
reimplement; datasets are not.

---

## The finding that shapes everything else

All three pillars are missing the *same three fields*, and almost every Ragnarok
combat behaviour is a function of them:

| | Ragnarok | Today |
|---|---|---|
| Element (10 kinds x 4 levels) | on every monster, weapon, and attack | absent. `school` exists as a damage LABEL (`fire`/`frost`/...) with no resistance table behind it |
| Race (10) | on every monster; cards key off it | absent. `MobFamily` has 12 fantasy families (`mudfin`, `ogre`, `dragonkin`) that nothing reads for damage |
| Size (3) | on every monster; weapon type keys off it | absent entirely |

Ragnarok's damage line is
`(status ATK + weapon ATK) x sizeMod x elementMod x raceMod - DEF`.
Three of those five terms do not exist here. **Element, race, and size are the
foundation, and weapons, maps, and monsters all sit on top of them.** Doing them
first makes the other three pillars mostly data work; doing them last means
touching every pillar twice.

---

## 1. Weapons

**Today.** `WeaponInfo` is `{ min, max, speed, dagger? }`. That is the whole
model: a damage roll, a swing timer, and one boolean so Backstab can check for a
dagger. 119 weapons across the tables.

**Ragnarok.** A weapon carries:

- **Weapon type** (Dagger, 1H/2H Sword, 1H/2H Spear, 1H/2H Axe, Mace, Rod, Bow,
  Katar, Book, Knuckle, Instrument, Whip). Type drives which jobs can use it, its
  ASPD, and its size table.
- **Size modifier table.** The mechanic with no equivalent here at all: each
  weapon type deals a different percentage against Small, Medium, and Large
  targets. A dagger is brutal on Small and feeble on Large; a spear is the
  reverse. This is why Ragnarok players carry several weapons, and it is the
  single biggest reason its combat feels unlike a WoW-like.
- **Weapon level 1-4.** Not item level: it sets the ATK gained per refine and the
  safe refine limit.
- **Refine +0 to +10**, with ATK per refine scaling off weapon level, and an
  over-refine bonus past the safe limit.
- **Card slots, 0 to 4.** Weapon cards give race, element, and size multipliers.
- **Weapon element**, Neutral by default, changeable by converters and endows.

**What to build**

1. `weaponType` on `WeaponInfo`, plus the size-modifier table as a pure leaf
   module. Cheap, and it is the highest-value single change on this list: it is
   inert until monsters carry a size, which is why size comes first.
2. `weaponLevel` (1-4) and a `refine` field on the item INSTANCE, not the def
   (`ItemInstancePayload` already exists and already carries `rolled`/`boundTo`,
   so refine has a home). Refine ATK is a pure function of (weaponLevel, refine).
3. Card slots. This is the big one and it is really an ITEM-SYSTEM change, not a
   weapon change: sockets, card items, and the insert action. Defer until element
   and race exist, because a card with nothing to modify is not a card.
4. ASPD per weapon type per job. Today `speed` is authored per weapon and
   `attackSpeed` per mob; Ragnarok derives it from type + AGI + DEX.

**Not needed:** weapon damage min/max already exists and maps onto ATK cleanly.

---

## 2. Maps

**Today.** One continuous 360x360 heightfield. "Zones" are z-slices of it
(`ZoneDef.zMin`/`zMax`), three of them, and dungeons are placed at coordinate
offsets in the SAME space (`instanceOrigin`). A player walks from zone 1 to zone 3
without a loading boundary. Monsters are placed by 67 `CampDef` records: a mob id,
a centre, a radius, and a count.

**Ragnarok.** A graph of discrete maps joined by warp portals. Each map is its own
coordinate space with its own spawn list and respawn timers. Towns, fields, and
dungeon floors are all maps; a dungeon is several maps stacked by portal, not one
room. Save points and Kafra warps are how you move between them.

**This is the deepest structural difference in the whole conversion.** The
continuous world is load-bearing: terrain generation, the minimap, pathfinding,
interest management (the server's ~120yd snapshot scoping), and the renderer all
assume one coordinate space.

**Two honest options**

- **(A) Keep the continuous world, adopt Ragnarok's spawn model.** Camps become
  per-area spawn tables with respawn delays, mob density and level bands get
  re-cut to Ragnarok's field pacing, and portals are added only for dungeon
  floors (which are already instanced, so the seam exists). Field maps stay
  seamless. This is a content and tuning pass, not an engine rewrite.
- **(B) Rebuild as a map graph.** Every map its own space, portals everywhere,
  per-map spawn tables. Faithful, and it touches terrain, collision, pathfinding,
  the minimap, interest management, save/load, and the renderer.

**Recommendation: (A).** The continuous world is not what makes Ragnarok feel like
Ragnarok; the combat triangle and the status-point build are. (B) is months and
buys atmosphere rather than mechanics. Revisit only if the map graph turns out to
matter for something concrete (Kafra economy, WoE castle maps).

**What to build under (A)**

1. Extend `CampDef` with `respawnSeconds` and a per-camp level, so density and
   pacing are authored rather than derived.
2. Re-cut the three zones' level bands to fill 1-99 instead of 1-20 (see the
   content gap below).
3. Save points: Ragnarok's death rule returns you to a saved map, not a graveyard
   run. The graveyard/ghost system is a WoW import and should be revisited with
   the death model.

---

## 3. Monsters

**Today.** 119 templates. Each has a level range, `hpBase`/`hpPerLevel`,
`dmgBase`/`dmgPerLevel`, `armorPerLevel`, `attackSpeed`, `moveSpeed`,
`aggroRadius`, a loot list, and a `family` from a 12-value fantasy set. Flags for
`boss`/`elite`/`rare`/`worldBoss`. Level-scaled, not fixed: a mob rolls a level
inside its band and derives its stats from it.

**Ragnarok.** A monster is a fixed record, not a curve:

- Fixed **Level, HP, SP, ATK1/ATK2** (min/max), **DEF, MDEF**, and its own
  **STR/AGI/VIT/INT/DEX/LUK**, plus ASPD.
- **Race, Element+level, Size** (the three missing fields above).
- **Base EXP and Job EXP as two separate rewards.** We have one XP pool; Ragnarok
  characters level a Base and a Job level independently off the same kill. This
  interacts with the job tree in the other plan and should land with it.
- **Drop list** with per-mille rates and a card slot.
- **AI mode flags**: aggressive vs passive, looter, assist (calls neighbours),
  change-target, and the boss flag that grants immunity to several statuses.
- **MVP** monsters with their own EXP and drop pool on top of the normal one.

**What to build**

1. **Race, element, size on `MobTemplate`**, and the element chart behind them.
   The chart is the payoff: Fire vs Earth, Water vs Fire, Holy vs Undead, and the
   four element LEVELS that change the multipliers. This is a pure leaf module and
   a few hundred lines of table, and it makes every existing monster meaningfully
   different from every other.
2. **Fixed stat blocks instead of level curves.** A Ragnarok monster is authored,
   not generated. This is the biggest single content pass: 119 templates, each
   getting real numbers. It also removes `minLevel`/`maxLevel` banding, which the
   camps currently rely on.
3. **Job EXP** as a second reward and a second pool. Lands with the job tree.
4. **AI modes.** `assist` and `looter` in particular change how a field feels;
   both are small additions to the existing mob AI modules.
5. Retire `MobFamily` once race replaces it, or keep it as flavour with nothing
   mechanical hanging off it. Do not let both exist as rules.

---

## Ordering

The dependency chain is strict at the top and loose after:

1. **Element, race, size + the element chart.** Everything else keys off these.
   Pure leaf modules, no content churn yet: add the fields, default them, ship the
   chart with tests.
2. **Weapon type + the size table.** Small once size exists; immediately changes
   how combat plays.
3. **Monster stat blocks.** The long content pass. Do it after 1 so each monster
   is authored once, with its race and element, rather than twice.
4. **Refine.** Self-contained; needs weapon level from step 2.
5. **Cards + slots.** Needs 1 to have anything to modify and 3 to have anything to
   drop from.
6. **Job EXP, and the map/spawn pass**, both of which belong with their own larger
   pieces (the job tree, and the level 21-99 content).

## The gap none of this closes

**Levels 21-99 have nothing in them.** Three zones, six dungeons, two delves, 119
monsters, all of it built for a cap of 20. Every plan above makes the existing
content more Ragnarok-shaped; none of it makes there be more content. That remains
the largest single piece of work in the conversion, and the one that cannot be
shortcut by a formula.
