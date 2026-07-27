import { critRateFrom } from './combat/crit';
import { fleeRating, hitRating, perfectDodgeChance } from './combat/hit_flee';
import { BATTLE_STANCE, buildStanceAura } from './combat/warrior_stances';
import { resolveActiveWeaponSkin } from './content/weapon_skin_rules';
import { aggregateSetBonuses, CLASSES, ITEMS, MOBS, type NpcDef } from './data';
import { canDualWield, isShieldItem } from './equipment_rules';
import { meetsLevelRequirement } from './item_level_req';
import type { PlayerModifiers } from './player_modifiers';
import { pvpFractionsFromRatings } from './pvp';
import type {
  Entity,
  EquipSlot,
  ItemInstancePayload,
  MobTemplate,
  PlayerClass,
  Stats,
  Vec3,
} from './types';
import {
  ALL_EQUIP_SLOTS,
  AVATAR_SCALE,
  BASE_STAT,
  BERSERKER_CRIT_CHANCE,
  cloneItemInstancePayload,
  critFractionFromRating,
  ENRAGE_HASTE_PCT,
  emptyStatAllocation,
  hasteFractionFromRating,
  hitFractionFromRating,
  SHIELD_BLOCK_BASE,
  STATUS_STATS,
  type StatAllocation,
} from './types';

function baseEntity(id: number, pos: Vec3): Entity {
  return {
    id,
    kind: 'mob',
    templateId: '',
    name: '',
    level: 1,
    pos: { ...pos },
    prevPos: { ...pos },
    facing: 0,
    prevFacing: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    onGround: true,
    jumping: false,
    fallStartY: pos.y,
    hp: 1,
    maxHp: 1,
    resource: 0,
    maxResource: 0,
    resourceType: null,
    overheadEmoteId: null,
    overheadEmoteUntil: 0,
    overheadEmoteSeq: 0,
    stats: {
      str: 0,
      agi: 0,
      vit: 0,
      int: 0,
      dex: 0,
      luk: 0,
      armor: 0,
      pvpOffense: 0,
      pvpDefense: 0,
    },
    weapon: { min: 1, max: 2, speed: 2 },
    offhandWeapon: null,
    attackPower: 0,
    rangedPower: 0,
    spellPower: 0,
    meleeHaste: 0,
    rangedHaste: 0,
    spellHaste: 0,
    setProcs: [],
    procReadyAt: undefined as unknown as Record<string, number>,
    critChance: 0.05,
    sharedCritBonus: 0,
    critRating: 0,
    hasteRating: 0,
    hitRating: 0,
    hitBonus: 0,
    critDmgSpellBonus: 0,
    critDmgPhysBonus: 0,
    critDmgHealBonus: 0,
    hit: 0,
    flee: 0,
    dodgeChance: 0.05,
    blockChance: 0,
    blockValue: 0,
    castPushbackReduction: 0,
    knockbackResistance: 0,
    moveSpeed: 7,
    hostile: false,
    targetId: null,
    autoAttack: false,
    swingTimer: 0,
    offhandSwingTimer: 0,
    dualWielding: false,
    titansGrip: false,
    inCombat: false,
    combatTimer: 99,
    auras: [],
    stealthed: false,
    ccDr: new Map(),
    castingAbility: null,
    castRemaining: 0,
    castTotal: 0,
    castTargetId: null,
    castAim: null,
    gatherCastNodeId: '',
    fishBiteAtTick: 0,
    fishReelDeadlineTick: 0,
    channeling: false,
    channelTickTimer: 0,
    channelTickEvery: 0,
    channelTicksLeft: 0,
    gcdRemaining: 0,
    cooldowns: new Map(),
    queuedOnSwing: null,
    queuedCastAbility: null,
    queuedCastAim: null,
    fiveSecondRule: 99,
    comboPoints: 0,
    comboUntil: -1,
    overpowerUntil: -1,
    potionCooldownUntil: -1,
    potionCdRemaining: 0,
    savedMana: 0,
    chargeTargetId: null,
    chargeTimeLeft: 0,
    chargePath: [],
    followTargetId: null,
    sitting: false,
    eating: null,
    drinking: null,
    weaponStowed: false,
    afk: false,
    aiState: 'idle',
    tappedById: null,
    pulseTimer: 0,
    stompTimer: 0,
    bigCastTimer: 0,
    infernoTimer: 0,
    infernoRemaining: 0,
    infernoPulsesFired: 0,
    infernoGatesFired: 0,
    yelledEngage: false,
    stoneskinTimer: 0,
    terrifyTimer: 0,
    aoeSlowTimer: 0,
    loudYellTimer: 0,
    loudYellIndex: 0,
    detonateTimer: Infinity,
    mendTimer: 0,
    wardTimer: 0,
    channelTimer: 0,
    channelRamp: 0,
    rallyTimer: 0,
    warcryTimer: 0,
    firedSummons: 0,
    summonedIds: [],
    enraged: false,
    healedThisPull: false,
    threat: new Map(),
    bossDamagers: new Set(),
    forcedTargetId: null,
    forcedTargetTimer: 0,
    shuffleTargetTimer: 0,
    ownerId: null,
    petMode: 'defensive',
    petTauntTimer: 0,
    petPath: [],
    petPathCooldown: 0,
    spawnPos: { ...pos },
    leashAnchor: null,
    evadeStall: 0,
    fleeTimer: 0,
    fleeReturnTimer: 0,
    hasFled: false,
    wanderTarget: null,
    wanderTimer: 0,
    aggroTargetId: null,
    respawnTimer: 0,
    corpseTimer: 0,
    lootFfaTimer: Infinity, // no FFA countdown until rollLoot starts it at death
    harvestClaimedBy: null,
    lootable: false,
    loot: null,
    xpValue: 0,
    questIds: [],
    vendorItems: [],
    objectItemId: null,
    dungeonId: null,
    dead: false,
    ghost: false,
    corpsePos: null,
    corpseInstanceId: null,
    scale: 1,
    color: 0xffffff,
    skinCatalog: 'class',
    skin: 0,
    mainhandItemId: null,
    offhandItemId: null,
    weaponSkinLoadout: {},
    weaponSkinId: null,
    equippedItems: {},
    equippedInstances: {},
    guild: '',
    title: null,
  };
}

export function createPlayer(id: number, cls: PlayerClass, pos: Vec3, name: string): Entity {
  const def = CLASSES[cls];
  const e = baseEntity(id, pos);
  e.kind = 'player';
  e.templateId = cls;
  e.name = name;
  e.level = 1;
  // A player is Demi-Human, Neutral, and Medium in Ragnarok, which is why a
  // demi-human card is the one every player fears in PvP and why no weapon class
  // is sharply better against another player.
  e.race = 'demihuman';
  e.element = 'neutral';
  e.elementLevel = 1;
  e.size = 'medium';
  e.resourceType = def.resourceType;
  e.color = def.color;
  // Warriors begin in the spec-agnostic default. The tick reconciliation moves
  // Fury to Berserker Stance after a spec is committed.
  if (cls === 'warrior') {
    const stance = buildStanceAura(BATTLE_STANCE, id);
    if (stance) e.auras.push(stance);
  }
  return e;
}

export type PlayerEquipment = Partial<Record<EquipSlot, string>>;

// Ragnarok's stat derivations. These replace the old flat-per-point rules, which
// were tuned against a 10-to-60 stat scale and became nonsense against 1-to-99.
//
// The shapes below are Ragnarok's, taken from the documented pre-renewal status
// formulas and written here in our own terms:
//
//   ATK   = STR + floor(STR/10)^2 + floor(DEX/5) + floor(LUK/5)   (melee)
//   ATK   = DEX + floor(DEX/10)^2 + floor(STR/5) + floor(LUK/5)   (bows)
//   MATK  = INT + floor(INT/7)^2 .. INT + floor(INT/5)^2          (a range)
//   HP    = class pool x (1 + VIT/100)
//   SP    = class pool x (1 + INT/100)
//   CRIT  = 1% + LUK x 0.3%
//   DEF   = floor(VIT/2) soft defence on top of gear armour
//
// The squared terms are the point: they are why a build that commits to one
// attribute beats one that spreads, and why the last ten points of a 99 are
// worth more than the first ten. A linear rule cannot express that.
//
// Everything is floored at 0 so a draining debuff can never invert a pool.

/** Status ATK for a melee weapon: STR leads and carries the squared term, with
 *  DEX and LUK contributing a fifth of their value each. */
export function statusAttackPower(str: number, dex: number, luk: number): number {
  const s = Math.max(0, str);
  return (
    s +
    Math.floor(s / 10) ** 2 +
    Math.floor(Math.max(0, dex) / 5) +
    Math.floor(Math.max(0, luk) / 5)
  );
}

/** Status ATK for a bow. The same shape with DEX and STR swapped: DEX leads and
 *  takes the squared term, STR drops to a fifth. Passing DEX in twice, which is
 *  what a careless reuse of the melee helper does, silently pays a bow user for
 *  DEX a second time instead of for their STR. */
export function statusRangedAttackPower(str: number, dex: number, luk: number): number {
  const d = Math.max(0, dex);
  return (
    d +
    Math.floor(d / 10) ** 2 +
    Math.floor(Math.max(0, str) / 5) +
    Math.floor(Math.max(0, luk) / 5)
  );
}

/** Status MATK is a RANGE in Ragnarok, not a number: the two ends use different
 *  divisors, and a cast rolls between them. This engine's spellPower is a single
 *  value, so it carries the MIDPOINT, the average of the two ends, rather than
 *  silently picking the low one and making INT read weaker than it is. */
export function statusMagicPower(int: number): number {
  const i = Math.max(0, int);
  const min = i + Math.floor(i / 7) ** 2;
  const max = i + Math.floor(i / 5) ** 2;
  return Math.round((min + max) / 2);
}

/** The VIT multiplier on the class HP pool (1.0 at VIT 0, 1.99 at VIT 99). */
export function vitHealthMultiplier(vit: number): number {
  return 1 + Math.max(0, vit) / 100;
}

/** The INT multiplier on the class SP pool. */
export function intManaMultiplier(int: number): number {
  return 1 + Math.max(0, int) / 100;
}

/** Soft defence from VIT, added to gear armour. */
export function vitSoftDefence(vit: number): number {
  return Math.floor(Math.max(0, vit) / 2);
}

export function pctValue(value: number): number {
  return value > 1 ? value / 100 : value;
}

// Recompute all derived stats for the player from class, level, gear, buffs, and
// precomputed talent modifiers. `mods` is the flat struct resolved at
// allocation/respec time (computeTalentModifiers); this never walks the tree.
export function recalcPlayerStats(
  e: Entity,
  cls: PlayerClass,
  equipment: PlayerEquipment,
  mods: PlayerModifiers | undefined,
  equipmentInstance: Partial<Record<EquipSlot, ItemInstancePayload>>,
  // Required, deliberately not defaulted. Every attribute a character has comes
  // from here now, so a caller that forgets it does not get a small inaccuracy:
  // it gets a character with 1 in all six. Making it required turns that into a
  // compile error instead of a silently gutted stat block.
  alloc: StatAllocation,
): void {
  const def = CLASSES[cls];
  const lvl = e.level;
  // Base 1 in each of the six, plus whatever the player has spent. Level itself
  // adds nothing: it buys POINTS, and the points are the growth. This is the
  // whole reason the nine per-class stat blocks are gone.
  const s: Stats = {
    str: BASE_STAT + alloc.str,
    agi: BASE_STAT + alloc.agi,
    vit: BASE_STAT + alloc.vit,
    int: BASE_STAT + alloc.int,
    dex: BASE_STAT + alloc.dex,
    luk: BASE_STAT + alloc.luk,
    armor: 0,
    pvpOffense: 0,
    pvpDefense: 0,
  };
  const setCounts = new Map<string, number>();
  let bonusSp = 0; // flat Spell Power from gear affixes + buff_spellpower auras
  let bonusCritRating = 0;
  let bonusHasteRating = 0;
  let bonusHitRating = 0;
  let bonusPvpOffenseRating = 0;
  let bonusPvpDefenseRating = 0;
  for (const slot of ALL_EQUIP_SLOTS) {
    const itemId = equipment[slot];
    if (!itemId) continue;
    const item = ITEMS[itemId];
    if (!item) continue;
    // Gear above the wearer's level is inert: it stays equipped (still rendered
    // and occupying the slot, see the render mirrors below) but grants no stats,
    // armor, spell power, or set pieces until the character reaches its required
    // level. This only arises for a character loaded wearing gear equipped before
    // the level gate existed; the equip path blocks equipping over-level gear.
    if (!meetsLevelRequirement(lvl, item)) continue;
    if (item.set) setCounts.set(item.set, (setCounts.get(item.set) ?? 0) + 1);
    bonusSp += item.spellPower ?? 0;
    bonusCritRating += item.critRating ?? 0;
    bonusHasteRating += item.hasteRating ?? 0;
    bonusHitRating += item.hitRating ?? 0;
    bonusPvpOffenseRating += item.pvpOffenseRating ?? 0;
    bonusPvpDefenseRating += item.pvpDefenseRating ?? 0;
    if (item.stats) {
      s.str += item.stats.str ?? 0;
      s.agi += item.stats.agi ?? 0;
      s.vit += item.stats.vit ?? 0;
      s.int += item.stats.int ?? 0;
      s.luk += item.stats.luk ?? 0;
      s.armor += item.stats.armor ?? 0;
    }
    // Instance stat bonus: additive on top of the item's own base stats, from
    // this specific instance's rolled.stats: an enchant's bonus
    // (src/sim/professions/enchanting.ts applyEnchant), a masterwork
    // copy's baked tier-delta bonus (src/sim/professions/masterwork.ts), or
    // both merged. The equip path carries the consumed inventory instance into
    // equipmentInstance (items.ts equipItem), so either applies on equip. A
    // plain piece has no entry here, so this is a no-op for the common case.
    const enchantStats = equipmentInstance?.[slot]?.rolled?.stats;
    if (enchantStats) {
      s.str += enchantStats.str ?? 0;
      s.agi += enchantStats.agi ?? 0;
      s.vit += enchantStats.vit ?? 0;
      s.int += enchantStats.int ?? 0;
      s.luk += enchantStats.luk ?? 0;
      s.armor += enchantStats.armor ?? 0;
    }
  }
  // Item-set bonuses from equipped pieces. Flat primary stats join the gear
  // totals so they feed every derivation below; AP/crit/pushback fold in at
  // their own steps (bonusAp, critChance, castPushbackReduction, knockbackResistance).
  const setEff = aggregateSetBonuses(setCounts);
  s.str += setEff.str;
  s.agi += setEff.agi;
  s.vit += setEff.vit;
  s.int += setEff.int;
  s.luk += setEff.luk;
  bonusSp += setEff.sp; // caster set 2-piece spell power (mirrors setEff.ap for melee)
  // Buff auras
  let bonusAp = setEff.ap;
  let bonusDodge = 0;
  // Flat FLEE granted or drained by auras. Separate from bonusDodge because the
  // two are different mechanics now: a stagger knocks you off balance (evasion,
  // contested against the attacker's accuracy), while a dodge grant is the flat
  // slice Luck owns. Folding them together would let an accuracy build shrug off
  // a stagger, which is exactly backwards.
  let bonusFlee = 0;
  let bonusCrit = 0;
  let bonusHaste = 0;
  let bearForm = false;
  let catForm = false;
  let moonkinForm = false;
  let scaleMul = 1; // Fiesta buff_scale: body-size multiplier (>1 also adds hp)
  // Percent raid buffs (Mark of the Wild / Arcane Intellect / Power Word: Fortitude /
  // Devotion Aura / Battle Shout / Blessing of Might). Accumulated as fractions here,
  // then folded multiplicatively at the relevant derivation step below.
  let allStatsPct = 0;
  let intPct = 0;
  let vitPct = 0;
  let buffArmorPct = 0;
  let buffApPct = 0;
  let maxHpPctAura = 0;
  for (const a of e.auras) {
    if (a.kind === 'buff_ap') bonusAp += a.value;
    // Attack-power debuff (Demoralizing Shout/Roar). Mobs fold this live in
    // effectiveAttackPower; players bake it here, so without this arm the debuff
    // was a no-op versus enemy players (PvP).
    else if (a.kind === 'debuff_ap') bonusAp -= a.value;
    else if (a.kind === 'buff_armor') s.armor += a.value;
    else if (a.kind === 'buff_int') s.int += a.value;
    else if (a.kind === 'buff_agi') s.agi += a.value;
    else if (a.kind === 'buff_spi') s.luk += a.value;
    else if (a.kind === 'buff_sta') s.vit += a.value;
    else if (a.kind === 'buff_allstats') {
      s.str += a.value;
      s.agi += a.value;
      s.vit += a.value;
      s.int += a.value;
      s.luk += a.value;
    } else if (a.kind === 'buff_spellpower') bonusSp += a.value;
    else if (a.kind === 'buff_crit' || a.kind === 'buff_reckless' || a.kind === 'bloodbath')
      bonusCrit += a.value;
    else if (a.kind === 'die_by_sword') bonusDodge += a.value;
    else if (a.kind === 'enrage') bonusHaste += ENRAGE_HASTE_PCT;
    else if (a.kind === 'buff_maxhp_pct') maxHpPctAura += a.value;
    else if (a.kind === 'buff_allstats_pct') {
      // Percentage drain on the whole stat block (Resurrection Sickness: value
      // -0.75 leaves stats at 25%). Applied to the base + gear total gathered so
      // far; the only aura that ever carries this kind is player-only, so it never
      // stacks with another pct drain in practice.
      const m = 1 + a.value;
      s.str = Math.round(s.str * m);
      s.agi = Math.round(s.agi * m);
      s.vit = Math.round(s.vit * m);
      s.int = Math.round(s.int * m);
      s.luk = Math.round(s.luk * m);
    } else if (a.kind === 'buff_dodge') bonusDodge += a.value;
    else if (a.kind === 'buff_flee') bonusFlee += a.value;
    else if (a.kind === 'buff_scale') scaleMul *= a.value;
    // Metamorphosis: a temporary demon transform that also makes the caster larger.
    else if (a.kind === 'form_metamorph') scaleMul *= 1.35;
    // Percent raid buffs store integer percent POINTS (5 = +5%) so they survive the
    // integer-rounding talent value multiplier; converted to a fraction here.
    else if (a.kind === 'buff_stats_pct') allStatsPct += a.value / 100;
    else if (a.kind === 'buff_int_pct') intPct += a.value / 100;
    else if (a.kind === 'buff_sta_pct') vitPct += a.value / 100;
    else if (a.kind === 'buff_armor_pct') buffArmorPct += a.value / 100;
    else if (a.kind === 'buff_ap_pct') buffApPct += a.value / 100;
    // Avatar: the colossus transform grows the body by the fixed scale (its
    // aura value carries the damage amp, consumed in dealDamage).
    else if (a.kind === 'buff_avatar') scaleMul *= AVATAR_SCALE;
    else if (a.kind === 'form_bear') bearForm = true;
    else if (a.kind === 'form_cat') catForm = true;
    // Moonkin Form carries its Spell Power bonus in the form aura's value, so it lives and
    // dies with the one toggle (a Balance druid's whole kit is arcane/nature, so a generic
    // Spell Power bonus is correct). Gloamveil Form (form_shadow) is NOT a Spell Power
    // buff: it amplifies the priest's Shadow-school DAMAGE by a percent, applied in
    // combat/damage.ts, so it contributes nothing to the stat pass here.
    else if (a.kind === 'form_moonkin') {
      bonusSp += a.value;
      moonkinForm = true;
    }
  }
  // Talent passive stat modifiers (flat additions + a stamina percent before the
  // HP derivation below). AP/armor/maxHp percents are applied at their own steps.
  if (mods) {
    const m = mods.stats;
    s.str += m.str;
    s.agi += m.agi;
    s.vit += m.vit;
    s.int += m.int;
    s.dex += m.dex;
    s.luk += m.luk;
    s.armor += m.armor;
    bonusAp += m.ap;
    bonusDodge += m.dodge;
    if (m.vitPct) s.vit = Math.round(s.vit * (1 + m.vitPct));
    // Primary-attribute multipliers, applied to the fully-summed attribute. agiPct lands
    // before the agi-derived armor/dodge below so the percentage flows into them.
    if (m.strPct) s.str = Math.round(s.str * (1 + m.strPct));
    if (m.agiPct) s.agi = Math.round(s.agi * (1 + m.agiPct));
    if (m.intPct) s.int = Math.round(s.int * (1 + m.intPct));
    if (m.dexPct) s.dex = Math.round(s.dex * (1 + m.dexPct));
    if (m.lukPct) s.luk = Math.round(s.luk * (1 + m.lukPct));
  }
  // Percent stat raid buffs, folded multiplicatively on the computed (base + gear +
  // flat + talent) primary stats so they feed every downstream derivation (melee ATK
  // from str/dex/luk, ranged ATK from dex, MATK from int, HP from vit, evasion from
  // agi, crit from luk). DEX is listed here explicitly: it was the one attribute an
  // all-stats buff skipped, which quietly made the buff worthless to a bow user.
  if (allStatsPct || intPct || vitPct) {
    s.str = Math.round(s.str * (1 + allStatsPct));
    s.agi = Math.round(s.agi * (1 + allStatsPct));
    s.vit = Math.round(s.vit * (1 + allStatsPct + vitPct));
    s.int = Math.round(s.int * (1 + allStatsPct + intPct));
    s.dex = Math.round(s.dex * (1 + allStatsPct));
    s.luk = Math.round(s.luk * (1 + allStatsPct));
  }
  // Floor every attribute at 0 so a draining debuff can never push one negative.
  // Only Agility was floored, because only Agility fed a derivation that visibly
  // inverted. The others reached the same state silently: a big enough Spirit
  // Siphon drove Intelligence to -99989, and from there the mana pool, its regen,
  // and Magic Attack all went with it. A drain can strip an attribute to nothing;
  // it can never make one worth less than nothing.
  for (const key of STATUS_STATS) s[key] = Math.max(0, s[key]);
  // Armor comes from the class and from Vitality, never from Agility. Agility
  // buys evasion in Ragnarok and no defence at all; it fed armor here only
  // because the pre-conversion Agility was also the generic "light armor" stat.
  // Vitality is the attribute that makes a character hard to kill, so it is the
  // one that reduces damage as well as raising the pool.
  s.armor += def.baseArmor + def.armorPerLevel * (lvl - 1) + s.vit * 2;
  if (bearForm) {
    // 2.3x (2026-07 tank parity, was 1.9x): leather peaks ~1700-2100 armor
    // vs the warrior's 2861, so the form multiplier fakes the missing plate
    // tier, the Dire Bear logic.
    s.armor = Math.round(s.armor * 2.3);
    bonusAp += 15 + Math.round(s.agi * 1.5);
  }
  if (catForm) {
    bonusAp += 8 + lvl * 2;
    s.agi += Math.max(2, Math.floor(lvl / 2));
  }
  // Moonkin Form: a hardy caster form that adds 50% armor (its +20% spell damage rides a
  // separate buff_spelldmg aura the form applies).
  if (moonkinForm) s.armor = Math.round(s.armor * 1.5);
  // Protection's Vanguard: bonus armor from Strength, added (on the fully-summed
  // Strength) before the armor multiplier so armorPct amplifies it too.
  if (mods?.stats.armorFromStrPct) s.armor += Math.round(s.str * mods.stats.armorFromStrPct);
  if (mods?.stats.armorPct) s.armor = Math.round(s.armor * (1 + mods.stats.armorPct));
  if (buffArmorPct) s.armor = Math.round(s.armor * (1 + buffArmorPct)); // Devotion Aura
  // Floor Spirit at 0 so a Spirit-siphoning debuff (negative buff_spi) can never
  // drive out-of-combat regen (updateRegen reads stats.luk) below zero.
  s.luk = Math.max(0, s.luk);

  e.stats = s;
  const warfare = pvpFractionsFromRatings(bonusPvpOffenseRating, bonusPvpDefenseRating);
  e.stats.pvpOffense = warfare.offense;
  e.stats.pvpDefense = warfare.defense;
  // An over-level mainhand is inert like any other gear: fall back to unarmed
  // damage (and drop the weapon-type flags, e.g. dagger, that gate abilities)
  // until the wearer is high enough level. The mainhand still stays worn (see
  // e.mainhandItemId below) so the weapon model keeps rendering.
  const mainhand = equipment.mainhand ? ITEMS[equipment.mainhand] : undefined;
  const weapon =
    mainhand?.weapon && meetsLevelRequirement(lvl, mainhand)
      ? mainhand.weapon
      : { min: 1, max: 2, speed: 2 };
  e.weapon = weapon;
  const offhand = equipment.offhand ? ITEMS[equipment.offhand] : undefined;
  const offhandWeapon =
    canDualWield(cls, mods?.spec) &&
    offhand?.kind === 'weapon' &&
    meetsLevelRequirement(lvl, offhand)
      ? offhand.weapon
      : null;
  e.offhandWeapon = offhandWeapon;
  e.dualWielding = offhandWeapon !== null;
  // Titan's Grip state: dual-wielding with a two-hander in either hand (only a
  // Fury warrior can reach this via equipment_rules.canDualWieldTwoHand). Pays the
  // flat physical-damage penalty in combat/damage.ts (TITANS_GRIP_DMG_PENALTY):
  // the throughput side of the tradeoff whose stat side is item_budget.ts's
  // TWOHAND_STAT_MULT. The offhand arm needs no level re-check: a non-null
  // offhandWeapon already proved the offhand is a level-legal weapon.
  e.titansGrip =
    offhandWeapon !== null &&
    ((mainhand?.kind === 'weapon' &&
      mainhand.hand === 'twohand' &&
      meetsLevelRequirement(lvl, mainhand)) ||
      (offhand?.kind === 'weapon' && offhand.hand === 'twohand'));
  const activeShield =
    cls === 'warrior' && isShieldItem(offhand) && meetsLevelRequirement(lvl, offhand);
  e.blockChance = activeShield ? SHIELD_BLOCK_BASE : 0;
  e.blockValue = activeShield ? (offhand.blockValue ?? 0) : 0;
  // The equipped mainhand item id: drives the held weapon model on the client
  // (mapped via ITEM_WEAPON_VARIANTS) AND legendary weapon procs in combat
  // (combat/equip_procs.ts, which re-applies the level gate above so an inert
  // over-level weapon's procs are inert too). Gated on the item actually being
  // a weapon, mirroring the e.weapon derivation above (so a non-weapon mainhand,
  // were one ever stored, never resolves to a held model).
  e.mainhandItemId =
    equipment.mainhand && ITEMS[equipment.mainhand]?.weapon ? equipment.mainhand : null;
  e.offhandItemId =
    equipment.offhand &&
    (ITEMS[equipment.offhand]?.kind === 'weapon' ||
      ITEMS[equipment.offhand]?.kind === 'held_offhand' ||
      isShieldItem(ITEMS[equipment.offhand]))
      ? equipment.offhand
      : null;
  // Resolve the active weapon-skin cosmetic against the (possibly changed)
  // mainhand: swapping to a different weapon type drops a non-matching skin and
  // re-shows the matching one automatically. Cosmetic only; never feeds stats.
  e.weaponSkinId = resolveActiveWeaponSkin(cls, e.mainhandItemId, e.weaponSkinLoadout);
  // Render-only mirror of the full worn set, copied so a later mutation of the
  // owning PlayerMeta.equipment never aliases into the entity. Synced in the
  // identity wire (terse `eq`) for the inspect-another-player window.
  e.equippedItems = { ...equipment };
  // Render-only mirror of PlayerMeta.equipmentInstance, same copy-not-alias
  // reasoning as equippedItems above. Deep-cloned via cloneItemInstancePayload
  // (not a shallow spread) since a payload's own rolled.stats map must not be
  // aliased into the mirror.
  e.equippedInstances = equipmentInstance
    ? Object.fromEntries(
        Object.entries(equipmentInstance).map(([slot, inst]) => [
          slot,
          cloneItemInstancePayload(inst),
        ]),
      )
    : {};
  // Melee AP by class (classic-era-ish): warriors/paladins/shamans/druids 2/str,
  // rogues str+agi, hunters str+agi, pure casters str.
  // One formula for every class. The old per-class multipliers (2x STR for the
  // plate wearers, STR+AGI for the leather ones) existed to make a class feel
  // different from a stat block it no longer has; the difference now comes from
  // where the player spends, and from the kit.
  const apFromStats = statusAttackPower(s.str, s.dex, s.luk);
  // Floor at 0 so a heavy debuff_ap stack can never bake a negative attack power
  // (mirrors effectiveAttackPower's mob floor and the agi/spi floors above).
  // buffApPct (Battle Shout / Blessing of Might) folds into the same AP multiplier.
  e.attackPower = Math.max(
    0,
    Math.round((apFromStats + bonusAp) * (1 + (mods?.stats.apPct ?? 0) + buffApPct)),
  );
  // Ranged attack keys off DEX rather than AGI, which is Ragnarok's split: AGI
  // buys attack SPEED and evasion, DEX buys accuracy and bow damage.
  e.rangedPower =
    cls === 'hunter'
      ? Math.max(
          0,
          Math.round(
            (statusRangedAttackPower(s.str, s.dex, s.luk) + bonusAp) *
              (1 + (mods?.stats.apPct ?? 0) + buffApPct),
          ),
        )
      : 0;
  // Magic attack from INT with the same squared term the melee side gets, plus
  // flat Spell Power from gear and buffs.
  e.spellPower = Math.max(0, Math.round(statusMagicPower(s.int) + bonusSp));
  e.critRating = bonusCritRating + setEff.critRating;
  e.hasteRating = bonusHasteRating + setEff.hasteRating;
  // Hit rating (gear + set bonuses) folds into a hit fraction that combat subtracts
  // from miss (swingMissChance) and spell resist (spell_resist.ts). It answers the
  // Heroic +3 above-level penalty; unlike crit it has no higher-level suppression.
  e.hitRating = bonusHitRating + setEff.hitRating;
  e.hitBonus = hitFractionFromRating(e.hitRating);
  const hasteFrac = setEff.haste + hasteFractionFromRating(e.hasteRating);
  // Haste drives all three channels: faster melee and ranged auto-attack swings
  // AND shorter spell casts/channels.
  // Union of the rating system (#1471) and the spec masteries (#1543): ratings and
  // set haste feed hasteFrac; a spec mastery's passive haste adds on its channel.
  e.meleeHaste = hasteFrac + bonusHaste + (mods?.global.meleeHastePct ?? 0);
  e.rangedHaste = hasteFrac + bonusHaste;
  // Spell haste also folds in a spec mastery's passive haste (spellHastePct), so a
  // caster spec can shorten every cast; the cast-time tooltips read the same total.
  e.spellHaste = hasteFrac + bonusHaste + (mods?.global.spellHastePct ?? 0);
  e.setProcs = setEff.procs;
  if (e.setProcs.length > 0 && !e.procReadyAt) e.procReadyAt = {};
  // The class-agnostic crit core (rating + talent/set crit + flat crit auras).
  // Both hit tables read it: melee adds Agility on top, spells add Intellect
  // (the community-found gap: spell crit read ONLY Intellect, so crit gear and
  // crit talents were dead weight to casters).
  e.sharedCritBonus =
    bonusCrit + (mods?.stats.crit ?? 0) + setEff.crit + critFractionFromRating(e.critRating);
  // Crit is LUK's job, not AGI's: 1% base and a THIRD of a percent a point, so a
  // 99 LUK build crits about a third of the time off attributes alone. AGI moved
  // to evasion. This is the attacker's own rate; the defender's Luck subtracts
  // from it at the swing site (combat/crit.ts).
  e.critChance = critRateFrom(
    s.luk,
    e.sharedCritBonus +
      (e.auras.some((a) => a.kind === 'berserker_stance') ? BERSERKER_CRIT_CHANCE : 0),
  );
  // Extra crit damage from a spec mastery, per output channel (e.g. Fire mage: SPELL
  // crits deal more; Holy paladin: HEAL crits; Subtlety/Arms: PHYSICAL crits). Each
  // channel bonus is added at its matching crit site (spell base 1.5, phys base 2,
  // heal base 1.5).
  e.critDmgSpellBonus = mods?.global.critDmgSpellPct ?? 0;
  e.critDmgPhysBonus = mods?.global.critDmgPhysPct ?? 0;
  e.critDmgHealBonus = mods?.global.critDmgHealPct ?? 0;
  e.castPushbackReduction = setEff.castPushbackReduction;
  e.knockbackResistance = setEff.knockbackResistance;
  // Floored at 0: an off-balance debuff (negative buff_dodge) can drive dodge to nothing.
  // AGI evasion, at the same rate LUK buys crit. This is an INTERIM shape: in
  // Ragnarok evasion is Flee contested against the attacker's Hit, not a flat
  // chance, and that contest arrives with the combat model in phase 3. What
  // matters here is that AGI is worth points on the 1-99 scale.
  // Agility buys FLEE now, not a dodge percentage, and Dexterity buys accuracy,
  // which it bought nowhere before. What is left on dodgeChance is Ragnarok's
  // perfect dodge: flat, from Luck, and the one avoidance an attacker's accuracy
  // cannot answer. Aura grants (buff_dodge and the mob stagger debuff) still land
  // here, so their sign and magnitude are unchanged.
  e.hit = hitRating(lvl, s.dex) + Math.round(e.hitBonus * 100);
  e.flee = Math.max(0, fleeRating(lvl, s.agi) + bonusFlee);
  e.dodgeChance = Math.max(0, perfectDodgeChance(s.luk) + bonusDodge);

  const hpFrac = e.maxHp > 0 ? e.hp / e.maxHp : 1;
  // Ragnarok's shape: VIT is a PERCENTAGE on the class pool, not a flat per-point
  // grant. At VIT 99 a character carries just under double the pool a VIT 1
  // character does. That is decisive without ever dwarfing the class and level
  // base, the way a flat +10/point did once the scale ran to 99.
  e.maxHp = Math.round((def.baseHp + def.hpPerLevel * (lvl - 1)) * vitHealthMultiplier(s.vit));
  if (bearForm) e.maxHp = Math.round(e.maxHp * 1.15);
  if (mods?.stats.maxHpPct) e.maxHp = Math.round(e.maxHp * (1 + mods.stats.maxHpPct));
  if (maxHpPctAura !== 0) e.maxHp = Math.max(1, Math.round(e.maxHp * (1 + maxHpPctAura)));
  // Fiesta "Colossus"-style buffs: growing bigger also makes you tankier.
  if (scaleMul > 1) e.maxHp = Math.round(e.maxHp * scaleMul);
  e.hp = Math.max(1, Math.round(e.maxHp * hpFrac));
  if (e.dead) e.hp = 0;
  // Body size: players default to 1; a buff_scale aura grows/shrinks them live.
  if (e.kind === 'player') e.scale = scaleMul;

  // Druid forms swap the resource bar, classic-style: bear runs on rage
  // (starts empty, fills from combat), cat on energy (starts full, friendlier
  // than the classic-era 0). Mana is parked in savedMana and restored on shift-out.
  const formResource: 'rage' | 'energy' | null = bearForm ? 'rage' : catForm ? 'energy' : null;
  if (formResource) {
    if (e.resourceType === 'mana') e.savedMana = e.resource;
    if (e.resourceType !== formResource) e.resource = formResource === 'energy' ? 100 : 0;
    e.resourceType = formResource;
    e.maxResource = 100;
  } else if (def.resourceType === 'mana') {
    const cameFromForm = e.resourceType !== 'mana';
    const manaFrac = e.maxResource > 0 ? e.resource / e.maxResource : 1;
    e.resourceType = 'mana';
    e.maxResource = Math.round(
      (def.baseMana + def.manaPerLevel * (lvl - 1)) *
        intManaMultiplier(s.int) *
        (1 + (mods?.global.manaPct ?? 0)),
    );
    e.resource = cameFromForm
      ? Math.min(e.savedMana, e.maxResource)
      : Math.round(e.maxResource * manaFrac);
  } else {
    e.resourceType = def.resourceType;
    e.maxResource = 100; // rage and energy both cap at 100
    e.resource = Math.min(e.resource, 100);
  }
}

// Derived stats + max vitals for an OFFLINE character (a stored CharacterState),
// computed by reusing recalcPlayerStats on a throwaway entity rather than
// re-deriving the numbers. With no auras and no active form, recalcPlayerStats
// yields exactly the class/level/gear/talent stat block, the same numbers a
// live player shows, so the character sheet stays in lockstep with the engine.
// Resource max is the full pool for the class (mana from intellect, or 100 for
// rage/energy); the sheet pairs it with the stored current value.
export interface DerivedCharacterStats {
  stats: Stats;
  maxHp: number;
  maxResource: number;
  resourceType: Entity['resourceType'];
}

export function characterDerivedStats(
  cls: PlayerClass,
  level: number,
  equipment: PlayerEquipment,
  mods?: PlayerModifiers,
  equipmentInstance?: Partial<Record<EquipSlot, ItemInstancePayload>>,
  // The character's stored allocation. Omitting it does NOT mean "no allocation":
  // it means the sheet would report 1 in every attribute for a character who is
  // nothing of the sort, so a caller with the save in hand must pass it.
  alloc?: StatAllocation,
): DerivedCharacterStats {
  const e = createPlayer(0, cls, { x: 0, y: 0, z: 0 }, '');
  e.level = Math.max(1, Math.floor(level));
  recalcPlayerStats(
    e,
    cls,
    equipment,
    mods,
    equipmentInstance ?? {},
    alloc ?? emptyStatAllocation(),
  );
  return {
    stats: e.stats,
    maxHp: e.maxHp,
    maxResource: e.maxResource,
    resourceType: e.resourceType,
  };
}

export function createMob(id: number, template: MobTemplate, level: number, pos: Vec3): Entity {
  const e = baseEntity(id, pos);
  e.kind = 'mob';
  e.templateId = template.id;
  e.name = template.name;
  e.level = level;
  e.hostile = true;
  // Carry the template's Ragnarok classifications onto the entity so combat and
  // the online client both have them without a table lookup. Unauthored fields
  // stay undefined and read as the even trade at the chart.
  e.race = template.race;
  e.element = template.element;
  e.elementLevel = template.elementLevel;
  e.size = template.size;
  // Elite scaling, classic-style: ~2.3x health, ~1.5x damage.
  const hpMult = template.elite ? 2.3 : 1;
  const dmgMult = template.elite ? 1.5 : 1;
  e.maxHp = Math.round((template.hpBase + template.hpPerLevel * (level - 1)) * hpMult);
  e.hp = e.maxHp;
  const dmg = (template.dmgBase + template.dmgPerLevel * (level - 1)) * dmgMult;
  e.weapon = {
    min: Math.round(dmg * 0.8),
    max: Math.round(dmg * 1.25),
    speed: template.attackSpeed,
  };
  // Armor scales from level 1 like hp/dmg above: a template has no armorBase,
  // A monster's accuracy and evasion, from its LEVEL alone until its record
  // carries real attributes (authoring those is its own pass, and it needs the
  // A monster's ATTRIBUTES track its level until its record carries real ones.
  // Reading zero looks like the honest default and is not, because every
  // Ragnarok mechanic that protects a monster is keyed to an attribute:
  //
  //   AGI  evasion. HIT and FLEE both gain a point per level, so a zero-Agility
  //        monster's evasion never outruns any attacker's accuracy and a
  //        level-12 character lands every swing on a level-60 elite.
  //   VIT  soft defence, the flat subtraction. At zero a monster's defence is
  //        entirely its armour value and Vitality means nothing to it.
  //   LUK  critical denial, and its own perfect dodge. At zero nothing suppresses
  //        an attacker's critical rate at all, and the level gap stops mattering.
  //   DEX  accuracy. Unused for a monster's own damage, which rolls an authored
  //        pair with no Dexterity term (combat/weapon_damage.ts).
  //
  // A third of level for all four, which is the shape Ragnarok's monsters
  // actually carry: modest attributes, not a level's worth. Zero deletes the
  // mechanics above; a full level's worth swings it the other way and leaves a
  // capped Agility build unable to dodge and a capped Dexterity build unable to
  // hit, deleting both archetypes at once. Authored numbers replace this when
  // the monster records land, and every number here gets better rather than
  // different when they do.
  const monsterAttribute = Math.floor(level / 3);
  e.stats.agi = monsterAttribute;
  e.stats.dex = monsterAttribute;
  e.stats.vit = monsterAttribute;
  e.stats.luk = monsterAttribute;
  e.hit = hitRating(level, e.stats.dex);
  e.flee = fleeRating(level, e.stats.agi);
  e.dodgeChance = perfectDodgeChance(e.stats.luk);
  // so a level-1 mob gets 0 and each level adds armorPerLevel.
  e.stats.armor = Math.round(template.armorPerLevel * (level - 1));
  e.moveSpeed = template.moveSpeed;
  e.scale = template.scale;
  e.color = template.color;
  e.swingTimer = 0;
  // Telegraph the first War Stomp: delay it one full interval after engage.
  if (template.stomp) e.stompTimer = template.stomp.every;
  // Telegraph the first Banshee's Wail the same way: one full interval after engage.
  if (template.terrify) e.terrifyTimer = template.terrify.every;
  // Telegraph the first Howling Gale the same way: one full interval after engage.
  if (template.aoeSlow) e.aoeSlowTimer = template.aoeSlow.every;
  // First battle cry one interval in, so a loud boss's engage yell lands alone on the pull.
  if (template.battleYells) e.loudYellTimer = template.battleYells.every;
  // Telegraph the first Mend the same way: one full interval after engage.
  if (template.mendAlly) e.mendTimer = template.mendAlly.every;
  // Telegraph the first Ward the same way: one full interval after engage.
  if (template.wardAllies) e.wardTimer = template.wardAllies.every;
  // Telegraph the first channeled heal tick: one full interval after engage.
  if (template.channelHeal) e.channelTimer = template.channelHeal.every;
  // Telegraph the first Stoneskin: one full interval after engage.
  if (template.stoneskin) e.stoneskinTimer = template.stoneskin.every;
  // Telegraph the first hardcast (bigCast) the same way: one full interval after engage.
  if (template.bigCast) e.bigCastTimer = template.bigCast.every;
  if (template.infernoChannel) e.infernoTimer = template.infernoChannel.every;
  // Telegraph the first Rally the same way: one full interval after engage.
  if (template.rally) e.rallyTimer = template.rally.every;
  // Telegraph the first War Cadence the same way: one full interval after engage.
  if (template.warcry) e.warcryTimer = template.warcry.every;
  return e;
}

export function createNpc(id: number, def: NpcDef, pos: Vec3): Entity {
  const e = baseEntity(id, pos);
  e.kind = 'npc';
  e.templateId = def.id;
  e.name = def.name;
  e.level = 10;
  e.hostile = false;
  e.maxHp = 500;
  e.hp = 500;
  e.facing = def.facing;
  e.prevFacing = def.facing;
  e.color = def.color;
  e.questIds = [...def.questIds];
  e.vendorItems = [...(def.vendorItems ?? [])];
  e.devVendor = def.devVendor ?? false;
  return e;
}

export function createGroundObject(id: number, itemId: string, name: string, pos: Vec3): Entity {
  const e = baseEntity(id, pos);
  e.kind = 'object';
  e.templateId = `ground_${itemId}`;
  e.name = name;
  e.level = 1;
  e.hostile = false;
  e.maxHp = 1;
  e.hp = 1;
  e.objectItemId = itemId;
  e.lootable = true;
  return e;
}

export { MOBS };
