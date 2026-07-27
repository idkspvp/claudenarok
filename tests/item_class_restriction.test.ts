import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ITEMS } from '../src/sim/data';
import { canEquipItem } from '../src/sim/equipment_rules';
import { ALL_CLASSES, type ItemDef } from '../src/sim/types';
import { requiredClassesForTooltip } from '../src/ui/item_class_restriction';

// Bug #1893: a acolyte was blocked from equipping "Fang of Korzul" (a thief/archer
// dagger) and a player was blocked from "Deathlord Warplate" (swordman/swordman/
// acolyte mail) with no in-game explanation. Both items resolve to a recognized
// weapon-proficiency archetype / armor-weight group (equipment_rules.ts), and the
// tooltip used to hide the explicit "Requires: <classes>" line whenever that
// happened, on the mistaken assumption that the armor-weight badge or the archetype
// grouping alone made the restriction obvious. Neither actually names the eligible
// classes (and weapons have no equivalent badge at all), so the line must always
// render when the item carries a class restriction.
describe('requiredClassesForTooltip', () => {
  it('names the classes for a thief/archer-only weapon (Fang of Korzul)', () => {
    const item = ITEMS.fang_of_korzul;
    expect(item).toBeDefined();
    expect(canEquipItem('acolyte', item)).toBe(false);
    expect(requiredClassesForTooltip(item)).toEqual(['thief', 'archer']);
  });

  it('does not advertise Rogue for a future two-handed weapon', () => {
    const item = {
      id: 'future_greatblade',
      name: 'Future Greatblade',
      kind: 'weapon' as const,
      slot: 'mainhand' as const,
      hand: 'twohand' as const,
      weapon: { min: 20, max: 30, speed: 3.2 },
      requiredClass: ['swordman', 'thief', 'archer', 'acolyte', 'swordman'],
      sellValue: 1,
    } satisfies ItemDef;

    expect(canEquipItem('thief', item)).toBe(false);
    expect(requiredClassesForTooltip(item)).toEqual(['swordman', 'archer', 'acolyte', 'swordman']);
  });

  it('shows the literal enforced class list for a shield', () => {
    const item = {
      id: 'future_warrior_shield',
      name: 'Future Warrior Shield',
      kind: 'armor' as const,
      slot: 'offhand' as const,
      armorType: 'mail' as const,
      shield: true,
      requiredClass: ['swordman'],
      sellValue: 1,
    } satisfies ItemDef;

    // A shield equips by its literal list, so the Swordman on the list CAN wear it
    // and every other job cannot. The tooltip still names the list either way.
    expect(canEquipItem('swordman', item)).toBe(true);
    expect(canEquipItem('acolyte', item)).toBe(false);
    expect(requiredClassesForTooltip(item)).toEqual(['swordman']);
  });

  it('derives the enforced classes for unrestricted two-handed vendor weapons', () => {
    const expected = ALL_CLASSES.filter((cls) => cls !== 'thief');
    for (const id of ['eastbrook_greatsword', 'highwatch_greatsword'] as const) {
      const item = ITEMS[id];
      expect(item.requiredClass).toBeUndefined();
      expect(canEquipItem('thief', item)).toBe(false);
      expect(requiredClassesForTooltip(item)).toEqual(expected);
    }
  });

  it('names the class for a mail chest (Barrowlord Warplate)', () => {
    // The Paladin and the Shaman shared this plate line and were cut in D1, so the
    // Swordman is the whole list now.
    const item = ITEMS.deathlord_warplate;
    expect(item).toBeDefined();
    expect(canEquipItem('mage', item)).toBe(false);
    expect(requiredClassesForTooltip(item)).toEqual(['swordman']);
  });

  it('does not claim a restriction armor does not enforce (Shadowstitch Jerkin)', () => {
    // canEquipItem short-circuits leather armor on weight: every leather AND mail
    // class can wear it, so the Swordman (mail) can equip it even though
    // requiredClass only names thief/archer. requiredClass here is loot-targeting
    // metadata, not an enforced restriction, so the tooltip must stay silent.
    const item = ITEMS.shadow_jerkin;
    expect(item).toBeDefined();
    expect(canEquipItem('swordman', item)).toBe(true);
    expect(requiredClassesForTooltip(item)).toBeNull();
  });

  it('returns null when the item carries no class restriction', () => {
    expect(
      requiredClassesForTooltip({
        id: 'test',
        name: 'Test',
        kind: 'weapon',
        slot: 'mainhand',
        weapon: { min: 1, max: 2, speed: 2 },
        sellValue: 1,
      }),
    ).toBeNull();
  });
});

// hud.ts renders the tooltip; assert the source no longer suppresses the classes
// line for items that match a known armor-weight/weapon-archetype grouping (the
// regression), and that it renders through the new pure resolver.
describe('hud.ts item tooltip class-restriction line', () => {
  const hud = readFileSync(new URL('../src/ui/hud.ts', import.meta.url), 'utf8');

  it('renders the classes line for every class-restricted item, not just narrow ones', () => {
    expect(hud).toContain('requiredClassesForTooltip(item)');
    expect(hud).not.toContain(
      'if (item.requiredClass && !armorTypeForItem(item) && !weaponArchetypeForItem(item)) {',
    );
  });
});
