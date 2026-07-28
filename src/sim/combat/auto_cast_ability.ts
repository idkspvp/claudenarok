// Resolving the ability a piece of gear casts by itself.
//
// The ordinary resolver (`Sim.resolvedAbility`) answers from the wearer's KNOWN
// list, because every ordinary cast starts with a player pressing a key for
// something they learned. An auto-cast is the opposite: the point of a card that
// casts Fire Bolt is that it works on a character who will never learn Fire Bolt.
// So it resolves straight from the ability table instead.
//
// It resolves at rank 1 and costs nothing, which is what an auto-cast is in the
// reference: a fixed low level of the skill, cast by the item, not the wearer.
// Cooldown is zero for the same reason. The chance to fire IS the limiter.
//
// A pure leaf: table in, record out, no Sim.

import { ABILITIES } from '../data';
import type { ResolvedAbility } from '../sim';

export function resolveAutoCastAbility(abilityId: string): ResolvedAbility | null {
  const def = ABILITIES[abilityId];
  if (!def) return null;
  return {
    def,
    rank: 1,
    cost: 0,
    castTime: 0,
    cooldown: 0,
    effects: def.effects,
    threatFlat: def.threat?.flat ?? 0,
    threatMult: def.threat?.mult ?? 1,
  };
}
