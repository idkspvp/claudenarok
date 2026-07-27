// Zone 2, Mirefen Marsh (levels 6-13). Brother Aldric follows the
// Gravecaller trail north of the causeway: drowned dead rise from the fen,
// trolls dig into barrow-mounds, and Vael the Fogbinder waits in the
// Sunken Bastion.

import { WORK_ORDER_CADENCE_TICKS } from '../../professions/cadence';
import type {
  CampDef,
  GroundObjectDef,
  ItemDef,
  MobTemplate,
  NpcDef,
  PlayerClass,
  QuestDef,
  ZoneDef,
  ZonePropsDef,
} from '../../types';
import { FERAL } from '../items';

export const ZONE2_NPCS: Record<string, NpcDef> = {
  warden_fenwick: {
    id: 'warden_fenwick',
    name: 'Warden Fenwick',
    title: 'Warden of Fenbridge',
    pos: { x: 3, z: 304 },
    facing: Math.PI,
    color: 0x7e5109,
    questIds: [
      'q_fenbridge_muster',
      'q_prowlers',
      'q_deepfen',
      'q_deepfen_purge',
      'q_trolls',
      'q_deacon',
    ],
    greeting: 'Hold at the gate, $C. Past those reeds, the fen does the killing for us.',
  },
  brother_aldric_fen: {
    id: 'brother_aldric_fen',
    name: 'Brother Aldric',
    title: 'Priest of the Vale',
    pos: { x: -8, z: 296 },
    facing: 0.8,
    color: 0xf7f9f9,
    questIds: [
      'q_aldrics_fallen_star',
      'q_idols',
      'q_drowned',
      'q_drowned_censers',
      'q_no_rest',
      'q_summoners',
      'q_bastion_door',
      'q_mistcaller',
      'q_highwatch_summons',
    ],
    greeting:
      'The Light keep you above the water, $N. The dead in this fen do not sleep, they wade.',
  },
  provisioner_hale: {
    id: 'provisioner_hale',
    name: 'Provisioner Hale',
    title: 'Provisioner',
    pos: { x: -4, z: 308 },
    facing: Math.PI / 2,
    color: 0x1e8449,
    questIds: ['q_prowler_pelts', 'q_fen_supplies', 'q_the_codfather', 'q_grubjaw'],
    vendorItems: [
      'fenbridge_rye',
      'marsh_mint_tea',
      'smoked_eel',
      'silvermist_cordial',
      'lesser_healing_potion',
      'lesser_mana_potion',
      'bogiron_mace',
      'fenreed_staff',
      'mirefen_skinner',
      'bogiron_hauberk',
      'marshcloth_robe',
      'reedwoven_jerkin',
      'fenwalker_boots',
      'reedwoven_trousers',
      // Gathering tools (#2343: every node harvest needs a matching tool, so
      // each zone hub stocks the tiers its own nodes use; Mirefen has tier-1
      // and tier-2 nodes). Tiered rods stay a Trader Wilkes exclusive.
      'copper_mining_pick',
      'iron_mining_pick',
      'handaxe',
      'felling_axe',
      'gathering_sickle',
      'bronze_sickle',
      'simple_fishing_pole',
    ],
    greeting:
      'Dry boots, dry bread, dry powder, at Fenbridge you get two of the three on a good day.',
  },
  herbalist_yara: {
    id: 'herbalist_yara',
    name: 'Herbalist Yara',
    title: 'Herbalist',
    pos: { x: 10, z: 295 },
    facing: -Math.PI / 2,
    color: 0x7d3c98,
    questIds: ['q_widows', 'q_broodmother'],
    greeting: 'Mind the thicket west of the road. The webs are thick as sailcloth this season.',
  },
  scout_maren: {
    id: 'scout_maren',
    name: 'Scout Maren',
    title: "Marshal's Scout",
    pos: { x: 6, z: 312 },
    facing: -0.6,
    color: 0x7d6608,
    questIds: ['q_troll_fetishes', 'q_cult_camp', 'q_olen'],
    greeting:
      'Quiet feet and a short blade keep you breathing out here. Speak quick, I am due back in the reeds.',
  },
  bursar_petra_vell: {
    id: 'bursar_petra_vell',
    name: 'Bursar Petra Vell',
    title: 'The Gilded Strongbox',
    // east side of the square, on open ground: {12,303} sits inside the inn's
    // collider margin and findSafePos would silently relocate her at spawn
    pos: { x: 9, z: 303 },
    facing: -Math.PI / 2,
    color: 0xc9a227,
    questIds: [],
    banker: true,
    greeting:
      'The Gilded Strongbox keeps clean ledgers and cleaner vaults. What shall we stow for you?',
  },
  chronicler_osric_fenn: {
    id: 'chronicler_osric_fenn',
    name: 'Chronicler Osric Fenn',
    title: 'The Marsh Chronicle',
    // West side of the square on open ground, looking east toward the gate
    // (stays west of x=9, the inn's collider margin, see above; nearest
    // authored neighbor ~10 units, he had been pressed against Fenwick's post).
    pos: { x: -14, z: 303 },
    facing: -1.4,
    color: 0x3fa66b, // fen teal: the chronicler tint is his identity (shared mage visual)
    questIds: [],
    greeting: 'Mind the damp on the pages, $N. The fen eats more books than readers ever will.',
  },
  // Crafting-station master (Professions 2.0): stands beside the
  // Fenbridge tannery (content/professions.ts STATIONS), on the northwest
  // edge of town with a guard-safe camp margin.
  tanner_hesk: {
    id: 'tanner_hesk',
    name: 'Tanner Hesk',
    title: 'Master of the Tannery',
    pos: { x: -11, z: 315.5 },
    facing: 2.3,
    color: 0x8a5a2a,
    // Professions 2.0: the Fenbridge tannery master runs the repeatable
    // leatherworking work order.
    questIds: ['q_prof_workorder_tannery'],
    // Station stocking: thorium_ore is the premium reagent the
    // tannery station's own recipe (recipe_duskhide_wraps) consumes.
    vendorItems: [
      'travelers_knapsack',
      'tough_jerky',
      'smoked_eel',
      'tanning_agent',
      'thorium_ore',
    ],
    greeting: 'A hide is only as good as its tanning, $C. The vats are ready when you are.',
  },
};

// ---------------------------------------------------------------------------
// Quests
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// World layout. Fenbridge sits at (0,300); +z north (deeper fen), +x west
// (east is -x, see the zone1 layout note).
// ---------------------------------------------------------------------------
