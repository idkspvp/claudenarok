import { describe, expect, it } from 'vitest';
import {
  aggregateSetBonuses,
  ITEM_SETS,
  SET_BOUNDSTONE_VANGUARD,
  SET_CRIT_3PC_RATING,
  SET_CROWNFORGED,
  SET_DEATHLORD,
  SET_NECROMANCERS,
  SET_SOULFLAME,
  SET_STORMCALLERS,
  SET_WYRMSHADOW,
} from '../src/sim/content/item_sets';
import { ITEMS, MOBS } from '../src/sim/data';
import { createMob, createPlayer, recalcPlayerStats } from '../src/sim/entity';
import { Sim } from '../src/sim/sim';
import { meleeAttack } from '../src/sim/stats/attack';
import type { Entity, PlayerClass } from '../src/sim/types';
import { CAST_PUSHBACK_SEC, CHANNEL_PUSHBACK_FRACTION } from '../src/sim/types';
import { itemSetMemberCounts, itemSetTooltipModel } from '../src/ui/item_set_tooltip_view';
import { spreadAllocation } from './helpers/alloc';
import { fundCasts } from './helpers/sp';

const attrsOf = (e: {
  stats: { str: number; agi: number; vit: number; int: number; dex: number; luk: number };
}) => ({
  str: e.stats.str,
  agi: e.stats.agi,
  vit: e.stats.vit,
  int: e.stats.int,
  dex: e.stats.dex,
  luk: e.stats.luk,
});

const counts = (m: Record<string, number>) => new Map(Object.entries(m));

function statsFor(cls: PlayerClass, level: number, equipment: Record<string, string>): Entity {
  const e = createPlayer(0, cls, { x: 0, y: 0, z: 0 }, '');
  e.level = level;
  // With the class's suggested spread, not bare 1s: a set bonus of +15 Strength
  // read against a base of 1 tells you nothing about whether it landed correctly.
  recalcPlayerStats(e, cls, equipment as any, undefined, {}, spreadAllocation(level));
  return e;
}

const dist2d = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);

describe('heroic set item identity', () => {
  it('shares the normal set id and carries the heroic variant marker', () => {
    // This line uses the auto-generated heroic_<base> variants (heroic_variants.ts),
    // marked via heroicOf, not the PTR-era bespoke <base>_heroic pieces with a
    // standalone heroic flag.
    expect(ITEMS.heroic_crownforged_dreadhelm.set).toBe(ITEMS.crownforged_dreadhelm.set);
    expect(ITEMS.heroic_crownforged_dreadhelm.set).toBe('crownforged');
    expect(ITEMS.heroic_crownforged_dreadhelm.heroicOf).toBe('crownforged_dreadhelm');
  });
});

describe('aggregateSetBonuses (pure resolver)', () => {
  it('grants nothing below the 2-piece threshold', () => {
    const eff = aggregateSetBonuses(counts({ [SET_DEATHLORD]: 1 }));
    expect(eff).toEqual({
      str: 0,
      agi: 0,
      vit: 0,
      int: 0,
      luk: 0,
      ap: 0,
      sp: 0,
      crit: 0,
      critRating: 0,
      haste: 0,
      hasteRating: 0,
      hitRating: 0,
      castPushbackReduction: 0,
      knockbackResistance: 0,
      procs: [],
    });
  });

  it('strength set: 2pc grants AP, 3pc additionally grants str+sta (tiers stack)', () => {
    const two = aggregateSetBonuses(counts({ [SET_DEATHLORD]: 2 }));
    expect(two.ap).toBe(40);
    expect(two.str).toBe(0);
    const three = aggregateSetBonuses(counts({ [SET_DEATHLORD]: 3 }));
    expect(three.ap).toBe(40); // 2pc bonus still active
    expect(three.str).toBe(15);
    expect(three.vit).toBe(15);
  });

  it('agility set: 2pc grants AP, 3pc additionally grants agi+crit', () => {
    const two = aggregateSetBonuses(counts({ [SET_WYRMSHADOW]: 2 }));
    expect(two.ap).toBe(40);
    const three = aggregateSetBonuses(counts({ [SET_WYRMSHADOW]: 3 }));
    expect(three.ap).toBe(40);
    expect(three.agi).toBe(15);
    expect(three.critRating).toBe(SET_CRIT_3PC_RATING);
  });

  it('caster sets: 2pc grants full cast-pushback immunity, 3pc grants tier stats', () => {
    // The caster 2-piece is SPELL pushback immunity (damage taken never delays
    // a cast), never physical knockback resistance.
    const necro = aggregateSetBonuses(counts({ [SET_NECROMANCERS]: 3 }));
    expect(necro.castPushbackReduction).toBe(1);
    expect(necro.int).toBe(10);
    expect(necro.vit).toBe(10);
    expect(necro.luk).toBe(0);
    expect(necro.knockbackResistance).toBe(0);

    const soulflame = aggregateSetBonuses(counts({ [SET_SOULFLAME]: 3 }));
    expect(soulflame.castPushbackReduction).toBe(1);
    expect(soulflame.knockbackResistance).toBe(0);
    expect(soulflame.int).toBe(15);
    expect(soulflame.luk).toBe(15);
    expect(soulflame.vit).toBe(0);

    const stormcallers = aggregateSetBonuses(counts({ [SET_STORMCALLERS]: 3 }));
    expect(stormcallers.castPushbackReduction).toBe(1);
    expect(stormcallers.knockbackResistance).toBe(0);
    expect(stormcallers.int).toBe(15);
    expect(stormcallers.luk).toBe(15);
    expect(stormcallers.vit).toBe(0);
  });

  it('pushback reduction max-combines across met tiers and clamps to 0..1', () => {
    const twoCasterSets = aggregateSetBonuses(
      counts({ [SET_NECROMANCERS]: 2, [SET_SOULFLAME]: 2 }),
    );
    expect(twoCasterSets.castPushbackReduction).toBe(1);

    const clampSetId = '__test_knockback_clamp';
    ITEM_SETS[clampSetId] = {
      id: clampSetId,
      name: 'Clamp Test Set',
      bonuses: [
        {
          pieces: 2,
          effect: { castPushbackReduction: 2, knockbackResistance: 2 },
          text: 'Clamp test.',
        },
      ],
    };
    try {
      const clamped = aggregateSetBonuses(counts({ [clampSetId]: 2 }));
      expect(clamped.castPushbackReduction).toBe(1);
      expect(clamped.knockbackResistance).toBe(1);
    } finally {
      delete ITEM_SETS[clampSetId];
    }
  });

  it('every set definition lists ascending tiers ending at its authored cap', () => {
    for (const set of Object.values(ITEM_SETS)) {
      const pieces = set.bonuses.map((b) => b.pieces);
      // every epic (raid/dungeon) family carries 2-, 3-, and 4-piece tiers (the
      // 4-piece is a proc); the leveling haste kits deliberately carry the
      // single 3-piece tier.
      const expected = pieces.length === 1 ? '3' : '2,3,4';
      expect([pieces.join(','), set.id]).toEqual([expected, set.id]);
    }
  });
});

describe('item set tooltip model', () => {
  it('counts each set as its distinct equip slots (base + all heroic versions are one piece)', () => {
    const counts = itemSetMemberCounts();
    // The t2 sets are 5 slots (soulflame cloth is 4). The normal piece, its
    // auto-generated heroic variant, and any bespoke heroic raid piece for the
    // same slot all collapse to one member, so the "X/N" denominator reflects the
    // real number of collectible pieces (not the parallel heroic-variant ids).
    expect(counts.crownforged).toBe(4);
    expect(counts.nighttalon).toBe(4);
    expect(counts.soulflame).toBe(4);
    expect(counts.stormcallers).toBe(4);
    // Leveling haste kits: 3 pieces each.
    expect(counts.vale_arcanist).toBe(3);
    expect(counts.boundstone_vanguard).toBe(3);
    expect(counts.greyjaw_stalker).toBe(3);
  });

  it('keeps four-piece families at four and the Boundstone family at three', () => {
    const memberCounts = itemSetMemberCounts();
    expect({
      [SET_DEATHLORD]: memberCounts[SET_DEATHLORD],
      [SET_BOUNDSTONE_VANGUARD]: memberCounts[SET_BOUNDSTONE_VANGUARD],
    }).toEqual({
      [SET_DEATHLORD]: 4,
      [SET_BOUNDSTONE_VANGUARD]: 3,
    });
  });

  it('uses the authored member count, not the highest bonus threshold, as the header total', () => {
    const model = itemSetTooltipModel({
      itemSetId: SET_DEATHLORD,
      equippedPieces: 2,
      itemSetMembers: {
        [SET_DEATHLORD]: 4,
      },
    });
    expect(model?.totalPieces).toBe(4);
    expect(model?.bonusTiers.map((tier) => tier.pieces)).toEqual([2, 3, 4]);
  });

  it('hides bonus tiers that cannot be reached by the currently authored set pieces', () => {
    const model = itemSetTooltipModel({
      itemSetId: SET_CROWNFORGED,
      equippedPieces: 2,
      itemSetMembers: {
        [SET_CROWNFORGED]: 2,
      },
    });
    expect(model?.totalPieces).toBe(2);
    expect(model?.bonusTiers.map((tier) => tier.pieces)).toEqual([2]);
  });
});

describe('recalcPlayerStats applies equipped set bonuses (real raid/dungeon gear)', () => {
  it('Deathlord (t1 strength): flat AP at 2pc, str/sta added at 3pc', () => {
    const base = statsFor('swordman', 20, {});
    // 2 pieces: +40 AP, no set str yet. The flat bonus rides the formula's
    // (1 + DEX/200) amplifier rather than being added outside it, so it is worth
    // at least its face value and more to a Dexterity build.
    const two = statsFor('swordman', 20, {
      chest: 'deathlord_warplate',
      legs: 'deathlord_legguards',
    });
    const apWithFlat = (e: Entity, flatAtk: number) =>
      Math.round(meleeAttack({ level: e.level, attributes: attrsOf(e), flatAtk }));
    expect(two.attackPower).toBe(apWithFlat(two, 40));
    expect(two.attackPower).toBeGreaterThanOrEqual(apWithFlat(two, 0) + 40);
    // 3 pieces: set adds +15 str / +15 sta on top of the item stats.
    const three = statsFor('swordman', 20, {
      chest: 'deathlord_warplate',
      legs: 'deathlord_legguards',
      feet: 'deathlord_sabatons',
    });
    // Off the records: ordinary armour grants no attributes under the equipment
    // rule, so these transcribed per-piece figures went stale. The claim, that
    // the 3-piece bonus adds 15 Strength ON TOP of whatever the pieces carry, is
    // what the case is for and it survives.
    const itemStr = ['deathlord_warplate', 'deathlord_legguards', 'deathlord_sabatons'].reduce(
      (sum, id) => sum + (ITEMS[id].stats?.str ?? 0),
      0,
    );
    expect(three.stats.str).toBe(base.stats.str + itemStr + 15);
    expect(three.attackPower).toBe(apWithFlat(three, 40));
  });

  it('Wyrmshadow (t1 agility): crit gains 1% at 3pc on top of agi-derived crit', () => {
    const three = statsFor('thief', 20, {
      chest: 'wyrmshadow_harness',
      feet: 'wyrmshadow_treads',
      legs: 'wyrmshadow_legguards',
    });
    // Crit is LUK's now, off a 1% base; the set's flat +1% rides on top of it.
    expect(three.critChance).toBeCloseTo(0.01 + three.stats.luk * 0.003 + 0.01);
  });

  it('Crownforged (t2 strength, 4 pieces): the 4-set Hit bonus lands on the equipped hitRating', () => {
    // End-to-end (not just the pure set-bonus resolver): the +60 four-set Hit rides
    // through recalcPlayerStats onto e.hitRating, on top of the 20 + 20 the helm and
    // shoulder carry. Drop the `+ setEff.hitRating` term and this reds.
    const four = statsFor('swordman', 20, {
      helmet: 'crownforged_dreadhelm',
      back: 'crownforged_warspaulders',
      ring1: 'crownforged_gauntlets',
      ring2: 'crownforged_girdle',
    });
    expect(four.hitRating).toBe(20 + 20 + 60);
  });

  it('Nighttalon (t2 agility, 2 pieces): reaches the 2-piece +40 AP bonus', () => {
    const base = statsFor('thief', 20, {});
    const two = statsFor('thief', 20, {
      helmet: 'nighttalon_crown',
      back: 'nighttalon_shoulderguards',
    });
    // The only set bonus at 2pc is +40 flat attack. It enters INSIDE the
    // formula, amplified by (1 + DEX/200), so the difference it makes is at
    // least 40 rather than exactly 40. Agility feeds evasion now, not melee
    // attack, so it is deliberately absent either way.
    expect(two.attackPower).toBe(
      Math.round(meleeAttack({ level: two.level, attributes: attrsOf(two), flatAtk: 40 })),
    );
    expect(
      two.attackPower - Math.round(meleeAttack({ level: two.level, attributes: attrsOf(two) })),
    ).toBeGreaterThanOrEqual(40);
    expect(two.attackPower).toBeGreaterThan(base.attackPower);
  });

  it('normal and heroic Nythraxis armor pieces mix for set thresholds', () => {
    // A heroic helmet variant counts as the same set slot as its normal base, so
    // mixing it with three normal pieces still reaches the 3-piece Wraithfire
    // threshold (int +15, spi +15). Derive the expected primary totals from the
    // live item defs so the heroic-variant stat rescale stays the source of truth.
    const worn = {
      helmet: 'heroic_soulflame_cowl', // heroic helmet mixed with normal pieces
      back: 'soulflame_mantle',
      ring1: 'soulflame_gloves',
      ring2: 'soulflame_cord',
    };
    // Level 30, not 20: the heroic cowl derives a level-27 requirement from its
    // heroic-dungeon source, and below that recalc treats it as inert. That gate
    // used to be invisible because clampLevel squashed every requirement to the
    // level-20 cap; raising the cap to 99 let the real number through.
    const base = statsFor('mage', 30, {});
    const mixed = statsFor('mage', 30, worn);
    const pieceInt = Object.values(worn).reduce((s, id) => s + (ITEMS[id].stats?.int ?? 0), 0);
    const pieceSpi = Object.values(worn).reduce((s, id) => s + (ITEMS[id].stats?.luk ?? 0), 0);
    expect(mixed.castPushbackReduction).toBe(1);
    expect(mixed.stats.int).toBe(base.stats.int + pieceInt + 15); // +15 = 3pc Wraithfire int
    expect(mixed.stats.luk).toBe(base.stats.luk + pieceSpi + 15); // +15 = 3pc Wraithfire spi
  });

  it("Necromancer's (t1 caster): cast-pushback immunity at 2pc, int/sta added at 3pc", () => {
    const base = statsFor('mage', 20, {});
    expect(statsFor('mage', 20, {}).castPushbackReduction).toBe(0);
    const two = statsFor('mage', 20, {
      chest: 'necromancers_starshroud',
      feet: 'necromancers_soulsteps',
    });
    expect(two.castPushbackReduction).toBe(1);
    expect(two.knockbackResistance).toBe(0);

    const three = statsFor('mage', 20, {
      chest: 'necromancers_starshroud',
      feet: 'necromancers_soulsteps',
      legs: 'necromancers_legwraps',
    });
    expect(three.castPushbackReduction).toBe(1);
    expect(three.knockbackResistance).toBe(0);
    const necroInt = [
      'necromancers_starshroud',
      'necromancers_soulsteps',
      'necromancers_legwraps',
    ].reduce((sum, id) => sum + (ITEMS[id].stats?.int ?? 0), 0);
    expect(three.stats.int).toBe(base.stats.int + necroInt + 10);
    expect(three.stats.vit).toBe(base.stats.vit + 10);
  });

  it('Soulflame and Stormcaller (t2 caster): int/spi added at 3pc', () => {
    const mageBase = statsFor('mage', 20, {});
    const soulflame = statsFor('mage', 20, {
      helmet: 'soulflame_cowl',
      back: 'soulflame_mantle',
      ring1: 'soulflame_gloves',
    });
    expect(soulflame.castPushbackReduction).toBe(1);
    // Off the records: the pieces' own Intellect moved with the equipment rule,
    // and what this case is for is that the 3-piece bonus adds 15 on top.
    const soulflameInt = ['soulflame_cowl', 'soulflame_mantle', 'soulflame_gloves'].reduce(
      (sum, id) => sum + (ITEMS[id].stats?.int ?? 0),
      0,
    );
    expect(soulflame.stats.int).toBe(mageBase.stats.int + soulflameInt + 15);
    expect(soulflame.stats.luk).toBe(mageBase.stats.luk + 15);

    const shamanBase = statsFor('acolyte', 20, {});
    const stormcallers = statsFor('acolyte', 20, {
      helmet: 'stormcallers_crown',
      back: 'stormcallers_spaulders',
      ring1: 'stormcallers_handguards',
    });
    expect(stormcallers.castPushbackReduction).toBe(1);
    const stormInt = [
      'stormcallers_crown',
      'stormcallers_spaulders',
      'stormcallers_handguards',
    ].reduce((sum, id) => sum + (ITEMS[id].stats?.int ?? 0), 0);
    expect(stormcallers.stats.int).toBe(shamanBase.stats.int + stormInt + 15);
    expect(stormcallers.stats.luk).toBe(shamanBase.stats.luk + 15);
  });
});

describe('pushbackCast honors castPushbackReduction', () => {
  const sim = new Sim({ seed: 1, playerClass: 'mage' });
  const pushback = (reduction: number, channeling: boolean): Entity => {
    const p = sim.player;
    p.channeling = channeling;
    p.castTotal = 3;
    p.castRemaining = 1.5;
    // Set directly to cover the partial-reduction curve; the caster 2-piece
    // grants the full 1 (see the end-to-end suite below).
    p.castPushbackReduction = reduction;
    (sim as any).pushbackCast(p);
    return p;
  };

  it('full pushback with no reduction (cast delayed by CAST_PUSHBACK_SEC)', () => {
    expect(pushback(0, false).castRemaining).toBeCloseTo(1.5 + CAST_PUSHBACK_SEC);
  });

  it('half pushback at 50% reduction', () => {
    expect(pushback(0.5, false).castRemaining).toBeCloseTo(1.5 + CAST_PUSHBACK_SEC * 0.5);
  });

  it('immune at 100% reduction (cast untouched)', () => {
    expect(pushback(1, false).castRemaining).toBe(1.5);
  });

  it('scales channel pushback too', () => {
    const full = pushback(0, true).castRemaining;
    expect(full).toBeCloseTo(1.5 - 3 * CHANNEL_PUSHBACK_FRACTION);
    expect(pushback(1, true).castRemaining).toBe(1.5); // immune channel
  });
});

describe('caster 2-piece: damage never delays a cast (end to end)', () => {
  // Runs the REAL inbound path: dealDamage's spell-pushback block fires
  // ctx.pushbackCast on every landed hit against a casting target, and the
  // 2-piece Mournweave castPushbackReduction of 1 makes it a no-op.
  const castThenHit = (equipSet: boolean) => {
    const sim = new Sim({ seed: 77, playerClass: 'mage' });
    sim.setPlayerLevel(20);
    if (equipSet) {
      for (const id of ['necromancers_starshroud', 'necromancers_soulsteps']) {
        sim.addItem(id, 1);
        sim.equipItem(id);
      }
    }
    const p = sim.player;
    expect(p.castPushbackReduction).toBe(equipSet ? 1 : 0);
    const mob = [...sim.entities.values()].find((e) => e.kind === 'mob' && !e.dead)!;
    mob.pos = { x: p.pos.x + 5, y: p.pos.y, z: p.pos.z };
    mob.prevPos = { ...mob.pos };
    (sim as any).rebucket(mob);
    sim.targetEntity(mob.id);
    fundCasts(p);
    sim.castAbility('fireball');
    expect(p.castingAbility).toBe('fireball');
    const rem0 = p.castRemaining;
    (sim as any).dealDamage(mob, p, 10, false, 'physical', 'Claw', 'hit', true);
    return { p, rem0 };
  };

  it('with 2 Mournweave pieces the cast timer is untouched by a landed hit', () => {
    const { p, rem0 } = castThenHit(true);
    expect(p.castingAbility).toBe('fireball'); // still casting
    expect(p.castRemaining).toBe(rem0); // and not delayed at all
  });

  it('without the set the same hit delays the cast (control)', () => {
    const { p, rem0 } = castThenHit(false);
    expect(p.castRemaining).toBeCloseTo(rem0 + CAST_PUSHBACK_SEC, 9);
  });
});

describe('knockback resistance (the aggregate stat, set synthetically)', () => {
  it('prevents a forced mob knockback from displacing the player', () => {
    // No shipped set grants knockbackResistance anymore (the caster 2-piece is
    // cast-pushback immunity); this pins the engine mechanic behind the stat.
    const sim = new Sim({ seed: 5150, playerClass: 'mage' });
    const p = sim.entities.get(sim.playerId)!;
    p.maxHp = 100000;
    p.hp = 100000;
    p.dodgeChance = 0;
    p.knockbackResistance = 1;
    p.pos.x = 2;
    p.pos.z = 0;
    p.pos.y = 0;

    const tmpl = MOBS.marrowlord_varkas;
    const saved = tmpl.knockback!.chance;
    tmpl.knockback!.chance = 1;
    try {
      const mob = createMob(900704, tmpl, p.level, { x: 0, y: 0, z: 0 });
      const startGap = dist2d(p.pos, mob.pos);
      let sawDamage = false;
      for (let i = 0; i < 80 && !sawDamage; i++) {
        const beforeHp = p.hp;
        (sim as any).mobSwing(mob, p);
        sawDamage = p.hp < beforeHp;
        p.hp = p.maxHp;
      }
      expect(sawDamage).toBe(true);
      expect(dist2d(p.pos, mob.pos)).toBe(startGap);
      expect(p.pos.x).toBe(2);
    } finally {
      tmpl.knockback!.chance = saved;
    }
  });
});
