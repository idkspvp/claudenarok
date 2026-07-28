// #96 — players must not damage or hostile-CC each other outside an accepted
// duel/PvP. These lock the invariant so the "killed in the starter village /
// polymorphed into a baby llama" griefing path can never regress.
import { describe, expect, it } from 'vitest';
import { runEffects } from '../src/sim/combat/effect_dispatch';
import type { PlayerMeta, ResolvedAbility } from '../src/sim/sim';
import { Sim } from '../src/sim/sim';
import type { AbilityDef, Entity, Vec3 } from '../src/sim/types';
import { dist2d } from '../src/sim/types';
import { fundCasts } from './helpers/sp';

function twoPlayers(clsA = 'mage', clsB = 'swordman') {
  const sim = new Sim({
    seed: 42,
    playerClass: clsA as any,
    playerName: 'Caster',
    autoEquip: true,
  });
  const aPid = sim.primaryId;
  const bPid = sim.addPlayer(clsB as any, 'Victim', { autoEquip: true });
  const a = sim.entities.get(aPid)!;
  const b = sim.entities.get(bPid)!;
  // stand them next to each other and face A at B
  b.pos = { ...a.pos, x: a.pos.x + 3 };
  b.prevPos = { ...b.pos };
  a.facing = Math.atan2(b.pos.x - a.pos.x, b.pos.z - a.pos.z);
  sim.setPlayerLevel(12, aPid);
  sim.setPlayerLevel(12, bPid);
  return { sim, aPid, bPid, a, b };
}

function startDuel(clsA = 'mage', clsB = 'swordman', level = 20) {
  const setup = twoPlayers(clsA, clsB);
  const { sim, aPid, bPid, a, b } = setup;
  sim.setPlayerLevel(level, aPid);
  sim.setPlayerLevel(level, bPid);
  fundCasts(a);
  a.facing = Math.atan2(b.pos.x - a.pos.x, b.pos.z - a.pos.z);
  sim.duelRequest(bPid, aPid);
  sim.duelAccept(bPid);
  for (let i = 0; i < 20 * 5; i++) {
    sim.tick();
    if (sim.duelFor(aPid)?.state === 'active') break;
  }
  sim.targetEntity(bPid, aPid);
  return setup;
}

function finishCast(sim: Sim, pid: number) {
  for (let i = 0; i < 20 * 4; i++) {
    sim.tick();
    if (!sim.entities.get(pid)!.castingAbility) break;
  }
  // A spell's effects now land when its projectile reaches the target
  // (projectile_travel), a few ticks after the cast bar empties: tick until the
  // in-flight bolt has resolved so the debuff/CC is actually applied.
  for (let i = 0; i < 20 * 3 && (sim as any).pendingProjectiles.length > 0; i++) sim.tick();
}

function metaOf(sim: Sim, p: Entity): PlayerMeta {
  const meta = sim.players.get(p.id);
  if (!meta) throw new Error(`missing player meta for ${p.id}`);
  return meta;
}

function interruptRes(lockout = 8): ResolvedAbility {
  const def: AbilityDef = {
    id: 'test_interrupt',
    name: 'Test Interrupt',
    class: 'thief',
    learnLevel: 1,
    cost: 0,
    castTime: 0,
    cooldown: 0,
    range: 30,
    school: 'physical',
    requiresTarget: true,
    effects: [{ type: 'interrupt', lockout }],
    description: '',
  };
  return {
    def,
    rank: 1,
    cost: 0,
    castTime: 0,
    cooldown: 0,
    effects: def.effects,
    threatFlat: 0,
    threatMult: 1,
  };
}

const pos = (e: Entity): Vec3 => ({ ...e.pos });

const hasCc = (e: Entity) =>
  e.auras.some(
    (au) =>
      au.kind === 'polymorph' ||
      au.kind === 'stun' ||
      au.kind === 'incapacitate' ||
      au.kind === 'root',
  );

describe('PvP safety outside duels (#96)', () => {
  it('a player cannot polymorph another player', () => {
    const { sim, aPid, bPid, b } = twoPlayers('mage', 'swordman');
    sim.targetEntity(bPid, aPid);
    sim.castAbility('polymorph', aPid);
    expect(b.auras.some((au) => au.kind === 'polymorph')).toBe(false);
    expect(hasCc(b)).toBe(false);
  });

  it('a player cannot auto-attack another player', () => {
    const { sim, aPid, bPid, b } = twoPlayers('swordman', 'mage');
    const startHp = b.hp;
    sim.targetEntity(bPid, aPid);
    sim.startAutoAttack(aPid);
    for (let i = 0; i < 20 * 4; i++) sim.tick();
    expect(b.hp).toBe(startHp); // never took a hit
  });

  it('a player AoE (Frost Nova) does not root or damage a nearby player', () => {
    const { sim, aPid, b } = twoPlayers('mage', 'swordman');
    const startHp = b.hp;
    sim.castAbility('frost_nova', aPid); // self-centred AoE root, B is 3yd away
    for (let i = 0; i < 5; i++) sim.tick();
    expect(b.hp).toBe(startHp);
    expect(hasCc(b)).toBe(false);
  });

  it('a player interrupt does not cancel or lock out another player', () => {
    const { sim, a, b } = twoPlayers('thief', 'mage');
    b.castingAbility = 'fireball';
    b.castRemaining = 1.25;
    b.castTotal = 1.5;

    runEffects(sim.ctx, a, metaOf(sim, a), b, interruptRes(8));

    expect(b.castingAbility).toBe('fireball');
    expect(b.castRemaining).toBe(1.25);
    expect(b.auras.some((aura) => aura.kind === 'lockout')).toBe(false);
  });

  it('an accepted duel DOES allow combat between the two players (positive control)', () => {
    const { sim, aPid, bPid, a, b } = twoPlayers('swordman', 'mage');
    sim.duelRequest(bPid, aPid);
    sim.duelAccept(bPid);
    // run out the countdown so the duel goes active
    for (let i = 0; i < 20 * 5; i++) sim.tick();
    const duel = sim.duelFor(aPid);
    expect(duel?.state).toBe('active');
    const startHp = b.hp;
    a.facing = Math.atan2(b.pos.x - a.pos.x, b.pos.z - a.pos.z);
    sim.targetEntity(bPid, aPid);
    sim.startAutoAttack(aPid);
    for (let i = 0; i < 20 * 6; i++) sim.tick();
    expect(b.hp).toBeLessThan(startHp); // duel combat works
  });
});

describe('PvP control abilities in active duels', () => {
  it('allows an interrupt between hostile duelists', () => {
    const { sim, a, b } = startDuel('thief', 'mage');
    b.castingAbility = 'fireball';
    b.castRemaining = 1.25;
    b.castTotal = 1.5;

    runEffects(sim.ctx, a, metaOf(sim, a), b, interruptRes(8));

    expect(b.castingAbility).toBeNull();
    expect(b.castRemaining).toBe(0);
    expect(b.auras).toContainEqual(
      expect.objectContaining({ kind: 'lockout', school: 'fire', duration: 8 }),
    );
  });

  it.each([
    // One live owner per control school. Fear, Hammer of Justice, and Entangling
    // Roots went with the Warlock, Paladin, and Druid in D1; these are the
    // surviving abilities that reach the same four aura kinds.
    { cls: 'mage', ability: 'polymorph', aura: 'polymorph' },
    { cls: 'thief', ability: 'gouge', aura: 'incapacitate' },
    { cls: 'thief', ability: 'kidney_shot', aura: 'stun' },
    { cls: 'mage', ability: 'frost_nova', aura: 'root' },
  ])('$ability works on hostile players', ({ cls, ability, aura }) => {
    const { sim, aPid, a, b } = startDuel(cls, 'swordman');
    if (ability === 'polymorph') b.hp = Math.max(1, b.maxHp - 120);
    // Icebind is a self-centred nova, not a targeted cast, so the two have to be
    // inside its radius for the root to reach the opponent at all.
    if (ability === 'frost_nova') b.pos = { ...a.pos, x: a.pos.x + 2 };
    // Low Blow is a finisher: it spends combo points, so the pool has to exist.
    if (ability === 'kidney_shot') {
      a.comboPoints = 3;
      a.comboUntil = sim.time + 30;
    }

    sim.castAbility(ability, aPid);
    finishCast(sim, aPid);

    expect(b.auras.some((au) => au.kind === aura)).toBe(true);
    if (ability === 'polymorph') expect(b.hp).toBe(b.maxHp);
  });

  it('does not polymorph non-hostile NPCs', () => {
    const sim = new Sim({ seed: 42, playerClass: 'mage', playerName: 'Caster', autoEquip: true });
    const npc = [...sim.entities.values()].find((e) => e.kind === 'npc');
    expect(npc).toBeDefined();
    sim.setPlayerLevel(20);
    fundCasts(sim.player);
    sim.targetEntity(npc!.id);

    sim.castAbility('polymorph');
    finishCast(sim, sim.primaryId);

    expect(npc!.auras.some((au) => au.kind === 'polymorph')).toBe(false);
  });

  it('diminishes repeated duel Polymorphs to 10s, 5s, 1s and resets after 60s', () => {
    const { sim, aPid, b } = startDuel('mage', 'swordman', 20);

    // Polymorph is now a projectile whose hit roll happens on impact, so it can miss.
    // A miss does not consume a diminishing-returns stage (that only advances on a
    // landed application), so retry until the bolt connects to measure the DR ladder.
    const castPolymorph = () => {
      const mage = sim.entities.get(aPid)!;
      for (let attempt = 0; attempt < 12; attempt++) {
        b.auras = b.auras.filter((aura) => aura.kind !== 'polymorph');
        mage.gcdRemaining = 0;
        mage.cooldowns.delete('polymorph');
        fundCasts(mage);
        sim.castAbility('polymorph', aPid);
        finishCast(sim, aPid);
        const applied = b.auras.find((aura) => aura.kind === 'polymorph');
        if (applied) return applied.duration;
      }
      return 0;
    };

    expect(castPolymorph()).toBe(10);
    expect(castPolymorph()).toBe(5);
    expect(castPolymorph()).toBe(1);

    b.auras = b.auras.filter((aura) => aura.kind !== 'polymorph');
    for (let i = 0; i < 20 * 61; i++) sim.tick();

    expect(castPolymorph()).toBe(10);
  });

  it('duel stuns land at full duration on every repeat (stun DR exemption)', () => {
    const { sim, aPid, b } = startDuel('thief', 'swordman', 20);

    // Hammer of Justice at level 20 is rank 2: a 4s instant stun. As with Fear, a
    // resisted stun applies nothing and does NOT advance diminishing returns, so
    // retry until it lands to keep the sequence stable against shared-RNG drift.
    const castStun = () => {
      let dur: number | null = 0;
      for (let attempt = 0; attempt < 50 && dur === 0; attempt++) {
        b.auras = b.auras.filter((aura) => aura.id !== 'kidney_shot_stun');
        const rogueA = sim.entities.get(aPid)!;
        rogueA.gcdRemaining = 0;
        fundCasts(rogueA);
        rogueA.cooldowns.delete('kidney_shot');
        rogueA.comboPoints = 3; // Low Blow is 1s base + 1s per point = 4s
        rogueA.comboUntil = sim.time + 30;
        sim.castAbility('kidney_shot', aPid);
        finishCast(sim, aPid);
        dur = b.auras.find((aura) => aura.id === 'kidney_shot_stun')?.duration ?? 0;
      }
      return dur;
    };

    // Balance pass (maintainer): player stuns are EXEMPT from PvP diminishing
    // returns (they are short flat durations behind real cooldowns); every
    // repeat lands at full duration. Fear/polymorph/root keep their ladders.
    expect(castStun()).toBe(4);
    expect(castStun()).toBe(4);
    expect(castStun()).toBe(4);
    expect(castStun()).toBe(4);
  });

  it('keeps opener and controlled stuns on independent DR chains (#1004)', () => {
    // Classic-style stun DR is not one bucket: a from-stealth opener (Cheap Shot,
    // Pounce) must not eat into a controlled stun's chain (Kidney Shot, Hammer of
    // Justice). Simulate a fully diminished OPENER chain on the target, then prove a
    // controlled stun still lands at full duration and diminishes only within its
    // own controlled bucket.
    const { sim, aPid, b } = startDuel('thief', 'swordman', 20);

    // Pretend the target already burned its opener-stun chain to immunity.
    b.ccDr.set('openerStun', { stage: 3, resetAt: sim.time + 18 });

    const castStun = () => {
      let dur = 0;
      for (let attempt = 0; attempt < 50 && dur === 0; attempt++) {
        b.auras = b.auras.filter((aura) => aura.id !== 'kidney_shot_stun');
        const rogueA = sim.entities.get(aPid)!;
        rogueA.gcdRemaining = 0;
        fundCasts(rogueA);
        rogueA.cooldowns.delete('kidney_shot');
        rogueA.comboPoints = 3; // Low Blow is 1s base + 1s per point = 4s
        rogueA.comboUntil = sim.time + 30;
        sim.castAbility('kidney_shot', aPid);
        finishCast(sim, aPid);
        dur = b.auras.find((aura) => aura.id === 'kidney_shot_stun')?.duration ?? 0;
      }
      return dur;
    };

    // The controlled stun is unaffected by the spent opener chain, and with
    // the stun-DR exemption every repeat stays full length.
    expect(castStun()).toBe(4);
    expect(castStun()).toBe(4);
    expect(castStun()).toBe(4);
  });

  it('does not diminish PvE stuns: a stun on a mob keeps full duration on repeat', () => {
    // DR is duel/PvP only (player source AND player target). A thief stunning a
    // hostile mob must always land the full 4s, no matter how many times in a row.
    const sim = new Sim({
      seed: 7,
      playerClass: 'thief',
      playerName: 'Pala',
      autoEquip: true,
    });
    const pid = sim.primaryId;
    sim.setPlayerLevel(20, pid);
    const p = sim.entities.get(pid)!;
    // Find a hostile mob in the world near the player.
    let mob: Entity | undefined;
    for (const e of sim.entities.values()) {
      if (e.kind === 'mob' && e.hostile && e.ownerId === null && !e.dead) {
        mob = e;
        break;
      }
    }
    expect(mob).toBeDefined();
    const m = mob!;
    m.pos = { ...p.pos, x: p.pos.x + 3 };
    m.prevPos = { ...m.pos };
    p.facing = Math.atan2(m.pos.x - p.pos.x, m.pos.z - p.pos.z);
    sim.targetEntity(m.id, pid);

    const stunMob = () => {
      m.auras = m.auras.filter((aura) => aura.id !== 'kidney_shot_stun');
      p.gcdRemaining = 0;
      fundCasts(p);
      p.cooldowns.delete('kidney_shot');
      p.comboPoints = 3;
      p.comboUntil = sim.time + 30;
      let dur = 0;
      for (let attempt = 0; attempt < 50 && dur === 0; attempt++) {
        m.auras = m.auras.filter((aura) => aura.id !== 'kidney_shot_stun');
        p.gcdRemaining = 0;
        fundCasts(p);
        p.cooldowns.delete('kidney_shot');
        p.comboPoints = 3;
        p.comboUntil = sim.time + 30;
        sim.castAbility('kidney_shot', pid);
        finishCast(sim, pid);
        dur = m.auras.find((aura) => aura.id === 'kidney_shot_stun')?.duration ?? 0;
      }
      return dur;
    };

    expect(stunMob()).toBe(4);
    expect(stunMob()).toBe(4);
    expect(stunMob()).toBe(4);
    expect(stunMob()).toBe(4);
  });
});
