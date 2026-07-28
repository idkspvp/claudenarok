# Mapping our abilities onto Ragnarok's first-job skills

The five first jobs carry 56 skills between them. This game carries about 180.
The conversion is therefore mostly a DELETION, and the interesting question is
not "what do we cut" but "which of ours is already the right shape for a skill
we have to have anyway".

Everything on the left is read from the reference's own data
(`db/pre-re/skill_tree.yml` for the tree and the prerequisites,
`db/pre-re/skill_db.yml` for the spell-point costs). Nothing here is invented.

## Why the trees are different sizes, and why that is correct

Every job earns the same 49 skill points (job level 1 to 50, one point each).
What differs is how much tree there is to spend them on:

| Job | Skills | Points the tree can absorb | Share a maxed character can fill |
|---|---|---|---|
| Archer | 7 | 52 | 94% |
| Thief | 10 | 55 | 89% |
| Swordman | 10 | 73 | 67% |
| Acolyte | 15 | 91 | 54% |
| Mage | 14 | 122 | 40% |

That spread IS the design. An archer can very nearly max their whole tree, so
two archers look alike and the class is easy to pick up. A mage can fill two
fifths of theirs, so a fire mage and a cold mage are genuinely different
characters. Acolyte's fifteen skills are mostly small utilities capped at level
one (Ruwach, Pneuma, Holy Water, Cure, Holy Light), which is why it has the most
skills but not the most depth.

## Swordman: 10 skills

| Reference skill | Max | Needs | Ours to repurpose | Fit |
|---|---|---|---|---|
| Sword Mastery | 10 | | none | NEW passive |
| Two-Hand Sword Mastery | 10 | Sword Mastery 1 | none | NEW passive |
| HP Recovery | 10 | | none | NEW passive |
| Bash | 10 | | `heroic_strike` | strong: single melee strike, already the opener |
| Provoke | 10 | | `taunt` + `demoralizing_shout` | strong: taunt plus a defence-down, merged into one |
| Magnum Break | 10 | Bash 5 | `whirlwind` | strong: damage in a ring around the caster |
| Endure | 10 | Provoke 5 | `iron_resolve` | good: a stand-and-take-it self buff |
| Moving HP Recovery | 1 | | none | NEW passive |
| Fatal Blow | 1 | | `deep_wounds` | fair: a passive that upgrades a strike |
| Auto Berserk | 1 | | `enrage_passive` | strong: a passive that fires at low health |

Repurposed 6, new 4. Cut from the swordman kit: 37.

## Mage: 14 skills

| Reference skill | Max | Needs | Ours to repurpose | Fit |
|---|---|---|---|---|
| SP Recovery | 10 | | none | NEW passive |
| Sight | 1 | | none | NEW (reveals hidden) |
| Napalm Beat | 10 | | `arcane_missiles` | strong: the ghost-property starter nuke |
| Safety Wall | 10 | Napalm Beat 7, Soul Strike 5 | none | NEW (blocks melee on a tile) |
| Soul Strike | 10 | Napalm Beat 4 | `arcane_surge` | good: a ghost bolt that hurts the undead |
| Cold Bolt | 10 | | `frostbolt` | exact |
| Frost Diver | 10 | Cold Bolt 5 | `frost_nova` | strong: the freeze |
| Stone Curse | 10 | | `polymorph` | fair: a hard single-target control |
| Fireball | 10 | Fire Bolt 4 | `fireball` | exact |
| Fire Wall | 10 | Fireball 5, Sight 1 | `flamestrike` | strong: fire on the ground |
| Fire Bolt | 10 | | `scorch` | strong: the single-target fire bolt |
| Lightning Bolt | 10 | | none | NEW (no wind school today) |
| Thunderstorm | 10 | Lightning Bolt 4 | `blizzard` | good: same shape, wrong element |
| Energy Coat | 1 | | `ice_barrier` | good: spends the caster's own pool to survive |

Repurposed 9, new 5. Cut from the mage kit: 42.

## Archer: 7 skills

| Reference skill | Max | Needs | Ours to repurpose | Fit |
|---|---|---|---|---|
| Owl's Eye | 10 | | none | NEW passive (Dexterity) |
| Vulture's Eye | 10 | Owl's Eye 3 | none | NEW passive (range and accuracy) |
| Improve Concentration | 10 | Vulture's Eye 1 | `aspect_of_the_hawk` | strong: a self buff on the attack stats |
| Double Strafe | 10 | | `arcane_shot` | strong: the bread-and-butter shot |
| Arrow Shower | 10 | Double Strafe 5 | `volley` | exact |
| Arrow Crafting | 1 | | none | NEW (a crafting verb, not combat) |
| Charge Arrow | 1 | | `concussive_shot` | strong: a shot that knocks back |

Repurposed 4, new 3. Cut from the archer kit: 16.

## Acolyte: 15 skills

| Reference skill | Max | Needs | Ours to repurpose | Fit |
|---|---|---|---|---|
| Divine Protection | 10 | | none | NEW passive |
| Demon Bane | 10 | Divine Protection 3 | none | NEW passive |
| Ruwach | 1 | Divine Protection 1 | `holy_nova` | fair: small holy damage around the caster |
| Pneuma | 1 | Warp Portal 4 | `power_word_shield` | good: blocks incoming ranged |
| Teleport | 2 | Ruwach 1 | `veilstep` | strong: the short blink |
| Warp Portal | 4 | Teleport 2 | none | NEW |
| Heal | 10 | | `heal` | exact |
| Increase AGI | 10 | Heal 3 | `power_infusion` | good: the party speed-and-attack buff |
| Decrease AGI | 10 | Increase AGI 1 | `mind_flay` | fair: a slow, wrong flavour |
| Aqua Benedicta | 1 | | none | NEW (creates holy water) |
| Signum Crucis | 10 | Demon Bane 3 | `shadow_word_pain` | fair: an area debuff, wrong flavour |
| Angelus | 10 | Divine Protection 3 | `power_word_fortitude` | strong: the party defence buff |
| Blessing | 10 | Divine Protection 5 | `renew` | weak: ours is a heal over time, Blessing is a stat buff |
| Cure | 1 | Heal 2 | none | NEW (clears a status) |
| Holy Light | 1 | Blessing 5 | `smite` | strong: the single holy bolt |

Repurposed 9, new 6. Cut from the acolyte kit: 5. This is the only class where our
kit is SMALLER than the reference's.

## Thief: 10 skills

| Reference skill | Max | Needs | Ours to repurpose | Fit |
|---|---|---|---|---|
| Double Attack | 10 | | `blade_flurry` | good: a passive extra hit |
| Increase Dodge | 10 | | `evasion` | strong: the evasion buff, becomes a passive |
| Steal | 10 | | none | NEW |
| Hiding | 10 | Steal 5 | `stealth` | strong |
| Envenom | 10 | | `instant_poison` | strong: the poison strike |
| Detoxify | 1 | Envenom 3 | none | NEW (clears poison) |
| Sand Attack | 1 | | `blind` | strong: blinds the target |
| Back Slide | 1 | | `phase_tumble` (mage) or `sprint` | good: the short hop backwards |
| Find Stone | 1 | | none | NEW (a gathering verb) |
| Stone Fling | 1 | Find Stone 1 | none | NEW |

Repurposed 6, new 4. Cut from the thief kit: 20.

## Totals

| | Count |
|---|---|
| Reference skills to build | 56 |
| Ours that can be repurposed | 34 |
| Genuinely new | 22 |
| Ours that are cut outright | ~120 |

Two thirds of the tree already exists in some form. The new ones cluster in three
places, and none of them is a combat mechanic this game lacks:

- **Passive stat masteries** (Sword, Two-Hand, Owl's Eye, Vulture's Eye, Divine
  Protection, Demon Bane, HP and SP Recovery). This game has never had a passive
  that simply adds to a stat, because the WoW-shaped original put that on gear.
- **Verbs that are not attacks** (Warp Portal, Aqua Benedicta, Arrow Crafting,
  Find Stone, Steal). These are closer to the professions surface than to combat.
- **The wind school** (Lightning Bolt, Thunderstorm). The element exists in the
  attribute chart already; no ability carries it.

## What this does NOT decide

Repurposing means keeping the effect machinery and replacing the numbers, the
name, the icon, and the level curve. It does NOT mean keeping the balance: every
one of the 56 takes its spell-point cost and its per-level values from the
reference, because the whole point of moving to a spell-point pool is that those
numbers were designed against it.
