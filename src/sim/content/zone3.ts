// Zone 3 — Thornpeak Heights (levels 13-20). The Gravecallers serve Korzul
// the Gravewyrm, an ancient dragon sealed beneath the peaks. Highwatch holds
// the wall against ogres, waking elementals, and the open chanting of the
// Wyrmcult at the Gravewyrm Sanctum gates.

import { WORK_ORDER_CADENCE_TICKS } from '../professions/cadence';
import type {
  CampDef,
  GroundObjectDef,
  ItemDef,
  MobTemplate,
  NpcDef,
  QuestDef,
  ZoneDef,
  ZonePropsDef,
} from '../types';
import { FERAL } from './items';

export const ZONE3_ZONE: ZoneDef = {
  id: 'thornpeak_heights',
  name: 'Thornpeak Heights',
  zMin: 540,
  zMax: 900,
  levelRange: [13, 20],
  biome: 'peaks',
  hub: { x: 0, z: 660, radius: 20, name: 'Highwatch' },
  graveyard: { x: 15, z: 645 },
  lakes: [{ x: -70, z: 760, radius: 18 }],
  pois: [
    { x: 0, z: 660, label: 'Highwatch', id: 'highwatch' },
    { x: -50, z: 590, label: 'Stalker Ridge', id: 'stalker_ridge' },
    { x: 85, z: 615, label: 'Deeprock Burrows', id: 'deeprock_burrows' },
    { x: -90, z: 700, label: 'Ogre Foothills', id: 'ogre_foothills' },
    { x: -130, z: 740, label: "Drogmar's War-Camp", id: 'drogmars_war_camp' },
    { x: 110, z: 760, label: 'Stormcrag', id: 'stormcrag' },
    { x: -70, z: 770, label: 'The Glimmermere', id: 'the_glimmermere' },
    { x: 55, z: 820, label: 'Wyrmcult Tents', id: 'wyrmcult_tents' },
    { x: -40, z: 830, label: 'Revenant Fields', id: 'revenant_fields' },
    { x: 0, z: 880, label: 'Gravewyrm Sanctum', id: 'gravewyrm_sanctum' },
  ],
  welcome: 'Captain Thessaly holds the wall at Highwatch - barely.',
};

// Mountain road from Fenbridge up to Highwatch, then spokes.
export const ZONE3_ROADS: { x: number; z: number }[][] = [
  [
    { x: 0, z: 320 },
    { x: 10, z: 450 },
    { x: 0, z: 540 },
    { x: 0, z: 660 },
  ], // Fenbridge -> Highwatch
  [
    { x: -6, z: 666 },
    { x: -60, z: 700 },
    { x: -110, z: 735 },
  ], // -> ogre war-camp
  [
    { x: 6, z: 668 },
    { x: 70, z: 720 },
    { x: 110, z: 760 },
  ], // -> Stormcrag
  [
    { x: 0, z: 676 },
    { x: 0, z: 780 },
    { x: 0, z: 860 },
  ], // -> Sanctum Approach
];

// ---------------------------------------------------------------------------
// Mobs (overworld only — the Gravewyrm Sanctum mobs live in content/dungeons)
// ---------------------------------------------------------------------------

export const ZONE3_MOBS: Record<string, MobTemplate> = {
  // Highwatch practice target: a near-immortal, stationary dummy for testing damage
  // rotations and reading the combat meters. Cap-level with zero armor so the damage
  // it takes is your clean, unmitigated rotation output. Inert (never fights back),
  // drops nothing (you can never really fell it), and pops back up 10s after a death.
  training_dummy: {
    id: 'training_dummy',
    name: 'Training Dummy',
    minLevel: 20,
    maxLevel: 20,
    family: 'humanoid',
    hpBase: 999999,
    hpPerLevel: 0,
    dmgBase: 0,
    dmgPerLevel: 0,
    attackSpeed: 2.0,
    armorPerLevel: 0,
    moveSpeed: 0,
    aggroRadius: 0,
    loot: [], // a practice target: no drops (you can never really fell it)
    scale: 1.4,
    color: 0xb8924a,
    dummy: true,
    respawnSeconds: 10,
  },
  ridge_stalker: {
    id: 'ridge_stalker',
    name: 'Ridge Stalker',
    minLevel: 13,
    maxLevel: 14,
    family: 'beast',
    hpBase: 58,
    hpPerLevel: 21,
    dmgBase: 10,
    dmgPerLevel: 2.5,
    attackSpeed: 1.9,
    armorPerLevel: 14,
    moveSpeed: 8,
    aggroRadius: 11,
    // Rending Claws: the stalker's raking swipes can open a bleeding wound, a
    // refreshing physical DoT (~5 every 3s for 9s). Distinct from poison: it is
    // physical-school, so it bypasses poison cleanses and ignores nature resist.
    bleed: {
      chance: 0.25,
      perTick: 5,
      interval: 3,
      duration: 9,
      name: 'Rending Claws',
      school: 'physical',
    },
    loot: [
      { copper: 60, chance: 1 },
      { itemId: 'ridge_stalker_pelt', chance: 0.6, questId: 'q_stalker_pelts' },
      { itemId: 'ridge_stalker_pelt', chance: 0.6, questId: 'q_stalker_cloaks' },
      { itemId: 'wildgrove_cinch', chance: 0.1 },
    ],
    scale: 0.95,
    color: 0x8c8270,
    componentTags: ['hide', 'claw', 'meat'],
  },
  // The apex of the southern ridge: a grizzled, scar-pelted old cat that has
  // outlived three generations of its pack. A rare elite counterpart to the
  // Ridge Stalkers, met first when climbing into Thornpeak. Reuses existing
  // mechanics only: a rending pounce (aoePulse) and a wounded-beast enrage.
  old_cragmaw: {
    id: 'old_cragmaw',
    name: 'Old Cragmaw',
    minLevel: 14,
    maxLevel: 14,
    family: 'beast',
    rare: true,
    elite: true,
    canSwim: true,
    ccImmune: true,
    respawnMult: 7.2,
    hpBase: 320,
    hpPerLevel: 56,
    dmgBase: 16,
    dmgPerLevel: 4.0,
    attackSpeed: 1.7,
    armorPerLevel: 24,
    moveSpeed: 8.6,
    aggroRadius: 13,
    aoePulse: { min: 22, max: 30, radius: 8, every: 9, name: 'Savage Pounce', school: 'physical' },
    enrage: { belowHpPct: 0.35, dmgMult: 1.4, hasteMult: 1.3 },
    loot: [
      { copper: 220, chance: 1 },
      { itemId: 'old_cragmaws_pelt', chance: 1 },
      { itemId: 'cragmaw_huntcord', chance: 0.25 },
      { itemId: 'cragmaw_prowlboots', chance: 0.3 },
      { itemId: 'cragward_pauldrons', chance: 0.25 },
      { itemId: 'cragthorn_greatstaff', chance: 0.2 },
    ],
    scale: 1.3,
    color: 0x6e6453,
    componentTags: ['hide', 'fang', 'claw'],
  },
  deeprock_kobold: {
    id: 'deeprock_kobold',
    name: 'Deeprock Tunneler',
    minLevel: 14,
    maxLevel: 15,
    family: 'burrower',
    hpBase: 60,
    hpPerLevel: 22,
    dmgBase: 10,
    dmgPerLevel: 2.5,
    attackSpeed: 2.1,
    armorPerLevel: 18,
    moveSpeed: 7,
    aggroRadius: 10,
    loot: [
      { copper: 65, chance: 1 },
      { itemId: 'glowing_wax', chance: 0.5, questId: 'q_glowing_wax' },
      { itemId: 'tallow_candle', chance: 0.4 },
      { itemId: 'healing_potion', chance: 0.08 },
      // A grindable long-shot at the epic T1 mail boots that also drop from the
      // Ironvein Foreman: a rare per-kill chance so the Deeprock Burrows are a
      // farmable path to the sabatons, not just the Foreman rare.
      { itemId: 'deathlord_sabatons', chance: 0.001 },
      // Rare caster pieces at a grindable long-shot chance, the same pattern
      // as the sabatons above: mail for the shaman/paladin line, leather for
      // the druid line.
      { itemId: 'peaksong_helm', chance: 0.04 },
      { itemId: 'moonbark_vestments', chance: 0.04 },
    ],
    scale: 0.85,
    color: 0x9c7a3c,
    // Jarring Swing: a heavy mining-pick blow knocks the victim off-balance,
    // cutting their dodge for 8s so the tunneler's strikes land more reliably.
    staggerHit: { chance: 0.3, dodgeReduction: 0.05, duration: 8, name: 'Off-Balance' },
  },
  ironvein_foreman: {
    id: 'ironvein_foreman',
    name: 'Ironvein Foreman',
    minLevel: 16,
    maxLevel: 16,
    family: 'burrower',
    rare: true,
    elite: true,
    canSwim: true,
    ccImmune: true,
    // 144 * 25s base = 1 hour, so the epic-mail-boot rare is farmable on a
    // predictable hourly cadence rather than the old 6-hour wait.
    respawnMult: 144,
    hpBase: 420,
    hpPerLevel: 70,
    dmgBase: 19,
    dmgPerLevel: 4.4,
    attackSpeed: 2.0,
    armorPerLevel: 38,
    moveSpeed: 7,
    aggroRadius: 12,
    aoePulse: { min: 28, max: 38, radius: 8, every: 10, name: 'Powder Keg', school: 'fire' },
    summonAdds: { mobId: 'ironvein_sapper', count: 2, atHpPct: [0.5] },
    rally: { radius: 14, every: 12, ap: 40, duration: 10, name: 'Rallying Banner' },
    enrage: { belowHpPct: 0.3, dmgMult: 1.45, hasteMult: 1.3 },
    loot: [
      { copper: 420, chance: 1 },
      { itemId: 'glowing_wax', chance: 1 },
      { itemId: 'ironvein_pickblade', chance: 0.25 },
      { itemId: 'ironvein_lantern_staff', chance: 0.25 },
      { itemId: 'gutripper_shiv', chance: 0.25, rollGroup: 'ironvein_foreman_chase' },
      { itemId: 'deathlord_sabatons', chance: 0.25, rollGroup: 'ironvein_foreman_chase' },
      { itemId: 'stormchant_gauntlets', chance: 0.2 },
    ],
    scale: 1.05,
    color: 0xb0823a,
  },
  ironvein_sapper: {
    id: 'ironvein_sapper',
    name: 'Ironvein Sapper',
    minLevel: 15,
    maxLevel: 16,
    family: 'burrower',
    hpBase: 58,
    hpPerLevel: 20,
    dmgBase: 11,
    dmgPerLevel: 2.6,
    attackSpeed: 2.0,
    armorPerLevel: 18,
    moveSpeed: 7.5,
    aggroRadius: 12,
    smolder: { chance: 0.25, perTick: 5, interval: 3, duration: 12, name: 'Smoldering Fuse' },
    // The sapper's blasting powder clings and smolders: a struck foe catches fire.
    cinder: {
      chance: 0.3,
      perTick: 5,
      interval: 3,
      duration: 12,
      name: 'Cinderburn',
      school: 'fire',
    },
    loot: [],
    scale: 0.85,
    color: 0x8f6b34,
  },
  thornpeak_ogre: {
    id: 'thornpeak_ogre',
    name: 'Thornpeak Ogre',
    minLevel: 15,
    maxLevel: 16,
    family: 'ogre',
    hpBase: 66,
    hpPerLevel: 23,
    dmgBase: 11,
    dmgPerLevel: 2.6,
    attackSpeed: 2.6,
    armorPerLevel: 22,
    moveSpeed: 7,
    aggroRadius: 11,
    concuss: { chance: 0.2, duration: 2, name: 'Concussive Blow' },
    loot: [
      { copper: 75, chance: 1 },
      { itemId: 'ogre_toe_ring', chance: 0.35 },
      { itemId: 'cragprowl_belt', chance: 0.1 },
    ],
    scale: 1.3,
    color: 0x9e7b53,
  },
  ogre_crusher: {
    id: 'ogre_crusher',
    name: 'Thornpeak Crusher',
    minLevel: 16,
    maxLevel: 17,
    family: 'ogre',
    elite: true,
    hpBase: 64,
    hpPerLevel: 23,
    dmgBase: 11,
    dmgPerLevel: 2.6,
    attackSpeed: 2.6,
    armorPerLevel: 24,
    moveSpeed: 7,
    aggroRadius: 12,
    // Disarming Smash: a war-camp crusher's two-handed blow can batter the weapon
    // from your grip, cutting off auto-attack for a few seconds — a real threat to
    // a tank holding the pack. The inverse of the Summoner's Silencing Shriek.
    disarm: { chance: 0.25, duration: 6, name: 'Disarming Smash', school: 'physical' },
    loot: [
      { copper: 200, chance: 1 },
      { itemId: 'ogre_toe_ring', chance: 0.5 },
      { itemId: 'revenantstep_treads', chance: 0.06 },
    ],
    scale: 1.35,
    color: 0x7e5c3e,
  },
  warlord_drogmar: {
    id: 'warlord_drogmar',
    name: 'Warlord Drogmar',
    minLevel: 17,
    maxLevel: 17,
    family: 'ogre',
    elite: true,
    boss: true,
    hpBase: 200,
    hpPerLevel: 30,
    dmgBase: 12,
    dmgPerLevel: 2.7,
    attackSpeed: 2.6,
    armorPerLevel: 28,
    moveSpeed: 7,
    aggroRadius: 14,
    aoePulse: { min: 22, max: 30, radius: 10, every: 12, name: 'Ground Slam' },
    // The longer the warlord is left to swing, the harder he hits: every landed
    // blow stokes his Battle Fury, stacking attack power up to a hard cap. A
    // drawn-out fight snowballs, so burn him down or kite him off you to bleed
    // the stacks back off.
    rampage: { ap: 20, maxStacks: 5, duration: 10, name: 'Mounting Rage', school: 'physical' },
    loot: [
      { copper: 2000, chance: 1 },
      { itemId: 'drogmar_warboots', chance: 0.3 },
      { itemId: 'drogmars_skullcleaver', chance: 0.25 },
      { itemId: 'thunderward_legguards', chance: 0.25 },
    ],
    scale: 1.5,
    color: 0x8c3b2e,
  },
  brutok_skullsmasher: {
    // The ogre family's rare elite — a hulking two-fisted mauler that prowls
    // the crags above the Crusher warbands. Slow, heavily armored and brutal:
    // it slams the ground in a physical shockwave and goes berserk when low.
    // Fills the ogre rare gap beside Ironvein Foreman (kobold), Shardlord
    // Kazzix (elemental) and Marrowlord Varkas (undead).
    id: 'brutok_skullsmasher',
    name: 'Brutok Skullsmasher',
    minLevel: 17,
    maxLevel: 17,
    family: 'ogre',
    rare: true,
    elite: true,
    ccImmune: true,
    respawnMult: 432,
    hpBase: 360,
    hpPerLevel: 60,
    dmgBase: 16,
    dmgPerLevel: 3.6,
    attackSpeed: 2.7,
    armorPerLevel: 30,
    moveSpeed: 7,
    aggroRadius: 13,
    aoePulse: {
      min: 22,
      max: 30,
      radius: 10,
      every: 10,
      name: 'Skull Smash',
      school: 'physical',
      fx: 'nova',
    },
    enrage: { belowHpPct: 0.3, dmgMult: 1.5, hasteMult: 1.3 },
    loot: [
      { copper: 320, chance: 1 },
      { itemId: 'cracked_ogre_tusk', chance: 1 },
      { itemId: 'skullsmasher_warbelt', chance: 0.3 },
      { itemId: 'brutoks_maul', chance: 0.25, rollGroup: 'brutok_chase' },
      { itemId: 'crag_warden_cudgel', chance: 0.25, rollGroup: 'brutok_chase' },
      { itemId: 'skullsplitter_dirk', chance: 0.25, rollGroup: 'brutok_chase' },
      { itemId: 'stormroot_cowl', chance: 0.2 },
    ],
    scale: 1.45,
    color: 0x6e5235,
  },
  stormcrag_elemental: {
    id: 'stormcrag_elemental',
    name: 'Stormcrag Elemental',
    minLevel: 17,
    maxLevel: 18,
    family: 'elemental',
    hpBase: 62,
    hpPerLevel: 22,
    dmgBase: 12,
    dmgPerLevel: 2.7,
    attackSpeed: 2.2,
    armorPerLevel: 20,
    moveSpeed: 6.5,
    aggroRadius: 11,
    loot: [
      { copper: 80, chance: 1 },
      { itemId: 'storm_core', chance: 0.55, questId: 'q_shard_cores' },
      { itemId: 'blessed_embers', chance: 0.55, questId: 'q_breaking_the_seal' },
      { itemId: 'inert_storm_shard', chance: 0.4 },
    ],
    scale: 1.1,
    color: 0x5dade2,
    // A touch of the storm's cold numbs the limbs: each landed swing has a
    // chance to slow the victim to half speed for a few seconds.
    chillOnHit: { chance: 0.35, mult: 0.5, duration: 6, name: 'Numbing Chill' },
    // Static Charge: the elemental's storm clings to whatever it strikes, leaving
    // the victim conductive so every spell that lands on them bites deeper —
    // +18% magic damage taken from all attackers for a while.
    spellVuln: { chance: 0.3, amp: 0.18, duration: 10, name: 'Static Charge', school: 'nature' },
  },
  shardlord_kazzix: {
    id: 'shardlord_kazzix',
    name: 'Shardlord Kazzix',
    minLevel: 18,
    maxLevel: 18,
    family: 'elemental',
    rare: true,
    hpBase: 160,
    hpPerLevel: 28,
    dmgBase: 13,
    dmgPerLevel: 2.8,
    attackSpeed: 2.2,
    armorPerLevel: 24,
    moveSpeed: 7,
    aggroRadius: 12,
    loot: [
      { copper: 500, chance: 1 },
      { itemId: 'kazzix_heartshard', chance: 1, questId: 'q_kazzix' },
      { itemId: 'inert_storm_shard', chance: 1 },
      { itemId: 'shardfang_grips', chance: 0.25 },
    ],
    // The Shardlord's rimebound core sheathes its blows in killing cold, leaving
    // a frost burn that gnaws at the victim long after the strike lands.
    frostbite: {
      chance: 0.3,
      perTick: 6,
      interval: 3,
      duration: 12,
      name: 'Winterbite',
      school: 'frost',
    },
    scale: 1.3,
    color: 0xaed6f1,
  },
  wyrmcult_zealot: {
    id: 'wyrmcult_zealot',
    name: 'Wyrmcult Zealot',
    minLevel: 17,
    maxLevel: 19,
    family: 'humanoid',
    hpBase: 62,
    hpPerLevel: 22,
    dmgBase: 12,
    dmgPerLevel: 2.7,
    attackSpeed: 2.0,
    armorPerLevel: 20,
    moveSpeed: 7,
    aggroRadius: 11,
    loot: [
      { copper: 90, chance: 1 },
      { itemId: 'wyrmcult_orders', chance: 0.5, questId: 'q_cult_orders' },
      { itemId: 'frayed_prayer_beads', chance: 0.35 },
      { itemId: 'shardsong_mantle', chance: 0.04 },
    ],
    // The zealot's fevered chanting claws at a caster's mind, draining Intellect
    // and shrinking their mana pool for a while.
    enfeeble: { chance: 0.3, int: 12, duration: 12, name: 'Maddening Whisper', school: 'shadow' },
    // The Wyrmcult hoards their master's flame: a branding strike seals away the
    // victim's fire magic so it can never rival the wyrm's, while leaving every
    // other school free (a single-school counterspell, distinct from a full silence).
    lockout: { chance: 0.25, duration: 6, name: 'Wyrmward Sigil', school: 'fire' },
    scale: 1.0,
    color: 0x76448a,
    componentTags: ['cloth'],
  },
  wyrmcult_necromancer: {
    id: 'wyrmcult_necromancer',
    name: 'Wyrmcult Necromancer',
    minLevel: 18,
    maxLevel: 19,
    family: 'humanoid',
    hpBase: 58,
    hpPerLevel: 21,
    dmgBase: 13,
    dmgPerLevel: 2.8,
    attackSpeed: 2.0,
    armorPerLevel: 16,
    moveSpeed: 7,
    aggroRadius: 11,
    loot: [
      { copper: 100, chance: 1 },
      { itemId: 'ritual_phylactery', chance: 0.55, questId: 'q_necromancers' },
      { itemId: 'linen_scrap', chance: 0.3 },
      { itemId: 'wyrmcult_spellgrips', chance: 0.04 },
    ],
    manaBurn: { chance: 0.3, amount: 80, name: 'Mana Sear', school: 'shadow' },
    // Spectral Ward: a shroud of dark wards that lashes back at any caster whose
    // spell strikes the necromancer — the magic-school twin of melee thorns.
    spellReflect: { value: 9, name: 'Spectral Ward', school: 'shadow' },
    scale: 1.0,
    color: 0x533566,
    componentTags: ['cloth'],
  },
  boneclad_revenant: {
    id: 'boneclad_revenant',
    name: 'Boneclad Revenant',
    minLevel: 18,
    maxLevel: 19,
    family: 'undead',
    hpBase: 66,
    hpPerLevel: 23,
    dmgBase: 12,
    dmgPerLevel: 2.7,
    attackSpeed: 2.3,
    armorPerLevel: 18,
    moveSpeed: 6.5,
    aggroRadius: 11,
    enervate: { chance: 0.3, vit: 14, duration: 12, name: 'Soul Siphon', school: 'shadow' },
    loot: [
      { copper: 100, chance: 1 },
      { itemId: 'bone_fragments', chance: 0.6 },
      { itemId: 'runed_bone_shard', chance: 0.7, questId: 'q_nythraxis_restless_dead' },
      // A grindable long-shot at the epic T1 cloth legs that also drop from
      // Marrowlord Varkas: a rare per-kill chance so the bonefields are a
      // farmable path to the legwraps, not just the once-per-respawn rare.
      { itemId: 'necromancers_legwraps', chance: 0.001 },
      { itemId: 'thornpeak_wildwraps', chance: 0.04 },
    ],
    scale: 1.05,
    color: 0xcacfd2,
  },
  fallen_captain_aldren: {
    id: 'fallen_captain_aldren',
    name: 'Fallen Captain Aldren',
    minLevel: 20,
    maxLevel: 20,
    family: 'undead',
    elite: true,
    rare: true,
    canSwim: true,
    ccImmune: true,
    respawnMult: 4,
    hpBase: 390,
    hpPerLevel: 72,
    dmgBase: 22,
    dmgPerLevel: 4.2,
    attackSpeed: 2.2,
    armorPerLevel: 42,
    moveSpeed: 7.2,
    aggroRadius: 18,
    cleave: { radius: 7, mult: 0.75, name: 'Grave-Cleaver' },
    loot: [
      { copper: 450, chance: 1 },
      { itemId: 'captains_crest', chance: 1, questId: 'q_nythraxis_sealed_crypt' },
      { itemId: 'bone_fragments', chance: 1 },
    ],
    scale: 1.15,
    color: 0xbfc7ca,
  },
  corrupted_priest_malric: {
    id: 'corrupted_priest_malric',
    name: 'Corrupted Priest Malric',
    minLevel: 20,
    maxLevel: 20,
    family: 'undead',
    elite: true,
    rare: true,
    canSwim: true,
    ccImmune: true,
    respawnMult: 4,
    hpBase: 360,
    hpPerLevel: 68,
    dmgBase: 23,
    dmgPerLevel: 4.3,
    attackSpeed: 2.3,
    armorPerLevel: 26,
    moveSpeed: 6.9,
    aggroRadius: 18,
    manaBurn: { chance: 0.4, amount: 130, name: 'Withered Benediction', school: 'shadow' },
    mendAlly: {
      healMin: 48,
      healMax: 70,
      radius: 14,
      every: 7,
      name: 'Profane Mending',
      school: 'shadow',
    },
    petSpell: { name: 'Mindfracture', school: 'shadow', min: 38, max: 56, range: 28, every: 2.8 },
    aoePulse: {
      min: 28,
      max: 42,
      radius: 16,
      every: 8,
      name: 'Shadow Nova',
      school: 'shadow',
      fx: 'nova',
    },
    loot: [
      { copper: 450, chance: 1 },
      { itemId: 'priests_sigil', chance: 1, questId: 'q_nythraxis_sealed_crypt' },
      { itemId: 'frayed_prayer_beads', chance: 0.5 },
      { itemId: 'cryptbloom_shoulderguards', chance: 0.2 },
    ],
    scale: 1.05,
    color: 0xd5d0e8,
  },
  deathstalker_voss: {
    id: 'deathstalker_voss',
    name: 'Deathstalker Voss',
    minLevel: 20,
    maxLevel: 20,
    family: 'undead',
    elite: true,
    rare: true,
    canSwim: true,
    ccImmune: true,
    respawnMult: 4,
    hpBase: 410,
    hpPerLevel: 74,
    dmgBase: 24,
    dmgPerLevel: 4.5,
    attackSpeed: 2.1,
    armorPerLevel: 44,
    moveSpeed: 7.4,
    aggroRadius: 18,
    cleave: { radius: 7, mult: 0.7, name: 'Deathstalker Cleave' },
    mortalStrike: {
      chance: 0.45,
      healReduction: 0.5,
      duration: 10,
      name: 'Forgotten Wound',
      school: 'physical',
    },
    loot: [
      { copper: 450, chance: 1 },
      { itemId: 'royal_seal', chance: 1, questId: 'q_nythraxis_sealed_crypt' },
      { itemId: 'bone_fragments', chance: 1 },
    ],
    scale: 1.18,
    color: 0xc7c0b2,
  },
  vision_aldren_warrior: {
    id: 'vision_aldren_warrior',
    name: 'Vision of Captain Aldren',
    minLevel: 20,
    maxLevel: 20,
    family: 'humanoid',
    hpBase: 1,
    hpPerLevel: 0,
    dmgBase: 0,
    dmgPerLevel: 0,
    attackSpeed: 2,
    armorPerLevel: 0,
    moveSpeed: 0,
    aggroRadius: 0,
    loot: [],
    scale: 1.0,
    color: 0xb8d7ff,
  },
  vision_malric_mage: {
    id: 'vision_malric_mage',
    name: 'Vision of High Priest Malric',
    minLevel: 20,
    maxLevel: 20,
    family: 'humanoid',
    hpBase: 1,
    hpPerLevel: 0,
    dmgBase: 0,
    dmgPerLevel: 0,
    attackSpeed: 2,
    armorPerLevel: 0,
    moveSpeed: 0,
    aggroRadius: 0,
    loot: [],
    scale: 1.0,
    color: 0xc9b6ff,
  },
  vision_deathstalker_voss: {
    id: 'vision_deathstalker_voss',
    name: 'Vision of Royal Assassin Voss',
    minLevel: 20,
    maxLevel: 20,
    family: 'humanoid',
    hpBase: 1,
    hpPerLevel: 0,
    dmgBase: 0,
    dmgPerLevel: 0,
    attackSpeed: 2,
    armorPerLevel: 0,
    moveSpeed: 0,
    aggroRadius: 0,
    loot: [],
    scale: 1.0,
    color: 0xb8d7ff,
  },
  bound_guardian: {
    id: 'bound_guardian',
    name: 'The Bound Guardian',
    minLevel: 20,
    maxLevel: 20,
    family: 'undead',
    elite: true,
    boss: true,
    canSwim: true,
    ccImmune: true,
    respawnMult: 1000,
    hpBase: 310,
    hpPerLevel: 48,
    dmgBase: 16,
    dmgPerLevel: 3.4,
    attackSpeed: 2.4,
    armorPerLevel: 42,
    moveSpeed: 6.8,
    aggroRadius: 16,
    aoePulse: {
      min: 30,
      max: 44,
      radius: 10,
      every: 10,
      name: 'Sealbreak Shockwave',
      school: 'shadow',
    },
    summonAdds: { mobId: 'varkas_boneguard', count: 2, atHpPct: [0.5] },
    enrage: { belowHpPct: 0.25, dmgMult: 1.45, hasteMult: 1.25 },
    loot: [
      { copper: 1200, chance: 1 },
      { itemId: 'kings_signet', chance: 1, questId: 'q_nythraxis_bound_guardian' },
    ],
    scale: 1.35,
    color: 0xa8b0b8,
  },
  marrowlord_varkas: {
    id: 'marrowlord_varkas',
    name: 'Marrowlord Varkas',
    minLevel: 19,
    maxLevel: 19,
    family: 'undead',
    rare: true,
    elite: true,
    canSwim: true,
    ccImmune: true,
    // 144 * 25s base = 1 hour, so the epic-cloth-leg rare is farmable on a
    // predictable hourly cadence rather than the old 6-hour wait.
    respawnMult: 144,
    hpBase: 480,
    hpPerLevel: 80,
    dmgBase: 22,
    dmgPerLevel: 5.0,
    attackSpeed: 2.4,
    armorPerLevel: 44,
    moveSpeed: 6.5,
    aggroRadius: 13,
    aoePulse: { min: 30, max: 42, radius: 11, every: 9, name: 'Marrow Rot', school: 'shadow' },
    summonAdds: { mobId: 'varkas_boneguard', count: 2, atHpPct: [0.66, 0.33] },
    knockback: { chance: 0.25, distance: 6, name: 'Crushing Sweep' },
    stoneskin: { amount: 260, every: 14, duration: 8, name: 'Bone Carapace', school: 'shadow' },
    loot: [
      { copper: 650, chance: 1 },
      { itemId: 'bone_fragments', chance: 1 },
      { itemId: 'marrowlord_boneboots', chance: 0.3 },
      { itemId: 'necromancers_legwraps', chance: 0.25, rollGroup: 'marrowlord_varkas_chase' },
    ],
    scale: 1.25,
    color: 0xd8d0bd,
  },
  varkas_boneguard: {
    id: 'varkas_boneguard',
    name: 'Varkas Boneguard',
    minLevel: 18,
    maxLevel: 19,
    family: 'undead',
    hpBase: 64,
    hpPerLevel: 22,
    dmgBase: 12,
    dmgPerLevel: 2.8,
    attackSpeed: 2.3,
    armorPerLevel: 20,
    moveSpeed: 6.5,
    aggroRadius: 12,
    // Shattering Maul: a landed hit can crack the victim's guard, leaving them
    // taking +18% physical damage from every attacker for 8s.
    expose: { chance: 0.25, dmgIncrease: 0.18, duration: 8, name: 'Cracked Guard' },
    loot: [],
    scale: 1.0,
    color: 0xc9c2b5,
  },
  // Voskar the Emberwing — a young drake the Wyrmcult chained above the Sanctum
  // and starved into a weapon. The only dragonkin rare on the peaks: it breathes
  // fire in a wide cone, and its searing bite leaves wounds that refuse to close.
  voskar_emberwing: {
    id: 'voskar_emberwing',
    name: 'Voskar the Emberwing',
    minLevel: 19,
    maxLevel: 19,
    family: 'dragonkin',
    rare: true,
    elite: true,
    canSwim: true,
    ccImmune: true,
    respawnMult: 864,
    hpBase: 470,
    hpPerLevel: 78,
    dmgBase: 22,
    dmgPerLevel: 4.9,
    attackSpeed: 2.5,
    armorPerLevel: 42,
    moveSpeed: 7,
    aggroRadius: 13,
    aoePulse: {
      min: 30,
      max: 44,
      radius: 10,
      every: 9,
      name: 'Ember Breath',
      school: 'fire',
      fx: 'nova',
    },
    // Searing Maw: the drake's molten bite cauterizes flesh shut, blunting healing.
    mortalStrike: {
      chance: 0.35,
      healReduction: 0.5,
      duration: 8,
      name: 'Searing Maw',
      school: 'fire',
    },
    enrage: { belowHpPct: 0.3, dmgMult: 1.5, hasteMult: 1.3 },
    loot: [
      { copper: 700, chance: 1 },
      { itemId: 'emberwing_cinderscale', chance: 1 },
      { itemId: 'emberwing_legguards', chance: 0.25, rollGroup: 'voskar_emberwing_chase' },
      { itemId: 'emberfang_warblade', chance: 0.25, rollGroup: 'voskar_emberwing_chase' },
      { itemId: 'stormvotive_hauberk', chance: 0.2 },
    ],
    scale: 1.3,
    color: 0xe8702a,
  },
  // Thunzharr, the Waking Peak: the world boss of Thornpeak Heights. The
  // mountain at Stormcrag is no mountain at all: a primordial storm elemental the
  // Gravecallers' chanting keeps stirring loose. It rises on a fixed cadence (see
  // src/sim/world_boss.ts), bellows a server-wide warning, and rewards every player
  // who helps bring it down with personal loot (once per day). A genuine raid-tier
  // overworld fight: Thunderclap nova, a quaking stomp, summoned stormlings, a
  // crushing heave, a mountain-hide barrier, and a hard enrage in the last fifth.
  thunzharr_waking_peak: {
    id: 'thunzharr_waking_peak',
    name: 'Thunzharr, the Waking Peak',
    minLevel: 20,
    maxLevel: 20,
    family: 'elemental',
    worldBoss: true,
    boss: true,
    elite: true,
    canSwim: false,
    // The mountain does not path around camp furniture: every chase step walks
    // the straight line through fences, buildings, and the waterline, so he can
    // always go directly at his target and never wedges on a collider.
    phasesThroughObstacles: true,
    // His only periodic voice is the battle cry below (every ~45s, zone-wide). The
    // per-mechanic log barks ("unleashes Seismic Stomp/Tectonic Heave/Mountainhide!"
    // and "becomes enraged!") are silenced so an overworld pull does not spam the
    // combat log; the mechanics still fire with their spellfx and damage.
    quietMechanics: true,
    ccImmune: true,
    // A raid boss cannot be perma-snared by a wall of Frostbolts / Hamstrings: slows do
    // not stick to him (ccImmune already blocks stun/root/etc; slow is separate).
    slowImmune: true,
    // Raid-tier health: ~20k base at level 20, ~44k after the elite multiplier, a
    // sustained fight for a gathered raid, far above the solo/small-group rares
    // (Varkas and Bound Guardian scale the same way from ~2k / ~1.3k base).
    hpBase: 4000,
    hpPerLevel: 800,
    // Raid-tier melee, tuned to Nythraxis dps parity (content/dungeons.ts): at
    // level 20 after createMob's 1.5x elite multiplier this averages ~375 per
    // 2.4s swing vs Nythraxis ~406 per 2.6s, ~156 melee dps for both, so the
    // pull needs a healed tank exactly like the raid.
    dmgBase: 54,
    dmgPerLevel: 10.3,
    attackSpeed: 2.4,
    armorPerLevel: 46,
    // Faster than a player's base run speed (7, entity.ts): Thunzharr cannot be
    // outrun on foot, so there is no kite even before the Howling Gale snare lands.
    moveSpeed: 11.6,
    aggroRadius: 18,
    aoePulse: {
      min: 36,
      max: 50,
      radius: 12,
      every: 12,
      name: 'Thunderclap',
      school: 'nature',
      fx: 'nova',
    },
    stomp: {
      radius: 11,
      every: 24,
      // A short pin, not a shutdown: at 11.6 vs a base run of 7 the boss closes
      // about 7yd in 1.5s, enough to be on top of anyone caught mid-flight
      // without benching the raid for whole GCDs.
      duration: 1.5,
      min: 18,
      max: 28,
      name: 'Seismic Stomp',
      school: 'nature',
    },
    // Howling Gale: the anti-kite snare. Gale-force winds pin every player within 40yd
    // to 70% move speed for 6s, re-slammed every 5s (so uptime is permanent while you
    // stand in the storm, and the snare lingers if you flee the radius). Unlike the
    // other pulses this one also fires while Thunzharr is CHASING. With the boss now
    // outrunning base run speed (11.6 vs 7) the snare is a second layer: it keeps a
    // sprint-cooldown or speed-buffed runner from opening a gap. A gentle 30% snare,
    // not a hard 80% one: it denies a permanent kite without rooting the raid in place.
    aoeSlow: {
      radius: 40,
      mult: 0.7,
      duration: 6,
      every: 5,
      name: 'Howling Gale',
      school: 'nature',
    },
    summonAdds: { mobId: 'thunzharr_stormling', count: 2, atHpPct: [0.66, 0.33] },
    knockback: { chance: 0.3, distance: 7, name: 'Tectonic Heave' },
    stoneskin: { amount: 500, every: 27, duration: 9, name: 'Mountainhide', school: 'nature' },
    // Stormcall: the telegraphed hardcast. A 3.5s cast bar the whole raid can see
    // (and the yell announces), then a heavy nature nova on everyone within 30yd,
    // roughly double a Thunderclap pulse on a much longer cadence.
    bigCast: {
      castId: 'thunzharr_stormcall',
      name: 'Stormcall',
      castTime: 3.5,
      every: 40,
      radius: 30,
      min: 70,
      max: 90,
      school: 'nature',
      yell: 'The storm answers my call!',
    },
    yells: {
      engage: 'You wake the mountain? Then be buried by it!',
      summon: 'Rise, stormlings! Tear them loose from my slopes!',
      enrage: 'The peak breaks, and the sky falls with it!',
    },
    // Loud: a mountain-sized voice, and (with quietMechanics) his ONLY periodic
    // voice. Every yell (engage/summon/enrage + these battle cries) carries 350yd,
    // far past the 100yd default; he bellows one of these lines about every 45s in
    // combat, so the whole of Thornpeak knows he is awake without the log ever
    // filling with per-mechanic barks.
    battleYells: {
      every: 45,
      range: 350,
      lines: [
        'THUNDER ANSWERS! The peak has teeth again!',
        'Run, little climbers! The mountain runs faster!',
        'Every stone remembers your name, and none forgive!',
        'I am the storm the summit swallowed!',
      ],
    },
    enrage: { belowHpPct: 0.2, dmgMult: 1.5, hasteMult: 1.25 },
    // Personal loot table: rolled INDEPENDENTLY for every contributor (see
    // rollWorldBossLoot). A guaranteed storm trophy, plus AT MOST ONE epic Tier-2 set
    // piece. The glove group rolls first at ~32%; the belt group also rolls at ~32% but
    // the one-gear cap keeps it only when the glove roll missed, so its EFFECTIVE drop
    // rate is ~22% (0.68 x 0.32) and a single kill never hands out both a glove and a belt.
    // Keep the glove entries first if this ordering skew is ever retuned.
    loot: [
      { itemId: 'inert_storm_shard', chance: 1 },
      { itemId: 'crownforged_gauntlets', chance: 0.08, rollGroup: 'thunzharr_t2' },
      { itemId: 'nighttalon_grips', chance: 0.08, rollGroup: 'thunzharr_t2' },
      { itemId: 'soulflame_gloves', chance: 0.08, rollGroup: 'thunzharr_t2' },
      { itemId: 'stormcallers_handguards', chance: 0.08, rollGroup: 'thunzharr_t2' },
      { itemId: 'crownforged_girdle', chance: 0.08, rollGroup: 'thunzharr_t2_belt' },
      { itemId: 'nighttalon_waistband', chance: 0.08, rollGroup: 'thunzharr_t2_belt' },
      { itemId: 'soulflame_cord', chance: 0.08, rollGroup: 'thunzharr_t2_belt' },
      { itemId: 'stormcallers_waistguard', chance: 0.08, rollGroup: 'thunzharr_t2_belt' },
      { itemId: 'vestments_of_the_waking_grove', chance: 0.08, rollGroup: 'thunzharr_t2' },
    ],
    scale: 8, // a large, imposing world boss that reads on the skyline without being mountain-sized. Visual scale is DECOUPLED from combat reach: his melee is pinned to a ~17yd (scale-5) body in combatProfileForMob (mob_combat.ts), so his move speed and the Howling Gale snare, not a giant swing, are what keep him unkitable.
    color: 0x7d8a99,
  },
  // Stormlings: lesser storm elementals Thunzharr tears loose from itself at the
  // health thresholds above. Fast, fragile, and meant to split a raid's attention.
  thunzharr_stormling: {
    id: 'thunzharr_stormling',
    name: 'Roused Stormling',
    minLevel: 19,
    maxLevel: 20,
    family: 'elemental',
    hpBase: 70,
    hpPerLevel: 24,
    dmgBase: 13,
    dmgPerLevel: 2.9,
    attackSpeed: 2.0,
    armorPerLevel: 22,
    moveSpeed: 7.4,
    aggroRadius: 12,
    loot: [],
    scale: 0.95,
    color: 0x9fb3c8,
  },
};

// ---------------------------------------------------------------------------
// NPCs (Highwatch hub)
// ---------------------------------------------------------------------------

export const ZONE3_NPCS: Record<string, NpcDef> = {
  captain_thessaly: {
    id: 'captain_thessaly',
    name: 'Captain Thessaly',
    title: 'Highwatch Captain',
    pos: { x: 4, z: 664 },
    facing: -2.0,
    color: 0x85929e,
    questIds: [
      'q_highwatch_summons',
      'q_stalkers',
      'q_stalkers_return',
      'q_old_cragmaw',
      'q_ogre_bounty',
      'q_crushers',
      'q_drogmar',
      'q_revenants',
      'q_revenant_vanguard',
    ],
    greeting:
      'Two hundred years this wall has held, $C. It will not break on my watch — but it groans.',
  },
  brother_aldric_highwatch: {
    id: 'brother_aldric_highwatch',
    name: 'Brother Aldric',
    title: 'Priest of the Vale',
    pos: { x: -10, z: 656 },
    facing: 0.8,
    color: 0xf7f9f9,
    questIds: [
      'q_zealots',
      'q_cult_orders',
      'q_necromancers',
      'q_wyrm_sigils',
      'q_breaking_the_seal',
      'q_voice_below',
      'q_sanctum_gate',
      'q_velkhar',
      'q_gravewyrm',
      'q_nythraxis_restless_dead',
      'q_nythraxis_graves',
      'q_nythraxis_sealed_crypt',
      'q_nythraxis_bound_guardian',
      'q_nythraxis_scourges_end',
    ],
    greeting:
      'From a chapel yard in the Vale to the roof of the world... the trail we have followed ends here. I can feel the mountain listening.',
  },
  // Spawned dynamically inside the Crypt of Nythraxis encounter (see
  // spawnNythraxisAldric in sim.ts); `dynamic` keeps the world loader from
  // surface-placing him while still letting the client mirror him as a quest
  // turn-in NPC. pos/facing are unused — the encounter sets his position.
  brother_aldric_raid: {
    id: 'brother_aldric_raid',
    name: 'Brother Aldric',
    title: 'Priest of the Vale',
    pos: { x: 0, z: 0 },
    facing: 0,
    color: 0xd7d0b4,
    questIds: ['q_nythraxis_scourges_end'],
    dynamic: true,
    // Shares the Highwatch Aldric's name/title/greeting so all three entity
    // strings reuse his existing 13-locale translations (no new untranslated copy).
    greeting:
      'From a chapel yard in the Vale to the roof of the world... the trail we have followed ends here. I can feel the mountain listening.',
  },
  scout_maren_highwatch: {
    id: 'scout_maren_highwatch',
    name: 'Scout Maren',
    title: "Marshal's Scout",
    pos: { x: 7, z: 670 },
    facing: -2.4,
    color: 0x6e8b3d,
    questIds: ['q_ogre_edges', 'q_ogre_totems', 'q_korgath'],
    greeting:
      'I tracked cultists through the fen at your side, and the trail led here. The peaks are worse, $C. Stay sharp.',
  },
  quartermaster_bree: {
    id: 'quartermaster_bree',
    name: 'Quartermaster Bree',
    title: 'Highwatch Quartermaster',
    pos: { x: -5, z: 668 },
    facing: 1.6,
    color: 0xca8a2a,
    questIds: ['q_stalker_pelts', 'q_stalker_cloaks', 'q_glowing_wax'],
    vendorItems: [
      'trail_hardtack',
      'meltwater_flask',
      'roast_mountain_goat',
      'glacier_melt',
      'healing_potion',
      'mana_potion',
      'highwatch_breastplate',
      'peakwool_robe',
      'stalkerhide_jerkin',
      'cragwalker_boots',
      'windguard_leggings',
      // Gathering tools (#2343: every node harvest needs a matching tool, so
      // each zone hub stocks the tiers its own nodes use; Thornpeak has
      // tier-1 through tier-3 nodes). Tiered rods stay a Wilkes exclusive.
      'copper_mining_pick',
      'iron_mining_pick',
      'mithril_mining_pick',
      'handaxe',
      'felling_axe',
      'ironbark_axe',
      'gathering_sickle',
      'bronze_sickle',
      'silverleaf_sickle',
      'simple_fishing_pole',
      // Tier 4/5 station-recipe reagents (items.ts): Bree is the Highwatch
      // trade-goods vendor, so every station-bound (stationType) recipe has
      // a live reagent source (prog_tools_of_the_trade needs at least one
      // station craft to be possible).
      'thorium_ore',
      'arcanite_bar',
      'ashwood_log',
      'elderwood_log',
      'goldleaf_herb',
      'sunpetal_herb',
    ],
    greeting:
      'Wool, hardtack, and steel-shod boots — Highwatch runs on all three, and I am short of everything.',
  },
  armorer_hode: {
    id: 'armorer_hode',
    name: 'Armorer Hode',
    title: 'Master Armorer',
    pos: { x: -2, z: 672 },
    facing: 2.8,
    color: 0x717d7e,
    questIds: [],
    vendorItems: [
      'highwatch_warblade',
      'highwatch_greatsword',
      'highwatch_wallshield',
      'craghorn_staff',
      'icevein_dirk',
    ],
    greeting: 'Forge is hot and the grindstone is turning. If it cuts, I sell it.',
  },
  heroic_quartermaster: {
    id: 'heroic_quartermaster',
    name: 'Quartermaster Vex',
    title: 'Heroic Quartermaster',
    pos: { x: -8, z: 665 },
    facing: 1.2,
    color: 0x8e44ad,
    questIds: [],
    heroicVendor: true,
    greeting:
      'Proof of the heroic depths buys the finest rings and pendants in Highwatch. Show me your marks.',
  },
  loremaster_caddis: {
    id: 'loremaster_caddis',
    name: 'Loremaster Caddis',
    title: 'Loremaster',
    pos: { x: 12, z: 655 },
    facing: -1.2,
    color: 0x3b6ea5,
    questIds: ['q_kobold_tunnels', 'q_elementals', 'q_shard_cores', 'q_kazzix'],
    greeting:
      'Mind the loose shale, $C. The mountain has been... restless of late. I intend to learn why.',
  },
  // A second auctioneer: the same shared World Market as The Merchant in Eastbrook,
  // reachable up here in Highwatch so zone-3 players need not trek back to deal. A
  // distinct name and amethyst tint set her apart from the gold Eastbrook merchant.
  auctioneer_voss: {
    id: 'auctioneer_voss',
    name: 'Auctioneer Voss',
    title: 'Keeper of the World Market',
    pos: { x: 16, z: 666 },
    facing: -2.2,
    color: 0x8e5ad6,
    questIds: [],
    market: true,
    greeting:
      'The World Market is open here too, $C. Buy from every adventurer in the realm, or set out your own wares.',
  },
  bursar_aldous_crane: {
    id: 'bursar_aldous_crane',
    name: 'Bursar Aldous Crane',
    title: 'The Gilded Strongbox',
    pos: { x: -12, z: 663 },
    facing: Math.PI / 2,
    color: 0xc9a227,
    questIds: [],
    banker: true,
    greeting: 'Every crate, coffer, and trinket is safe with the Gilded Strongbox.',
  },
  chronicler_edda_hartwell: {
    // Display name renamed to Zenzie (maintainer call). The template id is
    // retained for save compatibility: player saves persist it as the
    // npc:chronicler_edda_hartwell visited mark, and it is the locale key stem.
    id: 'chronicler_edda_hartwell',
    name: 'Chronicler Zenzie',
    title: 'The Peaks Chronicle',
    // On the south road shoulder below the square, facing south over the road
    // up from Fenbridge (clear of the house footprint at {8,650}; nearest
    // authored neighbor ~15 units, she had been wedged into the gate cluster).
    pos: { x: 2, z: 643 },
    facing: 3.1,
    color: 0x5a6fd6, // cool indigo: the chronicler tint is her identity (shared mage visual)
    questIds: [],
    greeting: 'The mountain forgets nothing, $N, and neither do I. Let us see what you have done.',
  },
  // Crafting-station master (Professions 2.0): stands beside the
  // Highwatch apothecary (content/professions.ts STATIONS), east of the
  // well with a guard-safe camp margin.
  alchemist_verane: {
    id: 'alchemist_verane',
    name: 'Alchemist Verane',
    title: 'Master of the Apothecary',
    pos: { x: 8.5, z: 658 },
    facing: -0.4,
    color: 0x58b09c,
    // Professions 2.0: the Highwatch apothecary master runs the
    // repeatable alchemy work order.
    questIds: ['q_prof_workorder_apothecary'],
    vendorItems: [
      'minor_healing_potion',
      'minor_mana_potion',
      'lesser_healing_potion',
      'lesser_mana_potion',
      'elixir_of_the_bear',
      'glass_vial',
    ],
    greeting:
      'Measure twice and pour once, $C. The apothecary has no patience for spilled reagents.',
  },
};

// ---------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// World layout
// ---------------------------------------------------------------------------

export const ZONE3_CAMPS: CampDef[] = [
  // Training dummy: a single fixed practice target on the hill above Highwatch.
  { mobId: 'training_dummy', center: { x: -40, z: 648 }, radius: 0, count: 1 },
  // Ridge stalkers: the ridge flanking the road from the pass
  { mobId: 'ridge_stalker', center: { x: -50, z: 590 }, radius: 22, count: 7 },
  { mobId: 'ridge_stalker', center: { x: 45, z: 600 }, radius: 20, count: 6 },
  { mobId: 'old_cragmaw', center: { x: -82, z: 575 }, radius: 5, count: 1 },
  // Kobolds: Deeprock Burrows, west
  { mobId: 'deeprock_kobold', center: { x: 75, z: 625 }, radius: 18, count: 8 },
  { mobId: 'deeprock_kobold', center: { x: 105, z: 600 }, radius: 14, count: 6 },
  { mobId: 'ironvein_foreman', center: { x: 100, z: 617 }, radius: 5, count: 1 },
  // Ogres: eastern foothills rising to Drogmar's war-camp
  { mobId: 'thornpeak_ogre', center: { x: -90, z: 700 }, radius: 22, count: 7 },
  { mobId: 'thornpeak_ogre', center: { x: -60, z: 730 }, radius: 18, count: 6 },
  { mobId: 'ogre_crusher', center: { x: -125, z: 740 }, radius: 18, count: 8 },
  { mobId: 'warlord_drogmar', center: { x: -132, z: 748 }, radius: 2, count: 1 },
  // A lone rare ogre prowls the ridge north of the warband
  { mobId: 'brutok_skullsmasher', center: { x: -45, z: 768 }, radius: 4, count: 1 },
  // Elementals: Stormcrag, far west
  { mobId: 'stormcrag_elemental', center: { x: 110, z: 760 }, radius: 20, count: 8 },
  { mobId: 'stormcrag_elemental', center: { x: 135, z: 795 }, radius: 16, count: 6 },
  { mobId: 'shardlord_kazzix', center: { x: 145, z: 815 }, radius: 8, count: 1 },
  // Wyrmcult: tents below the Sanctum. The (25, 845) pack's radius clipped the
  // x=0 approach road, so it is nudged east to keep the central path clear; the
  // tents still flank the gate.
  { mobId: 'wyrmcult_zealot', center: { x: 55, z: 820 }, radius: 20, count: 8 },
  { mobId: 'wyrmcult_zealot', center: { x: 34, z: 845 }, radius: 16, count: 6 },
  { mobId: 'wyrmcult_necromancer', center: { x: 40, z: 855 }, radius: 14, count: 5 },
  // Revenants: the old battlefield (Revenant Fields). The second pack used to sit
  // at (-15, 860), right where the x=0 Sanctum Approach road ends and only ~20yd
  // from the gate, so (aggroRadius 11) it jumped players entering/exiting the
  // Sanctum. Pulled it back into the fields, off the central road and away from
  // the gate, so the approach stays a clear walk.
  { mobId: 'boneclad_revenant', center: { x: -40, z: 830 }, radius: 20, count: 8 },
  { mobId: 'boneclad_revenant', center: { x: -40, z: 838 }, radius: 16, count: 6 },
  { mobId: 'marrowlord_varkas', center: { x: -34, z: 842 }, radius: 5, count: 1 },
  // Voskar the Emberwing: perched on a scorched crag east of the Sanctum tents,
  // with two zealot drakebinders posted to keep their captive on its chain.
  { mobId: 'voskar_emberwing', center: { x: 80, z: 845 }, radius: 4, count: 1 },
  { mobId: 'wyrmcult_zealot', center: { x: 80, z: 845 }, radius: 7, count: 2 },
];

export const ZONE3_OBJECTS: GroundObjectDef[] = [
  {
    itemId: 'highwatch_summons',
    name: 'Highwatch Summons',
    positions: [
      { x: 1, z: 654 },
      { x: -2, z: 657 },
    ],
  },
  {
    itemId: 'ogre_war_totem',
    name: 'Ogre War Totem',
    positions: [
      { x: -116, z: 726 },
      { x: -122, z: 733 },
      { x: -129, z: 727 },
      { x: -136, z: 738 },
      { x: -140, z: 747 },
      { x: -133, z: 753 },
      { x: -124, z: 750 },
    ],
  },
  {
    itemId: 'gravewyrm_sigil',
    name: 'Gravewyrm Sigil',
    positions: [
      { x: -8, z: 852 },
      { x: -3, z: 857 },
      { x: 3, z: 861 },
      { x: 8, z: 866 },
    ],
  },
  {
    itemId: 'sanctum_key_shard',
    name: 'Sanctum Key Shard',
    positions: [
      { x: -6, z: 872 },
      { x: -2, z: 876 },
      { x: 2, z: 873 },
      { x: 6, z: 878 },
    ],
  },
  {
    itemId: 'grave_sir_aldren',
    name: 'Grave of Captain Aldren',
    positions: [{ x: 138, z: 838 }],
  },
  {
    itemId: 'grave_high_priest_malric',
    name: 'Grave of High Priest Malric',
    positions: [{ x: 141, z: 712 }],
  },
  {
    itemId: 'grave_captain_voss',
    name: 'Grave of Royal Assassin Voss',
    positions: [{ x: -139, z: 787 }],
  },
  {
    itemId: 'crypt_ritual_circle',
    name: 'Ritual Circle',
    positions: [{ x: 68, z: 800 }],
  },
];

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export const ZONE3_ITEMS: Record<string, ItemDef> = {
  // --- quest items ---
  highwatch_summons: {
    id: 'highwatch_summons',
    name: 'Highwatch Summons',
    kind: 'quest',
    sellValue: 0,
    questId: 'q_highwatch_summons',
  },
  ridge_stalker_pelt: {
    id: 'ridge_stalker_pelt',
    name: 'Ridge Stalker Pelt',
    kind: 'quest',
    sellValue: 0,
    questId: 'q_stalker_pelts',
  },
  glowing_wax: {
    id: 'glowing_wax',
    name: 'Glowing Wax',
    kind: 'quest',
    sellValue: 0,
    questId: 'q_glowing_wax',
  },
  ogre_war_totem: {
    id: 'ogre_war_totem',
    name: 'Ogre War Totem',
    kind: 'quest',
    sellValue: 0,
    questId: 'q_ogre_totems',
  },
  storm_core: {
    id: 'storm_core',
    name: 'Storm Core',
    kind: 'quest',
    sellValue: 0,
    questId: 'q_shard_cores',
  },
  kazzix_heartshard: {
    id: 'kazzix_heartshard',
    name: "Kazzix's Heartshard",
    kind: 'quest',
    sellValue: 0,
    questId: 'q_kazzix',
  },
  wyrmcult_orders: {
    id: 'wyrmcult_orders',
    name: 'Wyrmcult Orders',
    kind: 'quest',
    sellValue: 0,
    questId: 'q_cult_orders',
  },
  ritual_phylactery: {
    id: 'ritual_phylactery',
    name: 'Ritual Phylactery',
    kind: 'quest',
    sellValue: 0,
    questId: 'q_necromancers',
  },
  gravewyrm_sigil: {
    id: 'gravewyrm_sigil',
    name: 'Gravewyrm Sigil',
    kind: 'quest',
    sellValue: 0,
    questId: 'q_wyrm_sigils',
  },
  blessed_embers: {
    id: 'blessed_embers',
    name: 'Blessed Embers',
    kind: 'quest',
    sellValue: 0,
    questId: 'q_breaking_the_seal',
  },
  sanctum_key_shard: {
    id: 'sanctum_key_shard',
    name: 'Sanctum Key Shard',
    kind: 'quest',
    sellValue: 0,
    questId: 'q_sanctum_gate',
  },
  runed_bone_shard: {
    id: 'runed_bone_shard',
    name: 'Runed Bone Shard',
    kind: 'quest',
    sellValue: 0,
    questId: 'q_nythraxis_restless_dead',
  },
  grave_sir_aldren: {
    id: 'grave_sir_aldren',
    name: 'Grave of Captain Aldren',
    kind: 'quest',
    sellValue: 0,
    questId: 'q_nythraxis_graves',
  },
  grave_high_priest_malric: {
    id: 'grave_high_priest_malric',
    name: 'Grave of High Priest Malric',
    kind: 'quest',
    sellValue: 0,
    questId: 'q_nythraxis_graves',
  },
  grave_captain_voss: {
    id: 'grave_captain_voss',
    name: 'Grave of Royal Assassin Voss',
    kind: 'quest',
    sellValue: 0,
    questId: 'q_nythraxis_graves',
  },
  ancient_crypt_door: {
    id: 'ancient_crypt_door',
    name: 'Ancient Crypt Door',
    kind: 'quest',
    sellValue: 0,
    questId: 'q_nythraxis_sealed_crypt',
  },
  captains_crest: {
    id: 'captains_crest',
    name: 'Crypt Keystone Upper',
    kind: 'quest',
    sellValue: 0,
    questId: 'q_nythraxis_sealed_crypt',
  },
  priests_sigil: {
    id: 'priests_sigil',
    name: 'Crypt Keystone Lower',
    kind: 'quest',
    sellValue: 0,
    questId: 'q_nythraxis_sealed_crypt',
  },
  royal_seal: {
    id: 'royal_seal',
    name: 'Ancient Diary',
    kind: 'quest',
    sellValue: 0,
    questId: 'q_nythraxis_sealed_crypt',
  },
  crypt_keystone: {
    id: 'crypt_keystone',
    name: 'Crypt Keystone',
    kind: 'quest',
    quality: 'uncommon',
    sellValue: 0,
    questId: 'q_nythraxis_bound_guardian',
  },
  crypt_ritual_circle: {
    id: 'crypt_ritual_circle',
    name: 'Ritual Circle',
    kind: 'quest',
    sellValue: 0,
    questId: 'q_nythraxis_bound_guardian',
  },
  kings_signet: {
    id: 'kings_signet',
    name: "King's Signet",
    kind: 'quest',
    quality: 'rare',
    sellValue: 0,
    questId: 'q_nythraxis_bound_guardian',
  },
  // --- quest greens (uncommon) ---
  ridgestalker_treads: {
    id: 'ridgestalker_treads',
    name: 'Ridgestalker Treads',
    kind: 'armor',
    armorType: 'cloth',
    slot: 'feet',
    quality: 'uncommon',
    stats: { armor: 50, agi: 3, vit: 2 },
    sellValue: 600,
  },
  // --- Old Cragmaw drops ---
  // Old Cragmaw's signature trophy, guaranteed to the slayer of the rare elite.
  // Pure vendor value, no quest tie, so it always feels like a boss-kill reward
  // and never blocks a turn-in.
  old_cragmaws_pelt: {
    id: 'old_cragmaws_pelt',
    name: "Old Cragmaw's Pelt",
    kind: 'junk',
    quality: 'common',
    sellValue: 300,
  },
  // Old Cragmaw's rare drop, a notch above the Ridgestalker Treads. Leather,
  // so it stays unrestricted by class.
  cragmaw_prowlboots: {
    id: 'cragmaw_prowlboots',
    name: 'Cragmaw Prowlboots',
    kind: 'armor',
    armorType: 'leather',
    slot: 'feet',
    quality: 'rare',
    stats: { armor: 58, agi: 5, vit: 3 },
    sellValue: 750,
  },
  // A waist piece to pair with the Prowlboots: agi-leaning leather, waist armor
  // sits a touch under the feet slot. Drops less often than the boots.
  cragmaw_huntcord: {
    id: 'cragmaw_huntcord',
    name: "Cragmaw's Huntcord",
    kind: 'armor',
    armorType: 'leather',
    slot: 'waist',
    quality: 'rare',
    stats: { armor: 44, agi: 5, vit: 3 },
    sellValue: 340,
  },
  // --- Level-20 endgame loot: Korzul (5-player Gravewyrm Sanctum) and Nythraxis
  // (10-player raid). Every piece below is NORMALIZED to the stat budget its item
  // level earns (see src/sim/item_level.ts): item level = level 20 + quality bonus,
  // plus a raid bonus for Nythraxis drops, so the raid set reads a tier above the
  // dungeon set. Within each (item level, quality, slot) group the primary-stat sum
  // is identical while each piece keeps its own stat identity (plate str/sta, cloth
  // int/spi, leather agi/sta). tests/item_level.test.ts pins data == formula. ---
  boneplate_vest: {
    id: 'boneplate_vest',
    name: 'Boneplate Vest',
    kind: 'armor',
    armorType: 'mail',
    slot: 'chest',
    quality: 'uncommon',
    stats: { armor: 170, vit: 5, str: 3 },
    sellValue: 800,
    requiredClass: ['warrior', 'paladin', 'shaman'],
  },
  revenant_silk_robe: {
    id: 'revenant_silk_robe',
    name: 'Revenant Silk Robe',
    kind: 'armor',
    armorType: 'cloth',
    slot: 'chest',
    quality: 'uncommon',
    stats: { armor: 60, int: 5, luk: 3 },
    sellValue: 800,
    requiredClass: ['mage', 'priest', 'warlock', 'druid'],
  },
  nightwalk_jerkin: {
    id: 'nightwalk_jerkin',
    name: 'Nightwalk Jerkin',
    kind: 'armor',
    armorType: 'leather',
    slot: 'chest',
    quality: 'uncommon',
    stats: { armor: 105, agi: 6, vit: 2 },
    sellValue: 800,
    requiredClass: ['rogue', 'hunter'],
  },
  zealotsbane_blade: {
    id: 'zealotsbane_blade',
    name: 'Zealotsbane Blade',
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'uncommon',
    weapon: { min: 18, max: 29, speed: 2.3 },
    stats: { str: 6, vit: 2 },
    sellValue: 900,
    requiredClass: ['warrior', 'rogue', 'hunter', 'shaman', 'paladin'],
  },
  emberwood_staff: {
    id: 'emberwood_staff',
    name: 'Emberwood Staff',
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'uncommon',
    weapon: { min: 20, max: 33, speed: 3.0 },
    stats: { int: 6, luk: 2 },
    sellValue: 900,
    requiredClass: ['mage', 'priest', 'warlock', 'shaman', 'paladin', 'druid'],
  },
  cultist_flayer: {
    id: 'cultist_flayer',
    name: 'Cultist Flayer',
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'uncommon',
    weapon: { min: 12, max: 19, speed: 1.7, dagger: true },
    stats: { agi: 8 },
    sellValue: 900,
    requiredClass: ['rogue', 'hunter'],
  },
  drogmar_warboots: {
    id: 'drogmar_warboots',
    name: "Drogmar's Warboots",
    kind: 'armor',
    armorType: 'mail',
    slot: 'feet',
    quality: 'uncommon',
    stats: { armor: 85, str: 3, vit: 4 },
    sellValue: 950,
    requiredClass: ['warrior', 'paladin', 'shaman'],
  },
  ironvein_pickblade: {
    id: 'ironvein_pickblade',
    name: 'Ironvein Pickblade',
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'uncommon',
    weapon: { min: 13, max: 21, speed: 1.8, dagger: true },
    stats: { agi: 7, vit: 2 },
    sellValue: 950,
    requiredClass: ['rogue', 'hunter'],
  },
  ironvein_lantern_staff: {
    id: 'ironvein_lantern_staff',
    name: 'Ironvein Lantern Staff',
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'uncommon',
    weapon: { min: 19, max: 31, speed: 3.0 },
    stats: { int: 7, luk: 3 },
    sellValue: 950,
    requiredClass: ['mage', 'priest', 'warlock', 'shaman', 'paladin', 'druid'],
  },
  marrowlord_boneboots: {
    id: 'marrowlord_boneboots',
    name: 'Marrowlord Boneboots',
    kind: 'armor',
    armorType: 'mail',
    slot: 'feet',
    quality: 'uncommon',
    stats: { armor: 90, vit: 5, str: 2 },
    sellValue: 1050,
    requiredClass: ['warrior', 'paladin', 'shaman'],
  },
  // Brutok Skullsmasher (rare ogre) — guaranteed trophy + warbelt
  skullsmasher_warbelt: {
    id: 'skullsmasher_warbelt',
    name: "Skullsmasher's Warbelt",
    kind: 'armor',
    armorType: 'mail',
    slot: 'chest',
    quality: 'uncommon',
    stats: { armor: 96, vit: 5, str: 3 },
    sellValue: 1050,
  },
  // Voskar the Emberwing drops (rare elite dragonkin)
  emberwing_cinderscale: {
    id: 'emberwing_cinderscale',
    name: 'Emberwing Cinderscale',
    kind: 'junk',
    quality: 'common',
    sellValue: 320,
  },
  emberwing_legguards: {
    id: 'emberwing_legguards',
    name: 'Emberwing Legguards',
    kind: 'armor',
    armorType: 'mail',
    slot: 'legs',
    quality: 'rare',
    stats: { armor: 120, vit: 6, str: 4 },
    sellValue: 2200,
    requiredClass: ['warrior', 'paladin', 'shaman'],
  },
  emberfang_warblade: {
    id: 'emberfang_warblade',
    name: 'Emberfang Warblade',
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'rare',
    weapon: { min: 26, max: 41, speed: 2.5 },
    stats: { str: 8, vit: 3 },
    sellValue: 2400,
    requiredClass: ['warrior', 'rogue', 'hunter', 'shaman', 'paladin'],
  },
  // --- quest & dungeon blues (rare) ---
  // Brutok Skullsmasher chase weapons (mutually exclusive: brutok_chase)
  brutoks_maul: {
    id: 'brutoks_maul',
    name: "Brutok's Maul",
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'rare',
    weapon: { min: 24, max: 37, speed: 2.7 },
    stats: { str: 8, vit: 3 },
    sellValue: 2000,
    requiredClass: ['warrior', 'rogue', 'hunter', 'shaman', 'paladin'],
  },
  crag_warden_cudgel: {
    id: 'crag_warden_cudgel',
    name: 'Crag Warden Cudgel',
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'rare',
    weapon: { min: 23, max: 36, speed: 3.0 },
    stats: { int: 8, luk: 4 },
    sellValue: 2000,
    requiredClass: ['mage', 'priest', 'warlock', 'shaman', 'paladin', 'druid'],
  },
  skullsplitter_dirk: {
    id: 'skullsplitter_dirk',
    name: 'Skullsplitter Dirk',
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'rare',
    weapon: { min: 15, max: 23, speed: 1.7, dagger: true },
    stats: { agi: 8, vit: 3 },
    sellValue: 2000,
    requiredClass: ['rogue', 'hunter'],
  },
  drogmars_skullcleaver: {
    id: 'drogmars_skullcleaver',
    name: "Drogmar's Skullcleaver",
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'rare',
    weapon: { min: 22, max: 35, speed: 2.6 },
    stats: { str: 7, vit: 4 },
    sellValue: 2000,
    requiredClass: ['warrior', 'rogue', 'hunter', 'shaman', 'paladin'],
  },
  ogre_bonecharm_staff: {
    id: 'ogre_bonecharm_staff',
    name: 'Ogre Bonecharm Staff',
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'rare',
    weapon: { min: 24, max: 38, speed: 3.0 },
    stats: { int: 9, luk: 4 },
    sellValue: 2000,
    requiredClass: ['mage', 'priest', 'warlock', 'shaman', 'paladin', 'druid'],
  },
  gutripper_shiv: {
    id: 'gutripper_shiv',
    name: 'Gutripper Shiv',
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'rare',
    weapon: { min: 14, max: 22, speed: 1.7, dagger: true },
    stats: { agi: 8, vit: 3 },
    sellValue: 2000,
    requiredClass: ['rogue', 'hunter'],
  },
  stormshard_leggings: {
    id: 'stormshard_leggings',
    name: 'Stormshard Leggings',
    kind: 'armor',
    armorType: 'cloth',
    slot: 'legs',
    quality: 'rare',
    stats: { armor: 110, vit: 5 },
    sellValue: 1800,
  },
  korgaths_chainwraps: {
    id: 'korgaths_chainwraps',
    name: "Korgath's Chainwraps",
    kind: 'armor',
    armorType: 'cloth',
    slot: 'legs',
    quality: 'rare',
    stats: { armor: 125, vit: 12 },
    sellValue: 2200,
  },
  boneguard_breastplate: {
    id: 'boneguard_breastplate',
    name: 'Boneguard Breastplate',
    kind: 'armor',
    armorType: 'mail',
    slot: 'chest',
    quality: 'rare',
    stats: { armor: 210, vit: 8, str: 5 },
    sellValue: 2500,
    requiredClass: ['warrior', 'paladin', 'shaman'],
  },
  staff_of_velkhar: {
    id: 'staff_of_velkhar',
    name: 'Staff of Velkhar',
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'rare',
    weapon: { min: 27, max: 43, speed: 3.0 },
    stats: { int: 9, luk: 4 },
    sellValue: 2500,
    requiredClass: ['mage', 'priest', 'warlock', 'shaman', 'paladin', 'druid'],
  },
  shadowmeld_tunic: {
    id: 'shadowmeld_tunic',
    name: 'Nightveil Tunic',
    kind: 'armor',
    armorType: 'leather',
    slot: 'chest',
    quality: 'rare',
    stats: { armor: 130, agi: 9, vit: 4 },
    sellValue: 2500,
    requiredClass: ['rogue', 'hunter'],
  },
  gravewyrm_scale_hauberk: {
    id: 'gravewyrm_scale_hauberk',
    name: 'Gravewyrm Scale Hauberk',
    kind: 'armor',
    armorType: 'mail',
    slot: 'chest',
    quality: 'rare',
    stats: { armor: 230, vit: 8, str: 5 },
    sellValue: 3000,
    requiredClass: ['warrior', 'paladin', 'shaman'],
  },
  wyrmcult_grand_robe: {
    id: 'wyrmcult_grand_robe',
    name: 'Wyrmcult Grand Robe',
    kind: 'armor',
    armorType: 'cloth',
    slot: 'chest',
    quality: 'rare',
    stats: { armor: 75, int: 9, luk: 4 },
    sellValue: 3000,
    requiredClass: ['mage', 'priest', 'warlock', 'druid'],
  },
  wyrmscale_jerkin: {
    id: 'wyrmscale_jerkin',
    name: 'Wyrmscale Jerkin',
    kind: 'armor',
    armorType: 'leather',
    slot: 'chest',
    quality: 'rare',
    stats: { armor: 145, agi: 9, vit: 4 },
    sellValue: 3000,
    requiredClass: ['rogue', 'hunter'],
  },
  gravewyrm_stalkers_treads: {
    id: 'gravewyrm_stalkers_treads',
    name: "Gravewyrm Stalker's Treads",
    kind: 'armor',
    armorType: 'leather',
    slot: 'feet',
    quality: 'rare',
    stats: { armor: 105, agi: 5, vit: 3 },
    sellValue: 3200,
    requiredClass: ['rogue', 'hunter'],
  },
  gravewyrm_sabatons: {
    id: 'gravewyrm_sabatons',
    name: 'Gravewyrm Sabatons',
    kind: 'armor',
    armorType: 'mail',
    slot: 'feet',
    quality: 'rare',
    stats: { armor: 145, str: 4, vit: 4 },
    sellValue: 3200,
    requiredClass: ['warrior', 'paladin', 'shaman'],
  },
  wyrmcult_soulsteps: {
    id: 'wyrmcult_soulsteps',
    name: 'Wyrmcult Soulsteps',
    kind: 'armor',
    armorType: 'cloth',
    slot: 'feet',
    quality: 'rare',
    stats: { armor: 68, int: 5, luk: 3 },
    sellValue: 3200,
    requiredClass: ['mage', 'priest', 'warlock', 'druid'],
  },
  deathlord_warplate: {
    id: 'deathlord_warplate',
    set: 'deathlord',
    name: 'Barrowlord Warplate',
    kind: 'armor',
    armorType: 'mail',
    slot: 'chest',
    quality: 'epic',
    stats: { armor: 270, str: 8, vit: 10 },
    sellValue: 9000,
    requiredClass: ['warrior', 'paladin', 'shaman'],
  },
  necromancers_starshroud: {
    id: 'necromancers_starshroud',
    set: 'necromancers',
    name: 'Mournweave Starshroud',
    kind: 'armor',
    armorType: 'cloth',
    slot: 'chest',
    quality: 'epic',
    stats: { armor: 92, int: 11, luk: 7 },
    sellValue: 9000,
    requiredClass: ['mage', 'priest', 'warlock', 'druid'],
  },
  wyrmshadow_harness: {
    id: 'wyrmshadow_harness',
    set: 'wyrmshadow',
    name: 'Nightfang Harness',
    kind: 'armor',
    armorType: 'leather',
    slot: 'chest',
    quality: 'epic',
    stats: { armor: 170, agi: 12, vit: 6 },
    sellValue: 9000,
    requiredClass: ['rogue', 'hunter'],
  },
  deathlord_legguards: {
    id: 'deathlord_legguards',
    set: 'deathlord',
    name: 'Barrowlord Legguards',
    kind: 'armor',
    armorType: 'mail',
    slot: 'legs',
    quality: 'epic',
    stats: { armor: 240, str: 8, vit: 8 },
    sellValue: 9000,
    requiredClass: ['warrior', 'paladin', 'shaman'],
  },
  deathlord_sabatons: {
    id: 'deathlord_sabatons',
    set: 'deathlord',
    name: 'Barrowlord Sabatons',
    kind: 'armor',
    armorType: 'mail',
    slot: 'feet',
    quality: 'epic',
    stats: { armor: 205, str: 7, vit: 8 },
    sellValue: 9000,
    requiredClass: ['warrior', 'paladin', 'shaman'],
  },
  necromancers_soulsteps: {
    id: 'necromancers_soulsteps',
    set: 'necromancers',
    name: 'Mournweave Soulsteps',
    kind: 'armor',
    armorType: 'cloth',
    slot: 'feet',
    quality: 'epic',
    stats: { armor: 80, int: 8, luk: 4 },
    sellValue: 9000,
    requiredClass: ['mage', 'priest', 'warlock', 'druid'],
  },
  necromancers_legwraps: {
    id: 'necromancers_legwraps',
    set: 'necromancers',
    name: 'Mournweave Legwraps',
    kind: 'armor',
    armorType: 'cloth',
    slot: 'legs',
    quality: 'epic',
    stats: { armor: 86, int: 13, luk: 7 },
    sellValue: 9000,
    requiredClass: ['mage', 'priest', 'warlock', 'druid'],
  },
  wyrmshadow_treads: {
    id: 'wyrmshadow_treads',
    set: 'wyrmshadow',
    name: 'Nightfang Treads',
    kind: 'armor',
    armorType: 'leather',
    slot: 'feet',
    quality: 'epic',
    stats: { armor: 145, agi: 7, vit: 5 },
    sellValue: 9000,
    requiredClass: ['rogue', 'hunter'],
  },
  wyrmshadow_legguards: {
    id: 'wyrmshadow_legguards',
    set: 'wyrmshadow',
    name: 'Nightfang Legguards',
    kind: 'armor',
    armorType: 'leather',
    slot: 'legs',
    quality: 'epic',
    stats: { armor: 155, agi: 10, vit: 6 },
    sellValue: 9000,
    requiredClass: ['rogue', 'hunter'],
  },
  // --- the three epics (Korzul drops) ---
  wyrmfang_greatblade: {
    id: 'wyrmfang_greatblade',
    name: 'Wyrmfang Greatblade',
    kind: 'weapon',
    slot: 'mainhand',
    hand: 'twohand',
    quality: 'epic',
    // 2H dps premium: weaponDpsBudget(26) = 14.5 x TWOHAND_DPS_MULT -> 16.7 dps
    // (this pre-dated the Eastbrook/Highwatch rule and sat on the flat curve).
    weapon: { min: 33, max: 53, speed: 2.6 },
    // v0.27.1 re-budget: round(primaryStatBudget(26, epic, mainhand) = 18 x
    // TWOHAND_STAT_MULT) = 23 points; a 2H's compensation lives on the dps side.
    stats: { str: 14, vit: 9 },
    sellValue: 8000,
    requiredClass: ['warrior', 'hunter', 'shaman', 'paladin'],
  },
  staff_of_the_gravewyrm: {
    id: 'staff_of_the_gravewyrm',
    name: 'Staff of the Gravewyrm',
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'epic',
    weapon: { min: 32, max: 52, speed: 3.0 },
    stats: { int: 12, luk: 6 },
    sellValue: 8000,
    requiredClass: ['mage', 'priest', 'warlock', 'shaman', 'paladin', 'druid'],
  },
  fang_of_korzul: {
    id: 'fang_of_korzul',
    name: 'Fang of Korzul',
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'epic',
    weapon: { min: 19, max: 30, speed: 1.7, dagger: true },
    stats: { agi: 12, vit: 6 },
    sellValue: 8000,
    requiredClass: ['rogue', 'hunter'],
  },
  // --- Inventory 2.0 epics: one per armor archetype, filling the new slots and
  // named into the existing Barrowlord/Mournweave/Nightfang Korzul epic families.
  // Stat budget is slot-weighted off the item-level formula (src/sim/item_level.ts),
  // so each lands a notch under its chest epic and slots cleanly into its set. ---
  deathlords_dread_visage: {
    id: 'deathlords_dread_visage',
    set: 'deathlord',
    name: 'Barrowlord Dread Visage',
    kind: 'armor',
    armorType: 'mail',
    slot: 'helmet',
    quality: 'epic',
    stats: { armor: 245, str: 7, vit: 8 },
    sellValue: 9000,
    requiredClass: ['warrior', 'paladin', 'shaman'],
  },
  necromancers_soulspire_mantle: {
    id: 'necromancers_soulspire_mantle',
    set: 'necromancers',
    name: 'Mournweave Soulspire Mantle',
    kind: 'armor',
    armorType: 'cloth',
    slot: 'shoulder',
    quality: 'epic',
    stats: { armor: 70, int: 9, luk: 5 },
    sellValue: 9000,
    requiredClass: ['mage', 'priest', 'warlock', 'druid'],
  },
  wyrmshadow_talongrips: {
    id: 'wyrmshadow_talongrips',
    set: 'wyrmshadow',
    name: 'Nightfang Talongrips',
    kind: 'armor',
    armorType: 'leather',
    slot: 'gloves',
    quality: 'epic',
    stats: { armor: 110, agi: 9, vit: 4 },
    sellValue: 9000,
    requiredClass: ['rogue', 'hunter'],
  },
  // --- Thunzharr, the Waking Peak (world boss): epic GLOVES that extend the
  // Tier-2 set families to a third piece. Named and stat-shaped to match each
  // family's existing helm/shoulder. The `set` tag wires each into its family. ---
  crownforged_gauntlets: {
    id: 'crownforged_gauntlets',
    name: 'Bonewrought Gauntlets',
    kind: 'armor',
    slot: 'gloves',
    armorType: 'mail',
    quality: 'epic',
    stats: { armor: 180, str: 6, vit: 7 },
    sellValue: 3600,
    requiredClass: ['warrior', 'paladin'],
    set: 'crownforged', // 3rd Bonewrought piece, unlocks the set's 3-piece bonus
  },
  nighttalon_grips: {
    id: 'nighttalon_grips',
    name: 'Direfang Grips',
    kind: 'armor',
    slot: 'gloves',
    armorType: 'leather',
    quality: 'epic',
    stats: { armor: 110, agi: 8, vit: 5 },
    sellValue: 3600,
    requiredClass: ['rogue', 'hunter', 'druid'],
    set: 'nighttalon', // 3rd Direfang piece, unlocks the set's 3-piece bonus
  },
  soulflame_gloves: {
    id: 'soulflame_gloves',
    name: 'Wraithfire Gloves',
    kind: 'armor',
    slot: 'gloves',
    armorType: 'cloth',
    quality: 'epic',
    stats: { armor: 60, int: 8, vit: 5 },
    sellValue: 3600,
    requiredClass: ['mage', 'priest', 'warlock', 'druid'],
    set: 'soulflame', // 3rd Wraithfire piece, unlocks the set's 3-piece bonus
  },
  stormcallers_handguards: {
    id: 'stormcallers_handguards',
    name: 'Galecall Handguards',
    kind: 'armor',
    slot: 'gloves',
    armorType: 'mail',
    quality: 'epic',
    stats: { armor: 130, int: 8, vit: 5 },
    sellValue: 3600,
    requiredClass: ['shaman'],
    set: 'stormcallers', // 3rd Galecall piece, unlocks the set's 3-piece bonus
  },
  // --- Thunzharr, the Waking Peak (world boss): epic BELTS, each family's fourth
  // piece (helm, shoulder, glove, belt), alongside the glove drops above. ---
  crownforged_girdle: {
    id: 'crownforged_girdle',
    name: 'Bonewrought Girdle',
    kind: 'armor',
    slot: 'waist',
    armorType: 'mail',
    quality: 'epic',
    stats: { armor: 150, str: 7, vit: 6 },
    sellValue: 3600,
    requiredClass: ['warrior', 'paladin'],
    set: 'crownforged',
  },
  nighttalon_waistband: {
    id: 'nighttalon_waistband',
    name: 'Direfang Waistband',
    kind: 'armor',
    slot: 'waist',
    armorType: 'leather',
    quality: 'epic',
    stats: { armor: 95, agi: 8, vit: 5 },
    sellValue: 3600,
    requiredClass: ['rogue', 'hunter', 'druid'],
    set: 'nighttalon',
  },
  soulflame_cord: {
    id: 'soulflame_cord',
    name: 'Wraithfire Cord',
    kind: 'armor',
    slot: 'waist',
    armorType: 'cloth',
    quality: 'epic',
    stats: { armor: 50, int: 8, luk: 5 },
    sellValue: 3600,
    requiredClass: ['mage', 'priest', 'warlock', 'druid'],
    set: 'soulflame',
  },
  stormcallers_waistguard: {
    id: 'stormcallers_waistguard',
    name: 'Galecall Waistguard',
    kind: 'armor',
    slot: 'waist',
    armorType: 'mail',
    quality: 'epic',
    stats: { armor: 110, int: 8, vit: 5 },
    sellValue: 3600,
    requiredClass: ['shaman'],
    set: 'stormcallers',
  },
  deathless_heartwood: {
    id: 'deathless_heartwood',
    name: 'Heartwood of the Deathless Crown',
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'legendary',
    weapon: { min: 42, max: 68, speed: 3.2 },
    // A druid caster/healer staff by deliberate choice: its 17 points sit in
    // spirit (druid mana/healing) rather than agility, accepting that feral
    // wearers lose real value from the swap (bear-form AP scales on agility).
    // Hunters/rogues cannot equip it. Still exactly on the 44-pt legendary
    // mainhand budget.
    stats: { luk: 17, vit: 13, int: 14 },
    sellValue: 25000,
    requiredClass: ['mage', 'priest', 'warlock', 'shaman', 'paladin', 'druid'],
    // Life and decay: a damaging spell may fester a nature DoT (Deathbloom); a heal
    // may bloom a nature heal-over-time on its target (Lifebloom).
    weaponProcs: [
      {
        id: 'deathbloom',
        name: 'Deathbloom',
        trigger: 'spellDamage',
        chance: 0.15,
        effects: [
          {
            kind: 'dot',
            name: 'Deathbloom',
            school: 'nature',
            perTick: 12,
            interval: 2,
            duration: 8,
          },
        ],
      },
      {
        id: 'lifebloom',
        name: 'Lifebloom',
        trigger: 'heal',
        chance: 0.15,
        effects: [{ kind: 'hot', name: 'Lifebloom', perTick: 10, interval: 2, duration: 8 }],
      },
    ],
  },
  kingsbane_last_oath: {
    id: 'kingsbane_last_oath',
    name: 'Thronebane, Last Oath of Thornpeak',
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'legendary',
    weapon: { min: 46, max: 74, speed: 2.8 },
    // Rebalanced into a str/agi/sta hybrid within the fixed 44-pt legendary
    // mainhand budget: 15 agi makes it a viable hunter ranged weapon (ranged AP +
    // crit) while it stays usable by its warrior/paladin owners.
    stats: { str: 15, agi: 15, vit: 14 },
    sellValue: 25000,
    requiredClass: ['warrior', 'rogue', 'hunter', 'shaman', 'paladin'],
    // Thunderfury-style on-hit: a nature arc that blasts the target and chains to
    // nearby foes, and slows the primary target's attack speed.
    weaponProcs: [
      {
        id: 'thronebane_arc',
        name: 'Chain Arc',
        // Fires on any weapon strike: a melee swing for its warrior/paladin owners,
        // or a hunter's Auto Shot (which shoots this same weapon).
        trigger: 'weaponHit',
        chance: 0.1,
        effects: [
          { kind: 'chainArc', school: 'nature', damage: 42, jumps: 3, falloff: 0.6, radius: 8 },
          { kind: 'attackSlow', name: 'Thunderclap', mult: 1.2, duration: 6 },
        ],
      },
    ],
  },
  crownforged_dreadhelm: {
    id: 'crownforged_dreadhelm',
    set: 'crownforged',
    name: 'Bonewrought Dreadhelm',
    kind: 'armor',
    armorType: 'mail',
    slot: 'helmet',
    quality: 'epic',
    stats: { armor: 310, str: 8, vit: 9 },
    // ilvl-29 raid seed rating (20 -> 2.0%); the Heroic raid variant scales this up
    // and adds a complementary secondary (heroic_variants.ts). Off the stat budget.
    hitRating: 20,
    sellValue: 12000,
    requiredClass: ['warrior', 'paladin'],
  },
  crownforged_warspaulders: {
    id: 'crownforged_warspaulders',
    set: 'crownforged',
    name: 'Bonewrought Warspaulders',
    kind: 'armor',
    armorType: 'mail',
    slot: 'shoulder',
    quality: 'epic',
    stats: { armor: 260, str: 7, vit: 8 },
    hitRating: 20,
    sellValue: 12000,
    requiredClass: ['warrior', 'paladin'],
  },
  nighttalon_crown: {
    id: 'nighttalon_crown',
    set: 'nighttalon',
    name: 'Direfang Crown',
    kind: 'armor',
    armorType: 'leather',
    slot: 'helmet',
    quality: 'epic',
    stats: { armor: 190, agi: 10, vit: 7 },
    hitRating: 20,
    sellValue: 12000,
    requiredClass: ['rogue', 'hunter', 'druid'],
  },
  nighttalon_shoulderguards: {
    id: 'nighttalon_shoulderguards',
    set: 'nighttalon',
    name: 'Direfang Shoulderguards',
    kind: 'armor',
    armorType: 'leather',
    slot: 'shoulder',
    quality: 'epic',
    stats: { armor: 165, agi: 9, vit: 6 },
    hitRating: 20,
    sellValue: 12000,
    requiredClass: ['rogue', 'hunter', 'druid'],
  },
  soulflame_cowl: {
    id: 'soulflame_cowl',
    set: 'soulflame',
    name: 'Wraithfire Cowl',
    kind: 'armor',
    armorType: 'cloth',
    slot: 'helmet',
    quality: 'epic',
    stats: { armor: 105, int: 11, vit: 6 },
    hitRating: 20,
    sellValue: 12000,
    requiredClass: ['mage', 'priest', 'warlock', 'druid'],
  },
  soulflame_mantle: {
    id: 'soulflame_mantle',
    set: 'soulflame',
    name: 'Wraithfire Mantle',
    kind: 'armor',
    armorType: 'cloth',
    slot: 'shoulder',
    quality: 'epic',
    stats: { armor: 92, int: 9, vit: 6 },
    hitRating: 20,
    sellValue: 12000,
    requiredClass: ['mage', 'priest', 'warlock', 'druid'],
  },
  stormcallers_crown: {
    id: 'stormcallers_crown',
    set: 'stormcallers',
    name: 'Galecall Crown',
    kind: 'armor',
    armorType: 'mail',
    slot: 'helmet',
    quality: 'epic',
    stats: { armor: 225, int: 10, vit: 7 },
    critRating: 20,
    sellValue: 12000,
    requiredClass: ['shaman'],
  },
  stormcallers_spaulders: {
    id: 'stormcallers_spaulders',
    set: 'stormcallers',
    name: 'Galecall Spaulders',
    kind: 'armor',
    armorType: 'mail',
    slot: 'shoulder',
    quality: 'epic',
    stats: { armor: 190, int: 8, vit: 7 },
    critRating: 20,
    sellValue: 12000,
    requiredClass: ['shaman'],
  },
  // --- Nythraxis raid (normal): the missing offhand-slot + two-hander epics.
  // All four register at item level 29 (source 20 + epic 6 + raid 3), the same
  // tier as the set pieces above, and carry the ilvl-29 raid seed rating (one
  // rating at 20, off the stat budget, like every set piece). ---
  bonewrought_greatsword: {
    id: 'bonewrought_greatsword',
    name: 'Bonewrought Greatsword',
    kind: 'weapon',
    slot: 'mainhand',
    hand: 'twohand',
    quality: 'epic',
    // Two-handers trade stats for a slow, heavy swing: weaponDpsBudget(29) = 15.4
    // x TWOHAND_DPS_MULT -> 17.65 dps here.
    weapon: { min: 45, max: 75, speed: 3.4 },
    // v0.27.1 re-budget: round(primaryStatBudget(29, epic, mainhand) = 20 x
    // TWOHAND_STAT_MULT) = 26 points (a mainhand + offhand pair at this tier
    // carries 35, so any dual-wield or shield setup out-stats this).
    stats: { str: 14, vit: 12 },
    // Physical melee identity: Hit, like the crownforged pieces.
    hitRating: 20,
    sellValue: 12000,
    // The warrior weapon group MINUS rogue: rogues never equip two-handers
    // (equipment_rules), and requiredClass must honestly list who can equip.
    // The list no longer matches WARRIOR_WEAPON_CLASSES, so it resolves by
    // literal membership.
    requiredClass: ['warrior', 'hunter', 'shaman', 'paladin'],
  },
  direfang_greatblade: {
    id: 'direfang_greatblade',
    name: 'Direfang Greatblade',
    kind: 'weapon',
    slot: 'mainhand',
    hand: 'twohand',
    quality: 'epic',
    // Same 2H rules as the Bonewrought Greatsword: weaponDpsBudget(29) x
    // TWOHAND_DPS_MULT -> 17.67 dps at a faster 3.0 swing, same 26-point budget.
    weapon: { min: 40, max: 66, speed: 3.0 },
    stats: { agi: 14, vit: 12 },
    // Physical melee identity: Hit, like the nighttalon pieces.
    hitRating: 20,
    sellValue: 12000,
    // A bespoke hunter lock (not a proficiency group): the agi identity is the
    // hunter's, and handing it to the rogue group would trade away dual wield.
    requiredClass: ['hunter'],
  },
  bonewrought_bulwark: {
    id: 'bonewrought_bulwark',
    name: 'Bonewrought Bulwark',
    kind: 'armor',
    armorType: 'mail',
    slot: 'offhand',
    shield: true,
    quality: 'epic',
    // Shield armor is ~2x a same-tier epic chest (the common-tier rule:
    // Wallshield 112 vs chain vest 60): the ilvl-29 epic mail chest
    // extrapolates to ~340 (deathlord_warplate 270 at 26, scaled by the 29-tier
    // helm ratio 310/245), so 680 here. blockValue extrapolates the common
    // ladder (buckler 6, Wallshield 14) to the epic tier: 30. Stats are the
    // exact offhand budget, primaryStatBudget(29, epic, offhand) = 15,
    // sta-heavy for the tank identity.
    blockValue: 30,
    stats: { armor: 680, vit: 10, str: 5 },
    // Physical tank identity: Hit (threat), like the crownforged pieces.
    hitRating: 20,
    sellValue: 12000,
    requiredClass: ['warrior', 'paladin', 'shaman'],
  },
  wraithfire_orb: {
    id: 'wraithfire_orb',
    name: 'Wraithfire Orb',
    kind: 'held_offhand',
    slot: 'offhand',
    quality: 'epic',
    // Held-in-offhand caster stat stick: no weapon damage, stats on the exact
    // offhand budget, primaryStatBudget(29, epic, offhand) = 15 (the budget
    // model's 0.75x mainhand line), int/spi identity with minor sta.
    stats: { int: 7, luk: 5, vit: 3 },
    // Healer-inclusive spell throughput: crit like the stormcallers pieces,
    // never Hit (heals are not resisted; the Heartwood healer-facing rule).
    critRating: 20,
    sellValue: 12000,
    // The caster weapon-proficiency group list (CASTER_WEAPON_CLASSES); kind
    // held_offhand equips by the literal requiredClass.
    requiredClass: ['mage', 'priest', 'warlock', 'shaman', 'paladin', 'druid'],
  },
  // --- vendor food & drink (Quartermaster Bree) ---
  trail_hardtack: {
    id: 'trail_hardtack',
    name: 'Highwatch Trail Hardtack',
    kind: 'food',
    quality: 'common',
    foodHp: 552,
    sellValue: 75,
    buyValue: 1200,
  },
  meltwater_flask: {
    id: 'meltwater_flask',
    name: 'Meltwater Flask',
    kind: 'drink',
    quality: 'common',
    drinkMana: 672,
    sellValue: 75,
    buyValue: 1200,
  },
  roast_mountain_goat: {
    id: 'roast_mountain_goat',
    name: 'Roast Mountain Goat',
    kind: 'food',
    quality: 'common',
    foodHp: 874,
    sellValue: 150,
    buyValue: 2500,
  },
  glacier_melt: {
    id: 'glacier_melt',
    name: 'Glacier Melt',
    kind: 'drink',
    quality: 'common',
    drinkMana: 900,
    sellValue: 150,
    buyValue: 2500,
  },
  // --- vendor whites (Armorer Hode + Quartermaster Bree) ---
  highwatch_warblade: {
    id: 'highwatch_warblade',
    name: 'Highwatch Warblade',
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'common',
    weapon: { min: 15, max: 24, speed: 2.3 },
    sellValue: 600,
    buyValue: 6000,
  },
  highwatch_greatsword: {
    id: 'highwatch_greatsword',
    name: 'Highwatch Greatsword',
    kind: 'weapon',
    slot: 'mainhand',
    hand: 'twohand',
    quality: 'common',
    weapon: { min: 26, max: 40, speed: 3.4 },
    sellValue: 680,
    buyValue: 6800,
  },
  highwatch_wallshield: {
    id: 'highwatch_wallshield',
    name: 'Highwatch Wallshield',
    kind: 'armor',
    armorType: 'mail',
    slot: 'offhand',
    shield: true,
    blockValue: 14,
    quality: 'common',
    stats: { armor: 112, vit: 2 },
    sellValue: 560,
    buyValue: 5600,
    requiredClass: ['warrior', 'paladin', 'shaman'],
  },
  craghorn_staff: {
    id: 'craghorn_staff',
    name: 'Craghorn Staff',
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'common',
    weapon: { min: 16, max: 27, speed: 3.0 },
    stats: { int: 2 },
    sellValue: 600,
    buyValue: 6000,
  },
  icevein_dirk: {
    id: 'icevein_dirk',
    name: 'Icevein Dirk',
    kind: 'weapon',
    slot: 'mainhand',
    quality: 'common',
    weapon: { min: 10, max: 16, speed: 1.8, dagger: true },
    sellValue: 600,
    buyValue: 6000,
  },
  highwatch_breastplate: {
    id: 'highwatch_breastplate',
    name: 'Highwatch Breastplate',
    kind: 'armor',
    armorType: 'mail',
    slot: 'chest',
    quality: 'common',
    stats: { armor: 160 },
    sellValue: 700,
    buyValue: 7000,
  },
  peakwool_robe: {
    id: 'peakwool_robe',
    name: 'Peakwool Robe',
    kind: 'armor',
    armorType: 'cloth',
    slot: 'chest',
    quality: 'common',
    stats: { armor: 50 },
    sellValue: 500,
    buyValue: 5000,
  },
  stalkerhide_jerkin: {
    id: 'stalkerhide_jerkin',
    name: 'Prowlhide Jerkin',
    kind: 'armor',
    armorType: 'leather',
    slot: 'chest',
    quality: 'common',
    stats: { armor: 95 },
    sellValue: 600,
    buyValue: 6000,
  },
  cragwalker_boots: {
    id: 'cragwalker_boots',
    name: 'Cragwalker Boots',
    kind: 'armor',
    armorType: 'leather',
    slot: 'feet',
    quality: 'common',
    stats: { armor: 55 },
    sellValue: 400,
    buyValue: 4000,
  },
  windguard_leggings: {
    id: 'windguard_leggings',
    name: 'Windguard Leggings',
    kind: 'armor',
    armorType: 'leather',
    slot: 'legs',
    quality: 'common',
    stats: { armor: 70 },
    sellValue: 450,
    buyValue: 4500,
  },
  // --- junk (gray) ---
  ogre_toe_ring: {
    id: 'ogre_toe_ring',
    name: 'Ogre Toe Ring',
    kind: 'junk',
    quality: 'poor',
    sellValue: 25,
  },
  cracked_ogre_tusk: {
    id: 'cracked_ogre_tusk',
    name: 'Cracked Ogre Tusk',
    kind: 'junk',
    quality: 'poor',
    sellValue: 42,
  },
  inert_storm_shard: {
    id: 'inert_storm_shard',
    name: 'Inert Storm Shard',
    kind: 'junk',
    quality: 'poor',
    sellValue: 28,
  },
  frayed_prayer_beads: {
    id: 'frayed_prayer_beads',
    name: 'Frayed Prayer Beads',
    kind: 'junk',
    quality: 'poor',
    sellValue: 30,
  },
  cracked_wyrm_scale: {
    id: 'cracked_wyrm_scale',
    name: 'Cracked Wyrm Scale',
    kind: 'junk',
    quality: 'poor',
    sellValue: 35,
  },
  // --- Class/spec gap fill: the 17-22 band plus endgame caster pieces ---
  // Budgeted via primaryStatBudget(item level, quality, slot); see
  // src/sim/item_budget.ts. The leather int/spi pieces finish the druid caster
  // line (gloves are covered by the crafted duskhide_wraps), the mail int/spi
  // pieces finish the shaman/paladin caster leveling line below the stormbound
  // tier, and the druid-locked two-handers carry the feral weapon ladder to
  // the raid tier (a bespoke druid-only lock: weaponArchetypeForItem returns
  // null for it and canEquipItem falls through to the literal list, see
  // src/sim/equipment_rules.ts).
  wildgrove_cinch: {
    id: 'wildgrove_cinch',
    name: 'Wildgrove Cinch',
    kind: 'armor',
    armorType: 'leather',
    slot: 'waist',
    quality: 'uncommon',
    // Ridge Stalkers (level 14) -> item level 15, waist budget 4.
    stats: { armor: 36, int: 2, luk: 2 },
    sellValue: 420,
  },
  cragward_pauldrons: {
    id: 'cragward_pauldrons',
    name: 'Cragward Pauldrons',
    kind: 'armor',
    armorType: 'mail',
    slot: 'shoulder',
    quality: 'uncommon',
    // Old Cragmaw (level 14 rare elite) -> item level 15, shoulder budget 4.
    stats: { armor: 56, int: 2, luk: 2 },
    sellValue: 450,
  },
  cragthorn_greatstaff: {
    id: 'cragthorn_greatstaff',
    name: 'Cragthorn Greatstaff',
    kind: 'weapon',
    slot: 'mainhand',
    hand: 'twohand',
    quality: 'rare',
    // Old Cragmaw (level 14 rare elite) -> item level 17: 2H stat budget
    // round(primaryStatBudget(17, rare, mainhand) = 10 x TWOHAND_STAT_MULT) =
    // 13, dps on the weaponDpsBudget(17) x TWOHAND_DPS_MULT curve (~13.57 at
    // speed 3.5).
    weapon: { min: 40, max: 55, speed: 3.5 },
    stats: { str: 5, agi: 4, vit: 4 },
    sellValue: 1400,
    requiredClass: FERAL,
  },
  moonbark_vestments: {
    id: 'moonbark_vestments',
    name: 'Moonbark Vestments',
    kind: 'armor',
    armorType: 'leather',
    slot: 'chest',
    quality: 'rare',
    // Deeprock Kobolds (level 15) -> item level 18, chest budget 10.
    stats: { armor: 100, int: 6, luk: 4 },
    sellValue: 1600,
  },
  peaksong_helm: {
    id: 'peaksong_helm',
    name: 'Peaksong Helm',
    kind: 'armor',
    armorType: 'mail',
    slot: 'helmet',
    quality: 'rare',
    // Deeprock Kobolds (level 15) -> item level 18, helmet budget 9.
    stats: { armor: 78, int: 5, luk: 4 },
    sellValue: 1500,
  },
  stormchant_gauntlets: {
    id: 'stormchant_gauntlets',
    name: 'Stormchant Gauntlets',
    kind: 'armor',
    armorType: 'mail',
    slot: 'gloves',
    quality: 'uncommon',
    // Ironvein Foreman (level 16 rare elite) -> item level 17, gloves budget 5.
    stats: { armor: 50, int: 3, luk: 2 },
    sellValue: 460,
  },
  cragprowl_belt: {
    id: 'cragprowl_belt',
    name: 'Cragprowl Belt',
    kind: 'armor',
    armorType: 'leather',
    slot: 'waist',
    quality: 'uncommon',
    // Thornpeak Ogres (level 16) -> item level 17, waist budget 5.
    stats: { armor: 40, agi: 3, vit: 2 },
    sellValue: 440,
  },
  stormroot_cowl: {
    id: 'stormroot_cowl',
    name: 'Stormroot Cowl',
    kind: 'armor',
    armorType: 'leather',
    slot: 'helmet',
    quality: 'rare',
    // Brutok Skullsmasher (level 17 rare elite) -> item level 20, helmet
    // budget 10.
    stats: { armor: 58, int: 6, luk: 4 },
    sellValue: 1900,
  },
  thunderward_legguards: {
    id: 'thunderward_legguards',
    name: 'Thunderward Legguards',
    kind: 'armor',
    armorType: 'mail',
    slot: 'legs',
    quality: 'rare',
    // Warlord Drogmar (level 17 elite boss) -> item level 20, legs budget 10.
    stats: { armor: 118, int: 6, luk: 4 },
    sellValue: 2000,
  },
  revenantstep_treads: {
    id: 'revenantstep_treads',
    name: 'Revenantstep Treads',
    kind: 'armor',
    armorType: 'leather',
    slot: 'feet',
    quality: 'rare',
    // Ogre Crushers (level 17 elite) -> item level 20, feet budget 7.
    stats: { armor: 62, agi: 4, vit: 3 },
    sellValue: 1700,
  },
  shardfang_grips: {
    id: 'shardfang_grips',
    name: 'Shardfang Grips',
    kind: 'armor',
    armorType: 'leather',
    slot: 'gloves',
    quality: 'rare',
    // Shardlord Kazzix (level 18 rare) -> item level 21, gloves budget 8.
    stats: { armor: 40, agi: 5, vit: 3 },
    sellValue: 1800,
  },
  shardsong_mantle: {
    id: 'shardsong_mantle',
    name: 'Shardsong Mantle',
    kind: 'armor',
    armorType: 'cloth',
    slot: 'shoulder',
    quality: 'rare',
    // Wyrmcult Zealots (level 19) -> item level 22, shoulder budget 9.
    stats: { armor: 32, int: 5, luk: 4 },
    sellValue: 1900,
  },
  wyrmcult_spellgrips: {
    id: 'wyrmcult_spellgrips',
    name: 'Wyrmcult Spellgrips',
    kind: 'armor',
    armorType: 'cloth',
    slot: 'gloves',
    quality: 'rare',
    // Wyrmcult Necromancers (level 19) -> item level 22, gloves budget 9.
    stats: { armor: 36, int: 5, luk: 4 },
    sellValue: 1850,
  },
  thornpeak_wildwraps: {
    id: 'thornpeak_wildwraps',
    name: 'Thornpeak Wildwraps',
    kind: 'armor',
    armorType: 'leather',
    slot: 'legs',
    quality: 'rare',
    // Boneclad Revenants (level 19) -> item level 22, legs budget 11.
    stats: { armor: 60, int: 7, luk: 4 },
    sellValue: 2100,
  },
  stormvotive_hauberk: {
    id: 'stormvotive_hauberk',
    name: 'Stormvotive Hauberk',
    kind: 'armor',
    armorType: 'mail',
    slot: 'chest',
    quality: 'rare',
    // Voskar Emberwing (level 19 rare elite) -> item level 22, chest budget 12.
    stats: { armor: 180, int: 7, luk: 5 },
    sellValue: 2400,
  },
  cryptbloom_shoulderguards: {
    id: 'cryptbloom_shoulderguards',
    name: 'Cryptbloom Shoulderguards',
    kind: 'armor',
    armorType: 'leather',
    slot: 'shoulder',
    quality: 'rare',
    // Corrupted Priest Malric (level 20 rare elite) -> item level 23, shoulder
    // budget 10, matching the same-tier crafted sootscale_mantle.
    stats: { armor: 56, int: 6, luk: 4 },
    sellValue: 2200,
  },
  gravewyrm_thornmaul: {
    id: 'gravewyrm_thornmaul',
    name: 'Gravewyrm Thornmaul',
    kind: 'weapon',
    slot: 'mainhand',
    hand: 'twohand',
    quality: 'rare',
    // Sanctum Drakonid (level 20 elite) -> item level 23: 2H stat budget
    // round(primaryStatBudget(23, rare, mainhand) = 13 x TWOHAND_STAT_MULT) =
    // 17, dps on the weaponDpsBudget(23) x TWOHAND_DPS_MULT curve (~15.64 at
    // speed 3.6).
    weapon: { min: 48, max: 65, speed: 3.6 },
    stats: { str: 7, agi: 5, vit: 5 },
    sellValue: 3200,
    requiredClass: FERAL,
  },
  vestments_of_the_waking_grove: {
    id: 'vestments_of_the_waking_grove',
    name: 'Vestments of the Waking Grove',
    kind: 'armor',
    armorType: 'leather',
    slot: 'chest',
    quality: 'epic',
    // Thunzharr, Waking Peak (level 20 world boss) -> item level 26, chest
    // budget 18, the caster counterpart to the wyrmshadow_harness on the same
    // boss table.
    stats: { armor: 160, int: 9, luk: 5, vit: 4 },
    sellValue: 8000,
  },
  nightfangs_greatstaff: {
    id: 'nightfangs_greatstaff',
    name: "Nightfang's Greatstaff",
    kind: 'weapon',
    slot: 'mainhand',
    hand: 'twohand',
    quality: 'epic',
    // Korzul the Gravewyrm (level 20 dungeon final boss) -> item level 26: 2H
    // stat budget round(primaryStatBudget(26, epic, mainhand) = 18 x
    // TWOHAND_STAT_MULT) = 23 (the wyrmfang_greatblade total), dps on the
    // weaponDpsBudget(26) x TWOHAND_DPS_MULT curve (~16.68 at speed 3.6).
    weapon: { min: 51, max: 69, speed: 3.6 },
    stats: { str: 9, agi: 7, vit: 7 },
    sellValue: 9000,
    requiredClass: FERAL,
  },
  maul_of_the_scourged_wilds: {
    id: 'maul_of_the_scourged_wilds',
    name: 'Maul of the Scourged Wilds',
    kind: 'weapon',
    slot: 'mainhand',
    hand: 'twohand',
    quality: 'epic',
    // Nythraxis (level 20 raid boss) -> item level 29 with the raid bonus: 2H
    // stat budget round(primaryStatBudget(29, epic, mainhand) = 20 x
    // TWOHAND_STAT_MULT) = 26, dps on the weaponDpsBudget(29) x
    // TWOHAND_DPS_MULT curve (~17.71 at speed 3.7). The top rung of the feral
    // ladder, beside the direfang_greatblade on the same boss.
    weapon: { min: 56, max: 75, speed: 3.7 },
    stats: { str: 10, agi: 8, vit: 8 },
    // Every item-level-29 raid epic carries exactly one rating at 20 (the tier
    // ladder pin in tests/combat_rating.test.ts); the maul takes Hit like the
    // direfang_greatblade beside it.
    hitRating: 20,
    sellValue: 14000,
    requiredClass: FERAL,
  },
  // --- Endgame leather caster line (int/spi, druid-only via armorType). These
  // fill the ilvl-26 dungeon tier on Korzul the Gravewyrm's table so balance
  // druids have on-weight options in every slot above the level-22 band. The
  // armorType already gates equips; no requiredClass is needed.
  wildgrowth_leggings: {
    id: 'wildgrowth_leggings',
    name: 'Wildgrowth Leggings',
    kind: 'armor',
    armorType: 'leather',
    slot: 'legs',
    quality: 'epic',
    // Korzul the Gravewyrm (level 20 dungeon final boss) -> item level 26,
    // legs budget 16.
    stats: { armor: 112, int: 9, luk: 5, vit: 2 },
    sellValue: 8000,
  },
  grovewardens_grips: {
    id: 'grovewardens_grips',
    name: "Grovewarden's Grips",
    kind: 'armor',
    armorType: 'leather',
    slot: 'gloves',
    quality: 'epic',
    // Korzul the Gravewyrm (level 20 dungeon final boss) -> item level 26,
    // gloves budget 13.
    stats: { armor: 88, int: 8, luk: 5 },
    sellValue: 7500,
  },
  verdant_walkers: {
    id: 'verdant_walkers',
    name: 'Verdant Walkers',
    kind: 'armor',
    armorType: 'leather',
    slot: 'feet',
    quality: 'epic',
    // Korzul the Gravewyrm (level 20 dungeon final boss) -> item level 26,
    // feet budget 12.
    stats: { armor: 82, int: 7, luk: 5 },
    sellValue: 7200,
  },
};

// ---------------------------------------------------------------------------
// Static props (rendering + collision share this placement data). Highwatch
// sits on a high plateau (~9 elevation); the lake at (-70,760) stays clear.
// ---------------------------------------------------------------------------

export const ZONE3_PROPS: ZonePropsDef = {
  buildings: [
    { kind: 'house', x: 14, z: 671, w: 7, d: 6, rot: -0.5 },
    { kind: 'house', x: 8, z: 650, w: 6, d: 5, rot: 0.4 },
    { kind: 'house', x: 18, z: 660, w: 6, d: 5, rot: 1.2 },
    { kind: 'inn', x: -15, z: 666, w: 6, d: 7, rot: 0.6 },
    { kind: 'chapel', x: -16, z: 650, w: 5, d: 7, rot: 0.9 },
  ],
  wells: [{ x: 0, z: 662, r: 1.5 }],
  stalls: [
    { x: -7.5, z: 667, rot: Math.PI / 2, r: 1.7 }, // Quartermaster Bree
    { x: -4.5, z: 673.5, rot: -0.6, r: 1.7, smithy: true }, // Armorer Hode
  ],
  mines: [
    { x: 88, z: 612, rot: -2.0 }, // Deeprock Burrows
    // Abandoned crypt entrance: shares its (x, z) with the dungeon door's own
    // trigger point, so the mound's collider needs a bigger backward offset
    // (moundOffset) than the generic mine default or it swallows the door
    // itself, stranding any ghost that can only walk-trigger it (issue: dead
    // players unable to enter/corpse-run the crypt). moundRadius is also
    // shrunk from the generic default so the circle hugs this entry's own,
    // smaller-footprint rock pile (src/render/props.ts) instead of bleeding
    // onto open ground behind it and off the flanking boulders themselves.
    { x: -152, z: 610, rot: Math.PI / 2, moundOffset: 4, moundRadius: 3.3 },
  ],
  docks: [],
  tents: [
    // Drogmar's war-camp
    { x: -120, z: 733, rot: 0.5, scale: 1.3 },
    { x: -128, z: 744, rot: 2.0, scale: 1.3 },
    { x: -136, z: 752, rot: 1.0, scale: 1.5 },
    // Wyrmcult tents below the Sanctum
    { x: 50, z: 815, rot: 0.8, scale: 1 },
    { x: 58, z: 823, rot: -0.5, scale: 1 },
    { x: 60, z: 812, rot: 2.2, scale: 1 },
    { x: 28, z: 848, rot: 1.5, scale: 1 },
  ],
  crates: [
    [-118, 728],
    [-124, 735],
    [-130, 742],
    [52, 818],
    [57, 820],
  ],
  campfires: [
    [2, 658],
    [-122, 736],
    [-136, 743],
    [52, 817],
    [28, 847],
  ],
  mudHuts: [],
  ruinRings: [
    { x: -40, z: 830, ringR: 7, columns: 6 }, // Revenant Fields battlefield
    { x: 141, z: 712, ringR: 7, columns: 6 }, // Malric grave ruins
    { x: 138, z: 838, ringR: 7, columns: 6 }, // Aldren grave ruins
    { x: -139, z: 787, ringR: 7, columns: 6 }, // Royal Assassin Voss grave ruins
    { x: -12, z: 862, ringR: 6, columns: 5 }, // Sanctum Approach ruins
    { x: 12, z: 858, ringR: 6, columns: 5 },
  ],
  fences: [
    { x1: -14, z1: 649, x2: -4, z2: 647 }, // south gate, east run
    { x1: 4, z1: 647, x2: 14, z2: 649 }, // south gate, west run
  ],
  graveyards: [
    { x: 15, z: 645 },
    { x: 141, z: 712 },
    { x: 138, z: 838 },
    { x: -139, z: 787 },
  ],
  delveMarkers: [{ x: -95, z: 505, delveId: 'drowned_litany' }],
};
