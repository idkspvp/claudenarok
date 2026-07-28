import { describe, expect, it } from 'vitest';
import { WEAPON_TYPE_BY_ITEM } from '../src/sim/content/weapon_skin_rules';
import { CLASSES, ITEMS } from '../src/sim/data';
import { canEquipItem } from '../src/sim/equipment_rules';
import { Sim } from '../src/sim/sim';
import type { PlayerClass } from '../src/sim/types';

const ALL_CLASSES = Object.keys(CLASSES) as PlayerClass[];
// The two jobs that carry caster weapon proficiency after the D1 collapse.
const CASTER_WEAPON_CLASSES: PlayerClass[] = ['mage', 'acolyte'];

function equip(cls: Parameters<Sim['addPlayer']>[0], itemId: string) {
  const sim = new Sim({ seed: 42, playerClass: cls, noPlayer: true, autoEquip: false });
  const pid = sim.addPlayer(cls, `${cls}-${itemId}`);
  // Max level so the per-quality level gate (item_level_req.ts) never fires:
  // these cases test CLASS/armor proficiency in isolation, not the level gate.
  sim.setPlayerLevel(20, pid);
  sim.addItem(itemId, 1, pid);
  sim.equipItem(itemId, pid);
  return sim.meta(pid)!;
}

describe('armor proficiencies', () => {
  // Armor weight after D1: the Swordman is the only mail wearer, the Thief and the
  // Archer are leather, and the Mage and the Acolyte are cloth. Each rank admits
  // everything lighter than itself.
  it('lets the mail class equip mail, leather, and cloth armor', () => {
    expect(equip('swordman', 'crownforged_dreadhelm').equipment.helmet).toBe(
      'crownforged_dreadhelm',
    );
    expect(equip('swordman', 'nighttalon_crown').equipment.helmet).toBe('nighttalon_crown');
    expect(equip('swordman', 'soulflame_cowl').equipment.helmet).toBe('soulflame_cowl');
  });

  it('lets the leather classes equip leather and cloth armor but not mail armor', () => {
    for (const cls of ['thief', 'archer'] as const) {
      expect(equip(cls, 'nighttalon_crown').equipment.helmet, cls).toBe('nighttalon_crown');
      expect(equip(cls, 'soulflame_cowl').equipment.helmet, cls).toBe('soulflame_cowl');
      expect(equip(cls, 'crownforged_dreadhelm').equipment.helmet, cls).toBeUndefined();
    }
  });

  it('keeps the cloth classes restricted to cloth armor', () => {
    for (const cls of ['mage', 'acolyte'] as const) {
      expect(equip(cls, 'soulflame_cowl').equipment.helmet, cls).toBe('soulflame_cowl');
      expect(equip(cls, 'nighttalon_crown').equipment.helmet, cls).toBeUndefined();
      expect(equip(cls, 'crownforged_dreadhelm').equipment.helmet, cls).toBeUndefined();
    }
  });

  it('allows swordman-style weapons for the swordman, thief, and archer', () => {
    expect(equip('swordman', 'kingsbane_last_oath').equipment.mainhand).toBe('kingsbane_last_oath');
    // A thief may hold one but never in the mainhand over its starting dagger:
    // the dual-wield path parks it in the offhand.
    const thief = equip('thief', 'kingsbane_last_oath').equipment;
    expect(thief.mainhand).toBe('rusty_dagger');
    expect(thief.offhand).toBe('kingsbane_last_oath');
    expect(equip('archer', 'kingsbane_last_oath').equipment.mainhand).toBe('kingsbane_last_oath');
    // The two casters cannot.
    expect(equip('mage', 'kingsbane_last_oath').equipment.mainhand).not.toBe('kingsbane_last_oath');
    expect(equip('acolyte', 'kingsbane_last_oath').equipment.mainhand).not.toBe(
      'kingsbane_last_oath',
    );
  });

  it('allows caster weapons for the caster classes only', () => {
    for (const cls of CASTER_WEAPON_CLASSES) {
      expect(equip(cls, 'staff_of_the_gravewyrm').equipment.mainhand, cls).toBe(
        'staff_of_the_gravewyrm',
      );
    }
    for (const cls of ['swordman', 'thief', 'archer'] as const) {
      expect(equip(cls, 'staff_of_the_gravewyrm').equipment.mainhand, cls).not.toBe(
        'staff_of_the_gravewyrm',
      );
    }
  });

  it('lets an acolyte equip Lunar Tide Greatstaff through the live equip path', () => {
    expect(equip('acolyte', 'lunar_tide_greatstaff').equipment.mainhand).toBe(
      'lunar_tide_greatstaff',
    );
  });

  it('allows every caster to equip every staff', () => {
    const staffIds = Object.entries(WEAPON_TYPE_BY_ITEM)
      .filter(([, type]) => type === 'staff')
      .map(([id]) => id);

    expect(staffIds).toContain('lunar_tide_greatstaff');
    for (const itemId of staffIds) {
      const item = ITEMS[itemId];
      expect(item, `${itemId}: staff definition`).toBeDefined();
      // A staff locked to a single job is that job's, not the caster group's; the
      // feral line is locked to nobody at all (its owner was cut) and is skipped
      // here for the same reason.
      if (item.requiredClass && item.requiredClass.length <= 1) continue;
      for (const cls of CASTER_WEAPON_CLASSES) {
        expect(canEquipItem(cls, item), `${itemId}: ${cls} staff proficiency`).toBe(true);
      }
    }
  });
});

describe('weapon requiredClass is representative of who can equip', () => {
  // The whole point of the field: a weapon's requiredClass must list exactly the
  // classes that can actually equip it, not an archetype-signature subset. Guards
  // every weapon at once, so a future archetype weapon authored with the short
  // form (e.g. ['swordman','swordman']) fails here until it lists the full group.
  it('lists exactly the classes canEquipItem allows, for every weapon with a class list', () => {
    for (const item of Object.values(ITEMS)) {
      if (item.kind !== 'weapon' || !item.requiredClass) continue;
      const equippable = ALL_CLASSES.filter((c) => canEquipItem(c, item)).sort();
      const listed = [...item.requiredClass].sort();
      expect(listed, `${item.id}: requiredClass must match its equippable classes`).toEqual(
        equippable,
      );
    }
  });
});
