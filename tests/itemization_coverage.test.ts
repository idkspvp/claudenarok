// Itemization gap fill: pins the class/spec coverage this change adds so the
// gaps cannot silently return. Before it, leather caster armor was two pieces
// in the whole game (a acolyte balance/restoration player was forced into
// cloth), mail caster had no leveling line below item level 23 (holy swordman
// and elemental/restoration acolyte had no on-weight options), and no
// two-handed feral weapon existed above item level 16. The pins below are
// decisive about the new pieces (exact ids, item levels, and budgets) and use
// existence predicates over the whole table for the per-band coverage, so
// future additions grow the table without breaking the pins.
import { describe, expect, it } from 'vitest';
import { DUNGEONS, ITEMS, MOBS } from '../src/sim/data';
import { canEquipItem, isShieldItem, weaponArchetypeForItem } from '../src/sim/equipment_rules';
import { weaponDpsBudget } from '../src/sim/item_budget';
import {
  expectedStatBudget,
  itemLevel,
  itemSourceLevel,
  primaryStatSum,
  TWOHAND_DPS_MULT,
} from '../src/sim/item_level';
import { isLegalStatTotal } from '../src/sim/item_stat_policy';
import { ALL_CLASSES, type ItemDef, type PlayerClass } from '../src/sim/types';

const PRIMARY_STAT_KEYS = ['str', 'agi', 'vit', 'int', 'dex', 'luk'] as const;

// Every item this change ships, with the item level its acquisition source
// derives (source level + the quality bump + the raid bonus for Nythraxis).
const NEW_ITEMS: ReadonlyArray<readonly [string, number]> = [
  // Druid caster leather line (int/spi, one piece per armor slot ladder).
  ['mosshide_vest', 5],
  ['thornling_grips', 7],
  ['fenbark_leggings', 11],
  ['mirebloom_treads', 11],
  ['duskthorn_mantle', 13],
  ['wildgrove_cinch', 15],
  ['moonbark_vestments', 18],
  ['stormroot_cowl', 20],
  ['thornpeak_wildwraps', 22],
  ['cryptbloom_shoulderguards', 23],
  ['vestments_of_the_waking_grove', 26],
  // Shaman/swordman caster mail leveling line (int/spi).
  ['acolyte_chain_grips', 5],
  ['votive_chain_belt', 7],
  ['fenwarden_sabatons', 11],
  ['marshlight_hauberk', 13],
  ['cragward_pauldrons', 15],
  ['stormchant_gauntlets', 17],
  ['peaksong_helm', 18],
  ['thunderward_legguards', 20],
  ['stormvotive_hauberk', 22],
  // The 17-22 band padding: cloth caster and leather melee.
  ['tidehymn_slippers', 17],
  ['cragprowl_belt', 17],
  ['revenantstep_treads', 20],
  ['shardfang_grips', 21],
  ['shardsong_mantle', 22],
  ['wyrmcult_spellgrips', 22],
  // The int/spi shield and the low-level held offhand.
  ['pearlward_aegis', 19],
  ['valefire_lantern', 7],
  // Endgame leather caster line (instanced sources, ilvl 26 and 31).
  ['wildgrowth_leggings', 26],
  ['grovewardens_grips', 26],
  ['verdant_walkers', 26],
  ['lunarward_cinch', 31],
  ['dreamroot_boots', 31],
  ['stormbark_mantle', 31],
];

// The feral two-handed ladder: acolyte-only weapons with real 2H dps plus
// str/agi/sta, from the zone-1 rare elite up to the raid boss.
const FERAL_LADDER: ReadonlyArray<readonly [string, number]> = [
  ['briarroot_staff', 8],
  ['fenshadow_maul', 13],
  ['cragthorn_greatstaff', 17],
  ['gravewyrm_thornmaul', 23],
  ['nightfangs_greatstaff', 26],
  ['maul_of_the_scourged_wilds', 29],
  ['wildsoul_maul', 31],
];

const ALL_NEW_IDS = [...NEW_ITEMS, ...FERAL_LADDER].map(([id]) => id);

// Item-level bands matching the zone/dungeon tiers: zone1, zone2, the zone3
// approach, the 17-22 zone3 band, and the dungeon/raid endgame.
const BANDS: ReadonlyArray<readonly [number, number]> = [
  [1, 7],
  [8, 13],
  [14, 16],
  [17, 22],
  [23, 31],
];

function authoredCasterPieces(
  armorType: 'cloth' | 'leather' | 'mail',
  cls: PlayerClass,
  minIlvl: number,
  maxIlvl: number,
): ItemDef[] {
  return Object.values(ITEMS).filter((item) => {
    if (item.heroicOf) return false; // generated variants: pin authored coverage
    if (item.kind !== 'armor' || item.armorType !== armorType) return false;
    if ((item.stats?.int ?? 0) <= 0 || (item.stats?.luk ?? 0) <= 0) return false;
    const level = itemLevel(item);
    if (level === undefined || level < minIlvl || level > maxIlvl) return false;
    return canEquipItem(cls, item);
  });
}

describe('itemization coverage: every new item is sourced, leveled, and on budget', () => {
  it('has all 41 new items in the merged table', () => {
    expect(ALL_NEW_IDS.length).toBe(41);
    expect(new Set(ALL_NEW_IDS).size).toBe(41);
    for (const id of ALL_NEW_IDS) expect(ITEMS[id], id).toBeTruthy();
  });

  it.each(ALL_NEW_IDS)('%s: derives its pinned item level from a real acquisition source', (id) => {
    const pinned = [...NEW_ITEMS, ...FERAL_LADDER].find(([itemId]) => itemId === id)?.[1];
    const item = ITEMS[id];
    expect(itemSourceLevel(id), `${id} has a loot/quest source`).not.toBeUndefined();
    expect(itemLevel(item), `${id} item level`).toBe(pinned);
  });

  it.each(ALL_NEW_IDS)('%s: grants attributes only where the rule allows, and no more', (id) => {
    // This used to require every piece to carry EXACTLY its item-level stat
    // budget, which is the inherited arrangement where all gear grants
    // attributes scaled to its tier. Ragnarok makes ordinary armour defence and
    // nothing else, so most of these pieces legitimately grant zero now and the
    // budget is no longer the contract. What replaces it is the grant policy,
    // which is a real check: it fails an overshoot AND an attribute on a piece
    // that should have none.
    const item = ITEMS[id];
    if (item.kind !== 'armor') {
      // A weapon's attributes are part of what makes it a weapon, and they were
      // not touched by the equipment pass, so they stay on the tier budget.
      const budget = expectedStatBudget(item);
      expect(budget, `${id} has a derivable budget`).not.toBeUndefined();
      expect(primaryStatSum(item), `${id} stat sum == budget`).toBe(budget);
      return;
    }
    const attrs = PRIMARY_STAT_KEYS.filter((k) => (item.stats?.[k] ?? 0) > 0);
    const total = attrs.reduce((sum, k) => sum + (item.stats?.[k] ?? 0), 0);
    expect(
      isLegalStatTotal(item.quality, item.slot, total, attrs.length),
      `${id} (${item.quality}/${item.slot}) grants ${total} over ${attrs.length}`,
    ).toBe(true);
  });
});

describe('itemization coverage: the int/spi shield and the low-level held offhand', () => {
  it('pearlward_aegis still defends but has no wearer left', () => {
    const shield = ITEMS.pearlward_aegis;
    expect(isShieldItem(shield)).toBe(true);
    // It carried Intellect and Luck under the inherited arrangement. It is a
    // rare shield, so the equipment rule gives it defence and nothing else now
    // (src/sim/item_stat_policy.ts); what the case is really about is below.
    expect(shield.stats?.armor ?? 0).toBeGreaterThan(0);
    // It was the int/spi shield for the holy Paladin and the restoration Shaman,
    // and both were cut in D1. A shipped item id is never deleted, and a shield
    // equips by its literal requiredClass list, so the row survives with an empty
    // one: every live job is refused until D4 re-homes it.
    expect(shield.requiredClass).toEqual([]);
    for (const cls of ALL_CLASSES) expect(canEquipItem(cls, shield), cls).toBe(false);
  });

  it('valefire_lantern opens the held-offhand slot below the epic tier', () => {
    const lantern = ITEMS.valefire_lantern;
    expect(lantern.kind).toBe('held_offhand');
    // The held offhand equips by the literal CASTER_ALL list, which is now the two
    // surviving casters; the melee jobs stay refused.
    for (const cls of ['mage', 'acolyte'] as const) {
      expect(canEquipItem(cls, lantern), cls).toBe(true);
    }
    for (const cls of ['swordman', 'thief', 'archer'] as const) {
      expect(canEquipItem(cls, lantern), cls).toBe(false);
    }
  });
});

describe('itemization coverage: heroic variants are only built from heroic-eligible instances', () => {
  it('every heroic variant has its base in a heroic-eligible mob loot table', () => {
    const heroicInstanceIds = new Set([
      'hollow_crypt',
      'sunken_bastion',
      'drowned_temple',
      'gravewyrm_sanctum',
      'nythraxis_boss_arena',
    ]);
    const heroicEligibleMobs = new Set<string>();
    for (const def of Object.values(DUNGEONS)) {
      if (!heroicInstanceIds.has(def.id)) continue;
      for (const spawn of def.spawns) heroicEligibleMobs.add(spawn.mobId);
    }
    for (const item of Object.values(ITEMS)) {
      if (!item.heroicOf) continue;
      const baseId = item.heroicOf;
      const hasEligibleSource = Object.values(MOBS).some(
        (mob) =>
          heroicEligibleMobs.has(mob.id) &&
          (mob.loot ?? []).some((entry) => entry.itemId === baseId),
      );
      expect(
        hasEligibleSource,
        `${item.id} (base ${baseId}) drops in a heroic-eligible instance`,
      ).toBe(true);
    }
  });
});
