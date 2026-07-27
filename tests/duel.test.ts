import { describe, expect, it } from 'vitest';
import { Sim } from '../src/sim/sim';
import type { Aura, Entity } from '../src/sim/types';
import { groundHeight } from '../src/sim/world';

function makeWorld() {
  return new Sim({ seed: 42, playerClass: 'swordman', noPlayer: true });
}

function teleport(sim: Sim, pid: number, x: number, z: number) {
  const e = sim.entities.get(pid)!;
  e.pos.x = x;
  e.pos.z = z;
  e.pos.y = groundHeight(x, z, sim.cfg.seed);
  e.prevPos = { ...e.pos };
  (sim as any).rebucket(e);
}

// Start an accepted duel between two adjacent players and run the countdown
// out so the bout is live.
function startedDuel(
  aClass: 'swordman' | 'mage' | 'archer' | 'mage' = 'swordman',
  bClass: 'swordman' | 'mage' | 'archer' | 'mage' = 'mage',
): { sim: Sim; a: number; b: number } {
  const sim = makeWorld();
  const a = sim.addPlayer(aClass, 'Aleph', { autoEquip: true });
  const b = sim.addPlayer(bClass, 'Bet', { autoEquip: true });
  teleport(sim, a, 0, -40);
  teleport(sim, b, 4, -40);
  sim.duelRequest(b, a);
  sim.duelAccept(b);
  // run the 3s countdown (TICK_RATE = 20) to flip the duel to 'active'
  for (let i = 0; i < 20 * 4; i++) {
    sim.tick();
    const d = (sim as any).duels.get(a);
    if (d && d.state === 'active') break;
  }
  return { sim, a, b };
}

function givePet(sim: Sim, ownerPid: number): Entity {
  for (const e of sim.entities.values()) {
    if (e.kind === 'mob' && !e.dead && e.ownerId === null) {
      e.ownerId = ownerPid;
      e.hostile = false;
      e.hp = e.maxHp;
      teleport(sim, e.id, sim.entities.get(ownerPid)!.pos.x + 1, sim.entities.get(ownerPid)!.pos.z);
      return e;
    }
  }
  throw new Error('no wild mob available to adopt as a pet');
}

// A bleed/poison style damage-over-time applied by the opponent.
function opponentDot(sourceId: number): Aura {
  return {
    id: 'test_bleed',
    name: 'Test Bleed',
    kind: 'dot',
    remaining: 10,
    duration: 10,
    value: 40,
    tickInterval: 1,
    tickTimer: 1,
    sourceId,
    school: 'physical',
  } as Aura;
}

describe('duel: non-lethal cleanup', () => {
  it('a lingering opponent DoT does not kill the loser after the duel ends', () => {
    const { sim, a, b } = startedDuel();
    const ea = sim.entities.get(a)!;
    const eb = sim.entities.get(b)!;
    expect((sim as any).duels.get(a)?.state).toBe('active');

    // Aleph puts a strong bleed on Bet, then lands the finishing blow. The
    // 1-HP duel guard fires, the duel ends, Bet survives at 1 HP.
    (sim as any).applyAura(eb, opponentDot(ea.id));
    (sim as any).dealDamage(ea, eb, eb.hp + 1000, false, 'physical', 'Finisher', 'hit');

    expect((sim as any).duels.has(b)).toBe(false); // duel is over
    expect(eb.dead).toBe(false);
    expect(eb.hp).toBe(1);

    // Run a few seconds so the leftover bleed ticks several times.
    for (let i = 0; i < 20 * 3; i++) sim.tick();

    // The duel was non-lethal — the opponent's leftover DoT must not have
    // killed Bet for real after the bout ended.
    expect(eb.dead).toBe(false);
    expect(eb.hp).toBeGreaterThanOrEqual(1);
  });

  it('a lingering DoT does not kill a player who forfeits by running away', () => {
    const { sim, a, b } = startedDuel();
    const ea = sim.entities.get(a)!;
    const eb = sim.entities.get(b)!;

    (sim as any).applyAura(eb, opponentDot(ea.id));
    eb.hp = 30; // wounded but alive

    // Bet flees past the forfeit distance, ending the duel as a draw.
    teleport(sim, b, 400, -40);
    sim.tick();
    expect((sim as any).duels.has(b)).toBe(false);

    for (let i = 0; i < 20 * 3; i++) sim.tick();
    expect(eb.dead).toBe(false);
  });
});

describe('duel: PvP combat affordances', () => {
  it('lets a commanded pet attack an active duel opponent', () => {
    const { sim, a, b } = startedDuel('archer', 'mage');
    const pet = givePet(sim, a);
    const eb = sim.entities.get(b)!;
    const startHp = eb.hp;

    sim.targetEntity(b, a);
    sim.petAttack(a);
    for (let i = 0; i < 20 * 5 && eb.hp === startHp; i++) sim.tick();

    expect(pet.aggroTargetId).toBe(b);
    expect(eb.hp).toBeLessThan(startHp);
  });

  it('does not make a dueling pet hostile to its owner', () => {
    const { sim, a } = startedDuel('archer', 'mage');
    const pet = givePet(sim, a);
    const owner = sim.entities.get(a)!;

    expect(sim.isHostileTo(pet, owner)).toBe(false);
    expect(sim.isHostileTo(owner, pet)).toBe(false);
  });

  it('treats pet damage as owner PvP damage for non-lethal duel endings', () => {
    const { sim, a, b } = startedDuel('archer', 'mage');
    const pet = givePet(sim, a);
    const eb = sim.entities.get(b)!;

    (sim as any).dealDamage(pet, eb, eb.hp + 1000, false, 'physical', 'Pet Bite', 'hit');

    expect((sim as any).duels.has(b)).toBe(false);
    expect(eb.dead).toBe(false);
    expect(eb.hp).toBe(1);
  });

  it('lets mage self and hostile spells work against active duel opponents', () => {
    const { sim, a, b } = startedDuel('mage', 'swordman');
    const mage = sim.entities.get(a)!;
    const swordman = sim.entities.get(b)!;
    sim.setPlayerLevel(20, a);
    sim.setPlayerLevel(20, b);
    mage.resource = Math.floor(mage.maxResource / 2);
    mage.hp = mage.maxHp - 50;
    mage.targetId = b;
    mage.facing = Math.atan2(swordman.pos.x - mage.pos.x, swordman.pos.z - mage.pos.z);

    const hpBeforeTap = mage.hp;
    const manaBeforeTap = mage.resource;
    sim.castAbility('life_tap', a);
    expect(mage.hp).toBeLessThan(hpBeforeTap);
    expect(mage.resource).toBeGreaterThan(manaBeforeTap);

    mage.gcdRemaining = 0;
    mage.resource = mage.maxResource;
    sim.castAbility('curse_of_agony', a);
    // The curse is a projectile now: it applies when the bolt reaches the swordman
    // (projectile_travel), a few ticks after the cast, so let it land.
    for (let i = 0; i < 20 && (sim as any).pendingProjectiles.length > 0; i++) sim.tick();
    expect(swordman.auras.some((aura) => aura.id === 'curse_of_agony')).toBe(true);

    mage.gcdRemaining = 0;
    mage.resource = mage.maxResource;
    const warriorHpBeforeDrain = swordman.hp;
    const warlockHpBeforeDrain = mage.hp;
    sim.castAbility('drain_life', a);
    for (let i = 0; i < 20 * 2; i++) sim.tick();

    expect(swordman.hp).toBeLessThan(warriorHpBeforeDrain);
    expect(mage.hp).toBeGreaterThan(warlockHpBeforeDrain);
  });
});
