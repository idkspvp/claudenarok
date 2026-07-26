// One multiplier for the three Ragnarok classifications, so the damage line asks
// a single question instead of three.
//
// A pure leaf over the element chart and the weapon size table. It takes RESOLVED
// values rather than an Entity, which is what keeps it host-free and testable
// without a world: the caller reads the attacker's weapon and the defender's
// attributes and hands over the facts.
//
// The order matters and is deliberate: size scales the WEAPON's contribution
// (a dagger glances off a large target no matter what it is made of), while
// element scales the WHOLE hit (a fire attack against a water monster is weak
// however it was delivered). A caller that folds them into one product loses
// that distinction, which is why both are returned separately as well.

import type { Element, ElementLevel, Size, WeaponType } from '../types';
import { elementMultiplier } from './elements';
import { weaponSizeMultiplier } from './weapon_size';

export interface AttributeHit {
  /** The attribute the swing carries. Neutral when unmarked. */
  attackElement?: Element;
  /** The attacker's weapon class, for the size table. */
  weaponType?: WeaponType;
  /** What the defender is made of, and how deeply. */
  defenderElement?: Element;
  defenderElementLevel?: ElementLevel;
  /** What shape the defender is. */
  defenderSize?: Size;
}

export interface AttributeMultipliers {
  /** Scales the weapon's contribution: the size table. */
  size: number;
  /** Scales the whole hit: the element chart. Can be negative (the hit heals). */
  element: number;
  /** Their product, for a caller that just wants the number. */
  total: number;
  /** The hit heals rather than hurts, so a caller must not clamp it at zero. */
  absorbs: boolean;
}

export function attributeMultipliers(hit: AttributeHit): AttributeMultipliers {
  const size = weaponSizeMultiplier(hit.weaponType, hit.defenderSize ?? 'medium');
  const element = elementMultiplier(
    hit.attackElement ?? 'neutral',
    hit.defenderElement ?? 'neutral',
    hit.defenderElementLevel ?? 1,
  );
  return { size, element, total: size * element, absorbs: element < 0 };
}

/** The combined multiplier alone, for the damage line. */
export function attributeDamageMultiplier(hit: AttributeHit): number {
  return attributeMultipliers(hit).total;
}
