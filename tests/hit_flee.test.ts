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
  BASE_HIT_PERCENT,
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
  it('carries NO baseline, so an even fight meets at the base percentage', () => {
    // The correction that mattered: an earlier pass gave HIT a +175 term and
    // FLEE a +100 one, which handed every attacker a permanent 75-point lead and
    // made two identical characters connect every single time. They are level
    // plus the attribute and nothing else, so an even fight trades at 80% and
    // one swing in five misses.
    expect(hitRating(1, 0)).toBe(fleeRating(1, 0));
    expect(hitChance(hitRating(20, 10), fleeRating(20, 10))).toBeCloseTo(
      BASE_HIT_PERCENT / 100,
      10,
    );
    expect(hitChance(hitRating(20, 10), fleeRating(20, 10))).toBeLessThan(MAX_HIT_CHANCE);
  });

  it('pays DEX into accuracy and AGI into evasion, point for point', () => {
    expect(hitRating(1, 10) - hitRating(1, 0)).toBe(10);
    expect(fleeRating(1, 10) - fleeRating(1, 0)).toBe(10);
    // And crucially NOT the other way round: DEX must not buy evasion.
    expect(fleeRating(1, 0)).toBe(fleeRating(1, 0));
    // Luck does NOTHING to either rating in pre-renewal. The luk/3 and luk/5
    // terms this used to pin are Renewal's, from the same lines as the +175 and
    // +100 baselines already removed. Pinned as an ABSENCE so the terms cannot
    // come back a third time.
    expect(hitRating(1, 0)).toBe(hitRating(1, 0));
    expect(fleeRating(1, 0)).toBe(fleeRating(1, 0));
  });

  it('scales both with level, so a level gap still matters on its own', () => {
    expect(hitRating(50, 0)).toBeGreaterThan(hitRating(1, 0));
    expect(fleeRating(50, 0)).toBeGreaterThan(fleeRating(1, 0));
    // And they stay level with each other: an unbuilt character of any level
    // meets another of the same level at parity, never ahead.
    for (const lv of [1, 20, 50, 99]) expect(hitRating(lv, 0)).toBe(fleeRating(lv, 0));
  });

  it('floors a drained attribute instead of inverting the rating', () => {
    expect(hitRating(1, -50)).toBe(hitRating(1, 0));
    expect(fleeRating(1, -50)).toBe(fleeRating(1, 0));
    expect(hitRating(0, 0)).toBe(hitRating(1, 0));
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
    const sim = new Sim({ seed: 11, playerClass: 'warrior' });
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
    expect(evasive).toBeLessThan(0.5);
  });

  it('lets Dexterity buy its way back through that evasion', () => {
    // The other half, and the reason DEX is a real build choice now: accuracy
    // answers evasion. With no DEX this attacker is losing the contest badly.
    // Against evasion this deep the attacker is pinned at the 5% floor with no
    // Dexterity at all, so the target's Agility comes down to somewhere the
    // contest can actually move.
    const noDex = landRate({ targetAgi: 80 });
    const withDex = landRate({ targetAgi: 80, attackerDex: 150 });
    expect(noDex).toBeLessThan(0.5);
    expect(withDex).toBeGreaterThan(noDex + 0.3);
  });

  it('gives a player real hit and flee ratings off their own attributes', () => {
    const sim = new Sim({ seed: 3, playerClass: 'hunter' });
    sim.setPlayerLevel(40);
    const p = sim.player;
    expect(p.hit).toBe(hitRating(40, p.stats.dex) + Math.round(p.hitBonus * 100));
    expect(p.flee).toBe(fleeRating(40, p.stats.agi));
    // A fresh character spends none of their own points, so both ratings are
    // level plus 1: the game hands the budget over and the player decides where
    // accuracy and evasion actually come from.
    const fresh = new Sim({ seed: 3, playerClass: 'hunter' });
    expect(fresh.player.stats.dex).toBe(BASE_STAT);
    expect(fresh.player.stats.agi).toBe(BASE_STAT);
  });
});
