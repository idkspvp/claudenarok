// Pure, host-agnostic view model for "what does this NPC actually do".
//
// Talking to an NPC used to open a gossip dialog, and that dialog was the door to
// every service in the world: the vendor, the bank, the market, the heroic
// quartermaster, the Card Master, and a station master's training and unbind
// counters. The dialog went with the quest system, and every one of those doors
// went with it: the interaction path still called `openQuestDialog`, which had
// become an empty method, so talking to any NPC in the game did nothing at all.
//
// This core decides which services an NPC offers. The HUD routes them: one
// service opens directly, because making a player pick from a menu of one is a
// worse door than no menu; several show the picker.
//
// DOM-free and i18n-free (services are stable ids the painter localizes), so a
// Vitest drives it from plain records. No world access: the caller passes the
// facts, which keeps it drivable from both a Sim- and a ClientWorld-shaped host.

import type { NpcDef } from '../sim/types';

/** Every service an NPC can front. Stable ids: the painter maps them to labels
 *  and the HUD maps them to its open* methods. */
export type NpcServiceId = 'vendor' | 'market' | 'bank' | 'heroicVendor' | 'train' | 'unbind';

export interface NpcServicesDeps {
  /** Master npc ids that run a crafting station, from the station placements. */
  stationMasterIds: ReadonlySet<string>;
  /** Whether the viewer holds any bound item the unbind counter would list.
   *  A station master always OFFERS the service; with nothing bound the row
   *  list is empty, and an empty window is a worse answer than not offering it. */
  hasBoundItems: boolean;
}

/** The services this NPC offers, in a stable display order. */
export function npcServicesFor(
  npc: NpcDef | undefined,
  deps: NpcServicesDeps,
): readonly NpcServiceId[] {
  if (!npc) return [];
  const out: NpcServiceId[] = [];
  // Order is the order a player would want them: the thing most NPCs are for
  // first, the occasional extras after.
  if (npc.market) out.push('market');
  else if (npc.heroicVendor) out.push('heroicVendor');
  else if (npc.devVendor || (npc.vendorItems?.length ?? 0) > 0) out.push('vendor');
  if (npc.banker) out.push('bank');
  if (deps.stationMasterIds.has(npc.id)) {
    out.push('train');
    if (deps.hasBoundItems) out.push('unbind');
  }
  return out;
}

/** The i18n key for a service's menu row. Kept beside the ids so a new service
 *  cannot be added without deciding what it is called. */
export function npcServiceLabelKey(service: NpcServiceId): string {
  return `hudChrome.npcServices.${service}`;
}
