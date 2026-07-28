// Direct unit tests for src/sim/combat/effect_dispatch.ts (C4b). These drive the
// EXPORTED runEffects against a real Sim's SimContext (sim.ctx), resolving an
// ability the same way the cast lifecycle does (ctx.resolvedAbility) and calling the
// effect switch directly, independent of the parity golden: a multi-effect cast that
// fans into BOTH a direct hit and a dot in one call, a finisher that consumes combo
// (combo-spend reset after the loop), a ground-AoE on-cast pulse, and a
// determinism/replay assertion. Proves the extracted module is callable and the move
// preserved behavior.

import { describe, expect, it } from 'vitest';
import { runEffects } from '../src/sim/combat/effect_dispatch';
import { MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';
import type { PlayerMeta, ResolvedAbility } from '../src/sim/sim';
import { Sim } from '../src/sim/sim';
import type { Aura, Entity, PlayerClass } from '../src/sim/types';
import { fundCasts } from './helpers/sp';

type TestSim = Sim & {
  nextId: number;
  players: Map<number, PlayerMeta>;
  addEntity(entity: Entity): void;
};

function harness(sim: Sim): TestSim {
  return sim as unknown as TestSim;
}

function makeSim(cls: PlayerClass, level: number): { sim: TestSim; p: Entity; meta: PlayerMeta } {
  const sim = harness(new Sim({ seed: 4242, playerClass: cls, autoEquip: true }));
  sim.setPlayerLevel(level);
  const p = sim.player;
  const meta = sim.players.get(p.id);
  if (!meta) throw new Error(`missing player meta for ${p.id}`);
  fundCasts(p);
  return { sim, p, meta };
}

// An idle hostile target in range + faced, so an offensive ability resolves + lands.
function spawnTarget(sim: TestSim, p: Entity, level = 1, dz = 4): Entity {
  const mob = createMob(sim.nextId++, MOBS.forest_wolf, level, {
    x: p.pos.x,
    y: p.pos.y,
    z: p.pos.z + dz,
  });
  mob.maxHp = 50000;
  mob.hp = 50000;
  mob.hostile = true;
  mob.aiState = 'idle';
  sim.addEntity(mob);
  p.facing = Math.atan2(mob.pos.x - p.pos.x, mob.pos.z - p.pos.z);
  sim.targetEntity(mob.id, p.id);
  return mob;
}

// Resolve an ability the way the cast lifecycle does; throw (narrowing null away) so
// a content change that stops the ability resolving fails loudly instead of silently.
function resolve(sim: TestSim, abilityId: string, pid: number): ResolvedAbility {
  const res = sim.ctx.resolvedAbility(abilityId, pid) as ResolvedAbility | null;
  if (!res) throw new Error(`${abilityId} did not resolve`);
  return res;
}

describe('effect_dispatch: a single cast fans into every listed effect', () => {
  it('fireball applies BOTH a direct hit and a dot aura in one runEffects call', () => {
    // Moonfire was the Druid's; Fireball is the surviving cast that fans into a
    // direct hit and a damage-over-time aura from one effect list.
    const { sim, p, meta } = makeSim('mage', 20);
    const mob = spawnTarget(sim, p);
    const hp0 = mob.hp;
    const res = resolve(sim, 'fireball', p.id);

    runEffects(sim.ctx, p, meta, mob, res);

    // directDamage effect: the mob took a hit.
    expect(mob.hp).toBeLessThan(hp0);
    // dot effect (same cast): a damage-over-time aura sourced by the mage landed.
    expect(mob.auras.some((a: Aura) => a.kind === 'dot' && a.sourceId === p.id)).toBe(true);
  });

  it('thief eviscerate: finisherDamage lands AND the combo-spend reset fires after the loop', () => {
    const { sim, p, meta } = makeSim('thief', 20);
    const mob = spawnTarget(sim, p);
    p.comboPoints = 5; // character-bound: no target anchor needed
    const hp0 = mob.hp;
    const res = resolve(sim, 'eviscerate', p.id);

    runEffects(sim.ctx, p, meta, mob, res);

    expect(mob.hp).toBeLessThan(hp0); // finisherDamage (spentCombo > 0) dealt damage
    expect(p.comboPoints).toBe(0); // spendsCombo reset, AFTER the effect loop
  });

  it('mage blizzard: the groundAoE case pushes a zone whose pulse re-anchors leashes', () => {
    // Consecration went with the Paladin, and it was the only ground AoE that
    // pulsed ON CAST. Every live one is `delayed`, so the zone is pushed here and
    // the pulse is driven explicitly, which is the same code path the tick driver
    // takes; the on-cast-pulse arm itself has no live caster until D4 re-homes one.
    const { sim, p, meta } = makeSim('mage', 20);
    const mob = spawnTarget(sim, p, 8, 2); // inside the zone radius
    const before = sim.ctx.groundAoEs.length;
    mob.aiState = 'chase';
    mob.aggroTargetId = p.id;
    mob.inCombat = true;
    p.inCombat = true;
    mob.leashAnchor = { ...mob.pos, x: mob.pos.x - 10 };
    const anchorBefore = { ...mob.leashAnchor };
    const res = resolve(sim, 'blizzard', p.id);

    runEffects(sim.ctx, p, meta, null, res); // a ground AoE resolves with no target

    expect(sim.ctx.groundAoEs.length).toBe(before + 1); // groundAoEs.push happened
    sim.ctx.pulseGroundAoE(sim.ctx.groundAoEs[0]);
    expect(mob.hp).toBeLessThan(mob.maxHp);
    expect(mob.leashAnchor).not.toEqual(anchorBefore);
    expect(mob.leashAnchor.x).toBeCloseTo(mob.pos.x);
    expect(mob.leashAnchor.z).toBeCloseTo(mob.pos.z);

    // The original case also pinned that a LATER pulse does not move the anchor
    // again. That arm hung off the on-cast pulse being the first one, which no
    // live ground AoE has any more, so it goes with Consecration rather than being
    // re-pointed at a pulse sequence that means something different.
  });
});

describe('effect_dispatch: determinism / replay', () => {
  it('same seed + same multi-effect cast => byte-identical outcome and draw count', () => {
    const run = (): { hp: number; auras: number; draws: number } => {
      const { sim, p, meta } = makeSim('mage', 20);
      const mob = spawnTarget(sim, p);
      const res = resolve(sim, 'fireball', p.id);
      let draws = 0;
      sim.rng.setObserver(() => {
        draws++;
      });
      runEffects(sim.ctx, p, meta, mob, res);
      sim.rng.setObserver(null);
      return { hp: mob.hp, auras: mob.auras.length, draws };
    };
    const a = run();
    const b = run();
    expect(a).toEqual(b); // identical damage, aura state, and rng draw count
    expect(a.draws).toBeGreaterThan(0); // the directDamage range+crit draws actually fired
  });
});
