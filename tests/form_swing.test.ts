import { describe, expect, it } from 'vitest';
import { hardDefMultiplier } from '../src/sim/combat/defence';
import { baseSwingSpeed, ROGUE_BASE_SWING_SPEED } from '../src/sim/combat/form_swing';
import { CLASSES, ITEMS } from '../src/sim/data';
import { Sim } from '../src/sim/sim';
import type { AuraKind } from '../src/sim/types';

function makeWorld() {
  return new Sim({ seed: 42, playerClass: 'warrior', noPlayer: true });
}

// Mirror tests/form_command.ts: forms are a 3600s toggle aura on the player.
function giveForm(sim: Sim, pid: number, kind: AuraKind, name: string) {
  const e = sim.entities.get(pid)!;
  e.auras.push({
    id: name.toLowerCase().replace(/\s+/g, '_'),
    name,
    kind,
    remaining: 3600,
    duration: 3600,
    value: 1,
    sourceId: pid,
    school: 'physical',
  });
}

describe('Wolf Form swing speed', () => {
  it('matches the rogue base weapon speed exactly', () => {
    const rogueWeapon = ITEMS[CLASSES.rogue.startWeapon].weapon!;
    expect(ROGUE_BASE_SWING_SPEED).toBe(rogueWeapon.speed);
  });

  it('a druid in Wolf Form swings at the rogue cadence, ignoring its weapon', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('druid', 'Bet');
    sim.tick();
    const druid = sim.entities.get(a)!;

    // The druid's caster weapon is slower than a rogue dagger: that slow speed is
    // exactly what used to leak into Wolf Form's auto-attacks (the bug).
    expect(druid.weapon.speed).toBeGreaterThan(ROGUE_BASE_SWING_SPEED);

    giveForm(sim, a, 'form_cat', 'Wolf Form');
    expect(baseSwingSpeed(druid)).toBe(ROGUE_BASE_SWING_SPEED);
  });

  it('a druid out of form swings at its own weapon speed', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('druid', 'Dalet');
    sim.tick();
    const druid = sim.entities.get(a)!;
    expect(baseSwingSpeed(druid)).toBe(druid.weapon.speed);
  });

  it('a rogue is unaffected (no form aura): own weapon speed', () => {
    const sim = makeWorld();
    const a = sim.addPlayer('rogue', 'Gimel');
    sim.tick();
    const rogue = sim.entities.get(a)!;
    expect(baseSwingSpeed(rogue)).toBe(rogue.weapon.speed);
    expect(rogue.weapon.speed).toBe(ROGUE_BASE_SWING_SPEED);
  });

  // Land the first white-hit auto-attack a druid scores on an immortal,
  // unarmored dummy, returning the dealt amount plus the runtime attack power and
  // hard-DEF reduction in effect, so the test can predict the amount exactly even
  // as recalcPlayerStats refreshes attack power every tick.
  //
  // The weapon carries a real attack power now, where it used to be zeroed: the
  // cadence normalization this case is about moved onto the WEAPON roll, because
  // Ragnarok's status ATK has no per-second divisor to normalize. Zeroing the
  // weapon would leave nothing cadence-dependent to measure at all. Dexterity is
  // pinned above the weapon so the roll collapses to a single value.
  const DUMMY_WEAPON_ATK = 40;
  function firstWhiteHit(sim: Sim, pid: number): { amount: number; ap: number; dr: number } {
    const p = sim.entities.get(pid)!;
    p.critChance = 0;
    p.weapon = { ...p.weapon, min: DUMMY_WEAPON_ATK, max: DUMMY_WEAPON_ATK };
    p.stats.dex = 200;
    const dummy = [...sim.entities.values()].find((e) => e.kind === 'mob' && !e.dead)!;
    dummy.level = 1;
    dummy.stats.armor = 0;
    dummy.hostile = true;
    p.pos.x = dummy.pos.x + 1;
    p.pos.z = dummy.pos.z;
    p.pos.y = dummy.pos.y;
    p.prevPos = { ...p.pos };
    p.targetId = dummy.id;
    sim.startAutoAttack(pid);
    for (let i = 0; i < 400; i++) {
      dummy.hp = dummy.maxHp = 1e9;
      dummy.dead = false;
      dummy.pos.x = p.pos.x - 1;
      dummy.pos.z = p.pos.z;
      p.facing = Math.atan2(dummy.pos.x - p.pos.x, dummy.pos.z - p.pos.z);
      const evs = sim.tick();
      const hit = evs.find(
        (e) => e.type === 'damage' && e.sourceId === pid && e.ability == null && e.kind === 'hit',
      );
      if (hit && hit.type === 'damage') {
        // biome-ignore lint/suspicious/noExplicitAny: reach private helpers for an exact expectation
        const s = sim as any;
        const dr = 1 - hardDefMultiplier(s.effectiveArmor(dummy));
        return { amount: hit.amount, ap: s.effectiveAttackPower(p), dr };
      }
    }
    throw new Error('no white hit landed');
  }

  it('Wolf Form normalizes swing DAMAGE to the rogue cadence (no AP double-dip)', () => {
    // Status ATK adds RAW and carries no speed factor: Ragnarok has no
    // attack-power-per-second divisor at all. The cadence guard now lives
    // entirely on the WEAPON roll, which is normalized by the speed the swing
    // actually fires at, so a fast shapeshift cannot also collect the per-swing
    // damage of the slow staff it is holding. `dr` is the equipment percentage
    // only; the flat Vitality layer is zero against a dummy with no Vitality.
    const expectAt = (ap: number, speed: number, dr: number) =>
      Math.max(1, Math.round((DUMMY_WEAPON_ATK * (speed / 2) + ap) * (1 - dr)));

    const sim = makeWorld();
    const a = sim.addPlayer('druid', 'Feral');
    sim.setPlayerLevel(20, a);
    sim.tick();
    const staffSpeed = sim.entities.get(a)!.weapon.speed;
    giveForm(sim, a, 'form_cat', 'Wolf Form');
    const wolf = firstWhiteHit(sim, a);

    // The control druid on the same staff in BEAR form: a melee shapeshift that
    // keeps the weapon cadence, so its AP is normalized by the slow staff. (It
    // used to be an un-shifted druid, but a caster-form druid now auto-attacks
    // with the class wand at any range, wand-style, so it never lands a melee
    // white hit; bear form preserves the staff-speed control this test needs.)
    const sim2 = makeWorld();
    const b = sim2.addPlayer('druid', 'Bruin');
    sim2.setPlayerLevel(20, b);
    sim2.tick();
    giveForm(sim2, b, 'form_bear', 'Bear Form');
    const staff = firstWhiteHit(sim2, b);

    // Wolf Form's per-swing weapon share uses the rogue speed (1.8); the bear druid's the staff.
    expect(wolf.amount).toBe(expectAt(wolf.ap, ROGUE_BASE_SWING_SPEED, wolf.dr));
    expect(staff.amount).toBe(expectAt(staff.ap, staffSpeed, staff.dr));
    // The bug would have been Wolf Form normalizing by the slow staff instead: prove
    // the fixed cadence value is genuinely smaller, so a faster swing hits softer.
    expect(staffSpeed).toBeGreaterThan(ROGUE_BASE_SWING_SPEED);
    expect(wolf.amount).toBeLessThan(expectAt(wolf.ap, staffSpeed, wolf.dr));
  });
});
