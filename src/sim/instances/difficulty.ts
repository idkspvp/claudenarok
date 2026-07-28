import { HEROIC_DUNGEON_TUNING, NORMAL_DUNGEON_TUNING } from '../content/dungeon_difficulty';
import { MOBS } from '../data';
import type { DungeonDifficulty, Entity, MobTemplate } from '../types';

export const HEROIC_DUNGEON_IDS = new Set(Object.keys(HEROIC_DUNGEON_TUNING));

// Every heroic-instance mob moves at least this fast (player RUN_SPEED is 7),
// so heroic pulls cannot be kited on foot; escapes need a sprint cooldown.
export const HEROIC_MIN_MOVE_SPEED = 8;

export function claimDifficultyForDungeon(
  dungeonId: string,
  selected: DungeonDifficulty,
): DungeonDifficulty {
  return selected === 'heroic' && HEROIC_DUNGEON_IDS.has(dungeonId) ? 'heroic' : 'normal';
}

// Boss-summoned add waves (spawnBossAdds passes { summonedAdd: true }) swing
// at the tuning table's addDamageMultiplier, which is LARGER than the trash
// value where a boss summons (summoned adds are non-elite, so landing the
// same per-swing floor needs a bigger factor); everything else, including the
// spawn-list guards flanking a boss, uses the dungeon-wide damageMultiplier
// unless the mob has a damageMultiplierByMob override.
export interface HeroicSpawnRole {
  summonedAdd?: boolean;
}

export function mobTemplateForDungeonDifficulty(
  template: MobTemplate,
  dungeonId: string,
  difficulty: DungeonDifficulty,
  role?: HeroicSpawnRole,
): MobTemplate {
  if (difficulty !== 'heroic') {
    // Normal retunes are per mob (see NORMAL_DUNGEON_TUNING); a dungeon with
    // no record, or a mob with no factor, spawns from the raw base template.
    // NOTE for the next normal-tuning author: a mob absent from the per-mob
    // map still gets the health multiplier here but NO mechanic stamping in
    // applyDungeonMobTuning below, so every mechanic-bearing or healing mob
    // the dungeon can spawn must be listed (the coverage tests in
    // tests/gravewyrm_normal_tuning.test.ts pin this for the Sanctum).
    const normal = NORMAL_DUNGEON_TUNING[dungeonId];
    if (!normal) return template;
    const dmgMult = normal.damageMultiplierByMob[template.id] ?? 1;
    // Scale BOTH shapes: the authored numbers where a monster has them, and the
    // level-scaled fields where it does not. Scaling only the old fields left a
    // dungeon's difficulty tuning silently doing nothing to any monster that had
    // taken its reference statline.
    return {
      ...template,
      ...(template.hp !== undefined && { hp: Math.round(template.hp * normal.healthMultiplier) }),
      ...(template.atk !== undefined && { atk: Math.round(template.atk * dmgMult) }),
      ...(template.atk2 !== undefined && { atk2: Math.round(template.atk2 * dmgMult) }),
      hpBase: template.hpBase * normal.healthMultiplier,
      hpPerLevel: template.hpPerLevel * normal.healthMultiplier,
      dmgBase: template.dmgBase * dmgMult,
      dmgPerLevel: template.dmgPerLevel * dmgMult,
    };
  }
  const tuning = HEROIC_DUNGEON_TUNING[dungeonId];
  if (!tuning) return template;
  const dmgMult =
    tuning.damageMultiplierByMob?.[template.id] ??
    (role?.summonedAdd ? tuning.addDamageMultiplier : tuning.damageMultiplier);
  const hpMult = tuning.healthMultiplierByMob?.[template.id] ?? tuning.healthMultiplier;
  return {
    ...template,
    minLevel: tuning.level,
    maxLevel: tuning.level,
    ...(template.hp !== undefined && { hp: Math.round(template.hp * hpMult) }),
    ...(template.atk !== undefined && { atk: Math.round(template.atk * dmgMult) }),
    ...(template.atk2 !== undefined && { atk2: Math.round(template.atk2 * dmgMult) }),
    ...(template.def !== undefined && {
      def: Math.round(template.def * tuning.armorMultiplier),
    }),
    hpBase: template.hpBase * hpMult,
    hpPerLevel: template.hpPerLevel * hpMult,
    dmgBase: template.dmgBase * dmgMult,
    dmgPerLevel: template.dmgPerLevel * dmgMult,
    armorPerLevel: template.armorPerLevel * tuning.armorMultiplier,
    moveSpeed: Math.max(template.moveSpeed, HEROIC_MIN_MOVE_SPEED),
  };
}

export function mobLevelForDungeonDifficulty(
  dungeonId: string,
  difficulty: DungeonDifficulty,
  rolledLevel: number,
): number {
  if (difficulty !== 'heroic') return rolledLevel;
  return HEROIC_DUNGEON_TUNING[dungeonId]?.level ?? rolledLevel;
}

// Boss/support mechanic numbers (aoePulse, bigCast, stomp damage; mendAlly,
// wardAllies, stoneskin amounts) are read from the base MOBS table at FIRE
// time, not from the spawn-time transformed template, so the template
// multipliers above cannot reach them. Instead a tuned spawn (heroic, or a
// normal dungeon with a NORMAL_DUNGEON_TUNING record) carries these
// per-entity multipliers, applied at each fire site AFTER the rng draw (the
// draw count and order stay identical to an untuned spawn, which the parity
// gate pins). Boss-flagged mobs additionally become CC- and snare-immune on
// heroic (the entity-level twins of the template ccImmune/slowImmune flags,
// which are also base-table reads): heroic bosses can be neither controlled
// nor kited.
export function applyDungeonMobTuning(
  mob: Entity,
  dungeonId: string,
  difficulty: DungeonDifficulty,
  role?: HeroicSpawnRole,
): void {
  if (difficulty !== 'heroic') {
    // Normal retunes: the mob's own melee factor drives its mechanics too, so
    // an aoePulse/stomp keeps pace with the swing it lands between, unless the
    // tuning carries a mechanicDamageMultiplierByMob override (an avoidable
    // telegraphed mechanic priced independently of the tank-swing floor).
    // Heals from support mobs keep pace with the doubled health pool.
    const normal = NORMAL_DUNGEON_TUNING[dungeonId];
    const dmgMult = normal?.damageMultiplierByMob[mob.templateId];
    if (normal && dmgMult !== undefined) {
      mob.mechanicDamageMult = normal.mechanicDamageMultiplierByMob?.[mob.templateId] ?? dmgMult;
      mob.mechanicHealMult = normal.healthMultiplier;
    }
    return;
  }
  const tuning = HEROIC_DUNGEON_TUNING[dungeonId];
  if (!tuning) return;
  mob.mechanicDamageMult =
    tuning.damageMultiplierByMob?.[mob.templateId] ??
    (role?.summonedAdd ? tuning.addDamageMultiplier : tuning.damageMultiplier);
  mob.mechanicHealMult = tuning.healthMultiplier;
  if (MOBS[mob.templateId]?.boss) {
    mob.ccImmune = true;
    mob.slowImmune = true;
  }
  // Heroic-only anti-kite activation: a template that carries `charge` only
  // actually charges when its spawn is stamped here, so normal spawns of the
  // same template never charge (mob/charge.ts gates on the entity flag).
  if (MOBS[mob.templateId]?.charge) mob.chargeEnabled = true;
}
