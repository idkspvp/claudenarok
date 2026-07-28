// Attacking at range is a property of the WEAPON, not of the class.
//
// This reverses the model the tree shipped with, where an Archer fired arrows
// because it was an Archer and did so while holding a hatchet. Ragnarok and
// SpiritVale both put the bow in the player's hands instead, and the per-job
// attack-speed table (`src/sim/job_aspd.ts`) is written against that: it is
// indexed by job AND weapon, which only means anything once the weapon decides.
//
// The cases below pin the consequences rather than the plumbing, because the
// plumbing is one field and the consequences are the design.

import { describe, expect, it } from 'vitest';
import { rangedAutoProfile } from '../src/sim/combat/form_swing';
import { ITEMS } from '../src/sim/data';
import { Sim } from '../src/sim/sim';
import type { Entity, PlayerClass, WeaponInfo } from '../src/sim/types';

const withWeapon = (cls: PlayerClass, itemId: string): Entity => {
  const sim = new Sim({ seed: 11, playerClass: cls, autoEquip: true });
  const p = sim.player;
  const item = ITEMS[itemId] as { weapon?: WeaponInfo } | undefined;
  if (!item?.weapon) throw new Error(`no weapon item ${itemId}`);
  p.weapon = { ...item.weapon };
  return p;
};

describe('a bow is what makes an attack ranged', () => {
  it('gives the Archer a ranged profile from its starting weapon', () => {
    // The Archer used to start with a hatchet and shoot anyway. It starts with a
    // bow now, and the bow is the reason it shoots.
    const sim = new Sim({ seed: 11, playerClass: 'archer', autoEquip: true });
    const profile = rangedAutoProfile(sim.player);
    expect(profile).toBeDefined();
    expect(profile?.wand).toBeUndefined();
    // A bow keeps its dead zone, which is what makes an archer reposition.
    expect(profile?.minRange).toBeGreaterThan(0);
    expect(profile?.maxRange).toBeGreaterThan(profile?.minRange ?? 0);
  });

  it('takes the ranged attack AWAY when the Archer holds a melee weapon', () => {
    // The load-bearing reversal. Under the old model this was impossible: the
    // class carried the profile, so an Archer shot whatever it held.
    expect(rangedAutoProfile(withWeapon('archer', 'rusty_hatchet'))).toBeUndefined();
    expect(rangedAutoProfile(withWeapon('archer', 'rusty_dagger'))).toBeUndefined();
  });

  it('GIVES it to anyone else holding the bow, with no class check anywhere', () => {
    // Neither Ragnarok nor SpiritVale hard-locks a weapon to a job; both let you
    // hold the wrong thing and punish it through attack speed instead. So a
    // Swordman with a bow really does shoot, and `job_aspd` is what makes that a
    // bad idea rather than an impossible one.
    for (const cls of ['swordman', 'thief', 'mage', 'acolyte'] as PlayerClass[]) {
      expect(rangedAutoProfile(withWeapon(cls, 'worn_shortbow')), cls).toBeDefined();
    }
  });
});

describe('a wand is the caster arm of the same rule', () => {
  it('has no dead zone and carries a school, unlike a bow', () => {
    // The two differences that make a wand a wand: a caster never has to close to
    // melee to auto-attack, and its bolt is magic, so MDEF mitigates it instead
    // of DEF.
    const wand = rangedAutoProfile(withWeapon('mage', 'gnarled_staff'));
    expect(wand?.wand).toBe(true);
    expect(wand?.minRange).toBe(0);
    expect(wand?.school).toBeDefined();
    expect(wand?.school).not.toBe('physical');
  });

  it('leaves a caster in melee once it puts the staff down', () => {
    expect(rangedAutoProfile(withWeapon('mage', 'rusty_dagger'))).toBeUndefined();
  });
});

describe('the resolved profile carries the numbers off the weapon', () => {
  it('reports the equipped weapon damage and cadence, not a class constant', () => {
    // The old resolver returned the class's fixed figures for a wand and the
    // weapon's for a bow. Now there is one answer for both, and it is the
    // weapon's, which is what lets a better bow actually be better.
    const bow = ITEMS.worn_shortbow as { weapon: WeaponInfo };
    const p = withWeapon('archer', 'worn_shortbow');
    const profile = rangedAutoProfile(p);
    expect(profile?.min).toBe(bow.weapon.min);
    expect(profile?.max).toBe(bow.weapon.max);
    expect(profile?.speed).toBe(bow.weapon.speed);
  });
});
