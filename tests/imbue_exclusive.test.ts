import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import type { Entity, PlayerClass, SimEvent } from '../src/sim/types';
import { fundCasts } from './helpers/sp';

// Weapon imbues (acolyte rockbiter/flametongue/frostbrand, thief instant/deadly
// poison, swordman seal) are a single weapon-enchant slot: classic allows exactly
// one active at a time. The deterministic sim must never carry two `imbue` auras,
// because meleeSwing sums every one of them (H2-1). These tests pin that a fresh
// imbue replaces any other, so the per-swing bonus can never stack.

function makePlayer(cls: PlayerClass, level: number): { sim: Sim; p: Entity } {
  const sim = new Sim({ seed: 42, playerClass: 'swordman', noPlayer: true });
  const pid = sim.addPlayer(cls, 'Imbuer');
  sim.setPlayerLevel(level, pid);
  sim.tick();
  return { sim, p: sim.entities.get(pid)! };
}

// Cast an instant imbue and let it resolve, clearing the GCD/cost gate first so a
// rapid sequence of casts all land (mirrors how a player chains them in practice).
// Returns the events drained by the resolving tick so callers can assert on emits.
function cast(sim: Sim, p: Entity, ability: string): SimEvent[] {
  p.gcdRemaining = 0;
  p.cooldowns.delete(ability);
  fundCasts(p);
  sim.castAbility(ability, p.id);
  return sim.tick();
}

const imbues = (p: Entity) => p.auras.filter((a) => a.kind === 'imbue');

describe('weapon imbues are a mutually-exclusive single slot (H2-1)', () => {
  // The Shaman owned the three weapon imbues this suite was built on and was cut
  // in D1, so the Thief's poisons are the whole live imbue surface. They exercise
  // the same one-slot rule, which is what is actually under test here.
  it('thief cannot stack instant + deadly poison', () => {
    const { sim, p } = makePlayer('thief', 20);
    cast(sim, p, 'instant_poison');
    cast(sim, p, 'deadly_poison');
    expect(imbues(p)).toHaveLength(1);
    expect(imbues(p)[0].id).toBe('deadly_poison');
    // and the surviving bonus is the single enchant's value, never the +22 sum
    expect(imbues(p)[0].value).toBe(14);
  });

  it('emits an aura-lost event for the displaced imbue so the old buff icon clears', () => {
    const { sim, p } = makePlayer('thief', 20);
    cast(sim, p, 'instant_poison');
    const events = cast(sim, p, 'deadly_poison');
    // the replaced imbue is announced lost (this is what clears its client buff icon)
    expect(events).toContainEqual({
      type: 'aura',
      targetId: p.id,
      name: "Adder's Bite",
      gained: false,
    });
    // and the new imbue is announced gained
    expect(events).toContainEqual({
      type: 'aura',
      targetId: p.id,
      name: 'Festering Venom',
      gained: true,
    });
  });

  it('re-casting the same imbue refreshes in place (still one aura)', () => {
    const { sim, p } = makePlayer('thief', 20);
    cast(sim, p, 'instant_poison');
    const dur = imbues(p)[0].remaining;
    // tick a little so the refresh is observable, then re-cast the same one
    for (let i = 0; i < 10; i++) sim.tick();
    expect(imbues(p)[0].remaining).toBeLessThan(dur);
    cast(sim, p, 'instant_poison');
    expect(imbues(p)).toHaveLength(1);
    expect(imbues(p)[0].id).toBe('instant_poison');
    expect(imbues(p)[0].remaining).toBe(dur); // refreshed to full
  });

  it('is deterministic: same seed yields the same single-imbue result', () => {
    const run = () => {
      const { sim, p } = makePlayer('thief', 20);
      cast(sim, p, 'instant_poison');
      cast(sim, p, 'deadly_poison');
      return imbues(p).map((a) => ({ id: a.id, value: a.value }));
    };
    expect(run()).toEqual(run());
    expect(run()).toHaveLength(1);
  });
});
