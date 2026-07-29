// HIT against FLEE.
//
// The unit half pins the contest's shape; the integration half proves it reaches
// a real swing, because the whole point of this change is that two attributes
// which previously did nothing for accuracy or evasion now decide it.
//
// What "previously did nothing" means concretely: the old model read only the
// LEVEL GAP, so two same-level fighters missed each other at exactly the same
// rate no matter how either had spent their points. That is the regression these
// cases exist to prevent coming back.

import { describe, expect, it } from 'vitest';
import { meleeSwing } from '../src/sim/combat/auto_attack';
import {
  ATTACKER_FLAT_LEAD,
  BASE_HIT_PERCENT,
  EVEN_FIGHT_PERCENT,
  fleeRating,
  hitChance,
  hitRating,
  MAX_HIT_CHANCE,
  MIN_HIT_CHANCE,
  missChanceFromContest,
  perfectDodgeChance,
} from '../src/sim/combat/hit_flee';
import { MOBS } from '../src/sim/data';
import { createMob, recalcPlayerStats } from '../src/sim/entity';
import { Sim } from '../src/sim/sim';
import type { StatAllocation } from '../src/sim/types';
import { BASE_STAT, emptyStatAllocation } from '../src/sim/types';
import { spreadAllocation } from './helpers/alloc';

describe('the two ratings', () => {
  it('carries a flat +25 on HIT, so an even fight favours the ATTACKER', () => {
    // This assertion used to run the other way, and the change is deliberate.
    // The model it replaces had no baseline on either side and met at parity, so
    // two identical characters traded at exactly the base percentage. SpiritVale
    // hands every attacker a flat 25 that the defender has no answer to, so an
    // unbuilt attacker is 25 points ahead of an unbuilt defender of the same
    // level before either has spent anything.
    expect(hitRating(1, 0, 0) - fleeRating(1, 0)).toBe(ATTACKER_FLAT_LEAD);
    // The contest's base was recalibrated from 80 to 55 to absorb exactly that
    // lead, so an UNBUILT pair still trades at 80% and one swing in five misses.
    for (const lv of [1, 20, 50, 99]) {
      expect(hitChance(hitRating(lv, 0, 0), fleeRating(lv, 0)), `level ${lv}`).toBeCloseTo(
        EVEN_FIGHT_PERCENT / 100,
        10,
      );
    }
    // Once both sides SPEND, the attacker pulls ahead: Dexterity buys two
    // accuracy where Agility buys half an evasion. That asymmetry is deliberate.
    const bothSpent = hitChance(hitRating(20, 10, 0), fleeRating(20, 10));
    expect(bothSpent).toBeGreaterThan(EVEN_FIGHT_PERCENT / 100);
    expect(bothSpent).toBeLessThanOrEqual(MAX_HIT_CHANCE);
  });

  it('pays TWO accuracy per DEX and HALF an evasion per AGI', () => {
    // Four to one, where the old model paid one to one. Accuracy is now much
    // the cheaper of the two to stack.
    expect(hitRating(1, 10, 0) - hitRating(1, 0, 0)).toBe(20);
    expect(fleeRating(1, 10) - fleeRating(1, 0)).toBe(5);
    // Dexterity must still buy no evasion at all.
    expect(fleeRating(1, 0)).toBe(fleeRating(1, 0));
    // And Luck DOES feed accuracy now, a fifth of a point. It fed neither
    // rating before; pinned as a presence so a revert is caught.
    expect(hitRating(1, 0, 50)).toBeGreaterThan(hitRating(1, 0, 0));
  });

  it('scales both with level, so a level gap still matters on its own', () => {
    expect(hitRating(50, 0, 0)).toBeGreaterThan(hitRating(1, 0, 0));
    expect(fleeRating(50, 0)).toBeGreaterThan(fleeRating(1, 0));
    // They no longer stay level with each other: the +25 rides along at every
    // level, so the attacker's lead is constant rather than closing.
    for (const lv of [1, 20, 50, 99]) {
      expect(hitRating(lv, 0, 0) - fleeRating(lv, 0), `level ${lv}`).toBe(25);
    }
  });

  it('penalises evasion from the FIFTH attacker on the defender', () => {
    // New mechanic: there was no crowd penalty at all before.
    const alone = fleeRating(50, 40, 1);
    expect(fleeRating(50, 40, 4)).toBe(alone);
    expect(fleeRating(50, 40, 5)).toBeCloseTo(alone * 0.9, 10);
  });

  it('floors a drained attribute instead of inverting the rating', () => {
    expect(hitRating(1, -50, -50)).toBe(hitRating(1, 0, 0));
    expect(fleeRating(1, -50)).toBe(fleeRating(1, 0));
    expect(hitRating(0, 0, 0)).toBe(hitRating(1, 0, 0));
  });
});

describe('the contest', () => {
  it('sits at the base percentage when the two ratings are equal', () => {
    expect(hitChance(200, 200)).toBeCloseTo(BASE_HIT_PERCENT / 100, 10);
  });

  it('moves one point of chance per point of advantage', () => {
    expect(hitChance(200, 210)).toBeCloseTo((BASE_HIT_PERCENT - 10) / 100, 10);
    expect(hitChance(210, 200)).toBeCloseTo((BASE_HIT_PERCENT + 10) / 100, 10);
  });

  it('never reaches certainty in either direction', () => {
    // A defender who has out-scaled the attacker completely still takes one swing
    // in twenty; an attacker who has out-scaled the defender still never gets a
    // guarantee past perfect dodge.
    expect(hitChance(0, 100000)).toBe(MIN_HIT_CHANCE);
    expect(hitChance(100000, 0)).toBe(MAX_HIT_CHANCE);
    expect(missChanceFromContest(0, 100000)).toBeCloseTo(1 - MIN_HIT_CHANCE, 10);
  });

  it('is the complement of the miss roll the swing actually makes', () => {
    for (const [h, f] of [
      [200, 200],
      [300, 100],
      [100, 300],
    ] as const)
      expect(hitChance(h, f) + missChanceFromContest(h, f)).toBeCloseTo(1, 10);
  });
});

describe('perfect dodge', () => {
  it('comes from Luck alone and starts at one percent', () => {
    expect(perfectDodgeChance(0)).toBeCloseTo(0.01, 10);
    expect(perfectDodgeChance(99)).toBeCloseTo(0.109, 10);
    expect(perfectDodgeChance(-5)).toBeCloseTo(0.01, 10);
  });

  it('is not something accuracy can answer', () => {
    // The contest and this roll are separate on purpose. If perfect dodge were
    // folded into FLEE, a high-HIT attacker would eventually never miss at all,
    // and Luck would stop being a defensive attribute.
    expect(hitChance(100000, fleeRating(1, 0))).toBe(MAX_HIT_CHANCE);
    expect(perfectDodgeChance(99)).toBeGreaterThan(0);
  });
});

describe('the contest reaches a real swing', () => {
  function landRate(opts: { attackerDex?: number; targetAgi?: number; swings?: number }): number {
    const sim = new Sim({ seed: 11, playerClass: 'swordman' });
    const p = sim.player;
    p.hp = p.maxHp = 1_000_000;
    if (opts.attackerDex !== undefined) {
      const meta = sim.players.get(sim.playerId);
      if (!meta) throw new Error('missing meta');
      const alloc: StatAllocation = { ...emptyStatAllocation(), dex: opts.attackerDex };
      meta.statAllocation = alloc;
      recalcPlayerStats(p, meta.cls, meta.equipment, meta.mods, meta.equipmentInstance, alloc);
    }
    const target = createMob((sim as never as { nextId: number }).nextId++, MOBS.forest_wolf, 5, {
      ...p.pos,
    });
    target.maxHp = target.hp = 100_000_000;
    target.stats = { ...target.stats, armor: 0 };
    if (opts.targetAgi !== undefined) {
      target.stats = { ...target.stats, agi: opts.targetAgi };
      target.flee = fleeRating(target.level, opts.targetAgi);
    }
    (sim as never as { addEntity(e: unknown): void }).addEntity(target);
    const swings = opts.swings ?? 400;
    let landed = 0;
    for (let i = 0; i < swings; i++) {
      const before = target.hp;
      meleeSwing(sim.ctx, p, target, 0, null, {});
      if (target.hp < before) landed++;
      target.hp = target.maxHp;
    }
    return landed / swings;
  }

  it('lands most swings on an unevasive target, but not all of them', () => {
    const rate = landRate({});
    expect(rate).toBeGreaterThan(0.6);
    expect(rate).toBeLessThan(1);
  });

  it('makes a high-Agility target genuinely hard to hit', () => {
    // The behaviour that did not exist before: evasion that actually refuses
    // hits, rather than a couple of percent off a flat roll.
    const plain = landRate({});
    const evasive = landRate({ targetAgi: 200 });
    expect(evasive).toBeLessThan(plain);
    // Deeper than it used to need to be: Agility buys half a point now, so 200
    // Agility is worth what 100 was, and the attacker's flat +25 has to be
    // out-run before evasion bites at all.
    expect(evasive).toBeLessThan(0.75);
  });

  it('lets Dexterity buy its way back through that evasion', () => {
    // The other half, and the reason DEX is a real build choice now: accuracy
    // answers evasion. With no DEX this attacker is losing the contest badly.
    // Against evasion this deep the attacker is pinned at the 5% floor with no
    // Dexterity at all, so the target's Agility comes down to somewhere the
    // contest can actually move.
    // Agility is worth half a point now, so the target needs far more of it to
    // put the attacker under pressure at all.
    const noDex = landRate({ targetAgi: 300 });
    const withDex = landRate({ targetAgi: 300, attackerDex: 150 });
    expect(noDex).toBeLessThan(0.5);
    expect(withDex).toBeGreaterThan(noDex + 0.3);
  });

  it('gives a player real hit and flee ratings off their own attributes', () => {
    const sim = new Sim({ seed: 3, playerClass: 'archer' });
    sim.setPlayerLevel(40);
    const p = sim.player;
    expect(p.hit).toBe(hitRating(40, p.stats.dex) + Math.round(p.hitBonus * 100));
    expect(p.flee).toBe(fleeRating(40, p.stats.agi));
    // A fresh character spends none of their own points, so both ratings are
    // level plus 1: the game hands the budget over and the player decides where
    // accuracy and evasion actually come from.
    const fresh = new Sim({ seed: 3, playerClass: 'archer' });
    expect(fresh.player.stats.dex).toBe(BASE_STAT);
    expect(fresh.player.stats.agi).toBe(BASE_STAT);
  });
});
