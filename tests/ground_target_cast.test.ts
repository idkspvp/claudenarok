import { describe, expect, it } from 'vitest';
import { MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';
import type { GroundAoE } from '../src/sim/entity_roster';
import { Sim } from '../src/sim/sim';
import type { PlayerClass } from '../src/sim/types';
import { groundHeight } from '../src/sim/world';
import { OPEN_FIELD, placePlayerInOpenField } from './helpers/open_field';

// Ground-targeted casting primitive (docs/design/arpg-spell-mechanics.md), exercised
// through Flamestrike (mage, targetMode 'position', range 30). The deterministic sim
// is the authority: the client only proposes a point, the sim clamps it to the
// ability's range and the spell's ground zone is created there (not on the caster).

function place(sim: Sim, id: number, x: number, z: number): void {
  const e = sim.entities.get(id);
  if (!e) throw new Error(`no entity ${id}`);
  e.pos = { x, y: groundHeight(x, z, sim.cfg.seed), z };
  e.prevPos = { ...e.pos };
}

function makeMage(): { sim: Sim; pid: number } {
  const sim = new Sim({ seed: 7, playerClass: 'mage', noPlayer: true });
  const pid = sim.addPlayer('mage', 'Mag');
  placePlayerInOpenField(sim, pid);
  sim.setPlayerLevel(20, pid); // plenty of level for Flamestrike
  const me = sim.entities.get(pid);
  if (!me) throw new Error('no mage');
  me.resource = 9999; // plenty of mana for the cast
  return { sim, pid };
}

// Flamestrike is an aimed BURST (aoeDamage at the clamped point plus a
// radius-carrying spellfxAt for the impact ring), not a lingering ground zone.
// Since the mage unify it is a real 2 s cast (owner rule 2026-07-11), so the
// burst lands at cast RESOLVE, not at the castAbility call.
function spawnWolfAt(sim: Sim, x: number, z: number): ReturnType<typeof createMob> {
  const s = sim as unknown as { nextId: number; addEntity(e: ReturnType<typeof createMob>): void };
  const mob = createMob(s.nextId++, MOBS.forest_wolf, 1, {
    x,
    y: groundHeight(x, z, sim.cfg.seed),
    z,
  });
  mob.maxHp = 5000;
  mob.hp = 5000;
  mob.hostile = true;
  mob.aiState = 'idle';
  s.addEntity(mob);
  return mob;
}

function aimedFx(sim: Sim): { x: number; z: number; radius?: number } | undefined {
  for (const e of sim.drainEvents()) {
    if (e.type === 'spellfxAt') return e;
  }
  return undefined;
}

// Tick the in-flight cast through to its resolve, returning the aimed impact
// event (spellfxAt) it emits, if any. Bounded well past the 2 s cast: melee
// pushback from an adjacent mob can stretch it.
function resolveAimedCast(sim: Sim, pid: number): ReturnType<typeof aimedFx> {
  const me = sim.entities.get(pid);
  if (!me) throw new Error(`no caster ${pid}`);
  let fx: ReturnType<typeof aimedFx>;
  for (let i = 0; i < 200 && me.castingAbility && !fx; i++) {
    fx = sim.tick().find((e) => e.type === 'spellfxAt');
  }
  return fx;
}

describe('ground-targeted casting (Flamestrike)', () => {
  it('detonates at the aimed point (ring event + damage there), not on the caster', () => {
    const { sim, pid } = makeMage();
    place(sim, pid, 0, 0);
    const atAim = spawnWolfAt(sim, 18, 0);
    const atCaster = spawnWolfAt(sim, 0, 2);
    sim.drainEvents();

    sim.castAbility('flamestrike', pid, { x: 18, z: 0 }); // within range 30

    const fx = resolveAimedCast(sim, pid);
    expect(fx).toBeDefined();
    expect(fx?.x).toBeCloseTo(18, 1);
    expect(fx?.radius).toBe(7); // the AoE ring size rides the event
    expect(atAim.hp).toBeLessThan(5000);
    expect(atCaster.hp).toBe(5000); // 16yd from the blast: untouched
  });

  it('clamps the aimed point to the ability range from the caster', () => {
    const { sim, pid } = makeMage();
    place(sim, pid, OPEN_FIELD.x, OPEN_FIELD.z);
    const atClamp = spawnWolfAt(sim, OPEN_FIELD.x + 30, OPEN_FIELD.z);
    sim.drainEvents();

    sim.castAbility('flamestrike', pid, { x: OPEN_FIELD.x + 100, z: OPEN_FIELD.z });

    const fx = resolveAimedCast(sim, pid);
    expect(fx?.x).toBeCloseTo(OPEN_FIELD.x + 30, 0);
    expect(atClamp.hp).toBeLessThan(5000);
  });

  it('falls back to the caster position when no point is chosen', () => {
    const { sim, pid } = makeMage();
    place(sim, pid, 5, 5);
    const nearCaster = spawnWolfAt(sim, 7, 5);
    sim.drainEvents();

    sim.castAbility('flamestrike', pid); // no aim (e.g. a keybind cast)
    resolveAimedCast(sim, pid); // no aim means no spellfxAt; just ride out the cast

    expect(nearCaster.hp).toBeLessThan(5000);
  });

  it('leaves no lingering ground zone (the burst is the whole spell)', () => {
    const { sim, pid } = makeMage();
    place(sim, pid, 0, 0);
    sim.castAbility('flamestrike', pid, { x: 18, z: 0 });
    expect(resolveAimedCast(sim, pid)).toBeDefined(); // the burst actually landed
    const zones = (sim as unknown as { groundAoEs: GroundAoE[] }).groundAoEs;
    expect(zones.some((z) => z.ability === 'Flamestrike')).toBe(false);
  });
});

// The thematic per-class ground-targeted spells. Rain of Fire (mage), Volley
// (archer) and Hurricane (acolyte) are CHANNELED: casting begins a channel aimed at
// the (clamped) point, and each tick pulses an AoE there via the channel-tick path.
// Earthquake (acolyte) is an instant lingering ground zone (groundAoE).
describe('ground-targeted casting (thematic per-class spells)', () => {
  function castGroundSpell(cls: PlayerClass, spell: string, aim: { x: number; z: number }): Sim {
    const sim = new Sim({ seed: 7, playerClass: cls, noPlayer: true });
    const pid = sim.addPlayer(cls, 'Caster');
    sim.setPlayerLevel(20, pid);
    const me = sim.entities.get(pid);
    if (!me) throw new Error('no caster');
    me.resource = 9999;
    place(sim, pid, 0, 0);
    sim.castAbility(spell, pid, aim);
    return sim;
  }

  // Rain of Fire and Hurricane went with the Warlock and the Druid in D1; Volley
  // is the surviving AIMED channel (Rending Cyclone is a channel too, but it is
  // self-centred, so it does not exercise the aim clamp this covers).
  const channeled = [{ cls: 'archer', spell: 'volley' }] as const;

  for (const c of channeled) {
    it(`${c.spell} (${c.cls}) begins a channel aimed at the (clamped) point`, () => {
      const sim = castGroundSpell(c.cls, c.spell, { x: 100, z: 0 }); // far beyond range
      const me = sim.entities.get(sim.playerId);
      expect(me?.channeling, `${c.spell} channeling`).toBe(true);
      // aim is clamped to the ability's range from the caster at (0,0)
      const range = sim.known.find((k) => k.def.id === c.spell)?.def.range ?? 0;
      expect(me?.castAim?.x).toBeCloseTo(range, 0);
      expect(me?.castAim?.z).toBeCloseTo(0, 1);
    });

    it(`${c.spell} (${c.cls}) emits a radius-carrying aimed pulse on channel tick`, () => {
      const sim = castGroundSpell(c.cls, c.spell, { x: 16, z: 0 });
      const radius = sim.known
        .find((k) => k.def.id === c.spell)
        ?.def.effects.find((eff) => eff.type === 'aoeDamage')?.radius;
      sim.drainEvents();

      let fx: ReturnType<typeof aimedFx>;
      for (let i = 0; i < 40 && !fx; i++) {
        fx = sim.tick().find((e) => e.type === 'spellfxAt');
      }

      expect(fx).toBeDefined();
      expect(fx?.x).toBeCloseTo(16, 1);
      expect(fx?.z).toBeCloseTo(0, 1);
      expect(fx?.radius).toBe(radius);
    });
  }

  it('a channeled ground spell damages enemies in the aimed area over its ticks', () => {
    // Flat dungeon-floor band (x > 600) for deterministic clear line-of-sight.
    const FLAT_X = 700;
    const sim = new Sim({ seed: 7, playerClass: 'archer', noPlayer: true });
    const pid = sim.addPlayer('archer', 'Shooter');
    sim.setPlayerLevel(20, pid);
    const me = sim.entities.get(pid);
    if (!me) throw new Error('no archer');
    me.resource = 9999;
    place(sim, pid, FLAT_X, 0);
    const mob = createMob(9100, MOBS.forest_wolf, 20, sim.groundPos(FLAT_X + 6, 0));
    mob.hostile = true;
    sim.entities.set(9100, mob);
    const hp0 = mob.hp;

    sim.castAbility('volley', pid, { x: FLAT_X + 6, z: 0 });
    // advance through enough of the 4 s channel for at least one tick to land
    for (let i = 0; i < 40; i++) sim.tick();

    expect(mob.hp).toBeLessThan(hp0);
  });

  it('a completed ground-targeted channel clears castAim (always cleared on resolve)', () => {
    const sim = castGroundSpell('archer', 'volley', { x: 16, z: 0 });
    const me = sim.entities.get(sim.playerId);
    expect(me?.channeling).toBe(true);
    expect(me?.castAim).not.toBeNull();
    for (let i = 0; i < 120 && me?.castingAbility; i++) sim.tick();
    expect(me?.castingAbility).toBeNull();
    expect(me?.castAim).toBeNull();
  });

  it('blizzard (mage) drops a lingering zone at the aimed point', () => {
    // Earthquake was the Shaman's and went with the class; Blizzard is the
    // surviving position-targeted spell that leaves a zone behind it.
    const sim = castGroundSpell('mage', 'blizzard', { x: 16, z: 0 });
    // Blizzard is a 2s timed cast, not an instant, so the zone only exists once the
    // cast completes; it is also `delayed`, so it deliberately emits no on-cast
    // pulse and the zone itself is the whole claim.
    for (let i = 0; i < 60; i++) sim.tick();
    const zones = (sim as unknown as { groundAoEs: GroundAoE[] }).groundAoEs;
    const zone = zones.find((z) => Math.abs(z.pos.x - 16) < 1 && Math.abs(z.pos.z) < 1);
    expect(zone, `no zone at the aimed point; saw ${zones.map((z) => z.ability).join(', ')}`)
      .toBeDefined();
    expect(zone?.radius).toBe(7);
  });
});
