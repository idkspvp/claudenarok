# SpiritVale's skill effects, from the client datamine

The same fan site that publishes SpiritVale's engine formulas also publishes a
skill database with the EFFECTS, not just the shape: 236 skills, each with its
power coefficient, hit count, cast time, cooldown, spell-point cost, and the
status it applies. Read July 2026.

This corrects the note in `spiritvale-skill-reference.md` that per-skill effects
were unpublished. They are. The earlier reading came from a different fan wiki
that only carried the shape.

**Superseded on the schema.** The site's JSON was fetched afterwards: 279 skills
with 52 fields each, plus 185 statuses, 111 passives and 29 summons. The record
sketch at the bottom of this file guessed roughly a third of the real field set.
Read `spiritvale-data-schema.md` for the actual shape. What still stands here is
the reading of the power values and the observation about how low the control
chances are.

## The record format

Every skill states the same fields. Here are four real rows:

```
Venom Strike   Neutral · Melee · Enemy · Target · Max Lv 5 · Rogue, Weaver
  Power     100% +20%/lv ATK
  Hits      2
  SP cost   3 +1/lv
  Applies   Poison 5s · 0.5+0.1/lv%

Holy Light     Holy · Magic · Enemy · Target · Max Lv 5 · Acolyte, Weaver
  Power     +100%/lv MATK
  Hits      3
  Cast      1 s
  SP cost   10 +5/lv

Stomp          Neutral · Melee · Enemy · Ground · Max Lv 5 · Warrior, Weaver
  Power     +100%/lv ATK
  Cooldown  4 s
  SP cost   10 +5/lv
  Applies   Stun 3s · 0.15%/lv

Free Cast      Passive · Max Lv 5 · Mage
  +15% +10%/lv  free-cast while moving
  +50% +10%/lv  free-cast while attacking
```

The fields, and what each means:

| Field | Meaning |
|---|---|
| Element | one of the ten, or Neutral |
| Damage type | Magic / Melee / Ranged, absent on a passive |
| Target | Enemy / Ally / Self / Any, and Target / Ground / (area) |
| Max Lv | 1, 5 or 10 |
| Classes | one or more; a skill can belong to several |
| **Power** | **a PERCENTAGE of ATK, MATK, or ATK+MATK** |
| Hits | packets per cast; some scale with level (`0 +1/lv`, `1 -> 6`) |
| Cast time | seconds, sometimes scaling (`0 +0.8/lv s`) |
| Cooldown | seconds, often falling with level (`7 -1/lv s`) |
| SP cost | `base +X/lv` |
| Applies | the status, its duration, and its chance or magnitude |

## The answer to what the coefficient multiplies

`Power: +100%/lv ATK` at level 5 is **500% of attack power**. The earlier reading
of the other wiki's `0 (+2/Lv)` was the same number written as a fraction.

Three scaling bases exist and the choice is meaningful:

- **ATK** for physical skills
- **MATK** for pure magic (Holy Light, Shadow Strike, Chain Lightning)
- **ATK+MATK** for hybrid skills (Black Blade, Grand Cross, Soul Strike, Smite)

The `ATK+MATK` base is a design this game has no equivalent for and is worth
noting: it lets one skill reward two different builds.

## The range of power values

| Skill | Power | Type |
|---|---|---|
| Earthquake | +50%/lv MATK | area, hits 1 to 6 by level |
| Soul Strike, Smite | +60%/lv | hits scale with level |
| Volatile Bolt, Dissonance Well | +75%/lv | |
| Most skills | +100%/lv | the default |
| Cyclone | +125%/lv | |
| Chain Lightning, Life Drain, Death Coil | **+300%/lv** | advanced-class nukes |

An advanced-class skill is worth roughly three times a base-class one at the
same level, which is how the advancement is made to feel like an advancement.

## Statuses a skill can apply

Read off the rows: Poison, Stun, Bleeding, Frozen, Curse, Slow, Decay,
Volatile, Vulnerability, Magic Exposure, Water Exposure, Wind Exposure, Endure,
Berserk, Haste, Sacred Aegis, Venom Coating, Slow Immunity.

Two forms of magnitude appear:

```
Stun 3s · 0.15%/lv          a CHANCE, scaling with level
Poison 5s · 0.5+0.1/lv%     a chance with a base
Vulnerability 5s · x2/lv    a MULTIPLIER, scaling with level
Haste 60s/lv                a DURATION, scaling with level
Volatile 5s · x5            a flat multiplier
```

Note how low the control chances are: Stomp at level 5 stuns for 3 seconds on a
**0.75%** chance. Hard control is deliberately close to nonexistent.

The `Exposure` family (Water Exposure, Wind Exposure, Magic Exposure) is an
elemental-vulnerability debuff applied by a skill of a DIFFERENT element, which
sets up a second caster. Chain Lightning (Wind) applies Water Exposure; Ice
Shard (Water) applies Wind Exposure. That is a party-play hook this game has no
counterpart for.

## What this changes about the earlier assessment

Both earlier documents in this directory said SpiritVale's per-skill effects
were unpublished, and used that to argue the data was structurally thinner than
the reference's. That was wrong, and the argument built on it does not stand.

What remains true, and is now the ONLY data-quality argument:

- The reference is open server source; SpiritVale is a community reading of a
  closed client, and the site says so itself.
- SpiritVale is in Early Access, so its numbers move.

Those are real, but they are much weaker than "the effects are unknown".

## The 236 rows

Captured in full during the session; the site is the live source and should be
re-read rather than trusted from a stale copy here. The five base classes that
match this game's five jobs are transcribed in `spiritvale-skill-reference.md`;
this file records the FORMAT and the ranges so a content author knows what shape
a record has to hold.

A skill record here needs, at minimum:

```ts
{
  id, name, element, damageType,        // Magic | Melee | Ranged | null
  target,                                // enemy | ally | self | any
  placement,                             // target | ground | area
  maxLevel,                              // 1 | 5 | 10
  classes: string[],                     // one skill, several classes
  power: { base, perLevel, scalesWith }, // 'atk' | 'matk' | 'atk+matk'
  hits: { base, perLevel },
  castTime: { base, perLevel },
  cooldown: { base, perLevel },          // perLevel is NEGATIVE
  spCost: { base, perLevel },
  applies: [{ status, seconds, chance?, multiplier?, perLevel? }],
}
```

That is a superset of what this game's `AbilityDef` carries today, and the parts
it does not carry (power as a percentage of a derived stat, hits scaling with
level, a cooldown that falls) are exactly the parts worth adopting.
