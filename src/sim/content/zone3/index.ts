// zone3: the zone definition, its monsters, its NPCs, and its items.
//
// Split out of a single module so a branch authoring monsters and a branch
// authoring items stop colliding in one file. This barrel re-exports exactly
// what that module exported, so every existing import is unchanged.

export { ZONE3_ITEMS } from './items';
export { ZONE3_MOBS } from './mobs';
export { ZONE3_NPCS } from './npcs';
export { ZONE3_CAMPS, ZONE3_OBJECTS, ZONE3_PROPS, ZONE3_ROADS, ZONE3_ZONE } from './world';
