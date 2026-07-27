// Zone 1 — Eastbrook Vale (levels 1-7). The starter zone: town of Eastbrook,
// wolves and boars, the bandit camp, and Brother Aldric's Gravecaller chain
// leading to the Hollow Crypt.

import { EASTBROOK_GRAND_ARMOURY } from '../../building_layout';
import { EASTBROOK_LAYOUT, EASTBROOK_NPC_PLACEMENTS_BY_ID } from '../../eastbrook_layout';
import { WORK_ORDER_CADENCE_TICKS } from '../../professions/cadence';
import type {
  CampDef,
  GroundObjectDef,
  MobTemplate,
  NpcDef,
  QuestDef,
  ZoneDef,
  ZonePropsDef,
} from '../../types';

export const ZONE1_NPCS: Record<string, NpcDef> = {
  the_merchant: {
    id: 'the_merchant',
    name: 'The Merchant',
    title: 'Keeper of the World Market',
    pos: { ...EASTBROOK_NPC_PLACEMENTS_BY_ID.the_merchant.position },
    facing: EASTBROOK_NPC_PLACEMENTS_BY_ID.the_merchant.facing,
    color: 0xd4af37,
    questIds: [],
    market: true,
    greeting:
      'Welcome to the World Market, $C. Buy from every adventurer in the realm — or set out your own wares and let coin find you.',
  },
  marshal_redbrook: {
    id: 'marshal_redbrook',
    name: 'Marshal Redbrook',
    title: 'Town Marshal',
    pos: { ...EASTBROOK_NPC_PLACEMENTS_BY_ID.marshal_redbrook.position },
    facing: EASTBROOK_NPC_PLACEMENTS_BY_ID.marshal_redbrook.facing,
    color: 0xb7950b,
    questIds: ['q_wolves', 'q_greyjaw', 'q_bandits', 'q_ringleader', 'q_mogger'],
    greeting: 'Keep your blade close, $C. The Vale is not what it was.',
  },
  trader_wilkes: {
    id: 'trader_wilkes',
    name: 'Trader Wilkes',
    title: 'Provisioner',
    pos: { ...EASTBROOK_NPC_PLACEMENTS_BY_ID.trader_wilkes.position },
    facing: EASTBROOK_NPC_PLACEMENTS_BY_ID.trader_wilkes.facing,
    color: 0x1e8449,
    questIds: ['q_boars', 'q_supplies'],
    vendorItems: [
      'baked_bread',
      'spring_water',
      'roasted_boar',
      'tough_jerky',
      'minor_healing_potion',
      'minor_mana_potion',
      'linen_pouch',
      'travelers_knapsack',
      'copper_mining_pick',
      'iron_mining_pick',
      'mithril_mining_pick',
      'handaxe',
      'felling_axe',
      'ironbark_axe',
      'gathering_sickle',
      'bronze_sickle',
      'silverleaf_sickle',
      'ironreel_fishing_rod',
      'silverstream_fishing_rod',
    ],
    greeting: 'Fresh bread, clean water, fair prices. What can I get you?',
  },
  apothecary_lin: {
    id: 'apothecary_lin',
    name: 'Apothecary Lin',
    title: 'Herbalist',
    pos: { ...EASTBROOK_NPC_PLACEMENTS_BY_ID.apothecary_lin.position },
    facing: EASTBROOK_NPC_PLACEMENTS_BY_ID.apothecary_lin.facing,
    color: 0x7d3c98,
    questIds: ['q_spiders'],
    greeting: 'Careful where you step in the eastern woods, friend.',
  },
  brother_aldric: {
    id: 'brother_aldric',
    name: 'Brother Aldric',
    title: 'Priest of the Vale',
    pos: { ...EASTBROOK_NPC_PLACEMENTS_BY_ID.brother_aldric.position },
    facing: EASTBROOK_NPC_PLACEMENTS_BY_ID.brother_aldric.facing,
    color: 0xf7f9f9,
    questIds: [
      'q_bones',
      'q_whispers',
      'q_names_of_the_dead',
      'q_silence_the_call',
      'q_rite',
      'q_sexton',
      'q_hollow',
      'q_gravecallers_trail',
      'q_fenbridge_muster',
    ],
    greeting: 'The Light keep you. Even the dead find no rest here of late.',
  },
  smith_haldren: {
    id: 'smith_haldren',
    name: 'Smith Haldren',
    title: 'Armorer & Weaponsmith',
    pos: { ...EASTBROOK_NPC_PLACEMENTS_BY_ID.smith_haldren.position },
    facing: EASTBROOK_NPC_PLACEMENTS_BY_ID.smith_haldren.facing,
    color: 0x707b7c,
    questIds: ['q_prof_hobby_switch'],
    vendorItems: [
      'eastbrook_arming_sword',
      'eastbrook_greatsword',
      'bronzework_mace',
      'vale_carving_knife',
      'hickory_shortstaff',
      'eastbrook_buckler',
      'eastbrook_chain_vest',
      'valespun_robe',
      'tanned_leather_jerkin',
      'hobnail_boots',
      'eastbrook_wool_trousers',
    ],
    greeting: 'Mind the sparks, $C. Good steel is the difference between a scar and a grave.',
  },
  fisherman_brandt: {
    id: 'fisherman_brandt',
    name: 'Fisherman Brandt',
    title: 'Old Salt',
    pos: { ...EASTBROOK_NPC_PLACEMENTS_BY_ID.fisherman_brandt.position },
    facing: EASTBROOK_NPC_PLACEMENTS_BY_ID.fisherman_brandt.facing,
    color: 0x2471a3,
    questIds: ['q_murlocs'],
    vendorItems: ['simple_fishing_pole'],
    greeting: 'Blrb-glub— sorry, been listening to those fish-men too long.',
  },
  foreman_odell: {
    id: 'foreman_odell',
    name: 'Foreman Odell',
    title: 'Mine Foreman',
    pos: { ...EASTBROOK_NPC_PLACEMENTS_BY_ID.foreman_odell.position },
    facing: EASTBROOK_NPC_PLACEMENTS_BY_ID.foreman_odell.facing,
    color: 0xa04000,
    questIds: ['q_prof_intro', 'q_mine'],
    greeting: "Whole dig's crawling with those dirt-caked vermin!",
  },
  bursar_fernando: {
    id: 'bursar_fernando',
    name: 'Bursar Fernando',
    title: 'The Gilded Strongbox',
    pos: { ...EASTBROOK_NPC_PLACEMENTS_BY_ID.bursar_fernando.position },
    facing: EASTBROOK_NPC_PLACEMENTS_BY_ID.bursar_fernando.facing,
    color: 0xc9a227,
    questIds: [],
    banker: true,
    greeting: 'Welcome to the Gilded Strongbox. Your goods rest safe behind our locks.',
  },
  card_master: {
    id: 'card_master',
    name: 'Card Master',
    title: 'Dealer of Chance',
    pos: { ...EASTBROOK_NPC_PLACEMENTS_BY_ID.card_master.position },
    facing: EASTBROOK_NPC_PLACEMENTS_BY_ID.card_master.facing,
    color: 0x7a2f8f,
    questIds: [],
    cardMaster: true,
    greeting: 'Care for a Card Duel? Best of three, winner takes the bragging rights.',
  },
  groundskeeper_bram: {
    id: 'groundskeeper_bram',
    name: 'Groundskeeper Bram',
    title: 'Keeper of the Sowfield',
    // At the Sowfield's north gate with the book of fixtures (vale_cup_layout
    // BRAM_POS). dynamic: the generic surface-placement loop skips him; the
    // Vale Cup module spawns him at world init under a RESERVED entity id so
    // adding him never shifts the ctor id sequence (parity goldens pin nextId).
    pos: { x: -6, z: -82 },
    facing: Math.PI,
    color: 0x3f7d34,
    questIds: [],
    dynamic: true,
    greeting:
      'The truce holds at the Sowfield, $C: boots and shoulders only. Care to play for the Copper Pail?',
  },
  chronicler_saul: {
    id: 'chronicler_saul',
    name: 'Saul the Chronicler',
    title: 'The Vale Chronicle',
    pos: { ...EASTBROOK_NPC_PLACEMENTS_BY_ID.chronicler_saul.position },
    facing: EASTBROOK_NPC_PLACEMENTS_BY_ID.chronicler_saul.facing,
    color: 0xd08a2e, // warm amber: the chronicler tint is his identity (shared mage visual)
    questIds: [],
    greeting:
      'Every deed worth doing is worth writing down twice, $N: once for the ledger and once for the fireside.',
  },
  // Crafting-station masters (Professions 2.0): each stands 1 to 3
  // units beside their station (content/professions.ts STATIONS) with a
  // guard-safe camp margin (pinned in tests/professions_station_placement.test.ts).
  forgemistress_darva: {
    id: 'forgemistress_darva',
    name: 'Forgemistress Darva',
    title: 'Master of the Forge',
    pos: { ...EASTBROOK_NPC_PLACEMENTS_BY_ID.forgemistress_darva.position },
    facing: EASTBROOK_NPC_PLACEMENTS_BY_ID.forgemistress_darva.facing,
    color: 0xb5541c,
    // Professions 2.0: the Smith pair's anchor master. Attunement and
    // its escalating make-amends return live here now (moved off Smith Haldren),
    // plus the repeatable forge work order.
    questIds: ['q_prof_attune_smith', 'q_prof_amends_smith', 'q_prof_workorder_forge'],
    // Station stocking: thorium_ore is the premium reagent the forge
    // station's own recipe (recipe_sootscale_mantle) consumes, so the master
    // sells it alongside quartermaster_bree (zone3).
    vendorItems: [
      'copper_mining_pick',
      'iron_mining_pick',
      'mithril_mining_pick',
      'smithing_flux',
      'thorium_ore',
    ],
    greeting: 'The forge answers to me, $C. Bring good ore and it will answer to you too.',
  },
  cook_marlow: {
    id: 'cook_marlow',
    name: 'Cook Marlow',
    title: 'Master of the Kitchens',
    pos: { ...EASTBROOK_NPC_PLACEMENTS_BY_ID.cook_marlow.position },
    facing: EASTBROOK_NPC_PLACEMENTS_BY_ID.cook_marlow.facing,
    color: 0xc98a4b,
    // Professions 2.0: the Apothecary pair's (alchemy + cooking) anchor
    // master. Attunement, make-amends return, and the repeatable kitchens work
    // order live here.
    questIds: ['q_prof_attune_apothecary', 'q_prof_amends_apothecary', 'q_prof_workorder_kitchens'],
    vendorItems: [
      'baked_bread',
      'spring_water',
      'roasted_boar',
      'tough_jerky',
      'brightwood_venison',
      'cooking_salt',
    ],
    greeting: 'Nothing leaves my kitchens half-cooked, $C. Sit, eat, then get back out there.',
  },
  weaver_ottilie: {
    id: 'weaver_ottilie',
    name: 'Weaver Ottilie',
    title: 'Master of the Loom',
    pos: { ...EASTBROOK_NPC_PLACEMENTS_BY_ID.weaver_ottilie.position },
    facing: EASTBROOK_NPC_PLACEMENTS_BY_ID.weaver_ottilie.facing,
    color: 0x7161a8,
    // Professions 2.0: the Outfitter pair's (leatherworking + tailoring)
    // anchor master. Attunement, make-amends return, and the repeatable loom work
    // order live here.
    questIds: ['q_prof_attune_outfitter', 'q_prof_amends_outfitter', 'q_prof_workorder_loom'],
    // Station stocking: thorium_ore was stocked as the premium
    // reagent of the loom's own recipe. An input rework later
    // moved recipe_wardweave_cowl off osmium (silk plus premium herbs now),
    // but the stock stays: removing a shipped vendor row is out of that
    // rework's scope, and loom customers still buy it for the
    // forge crafts next door.
    vendorItems: [
      'linen_pouch',
      'travelers_knapsack',
      'gathering_sickle',
      'spool_of_thread',
      'thorium_ore',
    ],
    greeting: 'Mind the threads, $C. A steady hand at the loom beats a strong one.',
  },
  tinker_gizzel: {
    id: 'tinker_gizzel',
    name: 'Tinker Gizzel',
    title: 'Master of the Toolworks',
    pos: { ...EASTBROOK_NPC_PLACEMENTS_BY_ID.tinker_gizzel.position },
    facing: EASTBROOK_NPC_PLACEMENTS_BY_ID.tinker_gizzel.facing,
    color: 0xb08d57,
    // Professions 2.0: the Bombardier pair's (engineering + alchemy)
    // anchor master. Attunement, make-amends return, and the repeatable toolworks
    // work order live here.
    questIds: [
      'q_prof_attune_bombardier',
      'q_prof_amends_bombardier',
      'q_prof_workorder_toolworks',
    ],
    // Station stocking: the six premium reagents the toolworks
    // recipes (TOOL_RECIPES) consume, previously sold only by
    // quartermaster_bree (zone3).
    vendorItems: [
      'handaxe',
      'felling_axe',
      'ironbark_axe',
      'bronze_sickle',
      'silverleaf_sickle',
      'simple_fishing_pole',
      'thorium_ore',
      'arcanite_bar',
      'ashwood_log',
      'elderwood_log',
      'goldleaf_herb',
      'sunpetal_herb',
    ],
    greeting:
      'Springs, sprockets, and sharp edges, $C: the toolworks has whatever your hands lack.',
  },
};

// ---------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// World layout. Town sits at origin. +z north, +x WEST (east is -x:
// facing 0 looks along +z and turning right decreases facing, so the
// rendered world and the corrected map both put -x on your right).
// ---------------------------------------------------------------------------
