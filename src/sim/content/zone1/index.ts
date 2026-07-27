// zone1: the zone definition, its monsters, its NPCs, and its items.
//
// Split out of a single module so a branch authoring monsters and a branch
// authoring items stop colliding in one file. This barrel re-exports exactly
// what that module exported, so every existing import is unchanged.

export { ZONE1_MOBS } from './mobs';
export { ZONE1_NPCS } from './npcs';
export {
  GRAVEYARD_POS,
  LAKE,
  TOWN_RADIUS,
  ZONE1_CAMPS,
  ZONE1_CHAPEL_CAMPS,
  ZONE1_OBJECTS,
  ZONE1_PROPS,
  ZONE1_ROADS,
  ZONE1_ZONE,
} from './world';
