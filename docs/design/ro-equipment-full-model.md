# Equipment on Ragnarok's full model

The plan for bringing equipment, weapons included, all the way onto the
reference model: attributes, elements, race and size, card sockets, status
effects, and magic defence. Follows the standing rule in
`numbers-from-ragnarok-play-from-spiritvale.md`.

## The finding this plan is built on

**The elemental combat machinery is already built, and it is completely inert.**

`src/sim/combat/elements.ts` carries all ten attributes, the four attribute
levels, the full damage chart, and all ten races. `src/sim/combat/weapon_size.ts`
carries the weapon-class-against-monster-size table, and it matches the
reference. `src/sim/combat/attribute_damage.ts` combines them and is called on
every auto-attack.

It always returns 1.0, because nothing in the game is tagged:

| | authored | total |
|---|---|---|
| monsters with an element | 0 | 119 |
| monsters with a race | 0 | 119 |
| monsters with a size | 0 | 119 |
| weapons with an element | 0 | 120 |
| armour with an element | 0 | 304 |
| anything with a card socket | 0 | 673 |

So the bulk of this work is AUTHORING DATA onto systems that already exist,
not writing new systems. The one genuinely missing system is card sockets, and
that is also the one that matters most: cards are the whole of Ragnarok's
endgame.

The same shape has already bitten twice on this branch. The weapon size table
was inert because no weapon carried a `weaponType`, and the per-job attack-speed
table was inert for the same reason. Both came alive the moment the data was
authored. Treat an untagged content table as a bug, not as a gap to fill later.

## What the reference actually puts on equipment

Measured over the reference server's 2,017 equipment records and 538 cards.

| Feature | Share of equipment | Ours |
|---|---|---|
| Defence | 44% | done |
| Weapon level and class attack | 35% | done |
| Job and level restrictions | 61% / 64% | already had |
| Refineable | 65% | already had |
| Attribute bonus | 29% | in flight |
| **Card sockets (1 to 4)** | **35%** | **missing** |
| **Magic defence** | **12%** | **missing** |
| **Element (weapon attack)** | **6%** | field exists, unauthored |
| **Element defence (armour)** | **4%** | missing |
| **Damage against a race** | **10%** | race list exists, unauthored |
| **Damage against a size** | **1%** | table exists, unauthored |
| **Auto-cast on hit** | **7%** | missing |
| **Inflict a status on hit** | **4%** | missing |
| **Resist a status** | **3%** | missing |
| Max HP or SP | 6% | missing |
| Attack speed | 4% | missing |
| Flat attack or magic attack | 2% | missing |

## Phases

Each phase is independently shippable and leaves the tree green. Author data
before building the system that consumes it wherever the system already exists,
so every phase turns something inert into something live.

### Phase 1: attribute bonuses (in flight)

`src/sim/item_stat_policy.ts` is written and applied. Ordinary armour grants no
attributes, accessories carry small ones, epics are the exception. It moved gear
from 91% of pieces granting a median +4 to 44% granting a median +2, and a fully
dressed level-20 character from 131 attribute points off gear down to 41,
against the 59 the climb itself grants.

Remaining: about 25 test files still assert the inherited item-level stat budget,
which is incompatible with a rule where most gear grants nothing. The budget is
retired for armour the same way the weapon dps budget already was; weapons keep
it, because a weapon's attributes are part of what makes it that weapon.

### Phase 2: tag the world with element, race and size

Author `element`, `elementLevel`, `race` and `size` onto all 119 monsters, and
`element` onto weapons. This is what makes `attribute_damage.ts` do anything.

Reference distributions to author against:

- **Element**: neutral 20%, earth 17%, dark 13%, fire 11%, wind 10%, water 9%,
  undead 7%, ghost 6%, poison 5%, holy 4%
- **Element level**: 1 at 39%, 2 at 25%, 3 at 22%, 4 at 13%
- **Race**: formless 22%, demihuman 18%, brute 15%, demon 14%, plant 8%,
  insect 7%, undead 7%, fish 3%, angel 3%, dragon 3%
- **Size**: medium 49%, small 29%, large 23%

Author by what a monster IS rather than by hitting the percentages: a bonewalker
is undead, a ridge beast is a large brute. The distributions are a sanity check
on the finished table, not a target to fit.

Only 6% of reference weapons carry an element, so most of ours stay neutral and
an elemental weapon is a real find.

### Phase 3: card sockets and cards

The genuinely new system, and the one that carries the endgame.

- A socket count on the item record, 0 to 4. The reference puts one or more
  sockets on 35% of equipment: 479 items with one, 115 with two, 90 with three,
  26 with four.
- Cards are items that fit a slot KIND. Reference card targets: weapon 119,
  headgear 150 across its three slots, armour 85, accessory 76, shield 45,
  garment 39, shoes 38.
- What a card does, measured over the 538 reference cards: a flat attribute 25%,
  damage against a race 3%, against an element 4%, against a size 1%, defence
  against a race or element 10%, inflict a status 7%, resist a status 4%,
  auto-cast 9%, flat attack or magic attack 7%, max HP or SP 7%, perfect dodge
  or flee or crit 9%, defence or magic defence 9%, armour element 2%.

Drop rates come from SpiritVale, not the reference: 1 to 5% on normal monsters,
10 to 15% on elites, 25 to 50% on bosses, against the reference's median of
0.01%. That decision is already recorded in `drops-and-crafting.md`, along with
the Card Forge that turns five of one rarity into one of the next.

Socketing is permanent in the reference. Whether it stays permanent here is a
LOOP question, so it follows SpiritVale.

### Phase 4: magic defence on equipment

`src/sim/combat/magic_defence.ts` already implements the reference formula and
already takes hard MDEF as an argument, because no equipment field existed to
feed it. Add the field, author it (12% of reference equipment carries magic
defence), and stop passing zero.

### Phase 5: the remaining bonus kinds (done)

Status inflict and resist, auto-cast, max HP and SP, attack speed. Each is small
on its own; together they are what makes one piece of gear feel different from
another once attributes stop doing that job.

Re-measured against the pre-renewal reference at implementation time, over its
2017 equipment rows and its 538 cards. The earlier estimate in this document was
wrong on auto-cast (a case-sensitive search missed `bAutoSpell` entirely and
reported zero); these are the corrected figures:

| effect | equipment | cards |
|---|---|---|
| inflicts a status | 3.2% | 2.6% |
| resists a status | 2.7% | 4.3% |
| flat maximum health | 3.5% | 2.6% |
| flat spell points | 3.5% | 1.7% |
| attack speed | 3.7% | 0.7% |
| auto-casts on hit | 4.5% | 4.6% |

Units are confirmed from the reference source, not inferred: an inflict or
resist rate is a fraction of 10000 (`status.cpp`, `status_change_start`), an
auto-cast rate a fraction of 1000 (`skill.cpp`, the autospell loop).

Where each of these lands here:

- **The eight statuses** the reference actually inflicts (stun, bleeding, curse,
  blind, freeze, poison, silence, sleep) map onto auras this game already has
  rather than a parallel set: curse becomes a slow and freeze a hold, which is
  what those two do there as well. `src/sim/combat/gear_effects.ts`.
- **Two stunning items give two rolls**, not one bigger roll; resistance sums and
  may reach immunity but never turns into a bonus for the attacker.
- **Auto-cast resolves from the ability table, not the wearer's known list**
  (`src/sim/combat/auto_cast_ability.ts`). This is the whole point of the effect:
  a card that casts a bolt has to work on a character who never learns that bolt.
  It resolves at rank 1, costs nothing, and ignores cooldown; the chance to fire
  is the only limiter, which is what it is in the reference.
- **Determinism**: a wearer carrying none of this draws no rng. Every guard
  short-circuits before the first draw, the same shape the legendary weapon procs
  already use, so the shared draw order is untouched for ordinary gear.

Flat attack and magic attack are deliberately NOT in this phase: both already
have a home in the weapon and spell-power fields, and adding a second additive
source for the same quantity is how a balance pass becomes unreadable.

## Refining, once weapon level means something

Every weapon now carries a weapon level, which is what the reference indexes
refine bonuses and safe limits by. Confirmed from the reference:

- Weapon attack per refine: level 1 gives +2, level 2 +3, level 3 +5, level 4 +7
- Safe limit by weapon level: 1 to +7, 2 to +6, 3 to +5, 4 to +4
- Armour safe limit: +4

The armour defence bonus per refine needs checking against the reference
directly during implementation rather than being carried over from this note;
the stored units are ambiguous between a displayed and an internal scale.

What a failure COSTS is a loop question and stays SpiritVale's: the item drops
one refine level with a floor of zero rather than being destroyed, which
`drops-and-crafting.md` already records as reversing what `refine.ts` currently
implements.

## Interactions to keep in view

- **The professions and market systems** consume item stats directly. Phase 1
  already reaches crafting, masterwork, commissions and the market; phases 3 and
  4 will reach them again. Sequencing the phases so each lands complete is the
  reason this document exists.
- **Item sets** stay as they are, three and four pieces mixed, by decision.
- **The parity gate** re-hashes on every phase, since the player sample digests
  the whole equipment block. Expect a golden regeneration per phase, each in its
  own commit, and check the rng draw totals rather than the line counts.
- **Determinism**: card drops, socketing outcomes and auto-cast all draw
  randomness, so every one of them goes through `Rng` and earns a parity
  scenario.

## Licensing

Everything above is an aggregate statistic computed over the reference data, in
the same manner already recorded in `ro-reference-source.md`. No individual
record, name, or authored number is carried across. Our monsters keep their own
names and their own identities; what they take from the reference is the SHAPE
of the distribution they should follow.
