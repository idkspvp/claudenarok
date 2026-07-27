// zone2: the zone definition, its monsters, its NPCs, and its items.
//
// Split out of a single module so a branch authoring monsters and a branch
// authoring items stop colliding in one file. This barrel re-exports exactly
// what that module exported, so every existing import is unchanged.

export { ZONE2_ITEMS } from './items';
export { ZONE2_MOBS } from './mobs';
export { ZONE2_NPCS } from './npcs';
export {
  DEEPFEN_SHALLOWS_LAKE,
  ZONE2_CAMPS,
  ZONE2_OBJECTS,
  ZONE2_PROPS,
  ZONE2_ROADS,
  ZONE2_ZONE,
} from './world';
