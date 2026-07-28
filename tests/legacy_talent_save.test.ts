// A character saved before Phase D0 still carries the talent keys the trees
// wrote into its JSONB state: a spec, a point pool, spent rows, and named
// loadouts. Nothing reads them any more, which is exactly why they are worth a
// test: the tolerance is a property of the loader picking named fields, not of
// a migration anyone wrote, so it can be broken silently by any future change
// that starts validating the save shape.
//
// This pins the promise D0-6 makes: an old save loads, and the legacy keys
// change nothing about the character that comes back.

import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';

// The exact key set the retired trees persisted. Kept as a literal rather than
// derived from a type, because the type is gone: this IS the historical record.
const LEGACY_TALENT_KEYS = {
  spec: 'fury',
  talentPoints: 6,
  talents: { row1: 'sudden_death', row2: 'battle_trance', row6: 'bladestorm' },
  talentLoadouts: [
    { name: 'raid', spec: 'fury', talents: { row1: 'sudden_death' } },
    { name: 'pvp', spec: 'arms', talents: { row1: 'improved_charge' } },
  ],
  talentSpecChosen: true,
  talentCapstone: true,
};

function makeSim(): Sim {
  return new Sim({ seed: 7, playerClass: 'swordman', noPlayer: true });
}

// The minimum a load path needs; anything beyond this is what the test varies.
// Cast at the call site rather than typed here: the point of these tests is to
// hand the loader a shape it does NOT declare (the retired talent keys), so a
// declared CharacterState would defeat the exercise.
const baseState = (level: number) => ({ level, inventory: [] });

describe('a character saved before the talent trees were retired', () => {
  it('loads, and the legacy talent keys change nothing', () => {
    const sim = makeSim();
    const clean = sim.addPlayer('swordman', 'Clean', { state: baseState(12) as never });
    const legacy = sim.addPlayer('swordman', 'Legacy', {
      state: { ...baseState(12), ...LEGACY_TALENT_KEYS } as never,
    });

    const a = sim.entities.get(clean);
    const b = sim.entities.get(legacy);
    expect(a, 'the control character loaded').toBeTruthy();
    expect(b, 'the legacy-save character loaded').toBeTruthy();
    if (!a || !b) return;

    // Same class and level in, so every derived number must match. If a legacy
    // key were still being read anywhere, this is where it would show.
    expect(a.maxHp, 'the control character has a real HP pool').toBeGreaterThan(0);
    expect(b.level).toBe(a.level);
    expect(b.maxHp).toBe(a.maxHp);
    expect(b.maxResource).toBe(a.maxResource);
    expect(b.stats).toEqual(a.stats);
    expect(b.sharedCritBonus).toBe(a.sharedCritBonus);
  });

  it('grants the legacy save no ability the control character does not have', () => {
    // The trees granted abilities. A save that still names six spent rows and a
    // capstone must not resurrect any of them.
    const sim = makeSim();
    const clean = sim.addPlayer('swordman', 'Clean2', { state: baseState(20) as never });
    const legacy = sim.addPlayer('swordman', 'Legacy2', {
      state: { ...baseState(20), ...LEGACY_TALENT_KEYS } as never,
    });

    const known = (pid: number) =>
      [...(sim.players.get(pid)?.known ?? [])]
        .map((k) => (typeof k === 'string' ? k : k.def.id))
        .sort();
    // Guard against a vacuous pin: if both sides resolved to an empty list this
    // assertion would pass while proving nothing.
    expect(known(clean).length, 'the control character knows abilities').toBeGreaterThan(0);
    expect(known(legacy)).toEqual(known(clean));
  });

  it('earns no deed from the legacy talent flags', () => {
    // The four talent deeds are gone. A save carrying talentSpecChosen and
    // talentCapstone must not earn anything from them, and must not throw while
    // the deed evaluator walks a state holding keys it no longer knows.
    const sim = makeSim();
    const pid = sim.addPlayer('swordman', 'LegacyDeeds', {
      state: { ...baseState(20), ...LEGACY_TALENT_KEYS } as never,
    });
    const earned = sim.players.get(pid)?.deedsEarned;
    // Non-empty on purpose: a level-20 character has already earned several
    // deeds, so the four .has() checks below run against a real ledger.
    expect(earned, 'the deed ledger exists').toBeInstanceOf(Map);
    expect(earned?.size, 'and has earned something').toBeGreaterThan(0);
    for (const id of ['prog_talented', 'prog_specialized', 'prog_deep_roots', 'prog_full_build']) {
      expect(earned?.has(id), `${id} is gone and must not be earned`).toBe(false);
    }
  });
});
