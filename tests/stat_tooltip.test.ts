import { describe, expect, it } from 'vitest';
import { classHealthMultiplier } from '../src/sim/combat/class_health_map';
import { warriorParryChance } from '../src/sim/combat/warrior_hit_table';
import { CLASSES } from '../src/sim/content/classes';
import { ITEMS } from '../src/sim/data';
import { recalcPlayerStats } from '../src/sim/entity';
import { Sim } from '../src/sim/sim';
import { magicAttack, meleeAttack, rangedAttack } from '../src/sim/stats/attack';
import { damageReductionFraction } from '../src/sim/stats/defence_curve';
import { maxHealth, maxMana } from '../src/sim/stats/resources';
import { ALL_CLASSES, type PlayerClass } from '../src/sim/types';
import {
  agiMeleeApPerPoint,
  buildStatTooltip,
  healthMultiplierFromVit,
  isManaClass,
  manaMultiplierFromInt,
  restingHealthPer5s,
  restingManaPer5s,
  type StatEffect,
  type StatId,
  type StatTooltipInput,
  strApPerPoint,
  weaponDps,
} from '../src/ui/stat_tooltip';
import { spreadAllocation } from './helpers/alloc';

const attrsOf = (e: {
  stats: { str: number; agi: number; vit: number; int: number; dex: number; luk: number };
}) => ({
  str: e.stats.str,
  agi: e.stats.agi,
  vit: e.stats.vit,
  int: e.stats.int,
  dex: e.stats.dex,
  luk: e.stats.luk,
});

// A gear-free, buff-free, talent-free player: autoEquip defaults to false, so the
// derived stats are a clean function of class base + per-level growth. That lets
// us reconcile the tooltip's per-stat breakdown against the ONE place the sim
// derives stats (recalcPlayerStats), so the displayed numbers cannot drift.
function freshPlayer(cls: PlayerClass, level: number) {
  const sim = new Sim({ seed: 1, playerClass: cls });
  sim.setPlayerLevel(level);
  return sim.player;
}

function inputFor(cls: PlayerClass, p: ReturnType<typeof freshPlayer>): StatTooltipInput {
  return {
    cls,
    stats: p.stats,
    level: p.level,
    attackPower: p.attackPower,
    spellPower: p.spellPower,
    critChance: p.critChance,
    dodgeChance: p.dodgeChance,
    critRating: p.critRating,
    hasteRating: p.hasteRating,
    hitRating: p.hitRating,
    parryChance: cls === 'swordman' ? warriorParryChance(p.stats.str) : 0,
    dps: 0,
  };
}

const effect = (effects: StatEffect[], kind: StatEffect['kind']) =>
  effects.find((e) => e.kind === kind);
const statEffectVal = (
  cls: PlayerClass,
  p: ReturnType<typeof freshPlayer>,
  stat: StatId,
  kind: StatEffect['kind'],
) => effect(buildStatTooltip(stat, inputFor(cls, p)).effects, kind)?.value;

const LEVELS = [1, 10, 20];

describe('stat tooltip math reconciles with recalcPlayerStats', () => {
  for (const cls of ALL_CLASSES) {
    for (const level of LEVELS) {
      it(`${cls} L${level}: attack power reconciles with the level term`, () => {
        const p = freshPlayer(cls, level);
        // Three attributes feed melee attack, and each tooltip line states that
        // attribute's contribution in isolation. They no longer sum to the sheet
        // on their own: the formula carries a LEVEL term (Lv/4) that belongs to
        // no attribute, so the reconciliation has to include it. Agility feeds
        // none of it.
        const strAp = statEffectVal(cls, p, 'str', 'attackPower') ?? 0;
        const dexAp = statEffectVal(cls, p, 'dex', 'attackPower') ?? 0;
        const lukAp = statEffectVal(cls, p, 'luk', 'attackPower') ?? 0;
        expect(statEffectVal(cls, p, 'agi', 'attackPower')).toBeUndefined();
        const levelTerm = meleeAttack({
          level,
          attributes: { str: 0, agi: 0, vit: 0, int: 0, dex: 0, luk: 0 },
        });
        // Within one rounding step, not exactly: the sheet is Math.round of the
        // formula, and a class opening block puts real numbers in STR/DEX/LUK, so
        // the unrounded breakdown can land exactly on a .5 boundary. Asserted as
        // an inclusive bound rather than toBeCloseTo, whose precision-0 tolerance
        // is exclusive and reds on exactly that boundary.
        expect(Math.abs(strAp + dexAp + lukAp + levelTerm - p.attackPower)).toBeLessThanOrEqual(
          0.5,
        );
        // And the level term is real: it is exactly a quarter of the level.
        expect(levelTerm).toBeCloseTo(level / 4, 10);
      });

      it(`${cls} L${level}: AGI drives Flee, DEX drives Hit, LUK drives crit and dodge`, () => {
        const p = freshPlayer(cls, level);
        // Ragnarok's split, and the reason a dodge PERCENTAGE was the wrong
        // model: Agility buys a Flee RATING that an attacker's Hit is measured
        // against, Dexterity buys the accuracy on the other side of that
        // contest, and what is left as a flat dodge chance belongs to Luck.
        expect(statEffectVal(cls, p, 'agi', 'flee')).toBe(p.flee);
        expect(statEffectVal(cls, p, 'dex', 'hit')).toBe(p.hit - Math.round(p.hitBonus * 100));
        const critPct = statEffectVal(cls, p, 'luk', 'critPct') ?? 0;
        expect(0.01 + critPct / 100).toBeCloseTo(p.critChance, 6);
        // Agility no longer shows a dodge line at all: pointing a player at it
        // would send them to buy the wrong attribute.
        expect(statEffectVal(cls, p, 'agi', 'dodgePct')).toBeUndefined();
        expect(statEffectVal(cls, p, 'agi', 'critPct')).toBeUndefined();
      });

      it(`${cls} L${level}: vitality armor is the vit*2 portion of total armor`, () => {
        const sim = new Sim({ seed: 1, playerClass: cls });
        sim.setPlayerLevel(level);
        const p = sim.player;
        // Hard DEF is EQUIPMENT only now: the class contributes none, the level
        // contributes none, and Vitality contributes none (it buys soft DEF in
        // combat/defence.ts instead). Agility never contributed: it buys evasion.
        let gearArmor = 0;
        for (const id of Object.values(sim.equipment))
          gearArmor += (id && ITEMS[id]?.stats?.armor) || 0;
        expect(p.stats.armor).toBe(gearArmor);
        expect(statEffectVal(cls, p, 'vit', 'armor')).toBeUndefined();
        expect(statEffectVal(cls, p, 'agi', 'armor')).toBeUndefined();
      });

      it(`${cls} L${level}: stamina max-health contribution matches entity.maxHp`, () => {
        const p = freshPlayer(cls, level);
        // VIT scales the pool rather than adding to it, so the tooltip line is a
        // percentage and the check is the multiplier, not a difference.
        const pct = statEffectVal(cls, p, 'vit', 'maxHealthPct') ?? 0;
        expect(pct).toBeCloseTo((healthMultiplierFromVit(p.stats.vit) - 1) * 100, 6);
        expect(p.maxHp).toBe(
          maxHealth({ level, vit: p.stats.vit, archetypeMultiplier: classHealthMultiplier(cls) }),
        );
      });

      it(`${cls} L${level}: armor cell damage reduction matches hard DEF`, () => {
        const p = freshPlayer(cls, level);
        const dr = effect(buildStatTooltip('armor', inputFor(cls, p)).effects, 'damageReduction');
        expect(dr?.value).toBeCloseTo(damageReductionFraction(p.stats.armor) * 100, 6);
      });
    }
  }

  it('mana classes: intellect max-mana contribution matches entity.maxResource', () => {
    for (const cls of ALL_CLASSES) {
      if (!isManaClass(cls)) continue;
      const p = freshPlayer(cls, 20);
      const pct = statEffectVal(cls, p, 'int', 'maxManaPct') ?? 0;
      expect(pct).toBeCloseTo((manaMultiplierFromInt(p.stats.int) - 1) * 100, 6);
      // No class term at all in the spell-point pool any more: every caster of
      // the same level and Intelligence carries the same number.
      expect(p.maxResource).toBe(Math.round(maxMana({ level: 20, int: p.stats.int })));
    }
  });
});

describe('class-aware effect selection', () => {
  it('Strength grants 2 AP/point for the swordman, 1 for every other job', () => {
    expect(strApPerPoint('swordman')).toBe(2);
    expect(strApPerPoint('acolyte')).toBe(1);
    expect(strApPerPoint('thief')).toBe(1);
    expect(strApPerPoint('archer')).toBe(1);
    expect(strApPerPoint('mage')).toBe(1);
    expect(strApPerPoint('acolyte')).toBe(1);
    expect(strApPerPoint('mage')).toBe(1);
  });

  it('Agility melee AP applies only to thief and archer', () => {
    expect(agiMeleeApPerPoint('thief')).toBe(1);
    expect(agiMeleeApPerPoint('archer')).toBe(1);
    for (const cls of [
      'swordman',
      'swordman',
      'acolyte',
      'acolyte',
      'mage',
      'acolyte',
      'mage',
    ] as PlayerClass[]) {
      expect(agiMeleeApPerPoint(cls)).toBe(0);
    }
  });

  it('only hunters get a ranged attack power line, and it hangs off Dexterity', () => {
    // Bows read DEX where a melee weapon reads STR, so the ranged line belongs on
    // the DEX cell. AGI carries none of it any more, for a archer or anyone else.
    const archer = freshPlayer('archer', 20);
    const st = archer.stats;
    const ranged = effect(
      buildStatTooltip('dex', inputFor('archer', archer)).effects,
      'rangedAttackPower',
    );
    expect(ranged?.value).toBe(rangedAttack({ level: archer.level, attributes: attrsOf(archer) }));
    expect(
      effect(buildStatTooltip('agi', inputFor('archer', archer)).effects, 'rangedAttackPower'),
    ).toBeUndefined();
    const swordman = freshPlayer('swordman', 20);
    expect(
      effect(buildStatTooltip('dex', inputFor('swordman', swordman)).effects, 'rangedAttackPower'),
    ).toBeUndefined();
  });

  it('only Intellect shows the minor-benefit note, and only for non-mana classes', () => {
    const thief = freshPlayer('thief', 20); // energy
    const swordman = freshPlayer('swordman', 20); // rage
    for (const cls of [thief, swordman]) {
      const c = cls === thief ? 'thief' : 'swordman';
      const intM = buildStatTooltip('int', inputFor(c, cls));
      expect(intM.minorForClass).toBe(true);
      expect(intM.effects).toHaveLength(0);
      // LUK is NOT in this club: it buys crit and a slice of ATK for every class,
      // so a rage or energy class reading its LUK cell must still see real lines.
      const lukM = buildStatTooltip('luk', inputFor(c, cls));
      expect(lukM.minorForClass).toBe(false);
      expect(effect(lukM.effects, 'critPct')).toBeDefined();
      expect(effect(lukM.effects, 'attackPower')).toBeDefined();
    }
    const mage = freshPlayer('mage', 20);
    const intMage = buildStatTooltip('int', inputFor('mage', mage));
    expect(intMage.minorForClass).toBe(false);
    expect(effect(intMage.effects, 'maxManaPct')).toBeDefined();
    expect(effect(intMage.effects, 'spellCritPct')).toBeDefined();
    expect(effect(intMage.effects, 'manaRegen')).toBeDefined();
    expect(buildStatTooltip('luk', inputFor('mage', mage)).minorForClass).toBe(false);
  });

  it('treats a acolyte as a mana class in every form, so Int keeps its mana lines', () => {
    // A acolyte is fundamentally a mana class whose Int governs the caster-form mana
    // pool, so its breakdown must NOT collapse to "of little benefit" the way a
    // true rage/energy class does, even while shapeshifted. isManaClass keys off the
    // base class (not the transient form resource) on purpose; lock that here.
    expect(isManaClass('acolyte')).toBe(true);
    const acolyte = freshPlayer('acolyte', 20);
    const intDruid = buildStatTooltip('int', inputFor('acolyte', acolyte));
    expect(intDruid.minorForClass).toBe(false);
    expect(effect(intDruid.effects, 'maxManaPct')).toBeDefined();
    expect(effect(intDruid.effects, 'spellCritPct')).toBeDefined();
    expect(effect(intDruid.effects, 'manaRegen')).toBeDefined();
    const lukDruid = buildStatTooltip('luk', inputFor('acolyte', acolyte));
    expect(lukDruid.minorForClass).toBe(false);
  });

  it('derived cells carry their notes and no header', () => {
    const p = freshPlayer('swordman', 10);
    const crit = buildStatTooltip('critChance', inputFor('swordman', p));
    const dodge = buildStatTooltip('dodge', inputFor('swordman', p));
    const dps = buildStatTooltip('dps', { ...inputFor('swordman', p), dps: 12.3 });
    expect(crit.isPrimary).toBe(false);
    expect(crit.baseChanceNote).toBe(true);
    expect(dodge.baseChanceNote).toBe(true);
    expect(dps.dpsApproxNote).toBe(true);
    expect(dps.statValue).toBe(12.3);
    // primary stats are the left column only
    expect(buildStatTooltip('str', inputFor('swordman', p)).isPrimary).toBe(true);
    expect(buildStatTooltip('agi', inputFor('swordman', p)).isPrimary).toBe(true);
  });
});

describe('pure regen / pool helpers', () => {
  it('VIT and INT scale their pools by a percentage, floored at the base', () => {
    // Ragnarok's shape: 1% a point, so a 99 in either just about doubles the pool.
    // The floor at 0 is what keeps a draining debuff from inverting it.
    expect(healthMultiplierFromVit(0)).toBe(1);
    expect(healthMultiplierFromVit(50)).toBeCloseTo(1.5, 10);
    expect(healthMultiplierFromVit(99)).toBeCloseTo(1.99, 10);
    expect(healthMultiplierFromVit(-5)).toBe(1);
    expect(manaMultiplierFromInt(0)).toBe(1);
    expect(manaMultiplierFromInt(99)).toBeCloseTo(1.99, 10);
    expect(manaMultiplierFromInt(-5)).toBe(1);
  });

  it('resting regen rounds the per-tick amount first (as the sim does), then scales to per-5s', () => {
    // The sim adds round(rate) every 2s; per-5s estimate = round(round(rate) * 2.5).
    expect(restingHealthPer5s(20)).toBe(Math.round(Math.round(20 * 0.3 + 2) * 2.5)); // 20
    expect(restingHealthPer5s(5)).toBe(Math.round(Math.round(5 * 0.3 + 2) * 2.5)); // round(4*2.5)=10
    expect(restingManaPer5s(30, 20)).toBe(Math.round(Math.round(30 / 3 + 4 + 4) * 2.5)); // 45
    expect(restingManaPer5s(0, 1)).toBe(Math.round(Math.round(0 + 4 + 0) * 2.5)); // 10
  });
});

describe('weaponDps', () => {
  it('falls back to the sim default weapon when unarmed, never 0', () => {
    // default {min:1,max:2,speed:2}: ((1+2)/2 + (ap/14)*2) / 2
    expect(weaponDps(null, 0)).toBeCloseTo(0.75, 6);
    expect(weaponDps(undefined, 14)).toBeCloseTo(1.75, 6);
    expect(weaponDps(null, 0)).toBeGreaterThan(0); // the unarmed-shows-0 bug is gone
  });

  it('uses the equipped weapon and folds in attack power (ap/14 per swing)', () => {
    expect(weaponDps({ min: 10, max: 20, speed: 3 }, 0)).toBeCloseTo(5, 6); // 15/3
    expect(weaponDps({ min: 10, max: 20, speed: 3 }, 42)).toBeCloseTo(8, 6); // (15 + 3*3)/3
  });
});

describe('effect wiring reconciles each effect kind with its source', () => {
  const effVal = (
    cls: PlayerClass,
    p: ReturnType<typeof freshPlayer>,
    stat: StatId,
    kind: StatEffect['kind'],
  ) => statEffectVal(cls, p, stat, kind);

  it('attackPower cell emits dpsFromAp = attackPower / 14', () => {
    const p = freshPlayer('swordman', 20);
    expect(effVal('swordman', p, 'attackPower', 'dpsFromAp')).toBeCloseTo(p.attackPower / 14, 6);
  });

  it('stamina cell wires healthRegen = restingHealthPer5s(sta)', () => {
    const p = freshPlayer('swordman', 20);
    expect(effVal('swordman', p, 'vit', 'healthRegen')).toBe(restingHealthPer5s(p.stats.vit));
  });

  it('mana classes wire intellect to BOTH manaRegen and spellCritPct', () => {
    // Recovery follows the attribute that owns the pool. It hung off LUK while the
    // old Spirit stat was being renamed, which paid a caster for an attribute they
    // had no reason to buy and paid their INT nothing.
    const p = freshPlayer('mage', 20);
    expect(effVal('mage', p, 'int', 'manaRegen')).toBe(restingManaPer5s(p.stats.int, p.level));
    expect(effVal('mage', p, 'luk', 'manaRegen')).toBeUndefined();
    // spell crit = 0.05 + int*0.0008 (sim.ts spellCrit); the line shows the int*0.0008 portion as a percent
    expect(effVal('mage', p, 'int', 'spellCritPct')).toBeCloseTo(p.stats.int * 0.0008 * 100, 6);
  });
});

describe('upstream source breakdown reconciles to the displayed stat', () => {
  // Builds the input WITH the live equipped gear + active auras, mirroring the HUD,
  // so the source lines (base / attributes / gear / each buff / talents) must add
  // up to the value the cell shows for every stat. The point of the model is that
  // the lines always reconcile; if recalc grows a source we don't itemize, it lands
  // in the talents remainder and this stays green (proving the sum, not each label).
  function inputWithGear(sim: Sim, cls: PlayerClass): StatTooltipInput {
    const p = sim.player;
    const gear = [];
    for (const id of Object.values(sim.equipment)) {
      const item = id ? ITEMS[id] : null;
      if (!item || (!item.stats && !item.spellPower)) continue;
      gear.push({ name: item.id, stats: item.stats, spellPower: item.spellPower });
    }
    const buffs = p.auras.map((a) => ({ kind: a.kind, value: a.value, name: a.name }));
    return {
      cls,
      stats: p.stats,
      level: p.level,
      attackPower: p.attackPower,
      spellPower: p.spellPower,
      critChance: p.critChance,
      dodgeChance: p.dodgeChance,
      critRating: p.critRating,
      hasteRating: p.hasteRating,
      hitRating: p.hitRating,
      parryChance: cls === 'swordman' ? warriorParryChance(p.stats.str) : 0,
      dps: 0,
      gear,
      buffs,
    };
  }

  const STATS: StatId[] = [
    'str',
    'agi',
    'vit',
    'int',
    'luk',
    'armor',
    'attackPower',
    'spellPower',
    'critChance',
    'dodge',
  ];

  for (const cls of ALL_CLASSES) {
    for (const level of [1, 20]) {
      it(`${cls} L${level}: every cell's sources sum to its displayed value`, () => {
        const sim = new Sim({ seed: 1, playerClass: cls });
        sim.setPlayerLevel(level);
        const input = inputWithGear(sim, cls);
        for (const stat of STATS) {
          const model = buildStatTooltip(stat, input);
          const sum = model.sources.reduce((acc, s) => acc + s.value, 0);
          // Whole-number stats reconcile exactly; the crit/dodge percents carry the
          // 0.05%/agi curve so allow a hair of float slack.
          const eps = stat === 'critChance' || stat === 'dodge' ? 1e-6 : 0.5;
          expect(Math.abs(sum - model.statValue)).toBeLessThan(eps);
        }
      });
    }
  }

  it('itemizes a flat buff by name and folds talents into the remainder', () => {
    const sim = new Sim({ seed: 1, playerClass: 'swordman' });
    sim.setPlayerLevel(20);
    const p = sim.player;
    // A flat +20 Stamina buff (e.g. Power Word: Fortitude) must appear as its own
    // named line, and the whole breakdown must still reconcile.
    p.auras.push({
      id: 'power_word_fortitude',
      name: 'Power Word: Fortitude',
      kind: 'buff_sta',
      remaining: 1800,
      duration: 1800,
      value: 20,
      sourceId: p.id,
      school: 'holy',
    });
    recalcPlayerStats(p, 'swordman', sim.equipment, undefined, {}, spreadAllocation(p.level));
    const input = inputWithGear(sim, 'swordman');
    const sta = buildStatTooltip('vit', input);
    const buffLine = sta.sources.find((s) => s.kind === 'buff');
    expect(buffLine?.name).toBe('Power Word: Fortitude');
    expect(buffLine?.value).toBe(20);
    const sum = sta.sources.reduce((acc, s) => acc + s.value, 0);
    expect(sum).toBe(sta.statValue);
  });

  it('spellPower breaks down into Intellect + flat gear/buff Spell Power', () => {
    const sim = new Sim({ seed: 1, playerClass: 'mage' });
    sim.setPlayerLevel(20);
    const p = sim.player;
    const model = buildStatTooltip('spellPower', inputWithGear(sim, 'mage'));
    const fromInt = model.sources.find((s) => s.kind === 'attributes');
    expect(fromInt?.fromStat).toBe('int');
    expect(fromInt?.value).toBe(
      Math.round(magicAttack({ level: p.level, attributes: attrsOf(p) })),
    );
    const sum = model.sources.reduce((acc, s) => acc + s.value, 0);
    expect(sum).toBe(p.spellPower);
    // non-casters get the minor-benefit note on the spell power cell
    const warriorSim = new Sim({ seed: 1, playerClass: 'swordman' });
    warriorSim.setPlayerLevel(20);
    expect(
      buildStatTooltip('spellPower', inputWithGear(warriorSim, 'swordman')).minorForClass,
    ).toBe(true);
  });

  it('shows no attribute line at all in the armor breakdown', () => {
    const sim = new Sim({ seed: 1, playerClass: 'acolyte' });
    sim.setPlayerLevel(20);
    const p = sim.player;
    recalcPlayerStats(p, 'acolyte', sim.equipment, undefined, {}, spreadAllocation(p.level));
    expect(p.stats.vit).toBeGreaterThan(1); // the allocation really did buy Vitality
    const armor = buildStatTooltip('armor', inputWithGear(sim, 'acolyte'));
    // Hard DEF is equipment only. Agility buys evasion and Vitality buys SOFT DEF
    // (the flat subtraction in combat/defence.ts), so neither reaches this cell,
    // and the base line is 0 rather than a class/level term.
    expect(armor.sources.some((s) => s.kind === 'attributes')).toBe(false);
    expect(armor.sources.find((s) => s.kind === 'base')?.value).toBe(0);
    expect(armor.sources.reduce((acc, s) => acc + s.value, 0)).toBe(armor.statValue);
  });
});

describe('rating stat cells', () => {
  it('critRating and hasteRating display the accumulated gear/set rating', () => {
    const p = freshPlayer('mage', 20);
    p.critRating = 20;
    p.hasteRating = 150;
    const crit = buildStatTooltip('critRating', inputFor('mage', p));
    const haste = buildStatTooltip('hasteRating', inputFor('mage', p));
    expect(crit.statValue).toBe(20);
    expect(haste.statValue).toBe(150);
    expect(crit.isPrimary).toBe(false);
    // rating cells show the value + description, no per-source breakdown line
    expect(crit.sources).toEqual([]);
    expect(haste.sources).toEqual([]);
  });

  it('summarizes both capped PvP effects in one Warfare stat', () => {
    const p = freshPlayer('swordman', 20);
    const input = inputFor('swordman', p);
    input.stats = {
      ...input.stats,
      pvpOffense: 0.2,
      pvpDefense: 0.137,
    };

    const warfare = buildStatTooltip('warfare', input);
    expect(warfare.statValue).toBe(20);
    expect(warfare.warfareDamageIncrease).toBe(20);
    expect(warfare.warfareDamageReduction).toBeCloseTo(13.7, 6);
    expect(warfare.isPrimary).toBe(false);
    expect(warfare.effects).toEqual([]);
    // Warfare fractions are already derived from all equipped ratings and capped
    // by recalcPlayerStats, so inventing a second source breakdown here would lie.
    expect(warfare.sources).toEqual([]);
  });
});
