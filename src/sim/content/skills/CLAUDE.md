# src/sim/content/skills/ - the SpiritVale skill trees

Generated data. `index.ts` is the barrel and the only thing outside this
directory should import; `types.ts` is hand-written and reviewed; every
`*.generated.ts` comes from `npm run skills:content`
(`scripts/spiritvale/build_skills.mjs`) reading `docs/design/data/spiritvale-raw/`.

**Never hand-edit a `*.generated.ts`.** `tests/spiritvale_skills.test.ts`
regenerates and diffs, in the same shape as the wiki gate in `tests/guide.test.ts`.
To change content, change the raw data or the generator.

## The level convention, which is the whole game

Every published number is a `{base, per}` pair read at the skill's own level:

```
value(L) = base + per * L
```

**Not** `base + per * (L - 1)`. `src/sim/skills/scaling.ts` owns the arithmetic
and its header carries the four independent proofs. The short one: 105 of the
279 published skills have `dmg = {base: 0, per: > 0}`, and under the other
reading every one deals zero damage at level 1. Skill level 0 means NOT LEARNED
and reads as `base`, which is why the formula has no off-by-one to begin with.

## The join, which is not obvious from either raw file

- A class's `gridLayout` is keyed `"0".."3"`, each a 7-wide array of **engine
  ids**. A placement's engine id is `gridLayout[row-1][col-1]`, read off its own
  `position`.
- The `id` on the class-side record is a **display slug** and usually differs
  (`axe-quicken` is `TwohandQuicken`). Both are kept: `id` is the engine id every
  other record references, `slug` is for display and for resolving a
  `requirements` entry, which names its target by slug.
- `.skills` is keyed by engine id. `.passives` is keyed by a kebab slug and its
  key **never** equals the record's `id`; index it by `.id` or all 22 base
  passives silently vanish.

Cross-validated before the generator was written: the two independently exported
raw files agree on all 150 numbers they both publish (31 damage, 119
cost/cooldown, plus every `maxLevel`), with zero disagreements. That agreement is
what proves the grid join is the right one.

## Three traps the shape sets

- **Healing is NEGATIVE damage.** There is no heal field; `Heal` is
  `damage: {base: -0.25, per: -0.25}`. Clamping damage at zero deletes every heal
  in the game. `nonNegativeAt` exists for cooldowns and costs and is deliberately
  not applied to damage.
- **A self-targeted skill puts its buff in `statuses`, not `selfStatuses`.**
  `statuses` applies to the RESOLVED target, and for a `targetType: 'self'` skill
  that IS the caster. `selfStatuses` is the caster-side rider on a skill aimed at
  someone else.
- **`base` and `per` mean different things on a stackable status.** On a scaling
  one `base` is the flat part and `per` the per-level step; on a stackable one
  `base` is the per-STACK amount (`Vulnerability` is `+1%/stack`).

## The enum labels are DERIVED, not published

Nothing in the raw data names `targetType`, `castType` or `exclusiveType` or any
of their values. The labels in `types.ts` come from a full cross-tab of the 279
records plus per-value description evidence; the reasoning and the per-label
confidence live in `docs/design/spiritvale-coverage.md`. The strongest single
piece of evidence is that `castType` (how it is aimed) and `targetType` (who it
may affect) are orthogonal, and both cells a wrong labelling would fill are
empty: a Self skill is never given an aim mode that requires picking something,
70 times out of 70.

## Scope

This directory carries the **seven base trees** and their transitive closure: 67
active skills, 20 passives, the 20 skills a summoned pet knows, 60 statuses, 4
summons. The eight advanced trees, and the rest of the 185 statuses and 29
summons, arrive with them in a later phase. The generator computes the closure,
so adding an advanced tree to its base-class list is what pulls the rest in.
