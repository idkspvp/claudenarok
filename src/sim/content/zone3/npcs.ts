// Zone 3 — Thornpeak Heights (levels 13-20). The Gravecallers serve Korzul
// the Gravewyrm, an ancient dragon sealed beneath the peaks. Highwatch holds
// the wall against ogres, waking elementals, and the open chanting of the
// Wyrmcult at the Gravewyrm Sanctum gates.

import { WORK_ORDER_CADENCE_TICKS } from '../../professions/cadence';
import type {
  CampDef,
  GroundObjectDef,
  ItemDef,
  MobTemplate,
  NpcDef,
  QuestDef,
  ZoneDef,
  ZonePropsDef,
} from '../../types';
import { FERAL } from '../items';

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
