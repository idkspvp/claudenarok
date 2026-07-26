# RO Classic conversion

**Status:** planning. Nothing below has landed yet.
**Decided:** 2026-07-26. Target is Ragnarok Online *pre-renewal* ("classic"), not Renewal.

This is the plan for turning SpiritVale's progression from the WoW-shaped one it
inherited into a classic-Ragnarok one. It records the reference numbers, what the
codebase looks like today, and the order the work has to happen in — that order is
not free, and getting it wrong means tuning the same content twice.

## Sourcing rule (this project is commercial)

The open-source Ragnarok emulators (rAthena, Hercules) are **GPL-3.0, repository
wide, `db/` included**. SpiritVale is MIT and intended to be commercial, so:

- **Formulas and numbers are facts** and carry no copyright. Take them from the
  documentation — [iRO Wiki](https://irowiki.org/wiki/Stats),
  [Ragnarök Wiki](https://ragnarok.fandom.com/wiki/Stats_(RO)),
  [RateMyServer](https://ratemyserver.net/index.php?page=misc_table_exp&op=21) —
  and cite where each came from.
- **Reading emulator source to verify a number is fine.** Reading it to model our
  implementation's shape is not: that is how a derivative work happens without
  anyone copying a line. When a wiki is ambiguous (rounding order, whether a cap
  applies before or after a multiplier), check the emulator for *that value only*
  and write our own code from the answer.
- **Never** copy code or `db/*.yml` content, and never reuse Gravity's authored
  data — monster names, item names, the specific numbers attached to them. Those
  are Gravity's regardless of what licence the emulator carries.

## Reference numbers (pre-renewal)

| | Value |
| --- | --- |
| Base level cap | 99 |
| Job level cap | Novice 10 · 1st job 50 · 2nd job 50 · Transcendent 70 |
| Status points per base level | `floor(x / 5) + 3` going from level `x` to `x+1` |
| Status points, level 1 → 99 | 1,225 (plus 48 granted at character creation) |
| Cost to raise a stat by one | `floor((stat - 1) / 10) + 2` — 2 at 1–9, 3 at 10–19, 4 at 20–29 … |
| Maximum single stat | 99 |
| Skill points | 1 per job level (a 1st job at JL50 has 49) |
| Job change | 1st job at Novice JL10; 2nd job at 1st-job JL40 (most players push to 50) |

Stats are STR / AGI / VIT / INT / DEX / LUK. There is no Spirit.

## What the codebase looks like today

| | Current |
| --- | --- |
| `MAX_LEVEL` (`src/sim/types.ts`) | 20, read by 17 files |
| `XP_TABLE` | 20 entries |
| Stats | 5 — `str` `agi` `sta` `int` `spi`, on a ~10–60 scale |
| Levels | one ladder; no job level exists anywhere |
| Classes | 9 fixed, no tree |
| Talent rows | a 1-of-3 pick at levels `[5, 8, 11, 14, 17, 20]` |

Level-banded content, by count:

| Field | Occurrences |
| --- | --- |
| `learnLevel` (abilities) | 317 |
| `level:` (mobs and friends) | 346 |
| `minLevel` (quests) | 156 |
| `levelRange` (zones) | 3 — `[1,7]`, `[6,13]`, `[13,20]` |

## The constraint that sets the order

**The two games' stat scales do not overlap.** A level-20 warrior here has STR 61
and STA 60; in Ragnarok every job starts at 1 in everything and climbs toward 99.
Every derivation in `src/sim/entity.ts` is tuned against the old scale —
`attackPower = str * 2`, `hpFromStamina(sta)`, `spellPower = int * SPELL_POWER_PER_INT`,
crit and dodge off `agi` — so moving to Ragnarok's stats invalidates all of them at once.

That means **allocation and the damage formula cannot ship separately.** An earlier
attempt to land allocation on its own was reverted for exactly this reason: the
parity gate caught a level-20 character reading level-1 stats, and every honest fix
for it was really the damage-formula rewrite wearing a disguise.

Nobody is playing the live realm, so there is no migration to preserve and no
reason to keep the game balanced in between. The conversion is a wipe.

## Order

**Phase 1 — the level ladder and the stat rewrite, together.**
`MAX_LEVEL` to 99 and a 99-entry `XP_TABLE`; the six stats replacing the five;
status points and the rising cost curve; and every derivation in `entity.ts` and
`combat/damage.ts` retuned to the 1–99 scale in the same pass. The 317
`learnLevel` values and the three zone bands re-spread across the new ladder.
The game is not balanced during this phase and that is expected.

**Phase 2 — job levels and the job tree.**
A second XP ladder with its own cap, Novice → 1st → 2nd, job-change gating, and
skill points replacing the talent-row pick.

**Phase 3 — the Ragnarok combat model.**
Soft and hard DEF, the element table, size and race modifiers, Flee versus Hit,
ASPD. Cards and refine land here too: they are itemisation, and itemisation only
means something once the damage formula reads it.

**Phase 4 — content.**
Levels 21–99 have nothing to kill. This is the largest piece of work in the
conversion and the one that cannot be shortcut by a formula.

## Decisions (2026-07-26)

**Starting stats: Ragnarok's.** Every job begins at 1/1/1/1/1/1 with the 48-point
creation grant. The nine per-class starting blocks are retired — class identity
moves entirely into the job tree and its skills, which is where Ragnarok keeps it.

**Job tree: re-authored from Novice down.** Not the nine current classes promoted
to 2nd job. The shape is Ragnarok's: one Novice tier, six 1st jobs, twelve 2nd jobs
(each 1st job branching two ways). The 317 existing abilities get re-homed onto
that tree.

**Base EXP: Ragnarok's pacing.** See the caveat below — the pacing is the target,
not the literal table.

## Two constraints these decisions create

**Job names have to be ours.** The structure — Novice, six branches, two per
branch, the JL10/JL40 gates — is a design pattern and free to use. The *names*
Gravity attached to it are not, and the repo already has a scanner that would
catch them: `tests/ip_scrub.test.ts` rejected a proposed ability name as verbatim
WoW earlier in this work, and `ip-refactor/NAME-MAP.md` is where each new name gets
recorded. Twelve 2nd jobs and six 1st jobs is eighteen names to coin and screen.

**The EXP table is authored data, not a formula.** Unlike the stat cost curve
(`floor((stat-1)/10) + 2`, a rule) the 99 base-EXP values are numbers Gravity
chose. Copying the list verbatim reproduces their dataset. So: fit our own curve
to the published *shape* — the early-level ramp, the mid-game wall, the 90s grind —
and generate our numbers from it. Same pacing, our data.

The nine current classes do not map cleanly onto six Ragnarok branches: there is
no Merchant equivalent here, and Shaman, Warlock, and Druid have no counterpart
there. Re-homing 317 abilities across eighteen jobs is the largest single piece of
phase 2 and needs its own pass.

## Fidelity check (2026-07-27)

Everything below was checked against published pre-renewal figures, pinned in
`tests/ro_stat_fidelity.test.ts`. That file is the only place those numbers appear
as literals, so drift shows up there as a named failure.

**A note on which Ragnarok.** *Pre-renewal* and *Classic* are the same era; the
squared per-10-attribute terms in ATK and MATK belong to it and to nothing else.
*Renewal* (2010+) dropped them and rebuilt ATK around `BaseLevel/4 + STR + DEX/5
+ LUK/3`. *Revo-Classic* servers run Renewal formulas over classic-era content, so
they look like our target and compute like Renewal's. A search for "Ragnarok ATK
formula" returns the Renewal one by default; that is how the wrong formula nearly
landed here. The squared terms are the tell.

### Matches

| | Ragnarok pre-renewal | Ours |
|---|---|---|
| Status points, levels 1–99 | 1,225 earned, +48 at creation | 1,273 |
| Stat cost | `floor(stat/10) + 2` | same |
| Two 99s | costs 1,274 against a 1,273 budget | one point short, exactly |
| Melee ATK | `STR + floor(STR/10)² + floor(DEX/5) + floor(LUK/5)` | same |
| Bow ATK | DEX leads, STR pays a fifth | same |
| MATK | `INT + floor(INT/7)²` to `INT + floor(INT/5)²` | the midpoint |
| MaxHP / MaxSP | `× (1 + VIT/100)` / `× (1 + INT/100)` | same |
| Crit | `1 + LUK × 0.3` | same |
| SP recovery | driven by INT | same |
| Defence | VIT, never AGI | same |

### Not yet matched

- **HIT against FLEE.** Ragnarok resolves a swing as a contest:
  `HIT = 175 + BaseLv + DEX + floor(LUK/3)` against
  `FLEE = 100 + BaseLv + AGI + floor(LUK/5)`. We still roll a flat dodge fraction,
  and DEX buys accuracy nowhere. Phase 3.
- **The damage formula itself.** Ragnarok has no attack-power divisor: damage is
  weapon ATK plus status ATK against the target's DEF. `STATUS_AP_PER_DPS` is
  calibration holding the old balance in place, not the model. Phase 3.
- **Spell crit.** Pre-renewal magic cannot crit at all. Ours can, off a 5% base
  while melee crit sits at 1%. Phase 3.
- **Soft DEF.** `vitSoftDefence` (`floor(VIT/2)`, a flat subtraction) is written
  and unused: our `armor` is a percentage system, which maps to equipment DEF, and
  the flat half has nowhere to go until the damage formula exists. Phase 3.
- **Attribute magnitudes in content.** Mob affixes, enchants, and item stats were
  authored against a scale where a level-20 character had ~80 in an attribute.
  They have ~16 now. The four attribute-draining affixes were rescaled; the item
  and enchant tables have not been swept.

### Two deliberate deviations

**A new character starts on the class's suggested spread**, not on 1/1/1/1/1/1
with 48 points in hand. Ragnarok assumes the player places them before doing
anything; here an unallocated character cannot fight and there is no allocation
window yet. Every point is refunded by Reset, and the spread stops following a
character the moment they move a single point of it. Revisit once the status
window ships.

**Classes carry their own armor** (`baseArmor`/`armorPerLevel`), which Ragnarok
does not: there, DEF is overwhelmingly equipment. Ours went missing with the old
stat block, which had carried it as a sixth pseudo-attribute, and its absence made
a level-1 character lose to the starter wolf. It is not one of the six, so it does
not compromise the "attributes are the player's to spend" rule, but it is a
deviation and it should be reconsidered when equipment DEF is retuned.
