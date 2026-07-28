import { describe, expect, it } from 'vitest';
import { MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';
import { summonPet } from '../src/sim/pet/pet_commands';
import { Sim } from '../src/sim/sim';
import { DT, type Entity } from '../src/sim/types';
import { fundCasts } from './helpers/sp';

function entity(sim: Sim, pid: number): Entity {
  const e = sim.entities.get(pid);
  if (!e) throw new Error(`missing entity ${pid}`);
  return e;
}

function addDummy(sim: Sim, x = sim.player.pos.x, z = sim.player.pos.z + 4): Entity {
  const mob = createMob((sim as any).nextId++, MOBS.ridge_stalker, 20, {
    x,
    y: sim.player.pos.y,
    z,
  });
  mob.maxHp = 1_000_000;
  mob.hp = mob.maxHp;
  mob.hostile = true;
  sim.entities.set(mob.id, mob);
  (sim as any).rebucket(mob);
  return mob;
}

describe('signature mechanics v2', () => {
  // The specialization arm that stood here has no source left: the specs and
  // their masteries went with the talent trees (Phase D0).

  it('trueshot_aura gives same-party allies a percent AP buff instead of flat AP', () => {
    const sim = new Sim({ seed: 12, playerClass: 'archer', autoEquip: true });
    const hunterPid = sim.playerId;
    const allyPid = sim.addPlayer('swordman', 'Aleph');
    sim.setPlayerLevel(20, hunterPid);
    sim.setPlayerLevel(20, allyPid);
    const archer = entity(sim, hunterPid);
    const ally = entity(sim, allyPid);
    ally.pos = { ...archer.pos, x: archer.pos.x + 3 };
    ally.prevPos = { ...ally.pos };
    (sim as any).rebucket(ally);
    sim.partyInvite(allyPid, hunterPid);
    sim.partyAccept(allyPid);

    const allyApBefore = ally.attackPower;
    fundCasts(archer);
    sim.castAbility('trueshot_aura', hunterPid);

    const aura = ally.auras.find((a) => a.kind === 'buff_ap_pct' && a.id === 'trueshot_aura_ap');
    expect(aura?.value).toBe(10);
    expect(aura?.duration).toBe(1800);
    expect(ally.attackPower).toBe(Math.round(allyApBefore * 1.1));
    expect(ally.attackPower - allyApBefore).not.toBe(35);
  });

  it('hemorrhage applies bleed vulnerability and makes later bleed ticks hit harder', () => {
    const sim = new Sim({ seed: 13, playerClass: 'thief', autoEquip: true });
    sim.setPlayerLevel(20);
    const thief = sim.player;
    fundCasts(thief);
    thief.facing = 0;
    const target = addDummy(sim, thief.pos.x, thief.pos.z + 4);
    sim.targetEntity(target.id);

    sim.castAbility('hemorrhage');
    const vuln = target.auras.find(
      (a) => a.kind === 'bleed_vuln' && a.id === 'hemorrhage_bleed_vuln',
    );
    expect(vuln?.value).toBe(0.4);

    target.auras = target.auras.filter((a) => a.kind !== 'dot');
    target.hp = target.maxHp;
    const hpBefore = target.hp;
    target.auras.push({
      id: 'test_bleed',
      name: 'Test Bleed',
      kind: 'dot',
      remaining: 3,
      duration: 3,
      value: 10,
      tickInterval: DT,
      tickTimer: DT,
      sourceId: thief.id,
      school: 'physical',
    });
    const events = sim.tick();
    const tick = events.find(
      (e) =>
        e.type === 'damage' &&
        e.sourceId === thief.id &&
        e.targetId === target.id &&
        e.ability === 'Test Bleed',
    );
    expect(tick?.type === 'damage' ? tick.amount : 0).toBe(14);
    expect(hpBefore - target.hp).toBe(14);
  });
});
