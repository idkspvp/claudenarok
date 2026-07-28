// Health, spell points and both regen curves, pinned against
// docs/design/spiritvale-engine-formulas.md.
//
// Three of these tests exist because the published formulas contain details a
// reader will assume are typos and "fix": the level clamp at 130 under a cap of
// 150, the regen percentage entering halved, and that same percentage applying
// twice on the mana side only.

import { describe, expect, it } from 'vitest';
import {
  HP_TRIANGULAR_LEVEL_CAP,
  healthRegen,
  manaRegen,
  maxHealth,
  maxMana,
  triangular,
} from '../src/sim/stats/resources';

describe('the triangular number', () => {
  it('is n(n+1)/2', () => {
    expect(triangular(1)).toBe(1);
    expect(triangular(10)).toBe(55);
    expect(triangular(130)).toBe(8515);
  });
});

describe('max health', () => {
  it('matches a hand-computed case', () => {
    // Lv 100, VIT 50, Warrior 1.3:
    //   Tri(100) = 5050;  5050*1.3 = 6565
    //   + 10*100 + 200 = 6565 + 1200 = 7765
    //   * (1 + 50/100) = 7765 * 1.5 = 11647.5  ->  round 11648
    expect(maxHealth({ level: 100, vit: 50, archetypeMultiplier: 1.3 })).toBe(11648);
  });

  it('is quadratic in level, so a Warrior outgrows a Mage by a widening gap', () => {
    const warriorLow = maxHealth({ level: 20, vit: 0, archetypeMultiplier: 1.3 });
    const mageLow = maxHealth({ level: 20, vit: 0, archetypeMultiplier: 0.5 });
    const warriorHigh = maxHealth({ level: 120, vit: 0, archetypeMultiplier: 1.3 });
    const mageHigh = maxHealth({ level: 120, vit: 0, archetypeMultiplier: 0.5 });
    expect(warriorHigh - mageHigh).toBeGreaterThan(warriorLow - mageLow);
  });

  it('CLAMPS the quadratic term at level 130 even though the cap is 150', () => {
    // Past 130 only the linear 10*Lv term keeps growing. This is in the source
    // and reads like a bug; it is not.
    expect(HP_TRIANGULAR_LEVEL_CAP).toBe(130);
    const at130 = maxHealth({ level: 130, vit: 0, archetypeMultiplier: 1 });
    const at140 = maxHealth({ level: 140, vit: 0, archetypeMultiplier: 1 });
    const at150 = maxHealth({ level: 150, vit: 0, archetypeMultiplier: 1 });
    // Each ten levels past the clamp adds exactly 10*10 = 100, nothing more.
    expect(at140 - at130).toBe(100);
    expect(at150 - at140).toBe(100);
    // And that is far less than the ten levels just below the clamp added.
    const at120 = maxHealth({ level: 120, vit: 0, archetypeMultiplier: 1 });
    expect(at130 - at120).toBeGreaterThan(at140 - at130);
  });

  it('never returns a pool below 1', () => {
    expect(maxHealth({ level: 1, vit: -1000, archetypeMultiplier: 0 })).toBeGreaterThanOrEqual(1);
  });

  it('treats Vitality as a plain percentage on its own pool', () => {
    const none = maxHealth({ level: 50, vit: 0, archetypeMultiplier: 1 });
    const hundred = maxHealth({ level: 50, vit: 100, archetypeMultiplier: 1 });
    expect(hundred).toBe(none * 2);
  });
});

describe('max mana', () => {
  it('matches a hand-computed case', () => {
    // Lv 100, INT 50: (45 + 500) * 1.5 = 545 * 1.5 = 817.5
    expect(maxMana({ level: 100, int: 50 })).toBeCloseTo(817.5, 10);
  });

  it('is LINEAR in level, unlike health', () => {
    const a = maxMana({ level: 10, int: 0 });
    const b = maxMana({ level: 20, int: 0 });
    const c = maxMana({ level: 30, int: 0 });
    expect(b - a).toBeCloseTo(c - b, 10);
  });
});

describe('health regen', () => {
  it('matches a hand-computed case', () => {
    // maxHp 10000, VIT 50:
    //   flat   = 10000/200 + 50/5 = 50 + 10 = 60
    //   factor = 1 + 50/200 = 1.25
    //   60 * 1.25 = 75
    expect(healthRegen({ maxHp: 10_000, vit: 50 })).toBe(75);
  });

  it('takes the regen PERCENTAGE stat halved, because the engine averages', () => {
    // factor = 1 + VIT/200 + pct/2. At VIT 0 and pct 1.0 (that is +100%), the
    // factor is 1.5, not 2.0.
    const plain = healthRegen({ maxHp: 20_000, vit: 0 }); // flat 100 * 1 = 100
    const boosted = healthRegen({ maxHp: 20_000, vit: 0, hpRegenPercent: 1 });
    expect(plain).toBe(100);
    expect(boosted).toBe(150);
  });

  it('adds the max-pool percentage OUTSIDE the factor', () => {
    const withPool = healthRegen({ maxHp: 20_000, vit: 0, maxHpRegenPercent: 0.01 });
    expect(withPool).toBe(100 + 200);
  });
});

describe('mana regen', () => {
  it('matches a hand-computed case', () => {
    // maxMp 1000, INT 50:
    //   flat   = 1000/100 + 50/5 = 10 + 10 = 20
    //   factor = 1 + 50/200 = 1.25
    //   20 * 1.25 = 25, then * (1 + 0) = 25
    expect(manaRegen({ maxMp: 1_000, int: 50 })).toBe(25);
  });

  it('divides the pool by 100 where the health side divides by 200', () => {
    // Same pool number, same attribute: mana takes twice the pool term.
    const hp = healthRegen({ maxHp: 1_000, vit: 0 }); // 1000/200 = 5
    const mp = manaRegen({ maxMp: 1_000, int: 0 }); // 1000/100 = 10
    expect(hp).toBe(5);
    expect(mp).toBe(10);
  });

  it('applies its percentage stat TWICE, which the health side does not', () => {
    // pct 1.0: halved inside the factor (x1.5), then again in full outside
    // (x2.0), for x3.0 overall. The health twin only reaches x1.5.
    const mp = manaRegen({ maxMp: 1_000, int: 0, mpRegenPercent: 1 });
    expect(mp).toBe(30); // flat 10 * 1.5 * 2
    const hp = healthRegen({ maxHp: 2_000, vit: 0, hpRegenPercent: 1 });
    expect(hp).toBe(15); // flat 10 * 1.5, no second application
  });
});
