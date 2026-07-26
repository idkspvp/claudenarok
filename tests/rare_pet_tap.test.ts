import { describe, expect, it } from 'vitest';
import { MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';
import { Sim } from '../src/sim/sim';
import type { Entity } from '../src/sim/types';

// Old Greyjaw (a rare with a single camp spawn) is the exploit case: a camper who
// parks an aggressive pet on it can monopolize the tap forever (petPickTarget's
// anti-AFK window re-engages the instant it respawns, well before any other player
// can react). Tap rights stay classic (pet damage taps, exactly like any other
// mob): the fix is that rares ALSO track a permanent damage-contributor roster
// (mirroring world bosses), and a guaranteed personal quest drop (greyjaw_fang,
// chance: 1) is credited to every quest-needing CONTRIBUTOR, not just whoever
// currently holds the tap. That closes both the camping monopoly (the owner still
// gets the fang from a pet-solo kill) and the new tap-snipe theft vector (a
// passerby who steals the tap with one hit cannot deny the fang to the player who
// actually did the work).

function spawnMob(
  sim: Sim,
  id: number,
  templateId: string,
  level: number,
  x: number,
  z: number,
): Entity {
  const mob = createMob(id, MOBS[templateId], level, { x, y: 0, z });
  sim.entities.set(id, mob);
  return mob;
}

describe('rare mob tap and personal-drop credit', () => {
  it('a pet acting alone still taps a rare mob (classic pet-tap rule, unchanged)', () => {
    const sim = new Sim({ seed: 42, playerClass: 'warlock', noPlayer: true });
    const pid = sim.addPlayer('warlock', 'Ashwyn');
    const greyjaw = spawnMob(sim, 90001, 'old_greyjaw', 4, 10, 10);
    const pet = spawnMob(sim, 90002, 'emberkin', 10, 10, 10);
    pet.ownerId = pid;

    sim.dealDamage(pet, greyjaw, 5, false, 'physical', null, 'hit');

    expect(greyjaw.tappedById).toBe(pid);
  });

  it('a pet acting alone still taps an ordinary (non-rare) mob', () => {
    const sim = new Sim({ seed: 42, playerClass: 'warlock', noPlayer: true });
    const pid = sim.addPlayer('warlock', 'Ashwyn');
    const boar = spawnMob(sim, 90004, 'wild_boar', 3, 10, 10);
    const pet = spawnMob(sim, 90005, 'emberkin', 10, 10, 10);
    pet.ownerId = pid;

    sim.dealDamage(pet, boar, 5, false, 'physical', null, 'hit');

    expect(boar.tappedById).toBe(pid);
  });
});
