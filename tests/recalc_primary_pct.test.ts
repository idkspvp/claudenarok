import { describe, expect, it } from 'vitest';
import { emptyModifiers, type TalentModifiers } from '../src/sim/content/talents';
import { createPlayer, recalcPlayerStats, statusMagicPower } from '../src/sim/entity';
import { defaultAllocationFor } from '../src/sim/stat_preset';
import type { PlayerClass } from '../src/sim/types';

// recalcPlayerStats is the ONE place derived stats are computed (src/sim/CLAUDE.md). These
// lock the primary-attribute multipliers (strPct/agiPct/intPct/lukPct) that back talents
// like Lightning Reflexes (+10% Agility) and Arcane Mind (+8% Intellect): the multiplier
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
}

function derive(cls: PlayerClass, level: number, mut?: (m: TalentModifiers) => void): Derived {
  const e = createPlayer(0, cls, { x: 0, y: 0, z: 0 }, 'Test');
  e.level = level;
  let mods: TalentModifiers | undefined;
  if (mut) {
    mods = emptyModifiers();
    mut(mods);
  }
  recalcPlayerStats(e, cls, {}, mods, {}, defaultAllocationFor(cls, level));
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
  };
}

describe('recalcPlayerStats primary-attribute multipliers', () => {
  it('agiPct scales Agility and everything derived from it', () => {
    const base = derive('hunter', 40);
    const buffed = derive('hunter', 40, (m) => {
      m.stats.agiPct = 0.1;
    });
    expect(buffed.agi).toBe(Math.round(base.agi * 1.1));
    // Armor adds exactly 2 per Agility point (armorPct is 0 here, no form), so the delta
    // must equal the added Agility times 2: proves agiPct lands before the armor derivation.
    expect(buffed.armor - base.armor).toBe((buffed.agi - base.agi) * 2);
    expect(buffed.dodge).toBeGreaterThan(base.dodge);
    // AGI's reach STOPS at armor and evasion now. Crit belongs to LUK and ranged
    // attack power to DEX, so an Agility multiplier must leave both untouched:
    // a bow user is paid for their Dexterity, not twice for their Agility.
    expect(buffed.crit).toBe(base.crit);
    expect(buffed.rangedPower).toBe(base.rangedPower);
  });

  it('dexPct scales Dexterity and the ranged attack power it feeds', () => {
    const base = derive('hunter', 40);
    const buffed = derive('hunter', 40, (m) => {
      m.stats.dexPct = 0.1;
    });
    expect(buffed.dex).toBe(Math.round(base.dex * 1.1));
    expect(buffed.rangedPower).toBeGreaterThan(base.rangedPower);
  });

  it('lukPct scales Luck and the critical rate it feeds', () => {
    const base = derive('rogue', 40);
    const buffed = derive('rogue', 40, (m) => {
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
    const base = derive('warrior', 40);
    const buffed = derive('warrior', 40, (m) => {
      m.stats.strPct = 0.2;
    });
    expect(buffed.str).toBe(Math.round(base.str * 1.2));
    expect(buffed.attackPower).toBeGreaterThan(base.attackPower);
  });

  it('vitPct scales Vitality and the health pool it feeds', () => {
    const base = derive('priest', 40);
    const buffed = derive('priest', 40, (m) => {
      m.stats.vitPct = 0.15;
    });
    expect(buffed.vit).toBe(Math.round(base.vit * 1.15));
    expect(buffed.maxHp).toBeGreaterThan(base.maxHp);
  });
});
