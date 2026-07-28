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
  exactly 40 HP at level 1 whatever they picked. WIRED (D1.2): `recalcPlayerStats`
  reads both curves by job id and `ClassDef` no longer carries a vitals pair.
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

## D1, as landed

All seven steps are done on `feature/first-jobs`. What each one actually took:

1. **The rename and the union collapse.** About 5,200 sites across `src/`,
   `server/`, `headless/`, and `tests/`. `PlayerClass` is now the five ids. The
   four cut classes took their kits with them: 96 ability definitions, their
   committed skill-icon art (`public/ui/skills/<class>/`), their guide stills,
   their `player_<class>` render visual keys, and the suites that existed only to
   exercise them. Demon Heal and the shapeshift bar pages now gate on the PET and
   the FORM AURA rather than on an owner class id, so both are simply unreachable
   instead of naming a class that is gone.
2. **`job_vitals` is wired** into `recalcPlayerStats`, both curves.
3. **Level-scaled armour and the Vitality double count are gone.**
   `REACHABLE_ARMOR_CEILING` moved 4,200 to 2,560 and a fresh character sits at 0.
4. **Character creation reads `JOBS`.** `JobDef.startable` is the flag; the three
   `.mini-class` blocks are empty containers filled by `src/ui/class_picker.ts`
   from a DOM-free core, and both server lists derive from `startableJobs()`.
5. **Saved characters migrate at boot** (`server/first_jobs_migration_db.ts`): the
   four renamed ids are rewritten in place, the four cut ones move to
   `archived_characters` with their JSONB intact. Additive, idempotent, and the
   copy and the delete share the advisory-locked boot transaction.
6. **`ip_scrub` is green** and `NAME-MAP.md` carries the class-id appendix.
7. **Regenerated**: wiki content, sitemap, i18n bundles, and the parity goldens
   (own commit, last on the branch).

## What D1 hands to D4, and why

Two of the three are consequences of step 2 that step 2 could not fix by itself.

- **Ability costs are on the wrong scale, and casters cannot cast.** The SP pool
  is Ragnarok's now: a level-20 Mage carries 130 SP where it carried 1,228, and a
  level-6 Acolyte carries 40 against a 45 SP Lesser Heal. The COST table is still
  authored against the old pool, so the kit has to be re-costed against the real
  curve. Until then `tests/helpers/sp.ts` `raisePool()` marks every case whose
  subject is a mechanic rather than a pool; deleting that helper is how D4 knows
  it is finished. Owner decision (2026-07-28): wire both curves now and take the
  regression rather than half-wire the module.
- **Absorb and potion magnitudes are on the wrong scale too**, for the same
  reason: a rank-1 mage barrier is now worth more than half a level-7 health bar.
  One ratio assertion in `tests/mage_barrier_scaling.test.ts` is retired in place
  rather than re-pinned at a number that would pin the mismatch instead of a rule.
- **Orphaned content keeps its ids.** The feral two-handers, the Stormcaller mail
  line, and Pearlward Aegis survive with an empty `requiredClass`, which
  `canEquipItem` reads as nobody rather than everybody. A shipped item id is never
  deleted or renamed; re-homing them onto a job that can use them is D4 work. Same
  for the 12 class/spec pairs the dev-kit table lost, and for the demon-pet
  plumbing (`content/warlock_pets.ts`, `createDemonPet`), unreachable but intact.

Three claims are RETIRED rather than re-pointed, and say so where they lived: no
live ability folds Spell Power per channel tick, no live ground AoE pulses on
cast, and the healer mana-efficiency band has no peers left to form a band with.

## Blocked on another branch

`src/sim/job_aspd.ts` lives on `feature/magic-defence`, not here. Its own comment
asks for `AspdJob` to become an alias of `PlayerClass` once the collapse lands,
plus a test pinning `ASPD_JOBS` against the class list. The collapse HAS landed,
so that edit is unblocked the moment the two branches meet; it could not be made
from this branch without creating a second copy of that file.

## Known-red, and why

The list below was RE-MEASURED at the D1 base commit (`afb1dbf`) by checking that
commit out in the worktree and running the full suite, rather than carried
forward. It is 28 files / 109 cases, wider than the four groups this section used
to name, and D1 leaves it unchanged: every file here is red on the base too.

Take a fresh baseline the same way before judging a later change. `npx vitest run
--maxWorkers=4` on a detached checkout of the base, then diff the failing-file
list against the branch; anything not on the base list is yours.

The four originally-recorded groups, all still red for their recorded reasons:

- **`tests/spell_power.test.ts`** (3) asserts things like "a pure-melee thief has
  far less spell power than a caster". That is no longer true of anything: class
  does not determine attributes any more, the player's spending does. Those cases
  need class-appropriate allocations passed in explicitly, or reframing.
- **`tests/mob_enervate.test.ts`** (1). The suite was given `levelWithStats` and
  the drain still reads as zero; not yet diagnosed.
- **`tests/ability_tooltip_consistency.test.ts`** (2) is red on `main` too.
  Ability descriptions cite numbers the critical-strike and damage changes made
  stale (Berserker Stance still claims criticals "hit for 3% more", and criticals
  no longer multiply at all). It wants a descriptions sweep, which belongs with
  the skill re-home.
- **`tests/heroic_difficulty_floors.test.ts`** (3), carried from C3 and recorded
  in `ro-reference-source.md`.

The rest of the base-red set, which the four groups did not mention:

- **The parity goldens** (`tests/parity/parity.test.ts`, 51) are stale ON THE
  BASE: D0 changed sim behaviour without re-minting them. D1 re-mints, so this
  group goes green on the branch and is the one place the branch is BETTER than
  its base. Anything still red there after a re-mint is a real regression.
- **The asset and tooling suites**: `sfx_studio` (12), `build_assets_cli` (4),
  `prod_cpu_monitor` (5), `eastbrook_*` (9 across five files),
  `sfx_export_bundle`, `sfx_overlay`, `sfx_playback_profile`,
  `render_glb_replacement_assets`, `world_auth_scripts`, `asset_pipeline`,
  `server/static_sfx_serving` (1 each). These want tooling or generated media the
  worktree does not have; they are environment-red, not content-red.
- **`tests/server/new_endpoint.test.ts`** (2), the TypeScript dual-alias pins.
- **`tests/i18n_status_registry.test.ts`** (2), `tests/localization_fixes.test.ts`
  (1), `tests/character_sheet.test.ts` (1), `tests/env_protocol.test.ts` (2),
  `tests/fixes.test.ts` (3).

## Environment note

A fresh worktree has no `node_modules`, and a directory junction to the main
tree's does NOT work: Vite refuses to serve files from outside the worktree root
and every jsdom suite fails to load with a `/@fs/` error. Run `npm ci` in the
worktree (never a bare `npm install`), or move a `node_modules` from a worktree
whose branch is already merged.
