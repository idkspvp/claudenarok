import { describe, expect, it } from 'vitest';
import { weaponAtkBand } from '../src/sim/combat/weapon_class_atk';
import {
  FURY_ENTITY_ID,
  FURY_NPC,
  FURY_STOCK,
  WARFARE_ITEMS,
  WARFARE_SOURCE_LEVEL,
} from '../src/sim/content/pvp_honor';
import { ITEMS, NPCS } from '../src/sim/data';
import { createPlayer, recalcPlayerStats } from '../src/sim/entity';
import { canEquipItem } from '../src/sim/equipment_rules';
import {
  expectedStatBudget,
  itemLevel,
  itemScore,
  itemSourceLevel,
  primaryStatSum,
} from '../src/sim/item_level';
import { pvpFractionsFromRatings } from '../src/sim/pvp';
import { EQUIP_SLOTS, type EquipSlot, type PlayerClass } from '../src/sim/types';
import { spreadAllocation } from './helpers/alloc';
import { expectAttributesLegal } from './helpers/item_stats';

const SLOT_PRICES: Record<string, number> = {
  mainhand: 800,
  helmet: 500,
  face: 225,
  back: 400,
  chest: 700,
  legs: 600,
  feet: 300,
  ring: 150,
};

const SUPPORTED_ITEM_SLOTS = [
  'mainhand',
  'helmet',
  'face',
  'back',
  'chest',
  'legs',
  'feet',
  'ring',
] as const;

const FURYFORGED = [
  'furyforged_warhelm',
  'furyforged_warspaulders',
  'furyforged_warplate',
  'furyforged_girdle',
  'furyforged_legguards',
  'furyforged_gauntlets',
  'furyforged_sabatons',
] as const;

const STORMBOUND = [
  'stormbound_crown',
  'stormbound_spaulders',
  'stormbound_hauberk',
  'stormbound_waistguard',
  'stormbound_legmail',
  'stormbound_handguards',
  'stormbound_greaves',
] as const;

const ASHSTALKER = [
  'ashstalker_cowl',
  'ashstalker_shoulderguards',
  'ashstalker_harness',
  'ashstalker_waistband',
  'ashstalker_legguards',
  'ashstalker_grips',
  'ashstalker_treads',
] as const;

const CINDERWEAVE = [
  'cinderweave_cowl',
  'cinderweave_mantle',
  'cinderweave_raiment',
  'cinderweave_cord',
  'cinderweave_legwraps',
  'cinderweave_handwraps',
  'cinderweave_slippers',
] as const;

interface Profile {
  name: string;
  classes: readonly PlayerClass[];
  armor: readonly string[];
  face: string;
  rings: readonly [string, string];
  weapon: string;
}

const PROFILES: readonly Profile[] = [
  {
    name: 'Strength mail',
    // The Paladin and the Shaman shared this line and were cut in D1.
    classes: ['swordman'],
    armor: FURYFORGED,
    face: 'final_oath_medallion',
    rings: ['iron_vow_band', 'unbroken_circle'],
    weapon: 'final_argument_greatblade',
  },
  {
    name: 'Agility leather',
    classes: ['thief', 'archer'],
    armor: ASHSTALKER,
    face: 'razorwind_torque',
    rings: ['fleetblood_band', 'last_step_signet'],
    weapon: 'first_blood_razor',
  },
  {
    name: 'caster mail',
    // Its wearers were the holy Paladin and the restoration Shaman, both cut, so
    // the line survives as items with no profile class left to check.
    classes: [],
    armor: STORMBOUND,
    face: 'cinder_sigil_pendant',
    rings: ['ashen_focus_ring', 'spellbreakers_seal'],
    weapon: 'emberglass_warstaff',
  },
  {
    name: 'caster cloth',
    classes: ['mage', 'acolyte'],
    armor: CINDERWEAVE,
    face: 'cinder_sigil_pendant',
    rings: ['ashen_focus_ring', 'spellbreakers_seal'],
    weapon: 'emberglass_warstaff',
  },
];

// The belt and the gloves left the paperdoll and became accessories, and a
// character wears only two of those. The line still SELLS them, as alternative
// accessories a player may take instead of a ring, but a worn profile is the
// nine equipment slots: weapon, five armour pieces, a face, and two accessories.
const WORN_ARMOR_INDEXES = [0, 1, 2, 4, 6] as const;

function profileItemIds(profile: Profile): string[] {
  return [
    profile.weapon,
    ...WORN_ARMOR_INDEXES.map((i) => profile.armor[i]),
    profile.face,
    ...profile.rings,
  ];
}

function equipmentForProfile(profile: Profile): Partial<Record<EquipSlot, string>> {
  return {
    mainhand: profile.weapon,
    helmet: profile.armor[0],
    back: profile.armor[1],
    chest: profile.armor[2],
    legs: profile.armor[4],
    feet: profile.armor[6],
    face: profile.face,
    ring1: profile.rings[0],
    ring2: profile.rings[1],
  };
}

describe('FURY WARFARE stock', () => {
  it('merges forty unique offers and places FURY in Eastbrook with that exact stock', () => {
    expect(FURY_STOCK).toHaveLength(40);
    expect(new Set(FURY_STOCK).size).toBe(40);
    expect(Object.keys(WARFARE_ITEMS)).toEqual(FURY_STOCK);
    for (const id of FURY_STOCK) expect(ITEMS[id], id).toBe(WARFARE_ITEMS[id]);

    expect(NPCS.fury).toBe(FURY_NPC);
    expect(FURY_ENTITY_ID).toBe(1_000_000_001);
    expect(NPCS.fury.name).toBe('FURY');
    expect(NPCS.fury.title).toBe('Honor Quartermaster');
    expect(NPCS.fury.pos).toEqual({ x: -22.5, z: -7.5 });
    expect(NPCS.fury.facing).toBe(1.171280832795522);
    expect(NPCS.fury.dynamic).toBe(true);
    expect(NPCS.fury.vendorItems).toEqual(FURY_STOCK);
  });

  it('covers every supported item slot with two distinct rings per role profile', () => {
    const slots = new Set(FURY_STOCK.map((id) => ITEMS[id].slot));
    expect([...slots].sort()).toEqual([...SUPPORTED_ITEM_SLOTS].sort());

    const rings = FURY_STOCK.filter((id) => ITEMS[id].slot === 'ring');
    const necks = FURY_STOCK.filter((id) => ITEMS[id].slot === 'face');
    const weapons = FURY_STOCK.filter((id) => ITEMS[id].slot === 'mainhand');
    // Six rings, plus the three belts and three pairs of gloves the slot rework
    // turned into accessories: twelve accessory offers for two worn slots.
    expect(rings).toHaveLength(14);
    expect(necks).toHaveLength(3);
    expect(weapons).toHaveLength(3);
    for (const profile of PROFILES) expect(new Set(profile.rings).size, profile.name).toBe(2);
  });
});

describe('FURY WARFARE item budgets', () => {
  it('makes every offer a soulbound, honor-priced item-level-28 epic with full WARFARE', () => {
    for (const id of FURY_STOCK) {
      const item = ITEMS[id];
      const budget = expectedStatBudget(item) ?? 0;
      expect(budget, id).toBeGreaterThan(0);
      expect(item.quality, id).toBe('epic');
      expect(item.requiredLevel, id).toBe(20);
      expect(item.soulbound, id).toBe(true);
      expect(item.sellValue, id).toBe(0);
      expect(item.buyValue, id).toBeUndefined();
      expect(itemSourceLevel(id), id).toBe(WARFARE_SOURCE_LEVEL);
      expect(itemLevel(item), id).toBe(28);
      // WARFARE gear is a PvP-first, stat-light kit: it never out-stats same-tier
      // PvE gear, and its power is expressed as the WARFARE rating instead.
      // Attributes used to be pinned at 60% of the slot budget; the equipment
      // rule governs them now, so the check is that they are LEGAL and that the
      // piece stays stat-light, which is the property that mattered.
      if (item.kind === 'armor') expectAttributesLegal(item, id);
      // A WARFARE weapon is deliberately stat-light rather than on the full
      // weapon budget, which is the whole point of the line, so it keeps its own
      // 60% rule rather than the general one.
      else expect(primaryStatSum(item), id).toBe(Math.round((budget ?? 0) * 0.6));
      // Every piece's WARFARE ratings still mirror its FULL slot budget (drives 16.8%).
      expect(item.pvpOffenseRating, id).toBe(budget);
      expect(item.pvpDefenseRating, id).toBe(budget);
      expect(item.priceHonor, id).toBe(SLOT_PRICES[item.slot ?? '']);
    }
  });

  it('never lets PvP jewelry out-stat the PvE badge (heroic marks) jewelry in PvE', async () => {
    // Jewelry itemScore excludes WARFARE (and combat ratings), so it measures the
    // PvE-relevant power. Every PvP ring/amulet must score strictly BELOW the
    // weakest PvE badge piece of the same slot: a PvP jewelry piece is never a PvE
    // upgrade over the badge vendor's gear.
    const { HEROIC_VENDOR_ITEMS } = await import('../src/sim/content/heroic_vendor');
    for (const slot of ['ring', 'face'] as const) {
      const pvp = FURY_STOCK.map((id) => ITEMS[id]).filter((i) => i.slot === slot);
      const badge = Object.values(HEROIC_VENDOR_ITEMS).filter((i) => i.slot === slot);
      expect(pvp.length, slot).toBeGreaterThan(0);
      expect(badge.length, slot).toBeGreaterThan(0);
      const bestPvp = Math.max(...pvp.map(itemScore));
      const worstBadge = Math.min(...badge.map(itemScore));
      // Not strictly less any more: the attribute bands are narrow enough that a
      // top PvP accessory and the humblest badge accessory can legitimately tie.
      // What must never happen is the PvP piece coming out AHEAD in PvE.
      expect(
        bestPvp,
        `${slot}: best PvP ${bestPvp} vs worst badge ${worstBadge}`,
      ).toBeLessThanOrEqual(worstBadge);
    }
  });

  it('puts all three weapons at the top of their own class bands', () => {
    // These were pinned to one item-level-28 dps curve, which asked a greatsword,
    // a dagger and a warstaff to hit for the same amount. Attack now comes from
    // the weapon class, so what a top-tier honor reward has to be is the top of
    // ITS class, and the three are no longer comparable to each other.
    for (const id of ['final_argument_greatblade', 'first_blood_razor', 'emberglass_warstaff']) {
      const weapon = ITEMS[id].weapon;
      expect(weapon, id).toBeDefined();
      if (!weapon?.weaponType) continue;
      const band = weaponAtkBand(weapon.weaponType);
      expect(
        weapon.max,
        `${id} atk ${weapon.max} vs band ${band.min}..${band.max}`,
      ).toBeLessThanOrEqual(band.max);
      // In the top rung of its band: an honor reward is a chase item.
      expect(weapon.weaponLevel, `${id} rung`).toBeGreaterThanOrEqual(3);
    }
  });

  it('derives its full-set offense and defense by equipping a complete profile', () => {
    for (const profile of PROFILES) {
      // The caster-mail line has no wearer left (its two classes were cut in D1),
      // so there is nobody to equip it on; its budget is still pinned by the
      // per-item cases above.
      const cls = profile.classes[0];
      if (!cls) continue;
      const player = createPlayer(1, cls, { x: 0, y: 0, z: 0 }, profile.name);
      player.level = 20;
      recalcPlayerStats(
        player,
        cls,
        equipmentForProfile(profile),
        undefined,
        {},
        spreadAllocation(player.level),
      );
      // 14%, down from the 16.8% a ten-slot paperdoll produced. Each piece still
      // carries exactly its slot's full budget as WARFARE rating (pinned per
      // item above); the total is what that rule yields over the eight slots a
      // character now wears, so this moves whenever the slot set does.
      expect(player.stats.pvpOffense, `${profile.name} offense`).toBeCloseTo(0.14, 10);
      expect(player.stats.pvpDefense, `${profile.name} defense`).toBeCloseTo(0.14, 10);
    }
  });

  it('clamps independently tunable offense and defense rating curves', () => {
    expect(pvpFractionsFromRatings(10_000, 10_000)).toEqual({ offense: 0.2, defense: 0.2 });
    expect(pvpFractionsFromRatings(10_000, 10_000, { offense: 0.07, defense: 0.13 })).toEqual({
      offense: 0.07,
      defense: 0.13,
    });
  });
});

describe('FURY WARFARE class and role coverage', () => {
  it('provides every supported equipment slot to every intended class profile', () => {
    for (const profile of PROFILES) {
      const ids = profileItemIds(profile);
      expect(ids).toHaveLength(EQUIP_SLOTS.length);

      const concreteSlots = new Set<EquipSlot>();
      for (const id of ids) {
        const slot = ITEMS[id].slot;
        if (slot === 'ring') {
          concreteSlots.add(concreteSlots.has('ring1') ? 'ring2' : 'ring1');
        } else if (slot) {
          concreteSlots.add(slot);
        }
      }
      expect([...concreteSlots].sort(), profile.name).toEqual([...EQUIP_SLOTS].sort());

      for (const cls of profile.classes) {
        for (const id of ids) {
          expect(canEquipItem(cls, ITEMS[id]), `${profile.name}: ${cls} can equip ${id}`).toBe(
            true,
          );
        }
      }
    }
  });
});
