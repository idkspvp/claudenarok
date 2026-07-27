// Zone 3, Thornpeak Heights (levels 13-20). The Gravecallers serve Korzul
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
// Mobs (overworld only, the Gravewyrm Sanctum mobs live in content/dungeons)
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
