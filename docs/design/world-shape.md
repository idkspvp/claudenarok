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
| fields dominate | 1 to 50 | n/a |
| dungeons dominate | 50 to 99 | n/a |

The overlap is the part that is easy to drop and expensive to add back. Three
areas whose bands are 1-13, 14-26 and 27-39 is a corridor; three whose bands are
1-13, 8-21 and 16-29 is a choice. Author the second.

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

## What this does not decide

- **Names.** A2 and A5 still own every monster and place name, and each goes
  through `tests/ip_scrub.test.ts` and `ip-refactor/NAME-MAP.md`. Nothing here
  proposes a name, and SpiritVale's names are its own.
- **The world stays continuous.** The recommendation in
  `ro-weapons-maps-monsters.md` (option A) is unchanged: areas are regions of one
  heightfield plus the existing far-off instance origins, not a graph of separate
  coordinate spaces. "32 to 35 areas" means named regions with their own spawn
  tables, not 35 loading screens.
- **Balance numbers.** Per-monster values land with B1, against the formulas in
  `ro-reference-source.md`.

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
