// The player MODIFIER vocabulary: a bag of flat adjustments applied to one
// character, plus the accumulator that folds effects into it.
//
// This is what the modifier trees used to feed. The trees are gone (Ragnarok has
// no specialization concept and its skills are a point-buy tree instead), but
// the vocabulary is not modifier-specific and outlived them: the Fiesta augment
// system is built on the same effect shape and the same accumulator, and item
// set bonuses read the same resolved fields. Deleting it with the trees would
// have taken a whole game mode along for no reason.
//
// Nothing here knows what a modifier, a spec, or an allocation is. Everything that
// did stayed behind and was deleted with them.
//
// A pure leaf: no SimContext, no rng, no clock.

import type { AbilityEffect, AuraKind, PlayerClass, ResourceType } from './types';

export type Role = 'tank' | 'healer' | 'dps';

export interface StatModEffect {
  str?: number;
  agi?: number;
  vit?: number;
  int?: number;
  dex?: number;
  luk?: number;
  armor?: number;
  ap?: number;
  crit?: number;
  dodge?: number;
  apPct?: number;
  vitPct?: number;
  armorPct?: number;
  armorFromStrPct?: number;
  maxHpPct?: number;
  strPct?: number;
  agiPct?: number;
  intPct?: number;
  dexPct?: number;
  lukPct?: number;
}

export interface AbilityModEffect {
  ability: string;
  dmgPct?: number;
  dmgPctVsDotted?: number;
  dmgPctVsDottedAbility?: string;
  flatDmg?: number;
  costPct?: number;
  cooldownPct?: number;
  // Flat cooldown ADD in seconds (Snap Polymorph: an instant cast gains a real
  // cooldown). Applied after cooldownPct at the resolve site in classes.ts.
  cooldownFlat?: number;
  castPct?: number;
  buffPct?: number;
  // Ability-scoped critical strike chance ADD (the classic Improved Backstab
  // shape). Reaches the weaponStrike hit table (meleeSwing critBonus) and the
  // directDamage crit roll in effect_dispatch.ts.
  critPct?: number;
  castWhileMoving?: boolean;
  damagePushbackImmune?: boolean;
  bonusCharges?: number;
  addEffects?: AbilityEffect[];
}

export interface GlobalModEffect {
  meleeDmgPct?: number;
  spellDmgPct?: number;
  healPct?: number;
  // Max mana multiplier (e.g. Chronoweave mastery cushion) and out-of-combat
  // mana regen multiplier.
  manaPct?: number;
  manaRegenPct?: number;
  dotDmgPct?: number;
  hotHealPct?: number;
  absorbPct?: number;
  meleeHastePct?: number;
  petDmgPct?: number;
  petDmgSharePct?: number;
  threatPct?: number;
  critDmgSpellPct?: number;
  critDmgPhysPct?: number;
  critDmgHealPct?: number;
  spellHastePct?: number;
  critVsRooted?: number;
  // Thuggery mastery: chance for a landed mainhand auto-attack to trigger one
  // extra swing (the classic Sword Specialization shape; combat/auto_attack.ts).
  // The extra swing never chains into another proc.
  extraAttackPct?: number;
  // Nature's Fury (druid row): spell-crit fraction pulsed to the druid and
  // nearby party members while in Moonwing Form (combat/natures_fury.ts).
  moonwingPartyCritPct?: number;
  autoRagePct?: number;
  abilityRagePct?: number;
  onKillSpeedPct?: number;
  onKillSpeedDuration?: number;
  secondWindPctPerSec?: number;
  battleRhythm?: number;
  bloodbathPct?: number;
  bloodbathDuration?: number;
  bloodbathMaxPct?: number;
  cdrPerRage?: number;
  stanceMastery?: number;
  fearBreakPct?: number;
  masteryTwoHandDmgPct?: number;
  cheatDeathIcd?: number;
  // Mage choice rows (owner tree 2026-07-11):
  // Warded: fraction less damage taken while the caster's own personal barrier
  // (an ice_barrier absorb aura) is up. Folded target-side in combat/damage.ts.
  barrierDrPct?: number;
  // Overflowing Power: seconds shaved off the mage defensive cooldowns per 10%
  // of maximum mana spent, capped at 10 sec per 30 sec (casting_lifecycle's
  // spendAbilityCost, the Colossal Might pattern on mana).
  manaDefCdrPer10?: number;
  // Blink While Casting: 1 when picked; Flickerstep slips through the busy
  // guard without touching the cast in progress (casting_lifecycle).
  blinkCast?: number;
  // Elemental Convergence: 1 when picked; alternating a Fire and a Frost cast
  // opens the surge window (casting_lifecycle convergenceOnCast, marker +
  // ICD carried by auras so no entity field enters the parity hash).
  convergence?: number;
  // Ignition (fire mage mastery): fraction of a spell crit's damage banked as
  // a stacking burn (combat/fire_mage.ts igniteOnCrit copies the resolved
  // amount). Scales with level like every spec mastery.
  ignitionPct?: number;
}

export type ProcTrigger =
  // icd: optional internal cooldown in seconds (talent_procs.ts). While it
  // runs, matching casts/crits are ignored entirely: nothing fires and nothing
  // is banked toward n.
  // chance: optional 0-1 fire probability (the item-set Clearcasting shape).
  // Rolled through the sim Rng only at the moment the proc would otherwise
  // fire, so players without such a proc draw no rng. A failed castNth roll
  // still resets the counter; the icd arms only on a successful fire.
  | { on: 'castNth'; n: number; abilities: string[]; icd?: number; chance?: number }
  | { on: 'spellCrit'; abilities?: string[]; icd?: number; chance?: number }
  | { on: 'shieldConsumed'; ability: string }
  | { on: 'hotExpired'; ability: string }
  | { on: 'bigHitTaken'; hpFrac: number; icd: number }
  | { on: 'meleeSwingWhile'; auraKind: string; icd?: number; chance?: number }
  | { on: 'thornsReflect'; ability: string };

export type ProcResponse =
  | {
      kind: 'empowerNext';
      aura: 'next_cast_free' | 'next_execute_free' | 'next_cast_instant' | 'next_cast_cheap';
      abilities?: string[];
      duration: number;
      costPct?: number;
    }
  | { kind: 'cooldownRefund'; ability: string; seconds: number | 'reset' }
  | { kind: 'resource'; amount: number; resourceType?: ResourceType }
  // The pct-of-max-health variants (phase-2 defensive pass) override the flat
  // number when present. Most scale with the wearer; source scaling is for
  // shields whose proc owner can differ from the protected ally.
  // target: the recipient defaults to the trigger subject (the heal target,
  // the hit-taker, or the triggering cast's target). 'self' pins it to the
  // proc owner instead; REQUIRED for any proc whose triggering casts are
  // hostile (Hellglass Ward), or the response lands on the enemy. Explicit by
  // design: the engine never infers the recipient from hostility.
  | {
      kind: 'heal';
      amount?: number;
      amountPctMaxHp?: number;
      amountPctSourceMaxHp?: number;
      target?: 'self';
    }
  | {
      kind: 'absorb';
      amount?: number;
      amountPctMaxHp?: number;
      duration: number;
      name: string;
      target?: 'self';
    }
  | {
      kind: 'echo';
      belowFrac: number;
      window: number;
      heal?: number;
      healPctMaxHp?: number;
      name: string;
    }
  // A plain self-aura (Deathless Will's escape burst): applied to the proc
  // owner with the def's school; value semantics follow the aura kind (a
  // buff_speed of 1.4 is +40% movement).
  | { kind: 'aura'; auraKind: AuraKind; value: number; duration: number; name: string };

export interface ProcDef {
  id: string;
  name: string;
  school?: 'physical' | 'fire' | 'frost' | 'arcane' | 'shadow' | 'holy' | 'nature';
  trigger: ProcTrigger;
  responses: ProcResponse[];
}

export interface ModifierEffect {
  stats?: StatModEffect;
  grant?: { ability: string; rank?: number };
  proc?: ProcDef;
  ability?: AbilityModEffect[];
  global?: GlobalModEffect;
}

export interface ResolvedAbilityMod {
  dmgPct: number;
  dmgPctVsDotted: number;
  dmgPctVsDottedAbility?: string;
  flatDmg: number;
  costPct: number;
  cooldownPct: number;
  cooldownFlat: number;
  castPct: number;
  buffPct: number;
  critPct: number;
  castWhileMoving: boolean;
  damagePushbackImmune: boolean;
  bonusCharges: number;
  addEffects: AbilityEffect[];
}

export interface PlayerModifiers {
  role: Role | null;
  stats: Required<StatModEffect>;
  abilities: Record<string, ResolvedAbilityMod>;
  global: Required<GlobalModEffect>;
  grants: { ability: string; rank: number }[];
  procs: ProcDef[];
}

function zeroStats(): Required<StatModEffect> {
  return {
    str: 0,
    agi: 0,
    vit: 0,
    int: 0,
    dex: 0,
    luk: 0,
    armor: 0,
    ap: 0,
    crit: 0,
    dodge: 0,
    apPct: 0,
    vitPct: 0,
    armorPct: 0,
    armorFromStrPct: 0,
    maxHpPct: 0,
    strPct: 0,
    agiPct: 0,
    intPct: 0,
    dexPct: 0,
    lukPct: 0,
  };
}

function zeroGlobal(): Required<GlobalModEffect> {
  return {
    meleeDmgPct: 0,
    spellDmgPct: 0,
    healPct: 0,
    manaPct: 0,
    manaRegenPct: 0,
    dotDmgPct: 0,
    hotHealPct: 0,
    absorbPct: 0,
    meleeHastePct: 0,
    petDmgPct: 0,
    petDmgSharePct: 0,
    threatPct: 0,
    critDmgSpellPct: 0,
    critDmgPhysPct: 0,
    critDmgHealPct: 0,
    spellHastePct: 0,
    critVsRooted: 0,
    extraAttackPct: 0,
    moonwingPartyCritPct: 0,
    autoRagePct: 0,
    abilityRagePct: 0,
    onKillSpeedPct: 0,
    onKillSpeedDuration: 0,
    secondWindPctPerSec: 0,
    battleRhythm: 0,
    bloodbathPct: 0,
    bloodbathDuration: 0,
    bloodbathMaxPct: 0,
    cdrPerRage: 0,
    stanceMastery: 0,
    fearBreakPct: 0,
    masteryTwoHandDmgPct: 0,
    cheatDeathIcd: 0,
    barrierDrPct: 0,
    manaDefCdrPer10: 0,
    blinkCast: 0,
    convergence: 0,
    ignitionPct: 0,
  };
}

function zeroAbilityMod(): ResolvedAbilityMod {
  return {
    dmgPct: 0,
    dmgPctVsDotted: 0,
    flatDmg: 0,
    costPct: 0,
    cooldownPct: 0,
    cooldownFlat: 0,
    castPct: 0,
    buffPct: 0,
    critPct: 0,
    castWhileMoving: false,
    damagePushbackImmune: false,
    bonusCharges: 0,
    addEffects: [],
  };
}

export function emptyModifiers(): PlayerModifiers {
  return {
    role: null,
    stats: zeroStats(),
    abilities: {},
    global: zeroGlobal(),
    grants: [],
    procs: [],
  };
}

export function accumulateModifier(
  modifiers: PlayerModifiers,
  effect: ModifierEffect | undefined,
  multiplier = 1,
): void {
  if (!effect) return;
  if (effect.stats) {
    const target = modifiers.stats;
    const source = effect.stats;
    target.str += (source.str ?? 0) * multiplier;
    target.agi += (source.agi ?? 0) * multiplier;
    target.vit += (source.vit ?? 0) * multiplier;
    target.int += (source.int ?? 0) * multiplier;
    target.dex += (source.dex ?? 0) * multiplier;
    target.luk += (source.luk ?? 0) * multiplier;
    target.armor += (source.armor ?? 0) * multiplier;
    target.ap += (source.ap ?? 0) * multiplier;
    target.crit += (source.crit ?? 0) * multiplier;
    target.dodge += (source.dodge ?? 0) * multiplier;
    target.apPct += (source.apPct ?? 0) * multiplier;
    target.vitPct += (source.vitPct ?? 0) * multiplier;
    target.armorPct += (source.armorPct ?? 0) * multiplier;
    target.armorFromStrPct += (source.armorFromStrPct ?? 0) * multiplier;
    target.maxHpPct += (source.maxHpPct ?? 0) * multiplier;
    target.strPct += (source.strPct ?? 0) * multiplier;
    target.agiPct += (source.agiPct ?? 0) * multiplier;
    target.intPct += (source.intPct ?? 0) * multiplier;
    target.dexPct += (source.dexPct ?? 0) * multiplier;
    target.lukPct += (source.lukPct ?? 0) * multiplier;
  }
  if (effect.global) {
    const target = modifiers.global;
    const source = effect.global;
    target.meleeDmgPct += (source.meleeDmgPct ?? 0) * multiplier;
    target.spellDmgPct += (source.spellDmgPct ?? 0) * multiplier;
    target.healPct += (source.healPct ?? 0) * multiplier;
    target.manaPct += (source.manaPct ?? 0) * multiplier;
    target.manaRegenPct += (source.manaRegenPct ?? 0) * multiplier;
    target.dotDmgPct += (source.dotDmgPct ?? 0) * multiplier;
    target.hotHealPct += (source.hotHealPct ?? 0) * multiplier;
    target.absorbPct += (source.absorbPct ?? 0) * multiplier;
    target.meleeHastePct += (source.meleeHastePct ?? 0) * multiplier;
    target.petDmgPct += (source.petDmgPct ?? 0) * multiplier;
    target.petDmgSharePct += (source.petDmgSharePct ?? 0) * multiplier;
    target.threatPct += (source.threatPct ?? 0) * multiplier;
    target.critDmgSpellPct += (source.critDmgSpellPct ?? 0) * multiplier;
    target.critDmgPhysPct += (source.critDmgPhysPct ?? 0) * multiplier;
    target.critDmgHealPct += (source.critDmgHealPct ?? 0) * multiplier;
    target.spellHastePct += (source.spellHastePct ?? 0) * multiplier;
    target.critVsRooted += (source.critVsRooted ?? 0) * multiplier;
    target.extraAttackPct += (source.extraAttackPct ?? 0) * multiplier;
    target.moonwingPartyCritPct += (source.moonwingPartyCritPct ?? 0) * multiplier;
    target.autoRagePct += (source.autoRagePct ?? 0) * multiplier;
    target.abilityRagePct += (source.abilityRagePct ?? 0) * multiplier;
    target.onKillSpeedPct += (source.onKillSpeedPct ?? 0) * multiplier;
    target.onKillSpeedDuration += (source.onKillSpeedDuration ?? 0) * multiplier;
    target.secondWindPctPerSec += (source.secondWindPctPerSec ?? 0) * multiplier;
    target.battleRhythm += (source.battleRhythm ?? 0) * multiplier;
    target.bloodbathPct += (source.bloodbathPct ?? 0) * multiplier;
    target.bloodbathDuration += (source.bloodbathDuration ?? 0) * multiplier;
    target.bloodbathMaxPct += (source.bloodbathMaxPct ?? 0) * multiplier;
    target.cdrPerRage += (source.cdrPerRage ?? 0) * multiplier;
    target.stanceMastery += (source.stanceMastery ?? 0) * multiplier;
    target.fearBreakPct += (source.fearBreakPct ?? 0) * multiplier;
    target.masteryTwoHandDmgPct += (source.masteryTwoHandDmgPct ?? 0) * multiplier;
    target.cheatDeathIcd = Math.max(target.cheatDeathIcd, source.cheatDeathIcd ?? 0);
    target.barrierDrPct += (source.barrierDrPct ?? 0) * multiplier;
    target.manaDefCdrPer10 += (source.manaDefCdrPer10 ?? 0) * multiplier;
    target.blinkCast += (source.blinkCast ?? 0) * multiplier;
    target.convergence += (source.convergence ?? 0) * multiplier;
    target.ignitionPct += (source.ignitionPct ?? 0) * multiplier;
  }
  for (const ability of effect.ability ?? []) {
    const target = modifiers.abilities[ability.ability] ?? zeroAbilityMod();
    modifiers.abilities[ability.ability] = target;
    target.dmgPct += (ability.dmgPct ?? 0) * multiplier;
    target.dmgPctVsDotted += (ability.dmgPctVsDotted ?? 0) * multiplier;
    if (ability.dmgPctVsDottedAbility) {
      target.dmgPctVsDottedAbility = ability.dmgPctVsDottedAbility;
    }
    target.flatDmg += (ability.flatDmg ?? 0) * multiplier;
    target.costPct += (ability.costPct ?? 0) * multiplier;
    target.cooldownPct += (ability.cooldownPct ?? 0) * multiplier;
    target.cooldownFlat += (ability.cooldownFlat ?? 0) * multiplier;
    target.castPct += (ability.castPct ?? 0) * multiplier;
    target.buffPct += (ability.buffPct ?? 0) * multiplier;
    target.critPct += (ability.critPct ?? 0) * multiplier;
    target.bonusCharges += (ability.bonusCharges ?? 0) * multiplier;
    if (ability.castWhileMoving) target.castWhileMoving = true;
    if (ability.damagePushbackImmune) target.damagePushbackImmune = true;
    if (ability.addEffects) target.addEffects.push(...ability.addEffects);
  }
  if (effect.grant) {
    modifiers.grants.push({ ability: effect.grant.ability, rank: effect.grant.rank ?? 1 });
  }
  if (effect.proc) modifiers.procs.push(effect.proc);
}

export const accumulate = accumulateModifier;
