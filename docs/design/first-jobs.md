# Collapsing nine classes onto five first jobs (D1)

The state of the branch, the decisions already made, and the exact remaining
work. Roadmap context: `roadmap.md`, Phase D. Companion to
`talent-removal.md`, which D0 followed and which this continues.

Branch: `feature/first-jobs`, worktree `E:/SpiritClaude-first-jobs`.

## The five, and where each comes from

| First job | From the old class | What has to change beyond the rename |
|---|---|---|
| **Swordman** | `warrior` | drop rage entirely (Ragnarok pays SP for everything) and the three stances |
| **Mage** | `mage` | drop the Chronomancy healer spec's kit; healing is the Acolyte's job |
| **Archer** | `hunter` | keep the bow and its 8yd dead zone; drop the pet (the Falcon belongs to Hunter, a 2-1) |
| **Acolyte** | `priest` | drop the shadow-damage spec; Ragnarok has no caster-DPS Acolyte |
| **Thief** | `rogue` | drop energy AND combo points; both pay SP instead |

Cut outright: `paladin`, `shaman`, `warlock`, `druid`. Paladin returns as
**Crusader** when second jobs land. Shaman, Warlock, and Druid are deferred to a
later update by decision, not by oversight.

**`hunter`, `rogue`, and `priest` are ALSO second-job ids** that already exist in
`content/jobs.ts` (Hunter is 2-1 of Archer, Rogue is 2-2 of Thief, Priest is 2-1
of Acolyte). This is the single biggest hazard in the rename: see below.

## Already done on this branch

- **`src/sim/job_vitals.ts`** carries Ragnarok's real HP and SP curves and their
  per-job coefficients, with tests. HP is QUADRATIC in level and SP is linear;
  the universal floors are 35 HP and 10 SP, which is why every character has
  exactly 40 HP at level 1 whatever they picked. Not yet wired: `ClassDef` still
  carries the old linear `baseHp`/`hpPerLevel` pair.
- **`content/jobs.ts`** is down to fifteen: five first jobs, each a ROOT with
  `from: null`, and their ten second jobs. Novice, Super Novice, and the whole
  Merchant branch are gone, and one test pins all five as absent.
- **The status-point cost curve is corrected.** It overcharged by a point at
  every multiple of ten; Ragnarok's band opens one ABOVE the round number.
- **Auto-allocation is gone.** `stat_preset.ts` and its per-class weight table
  are deleted. A character carries 1 in each attribute with every point unspent,
  a level-up adds unspent points, and a save with no allocation gets a free full
  respec. `tests/helpers/alloc.ts` (`spreadAllocation`, `levelWithStats`) is how
  a suite asks for a character with real attributes.

## The rename, and the trap in it

`PlayerClass` literals across `src/`, `server/`, `headless/`, and `tests/`:

    warrior 2,640 · mage 928 · rogue 394 · druid 247 · priest 242
    hunter 238 · paladin 205 · shaman 173 · warlock 157

**Roughly 5,200 sites.** A blind find-and-replace will corrupt the job tree:
rewriting `'rogue'` to `'thief'` also rewrites `id: 'rogue'` in `content/jobs.ts`
and its test, which are the SECOND job of that name. Exclude
`src/sim/content/jobs.ts` and `tests/jobs.test.ts` from any global pass, and
check `docs/` too.

Three renames collide this way: `rogue`, `hunter`, `priest`. `warrior` to
`swordman` and `mage` to `mage` (unchanged) are safe.

The namespaces stay separate on purpose: `PlayerClass` only ever holds FIRST job
ids, and second jobs live in `jobs.ts` as an advancement, not as class members.
That is what keeps every `Record<PlayerClass, X>` table at five entries forever
instead of growing to fifteen.

## Remaining work, in order

1. **The rename and the union collapse.** `PlayerClass` to the five ids; every
   `Record<PlayerClass, X>` table (class details, starting gear, icons, colours,
   i18n catalogs); ability `class:` fields; item `requiredClass`; the three
   hardcoded HTML pickers and both server validation lists. This is the stretch
   where the tree does not compile, so do not stop inside it.
2. **Wire `job_vitals`** into `recalcPlayerStats`, replacing `baseHp +
   hpPerLevel * (level - 1)` with the quadratic curve. The attribute multipliers
   (`1 + VIT/100`, `1 + INT/100`) already sit at the call site and stay.
3. **Remove level-scaled armour.** Both `baseArmor`/`armorPerLevel` AND
   `s.armor += s.vit * 2`. Ragnarok's hard DEF comes from equipment only, and
   the Vitality term is a DOUBLE COUNT: Vitality already buys soft DEF, the flat
   subtraction in `combat/defence.ts`. Expect the reachable armour ceiling to
   fall from about 4,200 to about 2,560 and a fresh character to sit at 0 DEF,
   which is correct and will feel very different.
4. **Character creation** reads `JOBS` instead of the three hardcoded `.mini-class`
   blocks (`index.html` twice, `play.html` once) and the two hardcoded server
   lists (`server/characters.ts` `VALID_CLASSES`, `server/main.ts`
   `validClasses`, which must move in lockstep). Add a `startable` flag to
   `JobDef` so the picker derives from data and the next job addition is one row.
5. **Archive the cut classes' characters.** Move `paladin`/`shaman`/`warlock`/
   `druid` rows to an archive table with their JSON intact, rather than keeping
   four dead members in every per-class table. Keeping them in code looks cheaper
   until the skill re-home (D4) leaves those characters loading with no kit at
   all, which is broken quietly rather than loudly. DDL is additive and
   idempotent, per `server/CLAUDE.md`.
6. **`ip_scrub` and `NAME-MAP.md`.** Every renamed class goes through
   `tests/ip_scrub.test.ts`, and `ip-refactor/NAME-MAP.md` is append-only.
7. **Regen and gate.** `npm run wiki:content`, the parity goldens
   (`UPDATE_PARITY=1`, own commit), then the full suite against the recorded
   baseline plus `tsc` and `npm run ci:changed`.

## Known-red, and why

- **`tests/spell_power.test.ts`** asserts things like "a pure-melee rogue has far
  less spell power than a caster". That is no longer true of anything: class does
  not determine attributes any more, the player's spending does. Those cases need
  class-appropriate allocations passed in explicitly, or reframing.
- **`tests/mob_enervate.test.ts`**, one case. The suite was given
  `levelWithStats` and the drain still reads as zero; not yet diagnosed.
- **`tests/ability_tooltip_consistency.test.ts`** is red on `main` too. Ability
  descriptions cite numbers that the critical-strike and damage changes made
  stale (for example Berserker Stance still claims criticals "hit for 3% more",
  and criticals no longer multiply at all). It wants a descriptions sweep, which
  belongs with the skill re-home.
- **`tests/heroic_difficulty_floors.test.ts`**, three cases, carried from C3 and
  recorded in `ro-reference-source.md`.

## Environment note

A fresh worktree has no `node_modules`, and a directory junction to the main
tree's does NOT work: Vite refuses to serve files from outside the worktree root
and every jsdom suite fails to load with a `/@fs/` error. Run `npm ci` in the
worktree (never a bare `npm install`), or move a `node_modules` from a worktree
whose branch is already merged.
