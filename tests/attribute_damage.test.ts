// The three classifications, combined and applied.
//
// The unit half pins that size and element stay SEPARATE terms (they scale
// different things and folding them loses that), and the integration half proves
// the chart actually reaches a swing: a fire monster really does shrug off a fire
// weapon in the live sim, not just in the table.

import { describe, expect, it } from 'vitest';
import {
  attributeDamageMultiplier,
  attributeMultipliers,
} from '../src/sim/combat/attribute_damage';
import { meleeSwing } from '../src/sim/combat/auto_attack';
import { MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';
import { Sim } from '../src/sim/sim';
import type { Entity } from '../src/sim/types';

describe('the combined multiplier', () => {
  it('is the even trade when nothing is classified', () => {
    // Every existing monster and weapon is unclassified until authored, and must
    // fight exactly as it did before the chart arrived.
    const m = attributeMultipliers({});
    expect(m.size).toBe(1);
    expect(m.element).toBe(1);
    expect(m.total).toBe(1);
    expect(m.absorbs).toBe(false);
  });

  it('keeps size and element as separate terms', () => {
    // They scale different things: size scales the weapon's contribution, element
    // scales the whole hit. A caller that only ever sees `total` cannot tell a
    // player WHY a hit was small, which is most of the mechanic's teaching value.
    const m = attributeMultipliers({
      weaponType: 'dagger',
      defenderSize: 'large',
      attackElement: 'fire',
      defenderElement: 'earth',
    });
    expect(m.size).toBeLessThan(1); // a dagger glances off a large target
    expect(m.element).toBeGreaterThan(1); // fire still beats earth
    expect(m.total).toBeCloseTo(m.size * m.element, 10);
  });

  it('reports an absorbing hit rather than hiding it in a negative total', () => {
    const m = attributeMultipliers({
      attackElement: 'fire',
      defenderElement: 'water',
      defenderElementLevel: 4,
    });
    expect(m.absorbs).toBe(true);
    expect(m.total).toBeLessThan(0);
  });

  it('is symmetric in neither direction: the chart is not a wash', () => {
    const fireOnEarth = attributeDamageMultiplier({
      attackElement: 'fire',
      defenderElement: 'earth',
    });
    const earthOnFire = attributeDamageMultiplier({
      attackElement: 'earth',
      defenderElement: 'fire',
    });
    expect(fireOnEarth).toBeGreaterThan(1);
    expect(earthOnFire).toBeLessThan(1);
  });
});

describe('the chart reaches a real swing', () => {
  function hit(opts: {
    element?: Entity['element'];
    elementLevel?: Entity['elementLevel'];
    size?: Entity['size'];
    weapon?: { weaponType?: 'dagger' | 'spear'; element?: 'fire' | 'water' };
  }): number {
    const sim = new Sim({ seed: 7, playerClass: 'swordman' });
    const p = sim.player;
    p.hp = p.maxHp = 100000;
    const target = createMob((sim as any).nextId++, MOBS.forest_wolf, 5, { ...p.pos });
    target.maxHp = target.hp = 1_000_000;
    target.stats = { ...target.stats, armor: 0 };
    target.element = opts.element;
    target.elementLevel = opts.elementLevel;
    target.size = opts.size;
    (sim as any).addEntity(target);
    if (opts.weapon) p.weapon = { ...p.weapon, ...opts.weapon };
    const before = target.hp;
    // cannotBeDodged so the reading is the damage line, not the hit table.
    meleeSwing(sim.ctx, p, target, 0, null, { cannotBeDodged: true });
    return before - target.hp;
  }

  it('leaves an unclassified target taking what it always took', () => {
    expect(hit({})).toBeGreaterThan(0);
  });

  it('makes a fire monster shrug off a fire weapon and fear a water one', () => {
    const base = hit({ element: 'fire', weapon: {} });
    const withFire = hit({ element: 'fire', weapon: { element: 'fire' } });
    const withWater = hit({ element: 'fire', weapon: { element: 'water' } });
    expect(withFire).toBeLessThan(base);
    expect(withWater).toBeGreaterThan(base);
  });

  it('makes a dagger worse than a spear against a large target, and better on a small one', () => {
    const daggerLarge = hit({ size: 'large', weapon: { weaponType: 'dagger' } });
    const spearLarge = hit({ size: 'large', weapon: { weaponType: 'spear' } });
    expect(daggerLarge).toBeLessThan(spearLarge);

    const daggerSmall = hit({ size: 'small', weapon: { weaponType: 'dagger' } });
    const spearSmall = hit({ size: 'small', weapon: { weaponType: 'spear' } });
    expect(daggerSmall).toBeGreaterThan(spearSmall);
  });

  it('gives a player the demi-human, neutral, medium classification', () => {
    const sim = new Sim({ seed: 1, playerClass: 'thief' });
    expect(sim.player.race).toBe('demihuman');
    expect(sim.player.element).toBe('neutral');
    expect(sim.player.size).toBe('medium');
  });
});
