import { describe, expect, it } from 'vitest';
import { createPlayer, recalcPlayerStats, statusMagicPower } from '../src/sim/entity';
import { emptyModifiers, type PlayerModifiers } from '../src/sim/player_modifiers';
import type { PlayerClass } from '../src/sim/types';
import { spreadAllocation } from './helpers/alloc';

// recalcPlayerStats is the ONE place derived stats are computed (src/sim/CLAUDE.md). These
// lock the primary-attribute multipliers (strPct/agiPct/intPct/lukPct) in the shared
// modifier vocabulary (src/sim/player_modifiers.ts): the multiplier
// must reach the fully-summed attribute AND flow into everything derived from it
// (agiPct -> armor/dodge, intPct -> Spell Power, strPct -> attack power, dexPct ->
// ranged AP, lukPct -> crit).
//
// Every character here carries the class's suggested spread for its level. Without
// one they would sit at 1 in all six, where a +10% multiplier rounds back to the
// same 1 and every assertion below passes or fails by accident.

interface Derived {
  str: number;
  agi: number;
  vit: number;
  int: number;
  dex: number;
  luk: number;
  maxHp: number;
  armor: number;
  attackPower: number;
  rangedPower: number;
  spellPower: number;
  crit: number;
  dodge: number;
  flee: number;
  hit: number;
}

function derive(cls: PlayerClass, level: number, mut?: (m: PlayerModifiers) => void): Derived {
  const e = createPlayer(0, cls, { x: 0, y: 0, z: 0 }, 'Test');
  e.level = level;
  let mods: PlayerModifiers | undefined;
  if (mut) {
    mods = emptyModifiers();
    mut(mods);
  }
  recalcPlayerStats(e, cls, {}, mods, {}, spreadAllocation(level));
  return {
    str: e.stats.str,
    agi: e.stats.agi,
    vit: e.stats.vit,
    int: e.stats.int,
    dex: e.stats.dex,
    luk: e.stats.luk,
    maxHp: e.maxHp,
    armor: e.stats.armor,
    attackPower: e.attackPower,
    rangedPower: e.rangedPower,
    spellPower: e.spellPower,
    crit: e.critChance,
    dodge: e.dodgeChance,
    flee: e.flee,
    hit: e.hit,
  };
}

describe('recalcPlayerStats primary-attribute multipliers', () => {
  it('agiPct scales Agility and everything derived from it', () => {
    const base = derive('archer', 40);
    const buffed = derive('archer', 40, (m) => {
      m.stats.agiPct = 0.1;
    });
    expect(buffed.agi).toBe(Math.round(base.agi * 1.1));
    // Armor is Vitality's, so an Agility multiplier must not move it at all.
    expect(buffed.armor).toBe(base.armor);
    // Agility buys Flee, a rating contested against the attacker's Hit, not a
    // dodge percentage. The flat dodge left on the sheet is Luck's perfect
    // dodge, which an Agility multiplier must not touch.
    expect(buffed.flee).toBeGreaterThan(base.flee);
    expect(buffed.dodge).toBe(base.dodge);
    // AGI's reach STOPS at armor and evasion now. Crit belongs to LUK and ranged
    // attack power to DEX, so an Agility multiplier must leave both untouched:
    // a bow user is paid for their Dexterity, not twice for their Agility.
    expect(buffed.crit).toBe(base.crit);
    expect(buffed.rangedPower).toBe(base.rangedPower);
  });

  it('dexPct scales Dexterity, the ranged attack power AND the accuracy it feeds', () => {
    const base = derive('archer', 40);
    const buffed = derive('archer', 40, (m) => {
      m.stats.dexPct = 0.1;
    });
    expect(buffed.dex).toBe(Math.round(base.dex * 1.1));
    expect(buffed.rangedPower).toBeGreaterThan(base.rangedPower);
    // Dexterity is accuracy as well as damage now, which is the reason a bow
    // build is a build rather than a damage stat with a range attached.
    expect(buffed.hit).toBeGreaterThan(base.hit);
    expect(buffed.flee).toBe(base.flee);
  });

  it('lukPct scales Luck and the critical rate it feeds', () => {
    const base = derive('thief', 40);
    const buffed = derive('thief', 40, (m) => {
      m.stats.lukPct = 0.15;
    });
    expect(buffed.luk).toBe(Math.round(base.luk * 1.15));
    expect(buffed.crit).toBeGreaterThan(base.crit);
  });

  it('intPct scales Intellect and the Spell Power it feeds', () => {
    const base = derive('mage', 40);
    const buffed = derive('mage', 40, (m) => {
      m.stats.intPct = 0.08;
    });
    expect(buffed.int).toBe(Math.round(base.int * 1.08));
    expect(buffed.spellPower).toBe(Math.round(statusMagicPower(buffed.int)));
    expect(buffed.spellPower).toBeGreaterThan(base.spellPower);
  });

  it('strPct scales Strength and melee attack power', () => {
    const base = derive('swordman', 40);
    const buffed = derive('swordman', 40, (m) => {
      m.stats.strPct = 0.2;
    });
    expect(buffed.str).toBe(Math.round(base.str * 1.2));
    expect(buffed.attackPower).toBeGreaterThan(base.attackPower);
  });

  it('vitPct scales Vitality and the health pool it feeds', () => {
    const base = derive('acolyte', 40);
    const buffed = derive('acolyte', 40, (m) => {
      m.stats.vitPct = 0.15;
    });
    expect(buffed.vit).toBe(Math.round(base.vit * 1.15));
    expect(buffed.maxHp).toBeGreaterThan(base.maxHp);
  });
});
