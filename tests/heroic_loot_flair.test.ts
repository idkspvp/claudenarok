// Heroic loot flair: when a mob dies in a HEROIC dungeon instance, its normal
// epic/rare drops are swapped for a "Heroic" variant (epic -> item level 28,
// rare -> 25, same name as the base with an "[HEROIC]" tooltip tag), while
// green/uncommon drops and the existing
// item-level-31 heroic set are untouched.
import { describe, expect, it } from 'vitest';
import { weaponAtkBand, weaponLevelFor } from '../src/sim/combat/weapon_class_atk';
import { heroicVariantId } from '../src/sim/content/heroic_variants';
import { ITEMS, MOBS } from '../src/sim/data';
import { enterDungeon } from '../src/sim/instances/dungeons';
import { expectedStatBudget, itemLevel, primaryStatSum } from '../src/sim/item_level';
import { Sim } from '../src/sim/sim';
import type { Entity, ItemDef } from '../src/sim/types';
import { itemDisplayName } from '../src/ui/entity_i18n';

type AnySim = Sim & Record<string, any>;
type AnyEntity = Entity & Record<string, any>;

const variants = () => Object.values(ITEMS).filter((i) => i.heroicOf);
const weaponPower = (item: ItemDef) => {
  const weapon = item.weapon;
  return weapon ? (weapon.min + weapon.max) / 2 / weapon.speed : null;
};

describe('heroic loot flair: variant generation', () => {
  it('generates a Heroic variant for base epic/rare/legendary drops at or above its tier budget', () => {
    // Five-man heroic variants read item level 28 (epic) / 25 (rare). The Nythraxis
    // raid boss's own set pieces and legendaries are one tier up: epics at 33,
    // legendaries at 37 (anchored on the raid boss's normal loot).
    const raidBases = new Set(
      (MOBS.nythraxis_scourge_of_thornpeak?.loot ?? []).flatMap((e: any) =>
        e.itemId ? [e.itemId] : [],
      ),
    );
    const all = variants();
    expect(all.length).toBeGreaterThan(0);
    for (const v of all) {
      expect(['epic', 'rare', 'legendary']).toContain(v.quality);
      if (raidBases.has(v.heroicOf ?? '')) {
        expect(itemLevel(v), v.id).toBe(v.quality === 'legendary' ? 37 : 33);
      } else {
        expect(itemLevel(v), v.id).toBe(v.quality === 'epic' ? 28 : 25);
      }
      // A base item already above the generated budget must retain that extra power.
      expect(primaryStatSum(v)).toBeGreaterThanOrEqual(expectedStatBudget(v) ?? 0);
    }
  });

  it('never lowers realized primary-stat or weapon power below its base item', () => {
    const primaryStatDowngrades: string[] = [];
    const weaponDowngrades: string[] = [];
    for (const variant of variants()) {
      if (!variant.heroicOf) continue;
      const base = ITEMS[variant.heroicOf];
      const baseStats = primaryStatSum(base);
      const variantStats = primaryStatSum(variant);
      if (variantStats < baseStats) {
        primaryStatDowngrades.push(`${variant.id}: ${baseStats} -> ${variantStats}`);
      }
      const baseWeaponPower = weaponPower(base);
      const variantWeaponPower = weaponPower(variant);
      if (
        baseWeaponPower !== null &&
        variantWeaponPower !== null &&
        variantWeaponPower < baseWeaponPower
      ) {
        weaponDowngrades.push(
          `${variant.id}: ${baseWeaponPower.toFixed(3)} -> ${variantWeaponPower.toFixed(3)}`,
        );
      }
    }

    expect({ primaryStatDowngrades, weaponDowngrades }).toEqual({
      primaryStatDowngrades: [],
      weaponDowngrades: [],
    });
  });

  it("preserves Moonwrack Robe's 15 primary-stat points in its Heroic variant", () => {
    const base = ITEMS.moonshroud_robe;
    const variant = ITEMS[heroicVariantId(base.id)];
    expect({ base: primaryStatSum(base), heroic: primaryStatSum(variant) }).toEqual({
      base: 15,
      heroic: 15,
    });
  });

  it('shares the base item name (the heroic distinction is a tooltip tag, not a name prefix)', () => {
    const v = ITEMS[heroicVariantId('deathlord_warplate')];
    expect(v).toBeDefined();
    expect(itemDisplayName(v)).toBe(itemDisplayName(ITEMS.deathlord_warplate));
  });

  it('leaves green/uncommon drops without a variant', () => {
    // boneplate_vest is an uncommon Korzul drop: no Heroic upgrade.
    expect(ITEMS[heroicVariantId('boneplate_vest')]).toBeUndefined();
  });

  it('upgrades a Nythraxis raid set piece to its raid-tier heroic variant (33 over 29)', () => {
    const base = ITEMS.crownforged_dreadhelm; // Nythraxis raid epic, item level 29
    expect(itemLevel(base)).toBe(29);
    const v = ITEMS[heroicVariantId('crownforged_dreadhelm')];
    expect(v).toBeDefined();
    // The raid boss's set pieces upgrade to the raid tier (33), a genuine upgrade
    // over the 29 base, so the heroic swap applies rather than skipping.
    expect(itemLevel(v)).toBe(33);
    expect(itemLevel(v)! > itemLevel(base)!).toBe(true);
  });
});

// Weapon attack used to be one universal curve read off item level, so a rod and
// a two-handed sword of the same tier hit for the same amount and the tier was
// the only thing that mattered. Ragnarok's model replaced it: attack comes from
// the weapon CLASS, and a caster's rod is deliberately the weakest thing in the
// game to hold because a caster's damage is MATK. What these cases pin is the
// class band, which is the contract an authoring mistake actually violates.
describe('weapon attack sits in its own class band', () => {
  const authored = () => Object.values(ITEMS).filter((i) => i.weapon && !i.heroicOf);

  it('gives every authored weapon a class and a refine rung', () => {
    const all = authored();
    expect(all.length).toBeGreaterThan(100);
    for (const i of all) {
      expect(i.weapon?.weaponType, i.id).toBeDefined();
      expect(i.weapon?.weaponLevel, i.id).toBeGreaterThanOrEqual(1);
      expect(i.weapon?.weaponLevel, i.id).toBeLessThanOrEqual(4);
    }
  });

  it('keeps every one inside the measured band for its class', () => {
    for (const i of authored()) {
      const w = i.weapon!;
      const band = weaponAtkBand(w.weaponType!);
      expect(
        w.max,
        `${i.id} (${w.weaponType}) atk ${w.max} vs ${band.min}..${band.max}`,
      ).toBeGreaterThanOrEqual(band.min);
      expect(
        w.max,
        `${i.id} (${w.weaponType}) atk ${w.max} vs ${band.min}..${band.max}`,
      ).toBeLessThanOrEqual(band.max);
      // The rung is derived from where in the band the weapon fell, so a record
      // whose two fields disagree was hand-edited without re-deriving one.
      expect(w.weaponLevel, `${i.id} rung`).toBe(weaponLevelFor(w.weaponType!, w.max));
    }
  });

  it('puts the caster band under the melee band and the 2H band over both', () => {
    // The claim the old item-level curve could not express, stated as whole
    // classes rather than as a pair of chosen items. Compared best-to-best,
    // because the bands are meant to OVERLAP at their edges: a top rod really
    // does out-attack a starter greatsword in Ragnarok, and only the ceilings
    // are ordered.
    const best = (t: 'rod' | 'sword' | 'twohand_sword') =>
      Math.max(
        ...authored()
          .filter((i) => i.weapon?.weaponType === t)
          .map((i) => i.weapon!.max),
      );
    expect(best('rod')).toBeLessThan(best('sword'));
    expect(best('sword')).toBeLessThan(best('twohand_sword'));
    // And the ceilings are far enough apart to be a real choice, not noise.
    expect(best('twohand_sword')).toBeGreaterThan(best('rod') * 2);
  });

  it('still ranks the tiers inside one class', () => {
    // Losing the universal curve must not cost the ladder: a heroic set weapon
    // is still the best of its own class line.
    const wl = (id: string) => ITEMS[id].weapon!.max;
    expect(wl('kingsbane_last_oath')).toBeGreaterThan(wl('crossroads_saber'));
    expect(wl('deathless_greatblade')).toBeGreaterThan(wl('wyrmfang_greatblade'));
  });
});

describe('heroic loot flair: the drop swap in a heroic instance', () => {
  function killKorzul(difficulty: 'normal' | 'heroic'): any[] {
    const sim = new Sim({ seed: 7, playerClass: 'swordman', noPlayer: true }) as AnySim;
    const pid = sim.addPlayer('swordman', 'Solo');
    if (difficulty === 'heroic') sim.setDungeonDifficulty('heroic', pid);
    enterDungeon(sim.ctx, 'gravewyrm_sanctum', pid);
    const inst = (sim.instances as any[]).find(
      (i) =>
        i.dungeonId === 'gravewyrm_sanctum' && i.difficulty === difficulty && i.partyKey !== null,
    );
    const korzul = inst.mobIds
      .map((id: number) => sim.entities.get(id))
      .find((e: AnyEntity | undefined) => e?.templateId === 'korzul_the_gravewyrm') as AnyEntity;
    const p = sim.entities.get(pid) as AnyEntity;
    p.pos = { x: korzul.pos.x + 1, y: korzul.pos.y, z: korzul.pos.z };
    p.prevPos = { ...p.pos };
    sim.rebucket(p);
    (sim as any).dealDamage(p, korzul, korzul.hp + 100, false, 'physical', null, 'hit');
    return (korzul.loot?.items ?? []) as any[];
  }

  it('never leaves a swappable base epic un-upgraded on a heroic kill', () => {
    const items = killKorzul('heroic');
    for (const s of items) {
      const def = ITEMS[s.itemId];
      if (!def || def.heroicOf) continue; // variants are already upgraded
      // any base epic that HAS a variant must have been swapped, not dropped raw
      const variant = ITEMS[heroicVariantId(s.itemId)];
      const isUpgrade = variant && (itemLevel(variant) ?? 0) > (itemLevel(def) ?? 0);
      expect(isUpgrade, `un-swapped base epic leaked: ${s.itemId}`).toBeFalsy();
    }
  });

  it('drops base (un-swapped) epics on a normal kill', () => {
    const items = killKorzul('normal');
    // no heroic variant ids appear on a normal difficulty corpse
    expect(items.some((s) => ITEMS[s.itemId]?.heroicOf)).toBe(false);
  });
});
