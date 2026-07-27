# Drops, cards, crafting and refining

The loot economy, taken from SpiritVale by decision. Companion to
`monster-restat.md` (which authors the material arm) and `world-shape.md` (which
sizes the areas the materials are keyed to).

Roadmap: this is `B4` and most of `B5`. None of it is implemented.

## Three arms, doing three jobs

| Arm | Drops | Rate | Authored in |
|---|---|---|---|
| **material** | one or two per AREA, from most things in it | above 50% | the restat pass |
| **rare** | a finished piece, from a specific monster | 0.1% to a few percent | `B5` |
| **card** | the monster's own card | see below | `B4` |

Materials are the floor and the reason an area is worth standing in: you take
them to an NPC and craft that area's gear, so the reward is chosen rather than
rolled for. They also give the roughly 130 items orphaned by the quest deletion a
home that is a list rather than a lottery.

Rare drops are the ceiling. A purely deterministic craft loop has no moment in
it.

## Cards

**SpiritVale's model, not Ragnarok's, and the difference is not cosmetic.**
Ragnarok drops a card at one in ten thousand and that single find defines a
build. SpiritVale drops them freely and sorts them into rarity tiers you combine
upward, so a card is a currency you advance rather than a find you remember.
That is the chosen design; it should not be described as the Ragnarok feel later.

| Source | Rate |
|---|---|
| normal monster | 1 to 5% |
| elite | 10 to 15% |
| boss | 25 to 50%, never below Uncommon |

| Tier | Colour | Stat bonus |
|---|---|---|
| Common | grey | +1 to 3 |
| Uncommon | green | +3 to 6 |
| Rare | blue | +6 to 12 |
| Epic | purple | +12 to 20 |
| Legendary | orange | +20 to 35 |

Six slots: two in the weapon, two in armour, one in each accessory, all unlocked
at character level 8.

**The Card Forge** takes five cards of one rarity and returns one random card of
the next, always succeeding, with no other material. It unlocks at level 20.

The tiers are load-bearing rather than decoration. At 1 to 5% the volume of cards
is enormous, and without a sink that converts volume into quality every card is
worthless. The forge IS that sink.

**Naming hazard.** This project already uses the word "card" for something else
entirely: `src/sim/social/card_duel.ts` and `content/card_master.ts` are a Card
Duel MINIGAME run by an NPC. Equipment cards are a new system that happens to
share the noun. Pick distinct ids and distinct player-facing strings, or the two
will be confused in the codebase and in the wiki.

## Crafting stations

Five, each gated by a plain character level at a fixed location. Worth noting
because the obvious alternative is not available: SpiritVale gates some of these
behind quests, and **this project deleted the quest system**, so a level gate is
both simpler and the only option that needs nothing new built.

| Station | Level | Makes |
|---|---|---|
| Blacksmith's Anvil | 12 | weapons, armour, refining |
| Alchemy Station | 15 | potions, elixirs |
| Card Forge | 20 | card combining |
| Jewelcrafting Table | 25 | accessories, gem slots |
| Tailoring Bench | 30 | cloth armour, bags, cosmetics |

Materials tier by area, in three families (ore, wood, herb), with the better
grade of each in a later area. That is what makes an area's material identity
concrete: you go THERE for THAT.

The crafting subsystem already exists (`src/sim/professions/` with
`content/recipes.ts`), so this is content authored against a working machine, not
a new machine.

## Refining

**SpiritVale's ladder, replacing the Ragnarok one already in the tree.** This is
a decision, and it reverses existing code.

| Step | Success | Stat gain |
|---|---|---|
| +1 to +3 | 100% | +5% |
| +4 to +6 | 70% | +10% |
| +7 to +9 | 40% | +15% |
| +10 | 20% | +25% |

Stabilizers add 15% success each, stacking twice. A Refine Transfer NPC carries
an existing bonus onto higher-tier gear.

**A failed refine does NOT destroy the item.** It drops the refine level by one,
with a floor of zero. Ragnarok breaks the equipment outright above the safe
limit, which is the single harshest thing in that game; not having it is the
biggest player-experience difference in this whole document.

What that reverses: `src/sim/combat/refine.ts` currently implements Ragnarok's
model, where the safe limit varies by WEAPON LEVEL (7, 6, 5 and 4 for levels one
through four) and everything above it is a gamble. The SpiritVale ladder is flat,
identical for every weapon, and never destructive. The module keeps its shape,
`MAX_REFINE` stays 10, and the safe-limit table and the risk predicate are what
change.

## The market stays as it is

SpiritVale trades through player stalls with a 5% transaction tax and no central
auction house. **We keep our centralised World Market** (`src/sim/market.ts`) by
decision. It is built, it is tested, and stalls would be a rewrite that buys
atmosphere rather than function.

## Open

- Whether every monster carries a card, or only some of them. Ragnarok gives one
  to 52% of its roster. With rates this generous, giving one to everything may be
  correct, but it has not been decided.
- Card set bonuses. SpiritVale runs four named sets (move speed and experience,
  damage against bosses, magic damage, maximum health). We already have an
  item-set system (`content/item_sets.ts`), which may or may not be the right
  machine to reuse.
