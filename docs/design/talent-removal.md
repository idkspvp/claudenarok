# Removing the talent and spec system (D0)

The recipe, the decisions already made, and the exact remaining work. Written
after running the removal twice and restoring both times, so none of it has to be
re-derived. Roadmap context: `roadmap.md`, Phase D.

Ragnarok has no specialization concept and its skills are a point-buy tree, so
the 27 specs, their masteries, and `spec_baselines` all go. Everything class
shaped in Phase D routes around this system until it is gone, which is why it is
first.

## Already done

- **`src/sim/player_modifiers.ts`** exists and is committed. The effect
  vocabulary, `ResolvedAbilityMod`, `Role`, and the accumulator moved there,
  renamed off the talent flavour (`TalentModifiers` to `PlayerModifiers`,
  `TalentEffect` to `ModifierEffect`). It knows nothing about talents.
  It is NOT dead scaffolding: the Fiesta augment system is built on the same
  effect shape and the same accumulator, with `talentMods` threaded through ten
  files. Fiesta is being kept as a base for future content, so the vocabulary
  stays.
- **The 28 spec signatures are re-homed.** Each spec's defining move (Maiming
  Strike, Shield Slam, Holy Shock, Chain Heal, Swiftmend, Pyrelance, Ice Lance
  and the rest) was reachable only through its spec and is now on its class's
  ability list.

## The files to delete (23)

    src/sim/content/  talents.ts talents_warrior.ts talents_classic.ts
                      spec_baselines.ts choice_rows.ts choice_rows_classic.ts
                      talent_abilities_v2.ts talent_abilities_v2_a.ts
                      talent_abilities_v2_b.ts talent_rows.ts warrior_rows.ts
    src/sim/          progression/talents.ts talent_save_migration.ts
                      talent_loadouts.ts talent_allocation_input.ts
                      combat/talent_procs.ts
    src/world_api/    talents.ts
    src/ui/           talents_view.ts talents_window.ts talent_i18n.ts
                      talent_icons.ts talent_tree_fit.ts talent_body_fit.ts

`talent_abilities_v2*` holds about 45 abilities that exist ONLY as talent grants
(Divine Shield, Avenging Wrath, Cloak of Shadows, Preparation, Bloodlust,
Tranquility). They go WITH the system rather than being re-homed: they are the
most WoW-shaped abilities in the game and none survives the Ragnarok skill pass.
That is the opposite call from the 28 signatures above, and the difference is
that a signature is a class's core identity while these are talent extras.

The six `src/ui/talent*` modules are the only UI deleted. Every other window is
untouched. The talent tree window's node-grid layout is close to what a Ragnarok
skill tree needs, so recover it from git history when D6 builds that window
rather than trying to keep it compiling in the meantime.

## Decisions already made

- **Spec gates on abilities are deleted, not resolved to their no-spec answer.**
  A spec-gated ability was HIDDEN until its spec was committed, so a player with
  no spec saw none of them. Keeping that answer would delete the mage's whole
  Fire and Frost kits. With specs gone the class simply gets its whole list,
  which is also Ragnarok's shape: the skill tree decides what you buy, not what
  exists.
- **The Dungeon Finder needs no new design.** `compatibleFinderRoles` already
  falls back to a fixed class-capability table (`FINDER_PRE_SPEC_ROLES`) below
  the spec unlock level. With specs gone that table becomes the answer at every
  level; drop the `specRole` parameter and the `FIRST_TALENT_LEVEL` branch.
- **The proc hooks are deleted at the call site.** Every proc in the game was a
  talent node's `ProcDef`, so the hooks call into an empty table. Six imports and
  about a dozen call sites in `combat/`.
- **The `talentPoints` deed meter reads zero** rather than being removed, so any
  deed still wired to it cannot progress instead of failing to load.

## Remaining work, measured

Applying the deletion, repointing every import at `player_modifiers`, unwiring
`classes.ts`, and removing the proc hooks leaves **100 source errors**:

| File | Errors | What |
|---|---|---|
| `src/ui/hud.ts` | 40 | the talent window's wiring |
| `src/sim/sim.ts` | 14 | talent imports, the command methods, save fields |
| `src/net/online.ts` | 12 | the ClientWorld talent mirror |
| `src/sim/social/chat_readouts.ts` | 5 | the `/talents` chat readout, delete it |
| `server/character_sheet.ts` | 4 | talent fields on the sheet |
| `hotbar.ts`, `char_window.ts`, `guide/class_view.ts`, `social/fiesta.ts` | 3 each | |
| `headless/protocol.ts`, others | 2 or fewer | |

Plus roughly 200 errors across about 40 test files, most of which are talent
suites that get deleted outright.

`abilitiesKnownAt` loses its third parameter, so all eight call sites drop an
argument. Watch the replacement: a regex over `abilitiesKnownAt(a, b, c)` whose
third group is `[^)]+` stops at the first inner `)` and leaves an unbalanced
paren on `fiesta.ts` line 246, which passes `ctx.playerMods(meta)`. That has now
bitten twice. Match the argument as a balanced expression, or fix that one line
by hand.

## The PlayerMeta surgery (step 2, the part that has to be planned)

`PlayerMeta` (`src/sim/sim.ts`, around line 1096) carries the talent state, and
every field has to be resolved before the tree compiles again. Counts are across
`src/`, `server/`, and `headless/`:

| Field | Sites | Resolution |
|---|---|---|
| `talents: TalentAllocation` | 18 | delete |
| `talentMods: PlayerModifiers` | 22 | RENAME to `mods`, value is always `emptyModifiers()`; Fiesta augments still merge on top |
| `loadouts: SavedLoadout[]` | 3 | delete |
| `activeLoadout: number` | 14 | delete |
| `fiestaRestore` | 19 | keep, but drop its `talents` member |

`fiestaStandardize` / `fiestaRestoreChar` (`social/fiesta.ts`) snapshot and
restore the allocation as well as level and xp. They keep the level and xp
snapshot and lose the allocation. `mergeAugmentMods(base, augIds)` keeps working
unchanged: its `base` simply becomes the empty modifier value.

**Old saves need no migration path.** `CharacterState.talents`, `.loadouts`, and
`.activeLoadout` are already OPTIONAL (they were added after the format shipped),
and the column is JSONB, so removing the type members and the reads leaves the
stored fields simply unread. That is D0-6, and it is free.

## Order

1. Delete the 23 files; repoint imports at `player_modifiers`; unwire
   `classes.ts`; remove the proc hooks. (Scripted; about 15 minutes.)
2. Sim core: `sim.ts`, `chat_readouts.ts`, `fiesta.ts`, `deeds.ts`.
3. Seam and wire: `world_api`, the commands, `net/online.ts`, server dispatch,
   `character_sheet.ts`, `headless/protocol.ts`.
4. UI: `hud.ts`, `char_window.ts`, `hotbar.ts`, `guide/class_view.ts`.
5. Tests, the old-save tolerance, wiki regen, parity regen, the full gate.

Steps 2 and 3 together are the point where the tree compiles again. It does not
compile in between, so do not stop inside them.
