// Classic threat mechanics + the class kit that drives them (stances/forms,
// stealth, pets).
import { describe, expect, it } from 'vitest';
import { abilitiesKnownAt } from '../src/sim/data';
import { Sim } from '../src/sim/sim';
import {
  DEFENSIVE_STANCE_THREAT_MULT,
  dropThreat,
  RIGHTEOUS_FURY_THREAT_MULT,
} from '../src/sim/threat';
import type { Entity } from '../src/sim/types';
import { dist2d, SUNDER_ARMOR_PCT_PER_STACK } from '../src/sim/types';
import { terrainHeight } from '../src/sim/world';
import { fundCasts, raisePool } from './helpers/sp';

function makeSim(cls: Parameters<typeof simClass>[0] = 'swordman', seed = 42) {
  return new Sim({ seed, playerClass: cls, autoEquip: true });
}
// type helper only — keeps makeSim's signature honest without importing PlayerClass
function simClass(
  cls:
    | 'swordman'
    | 'mage'
    | 'thief'
    | 'acolyte'
    | 'archer'
    | 'acolyte'
    | 'swordman'
    | 'acolyte'
    | 'mage',
) {
  return cls;
}

function summonImp(sim: Sim): Entity {
  fundCasts(sim.player);
  sim.castAbility('summon_imp');
  for (let i = 0; i < 20 * 6; i++) sim.tick();
  const imp = sim.petOf(sim.playerId);
  if (!imp) throw new Error('expected summoned imp');
  return imp;
}

function nearestMob(sim: Sim, templateId?: string, from?: Entity): Entity {
  const p = from ?? sim.player;
  let best: Entity | null = null;
  let bestD = Infinity;
  for (const e of sim.entities.values()) {
    if (e.kind !== 'mob' || e.dead || e.ownerId !== null) continue;
    if (templateId && e.templateId !== templateId) continue;
    const d = dist2d(p.pos, e.pos);
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best!;
}

function teleport(sim: Sim, e: Entity, x: number, z: number) {
  e.pos.x = x;
  e.pos.z = z;
  e.pos.y = terrainHeight(x, z, sim.cfg.seed);
  e.prevPos = { ...e.pos };
}

function hit(sim: Sim, source: Entity, target: Entity, amount: number, school = 'physical') {
  (sim as any).dealDamage(source, target, amount, false, school, null, 'hit', true);
}

// keep low-level mobs alive through scripted hits (death wipes the hate table)
function beefUp(mob: Entity) {
  mob.maxHp = 5000;
  mob.hp = 5000;
}

describe('dropThreat (single-attacker removal)', () => {
  it('removes only that attacker and releases a taunt lock pointing at them', () => {
    const mob = {
      threat: new Map([
        [1, 50],
        [2, 80],
      ]),
      forcedTargetId: 1,
      forcedTargetTimer: 2,
    } as unknown as Entity;
    dropThreat(mob, 1);
    expect(mob.threat.has(1)).toBe(false);
    expect(mob.threat.get(2)).toBe(80);
    expect(mob.forcedTargetId).toBeNull();
    expect(mob.forcedTargetTimer).toBe(0);
  });

  it('leaves a taunt lock held by a DIFFERENT attacker in place', () => {
    const mob = {
      threat: new Map([
        [1, 50],
        [2, 80],
      ]),
      forcedTargetId: 2,
      forcedTargetTimer: 2,
    } as unknown as Entity;
    dropThreat(mob, 1);
    expect(mob.forcedTargetId).toBe(2);
    expect(mob.forcedTargetTimer).toBe(2);
  });
});

describe('threat from damage', () => {
  it('damage lands on the hate table 1:1 without modifiers (plus the aggro seed)', () => {
    const sim = makeSim('swordman');
    const wolf = nearestMob(sim, 'forest_wolf');
    beefUp(wolf);
    hit(sim, sim.player, wolf, 100);
    // 1 seed threat from the aggro pickup + 100 damage threat
    expect(wolf.threat.get(sim.playerId)).toBeCloseTo(101, 5);
  });

  it('defensive stance: -10% damage dealt, x1.3 threat on what lands', () => {
    const sim = makeSim('swordman');
    sim.setPlayerLevel(10);
    sim.castAbility('defensive_stance');
    sim.tick();
    expect(sim.player.auras.some((a) => a.kind === 'defensive_stance')).toBe(true);
    const wolf = nearestMob(sim, 'forest_wolf');
    beefUp(wolf);
    hit(sim, sim.player, wolf, 100);
    // 100 -> 90 actual damage, 90 * 1.3 threat + 1 seed
    expect(wolf.threat.get(sim.playerId)).toBeCloseTo(90 * DEFENSIVE_STANCE_THREAT_MULT + 1, 5);
    // stance is a toggle
    for (let i = 0; i < 30; i++) sim.tick();
    sim.castAbility('defensive_stance');
    expect(sim.player.auras.some((a) => a.kind === 'defensive_stance')).toBe(false);
  });

  it('classic flat threat values resolve per rank (heroic strike 20/39)', () => {
    const sim = makeSim('swordman');
    expect(sim.resolvedAbility('heroic_strike')!.threatFlat).toBe(20);
    sim.setPlayerLevel(8);
    expect(sim.resolvedAbility('heroic_strike')!.threatFlat).toBe(39);
    sim.setPlayerLevel(10);
    expect(sim.resolvedAbility('sunder_armor')!.threatFlat).toBe(100);
  });
});

describe('healing threat', () => {
  function partyOfTwo() {
    const sim = new Sim({ seed: 42, playerClass: 'swordman', noPlayer: true });
    const tank = sim.addPlayer('swordman', 'Tank');
    const healer = sim.addPlayer('acolyte', 'Healer');
    sim.partyInvite(healer, tank);
    sim.partyAccept(healer);
    return { sim, tank: sim.entities.get(tank)!, healer: sim.entities.get(healer)! };
  }

  it('0.5 threat per effective heal point, split among every aware mob', () => {
    const { sim, tank, healer } = partyOfTwo();
    const wolf = nearestMob(sim, 'forest_wolf', tank);
    beefUp(wolf);
    hit(sim, tank, wolf, 50); // social aggro: nearby packmates join in too
    // The D1 HP curve left a level-1 pool smaller than the heal under test, so the
    // 50 would be clipped by missing health and the threat would read the clip.
    tank.maxHp = Math.max(tank.maxHp, 500);
    tank.hp = 1;
    (sim as any).applyHeal(healer, tank, 50, 'Solemn Prayer');
    // the healer's threat across ALL aware mobs sums to healed * 0.5
    // (the heal may crit for x1.5, and is capped by the tank's missing hp)
    let total = 0;
    let awareMobs = 0;
    for (const m of sim.entities.values()) {
      if (m.kind !== 'mob' || !m.threat.has(healer.id)) continue;
      total += m.threat.get(healer.id)!;
      awareMobs++;
    }
    expect(awareMobs).toBeGreaterThanOrEqual(1);
    expect(total).toBeGreaterThanOrEqual(50 * 0.5 * 0.999);
    expect(total).toBeLessThanOrEqual(50 * 1.5 * 0.5 * 1.001);
    expect(wolf.threat.get(healer.id)).toBeCloseTo(total / awareMobs, 5);
  });

  it('healing threat splits across every mob in combat with the party', () => {
    const { sim, tank, healer } = partyOfTwo();
    const wolfA = nearestMob(sim, 'forest_wolf', tank);
    beefUp(wolfA);
    hit(sim, tank, wolfA, 50);
    let wolfB: Entity | null = null;
    for (const e of sim.entities.values()) {
      if (e.kind === 'mob' && !e.dead && e.templateId === 'forest_wolf' && e.id !== wolfA.id) {
        wolfB = e;
        break;
      }
    }
    beefUp(wolfB!);
    hit(sim, tank, wolfB!, 50);
    tank.hp = Math.max(1, tank.hp - 200);
    (sim as any).applyHeal(healer, tank, 100, 'Solemn Prayer');
    const a = wolfA.threat.get(healer.id) ?? 0;
    const b = wolfB!.threat.get(healer.id) ?? 0;
    expect(a).toBeGreaterThan(0);
    expect(a).toBeCloseTo(b, 5); // even split
  });

  it('healing a non-party player creates threat on mobs already fighting them', () => {
    const sim = new Sim({ seed: 42, playerClass: 'swordman', noPlayer: true });
    const tank = sim.entities.get(sim.addPlayer('swordman', 'Tank'))!;
    const healer = sim.entities.get(sim.addPlayer('acolyte', 'OutsideHealer'))!;
    const wolf = nearestMob(sim, 'forest_wolf', tank);
    beefUp(wolf);
    hit(sim, tank, wolf, 50);
    tank.hp = Math.max(1, tank.hp - 100);

    (sim as any).applyHeal(healer, tank, 80, 'Solemn Prayer');

    expect(wolf.threat.get(healer.id)).toBeGreaterThan(0);
  });

  it('an unaware mob gets no healing threat', () => {
    const { sim, tank, healer } = partyOfTwo();
    const wolf = nearestMob(sim, 'forest_wolf', tank);
    tank.hp = Math.max(1, tank.hp - 100);
    (sim as any).applyHeal(healer, tank, 100, 'Solemn Prayer');
    expect(wolf.threat.get(healer.id)).toBeUndefined();
  });
});

describe('classic pull-over rules (110% melee / 130% ranged)', () => {
  function aggroSetup() {
    const sim = new Sim({ seed: 42, playerClass: 'swordman', noPlayer: true });
    const a = sim.entities.get(sim.addPlayer('swordman', 'A'))!;
    const b = sim.entities.get(sim.addPlayer('mage', 'B'))!;
    const wolf = nearestMob(sim, 'forest_wolf', a);
    teleport(sim, a, wolf.pos.x + 2, wolf.pos.z);
    wolf.threat.set(a.id, 100);
    wolf.aggroTargetId = a.id;
    wolf.aiState = 'attack';
    wolf.inCombat = true;
    return { sim, a, b, wolf };
  }

  it('a melee attacker needs >110% to rip aggro', () => {
    const { sim, a, b, wolf } = aggroSetup();
    teleport(sim, b, wolf.pos.x - 2, wolf.pos.z); // melee range of the mob
    wolf.threat.set(b.id, 105);
    sim.tick();
    expect(wolf.aggroTargetId).toBe(a.id); // 105 < 110
    wolf.threat.set(b.id, 115);
    sim.tick();
    expect(wolf.aggroTargetId).toBe(b.id); // 115 > 110
  });

  it('a ranged attacker needs >130%', () => {
    const { sim, a, b, wolf } = aggroSetup();
    teleport(sim, b, wolf.pos.x - 20, wolf.pos.z); // well out of melee
    wolf.threat.set(b.id, 125);
    sim.tick();
    expect(wolf.aggroTargetId).toBe(a.id); // 125 < 130
    wolf.threat.set(b.id, 135);
    sim.tick();
    expect(wolf.aggroTargetId).toBe(b.id); // 135 > 130
  });

  it('a large mob treats a challenger within its big reach as melee (110%, not 130%)', () => {
    // Regression: the melee/ranged boundary used a flat MELEE_RANGE * 1.2 (6yd),
    // so a challenger standing at a big creature's feet (well within its
    // size-scaled reach) was misclassified as ranged and forced to clear 130%.
    const { sim, a, b, wolf } = aggroSetup();
    wolf.scale = 3; // a boss-sized creature
    const reach = (sim as any).mobMeleeRange(wolf);
    expect(reach).toBeGreaterThan(6); // scaled reach exceeds the old flat 6yd gate
    // 8yd is inside the big reach (~11yd) but beyond the old flat 6yd check
    teleport(sim, b, wolf.pos.x - 8, wolf.pos.z);
    expect(dist2d(wolf.pos, b.pos)).toBeGreaterThan(6);
    expect(dist2d(wolf.pos, b.pos)).toBeLessThanOrEqual(reach);
    // just under 110% does not switch
    wolf.threat.set(b.id, 109);
    sim.tick();
    expect(wolf.aggroTargetId).toBe(a.id);
    // 115 is over 110% but under 130%: the old flat check would have kept a (ranged),
    // the fix counts b as melee and rips aggro
    wolf.threat.set(b.id, 115);
    sim.tick();
    expect(wolf.aggroTargetId).toBe(b.id);
  });

  it('a normal-sized mob keeps the classic 6yd melee boundary (challenger at 5.5yd is melee)', () => {
    // The size-scaled reach for a scale-1 mob is only MELEE_RANGE (5yd), but the
    // melee/ranged pull-over boundary is floored at the classic MELEE_RANGE * 1.2
    // (6yd), so a challenger at 5.5yd (past 5, inside 6) still counts as melee and
    // needs only 110% (not 130%) to pull.
    const { sim, a, b, wolf } = aggroSetup();
    wolf.scale = 1; // a normal-sized creature
    teleport(sim, b, wolf.pos.x - 5.5, wolf.pos.z);
    const d = dist2d(wolf.pos, b.pos);
    expect(d).toBeGreaterThan(5); // beyond the raw scale-1 reach
    expect(d).toBeLessThanOrEqual(6); // within the classic 6yd floor
    // just under 110% does not switch
    wolf.threat.set(b.id, 109);
    sim.tick();
    expect(wolf.aggroTargetId).toBe(a.id);
    // 115 is over 110% but under 130%: the 6yd floor counts b as melee and rips
    // aggro (a size-scaled-only reach of 5yd would misclassify b as ranged).
    wolf.threat.set(b.id, 115);
    sim.tick();
    expect(wolf.aggroTargetId).toBe(b.id);
  });

  it('identical setup yields an identical target choice (determinism)', () => {
    function run(): number | null {
      const { sim, b, wolf } = aggroSetup();
      teleport(sim, b, wolf.pos.x - 8, wolf.pos.z);
      wolf.scale = 3;
      wolf.threat.set(b.id, 115);
      sim.tick();
      return wolf.aggroTargetId;
    }
    const first = run();
    const second = run();
    expect(first).toBe(second);
  });

  it('when the target dies the mob swings to the next-highest threat, not the nearest', () => {
    const { sim, a, b, wolf } = aggroSetup();
    const c = sim.entities.get(sim.addPlayer('thief', 'C'))!;
    teleport(sim, b, wolf.pos.x - 4, wolf.pos.z); // nearer...
    teleport(sim, c, wolf.pos.x + 12, wolf.pos.z); // ...but c has more threat
    wolf.threat.set(b.id, 50);
    wolf.threat.set(c.id, 500);
    (sim as any).dealDamage(wolf, a, 99999, false, 'physical', null, 'hit', true);
    expect(a.dead).toBe(true);
    sim.tick();
    expect(wolf.aggroTargetId).toBe(c.id);
    // the dead player dropped off the table entirely
    expect(wolf.threat.has(a.id)).toBe(false);
  });

  it('when the target dies the mob evades instead of attacking a bystander with no threat', () => {
    const { sim, a, b, wolf } = aggroSetup();
    teleport(sim, b, wolf.pos.x + 2, wolf.pos.z + 2);

    (sim as any).dealDamage(wolf, a, 99999, false, 'physical', null, 'hit', true);

    expect(a.dead).toBe(true);
    expect(wolf.threat.has(b.id)).toBe(false);
    expect(wolf.aggroTargetId).not.toBe(b.id);
    expect(wolf.aiState).toBe('evade');
  });
});

describe('taunt and growl', () => {
  it('taunt matches the top threat and forces 3 seconds of attention', () => {
    const sim = new Sim({ seed: 42, playerClass: 'swordman', noPlayer: true });
    const tank = sim.entities.get(sim.addPlayer('swordman', 'Tank'))!;
    const dps = sim.entities.get(sim.addPlayer('mage', 'Dps'))!;
    sim.setPlayerLevel(10, tank.id);
    const wolf = nearestMob(sim, 'forest_wolf', tank);
    teleport(sim, tank, wolf.pos.x + 2, wolf.pos.z);
    teleport(sim, dps, wolf.pos.x - 15, wolf.pos.z);
    wolf.threat.set(dps.id, 1000);
    wolf.aggroTargetId = dps.id;
    wolf.aiState = 'chase';
    wolf.inCombat = true;
    sim.targetEntity(wolf.id, tank.id);
    tank.facing = Math.atan2(wolf.pos.x - tank.pos.x, wolf.pos.z - tank.pos.z);
    sim.castAbility('taunt', tank.id);
    expect(wolf.threat.get(tank.id)).toBe(1000);
    expect(wolf.aggroTargetId).toBe(tank.id);
    expect(wolf.forcedTargetTimer).toBeGreaterThan(0);
    // after the forced window, equal threat means the tank KEEPS the mob (no 110% rip)
    for (let i = 0; i < 20 * 4; i++) sim.tick();
    expect(wolf.aggroTargetId).toBe(tank.id);
  });

  it('keeps a taunted mob focused through higher-threat pull-over attempts', () => {
    const sim = new Sim({ seed: 42, playerClass: 'swordman', noPlayer: true });
    const tank = sim.entities.get(sim.addPlayer('swordman', 'Tank'))!;
    const dps = sim.entities.get(sim.addPlayer('thief', 'Dps'))!;
    sim.setPlayerLevel(10, tank.id);
    sim.setPlayerLevel(10, dps.id);
    const wolf = nearestMob(sim, 'forest_wolf', tank);
    beefUp(wolf);
    teleport(sim, tank, wolf.pos.x + 2, wolf.pos.z);
    teleport(sim, dps, wolf.pos.x + 3, wolf.pos.z);
    wolf.threat.set(dps.id, 500);
    wolf.aggroTargetId = dps.id;
    wolf.aiState = 'attack';
    wolf.inCombat = true;

    sim.targetEntity(wolf.id, tank.id);
    tank.facing = Math.atan2(wolf.pos.x - tank.pos.x, wolf.pos.z - tank.pos.z);
    sim.castAbility('taunt', tank.id);
    wolf.threat.set(dps.id, (wolf.threat.get(tank.id) ?? 0) * 3);

    for (let i = 0; i < 20 * 2; i++) {
      sim.tick();
      expect(wolf.aggroTargetId).toBe(tank.id);
      expect(wolf.forcedTargetId).toBe(tank.id);
    }

    for (let i = 0; i < 20 * 2; i++) sim.tick();
    expect(wolf.forcedTargetId).toBe(null);
    expect(wolf.aggroTargetId).toBe(dps.id);
  });

  it('level 5 Warrior Goad locks Deeprock Digger focus and expires back to threat', () => {
    const sim = new Sim({ seed: 42, playerClass: 'swordman' });
    const tank = sim.player;
    const dps = sim.entities.get(sim.addPlayer('mage', 'Dps'))!;
    sim.setPlayerLevel(5, tank.id);
    sim.setPlayerLevel(5, dps.id);
    tank.maxHp = 5000;
    tank.hp = tank.maxHp;
    dps.maxHp = 5000;
    dps.hp = dps.maxHp;
    const digger = sim.entities.get(85);
    if (!digger || digger.kind !== 'mob' || digger.templateId !== 'tunnel_rat') {
      throw new Error('expected Deeprock Digger id 85');
    }
    beefUp(digger);
    teleport(sim, tank, digger.pos.x + 2, digger.pos.z);
    teleport(sim, dps, digger.pos.x + 3, digger.pos.z);
    digger.threat.set(dps.id, 500);
    digger.aggroTargetId = dps.id;
    digger.aiState = 'attack';
    digger.inCombat = true;

    sim.targetEntity(digger.id, tank.id);
    tank.facing = Math.atan2(digger.pos.x - tank.pos.x, digger.pos.z - tank.pos.z);
    sim.castAbility('taunt', tank.id);

    expect(digger.forcedTargetId).toBe(tank.id);
    expect(digger.forcedTargetTimer).toBeGreaterThan(0);
    expect(digger.aggroTargetId).toBe(tank.id);
    expect(digger.threat.get(tank.id)).toBe(500);

    digger.threat.set(dps.id, 5000);
    for (let i = 0; i < 20 * 2; i++) {
      sim.tick();
      expect(digger.forcedTargetId).toBe(tank.id);
      expect(digger.aggroTargetId).toBe(tank.id);
    }

    for (let i = 0; i < 20 * 2; i++) sim.tick();
    expect(digger.forcedTargetId).toBe(null);
    expect(digger.forcedTargetTimer).toBeLessThanOrEqual(0);
    expect(digger.aggroTargetId).toBe(dps.id);
  });
});

describe('sunder armor', () => {
  it('stacks an armor debuff and generates stance-scaled flat threat', () => {
    const sim = makeSim('swordman');
    sim.setPlayerLevel(10);
    const wolf = nearestMob(sim, 'forest_wolf');
    teleport(sim, sim.player, wolf.pos.x + 2, wolf.pos.z);
    sim.targetEntity(wolf.id);
    sim.player.facing = Math.atan2(wolf.pos.x - sim.player.pos.x, wolf.pos.z - sim.player.pos.z);
    beefUp(wolf);
    wolf.stats.armor = 200; // stay clear of the armor floor
    const armorBefore = (sim as any).effectiveArmor(wolf);
    let applications = 0;
    for (let guard = 0; guard < 40 && applications < 2; guard++) {
      sim.player.resource = 100;
      sim.castAbility('sunder_armor');
      for (let i = 0; i < 32; i++) sim.tick(); // wait out the GCD
      const aura = wolf.auras.find((a) => a.kind === 'sunder');
      applications = aura?.stacks ?? 0;
    }
    expect(applications).toBeGreaterThanOrEqual(2);
    // Sunder is now a PERCENT armor reduction: 2% of base armor per stack.
    expect((sim as any).effectiveArmor(wolf)).toBe(
      armorBefore * (1 - SUNDER_ARMOR_PCT_PER_STACK * applications),
    );
    // 100 flat threat per landed sunder (no stance up) + auto-attack noise is
    // excluded because auto-attack never started
    expect(wolf.threat.get(sim.playerId)).toBeGreaterThanOrEqual(100 * applications);
  });
});

describe('thief stealth', () => {
  it('shrinks mob detection radius and breaks on damage', () => {
    const sim = makeSim('thief');
    sim.setPlayerLevel(2);
    const wolf = nearestMob(sim, 'forest_wolf');
    sim.player.level = wolf.level; // no level-difference radius skew
    teleport(sim, sim.player, wolf.pos.x + 200, wolf.pos.z); // far away first
    sim.castAbility('stealth');
    expect(sim.player.auras.some((a) => a.kind === 'stealth')).toBe(true);
    // park inside the normal aggro radius but outside the stealthed one
    wolf.wanderTarget = null;
    teleport(sim, sim.player, wolf.pos.x + 6, wolf.pos.z);
    for (let i = 0; i < 20; i++) sim.tick();
    expect(wolf.aiState).toBe('idle');
    // damage breaks stealth, and the wolf notices an unstealthed thief at 6yd
    hit(sim, wolf, sim.player, 1);
    expect(sim.player.auras.some((a) => a.kind === 'stealth')).toBe(false);
    teleport(sim, sim.player, wolf.pos.x + 6, wolf.pos.z);
    for (let i = 0; i < 20 && wolf.aiState === 'idle'; i++) sim.tick();
    expect(wolf.aiState).not.toBe('idle');
  });

  it('scales stealth detection by observer level for creatures', () => {
    const sim = makeSim('thief');
    sim.setPlayerLevel(10);
    const wolf = nearestMob(sim, 'forest_wolf');
    wolf.level = 10;
    sim.player.level = wolf.level;
    teleport(sim, sim.player, wolf.pos.x + 200, wolf.pos.z);
    sim.castAbility('stealth');
    expect(sim.player.auras.some((a) => a.kind === 'stealth')).toBe(true);

    wolf.wanderTarget = null;
    teleport(sim, sim.player, wolf.pos.x + 6, wolf.pos.z);
    for (let i = 0; i < 20; i++) sim.tick();
    expect(wolf.aiState).toBe('idle');

    wolf.level = 15;
    for (let i = 0; i < 20 && wolf.aiState === 'idle'; i++) sim.tick();
    expect(wolf.aiState).not.toBe('idle');
  });

  it('a closer stealthed player does not shield a visible ally from aggro', () => {
    // Regression: the idle-mob check only evaluated the single NEAREST player.
    // A stealthed player standing closest shrank the detection radius and, being
    // nearest, was the only candidate considered — so a visible groupmate well
    // inside the normal aggro radius was silently ignored.
    const sim = new Sim({ seed: 42, playerClass: 'thief', noPlayer: true });
    const thief = sim.entities.get(sim.addPlayer('thief', 'Sneak'))!;
    const swordman = sim.entities.get(sim.addPlayer('swordman', 'Visible'))!;
    sim.setPlayerLevel(5, thief.id);
    sim.setPlayerLevel(5, swordman.id);
    const wolf = nearestMob(sim, 'forest_wolf', thief);
    wolf.wanderTarget = null;
    // equal levels: no level-difference radius skew (forest_wolf aggroRadius 10,
    // shrunk to ~2.5 while stealthed)
    wolf.level = 5;
    // thief is NEAREST (4yd) but stealthed and outside its shrunk radius;
    // the swordman is visible at 6yd, well inside the wolf's 10yd aggro radius
    teleport(sim, thief, wolf.pos.x + 4, wolf.pos.z);
    teleport(sim, swordman, wolf.pos.x + 6, wolf.pos.z);
    sim.castAbility('stealth', thief.id);
    expect(thief.auras.some((a) => a.kind === 'stealth')).toBe(true);
    for (let i = 0; i < 20 && wolf.aiState === 'idle'; i++) sim.tick();
    expect(wolf.aiState).not.toBe('idle');
    expect(wolf.aggroTargetId).toBe(swordman.id);
  });

  it('cannot stealth in combat; acting breaks stealth; ambush requires it', () => {
    const sim = makeSim('thief');
    sim.setPlayerLevel(16);
    const wolf = nearestMob(sim, 'forest_wolf');
    teleport(sim, sim.player, wolf.pos.x + 2, wolf.pos.z);
    sim.targetEntity(wolf.id);
    sim.player.facing = Math.atan2(wolf.pos.x - sim.player.pos.x, wolf.pos.z - sim.player.pos.z);
    // ambush without stealth errors
    sim.player.resource = 100;
    sim.castAbility('ambush');
    const events = sim.tick();
    expect(events.some((e) => e.type === 'error' && /stealthed/.test(e.text))).toBe(true);
    // stealth, then any ability breaks it
    sim.player.inCombat = false;
    sim.player.combatTimer = 99;
    sim.castAbility('stealth');
    expect(sim.player.auras.some((a) => a.kind === 'stealth')).toBe(true);
    sim.player.resource = 100;
    for (let i = 0; i < 25; i++) sim.tick();
    sim.castAbility('sinister_strike');
    expect(sim.player.auras.some((a) => a.kind === 'stealth')).toBe(false);
  });

  it('sprint can be used before or during stealth without breaking stealth', () => {
    const sim = makeSim('thief');
    sim.setPlayerLevel(10);

    sim.castAbility('stealth');
    expect(sim.player.auras.some((a) => a.id === 'stealth' && a.kind === 'stealth')).toBe(true);
    sim.castAbility('sprint');
    expect(sim.player.auras.some((a) => a.id === 'stealth' && a.kind === 'stealth')).toBe(true);
    expect(sim.player.auras.some((a) => a.id === 'sprint' && a.kind === 'buff_speed')).toBe(true);

    sim.castAbility('stealth');
    expect(sim.player.auras.some((a) => a.id === 'stealth')).toBe(false);
    expect(sim.player.auras.some((a) => a.id === 'sprint' && a.kind === 'buff_speed')).toBe(true);

    sim.player.cooldowns.delete('stealth');
    sim.castAbility('stealth');
    expect(sim.player.auras.some((a) => a.id === 'stealth' && a.kind === 'stealth')).toBe(true);
    expect(sim.player.auras.some((a) => a.id === 'sprint' && a.kind === 'buff_speed')).toBe(true);
  });
});

describe('archer pets', () => {
  function tamedSetup() {
    const sim = makeSim('archer');
    sim.setPlayerLevel(10);
    const wolf = nearestMob(sim, 'forest_wolf');
    const originalWolfId = wolf.id;
    teleport(sim, sim.player, wolf.pos.x + 5, wolf.pos.z);
    sim.targetEntity(wolf.id);
    sim.player.facing = Math.atan2(wolf.pos.x - sim.player.pos.x, wolf.pos.z - sim.player.pos.z);
    sim.castAbility('tame_beast');
    for (let i = 0; i < 20 * 7; i++) sim.tick(); // 6s cast
    const pet = sim.petOf(sim.playerId)!;
    return { sim, wolf: pet, originalWolfId };
  }

  function activePetDuel() {
    const { sim, wolf: pet } = tamedSetup();
    const rogueId = sim.addPlayer('thief', 'Sneak', { autoEquip: true });
    const thief = sim.entities.get(rogueId)!;
    sim.setPlayerLevel(10, thief.id);
    teleport(sim, thief, sim.player.pos.x + 3, sim.player.pos.z);
    sim.duelRequest(thief.id, sim.playerId);
    sim.duelAccept(thief.id);
    for (let i = 0; i < 20 * 5 && sim.duelFor(sim.playerId)?.state !== 'active'; i++) sim.tick();
    expect(sim.duelFor(sim.playerId)?.state).toBe('active');
    return { sim, pet, thief };
  }

  it('tame beast creates a loyal pet copy and temporarily despawns the wild target', () => {
    const { sim, wolf, originalWolfId } = tamedSetup();
    expect(wolf.ownerId).toBe(sim.playerId);
    expect(wolf.hostile).toBe(false);
    expect(sim.petOf(sim.playerId)).toBe(wolf);
    expect(wolf.id).not.toBe(originalWolfId);
    expect(sim.entities.has(originalWolfId)).toBe(false);
    for (let i = 0; i < 20 * 61; i++) sim.tick();
    expect(
      [...sim.entities.values()].some(
        (e) => e.kind === 'mob' && e.ownerId === null && e.templateId === 'forest_wolf',
      ),
    ).toBe(true);
  });

  it('drops a stale enemy player target when that player stealths out of detection', () => {
    const { sim, pet, thief } = activePetDuel();
    teleport(sim, sim.player, 0, 0);
    teleport(sim, pet, 1, 0);
    teleport(sim, thief, 30, 0);
    pet.aggroTargetId = thief.id;
    pet.inCombat = true;

    sim.castAbility('stealth', thief.id);
    expect(thief.auras.some((a) => a.kind === 'stealth')).toBe(true);
    sim.tick();

    expect(pet.aggroTargetId).toBe(null);
    expect(pet.inCombat).toBe(false);
  });

  it('blocks archer pet damage against an undetected stealthed enemy player', () => {
    const { sim, pet, thief } = activePetDuel();
    teleport(sim, pet, 0, 0);
    teleport(sim, thief, 30, 0);
    sim.castAbility('stealth', thief.id);
    const stealthedHp = thief.hp;

    hit(sim, pet, thief, 100);
    expect(thief.hp).toBe(stealthedHp);

    teleport(sim, thief, 2, 0);
    hit(sim, pet, thief, 100);
    expect(thief.hp).toBeLessThan(stealthedHp);
  });

  it('friendly target spells can affect controlled pets', () => {
    const { sim, wolf: pet } = tamedSetup();
    // The Druid and Paladin arms of this case went with those classes (D1); the
    // Acolyte owns the surviving targeted friendly buff and the targeted heal.
    const acolyteId = sim.addPlayer('acolyte', 'Acolyte');
    const acolyte = sim.entities.get(acolyteId)!;
    teleport(sim, acolyte, pet.pos.x + 5, pet.pos.z);
    raisePool(acolyte);
    const maxHpBefore = pet.maxHp;

    // Power Word: Fortitude is a percent Stamina raid buff; on a pet that share
    // scales the HP pool (pets derive no armor/AP from attributes).
    sim.targetEntity(pet.id, acolyteId);
    sim.castAbility('power_word_fortitude', acolyteId);
    expect(pet.auras.some((a) => a.id === 'power_word_fortitude')).toBe(true);
    expect(pet.maxHp).toBeGreaterThan(maxHpBefore);

    pet.hp = pet.maxHp - 40;
    const damagedHp = pet.hp;
    for (let i = 0; i < 20 * 2; i++) sim.tick();
    raisePool(acolyte);
    sim.targetEntity(pet.id, acolyteId);
    sim.castAbility('lesser_heal', acolyteId);
    for (let i = 0; i < 20 * 3; i++) sim.tick();

    expect(pet.hp).toBeGreaterThan(damagedHp);

    (sim as any).dealDamage(null, pet, pet.hp, false, 'physical', 'test', 'hit');
    expect(pet.dead).toBe(true);
    expect(pet.auras).toHaveLength(0);
    expect(pet.maxHp).toBe(maxHpBefore);
    (sim as any).ctx.respawnMob(pet); // respawnMob moved to mob/lifecycle.ts (M4); reach it via the seam
    expect(sim.entities.has(pet.id)).toBe(false);
    expect(sim.petOf(sim.playerId, true)).toBe(null);
  });

  it('the pet assists against attackers and builds its own threat with Growl autocast off', () => {
    const { sim, wolf: pet } = tamedSetup();
    const boar = nearestMob(sim, 'wild_boar');
    teleport(sim, sim.player, boar.pos.x + 4, boar.pos.z);
    teleport(sim, pet, boar.pos.x + 5, boar.pos.z);
    hit(sim, sim.player, boar, 5); // boar comes for the archer
    let petThreat = 0;
    for (let i = 0; i < 20 * 20 && petThreat === 0; i++) {
      sim.tick();
      petThreat = boar.threat.get(pet.id) ?? 0;
    }
    expect(pet.aggroTargetId).toBe(boar.id);
    expect(petThreat).toBeGreaterThan(0);
    expect(boar.forcedTargetId).not.toBe(pet.id);
    expect(boar.forcedTargetTimer).toBe(0);
    // pet damage taps for the owner
    expect(boar.tappedById).toBe(sim.playerId);
  });

  it('right-click autocast state lets a pet Growl whenever the cooldown is ready', () => {
    const { sim, wolf: pet } = tamedSetup();
    const boar = nearestMob(sim, 'wild_boar');
    // The pet kills a stock boar inside the fixed 5s pre-phase since the #1325
    // locomotion change (a dead mob cannot be Growl-forced), so keep it alive.
    beefUp(boar);
    teleport(sim, sim.player, boar.pos.x + 4, boar.pos.z);
    teleport(sim, pet, boar.pos.x + 5, boar.pos.z);
    hit(sim, sim.player, boar, 5);

    for (let i = 0; i < 20 * 5; i++) sim.tick();
    expect(boar.forcedTargetId).not.toBe(pet.id);

    sim.setPetAutoTaunt(true);
    expect(pet.petAutoTaunt).toBe(true);
    for (let i = 0; i < 20 * 5 && boar.forcedTargetId !== pet.id; i++) sim.tick();
    expect(boar.forcedTargetId).toBe(pet.id);
    expect(pet.petTauntTimer).toBeGreaterThan(0);

    sim.setPetAutoTaunt(false);
    expect(pet.petAutoTaunt).toBe(false);
  });

  it('keeps the owner in combat while their pet tanks a mob', () => {
    // Regression: inCombat was recomputed only from a mob's *direct* target,
    // so when a mob attacked the pet (mob.aggroTargetId === pet.id) the owner
    // was never marked engaged. Once the owner's combatTimer passed 5s with no
    // personal damage, they dropped out of combat mid-fight and could regen
    // health, eat/drink, and use out-of-combat-only abilities while the pet
    // kept fighting.
    const { sim, wolf: pet } = tamedSetup();
    const boar = nearestMob(sim, 'wild_boar');
    beefUp(boar);
    teleport(sim, sim.player, boar.pos.x + 4, boar.pos.z);
    teleport(sim, pet, boar.pos.x + 5, boar.pos.z);
    hit(sim, sim.player, boar, 5); // boar comes for the archer; pet assists

    // let the boar transfer onto the tanking pet
    for (let i = 0; i < 20 * 20 && boar.aggroTargetId !== pet.id; i++) sim.tick();
    expect(boar.aggroTargetId).toBe(pet.id);

    // owner stops dealing damage; age their personal combat timer past 5s
    sim.player.combatTimer = 99;
    sim.tick();

    expect(pet.inCombat).toBe(true);
    expect(sim.player.inCombat).toBe(true);
  });

  it('dismiss does not release permanent pets back to the wild', () => {
    const { sim, wolf } = tamedSetup();
    const priestId = sim.addPlayer('acolyte', 'Priest');
    const acolyte = sim.entities.get(priestId)!;
    teleport(sim, acolyte, wolf.pos.x + 5, wolf.pos.z);
    raisePool(acolyte);
    const maxHpBefore = wolf.maxHp;
    sim.targetEntity(wolf.id, priestId);
    sim.castAbility('power_word_fortitude', priestId);
    expect(wolf.maxHp).toBeGreaterThan(maxHpBefore);

    for (let i = 0; i < 25; i++) sim.tick();
    sim.castAbility('dismiss_pet');
    expect(sim.tick().some((e) => e.type === 'error' && /Permanent pets/.test(e.text))).toBe(true);
    expect(sim.entities.has(wolf.id)).toBe(true);
    expect(wolf.ownerId).toBe(sim.playerId);
    expect(wolf.hostile).toBe(false);
    expect(sim.petOf(sim.playerId)).toBe(wolf);
  });

  it('a tamed beast that dies stays owned until revived or abandoned', () => {
    const sim = new Sim({ seed: 42, playerClass: 'archer', respawnSeconds: 2, autoEquip: true });
    sim.setPlayerLevel(10);
    const wolf = nearestMob(sim, 'forest_wolf');
    const originalWolfId = wolf.id;
    teleport(sim, sim.player, wolf.pos.x + 5, wolf.pos.z);
    sim.targetEntity(wolf.id);
    sim.player.facing = Math.atan2(wolf.pos.x - sim.player.pos.x, wolf.pos.z - sim.player.pos.z);
    sim.castAbility('tame_beast');
    for (let i = 0; i < 20 * 7; i++) sim.tick(); // 6s cast
    const pet = sim.petOf(sim.playerId)!;
    expect(pet.id).not.toBe(originalWolfId);
    expect(pet.ownerId).toBe(sim.playerId);
    expect(pet.hostile).toBe(false); // tamed pets are neutral

    const boar = nearestMob(sim, 'wild_boar');
    pet.hp = 1;
    hit(sim, boar, pet, 9999);
    for (let i = 0; i < 20 * 5 && !pet.dead; i++) sim.tick();
    expect(pet.dead).toBe(true);
    expect(pet.ownerId).toBe(sim.playerId);
    expect(pet.hostile).toBe(false);

    // owned dead pets do not respawn as wild mobs
    for (let i = 0; i < 20 * 10 && pet.dead; i++) sim.tick();
    expect(pet.dead).toBe(true);
    expect(pet.ownerId).toBe(sim.playerId);

    teleport(sim, sim.player, boar.pos.x + 5, boar.pos.z);
    sim.targetEntity(boar.id);
    sim.player.facing = Math.atan2(boar.pos.x - sim.player.pos.x, boar.pos.z - sim.player.pos.z);
    sim.castAbility('tame_beast');
    const events = sim.tick();
    expect(events.some((e) => e.type === 'error' && /already have a pet/.test(e.text))).toBe(true);

    raisePool(sim.player);
    sim.castAbility('revive_pet');
    for (let i = 0; i < 20 * 4; i++) sim.tick();
    expect(pet.dead).toBe(false);
    expect(pet.ownerId).toBe(sim.playerId);
    expect(pet.hostile).toBe(false);
    expect(pet.hp).toBeGreaterThan(0);
  });

  it('pet name and dead state persist through character serialization', () => {
    const { sim, wolf } = tamedSetup();
    sim.renamePet('Barkley');
    sim.setPetAutoTaunt(true);
    expect(wolf.name).toBe('Barkley');
    (sim as any).dealDamage(null, wolf, wolf.hp, false, 'physical', 'test', 'hit');
    expect(wolf.dead).toBe(true);
    const state = sim.serializeCharacter(sim.playerId)!;
    expect(state.pet).toMatchObject({
      templateId: 'forest_wolf',
      name: 'Barkley',
      level: wolf.level,
      dead: true,
      autoTaunt: true,
    });

    const restored = new Sim({ seed: 42, playerClass: 'archer', noPlayer: true, autoEquip: true });
    const pid = restored.addPlayer('archer', 'Hunter', { state });
    const pet = restored.petOf(pid, true)!;
    expect(pet).toBeTruthy();
    expect(pet.name).toBe('Barkley');
    expect(pet.dead).toBe(true);
    expect(pet.petAutoTaunt).toBe(true);
    expect(pet.ownerId).toBe(pid);

    raisePool(restored.entities.get(pid)!);
    restored.castAbility('revive_pet', pid);
    for (let i = 0; i < 20 * 4; i++) restored.tick();
    expect(pet.dead).toBe(false);
    expect(pet.ownerId).toBe(pid);
  });

  it('pet behavior modes gate automatic target selection', () => {
    const { sim, wolf: pet } = tamedSetup();
    const boar = nearestMob(sim, 'wild_boar');
    teleport(sim, sim.player, boar.pos.x + 6, boar.pos.z);
    teleport(sim, pet, boar.pos.x + 7, boar.pos.z);

    sim.setPetMode('passive');
    sim.targetEntity(boar.id);
    sim.startAutoAttack();
    for (let i = 0; i < 10; i++) sim.tick();
    expect(pet.aggroTargetId).toBe(null);

    sim.petAttack();
    sim.tick();
    expect(pet.aggroTargetId).toBe(boar.id);

    pet.aggroTargetId = null;
    sim.setPetMode('aggressive');
    sim.tick();
    expect(pet.aggroTargetId).toBe(boar.id);
  });

  it('pet taunt is commandable and uses a 10 second cooldown', () => {
    const { sim, wolf: pet } = tamedSetup();
    const boar = nearestMob(sim, 'wild_boar');
    teleport(sim, sim.player, boar.pos.x + 6, boar.pos.z);
    teleport(sim, pet, boar.pos.x + 6, boar.pos.z);
    sim.targetEntity(boar.id);

    sim.petTaunt();
    expect(pet.aggroTargetId).toBe(boar.id);
    expect(boar.forcedTargetId).not.toBe(pet.id);
    expect(pet.petManualTauntPending).toBe(true);
    for (let i = 0; i < 20 * 2 && boar.forcedTargetId !== pet.id; i++) sim.tick();
    expect(boar.forcedTargetId).toBe(pet.id);
    expect(pet.petManualTauntPending).toBe(false);

    pet.petTauntTimer = 0;
    boar.forcedTargetId = null;
    teleport(sim, pet, boar.pos.x + 2, boar.pos.z);
    sim.petTaunt();
    expect(boar.forcedTargetId).toBe(pet.id);
    expect(pet.petTauntTimer).toBe(10);

    const events = sim.tick();
    sim.petTaunt();
    expect(sim.tick().some((e) => e.type === 'error' && /not ready/.test(e.text))).toBe(true);
    expect(events).toBeTruthy();
  });

  it('pet taunts do not force bosses onto the pet', () => {
    const { sim, wolf: pet } = tamedSetup();
    while ((sim.partyOf(sim.playerId)?.members.length ?? 1) < 5) {
      const fill = sim.addPlayer('acolyte', `RaidFill${sim.players.size}`);
      sim.partyInvite(fill);
      sim.partyAccept(fill);
    }
    sim.convertPartyToRaid();
    sim.enterDungeon('nythraxis_boss_arena');
    const boss = [...sim.entities.values()].find(
      (e) => e.kind === 'mob' && e.templateId === 'nythraxis_scourge_of_thornpeak' && !e.dead,
    )!;
    const tankId = sim.addPlayer('swordman', 'Tank');
    const tank = sim.entities.get(tankId)!;
    teleport(sim, tank, boss.pos.x + 3, boss.pos.z);
    teleport(sim, sim.player, boss.pos.x + 8, boss.pos.z);
    teleport(sim, pet, boss.pos.x + 2, boss.pos.z);
    boss.inCombat = true;
    boss.aiState = 'attack';
    boss.aggroTargetId = tank.id;
    boss.threat.set(tank.id, 1000);
    sim.targetEntity(boss.id);

    sim.petTaunt();

    expect(boss.threat.get(pet.id)).toBeGreaterThan(0);
    expect(boss.forcedTargetId).not.toBe(pet.id);
    expect(boss.aggroTargetId).toBe(tank.id);
    expect(pet.petTauntTimer).toBe(10);
  });

  it('archer aspects apply to the active pet', () => {
    const { sim, wolf: pet } = tamedSetup();
    const apBefore = (sim as any).effectiveAttackPower(pet);
    sim.castAbility('aspect_of_the_hawk');
    sim.tick();
    expect(pet.auras.some((a) => a.id === 'pet_aspect_of_the_hawk')).toBe(true);
    expect((sim as any).effectiveAttackPower(pet)).toBeGreaterThan(apBefore);
  });

  it('feed pet consumes food only and heals the pet over 5 seconds', () => {
    const { sim, wolf: pet } = tamedSetup();
    pet.hp = Math.max(1, pet.maxHp - 50);
    sim.addItem('baked_bread', 1);
    sim.addItem('minor_healing_potion', 1);

    sim.feedPet('minor_healing_potion');
    expect(sim.tick().some((e) => e.type === 'error' && /only eat food/.test(e.text))).toBe(true);
    expect(sim.countItem('minor_healing_potion')).toBe(1);

    const breadBefore = sim.countItem('baked_bread');
    sim.feedPet('baked_bread');
    expect(sim.countItem('baked_bread')).toBe(breadBefore - 1);
    expect(pet.auras.some((a) => a.id === 'feed_pet' && a.kind === 'hot')).toBe(true);
    const hpAfterFeed = pet.hp;
    for (let i = 0; i < 20 * 5; i++) sim.tick();
    expect(pet.hp).toBeGreaterThan(hpAfterFeed);
  });

  it('abandon pet despawns the owned copy instead of releasing it as wild', () => {
    const { sim, wolf: pet } = tamedSetup();
    sim.abandonPet();
    expect(sim.entities.has(pet.id)).toBe(false);
    expect(sim.petOf(sim.playerId, true)).toBe(null);
  });

  it('pets default defensive, level with the archer, and regenerate health out of combat', () => {
    const { sim, wolf: pet } = tamedSetup();
    expect(pet.petMode).toBe('defensive');
    expect(pet.level).toBe(sim.player.level);

    sim.setPlayerLevel(12);
    expect(pet.level).toBe(12);
    expect(pet.maxHp).toBeGreaterThan(0);

    pet.inCombat = false;
    pet.hp = Math.max(1, pet.maxHp - 20);
    const hpBefore = pet.hp;
    for (let i = 0; i < 20 * 2; i++) sim.tick();
    expect(pet.hp).toBeGreaterThan(hpBefore);
  });

  it('tame validation: too-high level and elites are refused', () => {
    const sim = makeSim('archer');
    sim.setPlayerLevel(10);
    const wolf = nearestMob(sim, 'forest_wolf');
    wolf.level = 11;
    teleport(sim, sim.player, wolf.pos.x + 5, wolf.pos.z);
    sim.targetEntity(wolf.id);
    sim.player.facing = Math.atan2(wolf.pos.x - sim.player.pos.x, wolf.pos.z - sim.player.pos.z);
    sim.castAbility('tame_beast');
    const events = sim.tick();
    expect(events.some((e) => e.type === 'error' && /too high level/.test(e.text))).toBe(true);
    expect(wolf.ownerId).toBe(null);
  });
});

describe('untargetable-mob self-heal (#113/#99)', () => {
  it('a wild mob left non-hostile is restored so it can never stay an immortal invalid target', () => {
    const sim = makeSim();
    const wolf = nearestMob(sim, 'forest_wolf');
    // simulate a corruption/leak: owner-less but stuck neutral (grey, "Invalid target")
    wolf.hostile = false;
    wolf.ownerId = null;
    expect(sim.isHostileTo(sim.player, wolf)).toBe(false); // currently untargetable

    sim.tick(); // the per-mob safety net runs

    expect(wolf.hostile).toBe(true);
    expect(sim.isHostileTo(sim.player, wolf)).toBe(true); // attackable again
  });

  it('does not flip a tamed pet (owned, intentionally neutral) back to hostile', () => {
    const sim = makeSim('archer');
    sim.setPlayerLevel(10);
    const wolf = nearestMob(sim, 'forest_wolf');
    teleport(sim, sim.player, wolf.pos.x + 5, wolf.pos.z);
    sim.targetEntity(wolf.id);
    sim.player.facing = Math.atan2(wolf.pos.x - sim.player.pos.x, wolf.pos.z - sim.player.pos.z);
    sim.castAbility('tame_beast');
    for (let i = 0; i < 20 * 7; i++) sim.tick();
    const pet = sim.petOf(sim.playerId)!;
    expect(pet.ownerId).toBe(sim.playerId);
    expect(pet.hostile).toBe(false); // pets stay neutral; the self-heal must not touch owned mobs
  });
});

describe('social aggro pull radius (#102)', () => {
  function twoMurlocs(sim: Sim): [Entity, Entity] {
    const murlocs = [...sim.entities.values()].filter(
      (e) => e.kind === 'mob' && !e.dead && e.ownerId === null && e.templateId === 'mudfin_murloc',
    );
    expect(murlocs.length).toBeGreaterThanOrEqual(2);
    return [murlocs[0], murlocs[1]];
  }

  it('a murloc does not chain-pull a same-family neighbour 13yd away', () => {
    const sim = makeSim();
    const [a, b] = twoMurlocs(sim);
    for (const m of [a, b]) {
      m.aiState = 'idle';
      m.hostile = true;
    }
    teleport(sim, b, a.pos.x + 13, a.pos.z); // beyond the tuned murloc radius
    teleport(sim, sim.player, a.pos.x + 2, a.pos.z);
    (sim as any).grid.refresh(sim.entities.values());
    (sim as any).aggroMob(a, sim.player, true);
    expect(b.aiState).toBe('idle'); // not chain-pulled
  });

  it('a murloc still pulls a neighbour within the tuned radius', () => {
    const sim = makeSim();
    const [a, b] = twoMurlocs(sim);
    for (const m of [a, b]) {
      m.aiState = 'idle';
      m.hostile = true;
    }
    teleport(sim, b, a.pos.x + 7, a.pos.z); // inside the murloc radius
    teleport(sim, sim.player, a.pos.x + 2, a.pos.z);
    (sim as any).grid.refresh(sim.entities.values());
    (sim as any).aggroMob(a, sim.player, true);
    expect(b.aiState).toBe('chase');
  });
});

describe('caster wand auto-attack (#94)', () => {
  it('does not aggro a hostile mob when melee auto-attack is started out of range', () => {
    const sim = makeSim('swordman');
    sim.setPlayerLevel(10);
    const wolf = nearestMob(sim, 'forest_wolf');
    teleport(sim, sim.player, wolf.pos.x + 35, wolf.pos.z);
    sim.targetEntity(wolf.id);

    sim.startAutoAttack(sim.playerId);

    expect(sim.player.autoAttack).toBe(true);
    expect(wolf.aiState).toBe('idle');
    expect(wolf.aggroTargetId).toBeNull();
    expect(wolf.threat.get(sim.playerId)).toBeUndefined();
    expect(sim.player.inCombat).toBe(false);
  });

  it('a mage auto-attacks at range instead of running into melee', () => {
    const sim = makeSim('mage');
    sim.setPlayerLevel(10);
    const wolf = nearestMob(sim, 'forest_wolf');
    const range = 15; // well outside MELEE_RANGE
    teleport(sim, sim.player, wolf.pos.x + range, wolf.pos.z);
    sim.targetEntity(wolf.id);
    sim.player.facing = Math.atan2(wolf.pos.x - sim.player.pos.x, wolf.pos.z - sim.player.pos.z);
    const startHp = wolf.hp;

    sim.startAutoAttack(sim.playerId);
    let sawWand = false;
    for (let i = 0; i < 20 * 5 && !sawWand; i++) {
      const events = sim.tick();
      if (
        events.some(
          (e) =>
            e.type === 'damage' &&
            (e as any).ability === 'Wand' &&
            (e as any).sourceId === sim.playerId,
        )
      )
        sawWand = true;
    }

    expect(sawWand).toBe(true);
    expect(wolf.hp).toBeLessThan(startHp); // damage landed from range
    expect(dist2d(sim.player.pos, wolf.pos)).toBeGreaterThan(5); // never closed to melee
  });
});

describe('on-next-swing cooldowns (#56)', () => {
  it('Gutting Strike applies its 6s cooldown when the queued swing resolves', () => {
    const sim = makeSim('archer');
    sim.setPlayerLevel(10);
    const wolf = nearestMob(sim, 'forest_wolf');
    teleport(sim, sim.player, wolf.pos.x + 2, wolf.pos.z); // inside melee range
    sim.targetEntity(wolf.id);
    sim.player.facing = Math.atan2(wolf.pos.x - sim.player.pos.x, wolf.pos.z - sim.player.pos.z);
    fundCasts(sim.player);

    sim.castAbility('raptor_strike'); // queues on next swing; cooldown not yet set
    // tick until the auto-attack swing lands and consumes the queued ability
    for (let i = 0; i < 20 * 4 && sim.player.queuedOnSwing !== null; i++) sim.tick();

    expect(sim.player.queuedOnSwing).toBe(null); // the swing resolved
    expect(sim.player.cooldowns.get('raptor_strike') ?? 0).toBeGreaterThan(0); // cooldown now ticking
  });
});
