// The tail of a physical hit.
//
// Everything here is about ORDER. The values are trivial; the reason the module
// exists is that this game had them in the wrong sequence, with the attribute
// chart applied before defence and the floor applied inside it, and no test
// anywhere said what the sequence was supposed to be.

import { describe, expect, it } from 'vitest';
import {
  MIN_DAMAGE_AFTER_REFINE,
  type PhysicalTail,
  resolvePhysicalTail,
} from '../src/sim/combat/damage_pipeline';

const base = (over: Partial<PhysicalTail> = {}): PhysicalTail => ({
  damage: 1000,
  hardDefMultiplier: 1,
  softDef: 0,
  ...over,
});

describe('the two defence layers', () => {
  it('takes the percentage first and the flat amount after', () => {
    // 1000 -> 500 -> 450. The other order would give (1000-50)*0.5 = 475, which
    // is soft defence scaling with armour: not what either layer is for.
    expect(resolvePhysicalTail(base({ hardDefMultiplier: 0.5, softDef: 50 }))).toBe(450);
  });

  it('skips both layers outright on a critical', () => {
    expect(
      resolvePhysicalTail(base({ hardDefMultiplier: 0.1, softDef: 900, ignoreDefence: true })),
    ).toBe(1000);
  });
});

describe('refine, and the floor that follows it', () => {
  it('adds against a NEGATIVE post-defence value rather than against the floor', () => {
    // The load-bearing one. 100 damage into 900 flat defence is -800; a +40
    // refine leaves it still under water, so the floor gives 1.
    expect(resolvePhysicalTail(base({ damage: 100, softDef: 900, refineFlat: 40 }))).toBe(1);
    // But refine that is big enough genuinely digs out, which is the whole
    // reason over-refining a weapon matters against a heavily armoured target.
    expect(resolvePhysicalTail(base({ damage: 100, softDef: 150, refineFlat: 90 }))).toBe(40);
    // Floored BEFORE refine instead, the same hit would read 1 + 90 = 91.
  });

  it('floors a hit that defence ate completely', () => {
    expect(resolvePhysicalTail(base({ damage: 10, softDef: 500 }))).toBe(MIN_DAMAGE_AFTER_REFINE);
  });
});

describe('the attribute chart', () => {
  it('runs AFTER defence, not before', () => {
    // Half damage from the chart on a hit that armour already halved: 250, not
    // "500 element then 500 defence" (which is the same here) but crucially not
    // the pre-defence order once soft defence is involved, checked below.
    const afterOrder = resolvePhysicalTail(
      base({ hardDefMultiplier: 0.5, softDef: 100, elementMultiplier: 0.5 }),
    );
    expect(afterOrder).toBe(200); // (1000*0.5 - 100) * 0.5
    // Applied before defence the same numbers give (1000*0.5)*0.5 - 100 = 150.
    expect(afterOrder).not.toBe(150);
  });

  it('is not stopped by the floor, so a hit can still turn into a heal', () => {
    // The floor sits between refine and the chart. A defender that absorbs the
    // attribute gets healed even from a hit that defence had already reduced to
    // the floor: negative out, and the caller decides what that means.
    const healed = resolvePhysicalTail(
      base({ damage: 10, softDef: 500, elementMultiplier: -0.25 }),
    );
    expect(healed).toBeLessThan(0);
    expect(healed).toBe(-0.25);
  });

  it('leaves immunity at exactly zero', () => {
    expect(resolvePhysicalTail(base({ elementMultiplier: 0 }))).toBe(0);
  });
});

describe('cards, last', () => {
  it('scale what the chart already decided', () => {
    // A card that hunts a race adds a fifth of the post-chart number, not a
    // fifth of the raw swing.
    expect(
      resolvePhysicalTail(
        base({ hardDefMultiplier: 0.5, elementMultiplier: 2, cardMultiplier: 1.2 }),
      ),
    ).toBe(1200);
  });

  it('cannot rescue a hit the chart zeroed', () => {
    expect(resolvePhysicalTail(base({ elementMultiplier: 0, cardMultiplier: 5 }))).toBe(0);
  });

  it('deepen an absorption rather than reversing it', () => {
    const v = resolvePhysicalTail(base({ elementMultiplier: -0.5, cardMultiplier: 2 }));
    expect(v).toBeLessThan(0);
  });
});

describe('the defaults', () => {
  it('leave a plain hit alone when nothing optional is supplied', () => {
    expect(resolvePhysicalTail(base())).toBe(1000);
  });
});
