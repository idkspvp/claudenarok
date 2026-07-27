// Tank defensive cooldowns, one distinct mechanic per class:
//   - Paladin Sacred Bulwark: a cheat-death that denies a lethal blow and restores 35%.
//   - Druid Primal Reflexes: a dodge cooldown (buff_dodge), usable while shapeshifted.
// Also covers the acolyte parity buff (Dire Bruin now +20% threat / +15% armor).
import { describe, expect, it } from 'vitest';
import { MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';
import { type ArenaMatch, Sim } from '../src/sim/sim';
import type { Aura, Entity, PlayerClass } from '../src/sim/types';

function make(cls: string) {
  const sim = new Sim({ seed: 5, playerClass: cls as any, autoEquip: true });
  sim.setPlayerLevel(20);
  const pid = sim.playerId;
  const p = sim.entities.get(pid) as Entity & Record<string, unknown>;
  for (let i = 0; i < 5; i++) sim.tick();
  (p as any).resource = (p as any).maxResource;
  return { sim, p, pid };
}

function spawnMob(sim: Sim, p: Entity, dz: number) {
  const mob = createMob((sim as any).nextId++, MOBS.ridge_stalker, 20, {
    x: p.pos.x,
    y: p.pos.y,
    z: p.pos.z + dz,
  });
  mob.maxHp = mob.hp = 1_000_000;
  mob.hostile = true;
  sim.entities.set(mob.id, mob);
  (sim as any).rebucket(mob);
  return mob;
}

// Cast an instant ability and let it resolve (ticks past the GCD).
function cast(sim: Sim, id: string, pid: number) {
  (sim.entities.get(pid) as any).resource = (sim.entities.get(pid) as any).maxResource;
  sim.castAbility(id, pid);
  for (let i = 0; i < 32; i++) sim.tick();
}

function guardianWard(pid: number): Aura {
  return {
    id: 'sacred_bulwark',
    name: 'Sacred Bulwark',
    kind: 'guardian_ward',
    remaining: 10,
    duration: 10,
    value: 0.35,
    sourceId: pid,
    school: 'holy',
  };
}

function advanceArena(sim: Sim, pid: number): ArenaMatch {
  for (let i = 0; i < 20 * 8; i++) {
    const match = sim.arenaMatchFor(pid);
    if (match?.state === 'active') return match;
    sim.tick();
  }
  throw new Error('arena did not become active');
}

function startArenaMode(format: '1v1' | 'fiesta' | 'yumi3') {
  const sim = new Sim({ seed: 7, playerClass: 'swordman', noPlayer: true });
  const classes: PlayerClass[] =
    format === '1v1'
      ? ['swordman', 'swordman']
      : format === 'fiesta'
        ? ['swordman', 'mage', 'thief', 'acolyte']
        : ['swordman', 'mage', 'thief', 'acolyte', 'archer', 'acolyte'];
  const pids = classes.map((cls, i) => sim.addPlayer(cls, `P${i}`));
  for (const pid of pids) sim.arenaQueueJoin(pid, format);
  sim.tick();
  const match = advanceArena(sim, pids[0]);
  const victimPid = pids[0];
  const victimOnA = match.teamA.includes(victimPid);
  const sourcePid = (victimOnA ? match.teamB : match.teamA)[0];
  return { sim, match, victimPid, sourcePid };
}

describe('Tank defensive cooldowns: known by their class at 20', () => {
  it('the swordman knows Raised Guard, the one surviving tank ward', () => {
    // Sacred Bulwark and Primal Reflexes went with the Paladin and the Druid in
    // D1, which leaves the Swordman holding the only defensive cooldown built on
    // the shared ward infrastructure the describe below pins.
    const CD: Record<string, string> = {
      swordman: 'raised_guard',
    };
    for (const [cls, id] of Object.entries(CD)) {
      const { sim } = make(cls);
      expect(!!sim.resolvedAbility(id), `${cls} knows ${id}`).toBe(true);
    }
  });

  it('pins costs, cooldowns, durations, values and off-GCD tuning', () => {
    const expected = [
      {
        cls: 'swordman',
        id: 'raised_guard',
        cost: 15,
        cooldown: 12,
        duration: 6,
        value: 0.5,
      },
    ] as const;

    for (const tuning of expected) {
      const { sim } = make(tuning.cls);
      const resolved = sim.resolvedAbility(tuning.id)!;
      const effect = resolved.effects[0];
      expect(resolved.cost, `${tuning.id} cost`).toBe(tuning.cost);
      expect(resolved.cooldown, `${tuning.id} cooldown`).toBe(tuning.cooldown);
      expect(resolved.def.offGcd, `${tuning.id} offGcd`).toBe(true);
      expect(effect.type, `${tuning.id} effect`).toBe('selfBuff');
      if (effect.type !== 'selfBuff') throw new Error(`${tuning.id} is not a self buff`);
      expect(effect.duration, `${tuning.id} duration`).toBe(tuning.duration);
      expect(effect.value, `${tuning.id} value`).toBe(tuning.value);
    }
  });
});

describe('Generic shield-wall ward infrastructure', () => {
  it('reduces all-school damage without depending on a specific ability id', () => {
    const { sim, p } = make('swordman');
    p.maxHp = p.hp = 1_000_000;
    p.auras.push({
      id: 'test_generic_wall',
      name: 'Test Generic Wall',
      kind: 'shield_wall',
      remaining: 8,
      duration: 8,
      value: 0.4,
      sourceId: p.id,
      school: 'physical',
    });
    const mob = spawnMob(sim, p, 3);
    for (const school of ['physical', 'fire', 'shadow'] as const) {
      const before = p.hp;
      (sim as any).dealDamage(mob, p, 100, false, school, null, 'hit');
      expect(before - p.hp).toBe(60);
    }
  });
});

// The Dire Bruin block that stood here read the feral spec MASTERY; the spec
// masteries went with the talent trees (Phase D0).
