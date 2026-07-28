// chainDamage: a direct hit on the target that then bounces to up to 2 nearby enemies
// AROUND THE TARGET (not the caster). Regression for the old caster-centered, uncapped
// aoeDamage that hit enemies next to the caster and re-hit the primary. The bounce is
// deterministic (nearest squared distance, then lowest id) and draws no extra rng.
//
// The effect list is SYNTHETIC. This used to drive a paladin signature, and the class
// collapse cut both the ability and every other authored chain, so no content reaches
// this dispatch arm today. The arm is live code that the ability re-home will want, so
// the coverage is kept and fed directly rather than deleted along with the ability.
import { describe, expect, it } from 'vitest';
import { MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';
import { Sim } from '../src/sim/sim';
import type { Entity } from '../src/sim/types';

function hostileAt(sim: Sim, x: number, z: number): Entity {
  const p = sim.entities.get(sim.playerId) as Entity;
  const m = createMob((sim as unknown as { nextId: number }).nextId++, MOBS.ridge_stalker, 20, {
    x,
    y: p.pos.y,
    z,
  });
  m.maxHp = m.hp = 1_000_000;
  (sim as unknown as { addEntity(e: Entity): void }).addEntity(m);
  return m;
}

const tookDamage = (m: Entity) => m.maxHp - m.hp > 0;

describe('Hallowed Wall bounce', () => {
  it('bounces to enemies around the target, not the caster, capped at 2', () => {
    const sim = new Sim({ seed: 7, playerClass: 'swordman', autoEquip: true });
    sim.setPlayerLevel(20);
    const p = sim.entities.get(sim.playerId) as Entity;
    p.maxHp = p.hp = 1_000_000; // survive incidental mob swings during resolution
    const meta = (sim as unknown as { players: Map<number, unknown> }).players.get(sim.playerId);

    // Primary target 15 yd ahead.
    const primary = hostileAt(sim, p.pos.x, p.pos.z + 15);
    // Three enemies clustered tightly around the TARGET (all within the 10 yd bounce
    // radius, and within LoS of each other so the arc reaches them).
    const nearTarget = [
      hostileAt(sim, p.pos.x + 2, p.pos.z + 15),
      hostileAt(sim, p.pos.x - 2, p.pos.z + 15),
      hostileAt(sim, p.pos.x + 4, p.pos.z + 15),
    ];
    // Two enemies next to the CASTER, > 10 yd from the target: must never be bounced to.
    const nearCaster = [hostileAt(sim, p.pos.x + 3, p.pos.z), hostileAt(sim, p.pos.x, p.pos.z + 3)];

    // Run the effects directly against the primary target: that drives the
    // directDamage + chainDamage dispatch deterministically, without the cast pipeline's
    // seed-dependent caster-to-target terrain LoS getting in the way of the bounce logic.
    // A real known ability supplies the surrounding shape (school, cast time, scaling);
    // only the effect list is replaced.
    const known = (
      sim as unknown as { players: Map<number, { known: { def: { id: string } }[] }> }
    ).players.get(sim.playerId)?.known?.[0];
    const base = (
      sim as unknown as { resolvedAbility(id: string, pid: number): Record<string, unknown> }
    ).resolvedAbility(known?.def.id ?? '', sim.playerId);
    const res = {
      ...base,
      effects: [
        { type: 'directDamage', min: 40, max: 40 },
        { type: 'chainDamage', min: 20, max: 20, jumps: 2, falloff: 1, radius: 10 },
      ],
    };
    (
      sim as unknown as {
        ctx: { runEffects(p: Entity, meta: unknown, target: Entity, res: unknown): void };
      }
    ).ctx.runEffects(p, meta, primary, res);

    // Primary is hit by the direct component.
    expect(tookDamage(primary)).toBe(true);
    // Exactly two of the three target-adjacent enemies take the bounce (jumps = 2).
    expect(nearTarget.filter(tookDamage)).toHaveLength(2);
    // The caster-adjacent enemies are untouched: the bounce centers on the target.
    expect(nearCaster.some(tookDamage)).toBe(false);
  });
});
