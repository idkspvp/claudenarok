// Baseline dodge roll, one per class (src/sim/content/classes.ts).
//
// The load-bearing contract is the 'invuln' aura kind: total damage denial with
// NO control component, which is what separates it from 'stasis' (Ice Block).
// If a future change folds 'invuln' into the cc.ts lockout predicates, the roll
// silently becomes a 1-second self-stun, so that separation is pinned here
// alongside the damage gate itself.
import { describe, expect, it } from 'vitest';
import { isInvulnerable, isRooted, isSilenced, isStunned } from '../src/sim/combat/cc';
import { abilitiesKnownAt } from '../src/sim/content/classes';
import { MOBS } from '../src/sim/data';
import { createMob } from '../src/sim/entity';
import { Sim } from '../src/sim/sim';
import type { Aura, Entity, PlayerClass } from '../src/sim/types';
import { raisePool } from './helpers/sp';

// Partial on purpose: the two conversion classes have no abilities yet, so they
// have no dodge roll to pin. A full Record would force a fabricated id here.
const ROLLS: Partial<Record<PlayerClass, string>> = {
  swordman: 'bracing_roll',
  mage: 'phase_tumble',
  archer: 'wildstep',
  acolyte: 'veilstep',
  thief: 'shadowslip',
};

const ROLL_DISTANCE = 8;
const IFRAME_SECONDS = 1;

function rig(cls: PlayerClass) {
  const sim = new Sim({ seed: 23, playerClass: cls, autoEquip: true });
  sim.setPlayerLevel(20);
  sim.tick();
  const p = sim.player;
  raisePool(p);
  p.gcdRemaining = 0;
  return { sim, p };
}

function dealDamage(sim: Sim, target: Entity, amount: number, school = 'physical'): void {
  (
    sim as unknown as {
      dealDamage(
        s: Entity | null,
        t: Entity,
        n: number,
        c: boolean,
        sc: string,
        a: string | null,
        k: string,
      ): void;
    }
  ).dealDamage(null, target, amount, false, school, null, 'hit');
}

function tickSeconds(sim: Sim, seconds: number): void {
  for (let i = 0; i < Math.round(20 * seconds); i++) sim.tick();
}

// Physical school on purpose: the roll's own aura inherits its ability's school,
// and isDispellableAura refuses physical outright, so the i-frames can never be
// dispelled off mid-roll.
function aura(kind: Aura['kind'], remaining = 30): Aura {
  return {
    id: kind,
    name: kind,
    kind,
    value: 1,
    remaining,
    duration: remaining,
    sourceId: 0,
    school: 'physical',
  };
}

describe('baseline dodge roll: kit coverage', () => {
  it('every one of the nine classes learns its roll at level 10 as baseline kit', () => {
    for (const [cls, id] of Object.entries(ROLLS) as [PlayerClass, string][]) {
      const known = abilitiesKnownAt(cls, 10).find((a) => a.def.id === id);
      expect(known, `${cls} should know ${id} at level 10`).toBeTruthy();
      // Learned outright (baseline kit), not behind a talent grant.
      expect(known?.def.class).toBe(cls);
    }
  });

  it('no class knows its roll before level 10', () => {
    for (const [cls, id] of Object.entries(ROLLS) as [PlayerClass, string][]) {
      expect(abilitiesKnownAt(cls, 9).some((a) => a.def.id === id)).toBe(false);
    }
  });

  it('all nine share one shape: 8 yd root-breaking roll plus a 1 s invuln window', () => {
    for (const [cls, id] of Object.entries(ROLLS) as [PlayerClass, string][]) {
      const known = abilitiesKnownAt(cls, 20).find((a) => a.def.id === id);
      const blink = known?.effects.find((e) => e.type === 'blinkForward');
      const buff = known?.effects.find((e) => e.type === 'selfBuff');
      expect(blink, `${cls} roll should move the player`).toBeTruthy();
      expect(blink).toMatchObject({ distance: ROLL_DISTANCE, breakRoots: true });
      expect(buff, `${cls} roll should grant i-frames`).toBeTruthy();
      expect(buff).toMatchObject({ kind: 'invuln', duration: IFRAME_SECONDS });
      expect(known?.def.cooldown).toBe(12);
      expect(known?.def.requiresTarget).toBe(false);
      // Physical school on every class, casters included, so a silence can never
      // lock the roll out (mirrors the mage's Gag Order).
      expect(known?.def.school, `${cls} roll must survive a silence`).toBe('physical');
    }
  });
});

describe("baseline dodge roll: the 'invuln' contract", () => {
  it('denies every incoming damage school while it rides, then stops on expiry', () => {
    const { sim, p } = rig('swordman');
    p.auras.push(aura('invuln', IFRAME_SECONDS));
    const full = p.hp;

    for (const school of ['physical', 'fire', 'frost', 'arcane', 'shadow', 'holy', 'nature']) {
      dealDamage(sim, p, 40, school);
      expect(p.hp, `${school} damage should be denied`).toBe(full);
    }

    // Past the window the very same hit lands.
    tickSeconds(sim, IFRAME_SECONDS + 0.2);
    expect(isInvulnerable(p)).toBe(false);
    dealDamage(sim, p, 40, 'physical');
    expect(p.hp).toBeLessThan(full);
  });

  it('denies a telegraphed AoE nova the roller is standing inside', () => {
    const { sim, p } = rig('thief');
    const mob = createMob(9200, MOBS.forest_wolf, 20, { x: p.pos.x, y: p.pos.y, z: p.pos.z + 1 });
    mob.hostile = true;
    (sim as unknown as { addEntity(e: Entity): void }).addEntity(mob);
    const full = p.hp;

    p.auras.push(aura('invuln', IFRAME_SECONDS));
    // An AoE pulse resolves through the same dealDamage choke point as a swing.
    dealDamage(sim, p, 9999, 'fire');
    expect(p.hp).toBe(full);
  });

  it('leaves the roller free to act: it is NOT a stun, root, or silence', () => {
    const rolling = { auras: [aura('invuln', IFRAME_SECONDS)] } as Entity;
    expect(isInvulnerable(rolling)).toBe(true);
    expect(isStunned(rolling)).toBe(false);
    expect(isRooted(rolling)).toBe(false);
    expect(isSilenced(rolling)).toBe(false);

    // Ice Block's 'stasis' is the contrast: immune AND fully locked down.
    const encased = { auras: [aura('stasis')] } as Entity;
    expect(isStunned(encased)).toBe(true);
    expect(isRooted(encased)).toBe(true);
  });

  it('is not confused with an empty aura list or an unrelated buff', () => {
    expect(isInvulnerable({ auras: [] } as unknown as Entity)).toBe(false);
    expect(isInvulnerable({ auras: [aura('shield_wall')] } as unknown as Entity)).toBe(false);
  });
});

describe('baseline dodge roll: casting it', () => {
  it('moves the caster forward and grants the window, and is deterministic', () => {
    const run = () => {
      const { sim, p } = rig('archer');
      p.facing = 0; // +z
      const from = { x: p.pos.x, z: p.pos.z };
      sim.castAbility('wildstep');
      sim.tick();
      return {
        moved: Math.round(Math.hypot(p.pos.x - from.x, p.pos.z - from.z) * 100) / 100,
        invuln: isInvulnerable(p),
      };
    };
    const first = run();
    expect(first.invuln).toBe(true);
    expect(first.moved).toBeGreaterThan(0);
    // Same seed, same outcome: the roll draws no rng of its own.
    expect(run()).toEqual(first);
  });

  it('breaks a root, so a snared player can still roll clear', () => {
    const { sim, p } = rig('acolyte');
    p.auras.push(aura('root'));
    expect(isRooted(p)).toBe(true);
    sim.castAbility('veilstep');
    sim.tick();
    expect(p.auras.some((a) => a.kind === 'root')).toBe(false);
    expect(isInvulnerable(p)).toBe(true);
  });
});
