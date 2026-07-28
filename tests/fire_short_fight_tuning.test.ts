// Fire mage short-fight burst regression (live report 2026-07-24): on a 27s
// Nythraxis kill a fire mage in Soulflame 4pc + Mournweave 3pc parsed 363 DPS
// against ~149-158 for comparable players (~2.3x). The root cause is
// Cinderfall's action economy inside the Fire proc loop, not base spell
// damage: every Cinderfall press is a guaranteed crit that is simultaneously
// instant damage, a 40% Ignite bank, a Hot Streak builder (a free instant
// Pyrelance every second press), and Phoenix Trance CDR, at zero rotational
// cost (off-GCD, usable while casting, three banked charges).
//
// This harness reproduces the reported fight deterministically: the EXACT
// reported gear, the Phoenix Trance opener, the Cinderfall dump, Hot Streak
// Pyrelances, Meteor on cooldown, Cinderbolt filler. The comparator is frost
// in the IDENTICAL gear playing its real kit (Water Elemental pre-summoned,
// Icy Veins, Frozen Orb, Brain Freeze Flurries, Fingers-of-Frost Ice Lances,
// Glacial Spike at five icicles, Rimelance filler), a fuller baseline than
// chronomancy_balance.test.ts' Frostbolt-spam "cryo" proxy so the burst band
// is honest. Mana is pinned to full: the report's premise is that mana never
// matters at 27s.
//
// Target band (this fix): fire's short-fight DPS stays a real burst edge over
// the sustained comparator, but bounded: floor 1.0x, ceiling 1.6x. On the
// pre-fix values the ratio is ~2x+, so the ceiling assertion is the failing
// regression this change turns green.
//
// Despite the file name, the suite gates ENTIRE fights, not just the 27s
// incident. Final shape (designer round 2026-07-25): the burst window is
// sanctioned fire identity (the Cinderfall bank dump inside Phoenix Trance
// stays), so the 27s blocks only sanity-bound it; the BALANCE target is
// fight-long damage, pinned by the sustained block at 60s and 120s plus the
// Ignite contract at duration (pre-fix, sustained fire ran 2.2x-2.9x frost
// at every duration and Ignite was 46% of all damage).
import { describe, expect, it } from 'vitest';
import { ABILITIES, ITEMS, MOBS } from '../src/sim/data';
import { createMob, type PlayerEquipment, recalcPlayerStats } from '../src/sim/entity';
import { Sim } from '../src/sim/sim';
import type { Entity } from '../src/sim/types';
import { spreadAllocation } from './helpers/alloc';
import { fundCasts } from './helpers/sp';

const FIGHT_SECONDS = 27; // the reported Nythraxis kill length
const SHORT_FIGHT_DPS_CEILING = 1.6; // x the sustained comparator, 27s window
const SHORT_FIGHT_DPS_FLOOR = 1.0; // the nerf must not gut the burst identity

// BiS mage gear (owner direction 2026-07-25, gear-candidate sim): the
// reported live loadout's sets (Soulflame 4pc + Mournweave 3pc) with every
// Heroic upgrade that exists, the Heroic legendary staff and Heroic orb, and
// the two haste rings. Beat the reported loadout, a 4pc+offset hybrid, and a
// per-slot stat-greedy set in head-to-head sims (set bonuses dominate).
const BIS_GEAR: PlayerEquipment = {
  helmet: 'heroic_soulflame_cowl',
  face: 'zense_meridian',
  back: 'heroic_soulflame_mantle',
  chest: 'heroic_necromancers_starshroud',
  mainhand: 'heroic_deathless_heartwood',
  offhand: 'heroic_wraithfire_orb',
  legs: 'necromancers_legwraps',
  feet: 'heroic_necromancers_soulsteps',
  ring1: 'architects_cornerstone',
  ring2: 'zyzzs_deathless_signet',
};

// Which of the mage's two damage rotations the harness plays. These used to be
// committed specializations; specs are retired (Phase D0) and a mage now knows
// both kits, so this is a ROTATION choice, not a build.
type Spec = 'fire' | 'frost';

interface CtxLike {
  players: Map<number, { cls: string; equipment: PlayerEquipment; equipmentInstance?: unknown }>;
  playerMods: (meta: unknown) => unknown;
}

function gearedMage(seed = 41): { sim: Sim; p: Entity } {
  const sim = new Sim({ seed, playerClass: 'mage', autoEquip: true });
  sim.setPlayerLevel(20);
  sim.tick();
  const p = sim.player;
  const ctx = (sim as unknown as { ctx: CtxLike }).ctx;
  const meta = ctx.players.get(p.id);
  if (!meta) throw new Error('player meta missing');
  meta.equipment = { ...BIS_GEAR };
  recalcPlayerStats(
    p,
    meta.cls as never,
    meta.equipment,
    ctx.playerMods(meta) as never,
    meta.equipmentInstance as never,
    spreadAllocation(p.level),
  );
  fundCasts(p);
  return { sim, p };
}

function addBossDummy(sim: Sim, dist = 6): Entity {
  const p = sim.player;
  const mob = createMob(9500, MOBS.training_dummy, 20, {
    x: p.pos.x,
    y: p.pos.y,
    z: p.pos.z + dist,
  });
  mob.hostile = true;
  mob.maxHp = mob.hp = 1_000_000_000;
  (sim as unknown as { addEntity(e: Entity): void }).addEntity(mob);
  return mob;
}

function free(p: Entity): boolean {
  const q = p as unknown as { castingAbility: string | null; gcdRemaining: number };
  return q.castingAbility == null && q.gcdRemaining <= 1e-6;
}

function offCooldown(p: Entity, id: string): boolean {
  return (p.cooldowns.get(id) ?? 0) <= 0;
}

// Charge-banked abilities: the bank is the truth once it exists (the engine
// also mirrors an empty bank into the cooldown map for the UI swirl, which
// must NOT gate a press while a charge, e.g. the Trance restoke, is banked).
function canPress(p: Entity, id: string): boolean {
  const bank = p.abilityCharges?.[id];
  return bank ? bank.charges > 0 : offCooldown(p, id);
}

interface BurstResult {
  dps: number;
  damage: number;
  byAbility: Record<string, number>;
  ignitePaid: number; // Ignite damage actually received by the dummy
  igniteBanked: number; // estimate: 40% of fire crit damage + 40% of non-crit Meteor impacts
}

// Drive one rotation's short-fight loop for `seconds` and sum every point of
// player damage on the dummy (direct hits, DoTs, Ignite and the frost pet all
// attribute to the mage: pet damage resolves through ownerId). Deterministic:
// fixed seed, fixed tick script, no rng beyond the sim's own stream.
//
// The row-active arms (Rune of Power, the Convergence weave, Racing Mind) were
// talent picks and are pinned off: their abilities went with the talent trees.
function runShortFight(spec: Spec, seconds: number, seed = 41): BurstResult {
  const { sim, p } = gearedMage(seed);
  const dummy = addBossDummy(sim);
  sim.targetEntity(dummy.id);
  const hasRune = false;
  const hasConv = false;
  const hasRacing = false;
  const auraUp = (id: string) => p.auras.some((a) => a.id === id);
  if (spec === 'frost') {
    // A raider walks in with the Water Elemental already up: summon it before
    // the pull so the 27s window measures the fight, not the setup cast.
    sim.castAbility('summon_water_elemental');
    for (let i = 0; i < 60; i++) sim.tick(); // 3s: cast lands, pet settles
    fundCasts(p);
  }
  const mine = (sourceId: number): boolean => {
    if (sourceId === p.id) return true;
    const src = sim.entities.get(sourceId);
    return src?.ownerId === p.id;
  };
  let damage = 0;
  let ignitePaid = 0;
  let igniteBanked = 0;
  const byAbility: Record<string, number> = {};
  const ticks = Math.round(seconds * 20);
  for (let i = 0; i < ticks; i++) {
    p.resource = p.maxResource; // mana never matters at 27s (report premise)
    if (spec === 'fire') {
      // Off-GCD presses first, exactly as a player mashes them: the Trance
      // opener (after the rune is down), then Cinderfall whenever it is
      // ready (off-GCD, usable while casting).
      if (offCooldown(p, 'combustion') && (!hasRune || i >= 45)) sim.castAbility('combustion');
      if (canPress(p, 'fire_blast')) sim.castAbility('fire_blast');
      if (free(p)) {
        // Rune re-casts on cooldown so long fights keep its uptime, not just
        // the opener (the 27s window still only ever fits the first cast).
        if (hasRune && offCooldown(p, 'rune_of_power')) sim.castAbility('rune_of_power');
        else if (
          hasConv &&
          !auraUp('elemental_convergence') &&
          !auraUp('convergence_cd') &&
          offCooldown(p, 'frost_nova')
        )
          sim.castAbility('frost_nova'); // the free instant Convergence weave
        else if (auraUp('hot_streak')) sim.castAbility('pyroblast');
        else if (hasRacing && offCooldown(p, 'presence_of_mind')) {
          sim.castAbility('presence_of_mind');
          sim.castAbility('pyroblast');
        } else if (offCooldown(p, 'meteor'))
          sim.castAbilityAt('meteor', { x: dummy.pos.x, z: dummy.pos.z });
        else sim.castAbility('fireball');
      }
    } else if (free(p)) {
      // Frost plays its real kit: Icy Veins opener, Glacial Spike at five
      // icicles, Brain Freeze Flurry, proc-fed Ice Lance, Frozen Orb on
      // cooldown, Rimelance filler; with rows, Rune uptime and Racing Mind
      // Glacial Spikes.
      const icicles = p.auras.find((a) => a.kind === 'icicles');
      if (hasRune && offCooldown(p, 'rune_of_power')) sim.castAbility('rune_of_power');
      else if (offCooldown(p, 'icy_veins')) sim.castAbility('icy_veins');
      else if ((icicles?.stacks ?? 0) >= 5) {
        if (hasRacing && offCooldown(p, 'presence_of_mind')) sim.castAbility('presence_of_mind');
        sim.castAbility('glacial_spike');
      } else if (p.auras.some((a) => a.id === 'brain_freeze')) sim.castAbility('flurry');
      else if (
        p.auras.some((a) => a.id === 'fingers_of_frost') ||
        dummy.auras.some((a) => a.id === 'winters_chill')
      )
        sim.castAbility('ice_lance');
      else if (offCooldown(p, 'frozen_orb')) sim.castAbility('frozen_orb');
      else sim.castAbility('frostbolt');
    }
    for (const e of sim.tick()) {
      if (e.type === 'damage' && mine(e.sourceId) && e.targetId === dummy.id) {
        damage += e.amount;
        const key = e.ability ?? 'auto';
        byAbility[key] = (byAbility[key] ?? 0) + e.amount;
        if (e.ability === 'Ignite') ignitePaid += e.amount;
        else if (e.school === 'fire' && e.sourceId === p.id) {
          if (e.crit) igniteBanked += Math.round(e.amount * 0.4);
          else if (e.ability === 'Emberfall') igniteBanked += Math.round(e.amount * 0.4);
        }
      }
    }
  }
  return { dps: damage / seconds, damage, byAbility, ignitePaid, igniteBanked };
}

// Fire mage burst and sustained-parity tuning, built on Hot Streak and Combustion.
// BLOCKED on the skill rebuild. Pre-renewal Ragnarok has no magic critical, so
// the mechanic these targets were calibrated against no longer exists. Restoring
// spell crit to make them pass would undo a verified conversion; the numbers are
// re-derived when the Ragnarok skill list replaces these specs. See
// docs/design/ro-reference-source.md.
describe.skip('fire mage short-fight burst (27s live report harness)', () => {
  const fire = runShortFight('fire', FIGHT_SECONDS);
  const frost = runShortFight('frost', FIGHT_SECONDS);
  // Post-#2358 (crit/haste rating halved) the naked frost 27s cell is
  // proc-luck heavy: ~8 Rimelances fit the window, so a single seed has a
  // 27% chance of ZERO Fingers procs and its DPS swings ~40%. The band
  // therefore compares 5-seed MEANS (same seeds as the talented gates); the
  // single seed-41 run above stays for the breakdown report and sanity.
  const BAND_SEEDS = [41, 101, 108, 115, 122];
  const fireMean =
    BAND_SEEDS.map((s) => runShortFight('fire', FIGHT_SECONDS, s).dps).reduce((a, b) => a + b, 0) /
    BAND_SEEDS.length;
  const frostMean =
    BAND_SEEDS.map((s) => runShortFight('frost', FIGHT_SECONDS, s).dps).reduce((a, b) => a + b, 0) /
    BAND_SEEDS.length;

  it('the reported gear resolves (every id exists on its slot)', () => {
    for (const [slot, id] of Object.entries(BIS_GEAR)) {
      const def = ITEMS[id as string];
      expect(def, `${id} exists`).toBeTruthy();
      const wanted = slot === 'ring1' || slot === 'ring2' ? 'ring' : slot;
      expect(def.slot, `${id} slot`).toBe(wanted);
    }
  });

  it('reports the measured short-fight numbers (owner harness)', () => {
    const fmt = (label: string, r: BurstResult) => {
      const parts = Object.entries(r.byAbility)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}=${v}`)
        .join(' ');
      return `${label.padEnd(6)}: DPS=${r.dps.toFixed(1)} total=${r.damage} [${parts}]`;
    };
    const lines = [fmt('fire', fire), fmt('frost', frost)].join('\n');
    expect(lines.length).toBeGreaterThan(0);
    console.log(
      `\n[fire short fight] ${FIGHT_SECONDS}s, reported gear, ratio=${(fire.dps / frost.dps).toFixed(2)}\n${lines}\n`,
    );
  });

  it('both loops actually fired (harness sanity)', () => {
    expect(fire.damage).toBeGreaterThan(0);
    expect(frost.damage).toBeGreaterThan(0);
    // The fire loop really exercised the reported machinery: Trance-fed Hot
    // Streak Pyrelances and Ignite both landed damage.
    expect(fire.byAbility.Pyrelance ?? 0).toBeGreaterThan(0);
    expect(fire.byAbility.Ignite ?? 0).toBeGreaterThan(0);
    expect(fire.byAbility.Cinderfall ?? 0).toBeGreaterThan(0);
  });

  it(`fire's 27s burst stays within ${SHORT_FIGHT_DPS_CEILING}x the sustained comparator`, () => {
    expect(fireMean).toBeLessThanOrEqual(frostMean * SHORT_FIGHT_DPS_CEILING);
  });

  it('the burst edge survives (the fix must not gut the spec)', () => {
    expect(fireMean).toBeGreaterThanOrEqual(frostMean * SHORT_FIGHT_DPS_FLOOR);
  });

  it('reports the naked band means (owner harness)', () => {
    console.log(
      `[naked band, 5 seeds] fire=${fireMean.toFixed(1)} frost=${frostMean.toFixed(1)} ratio=${(fireMean / frostMean).toFixed(2)}`,
    );
    expect(fireMean).toBeGreaterThan(0);
  });
});

describe.skip('the tuned knobs (balance 2026-07-25, designer round)', () => {
  it('Cinderfall keeps its three-charge bank on a 30s recharge (was 8s)', () => {
    expect(ABILITIES.fire_blast.maxCharges).toBe(3);
    expect(ABILITIES.fire_blast.cooldown).toBe(30);
  });
});

// Entire-fight coverage (owner follow-up 2026-07-24): the bug was never just
// the opener. On the pre-fix sim the Ignite refresh overpay GREW with fight
// length (about 47% of all fire damage by 120s) and sustained talented fire
// ran 2.2x to 2.9x the frost comparator at EVERY duration measured (27s to
// 300s). This gate pins rotational parity at 120s in the infinite-mana
// regime (real-mana runs past ~90s at level 20 degenerate into five-second-
// rule regen idling for every spec, which would hide the rotation being
// measured). Pre-fix ratio at these seeds: ~2.8x, so both fire assertions
// fail loudly on the old sim.
describe.skip('sustained parity, entire fight (Monte Carlo follow-up 2026-07-24)', () => {
  const SUSTAINED_SEEDS = [41, 101, 115];
  const SUSTAINED_CEILING = 1.25; // x talented frost, per duration
  // Owner ruling 2026-07-25: frost is the PvP-leaning spec, so fire must
  // NEVER fall below it in PvE damage, at any fight length. The floor is
  // therefore parity, not a discount.
  const SUSTAINED_FLOOR = 1.0;
  const IGNITE_SHARE_CEILING = 0.3; // the 40%-over-6s contract at duration
  // 60s is the shortest "entire fight" (one full burst window amortized), the
  // leakiest cell across every knob variant tried; 120s is the raid-typical
  // length. Both are pinned so the bank/recharge shape cannot smear the
  // opener across a whole fight again.
  const measure = (seconds: number) => {
    const fire = SUSTAINED_SEEDS.map((s) => runShortFight('fire', seconds, s));
    const frost = SUSTAINED_SEEDS.map((s) => runShortFight('frost', seconds, s));
    const fireMean = fire.reduce((a, r) => a + r.dps, 0) / fire.length;
    const frostMean = frost.reduce((a, r) => a + r.dps, 0) / frost.length;
    const igniteShare =
      fire.reduce((a, r) => a + (r.byAbility.Ignite ?? 0) / r.damage, 0) / fire.length;
    const ignitePaid = fire.reduce((a, r) => a + r.ignitePaid, 0);
    const igniteBanked = fire.reduce((a, r) => a + r.igniteBanked, 0);
    return { fireMean, frostMean, igniteShare, ignitePaid, igniteBanked };
  };
  const at60 = measure(60);
  const at120 = measure(120);

  it('reports the sustained numbers (owner harness)', () => {
    const fmt = (label: string, m: { fireMean: number; frostMean: number; igniteShare: number }) =>
      `${label}: fire=${m.fireMean.toFixed(1)} frost=${m.frostMean.toFixed(1)} ratio=${(m.fireMean / m.frostMean).toFixed(2)} igniteShare=${(m.igniteShare * 100).toFixed(0)}%`;
    console.log(`\n[fire sustained] ${fmt('60s', at60)} | ${fmt('120s', at120)}`);
    expect(at60.fireMean).toBeGreaterThan(0);
  });

  it(`talented fire sustains within ${SUSTAINED_CEILING}x of talented frost over 60s`, () => {
    expect(at60.fireMean).toBeLessThanOrEqual(at60.frostMean * SUSTAINED_CEILING);
  });

  it(`talented fire sustains within ${SUSTAINED_CEILING}x of talented frost over 120s`, () => {
    expect(at120.fireMean).toBeLessThanOrEqual(at120.frostMean * SUSTAINED_CEILING);
  });

  it('and never falls below frost in PvE (owner ruling: frost is the PvP spec)', () => {
    expect(at120.fireMean).toBeGreaterThanOrEqual(at120.frostMean * SUSTAINED_FLOOR);
    expect(at60.fireMean).toBeGreaterThanOrEqual(at60.frostMean * SUSTAINED_FLOOR);
  });

  it('Ignite pays its stated contract at duration (share stays bounded)', () => {
    expect(at120.igniteShare).toBeLessThanOrEqual(IGNITE_SHARE_CEILING);
    expect(at60.igniteShare).toBeLessThanOrEqual(IGNITE_SHARE_CEILING);
  });

  it('Ignite conservation: the bank pays out once, buffs never double-dip (review P1)', () => {
    // Paid Ignite over the full buffed rotation must not exceed what the
    // crits banked (40% each). Rounding can add fractions of a point per
    // tick, end-of-fight truncation loses the tail, so the healthy reading
    // sits just under 1.0; the pre-fix double-dip read ~1.05-1.2 with Rune
    // and Convergence running. Reuses the 120s runs measured above: re-running
    // sims inside the test body blew the 5s test timeout on loaded CI shards.
    const paid = at120.ignitePaid;
    const banked = at120.igniteBanked;
    console.log(
      `[ignite conservation] paid=${paid} banked=${banked} ratio=${(paid / banked).toFixed(3)}`,
    );
    expect(paid).toBeLessThanOrEqual(banked * 1.02);
    expect(paid).toBeGreaterThanOrEqual(banked * 0.8); // sanity: the burn does flow
  });
});
