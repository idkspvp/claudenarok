// What does talking to an NPC actually do.
//
// The regression this exists for: the gossip dialog was the one door to every
// service in the world, it went with the quest system, and nothing replaced it.
// Talking to a vendor, a banker, the market merchant, the quartermaster, the Card
// Master, or a station master all did nothing at all. These cases pin that each
// of those NPCs resolves to a service again.

import { describe, expect, it } from 'vitest';
import { STATIONS } from '../src/sim/content/professions';
import { NPCS } from '../src/sim/data';
import type { NpcDef } from '../src/sim/types';
import { npcServiceLabelKey, npcServicesFor } from '../src/ui/npc_services_view';

const MASTERS = new Set(STATIONS.map((s) => s.masterNpcId));
const deps = (hasBoundItems = false) => ({ stationMasterIds: MASTERS, hasBoundItems });
const npc = (over: Partial<NpcDef>): NpcDef => ({ id: 'x', ...over }) as NpcDef;

describe('the services an NPC fronts', () => {
  it('resolves each service flag to its own service', () => {
    expect(npcServicesFor(npc({ vendorItems: ['a'] }), deps())).toEqual(['vendor']);
    expect(npcServicesFor(npc({ market: true }), deps())).toEqual(['market']);
    expect(npcServicesFor(npc({ banker: true }), deps())).toEqual(['bank']);
    expect(npcServicesFor(npc({ heroicVendor: true }), deps())).toEqual(['heroicVendor']);
    expect(npcServicesFor(npc({ devVendor: true }), deps())).toEqual(['vendor']);
  });

  it('gives a station master training, and unbind only with something bound', () => {
    const master = npc({ id: [...MASTERS][0] });
    expect(npcServicesFor(master, deps(false))).toContain('train');
    // Offering an unbind counter to someone holding nothing bound opens an empty
    // window; not offering it is the honest answer.
    expect(npcServicesFor(master, deps(false))).not.toContain('unbind');
    expect(npcServicesFor(master, deps(true))).toContain('unbind');
  });

  it('returns nothing for a plain NPC, and never throws on a missing one', () => {
    expect(npcServicesFor(npc({}), deps(true))).toEqual([]);
    expect(npcServicesFor(undefined, deps(true))).toEqual([]);
  });

  it('picks ONE shop kind, so a market NPC never also lists a plain vendor', () => {
    const both = npc({ market: true, vendorItems: ['a'], heroicVendor: true });
    const out = npcServicesFor(both, deps());
    expect(out.filter((s) => s === 'vendor' || s === 'market' || s === 'heroicVendor')).toEqual([
      'market',
    ]);
  });

  it('every real NPC that has a counter still resolves to one', () => {
    // The whole point: sweep the shipped world and prove nothing is a dead end.
    // A drop to zero here is exactly the bug that shipped, one table at a time.
    const withService = Object.values(NPCS).filter(
      (def) => npcServicesFor(def, deps(true)).length > 0,
    );
    expect(withService.length).toBeGreaterThanOrEqual(19);
    const kinds = new Set(withService.flatMap((def) => npcServicesFor(def, deps(true))));
    for (const kind of ['vendor', 'market', 'bank', 'train', 'unbind'])
      expect(kinds, `no NPC in the world offers ${kind}`).toContain(kind);
  });

  it('every station master fronts more than one counter, so the picker is load-bearing', () => {
    for (const id of MASTERS) {
      const def = NPCS[id];
      expect(def, `station master ${id} is not a real NPC`).toBeTruthy();
      expect(npcServicesFor(def, deps(true)).length, id).toBeGreaterThan(1);
    }
  });

  it('names every service it can return', () => {
    const all = new Set(Object.values(NPCS).flatMap((def) => npcServicesFor(def, deps(true))));
    for (const service of all) expect(npcServiceLabelKey(service)).toMatch(/^hudChrome\./);
  });
});
