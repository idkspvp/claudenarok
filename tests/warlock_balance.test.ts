import { describe, expect, it } from 'vitest';
import { ABILITIES, abilitiesKnownAt } from '../src/sim/content/classes';
import { WARLOCK_PET_MOBS } from '../src/sim/content/warlock_pets';

function dotTotal(abilityId: string, level = 20): number {
  const known = abilitiesKnownAt('warlock', level).find((entry) => entry.def.id === abilityId);
  const dot = known?.effects.find((effect) => effect.type === 'dot');
  if (dot?.type !== 'dot') throw new Error(`${abilityId} has no DoT at level ${level}`);
  return dot.total;
}

function rawPetDps(templateId: keyof typeof WARLOCK_PET_MOBS, level = 20): number {
  const pet = WARLOCK_PET_MOBS[templateId];
  return (pet.dmgBase + pet.dmgPerLevel * (level - 1)) / pet.attackSpeed;
}

describe('warlock low-level sustained damage tuning', () => {
  it('keeps Gloomshade clearly below Emberkin damage after the Emberkin tuning pass', () => {
    const impDps = rawPetDps('emberkin');
    const voidwalkerDps = rawPetDps('gloomshade');

    expect(impDps).toBeCloseTo(13, 1);
    expect(voidwalkerDps).toBeCloseTo(9.1, 1);
    expect(voidwalkerDps / impDps).toBeLessThan(0.75);
    expect(voidwalkerDps / impDps).toBeGreaterThan(0.65);
  });

  it('trims the two strongest maintenance DoTs without changing Shadow Bolt base damage', () => {
    expect(dotTotal('corruption')).toBe(85);
    expect(dotTotal('curse_of_agony')).toBe(78);

    const shadowBolt = ABILITIES.shadow_bolt.ranks?.find((rank) => rank.rank === 4);
    expect(shadowBolt?.effects).toEqual([{ type: 'directDamage', min: 68, max: 84 }]);
  });

  // The mastery / choice-row / Grimoire blocks that stood here read the warlock
  // talent trees, retired in Phase D0.
});
