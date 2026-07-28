// Resolving the ability a piece of gear casts by itself.
//
// The one rule worth pinning: this resolver deliberately does NOT consult the
// wearer's known list. If someone ever "fixes" that by routing it back through
// the ordinary resolver, every auto-cast quietly stops firing for the classes
// the effect exists to surprise, and nothing else fails.

import { describe, expect, it } from 'vitest';
import { resolveAutoCastAbility } from '../src/sim/combat/auto_cast_ability';
import { ABILITIES } from '../src/sim/data';

describe('resolving an auto-cast', () => {
  it('resolves an ability from the table with no player at all', () => {
    const res = resolveAutoCastAbility('fireball');
    expect(res).not.toBeNull();
    expect(res?.def.id).toBe('fireball');
    expect(res?.effects).toBe(ABILITIES.fireball.effects);
  });

  it('costs nothing, casts instantly, and has no cooldown', () => {
    // The chance to fire IS the limiter: the item casts, not the wearer, so it
    // never spends the wearer's resource or occupies their cooldown.
    const res = resolveAutoCastAbility('fireball');
    expect(res?.cost).toBe(0);
    expect(res?.castTime).toBe(0);
    expect(res?.cooldown).toBe(0);
  });

  it('resolves at rank 1 even for an ability with higher ranks', () => {
    const ranked = Object.values(ABILITIES).find((a) => (a.ranks?.length ?? 0) > 0);
    expect(ranked).toBeDefined();
    expect(resolveAutoCastAbility(ranked!.id)?.rank).toBe(1);
  });

  it('carries the ability its own threat, not a made-up default', () => {
    const withThreat = Object.values(ABILITIES).find((a) => (a.threat?.flat ?? 0) > 0);
    expect(withThreat).toBeDefined();
    expect(resolveAutoCastAbility(withThreat!.id)?.threatFlat).toBe(withThreat!.threat?.flat);
    // An ability with no threat entry gets the neutral multiplier, not zero,
    // which would silently erase the damage-threat of everything it casts.
    const noThreat = Object.values(ABILITIES).find((a) => !a.threat);
    expect(resolveAutoCastAbility(noThreat!.id)?.threatMult).toBe(1);
  });

  it('returns null for an id that does not exist, rather than throwing', () => {
    // A content typo has to fail closed and silent here, because this runs
    // inside a swing.
    expect(resolveAutoCastAbility('no_such_ability')).toBeNull();
    expect(resolveAutoCastAbility('')).toBeNull();
  });
});
