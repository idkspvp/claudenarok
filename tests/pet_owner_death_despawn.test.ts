import { describe, expect, it } from 'vitest';
import { MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';
import { completeTame, petOf } from '../src/sim/pet/pet_commands';
import { Sim } from '../src/sim/sim';
import type { Entity } from '../src/sim/types';
import { fundCasts } from './helpers/sp';

// Regression for the "immortal pet" bug: when a Hunter or Warlock OWNER dies, their
// pet/demon used to keep living forever. handleDeath's player branch tore down the
// dying player's own combat state but never touched the owned pet entity, so the pet
// hit a dead spot in updatePet (the despawn guard only fires when the owner is ABSENT,
// and petPickTarget is gated on `!owner.dead`): it could neither acquire targets nor be
// cleaned up. It sat in the world at full HP, unkillable. The owner's death must now
// kill the pet too: archer pets leave a revivable
// corpse. The demon arm of this case went with the Warlock in D1; the only live
// summon is the Mage's Water Elemental, which is family 'elemental' and so follows
// the tamed-pet rule the case below already covers, not the demon unravel.
// corpse (classic Revive Pet), so neither stays immortal.

type AnySim = Sim & Record<string, any>;
type AnyEntity = Entity & Record<string, any>;

function spawnWolf(sim: AnySim, near: AnyEntity, level = 2): AnyEntity {
  const wolf = createMob(sim.nextId++, MOBS.forest_wolf, level, {
    x: near.pos.x + 3,
    y: near.pos.y,
    z: near.pos.z,
  }) as AnyEntity;
  wolf.hostile = true;
  sim.addEntity(wolf);
  return wolf;
}

function killEntity(sim: AnySim, e: AnyEntity): void {
  sim.dealDamage(null, e, e.maxHp + 100, false, 'physical', null, 'hit', true);
}

describe('a dead owner does not leave an immortal pet', () => {
  it('a slain archer leaves a revivable pet corpse, not an immortal pet', () => {
    const sim = new Sim({ seed: 11, playerClass: 'archer', noPlayer: true }) as AnySim;
    const hid = sim.addPlayer('archer', 'Owner') as number;
    sim.setPlayerLevel(12, hid);
    const archer = sim.entities.get(hid) as AnyEntity;
    const wolf = spawnWolf(sim, archer);
    completeTame(sim.ctx, archer, wolf);
    const pet = petOf(sim.ctx, hid) as AnyEntity;
    expect(pet).toBeTruthy();
    expect(pet.dead).toBe(false);

    killEntity(sim, archer);
    expect(archer.dead).toBe(true);

    // The pet is no longer a live, fighting entity.
    expect(pet.dead).toBe(true);
    expect(petOf(sim.ctx, hid)).toBeNull(); // no LIVE pet

    // Hunter pets persist as a revivable corpse rather than vanishing outright.
    for (let i = 0; i < 20 * 10; i++) sim.tick();
    const corpse = petOf(sim.ctx, hid, true) as AnyEntity;
    expect(corpse).toBeTruthy();
    expect(corpse.id).toBe(pet.id);
    expect(corpse.dead).toBe(true);
  });

  it('is deterministic: the same seed kills the pet identically', () => {
    const run = () => {
      const sim = new Sim({ seed: 21, playerClass: 'archer', noPlayer: true }) as AnySim;
      const hid = sim.addPlayer('archer', 'Owner') as number;
      sim.setPlayerLevel(12, hid);
      const archer = sim.entities.get(hid) as AnyEntity;
      completeTame(sim.ctx, archer, spawnWolf(sim, archer));
      killEntity(sim, archer);
      const pet = petOf(sim.ctx, hid, true) as AnyEntity;
      return { dead: pet.dead, hp: pet.hp, corpseTimer: pet.corpseTimer };
    };
    expect(run()).toEqual(run());
  });
});
