// Caster tier-set 2-piece: grants +20 spell power (mirroring the +40 attack power
// the melee 2-sets give) AND 100% cast-pushback immunity: damage taken never
// delays the wearer's cast timer (castPushbackReduction 1 makes pushbackCast a
// no-op). It is NOT physical knockback resistance; that entity stat still works
// (the applyKnockback suite below pins it) but no shipped set grants it.
import { describe, expect, it } from 'vitest';
import { aggregateSetBonuses, SET_NECROMANCERS } from '../src/sim/content/item_sets';
import { MOBS } from '../src/sim/data';
import { createMob, createPlayer, recalcPlayerStats } from '../src/sim/entity';
import { Sim } from '../src/sim/sim';
import { magicAttack } from '../src/sim/stats/attack';
import type { Entity, PlayerClass } from '../src/sim/types';
import { spreadAllocation } from './helpers/alloc';

const attrsOf = (e: {
  stats: { str: number; agi: number; vit: number; int: number; dex: number; luk: number };
}) => ({
  str: e.stats.str,
  agi: e.stats.agi,
  vit: e.stats.vit,
  int: e.stats.int,
  dex: e.stats.dex,
  luk: e.stats.luk,
});

const counts = (m: Record<string, number>) => new Map(Object.entries(m));

function statsFor(cls: PlayerClass, level: number, equipment: Record<string, string>): Entity {
  const e = createPlayer(0, cls, { x: 0, y: 0, z: 0 }, '');
  e.level = level;
  recalcPlayerStats(e, cls, equipment as any, undefined, {}, spreadAllocation(e.level));
  return e;
}

describe('caster set 2-piece bonus', () => {
  it('grants +20 spell power and 100% cast-pushback immunity at 2 pieces', () => {
    const two = aggregateSetBonuses(counts({ [SET_NECROMANCERS]: 2 }));
    expect(two.sp).toBe(20);
    expect(two.castPushbackReduction).toBe(1);
    expect(two.knockbackResistance).toBe(0); // spell pushback, never physical knockback
    // one piece: no 2-piece bonus yet
    const one = aggregateSetBonuses(counts({ [SET_NECROMANCERS]: 1 }));
    expect(one.sp).toBe(0);
    expect(one.castPushbackReduction).toBe(0);
  });

  it('folds the +20 spell power into the wearer, on top of gear', () => {
    const eq = { chest: 'necromancers_starshroud', feet: 'necromancers_soulsteps' };
    const withSet = statsFor('mage', 20, eq);
    expect(withSet.castPushbackReduction).toBe(1);
    // Neither piece carries flat spell power, so the 2-piece +20 is the whole
    // flat term. It is NOT simply added on top any more: the formula amplifies a
    // flat magic-attack term by (1 + INT/200) before the breakpoint, so a caster
    // with Intelligence gets more than twenty out of a twenty-point bonus. That
    // is exactly what recalcPlayerStats does, so the expectation says it the
    // same way rather than as an addition.
    expect(withSet.spellPower).toBe(
      Math.round(magicAttack({ level: withSet.level, attributes: attrsOf(withSet), flatMatk: 20 })),
    );
    // And the amplifier is real: the bonus is worth strictly more than its face
    // value to a caster who has spent on Intelligence.
    expect(withSet.spellPower).toBeGreaterThan(
      Math.round(magicAttack({ level: withSet.level, attributes: attrsOf(withSet) })) + 20,
    );
    const onePiece = statsFor('mage', 20, { chest: 'necromancers_starshroud' });
    expect(onePiece.spellPower).toBe(
      Math.round(magicAttack({ level: onePiece.level, attributes: attrsOf(onePiece) })),
    );
  });
});

describe('knockback resistance is honored (the fix)', () => {
  it('a fully-resistant target is not displaced and moves when resistance is removed', () => {
    const sim = new Sim({ seed: 7, playerClass: 'mage' });
    const p = sim.player;
    const src = createMob((sim as any).nextId++, MOBS.wild_boar, 5, {
      x: p.pos.x - 3,
      y: p.pos.y,
      z: p.pos.z,
    });

    // 100% resist: the shove is zeroed centrally, so the caster never moves.
    p.knockbackResistance = 1;
    const before = { x: p.pos.x, z: p.pos.z };
    const movedResisted = (sim as any).applyKnockback(src, p, 6);
    expect(movedResisted).toBe(0);
    expect(p.pos.x).toBe(before.x);
    expect(p.pos.z).toBe(before.z);

    // 0% resist: the same shove now displaces the target.
    p.knockbackResistance = 0;
    const movedUnresisted = (sim as any).applyKnockback(src, p, 6);
    expect(movedUnresisted).toBeGreaterThan(0);
    expect(p.pos.x === before.x && p.pos.z === before.z).toBe(false);
  });
});
