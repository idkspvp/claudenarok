import { ITEM_SETS, ITEMS } from '../sim/data';

export interface ItemSetTooltipTier {
  pieces: number;
  active: boolean;
}

export interface ItemSetTooltipModel {
  setId: string;
  equippedPieces: number;
  totalPieces: number;
  bonusTiers: ItemSetTooltipTier[];
}

// How many pieces of one slot kind a character can wear at once. Everything is
// one, except the accessory: there are two accessory slots, so a set carrying
// both a belt and a pair of gloves really does wear both.
const WEARABLE_AT_ONCE: Record<string, number> = { ring: 2 };

export function itemSetMemberCounts(): Record<string, number> {
  const membersBySet = new Map<string, Map<string, number>>();
  for (const item of Object.values(ITEMS)) {
    if (!item.set) continue;
    const members = membersBySet.get(item.set) ?? new Map<string, number>();
    // A set's piece count is how many of it you can WEAR: the normal item, its
    // auto-generated heroic variant, and any bespoke heroic raid piece for the same
    // slot are all one collectible piece (you wear one helmet). Counting what fits
    // keeps the "X/N" denominator honest (e.g. the 4-slot t2 sets read /4, not an
    // inflated count from the parallel heroic-variant ids), and it is why the two
    // accessories are counted separately rather than collapsing into one.
    const key = item.slot ?? item.id;
    members.set(key, (members.get(key) ?? 0) + 1);
    membersBySet.set(item.set, members);
  }
  return Object.fromEntries(
    [...membersBySet].map(([setId, members]) => [
      setId,
      [...members].reduce(
        (total, [slot, authored]) => total + Math.min(authored, WEARABLE_AT_ONCE[slot] ?? 1),
        0,
      ),
    ]),
  );
}

export function itemSetTooltipModel(args: {
  itemSetId: string;
  equippedPieces: number;
  itemSetMembers?: Record<string, number>;
}): ItemSetTooltipModel | null {
  const set = ITEM_SETS[args.itemSetId];
  if (!set) return null;
  const totalPieces = args.itemSetMembers?.[set.id] ?? 0;
  const reachablePieces =
    totalPieces > 0
      ? totalPieces
      : set.bonuses.reduce((max, tier) => Math.max(max, tier.pieces), 0);
  return {
    setId: set.id,
    equippedPieces: args.equippedPieces,
    totalPieces: reachablePieces,
    bonusTiers: set.bonuses
      .filter((tier) => tier.pieces <= reachablePieces)
      .map((tier) => ({ pieces: tier.pieces, active: args.equippedPieces >= tier.pieces })),
  };
}
