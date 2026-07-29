// Shield-and-parry melee defense folded into the existing one-roll hit tables.
// The class check is deliberate: only the classes that fight behind a shield get
// parry and block, without changing any other class or its RNG order. That is
// the Warrior and, since the conversion, the Knight: the reference gives the
// Knight a spear-and-shield kit and makes it the dedicated tank, so gating this
// on a single class id left it holding a shield that granted nothing.
import type { Entity, PlayerClass } from '../types';
import { angleTo, normAngle, SHIELD_DEFENCE_CLASSES } from '../types';

const WARRIOR_PARRY_BASE = 0.05;
const WARRIOR_PARRY_PER_STRENGTH = 0.0005;
const WARRIOR_FRONT_ARC = Math.PI / 2;

export interface WarriorMeleeDefense {
  parryChance: number;
  blockChance: number;
}

// The Strength-scaled parry chance on its own, so the character sheet can show
// the same number combat rolls against (front-arc gating stays in
// warriorMeleeDefense; the sheet shows the in-arc chance).
export function warriorParryChance(str: number): number {
  return Math.max(0, WARRIOR_PARRY_BASE + str * WARRIOR_PARRY_PER_STRENGTH);
}

export function warriorMeleeDefense(defender: Entity, attacker: Entity): WarriorMeleeDefense {
  if (
    defender.kind !== 'player' ||
    !SHIELD_DEFENCE_CLASSES.has(defender.templateId as PlayerClass)
  ) {
    return { parryChance: 0, blockChance: 0 };
  }
  const inFront =
    Math.abs(normAngle(angleTo(defender.pos, attacker.pos) - defender.facing)) < WARRIOR_FRONT_ARC;
  if (!inFront) return { parryChance: 0, blockChance: 0 };
  return {
    parryChance: warriorParryChance(defender.stats.str),
    blockChance: defender.blockValue > 0 && defender.blockChance > 0 ? defender.blockChance : 0,
  };
}
