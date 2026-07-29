// Every class lands in the groups that decide what it can wear, hold, and
// mitigate with.
//
// These groups are `Set<PlayerClass>` literals, not `Record<PlayerClass, X>`, so
// the type checker validates the ELEMENT type and says nothing about membership.
// Widening the union by two classes put both of them in NO armour group and NO
// weapon group, and left the Knight, the reference's dedicated tank, holding a
// shield that granted zero block and zero parry. Nothing failed; the game was
// just quietly wrong. That is the whole reason this file exists: it is the
// membership check tsc cannot do.

import { describe, expect, it } from 'vitest';
import { CLASSES } from '../src/sim/content/classes';
import { ITEMS } from '../src/sim/data';
import { createPlayer, recalcPlayerStats } from '../src/sim/entity';
import { maxArmorTypeForClass } from '../src/sim/equipment_rules';
import { openingAllocation } from '../src/sim/progression/class_blocks';
import { ALL_CLASSES, MELEE_CLASSES, SHIELD_DEFENCE_CLASSES } from '../src/sim/types';

describe('armour groups', () => {
  it('gives every class an armour tier', () => {
    // The failure this catches is silent: a class in neither the mail nor the
    // leather set falls through to cloth, which is a legal answer for a caster
    // and a bug for a tank.
    for (const cls of ALL_CLASSES) {
      expect(['cloth', 'leather', 'mail'], cls).toContain(maxArmorTypeForClass(cls));
    }
  });

  it('matches what the character-select screen advertises', () => {
    // The two must agree or the screen lies. CLASS_DETAILS says the Knight wears
    // chainmail; this is the code that decides whether it actually can.
    expect(maxArmorTypeForClass('knight')).toBe('mail');
    expect(maxArmorTypeForClass('swordman')).toBe('mail');
    expect(maxArmorTypeForClass('thief')).toBe('leather');
    expect(maxArmorTypeForClass('archer')).toBe('leather');
    expect(maxArmorTypeForClass('summoner')).toBe('cloth');
    expect(maxArmorTypeForClass('mage')).toBe('cloth');
    expect(maxArmorTypeForClass('acolyte')).toBe('cloth');
  });
});

describe('shield defence', () => {
  it('gives a shield-carrying class real block and parry from its own shield', () => {
    // Driven through recalcPlayerStats rather than by reading the set, so it
    // fails if the set is right but a call site still hardcodes one class id.
    for (const cls of SHIELD_DEFENCE_CLASSES) {
      const def = CLASSES[cls];
      expect(def.startOffhand, `${cls} should start with a shield`).toBeTruthy();
      const e = createPlayer(0, cls, { x: 0, y: 0, z: 0 }, '');
      e.level = 20;
      recalcPlayerStats(
        e,
        cls,
        { mainhand: def.startWeapon, offhand: def.startOffhand, chest: def.startChest },
        undefined,
        {},
        openingAllocation(cls),
      );
      expect(e.blockChance, `${cls} block chance`).toBeGreaterThan(0);
      expect(e.blockValue, `${cls} block value`).toBeGreaterThan(0);
    }
  });

  it('gives a class WITHOUT the group nothing, even holding the same shield', () => {
    // The other arm. A Mage that somehow equips a buckler must not start
    // blocking, or the group has stopped meaning anything.
    const shield = CLASSES.swordman.startOffhand as string;
    expect(ITEMS[shield]).toBeTruthy();
    const e = createPlayer(0, 'mage', { x: 0, y: 0, z: 0 }, '');
    e.level = 20;
    recalcPlayerStats(
      e,
      'mage',
      { mainhand: CLASSES.mage.startWeapon, offhand: shield, chest: CLASSES.mage.startChest },
      undefined,
      {},
      openingAllocation('mage'),
    );
    expect(e.blockChance).toBe(0);
    expect(e.blockValue).toBe(0);
  });

  it('holds the tank set and the melee set in a sane relationship', () => {
    // Everything that fights behind a shield fights in melee. The reverse does
    // not hold: the Rogue is melee and carries no shield.
    for (const cls of SHIELD_DEFENCE_CLASSES) {
      expect(MELEE_CLASSES.has(cls), `${cls} blocks but is not melee`).toBe(true);
    }
    expect(SHIELD_DEFENCE_CLASSES.has('thief')).toBe(false);
    expect(MELEE_CLASSES.has('thief')).toBe(true);
  });
});

describe('the groups stay in step with the class union', () => {
  it('names only real classes', () => {
    for (const set of [MELEE_CLASSES, SHIELD_DEFENCE_CLASSES]) {
      for (const cls of set) expect(ALL_CLASSES, `${cls} is not a class`).toContain(cls);
    }
  });

  it('classifies every class as melee or not, deliberately', () => {
    // Not a completeness check on the set (a caster is correctly absent) but on
    // the DECISION: every class must appear in this pinned split, so a new one
    // cannot default into "not melee" by nobody noticing.
    const melee = ALL_CLASSES.filter((c) => MELEE_CLASSES.has(c)).sort();
    expect(melee).toEqual(['knight', 'swordman', 'thief']);
    const ranged = ALL_CLASSES.filter((c) => !MELEE_CLASSES.has(c)).sort();
    expect(ranged).toEqual(['acolyte', 'archer', 'mage', 'summoner']);
  });
});
