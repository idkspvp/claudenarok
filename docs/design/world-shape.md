# How big the world is, and what shape its content takes

The decision that sizes Phases B and E: **how many areas, how many monsters,
how wide a level band each area covers, and what a monster record carries.**
Everything here is a target for `A2` (monster names), `B1` (monster records),
`E3` (new maps) and `E4` (spawn tables); none of it is implemented yet.

Companion to `roadmap.md` (the ordering), `ro-weapons-maps-monsters.md` (why the
world stayed continuous) and `ro-reference-source.md` (the formulas).

## The decision

**Take the SCALE and the LAYOUT from SpiritVale. Take the STAT MODEL from
Ragnarok.** The two are compatible rather than opposed, which was not obvious at
first and is the reason this document exists.

SpiritVale is a shipped commercial MMO (Steam app 3767850, Baikun Interactive,
early access from 2026-07-15) built on the same lineage this project came from.
It is worth measuring against precisely because it already solved the question
"how much content does a small team actually need", and because it turns out to
be a Ragnarok-shaped design itself: **its attribute set is Ragnarok's ten,
element for element, and identical to the `ELEMENTS` array this project already
carries in `src/sim/combat/elements.ts`.**

So the choice is not between two philosophies. It is Ragnarok's mechanics at a
buildable size.

## What was measured

Three worlds in the same terms. The Ragnarok column was computed from the
reference checkout (`db/pre-re/mob_db.yml` plus the spawn scripts under
`npc/pre-re/mobs/`); ours from `src/sim/content/`; SpiritVale's from the sources
at the bottom.

| | Ragnarok pre-renewal | SpiritVale | This project, at time of writing |
|---|---|---|---|
| areas carrying spawns | 316 (166 field, 150 dungeon) | 48 | 3 zones, 28 landmarks |
| monsters | 1,004 | 330 | 60 |
| level cap | 99 | ~150 | 99 |
| level spread within one area | median 30 | about 13 | 7 to 8 per zone |
| attributes | 10 | 10, the same 10 | 10, the same 10 |

Two findings from the Ragnarok data are worth keeping even though the scale is
not:

- **An area has no level of its own.** Monsters have levels; an area is a mix.
  The median Ragnarok map spans 30 levels and the widest spans 98. Bands overlap
  heavily, which is what gives a player at any level several places to go rather
  than one.
- **Fields carry the early game and dungeons carry the late one.** Above level
  70 there are ZERO field maps in pre-renewal; the crossover sits around 50.

## Targets

SpiritVale runs to roughly level 150 and this project is fixed at 99, so its
counts compress by about a third.

| | Target | Today |
|---|---|---|
| areas covering 1 to 99 | **32 to 35** | 3 zones |
| monsters | **about 220** | 60 |
| level spread per area | **about 13, overlapping** | 7 to 8, contiguous |
| areas serving any 10-level window | **2 to 3** | 1 |
| boss sub-area per area | yes | dungeons only |
| areas carry the whole 1 to 99 grind | yes | n/a |
| dungeons | about 5, at roughly 25/45/65/85/100 | 3 plus one raid |

The overlap is the part that is easy to drop and expensive to add back. Three
areas whose bands are 1-13, 14-26 and 27-39 is a corridor; three whose bands are
1-13, 8-21 and 16-29 is a choice. Author the second.

Note where this DIVERGES from Ragnarok, deliberately. Ragnarok hands the late
game to dungeons: above level 70 it has no field maps at all. Here the areas
carry the grind the whole way to 99 and dungeons are occasional milestones
instead of the endgame. That is an owner decision, not an oversight, and it is
why the field/dungeon split measured above is recorded but not adopted.

## Islands on one coordinate space

Areas are ISLANDS in a single coordinate space, spaced further apart than the
interest radius and joined only by teleports. Not a graph of separate coordinate
spaces, and not the contiguous strip the three zones form today.

This is the cheap way to get the thing that actually matters, which is **hard
theme boundaries**. The heightfield blends biomes at a boundary on purpose
(`src/sim/world.ts`, the `BIOME_SHAPE` blend), so on a contiguous world a desert
cannot sit beside a snowfield without a graded transition between them. Islands
have no shared boundary to blend, so each one can commit to its biome. Meanwhile
terrain, water, decorations, collision and the rim wall all keep working on the
one coordinate space they already assume, which is what a true map graph would
have forced a rewrite of.

Three record types, all of them pure data plus a teleport:

| | What it is |
|---|---|
| `AreaDef` | name, bounds, level band, biome, spawn table. Generalizes `ZoneDef`, which is the same idea restricted to a z-slice of one strip |
| `WarpDef` | area + point + radius, to area + point. The edge portals that make the progression walkable, one island to the next |
| `WaypointDef` | a warp stone inside an area, usable only once touched. The fast-travel network, so returning to town is not a walk back through ten islands |

The two teleport kinds answer different problems and both are needed: portals
are the world's STRUCTURE, waypoints are convenience. Ragnarok separates them the
same way (map-edge portals against the Kafra service).

Spacing islands beyond the interest radius (about 120 yards) means a player never
sees the neighbouring island across the gap, so each reads as its own place
despite sharing a coordinate space with everything else.

**One thing this does NOT get for free: tick cost.** The server's per-entity loop
is linear in total world population, measured at roughly 2.6ms per tick at 457
entities and 48ms at 6,457, against a 50ms budget at 20 Hz. Thirty populated
islands land in the thousands, so areas with no player near them have to stop
ticking their monsters. A true map graph would get that as a side effect of
having separate spaces; here it is explicit work, and it is required rather than
optional.

## The monster record

Ragnarok's model, and it is not optional: the combat conversion already assumes
it. `combat/defence.ts` reads a defender's real Vitality, `combat/crit.ts` reads
the target's Luck, and `combat/hit_flee.ts` reads level plus Dexterity and
Agility. The current per-level scaling model cannot feed any of them.

What a record has to carry, replacing `MobTemplate`'s `hpBase`/`hpPerLevel`,
`dmgBase`/`dmgPerLevel` and `armorPerLevel` pairs:

- a **fixed** stat block: HP, SP, an authored ATK min/max pair, DEF, MDEF, and
  the six attributes, none of them derived from the player's level
- **race, element plus attribute level, and size**, the three classifications the
  card system and the size table key off

Two measurements say how far that is from here. Every monster currently gets
`Math.floor(level / 3)` in Agility, Dexterity, Vitality and Luck as a
placeholder, with a comment at the site saying exactly that. And **not one of the
existing monsters has an authored race, element or size**, so the element chart,
the size table and the whole card system currently have nothing to act on. B1 is
the largest single piece of work in the conversion and this is why.

## Order of work

The existing monsters are the reason this can start now. All of them already
carry names cleared through the `NAME-MAP.md` campaign, and all of them are drawn
from **twelve** shared visual builds (`MobFamily` against
`src/render/characters/manifest.ts`), separated only by the `scale` and `color`
hints on the record. So a new monster is a data row on an existing build, not an
art task, and redistributing the ones already here needs no new name at all.

**That takes A2 off the critical path**, which is the opposite of what the
roadmap currently assumes.

| Phase | Work | Blocked by |
|---|---|---|
| 1 | Restat the existing monsters onto fixed blocks with race, element and size, and spread them across 1 to 99 | nothing |
| 2 | `AreaDef` islands, the two teleport kinds, and the idle-area tick skip | nothing |
| 3 | Grow the roster on the twelve builds, author the remaining dungeons, name what is new (A2) | 1 and 2 |

Phase 1 alone makes the game playable to 99, which it is not today: every
monster in the tree sits at level 20 or below.

Phase 1 is also what unblocks `C6` (retiring `MOB_AP_PER_DPS`, which exists only
because monster attack power is on the pre-conversion scale) and `C7` (the three
heroic difficulty floors).

## What this does not decide

- **Names for anything NEW.** A2 and A5 still own every new monster and place
  name, and each goes through `tests/ip_scrub.test.ts` and
  `ip-refactor/NAME-MAP.md`. Nothing here proposes a name, and SpiritVale's names
  are its own.
- **How many monsters an island holds.** A fixed stat block gives a monster one
  level, so the existing roster spreads to roughly one monster per one and a half
  levels: enough for about a dozen islands, not thirty. Phase 3 sizes that.
- **Balance numbers.** Per-monster values land with B1, against the formulas in
  `ro-reference-source.md`.
- **The single coordinate space stays.** The recommendation in
  `ro-weapons-maps-monsters.md` (option A over a rebuilt map graph) is unchanged;
  islands are how its cost is paid while still getting discrete-feeling places.

## Sources, and one that was wrong

The Ragnarok figures are reproducible from the reference checkout. The SpiritVale
figures come from the Steam page and community databases, and those disagree with
each other, so which was trusted matters:

- [Steam store page](https://store.steampowered.com/app/3767850/SpiritVale/):
  class list, biome count, "35+ maps". Its monster count of "230+" is LOWER than
  the community database's 330 and is probably stale.
- [Spiritvale DB monster database](https://www.spiritvaledb.com/database/monsters):
  330 monsters and the ten attributes. The most credible of the three.
- [spiritvalewiki.com maps](https://spiritvalewiki.com/maps/): the 48-zone list.

**Do not trust the per-map level bands on the wiki index.** It lists tight
five-level bands ("Sunny Meadows 1, Lv 1-5"), which appear to be an entry or
recommended level rather than the spawn spread. The actual spawns on Sunny
Meadows run level 7 to 20 across three different attributes, and Festering Woods
runs 22 to 35. Reading the index literally produced a wrong conclusion once
already (that SpiritVale is a narrow linear corridor and therefore a bad model to
copy); it is not, and the error is recorded here so it is not repeated.

A separate wiki, `spiritvale-wiki.wiki`, gives generically named zones with round
level bands that match nothing in the game data. Treat it as unreliable.
