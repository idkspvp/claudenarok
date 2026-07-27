// Restored from the pre-revert payload (f274835b1^) and adapted to the current
// APIs. The payload's stanceBarView describe is NOT restored here: the live
// tests/stance_bar_view.test.ts already covers that render model decisively.
import { describe, expect, it } from 'vitest';
import {
  availableWarriorStanceKinds,
  BATTLE_STANCE,
  BERSERKER_STANCE,
  DEFENSIVE_STANCE,
  defaultWarriorStanceId,
  isWarriorStanceKind,
  WARRIOR_STANCE_IDS,
  warriorStanceReconcile,
} from '../src/sim/combat/warrior_stances';
import { ABILITIES } from '../src/sim/content/classes';
import { Sim } from '../src/sim/sim';
import { berserkerCritDamage, rageGenAuraMult } from '../src/sim/types';

// Warrior combat stances (owner design 2026-07-08): a warrior always lives in
// exactly one stance valid for their spec. Battle = Arms/Prot/no-spec offensive
// default (+10% rage); Guarded = Arms/Prot defensive; Berserker = Fury-only
// offensive default (+3% crit chance, +3% crit damage, no downside). Stances are
// mutually exclusive (exclusiveGroup 'warrior_stance') and auto-applied and
// reconciled each player-tick.

const makeSim = (seed = 42): Sim => new Sim({ seed, playerClass: 'warrior', autoEquip: true });
const stanceAuras = (sim: Sim) => sim.player.auras.filter((a) => isWarriorStanceKind(a.kind));

describe('warrior stance pure core', () => {
  it('exposes exactly the three stance ids/kinds', () => {
    expect([...WARRIOR_STANCE_IDS].sort()).toEqual(
      [BATTLE_STANCE, BERSERKER_STANCE, DEFENSIVE_STANCE].sort(),
    );
    expect(isWarriorStanceKind('battle_stance')).toBe(true);
    expect(isWarriorStanceKind('berserker_stance')).toBe(true);
    expect(isWarriorStanceKind('defensive_stance')).toBe(true);
    expect(isWarriorStanceKind('stealth')).toBe(false);
  });

  // Specs are retired (Phase D0): every warrior may wear any of the three
  // stances, and Battle is the spawn default for everyone.
  it('makes all three stances available and Battle the default', () => {
    expect(availableWarriorStanceKinds()).toEqual([
      'battle_stance',
      'defensive_stance',
      'berserker_stance',
    ]);
    expect(defaultWarriorStanceId()).toBe(BATTLE_STANCE);
  });

  it('reconciles: keep a valid stance, else drop invalid and apply the default', () => {
    // Fresh (no stance) -> gain the default, nothing to remove.
    expect(warriorStanceReconcile([])).toEqual({ removeKinds: [], applyId: BATTLE_STANCE });
    // Already in a valid stance -> no change, whichever of the three it is.
    for (const kind of ['battle_stance', 'defensive_stance', 'berserker_stance'] as const) {
      expect(warriorStanceReconcile([kind]), kind).toEqual({ removeKinds: [], applyId: null });
    }
    // A non-stance kind is not a stance -> strip it and apply the default.
    expect(warriorStanceReconcile(['stealth'])).toEqual({
      removeKinds: ['stealth'],
      applyId: BATTLE_STANCE,
    });
  });
});

describe('stance ability defs match the pure gating', () => {
  it('keeps all three ungated and in one exclusive group', () => {
    for (const id of WARRIOR_STANCE_IDS) {
      expect(ABILITIES[id]?.exclusiveGroup, id).toBe('warrior_stance');
      const eff = ABILITIES[id]?.effects.find((e) => e.type === 'selfBuff');
      expect(eff, id).toBeTruthy();
      expect(eff?.type === 'selfBuff' && eff.kind, id).toBe(id);
    }
  });
});

describe('warrior stances in the live sim', () => {
  it('auto-applies Battle Stance to a fresh (no-spec) warrior, exactly one stance', () => {
    const sim = makeSim();
    sim.tick();
    const worn = stanceAuras(sim);
    expect(worn.length).toBe(1);
    expect(worn[0].kind).toBe('battle_stance');
    // Battle Stance grants +10% rage generation at every mint site.
    expect(rageGenAuraMult(sim.player)).toBeCloseTo(1.1, 5);
    expect(berserkerCritDamage(sim.player)).toBe(0);
  });

  it('a cast Berserker Stance sticks (crit damage on, no Battle rage bonus)', () => {
    const sim = makeSim();
    sim.setPlayerLevel(20);
    sim.tick();
    sim.castAbility('berserker_stance');
    sim.tick();
    const worn = stanceAuras(sim);
    expect(worn.length).toBe(1);
    expect(worn[0].kind).toBe('berserker_stance');
    // Berserker's crit-damage half is live; it does NOT carry Battle's rage bonus.
    expect(berserkerCritDamage(sim.player)).toBeCloseTo(0.03, 5);
    expect(rageGenAuraMult(sim.player)).toBeCloseTo(1, 5);
  });

  it('Berserker Stance folds +3% crit chance in recalcPlayerStats', () => {
    // Isolated from Fury spec bonuses: apply the aura to a no-spec warrior and
    // let applyAura re-run recalc, so the delta is purely the stance fold.
    const sim = makeSim();
    sim.setPlayerLevel(20);
    sim.tick();
    const crit0 = sim.player.critChance;
    (sim as unknown as { applyAura: (p: unknown, a: unknown) => void }).applyAura(sim.player, {
      id: 'berserker_stance',
      name: 'Reckless Stance',
      kind: 'berserker_stance',
      remaining: 3600,
      duration: 3600,
      value: 0,
      sourceId: sim.player.id,
      school: 'physical',
    });
    expect(sim.player.critChance).toBeCloseTo(crit0 + 0.03, 5);
  });

  it('swaps Battle <-> Guarded via the exclusive group', () => {
    const sim = makeSim();
    sim.tick();
    sim.setPlayerLevel(20);
    sim.tick();
    expect(stanceAuras(sim).map((a) => a.kind)).toEqual(['battle_stance']);
    // Cast Guarded: it cancels Battle (never both), staying exactly one stance.
    sim.castAbility('defensive_stance');
    sim.tick();
    expect(stanceAuras(sim).map((a) => a.kind)).toEqual(['defensive_stance']);
    // Cast Battle again: swaps back.
    sim.castAbility('battle_stance');
    sim.tick();
    expect(stanceAuras(sim).map((a) => a.kind)).toEqual(['battle_stance']);
  });

  // The spec-change reconcile test that stood here went with the specs (Phase D0).
});
