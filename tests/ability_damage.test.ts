import { describe, expect, it } from 'vitest';
import { abilitiesKnownAt } from '../src/sim/content/classes';
import type { PlayerModifiers } from '../src/sim/player_modifiers';
import {
  abilityScalingPower,
  absorbBonus,
  channelTickBonus,
  directHealBonus,
  directHitBonus,
  dotTickBonus,
  hotTickBonus,
} from '../src/sim/spell_scaling';
import { MAX_LEVEL } from '../src/sim/types';
import {
  type AbilityScaling,
  abilityBuffValue,
  abilityDamageBonus,
  abilityTemporalHourglassValues,
} from '../src/ui/ability_damage';

function known(cls: Parameters<typeof abilitiesKnownAt>[0], id: string, mods?: PlayerModifiers) {
  const ability = abilitiesKnownAt(cls, MAX_LEVEL, mods).find((k) => k.def.id === id);
  if (!ability) throw new Error(`missing ability ${id}`);
  return ability;
}

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('missing expected effect');
  return value;
}

const SC: AbilityScaling = { spellPower: 80, rangedPower: 200, attackPower: 140 };

describe('abilityDamageBonus (tooltip scaling mirrors combat)', () => {
  it('renders Direhowl from its percentage damage reduction, not the retired AP amount', () => {
    expect(abilityBuffValue(known('swordman', 'demoralizing_shout'))).toBe(20);
  });

  it('reads Hourglass healing and cooldown percentages from the resolved effect', () => {
    const hourglass = abilitiesKnownAt('mage', MAX_LEVEL).find(
      (ability) => ability.def.id === 'temporal_hourglass',
    );
    expect(hourglass).toBeDefined();
    if (!hourglass) return;
    expect(abilityTemporalHourglassValues(hourglass)).toEqual({
      healing: 30,
      hostilePveDuration: 60,
      hostilePvpDuration: 10,
      groundDuration: 30,
      selfCooldownRecovery: 100,
      allyCooldownRecovery: 75,
    });
  });

  it('a direct nuke folds Spell Power with the rank-resolved cast time', () => {
    const fb = known('mage', 'frostbolt');
    const eff = required(fb.effects.find((e) => e.type === 'directDamage'));
    expect(abilityDamageBonus(fb, eff, SC)).toBe(
      directHitBonus(SC.spellPower, fb.def, fb.castTime, false),
    );
    expect(abilityDamageBonus(fb, eff, SC)).toBeGreaterThan(0);
  });

  it('an AoE nuke takes the AoE-penalised coefficient', () => {
    const ae = known('mage', 'arcane_explosion');
    const eff = required(ae.effects.find((e) => e.type === 'aoeDamage'));
    expect(abilityDamageBonus(ae, eff, SC)).toBe(
      directHitBonus(SC.spellPower, ae.def, ae.castTime, true),
    );
  });

  it('a pure DoT folds Spell Power across all its ticks (the total)', () => {
    const swp = known('acolyte', 'shadow_word_pain');
    const eff = required(swp.effects.find((e) => e.type === 'dot'));
    if (eff.type !== 'dot') throw new Error('expected dot');
    const ticks = eff.duration / eff.interval;
    expect(abilityDamageBonus(swp, eff, SC)).toBe(
      dotTickBonus(SC.spellPower, swp.def, eff.duration, eff.interval) * ticks,
    );
  });

  it('a archer attack-spell scales off Ranged Attack Power, not Spell Power', () => {
    const as = known('archer', 'arcane_shot');
    const eff = required(as.effects.find((e) => e.type === 'directDamage'));
    expect(abilityScalingPower(SC, as.def)).toBe(SC.rangedPower);
    expect(abilityDamageBonus(as, eff, SC)).toBe(
      directHitBonus(SC.rangedPower, as.def, as.castTime, false),
    );
  });

  it('a channelled directDamage (Arcane Missiles) uses the per-tick CHANNEL coefficient', () => {
    const am = known('mage', 'arcane_missiles');
    const eff = required(am.effects.find((e) => e.type === 'directDamage'));
    // It is a per-missile channel tick, so it must use the channel coefficient, not
    // the single-cast direct coefficient.
    expect(abilityDamageBonus(am, eff, SC)).toBe(channelTickBonus(SC.spellPower, am.def));
  });

  it('a drain channel (Mind Flay) folds the per-tick channel coefficient', () => {
    const mf = known('acolyte', 'mind_flay');
    const eff = required(mf.effects.find((e) => e.type === 'drainTick'));
    expect(abilityDamageBonus(mf, eff, SC)).toBe(channelTickBonus(SC.spellPower, mf.def));
  });

  it('a melee weaponStrike adds nothing here (Attack Power rides the swing)', () => {
    const ss = known('thief', 'sinister_strike');
    const eff = required(ss.effects.find((e) => e.type === 'weaponStrike'));
    expect(abilityDamageBonus(ss, eff, SC)).toBe(0);
  });

  it('a thief finisher folds Attack Power / 14 into its base', () => {
    const ev = known('thief', 'eviscerate');
    const eff = required(ev.effects.find((e) => e.type === 'finisherDamage'));
    expect(abilityDamageBonus(ev, eff, SC)).toBe(Math.round(SC.attackPower / 14));
  });

  it('a direct heal folds Spell Power at the cast-time coefficient (combat directHealBonus)', () => {
    const heal = abilitiesKnownAt('acolyte', MAX_LEVEL).find((k) =>
      k.effects.some((e) => e.type === 'heal'),
    )!;
    const eff = required(heal.effects.find((e) => e.type === 'heal'));
    expect(abilityDamageBonus(heal, eff, SC)).toBe(directHealBonus(SC.spellPower, heal.castTime));
    expect(abilityDamageBonus(heal, eff, SC)).toBeGreaterThan(0);
  });

  it('a personal mage barrier shows the same Spell Power bonus combat applies', () => {
    const barrier = known('mage', 'ice_barrier');
    const eff = required(barrier.effects.find((e) => e.type === 'absorb'));
    if (eff.type !== 'absorb') throw new Error('expected absorb');
    expect(abilityDamageBonus(barrier, eff, SC)).toBe(absorbBonus(SC.spellPower, 0.5));
  });

  it('a pure HoT folds Spell Power across all its ticks', () => {
    // Rejuvenation and Regrowth went with the Druid in D1; Renew is the surviving
    // pure HoT. No live kit pairs a HoT rider with a direct heal any more, so the
    // rider-suppression arm has no ability to exercise it until D4 re-homes one.
    const renew = known('acolyte', 'renew');
    const hot = required(renew.effects.find((e) => e.type === 'hot'));
    if (hot.type !== 'hot') throw new Error('expected hot');
    const ticks = hot.duration / hot.interval;
    expect(abilityDamageBonus(renew, hot, SC)).toBe(
      hotTickBonus(SC.spellPower, hot.duration, hot.interval) * ticks,
    );
  });

  it('a ground AoE pulse folds the AoE-penalised direct coefficient (combat spBonus)', () => {
    // Consecration went with the Paladin; Blizzard is the surviving ground AoE.
    const bliz = known('mage', 'blizzard');
    const eff = required(bliz.effects.find((e) => e.type === 'groundAoE'));
    expect(abilityDamageBonus(bliz, eff, SC)).toBe(
      directHitBonus(SC.spellPower, bliz.def, bliz.castTime, true),
    );
  });

  // The channelled-AoE case is GONE, not fixed. Rain of Fire was the only spell
  // that folded Spell Power per channel tick, and it went with the Warlock in D1.
  // The two channels left are physical (Volley scales off Ranged AP, Rending
  // Cyclone off melee), so neither reaches channelTickBonus, and substituting one
  // would pin a different coefficient under the old name. Restore this when D4
  // re-homes a magic channel.
});
