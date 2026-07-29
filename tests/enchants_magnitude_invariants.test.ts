// Table-wide magnitude invariants for the enchant table (the finishing-bonus
// convention stated in the header of src/sim/content/enchants.ts). The
// aggregate stacks and the tier ladder are enforced here rather than
// eyeballed, because resolveApplyEnchant bakes statBonus into the item
// instance at apply time: an oversized table cannot be walked back after
// launch without stranding grandfathered items, so the table's power level
// has to be pinned before players can enchant at all.

import { describe, expect, it } from 'vitest';
import { classHealthMultiplier } from '../src/sim/combat/class_health_map';
import { ENCHANTS, type EnchantDef } from '../src/sim/content/enchants';
import { CLASSES } from '../src/sim/data';
import { resolveApplyEnchant } from '../src/sim/professions/enchanting';
import { Sim } from '../src/sim/sim';
import { maxHealth } from '../src/sim/stats/resources';
import { xpForLevel } from '../src/sim/types';

type Axis = 'str' | 'agi' | 'vit' | 'int' | 'luk' | 'armor';
const AXES: readonly Axis[] = ['str', 'agi', 'vit', 'int', 'luk', 'armor'];

// Tier identity is derived from the reagent contract, exactly the doctrine the
// table's section comments state: Greater is the arcane_shard consumer, Runed
// consumes a resonant_* typed disenchant secondary, base is everything else.
const isGreater = (e: EnchantDef) => e.reagents.some((r) => r.itemId === 'arcane_shard');
const isRuned = (e: EnchantDef) => e.reagents.some((r) => r.itemId.startsWith('resonant_'));
const isBase = (e: EnchantDef) => !isGreater(e) && !isRuned(e);

const axisOf = (e: EnchantDef): Axis => AXES.filter((a) => (e.statBonus[a] ?? 0) > 0)[0];

/** Best statBonus value on `axis` among enchants passing `include`, per slot,
 *  summed with the ring slot counted twice (a character wears two rings). */
function bestPerSlotTotal(axis: Axis, include: (e: EnchantDef) => boolean = () => true): number {
  const bySlot = new Map<string, number>();
  for (const e of Object.values(ENCHANTS)) {
    if (!include(e)) continue;
    const v = e.statBonus[axis] ?? 0;
    if (v <= 0) continue;
    bySlot.set(e.itemSlot, Math.max(bySlot.get(e.itemSlot) ?? 0, v));
  }
  let total = 0;
  for (const [slot, v] of bySlot) total += slot === 'ring' ? v * 2 : v;
  return total;
}

/** Best value on `slot`+`axis` among enchants passing `include`, 0 when none. */
function bestValue(slot: string, axis: Axis, include: (e: EnchantDef) => boolean): number {
  let best = 0;
  for (const e of Object.values(ENCHANTS)) {
    if (e.itemSlot !== slot || !include(e)) continue;
    best = Math.max(best, e.statBonus[axis] ?? 0);
  }
  return best;
}

describe('enchant table magnitude invariants', () => {
  it('every enchant grants exactly one stat axis (the tier and stack sweeps below rely on it)', () => {
    for (const e of Object.values(ENCHANTS)) {
      // Nonzero, not positive: a negative side axis would slip past the
      // positive-only filters in axisOf and bestPerSlotTotal unseen.
      const axes = AXES.filter((a) => (e.statBonus[a] ?? 0) !== 0);
      expect(axes, e.id).toHaveLength(1);
      expect(e.statBonus[axes[0]] ?? 0, e.id).toBeGreaterThan(0);
    }
  });

  it('the best-per-slot stack per axis (rings twice) stays at the finishing-bonus totals', () => {
    // The belt and glove enchants became ACCESSORY enchants when those slots
    // became accessories, so they compete for one slot instead of holding two,
    // and the best of them is then counted twice for the two accessory slots.
    // That moved every axis, which is why the percentages below are the shape
    // to trust rather than the exact figures.
    //
    // Sized against the recomputed level-20 BiS gear budgets (best item per
    // equip slot across the live tables, dual wield and masterwork variants
    // included): str 125, agi 130, sta 113, int 120, spi 93. The enchant
    // layer lands at roughly 15 to 25 percent of that budget per axis, the
    // "finishing bonus" target, instead of the pre-trim 30 to 43 percent.
    expect(bestPerSlotTotal('int')).toBe(23); // one slot fewer since the equipment rework
    expect(bestPerSlotTotal('vit')).toBe(27); // 21 percent of the 113 sta budget; the HP pin below covers the x10 conversion
    expect(bestPerSlotTotal('agi')).toBe(24); // 19 percent of the 130 agi budget
    expect(bestPerSlotTotal('str')).toBe(15); // 15 percent of the 125 str budget
    // Spirit rides only neck, chest, and the two rings, so its stack sits
    // below the band by construction; accepted and recorded rather than
    // padded with new enchants.
    expect(bestPerSlotTotal('luk')).toBe(12); // 13 percent of the 93 spi budget
    // Helmet 2 plus chest 3, the reinforcement pair on Ragnarok's defence
    // scale. These were 15 and 20 while armour was an unbounded pool; on a
    // scale whose cap is 100 and whose best-in-slot total is 74, a single
    // enchant worth 20 was a fifth of every physical hit.
    expect(bestPerSlotTotal('armor')).toBe(5);
  });

  it('every Greater enchant beats the best base option on its slot and axis by at least 3', () => {
    // If the shard tier collapses to a point or two over base, nobody
    // disenchants an epic and the arcane_shard sink dies.
    const greaters = Object.values(ENCHANTS).filter(isGreater);
    expect(greaters.map((e) => e.id).sort()).toEqual([
      'enchant_chest_greater_stamina',
      'enchant_gloves_greater_agility',
      'enchant_helmet_greater_fortitude',
      'enchant_legs_greater_stamina',
      'enchant_weapon_greater_might',
      'enchant_weapon_greater_spellpower',
    ]);
    for (const g of greaters) {
      const axis = axisOf(g);
      const base = bestValue(g.itemSlot, axis, isBase);
      expect(base, `${g.id}: base sibling exists`).toBeGreaterThan(0);
      expect((g.statBonus[axis] ?? 0) - base, `${g.id}: step over base`).toBeGreaterThanOrEqual(3);
    }
  });

  it('every Runed enchant sits strictly between base and Greater on its slot and axis', () => {
    const runed = Object.values(ENCHANTS).filter(isRuned);
    expect(runed.map((e) => e.id).sort()).toEqual([
      'enchant_chest_runeweave',
      'enchant_helmet_runed_links',
      'enchant_legs_runed_hide',
      'enchant_weapon_runed_edge',
      'enchant_weapon_runed_focus',
    ]);
    for (const r of runed) {
      const axis = axisOf(r);
      const v = r.statBonus[axis] ?? 0;
      const base = bestValue(r.itemSlot, axis, isBase);
      const greater = bestValue(r.itemSlot, axis, isGreater);
      if (base > 0) expect(v, `${r.id}: above base`).toBeGreaterThan(base);
      if (greater > 0) expect(v, `${r.id}: below Greater`).toBeLessThan(greater);
    }
    // Two runed rows lack a full ladder on their own slot and axis, so the
    // relational sweep above cannot see them regress: chest spirit has no
    // Greater (runeweave is the chest spirit ceiling) and legs agility has no
    // sibling at all. Pin their magnitudes as literals.
    expect(ENCHANTS.enchant_chest_runeweave.statBonus).toEqual({ luk: 5 });
    expect(ENCHANTS.enchant_legs_runed_hide.statBonus).toEqual({ agi: 4 });
  });
});

describe('the full stamina path in HP', () => {
  it('enchanting every stamina slot adds 24 Vitality, and 24% to the pool', () => {
    const sim = new Sim({ seed: 7, playerClass: 'swordman', autoEquip: false });
    const pid = sim.playerId;
    while (sim.player.level < 20) sim.grantXp(xpForLevel(sim.player.level));
    expect(sim.player.level).toBe(20);

    // The best stamina path: Greater on helmet, chest, and legs, base on the
    // two slots without a Greater. The gear pieces are ordinary armor a
    // swordman can wear; their own stats cancel out of the delta below.
    const GEAR = [
      ['cryptbone_helm', 'helmet', 'enchant_helmet_greater_fortitude'],
      // Not recruit_tunic: the player spawns already wearing one (even with
      // autoEquip false), so equipping a bag copy just swaps with the worn
      // copy and the bag-empty probe below would see the displaced one.
      ['apprentice_robe', 'chest', 'enchant_chest_greater_stamina'],
      ['quilted_trousers', 'legs', 'enchant_legs_greater_stamina'],
      ['oiled_boots', 'feet', 'enchant_feet_stamina'],
      // The belt is an accessory since the equipment rework, so it is enchanted
      // and worn in an accessory slot rather than a waist slot of its own. It
      // stays in the sweep because it is still a stamina slot.
      ['mistveil_cord', 'ring1', 'enchant_waist_stamina'],
    ] as const;

    for (const [itemId] of GEAR) {
      sim.addItem(itemId, 1, pid);
      sim.equipItem(itemId);
      // countItem scans bags only, so 0 here proves the piece went on.
      expect(sim.countItem(itemId, pid), itemId).toBe(0);
    }
    const vitBefore = sim.player.stats.vit;
    const hpBefore = sim.player.maxHp;
    // Vitality MULTIPLIES the pool at 1% a point (vitHealthMultiplier in
    // src/sim/entity.ts); it no longer adds a flat 10 HP past a soft knee. So the
    // 24-point stack is worth 24% of whatever pool the character has, not a fixed
    // 240 HP, and its value scales with the class and level wearing it. Derive the
    // expected gain from the pool the character actually has, so the pin survives
    // a pool retune while still catching a change in the enchant magnitudes.
    // Run the health formula rather than reading a per-class pool: there is no
    // per-job table any more, just one quadratic and a class multiplier.
    const poolAt = (vit: number) =>
      maxHealth({
        level: sim.player.level,
        vit,
        archetypeMultiplier: classHealthMultiplier('swordman'),
      });
    expect(poolAt(vitBefore)).toBe(hpBefore);
    const expectedHp = poolAt(vitBefore + 24);

    sim.addItem('arcane_shard', 3, pid);
    sim.addItem('arcane_essence', 8, pid);
    sim.addItem('arcane_dust', 8, pid);
    for (const [itemId, slot, enchantId] of GEAR) {
      expect(sim.unequipItem(slot), slot).toBe(true);
      const applied = resolveApplyEnchant(sim.ctx, pid, itemId, enchantId);
      expect(applied.ok, enchantId).toBe(true);
      sim.equipItem(itemId);
      expect(sim.countItem(itemId, pid), itemId).toBe(0);
    }
    expect(sim.player.stats.vit).toBe(vitBefore + 24);
    expect(sim.player.maxHp).toBe(expectedHp);
    // And it is a real, substantial gain, not a rounding artifact: a full stamina
    // enchant pass is worth roughly a fifth of the character's health.
    expect(sim.player.maxHp - hpBefore).toBeGreaterThan(hpBefore * 0.15);
  });
});

// The frozen-magnitude ledger (#2415). The enchant replace arm subtracts the
// OLD enchant's CURRENT content magnitudes back out of the payload
// (replacedEnchantPayloadFor), which is exact only while every shipped
// magnitude stays byte-frozen after launch, the standing rule
// content/enchants.ts declares. This pins EVERY id's statBonus to a literal,
// so editing any shipped magnitude is a deliberate red test here first: a
// nerf would leave permanent residue on every already-replaced copy (and
// break structural stacking with fresh peers), a buff would delete masterwork
// baked stats on the same axis via the <= 0 prune. A NEW enchant id extends
// this table in the same change; an EDITED magnitude needs a migration story
// for saved payloads before this pin may move.
describe('frozen enchant magnitudes (the #2415 replace-exactness premise)', () => {
  it('pins every shipped statBonus to a literal, byte for byte', () => {
    const all = Object.fromEntries(
      Object.values(ENCHANTS).map((enchant) => [enchant.id, enchant.statBonus]),
    );
    expect(all).toEqual({
      enchant_weapon_might: { str: 2 },
      enchant_weapon_intellect: { int: 2 },
      enchant_helmet_fortitude: { vit: 3 },
      enchant_neck_spirit: { luk: 3 },
      enchant_shoulder_agility: { agi: 2 },
      enchant_chest_stamina: { vit: 4 },
      enchant_waist_stamina: { vit: 3 },
      enchant_legs_stamina: { vit: 3 },
      enchant_gloves_agility: { agi: 3 },
      enchant_gloves_intellect: { int: 3 },
      enchant_feet_agility: { agi: 2 },
      enchant_ring_spirit: { luk: 2 },
      enchant_weapon_agility: { agi: 2 },
      enchant_helmet_intellect: { int: 4 },
      enchant_helmet_armor: { armor: 2 },
      enchant_neck_intellect: { int: 2 },
      enchant_neck_agility: { agi: 2 },
      enchant_shoulder_strength: { str: 2 },
      enchant_shoulder_intellect: { int: 2 },
      enchant_chest_spirit: { luk: 4 },
      enchant_chest_armor: { armor: 3 },
      enchant_waist_strength: { str: 3 },
      enchant_waist_agility: { agi: 3 },
      enchant_legs_intellect: { int: 4 },
      enchant_gloves_strength: { str: 3 },
      enchant_feet_strength: { str: 2 },
      enchant_feet_stamina: { vit: 2 },
      enchant_ring_strength: { str: 2 },
      enchant_ring_agility: { agi: 2 },
      enchant_ring_intellect: { int: 2 },
      enchant_weapon_greater_might: { str: 5 },
      enchant_weapon_greater_spellpower: { int: 5 },
      enchant_helmet_greater_fortitude: { vit: 6 },
      enchant_chest_greater_stamina: { vit: 7 },
      enchant_legs_greater_stamina: { vit: 6 },
      enchant_gloves_greater_agility: { agi: 6 },
      enchant_weapon_runed_edge: { str: 3 },
      enchant_weapon_runed_focus: { int: 3 },
      enchant_chest_runeweave: { luk: 5 },
      enchant_legs_runed_hide: { agi: 4 },
      enchant_helmet_runed_links: { vit: 5 },
    });
  });
});
