# The `/goal` prompt for the SpiritVale conversion

Two prompts. Use the **master** one if you want to hand the whole conversion
over and check back later. Use the **single-phase** one if you want to watch a
specific phase closely.

Both are self-contained: a fresh session with no memory of the planning
conversation can run them.

## Why there is no honest "one run, everything done"

The conversion is ten phases: a 46-file removal, moving the level cap, 258
skills across seven trees, 185 statuses, 111 passives, 34 artifacts, 29 summons,
and a skill-tree window that does not exist yet. One unattended pass through all
of it would exhaust its context somewhere in the middle and leave the tree half
converted, which is the worst possible state.

The master prompt gets as close as is actually achievable: it is driven by a
**progress file** (`spiritvale-conversion-progress.md`), so it always knows what
is done, always finishes a phase before stopping, and always leaves the tree
green. Re-run the same prompt and it picks up where it left off. Run it three or
four times and the conversion is done.

That is the difference between "one command" and "one sitting". You get the
first.

---

## The master prompt

```
You are running a long, multi-session conversion. Read these three files first,
in this order:

  docs/design/spiritvale-conversion-progress.md   <- state: what is done
  docs/design/spiritvale-conversion-plan.md        <- the spec, ten phases
  docs/design/spiritvale-systems-and-ui.md         <- what survives, what goes

The four design decisions in the plan are settled. Do not re-open them.

HOW TO WORK

1. Read the progress file. Find the first phase whose status is not DONE.
2. Set it to IN PROGRESS, commit that, and start it.
3. Execute that phase COMPLETELY, per its section in the plan. Each logical
   piece is its own commit with a real body.
4. Run the phase's own "Accept:" check from the plan, then the full verify
   block below.
5. Update the progress file: status DONE, the commit range, and any note the
   next phase needs. Commit that.
6. Go back to step 1 and start the next phase.
7. Stop when either every phase is DONE, or you judge your remaining context
   will not fit another whole phase. NEVER stop in the middle of a phase. If
   you cannot finish one, revert to the last green commit and say so.

The single most important rule: the tree is green and pushed every time you
stop. A half-converted tree is worse than an unstarted one.

RULES YOU MUST FOLLOW (from CLAUDE.md, non-negotiable)

- src/sim/ stays DOM-free, Three-free, and imports nothing from
  render/ui/game/net. All randomness goes through Rng: never Math.random,
  Date.now or performance.now in sim logic.
- IWorld is the only seam. Adding or removing a member means doing it in the
  facet file under src/world_api/, in BOTH Sim and ClientWorld, and updating the
  pinned member list in tests/world_api_parity.test.ts in the SAME change.
- Module-first. New logic is its own small module behind an existing seam with
  its own Vitest. Never grow src/sim/sim.ts, src/ui/hud.ts, src/main.ts or
  src/render/renderer.ts; they are extraction targets, not homes.
- New sim SYSTEM behavior goes behind the SimContext seam. A SimContext member
  with zero consumers is dead scaffolding: remove it.
- New HUD component = a DOM-free pure core (registered in UI_PURE_CORES in
  tests/architecture.test.ts) plus a thin painter on the PainterHost seam.
- New game content is a declarative record in src/sim/content/, never a table
  inline in sim.ts.
- Update every pin that guards what you touched: tests/world_api_parity.test.ts,
  tests/architecture.test.ts, tests/deeds_content.test.ts,
  tests/snapshots.test.ts (ALL_DELTA_KEYS, sorted and count-pinned), and
  tests/parity/scenarios.ts.
- Parity goldens: regenerate ONLY with UPDATE_PARITY=1 npx vitest run
  tests/parity, in their own reviewed commit, LAST in that phase.
- Every player-visible string is a t() key, English only, in the matching
  src/ui/i18n.catalog/ module. Never edit src/ui/i18n.locales/ overlays. Never
  hand-edit a *.generated.ts; regenerate through its build step.
- Run npm run wiki:content when player-facing content changes.
- Never delete or rename a SHIPPED item id.
- No em dashes, no en dashes, no emojis anywhere: code, comments, docs, commits.
- Conventional Commits with a scope. EVERY commit carries a body of 1 to 4
  plain sentences saying what changed and why, wrapped near 72 columns.
- Never run bare npm install (use npm ci). Never git push --no-verify.

SOURCE OF TRUTH FOR EVERY NUMBER

docs/design/spiritvale-engine-formulas.md    the 37 formulas
docs/design/spiritvale-data-schema.md        every record shape
docs/design/spiritvale-world-and-economy.md  maps, spawns, drops, items
docs/design/data/spiritvale-raw/             the 27 raw JSON files
docs/design/data/spiritvale-monster-stats.tsv  all 319 monsters, computed

NEVER invent a formula or a balance number. If a value is not in those files,
it is listed as unknown in spiritvale-coverage.md; use the stand-in that file
names and record the assumption in the progress file.

VERIFY BEFORE MARKING A PHASE DONE

- npx tsc --noEmit
- npm test            (do not pipe through tail; it masks the exit code)
- npm run gate
- The phase's own "Accept:" line from the plan
- Invoke the qa-checklist agent over the phase's diff

WHEN YOU ARE GENUINELY STUCK

Pick the reading that preserves existing behavior, record the assumption in the
progress file under "Decisions taken mid-run", and keep going. Only write to
"Blocked on" and stop if proceeding either way would be unsafe or would make the
work useless if wrong.

REPORT WHEN YOU STOP

Which phases went DONE, the commit range for each, what the gate said, anything
the plan did not anticipate, and which phase is next.
```

---

## The single-phase prompt

Same thing, scoped. Use it when you want to watch a phase closely, or for
Phase 4 and Phase 6, which are the two worth supervising.

Take the master prompt above and change the HOW TO WORK block to:

```
HOW TO WORK

Execute Phase <N> of the plan, completely. Its section in
docs/design/spiritvale-conversion-plan.md is the spec. Each logical piece is its
own commit with a real body. Work autonomously; do not stop to ask permission
between pieces.

Update docs/design/spiritvale-conversion-progress.md when you finish.

STOP when Phase <N> is green and pushed. Do not start Phase <N+1>.
```

Everything else stays byte for byte. The RULES and VERIFY blocks are what stop
a long autonomous run from quietly breaking an invariant; do not trim them.

---

## Practical notes

**Expect three or four invocations.** Phases 0 through 3 are mechanical and may
well go in one run. Phase 4 is the biggest single job in the conversion (seven
skill trees plus a window that does not exist). Phase 6 is the highest value
(the artifact and grimoire loop). Phases 8 and 9 can wait indefinitely.

**Phase 1 is the one to test the workflow on** if you want to check the prompt
before trusting it: six pure modules with no call sites, nothing wired, cannot
break anything.

**Read the progress file between runs.** Its "Decisions taken mid-run" section
is where an autonomous run tells you what it had to guess. That is the part
worth your attention, more than the diffs.
