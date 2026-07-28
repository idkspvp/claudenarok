# The `/goal` prompt for the SpiritVale conversion

Copy the block below into `/goal`. It is written to be self-contained: a fresh
session with no memory of this conversation can run it end to end.

Run it one phase at a time. Do NOT paste the whole thing and expect ten phases in
one sitting; the prompt tells the agent to stop at a phase boundary, and that is
deliberate, because each phase changes what the next one should look like.

---

## The prompt

```
Read docs/design/spiritvale-conversion-plan.md and
docs/design/spiritvale-systems-and-ui.md first. They are the spec. The four
design decisions in the plan are settled; do not re-open them.

GOAL: execute Phase 0 of the SpiritVale conversion, completely, and leave the
tree green and pushed.

Phase 0 is three jobs. Do them in this order, each as its own commit:

1. Cut the card duel minigame entirely. It spans about 46 files. Follow the
   removal all the way through: src/sim/social/card_duel.ts and
   card_duel_queue.ts, src/sim/minigames/card_hand.ts,
   src/sim/instances/card_master.ts, src/sim/content/card_master.ts, the
   SimContext members, the IWorld facet src/world_api/card_minigame.ts, the
   server WS commands in server/game.ts, the ClientWorld mirror in
   src/net/online.ts, the UI (src/ui/card_duel_window.ts, card_duel_view.ts,
   its hud.ts wiring, npc_services_view.ts), the NPC in
   src/sim/content/zone1/npcs.ts and its placement in eastbrook_layout.ts, the
   deeds in src/sim/content/deeds.ts, the i18n keys, and the six card_duel test
   files. Keep the shipped item ids: never delete or rename one.

2. Finish the talent removal. The open pieces are D0-2 (drop spec gating on
   abilities), D0-4 (remove the TalentModifiers plumbing), D0-5 (remove the
   IWorld facet, commands and UI), D0-6 (tolerate talent data on old saves), and
   D0-7 (tests, guide regen, parity, gate).

3. Replace the threat table with simple aggro (task M1c). Simple means: a mob
   attacks whoever most recently damaged it, with a stickiness window, and no
   accumulated threat number. Extract it as its own module behind the
   SimContext seam with its own Vitest; do not grow sim.ts.

RULES YOU MUST FOLLOW (from CLAUDE.md, non-negotiable):
- src/sim/ stays DOM-free, Three-free, and imports nothing from
  render/ui/game/net. All randomness goes through Rng: never Math.random,
  Date.now or performance.now in sim logic.
- IWorld is the only seam. Removing a member means removing it from the facet
  file under src/world_api/, from BOTH Sim and ClientWorld, and updating the
  pinned member list in tests/world_api_parity.test.ts in the SAME change.
- Removing a SimContext member means removing every consumer. A member with
  zero consumers is dead scaffolding.
- Update the pins that guard what you touched: tests/world_api_parity.test.ts,
  tests/architecture.test.ts, tests/deeds_content.test.ts (the deed catalogue),
  tests/snapshots.test.ts (ALL_DELTA_KEYS, sorted and count-pinned), and
  tests/parity/scenarios.ts.
- Parity goldens: regenerate ONLY with UPDATE_PARITY=1 npx vitest run
  tests/parity, in their own reviewed commit, and make it the LAST commit on
  the branch.
- Every player-visible string is a t() key. Removing a surface removes its keys
  from the matching src/ui/i18n.catalog/ module. Never edit
  src/ui/i18n.locales/ overlays, and never hand-edit a *.generated.ts.
- Run npm run wiki:content if player-facing content changed (guide freshness is
  gated by tests/guide.test.ts).
- No em dashes, no en dashes, no emojis anywhere: code, comments, docs, or
  commit text.
- Conventional Commits with a scope, and EVERY commit carries a body of 1 to 4
  plain sentences saying what changed and why, wrapped near 72 columns.
- Never run bare npm install (use npm ci). Never git push --no-verify.

VERIFY BEFORE YOU CALL IT DONE:
- npx tsc --noEmit
- npm test  (do not pipe it through tail, that masks the exit code)
- npm run gate
- Invoke the qa-checklist agent over the finished diff.

Work autonomously and do not stop to ask permission between the three jobs. If
something is genuinely ambiguous, pick the reading that preserves existing
behavior, write down the assumption in the commit body, and keep going.

Report at the end: what landed, what the gate said, and anything you found that
the plan did not anticipate.

STOP when Phase 0 is green and pushed. Do not start Phase 1.
```

---

## For the phases after this one

Same prompt, three substitutions:

1. Change `Phase 0` to the phase number in both the GOAL line and the STOP line.
2. Replace the numbered job list with that phase's section from
   `spiritvale-conversion-plan.md`.
3. Keep the RULES and VERIFY blocks byte for byte. They are what stops a long
   autonomous run from quietly breaking an invariant.

Phase 1 is the easiest to hand off and the best one to test this workflow on:
six new pure modules with no call sites, each with its own Vitest, nothing
wired. It cannot break anything, and if the agent gets it right the same prompt
shape will carry the rest.

Phase 4 (the seven base classes and the skill-tree window) and Phase 6 (the
artifact and grimoire loop) are the two that deserve a checkpoint partway
through rather than a single unattended run.

## One thing to add by hand each time

The plan says every phase ends green and states its own acceptance check. Paste
that phase's **Accept:** line into the prompt verbatim, under VERIFY. It is the
difference between "the tests pass" and "the thing I asked for actually works".
