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

export const TOWN_RADIUS = 26;
export const GRAVEYARD_POS = { ...EASTBROOK_LAYOUT.services.graveyard.legacyReleasePoint };
// Basin carved into the heightfield. Pushed to the far northeast so its
// shoreline meets the fishing dock and the murloc camp instead of drowning them.
export const LAKE = { x: -92, z: 88, radius: 30 };

export const ZONE1_ZONE: ZoneDef = {
  id: 'eastbrook_vale',
  name: 'Eastbrook Vale',
  zMin: -180,
  zMax: 180,
  levelRange: [1, 7],
  biome: 'vale',
  hub: { x: 0, z: 0, radius: TOWN_RADIUS, name: 'Eastbrook' },
  graveyard: GRAVEYARD_POS,
  lakes: [LAKE],
  pois: [
    { x: 0, z: -3, label: 'Eastbrook', id: 'eastbrook' },
    { x: -2, z: 70, label: 'Wolf Run', id: 'wolf_run' },
    { x: 65, z: 0, label: 'Boar Meadow', id: 'boar_meadow' },
    { x: -88, z: 82, label: 'Mirror Lake', id: 'mirror_lake' },
    { x: -60, z: 4, label: 'Sableweb', id: 'sableweb' },
    { x: -84, z: -64, label: 'Copper Dig', id: 'copper_dig' },
    { x: 76, z: -76, label: 'Bandit Camp', id: 'bandit_camp' },
    { x: 80, z: 80, label: 'Fallen Chapel', id: 'fallen_chapel' },
    { x: -5, z: -52, label: 'Reliquary Hill', id: 'reliquary_hill' },
    { x: 40, z: 140, label: 'Brightwood Glade', id: 'brightwood_glade' },
    { x: -11, z: -112, label: 'The Sowfield', id: 'the_sowfield' },
  ],
  welcome: 'Find Marshal Redbrook in town - he has work for you.',
  welcomeQuestId: 'q_wolves',
};

// ---------------------------------------------------------------------------
// Mobs
// ---------------------------------------------------------------------------

export const ZONE1_CAMPS: CampDef[] = [
  // Wolves: north woods
  { mobId: 'forest_wolf', center: { x: -15, z: 55 }, radius: 22, count: 7 },
  { mobId: 'forest_wolf', center: { x: 20, z: 70 }, radius: 20, count: 6 },
  { mobId: 'old_greyjaw', center: { x: 0, z: 95 }, radius: 8, count: 1 },
  // Boars: east meadow
  { mobId: 'wild_boar', center: { x: 55, z: 12 }, radius: 22, count: 6 },
  { mobId: 'wild_boar', center: { x: 80, z: -15 }, radius: 18, count: 5 },
  { mobId: 'mogger', center: { x: 118, z: -26 }, radius: 5, count: 1 },
  // Spiders: western woods
  { mobId: 'webwood_spider', center: { x: -60, z: 5 }, radius: 22, count: 7 },
  // Murlocs: lake shore northwest — camp straddles the waterline
  { mobId: 'mudfin_murloc', center: { x: -75, z: 57 }, radius: 14, count: 8 },
  // Kobolds: mine southwest
  { mobId: 'tunnel_rat', center: { x: -82, z: -62 }, radius: 20, count: 9 },
  // Bandits: southeast camp
  { mobId: 'vale_bandit', center: { x: 65, z: -65 }, radius: 24, count: 7 },
  { mobId: 'vale_bandit', center: { x: 90, z: -90 }, radius: 16, count: 5 },
  { mobId: 'gorrak', center: { x: 92, z: -92 }, radius: 2, count: 1 },
  // Undead: ruins northeast
  { mobId: 'restless_bones', center: { x: 80, z: 78 }, radius: 18, count: 8 },
  { mobId: 'captain_verlan', center: { x: 92, z: 90 }, radius: 4, count: 1 },
];

// Spawned LAST in the merged CAMPS array (see data.ts) so these appended draws
// fall after every other zone's camp spawns — and the camp loop is the final
// RNG consumer at construction (ground objects, dungeon doors and addPlayer draw
// none). Keeping the rare elite at the tail means adding it shifts no other
// content's deterministic spawn rolls, so fixed-seed tests stay stable.
export const ZONE1_CHAPEL_CAMPS: CampDef[] = [
  // A pair of bone guardians flank the chapel's broken altar; their binder lurks within.
  { mobId: 'restless_bones', center: { x: 88, z: 90 }, radius: 6, count: 2 },
  { mobId: 'wraithbinder_maldrec', center: { x: 88, z: 92 }, radius: 3, count: 1 },
];

export const ZONE1_OBJECTS: GroundObjectDef[] = [
  {
    itemId: 'supply_crate',
    name: 'Stolen Supply Crate',
    positions: [
      { x: 58, z: -58 },
      { x: 73, z: -70 },
      { x: 86, z: -82 },
      { x: 95, z: -97 },
      { x: 64, z: -76 },
      { x: 81, z: -94 },
    ],
  },
  {
    itemId: 'gravecaller_sigil',
    name: "Gravecaller's Sigil",
    positions: [
      { x: 84, z: 88 },
      { x: 76, z: 92 },
    ],
  },
  {
    itemId: 'weathered_ledger_page',
    name: 'Weathered Ledger Page',
    positions: [
      { x: 78, z: 84 },
      { x: 83, z: 88 },
      { x: 86, z: 92 },
    ],
  },
  {
    itemId: 'morthen_grimoire',
    name: "Morthen's Grimoire",
    positions: [{ x: 78, z: 86 }],
  },
];

// Roads from town toward each hub — used for terrain painting and the map.
// Roads from town toward each hub — used for terrain painting and the map.
export const ZONE1_ROADS: { x: number; z: number }[][] = [
  [...EASTBROOK_LAYOUT.roads[0].points, { x: -8, z: 30 }, { x: -15, z: 55 }, { x: -2, z: 78 }], // north to wolves
  [...EASTBROOK_LAYOUT.roads[1].points, { x: 30, z: 8 }, { x: 55, z: 12 }], // east to boars
  [...EASTBROOK_LAYOUT.roads[2].points, { x: 30, z: -30 }, { x: 50, z: -50 }, { x: 65, z: -65 }], // southeast to bandits
  [...EASTBROOK_LAYOUT.roads[3].points, { x: -35, z: 25 }, { x: -58, z: 48 }, { x: -66, z: 58 }], // northwest to lake
  [...EASTBROOK_LAYOUT.roads[4].points, { x: -30, z: -28 }, { x: -55, z: -45 }, { x: -70, z: -55 }], // southwest to mine
  [...EASTBROOK_LAYOUT.roads[5].points, { x: 35, z: 35 }, { x: 60, z: 60 }, { x: 78, z: 74 }], // northeast to ruins
];

// ---------------------------------------------------------------------------
// Static props (rendering + collision share this placement data)
// ---------------------------------------------------------------------------

export const ZONE1_PROPS: ZonePropsDef = {
  buildings: [
    {
      id: EASTBROOK_LAYOUT.preservedBuildings[0].id,
      assetId: EASTBROOK_LAYOUT.preservedBuildings[0].assetId,
      kind: EASTBROOK_LAYOUT.preservedBuildings[0].kind,
      landmark: EASTBROOK_GRAND_ARMOURY.landmark,
      ...EASTBROOK_GRAND_ARMOURY.lot,
      height: EASTBROOK_GRAND_ARMOURY.aboveGradeHeight,
    },
    ...EASTBROOK_LAYOUT.buildings.map((building) => ({
      id: building.id,
      assetId: building.assetId,
      kind: building.kind,
      x: building.position.x,
      z: building.position.z,
      w: building.nativeDimensions.width,
      d: building.nativeDimensions.depth,
      rot: building.rotation,
      height: building.nativeDimensions.height,
    })),
  ],
  wells: [
    {
      id: EASTBROOK_LAYOUT.civic.wellBeacon.id,
      assetId: EASTBROOK_LAYOUT.civic.wellBeacon.assetId,
      x: EASTBROOK_LAYOUT.civic.wellBeacon.position.x,
      z: EASTBROOK_LAYOUT.civic.wellBeacon.position.z,
      r: EASTBROOK_LAYOUT.civic.wellBeacon.radius,
      height: EASTBROOK_LAYOUT.civic.wellBeacon.height,
      camGhost: false,
    },
  ],
  stalls: EASTBROOK_LAYOUT.market.stalls.map((stall) => ({
    id: stall.id,
    assetId: stall.assetId,
    x: stall.position.x,
    z: stall.position.z,
    rot: stall.rotation,
    r: Math.hypot(stall.width / 2, stall.depth / 2),
    w: stall.width,
    d: stall.depth,
    height: stall.height,
    canopyVariant: stall.canopyVariant,
    camGhost: false,
  })),
  mines: [{ x: -88, z: -68, rot: 0.8 }],
  docks: [{ x: -64, z: 60, rot: -2.2, hutLocal: { x: 2.8, z: 2.4, hw: 1.7, hd: 1.5 } }],
  tents: [
    { x: 62, z: -61, rot: 0.4, scale: 1 },
    { x: 69, z: -69, rot: 2.1, scale: 1 },
    { x: 88, z: -86, rot: 1.2, scale: 1.3 },
    { x: 95, z: -94, rot: -0.6, scale: 1 },
  ],
  crates: [
    [60, -63],
    [66, -67],
    [87, -88],
    [93, -90],
    [70, -72],
  ],
  campfires: [
    [65, -65],
    [90, -90],
    [-80, -60],
    [-61, 56],
  ],
  mudHuts: [
    [-73, 59],
    [-78, 54],
    [-69, 55],
  ],
  ruinRings: [
    { x: 80, z: 78, ringR: 7, columns: 7 },
    { x: -5, z: -60, ringR: 8, columns: 6 },
  ],
  fences: EASTBROOK_LAYOUT.fences.map((fence) => ({
    id: fence.id,
    assetId: fence.assetId,
    x1: fence.start.x,
    z1: fence.start.z,
    x2: fence.end.x,
    z2: fence.end.z,
    width: fence.width,
    height: fence.height,
  })),
  benches: EASTBROOK_LAYOUT.civic.benches.map((bench) => ({
    id: bench.id,
    assetId: bench.assetId,
    x: bench.position.x,
    z: bench.position.z,
    w: bench.width,
    d: bench.depth,
    rot: bench.rotation,
    height: 1,
    camGhost: false,
  })),
  walls: EASTBROOK_LAYOUT.wall.segments.map((segment) => ({
    id: segment.id,
    assetId: segment.assetId,
    x: segment.footprint.center.x,
    z: segment.footprint.center.z,
    w: segment.footprint.halfWidth * 2,
    d: segment.footprint.halfDepth * 2,
    rot: segment.footprint.rotation,
    height: segment.height,
    camGhost: false,
  })),
  graveyards: [{ ...EASTBROOK_LAYOUT.services.graveyard.position }, { x: 4, z: -56 }],
  delveMarkers: [{ x: -5, z: -52, delveId: 'collapsed_reliquary' }],
};
