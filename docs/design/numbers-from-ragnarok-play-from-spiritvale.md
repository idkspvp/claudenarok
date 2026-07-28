# Numbers from Ragnarok, play from SpiritVale

The standing rule for every balance and design decision in this conversion, and
the tiebreaker when two references disagree.

> **The numbers come from Ragnarok Online (pre-renewal). The way the game is
> played comes from the modern classic-likes.**

It is written down because the project kept re-deciding it one question at a
time. Every decision below was made independently and then turned out to follow
the same line, so the line is now the default and only a stated exception
departs from it.

## What "numbers" means

Anything a formula consumes or produces: attack, defence, attack speed, hit,
flee, magic attack, magic defence, the status-point curve, experience, monster
attributes. These are taken from pre-renewal Ragnarok because that game's
balance survived twenty years of live play, and because guessing them has
already gone wrong here twice (see `docs/design/ro-reference-source.md`).

Read the reference, never copy it. Aggregate statistics computed over its data
are permitted and recorded as exceptions in that same document; individual
records, names, and authored numbers are not.

## What "play" means

Anything a player experiences as a loop or a surface: how many maps there are
and how wide a level band each one spans, where materials come from and what
they craft, how cards drop and at what rate, how refining works and what a
failure costs, what the equipment slots are called, whether gear comes in sets,
how trading works.

Pre-renewal Ragnarok is harsh in ways that read as hostile rather than
challenging to a player today: card rates near a hundredth of a percent,
equipment destroyed outright on a failed refine, no direction about where to go
next. The modern classic-likes solved those without giving up the underlying
model, so they are the reference for the loop.

## How it has actually been applied

| Decision | Source | Where it lives |
|---|---|---|
| MDEF, MATK, ASPD, HIT, FLEE formulas | Ragnarok | `src/sim/combat/`, `src/sim/job_aspd.ts` |
| Weapon attack by weapon class | Ragnarok | `src/sim/combat/weapon_class_atk.ts` |
| Armour defence as a percentage, by slot | Ragnarok | `src/sim/combat/armor_slot_def.ts` |
| Attribute bonuses on gear: rare, and small | Ragnarok | `src/sim/item_stat_policy.ts` |
| Status points and manual allocation | Ragnarok | `src/sim/types.ts`, `src/sim/status_points.ts` |
| Experience curve and level cap | Ragnarok | `src/sim/types.ts` |
| Equipment slots and their names | SpiritVale | `src/sim/types.ts` (`EquipSlot`) |
| Map count and level spread per area | SpiritVale | `docs/design/world-shape.md` |
| Materials per area, crafted at an NPC | SpiritVale | `docs/design/drops-and-crafting.md` |
| Card drop rates | SpiritVale | `docs/design/drops-and-crafting.md` |
| Refining, including what failure costs | SpiritVale | `docs/design/drops-and-crafting.md` |
| Equipment sets with piece-count bonuses | SpiritVale | `src/sim/content/item_sets.ts` |

## Recorded exceptions

- **The market is centralised.** Neither reference does this: Ragnarok sells
  through player vending and SpiritVale through player stalls. Ours is built,
  tested, and works, and replacing it would buy atmosphere rather than function.
- **There is a legs slot.** Ragnarok spends that slot on a third headgear
  instead. We follow SpiritVale here, and the divergence is noted in
  `EquipSlot`.

## Using the rule

When a question is about a number, go and measure it in the reference rather
than reasoning from memory: web search returns Renewal by default, and Renewal
is a different game. When a question is about a loop, look at how the modern
classic-likes shaped it.

When a question is genuinely both, split it. "How much attack does a two-handed
sword have" is a number. "Do two-handed swords come in sets" is a loop. The
equipment work is the worked example: attack and defence came from Ragnarok, the
slots and the sets came from SpiritVale, and neither answer contaminated the
other.
