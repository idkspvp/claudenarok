// Zone 2 — Mirefen Marsh (levels 6-13). Brother Aldric follows the
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

export const DEEPFEN_SHALLOWS_LAKE = { x: -110, z: 310, radius: 35 };

export const ZONE2_ZONE: ZoneDef = {
  id: 'mirefen_marsh',
  name: 'Mirefen Marsh',
  zMin: 180,
  zMax: 540,
  levelRange: [6, 13],
  biome: 'marsh',
  hub: { x: 0, z: 300, radius: 20, name: 'Fenbridge' },
  graveyard: { x: -18, z: 286 },
  lakes: [DEEPFEN_SHALLOWS_LAKE, { x: 60, z: 380, radius: 25 }, { x: -40, z: 450, radius: 20 }],
  pois: [
    { x: 0, z: 300, label: 'Fenbridge', id: 'fenbridge' },
    { x: -40, z: 230, label: 'Prowler Reeds', id: 'prowler_reeds' },
    { x: -105, z: 300, label: 'Deepfen Shallows', id: 'deepfen_shallows' },
    { x: 80, z: 315, label: 'Widow Thicket', id: 'widow_thicket' },
    { x: 100, z: 435, label: 'Drowned Chapel', id: 'drowned_chapel' },
    { x: -95, z: 440, label: 'Troll Mounds', id: 'troll_mounds' },
    { x: 0, z: 485, label: 'Gravecaller Encampment', id: 'gravecaller_encampment' },
    { x: 45, z: 515, label: 'The Sunken Bastion', id: 'the_sunken_bastion' },
  ],
  welcome: 'Report to Warden Fenwick at the Fenbridge gate.',
};

// Causeway north from Eastbrook to Fenbridge, then spokes to each hub.
// The Drowned Chapel spoke rounds the lake at (60,380) along its western
// shore via Widow Thicket — the whole polyline stays clear of the lake carve
// so the road never dips under the waterline (tests/progression.test.ts
// samples every road against the heightfield to lock this in).
export const ZONE2_ROADS: { x: number; z: number }[][] = [
  [
    { x: 0, z: 80 },
    { x: 0, z: 180 },
    { x: -8, z: 240 },
    { x: 0, z: 300 },
  ], // Eastbrook -> Fenbridge
  [
    { x: 4, z: 308 },
    { x: 45, z: 336 },
    { x: 92, z: 350 },
    { x: 102, z: 392 },
    { x: 90, z: 420 },
  ], // -> Drowned Chapel
  [
    { x: -6, z: 308 },
    { x: -40, z: 370 },
    { x: -80, z: 420 },
  ], // -> Troll Mounds
  [
    { x: 2, z: 312 },
    { x: 10, z: 400 },
    { x: 20, z: 470 },
    { x: 45, z: 515 },
  ], // -> cult camp -> Bastion
];

// ---------------------------------------------------------------------------
// Mobs (overworld only — the Sunken Bastion's mobs live in content/dungeons)
// ---------------------------------------------------------------------------

export const ZONE2_CAMPS: CampDef[] = [
  // Prowlers: reed beds flanking the causeway south of town
  { mobId: 'mire_prowler', center: { x: -40, z: 230 }, radius: 22, count: 7 },
  { mobId: 'mire_prowler', center: { x: 35, z: 225 }, radius: 20, count: 6 },
  // Murlocs: shores of the big east lake — camps straddle the waterline
  { mobId: 'deepfen_murloc', center: { x: -82, z: 273 }, radius: 15, count: 8 },
  { mobId: 'deepfen_murloc', center: { x: -120, z: 350 }, radius: 13, count: 6 },
  { mobId: 'mirejaw_the_ravenous', center: { x: -132, z: 333 }, radius: 5, count: 1 },
  // Widows: thicket west of Fenbridge
  { mobId: 'mire_widow', center: { x: 70, z: 300 }, radius: 20, count: 7 },
  { mobId: 'mire_widow', center: { x: 95, z: 340 }, radius: 16, count: 6 },
  { mobId: 'mirefen_broodmother', center: { x: 98, z: 348 }, radius: 3, count: 1 },
  // Drowned dead: the Drowned Chapel and the shallows beyond
  { mobId: 'drowned_dead', center: { x: 90, z: 420 }, radius: 20, count: 8 },
  { mobId: 'drowned_dead', center: { x: 115, z: 450 }, radius: 16, count: 6 },
  { mobId: 'sloomtooth_the_drowned', center: { x: 118, z: 455 }, radius: 5, count: 1 },
  // Trolls: barrow-mounds in the southeast
  { mobId: 'fen_troll', center: { x: -80, z: 420 }, radius: 22, count: 7 },
  { mobId: 'fen_troll', center: { x: -105, z: 455 }, radius: 18, count: 6 },
  { mobId: 'grubjaw', center: { x: -120, z: 480 }, radius: 8, count: 1 },
  // Gravecaller encampment: deep fen, before the Bastion
  { mobId: 'gravecaller_cultist', center: { x: 15, z: 470 }, radius: 20, count: 7 },
  { mobId: 'gravecaller_cultist', center: { x: -25, z: 490 }, radius: 16, count: 6 },
  { mobId: 'gravecaller_summoner', center: { x: -5, z: 500 }, radius: 12, count: 4 },
  { mobId: 'gravecaller_mender', center: { x: 18, z: 472 }, radius: 8, count: 2 },
  { mobId: 'sister_nhalia', center: { x: 24, z: 492 }, radius: 5, count: 1 },
  { mobId: 'deacon_voss', center: { x: 0, z: 510 }, radius: 2, count: 1 },
  // Bog Bloats: volatile gas-bags drifting the dry eastern shelf of the marsh.
  // Listed last so their spawn draws never perturb the other camps' placement.
  { mobId: 'bog_bloat', center: { x: 72, z: 428 }, radius: 11, count: 5 },
  { mobId: 'bog_bloat', center: { x: 110, z: 440 }, radius: 11, count: 4 },
];

export const ZONE2_OBJECTS: GroundObjectDef[] = [
  {
    itemId: 'fen_muster_order',
    name: 'Fenbridge Muster Order',
    positions: [
      { x: 1, z: 294 },
      { x: -2, z: 297 },
    ],
  },
  {
    itemId: 'lost_caravan_goods',
    name: 'Lost Caravan Goods',
    positions: [
      { x: 1, z: 192 },
      { x: -3, z: 206 },
      { x: -6, z: 221 },
      { x: -8, z: 237 },
      { x: -7, z: 252 },
      { x: -3, z: 268 },
      { x: 2, z: 283 },
    ],
  },
  {
    itemId: 'rusted_censer',
    name: 'Rusted Censer',
    positions: [
      { x: 96, z: 429 },
      { x: 103, z: 430 },
      { x: 99, z: 434 },
      { x: 106, z: 437 },
      { x: 97, z: 440 },
      { x: 104, z: 441 },
    ],
  },
  {
    itemId: 'bastion_ward_stone',
    name: 'Bastion Ward Stone',
    positions: [
      { x: 43, z: 512 },
      { x: 48, z: 517 },
    ],
  },
  {
    itemId: 'unknown_alien_weaponry',
    name: 'Smoldering Meteor Debris',
    positions: [{ x: 151.8, z: 294.2 }],
  },
];

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export const ZONE2_PROPS: ZonePropsDef = {
  buildings: [
    { kind: 'inn', x: 13, z: 306, w: 6, d: 7, rot: -1.0 },
    { kind: 'house', x: -13, z: 308, w: 7, d: 6, rot: 0.5 },
    { kind: 'house', x: -12, z: 291, w: 6, d: 5, rot: 2.6 },
    { kind: 'house', x: 11, z: 316, w: 6, d: 5, rot: 0.3 },
  ],
  wells: [{ x: 0, z: 302, r: 1.5 }],
  stalls: [{ x: -5, z: 310.5, rot: Math.PI / 2, r: 1.7 }],
  mines: [],
  // fishing dock on the east shore of the big west lake
  docks: [{ x: -66, z: 305, rot: 1.68, hutLocal: { x: 2.8, z: 2.4, hw: 1.7, hd: 1.5 } }],
  tents: [
    // Gravecaller encampment
    { x: 12, z: 474, rot: 0.5, scale: 1 },
    { x: 20, z: 466, rot: 2.1, scale: 1 },
    { x: -22, z: 486, rot: 1.2, scale: 1 },
    { x: -28, z: 494, rot: -0.7, scale: 1 },
    { x: -3, z: 505, rot: 2.9, scale: 1.3 },
  ],
  crates: [
    [14, 468],
    [18, 471],
    [-23, 491],
    [2, 504],
  ],
  campfires: [
    [4, 299],
    [-2, 293],
    [16, 470],
    [-25, 489],
    [0, 506],
  ],
  // mud-hut clusters at the murloc shallows
  mudHuts: [
    [-78, 269],
    [-83, 266],
    [-74, 275],
    [-117, 346],
    [-123, 354],
  ],
  ruinRings: [{ x: 100, z: 435, ringR: 7, columns: 7 }],
  fences: [
    { x1: 16, z1: 311, x2: 21, z2: 299 },
    { x1: -18, z1: 313, x2: -22, z2: 300 },
  ],
  graveyards: [{ x: -18, z: 286 }],
};
