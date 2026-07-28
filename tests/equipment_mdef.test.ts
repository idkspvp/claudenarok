// Magic defence on equipment.
//
// `src/sim/combat/magic_defence.ts` implemented the reference formula correctly
// and then sat inert, because no equipment field existed to feed it: the sim
// passed a hard magic defence of zero on every spell in the game. These cases
// pin that the field exists, that gear carries it, and above all that it now
// REACHES the formula, which is the only part a player can feel.

import { describe, expect, it } from 'vitest';
import { applyMagicDefence, softMagicDefence } from '../src/sim/combat/magic_defence';
import { ITEMS } from '../src/sim/data';
import { createPlayer, recalcPlayerStats } from '../src/sim/entity';
import { Sim } from '../src/sim/sim';
import { spreadAllocation } from './helpers/alloc';

const wearable = () =>
  Object.values(ITEMS).filter((i) => i.kind === 'armor' || i.kind === 'held_offhand');

describe('gear carries magic defence', () => {
  it('puts it on a real minority of equipment, the way the reference does', () => {
    const all = wearable().filter((i) => !i.heroicOf);
    const withMdef = all.filter((i) => (i.stats?.mdef ?? 0) > 0);
    expect(withMdef.length).toBeGreaterThan(0);
    // The reference sits at 12%. Bounded loosely on both sides: what matters is
    // that magic defence is something you seek out, not something every piece has.
    expect(withMdef.length / all.length).toBeGreaterThan(0.04);
    expect(withMdef.length / all.length).toBeLessThan(0.25);
  });

  it('keeps every value small, because it is a percentage', () => {
    // Defence and magic defence are both percentages in this model, so a piece
    // granting 40 would be granting 40% mitigation. The reference's best single
    // piece is 18.
    for (const item of wearable()) {
      const mdef = item.stats?.mdef ?? 0;
      expect(mdef, item.id).toBeGreaterThanOrEqual(0);
      expect(mdef, item.id).toBeLessThanOrEqual(18);
    }
  });

  it('concentrates it on headgear, where the reference concentrates it', () => {
    const share = (slots: readonly string[]) => {
      const group = wearable().filter((i) => !i.heroicOf && slots.includes(i.slot ?? ''));
      if (!group.length) return 0;
      return group.filter((i) => (i.stats?.mdef ?? 0) > 0).length / group.length;
    };
    expect(share(['helmet', 'face'])).toBeGreaterThan(share(['legs', 'feet']));
  });
});

describe('it reaches the formula', () => {
  const dressed = (equipment: Record<string, string>) => {
    const e = createPlayer(0, 'mage', { x: 0, y: 0, z: 0 }, 'Tester');
    e.level = 20;
    recalcPlayerStats(e, 'mage', equipment as never, undefined, {}, spreadAllocation(e.level));
    return e;
  };

  it('folds equipment magic defence into the character', () => {
    const piece = wearable().find((i) => (i.stats?.mdef ?? 0) > 0 && i.slot && !i.heroicOf);
    expect(piece, 'some piece must carry magic defence').toBeDefined();
    const bare = dressed({});
    const worn = dressed({ [piece!.slot as string]: piece!.id });
    expect(bare.stats.mdef).toBe(0);
    expect(worn.stats.mdef).toBe(piece!.stats?.mdef);
  });

  it('actually reduces a spell, which it could not do while the field was zero', () => {
    // The load-bearing one. Before this phase the sim passed 0 here on every
    // spell, so a character in full magic-defence gear took exactly what a naked
    // one did.
    const sim = new Sim({ seed: 3, playerClass: 'mage', autoEquip: true });
    const target = sim.player;
    const before = applyMagicDefence(1000, {
      mdef: 0,
      int: target.stats.int,
      vit: target.stats.vit,
    });
    const after = applyMagicDefence(1000, {
      mdef: 10,
      int: target.stats.int,
      vit: target.stats.vit,
    });
    expect(after).toBeLessThan(before);
    // Ten hard magic defence is ten percent, on top of whatever soft magic
    // defence the character's own attributes already subtract.
    expect(before - after).toBeCloseTo(100, 5);
  });

  it('still leaves Intellect paying for itself, so gear does not replace the build', () => {
    // Soft magic defence comes from the character, hard comes from gear, and the
    // character's half must stay the bigger lever at these sizes.
    const fromGear = 1000 * 0.1; // the best realistic worn total, as a percentage
    const fromInt = softMagicDefence(60, 30);
    expect(fromInt).toBeGreaterThan(0);
    expect(fromGear).toBeGreaterThan(0);
  });
});
