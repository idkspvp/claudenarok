// Cards: the sockets in a piece of equipment, and what goes into them.
//
// Ragnarok's endgame is not a better sword, it is the card in the sword. About a
// third of its equipment carries one to four sockets, and a card that fits the
// slot is the difference between a weapon and a build. The drop rates are the
// one part this game does NOT take from there (a median of one hundredth of a
// percent is a rate for a different era); those follow the modern classic-likes,
// and live in docs/design/drops-and-crafting.md.
//
// A pure leaf: it takes resolved records and returns what they add up to, so a
// Vitest drives it with no world.

import type { Element, Race, Size } from './combat/elements';
import type { CoreStats, EquipSlot, ItemSlot } from './types';

/** What a card is allowed to do. Modelled on the effect mix measured over the
 *  reference's 538 cards; the two kinds it deliberately omits for now, inflicting
 *  and resisting a status, and auto-casting a spell, need combat systems that do
 *  not exist yet. */
export interface CardEffect {
  /** Flat attributes, defence, magic defence, health, dodge, critical. */
  stats?: Partial<CoreStats>;
  /** Extra damage dealt to a race, an attribute, or a size, as a fraction. */
  versusRace?: { race: Race; fraction: number };
  versusElement?: { element: Element; fraction: number };
  versusSize?: { size: Size; fraction: number };
  /** Damage REDUCED from a race or an attribute, as a fraction. */
  resistRace?: { race: Race; fraction: number };
  resistElement?: { element: Element; fraction: number };
  /** Changes what the wearer's armour is made of, or what the weapon strikes
   *  with. The single most build-defining thing a card does in the reference. */
  armorElement?: Element;
  weaponElement?: Element;
}

export interface CardDef {
  id: string;
  name: string;
  /** Which equipment slots this card fits. A card that fits nothing worn is a
   *  content bug, which is why the slots are explicit rather than inferred. */
  fits: readonly EquipSlot[];
  /** The monster it comes from, so the guide and the drop tables agree. */
  from: string;
  effect: CardEffect;
}

/** The most sockets any single piece may carry, matching the reference. */
export const MAX_CARD_SLOTS = 4;

export function cardFitsSlot(card: CardDef, slot: ItemSlot | undefined): boolean {
  if (!slot) return false;
  // An item declares the accessory slot KIND; the two worn accessory slots are
  // the same kind for socketing purposes.
  if (slot === 'ring') return card.fits.includes('ring1') || card.fits.includes('ring2');
  return card.fits.includes(slot as EquipSlot);
}

/** Whether a card may go into this piece: it has to fit the slot AND there has
 *  to be a socket free. */
export function canSocket(
  card: CardDef,
  item: { slot?: ItemSlot; cardSlots?: number },
  socketed: readonly string[],
): boolean {
  const slots = item.cardSlots ?? 0;
  if (slots <= 0 || socketed.length >= slots) return false;
  return cardFitsSlot(card, item.slot);
}

export interface AggregatedCards {
  stats: Partial<CoreStats>;
  versusRace: Partial<Record<Race, number>>;
  versusElement: Partial<Record<Element, number>>;
  versusSize: Partial<Record<Size, number>>;
  resistRace: Partial<Record<Race, number>>;
  resistElement: Partial<Record<Element, number>>;
  /** The last card to set one wins, which is how the reference resolves two
   *  attribute cards in one piece. */
  armorElement?: Element;
  weaponElement?: Element;
}

export function emptyAggregate(): AggregatedCards {
  return {
    stats: {},
    versusRace: {},
    versusElement: {},
    versusSize: {},
    resistRace: {},
    resistElement: {},
  };
}

/** Add up every card socketed across every worn piece. Duplicates STACK, which
 *  is the reason a player hunts four of the same card rather than one of each. */
export function aggregateCards(cards: readonly CardDef[]): AggregatedCards {
  const out = emptyAggregate();
  for (const card of cards) {
    const e = card.effect;
    for (const [key, value] of Object.entries(e.stats ?? {})) {
      const k = key as keyof CoreStats;
      out.stats[k] = (out.stats[k] ?? 0) + (value ?? 0);
    }
    if (e.versusRace) {
      out.versusRace[e.versusRace.race] =
        (out.versusRace[e.versusRace.race] ?? 0) + e.versusRace.fraction;
    }
    if (e.versusElement) {
      out.versusElement[e.versusElement.element] =
        (out.versusElement[e.versusElement.element] ?? 0) + e.versusElement.fraction;
    }
    if (e.versusSize) {
      out.versusSize[e.versusSize.size] =
        (out.versusSize[e.versusSize.size] ?? 0) + e.versusSize.fraction;
    }
    if (e.resistRace) {
      out.resistRace[e.resistRace.race] =
        (out.resistRace[e.resistRace.race] ?? 0) + e.resistRace.fraction;
    }
    if (e.resistElement) {
      out.resistElement[e.resistElement.element] =
        (out.resistElement[e.resistElement.element] ?? 0) + e.resistElement.fraction;
    }
    if (e.armorElement) out.armorElement = e.armorElement;
    if (e.weaponElement) out.weaponElement = e.weaponElement;
  }
  return out;
}

/** The attack multiplier a socketed set gives against one specific defender.
 *  Multiplicative with the attribute chart rather than folded into it, so a card
 *  that adds a fifth against the undead adds a fifth of whatever the chart
 *  already decided. */
export function cardAttackMultiplier(
  agg: AggregatedCards,
  defender: { race?: Race; element?: Element; size?: Size },
): number {
  let bonus = 0;
  if (defender.race) bonus += agg.versusRace[defender.race] ?? 0;
  if (defender.element) bonus += agg.versusElement[defender.element] ?? 0;
  if (defender.size) bonus += agg.versusSize[defender.size] ?? 0;
  return 1 + bonus;
}

/** The damage-taken multiplier a socketed set gives against one attacker. */
export function cardDefenceMultiplier(
  agg: AggregatedCards,
  attacker: { race?: Race; element?: Element },
): number {
  let reduction = 0;
  if (attacker.race) reduction += agg.resistRace[attacker.race] ?? 0;
  if (attacker.element) reduction += agg.resistElement[attacker.element] ?? 0;
  // Never below zero: a stack of resist cards may reach immunity but must not
  // turn a hit into a heal, which is the attribute chart's job alone.
  return Math.max(0, 1 - reduction);
}
