// The three Ragnarok classifications, authored onto the world.
//
// The machinery for these was built and then sat inert: every attribute, the
// four attribute levels, the full damage chart, the ten races and the weapon
// size table were all implemented, and every auto-attack called into them, but
// nothing carried a tag so the multiplier was always 1. What these cases pin is
// that the world is TAGGED, and that the tagging makes the chart do something
// a player can feel.

import { describe, expect, it } from 'vitest';
import { attributeMultipliers } from '../src/sim/combat/attribute_damage';
import { ELEMENT_LEVELS, ELEMENTS, RACES, SIZES } from '../src/sim/combat/elements';
import { ITEMS, MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';

const roster = () => Object.values(MOBS);
const spawn = (id: string) => createMob(1, MOBS[id], MOBS[id].minLevel, { x: 0, y: 0, z: 0 });

describe('every monster is classified', () => {
  it('carries a race, an attribute, an attribute level and a size', () => {
    const all = roster();
    expect(all.length).toBeGreaterThan(100);
    for (const mob of all) {
      expect(ELEMENTS, `${mob.id} element`).toContain(mob.element);
      expect(RACES, `${mob.id} race`).toContain(mob.race);
      expect(SIZES, `${mob.id} size`).toContain(mob.size);
      expect(ELEMENT_LEVELS, `${mob.id} element level`).toContain(mob.elementLevel);
    }
  });

  it('carries the tags onto the spawned entity, not just the template', () => {
    // The failure this catches is the one the whole phase existed to fix: data
    // authored on a template that never reaches the thing being hit.
    const mob = spawn('raised_bonewalker');
    expect(mob.element).toBe(MOBS.raised_bonewalker.element);
    expect(mob.race).toBe(MOBS.raised_bonewalker.race);
    expect(mob.size).toBe(MOBS.raised_bonewalker.size);
    expect(mob.elementLevel).toBe(MOBS.raised_bonewalker.elementLevel);
  });

  it('spreads across attributes and races rather than defaulting everything', () => {
    // A pass that tagged everything neutral formless medium would satisfy the
    // case above and mean nothing.
    const elements = new Set(roster().map((m) => m.element));
    const races = new Set(roster().map((m) => m.race));
    const sizes = new Set(roster().map((m) => m.size));
    expect(elements.size).toBeGreaterThanOrEqual(6);
    expect(races.size).toBeGreaterThanOrEqual(6);
    expect(sizes.size).toBe(3);
    // And no single attribute swallows the roster.
    for (const element of elements) {
      const share = roster().filter((m) => m.element === element).length / roster().length;
      expect(share, `${element} share`).toBeLessThan(0.35);
    }
  });

  it('scales the attribute level with how much of a fight the monster is', () => {
    for (const mob of roster()) {
      if (mob.worldBoss) expect(mob.elementLevel, mob.id).toBe(4);
      else if (mob.boss) expect(mob.elementLevel, mob.id).toBe(3);
      else if (mob.elite) expect(mob.elementLevel, mob.id).toBe(2);
      else expect(mob.elementLevel, mob.id).toBe(1);
    }
  });
});

describe('the chart is live, not inert', () => {
  it('makes fire punish the risen dead and bounce off the drowned', () => {
    const el = (attack: 'fire' | 'water', id: string) => {
      const mob = spawn(id);
      return attributeMultipliers({
        attackElement: attack,
        defenderElement: mob.element,
        defenderElementLevel: mob.elementLevel,
      }).element;
    };
    expect(el('fire', 'raised_bonewalker')).toBeGreaterThan(1);
    expect(el('fire', 'drowned_thrall')).toBeLessThan(1);
    expect(el('water', 'drowned_thrall')).toBeLessThan(el('fire', 'drowned_thrall'));
  });

  it('makes a dagger glance off something large and a hammer not care', () => {
    const ogre = spawn('thornpeak_ogre');
    expect(ogre.size).toBe('large');
    const size = (weaponType: 'dagger' | 'mace') =>
      attributeMultipliers({ weaponType, defenderSize: ogre.size }).size;
    expect(size('dagger')).toBeLessThan(size('mace'));
    expect(size('dagger')).toBeLessThan(1);
  });

  it('leaves an unmarked swing at the even trade', () => {
    // Neutral against neutral is the baseline the whole game sat at before the
    // world was tagged, and it has to stay exactly 1 or every unelemental fight
    // silently rebalances.
    const m = attributeMultipliers({ defenderElement: 'neutral', defenderElementLevel: 1 });
    expect(m.element).toBe(1);
  });
});

describe('elemental weapons are rare, the way they are in the reference', () => {
  const weapons = () => Object.values(ITEMS).filter((i) => i.weapon && !i.heroicOf);

  it('marks only a small share of weapons with an attribute', () => {
    const all = weapons();
    const elemental = all.filter((i) => i.weapon?.element);
    expect(elemental.length).toBeGreaterThan(0);
    // The reference sits at 6%. Held loosely on both sides: the point is that an
    // elemental weapon is a FIND, not that the share hits a figure.
    expect(elemental.length / all.length).toBeLessThan(0.15);
  });

  it('keeps them at the tiers worth chasing', () => {
    for (const item of weapons()) {
      if (!item.weapon?.element) continue;
      expect(['uncommon', 'rare', 'epic', 'legendary'], item.id).toContain(item.quality);
    }
  });

  it('actually changes what a weapon does to a given monster', () => {
    // An elemental weapon that never reaches the chart is the inert case again.
    const blade = ITEMS.emberfang_warblade;
    expect(blade.weapon?.element).toBe('fire');
    const bonewalker = spawn('raised_bonewalker');
    const withElement = attributeMultipliers({
      attackElement: blade.weapon?.element,
      defenderElement: bonewalker.element,
      defenderElementLevel: bonewalker.elementLevel,
    }).element;
    const plain = attributeMultipliers({
      defenderElement: bonewalker.element,
      defenderElementLevel: bonewalker.elementLevel,
    }).element;
    expect(withElement).toBeGreaterThan(plain);
  });
});
