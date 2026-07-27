// Chronomancy Phase 1 (docs/prd/mage-chronomancy.md): the mage's third spec
// becomes the temporal healer. Internal spec id stays 'arcane' (persistence);
// the presentation is Chronomancy / healer. Kit: Temporal Mend (the reliable
// 2s direct heal, the spec signature) + Temporal Barrier (the 12s-cooldown
// single-target shield). The DPS gating trims the healer's book, never the
// fire/frost books.
import { describe, expect, it } from 'vitest';
import { abilitiesKnownAt } from '../src/sim/content/classes';
import { MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';
import { Sim } from '../src/sim/sim';
import type { Entity, SimEvent } from '../src/sim/types';
import { fundCasts } from './helpers/sp';

function chronoMage(level = 20) {
  const sim = new Sim({ seed: 41, playerClass: 'mage', autoEquip: true });
  sim.setPlayerLevel(level);
  sim.tick();
  const p = sim.player;
  fundCasts(p);
  return { sim, p };
}

function knownIds(level = 20): string[] {
  return abilitiesKnownAt('mage', level).map((k) => k.def.id);
}

function collect(sim: Sim, seconds: number): SimEvent[] {
  const out: SimEvent[] = [];
  for (let i = 0; i < Math.round(seconds * 20); i++) out.push(...sim.tick());
  return out;
}

function addHostile(sim: Sim, dist = 6): Entity {
  const p = sim.player;
  const mob = createMob(9500, MOBS.training_dummy, 20, {
    x: p.pos.x,
    y: p.pos.y,
    z: p.pos.z + dist,
  });
  mob.hostile = true;
  mob.maxHp = mob.hp = 100000;
  (sim as unknown as { addEntity(e: Entity): void }).addEntity(mob);
  return mob;
}

// The spec card and the spec-gating block that stood here are retired with the
// specializations (Phase D0). A mage now learns every mage ability at its learn
// level, so what remains to pin is membership, not exclusivity.
describe('kit membership', () => {
  it('a level-20 mage knows the Chronomancy kit alongside the fire and frost books', () => {
    const book = knownIds();
    for (const id of [
      'temporal_mend',
      'temporal_barrier',
      'arcane_missiles',
      'arcane_explosion',
      'fire_blast',
      'pyroblast',
      'ice_barrier',
      'frost_armor',
    ]) {
      expect(book, id).toContain(id);
    }
  });
});

describe('Temporal Mend', () => {
  it('heals the mage themself through the normal channel (cast, cost, no overheal)', () => {
    const { sim, p } = chronoMage();
    p.hp = Math.floor(p.maxHp * 0.5);
    const mana0 = p.resource;
    sim.castAbility('temporal_mend'); // no friendly target: resolves to self
    expect(p.castingAbility).toBe('temporal_mend'); // a real 2s cast
    const events = collect(sim, 2.5);
    const heal = events.find(
      (e): e is Extract<SimEvent, { type: 'heal2' }> =>
        e.type === 'heal2' && e.sourceId === p.id && e.targetId === p.id,
    );
    expect(heal).toBeDefined();
    expect(heal?.amount ?? 0).toBeGreaterThan(0);
    expect(p.resource).toBeLessThan(mana0); // billed
    expect(p.hp).toBeLessThanOrEqual(p.maxHp);
    // No overheal: a full-health recast clamps to zero effective healing.
    p.hp = p.maxHp;
    (p as unknown as { gcdRemaining: number }).gcdRemaining = 0;
    sim.castAbility('temporal_mend');
    const events2 = collect(sim, 2.5);
    const heal2 = events2.find(
      (e): e is Extract<SimEvent, { type: 'heal2' }> =>
        e.type === 'heal2' && e.targetId === p.id && e.sourceId === p.id,
    );
    expect(heal2?.amount).toBe(0);
    expect(p.hp).toBe(p.maxHp);
  });

  it('heals a wounded ally and draws healing threat', () => {
    const { sim, p } = chronoMage();
    const ally = sim.addPlayer('swordman', 'Tanque');
    const allyEnt = sim.entities.get(ally);
    if (!allyEnt) throw new Error('ally missing');
    allyEnt.pos.x = p.pos.x + 5;
    allyEnt.pos.z = p.pos.z;
    const mob = addHostile(sim, 6);
    // The ally is fighting the mob (on its threat table): healing the ally
    // must then put the HEALER on that same table (classic healing threat).
    (
      sim as unknown as {
        dealDamage(
          s: Entity,
          t: Entity,
          n: number,
          c: boolean,
          sc: string,
          a: null,
          k: string,
        ): void;
      }
    ).dealDamage(allyEnt, mob, 1, false, 'physical', null, 'hit');
    allyEnt.hp = Math.max(1, Math.floor(allyEnt.maxHp * 0.4));
    // Intellect no longer buys a heal crit: pre-renewal magic has no critical at
    // all, so the roll is still drawn and always fails.
    p.stats.int = 2000;
    sim.targetEntity(ally);
    sim.castAbility('temporal_mend');
    const events = collect(sim, 2.5);
    const heal = events.find(
      (e): e is Extract<SimEvent, { type: 'heal2' }> =>
        e.type === 'heal2' && e.sourceId === p.id && e.targetId === ally,
    );
    expect(heal).toBeDefined();
    expect(heal?.crit).toBe(false);
    // Threat: the healer entered the mob's table via the effective healing.
    const threat = (mob as unknown as { threat?: Map<number, number> }).threat;
    expect(threat?.has(p.id)).toBe(true);
  });

  it('respects range like every other heal', () => {
    const { sim, p } = chronoMage();
    const ally = sim.addPlayer('swordman', 'Lejano');
    const allyEnt = sim.entities.get(ally);
    if (!allyEnt) throw new Error('ally missing');
    allyEnt.pos.x = p.pos.x + 50; // beyond the 30yd heal range
    allyEnt.pos.z = p.pos.z;
    allyEnt.hp = Math.floor(allyEnt.maxHp * 0.4);
    sim.targetEntity(ally);
    sim.castAbility('temporal_mend');
    expect(p.castingAbility).toBeNull(); // refused: out of range
  });
});

describe('Temporal Barrier', () => {
  it('shields self or ally for the rank amount, absorbs, expires, and a recast replaces', () => {
    const { sim, p } = chronoMage();
    sim.castAbility('temporal_barrier'); // no target: self
    sim.tick();
    let shield = p.auras.find((a) => a.id === 'temporal_barrier');
    expect(shield?.kind).toBe('absorb');
    // Rank 3 base 160 plus 25 percent of the caster's spell power (PR #2154's
    // barrier scaling). Derived from the caster's live spell power rather than
    // pinned: Intelligence converts through statusMagicPower now, so the flat 40
    // the original literal assumed is no longer a constant of the class. The
    // Chronoweave mastery x1.15 that used to ride on top went with the spec
    // masteries (Phase D0).
    expect(shield?.value).toBe(160 + Math.round(p.spellPower * 0.25));
    // Absorption channels through the normal pipeline: a 100 hit leaves hp
    // untouched and the shell down by exactly what it soaked.
    const shieldBefore = shield?.value ?? 0;
    const mob = addHostile(sim);
    const hp0 = p.hp;
    (
      sim as unknown as {
        dealDamage(
          s: Entity,
          t: Entity,
          n: number,
          c: boolean,
          sc: string,
          a: null,
          k: string,
        ): void;
      }
    ).dealDamage(mob, p, 100, false, 'physical', null, 'hit');
    expect(p.hp).toBe(hp0);
    shield = p.auras.find((a) => a.id === 'temporal_barrier');
    expect(shield?.value).toBe(shieldBefore - 100);
    // A same-caster recast REPLACES to full (the documented absorb rule).
    p.cooldowns.delete('temporal_barrier');
    (p as unknown as { gcdRemaining: number }).gcdRemaining = 0;
    fundCasts(p);
    sim.castAbility('temporal_barrier');
    sim.tick();
    const shields = p.auras.filter((a) => a.id === 'temporal_barrier');
    expect(shields.length).toBe(1); // never stacks with itself
    expect(shields[0].value).toBe(shieldBefore); // fresh full shell
    // Expiry: ride past the 10s window and the shell is gone.
    collect(sim, 10.5);
    expect(p.auras.some((a) => a.id === 'temporal_barrier')).toBe(false);
  });

  it('lands on an ally and is instant on the GCD', () => {
    const { sim, p } = chronoMage();
    const ally = sim.addPlayer('swordman', 'Escudado');
    const allyEnt = sim.entities.get(ally);
    if (!allyEnt) throw new Error('ally missing');
    allyEnt.pos.x = p.pos.x + 5;
    allyEnt.pos.z = p.pos.z;
    sim.targetEntity(ally);
    sim.castAbility('temporal_barrier');
    expect(p.castingAbility).toBeNull(); // instant
    expect((p as unknown as { gcdRemaining: number }).gcdRemaining).toBeGreaterThan(0); // on the GCD
    sim.tick();
    expect(allyEnt.auras.some((a) => a.id === 'temporal_barrier' && a.kind === 'absorb')).toBe(
      true,
    );
    expect(p.cooldowns.has('temporal_barrier')).toBe(true); // the 12s cooldown armed
  });
});

// The persistence block that stood here round-tripped the committed spec id and
// a saved loadout; both went with the talent system (Phase D0).
