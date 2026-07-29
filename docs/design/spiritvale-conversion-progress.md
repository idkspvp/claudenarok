# SpiritVale conversion: progress

**This file is state, not prose.** The master `/goal` run reads it to find what
to do next and writes it back after every phase. Keep it accurate; if it lies,
the run repeats work or skips it.

Spec: `spiritvale-conversion-plan.md`. Systems and UI: `spiritvale-systems-and-ui.md`.

## Status

| Phase | What | Status | Landed at |
|---|---|---|---|
| 0 | Finish what is half-done: cut card duel, finish talent removal, simple aggro | DONE | 6a55c74..34da7ce |
| 1 | The stat core: six pure modules, no call sites | DONE | 6214a89..daa4ebd |
| 2 | Wire the stat core, retire the Ragnarok one | IN PROGRESS | |
| 3 | Progression: cap 150, attribute ladder, job pools, refund | NOT STARTED | |
| 4 | The seven base classes and the skill-tree window | NOT STARTED | |
| 5 | Statuses and passives as data | NOT STARTED | |
| 6 | Drops, artifacts, grimoires, gems, essence | NOT STARTED | |
| 7 | World shape and monster inspect | NOT STARTED | |
| 8 | The eight advanced classes and summons | NOT STARTED | |
| 9 | Retire what is left of WoC | NOT STARTED | |

Statuses: `NOT STARTED`, `IN PROGRESS`, `BLOCKED`, `DONE`.

## Per-phase notes

Written by the run as it goes. Anything the plan did not anticipate goes here,
not in the commit message alone, so the next phase inherits it.

### Phase 0
Job 1 of 3 landed: the card duel is gone (cc3fd43, goldens 393cbf3).

Two findings the plan did not anticipate, both corrected in the plan itself:

- The plan claimed twenty dead modules in src/sim/combat/. There are NONE. The
  original scan matched the `.../combat/<name>` import form and missed
  same-directory relative imports. A real import-graph walk from all 125 entry
  points finds one unreachable module, weapon_class_atk, and that one is a live
  content guard for three item-balance tests. It moves to phase 6, where the
  item model changes and it genuinely becomes wrong.
- The card-duel removal shifts the world-init entity sequence by one (the Card
  Master NPC), so all 50 parity goldens moved. The diff is 4,415 lines in and
  4,415 out, a pure one-for-one rewrite: an id shift, not a behavior change.

Job 2 landed (70e236c, 0d691d0, 34da7ce). D0-2 and D0-4 turned out to be already
done: no ability carries spec gating and no TalentModifiers type survives. What
was actually left was four DEEDS still wired to the retired trees through a
meter stubbed to zero and two flags stubbed false, so they were permanently
unearnable rather than retired; they are gone, with their crest art and their
two Steam achievements. Also stripped 81 stale "(Mage talent)" parentheticals
from ability descriptions and twenty comments citing modules deleted in D0.
D0-6 is closed by tests/legacy_talent_save.test.ts: the tolerance already held
by construction, but nothing proved it, so a save carrying the exact key set the
trees persisted is now pinned to load identical to a clean one.

Job 3 (M1c) is CANCELLED, not skipped. See the plan for the evidence: SpiritVale
keeps accumulated threat, so replacing the table with simple aggro would move
AWAY from the conversion target. The threat table stays; its modifiers get
retuned in phase 4 with the skills that carry ThreatMult and SkillThreat.

Baseline note for whoever picks this up: the suite carries 38 to 39 pre-existing
failing files unrelated to any of this, several flaky under parallel load and
one (server/static_sfx_serving) an EPERM on Windows. Always diff the failing SET
against a baseline worktree rather than reading the count.

### Phase 1
Six pure leaves under `src/sim/stats/`, 83 assertions, nothing wired. Phase 2
wires them one formula at a time.

  attack.ts         ATK melee + ranged, MATK, the DoT coefficient
  defence_curve.ts  100/(DEF+100)
  accuracy.ts       Hit, Flee, crit rate/damage/defence, perfect dodge
  attack_speed.ts   the 23-row weapon table, ASPD, cast speed, both caps
  resources.ts      Max HP, Max MP, both regen curves
  sustain.ts        healing, siphon, leech, reflect, status resist

Notes phase 2 needs:

- `defence_curve` is the bug fix, not a number change. Wire it FIRST, before
  attack: it removes the immunity cliff that the Fiesta augments fell off, and
  it makes every later damage comparison meaningful.
- Max HP clamps its quadratic term at level 130 under a cap of 150. That is in
  the source. Anyone retuning health at the cap will read it as a bug.
- The regen percentage stats enter halved on both sides, and apply a SECOND
  time in full on the mana side only. Both are pinned.
- Leech is a reserve, not a steal: a fifth of face value banked per hit, paid
  out at no more than a fifth of max health per second. Wiring it as
  instant lifesteal would be several times too strong.
- `accuracy` deliberately has no roll: it says how likely a hit is, and the
  caller draws the rng. Keep it that way so the parity draw order stays the
  caller's business.

## Decisions taken mid-run

When the run hits a genuine ambiguity, it picks the behavior-preserving reading
and records the assumption here with the phase it was made in. A later phase
that contradicts one of these must say so.

**Phase 0.** Deleted content rather than leaving it inert, in three places: the
card-duel deed, the four talent deeds, and their Steam achievements and crest
art. The alternative was to leave them wired to stubs returning zero and false,
which is what Phase D0 had already tried and is why they were still there. An
achievement a player can see and can never earn is worse than one that is gone.

**Phase 0.** Stripped the "(Mage talent)" parentheticals from the non-English
catalog rows too, even though the repo reserves locale fills for the maintainer.
Removing a phrase that describes a deleted system is a deletion, not a
translation, and leaving it would have shipped a Spanish description of a system
no Spanish-speaking player can reach.

## Blocked on

Anything that needs a human. Empty means the run can continue unattended.

(nothing)
