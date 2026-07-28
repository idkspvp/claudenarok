import type { AuraKind } from '../types';

// One source of truth for the form kind set (types.ts FORM_AURA_KINDS, which
// includes form_fireball); re-exported here for the combat-side call sites.
export { isFormAuraKind } from '../types';

// The druid melee and travel forms are gone (no content ever granted them), so
// both predicates now describe the one remaining locking form.
export function isActionLockingFormAuraKind(kind: AuraKind): boolean {
  return kind === 'form_fireball';
}

export function isTravelFormAuraKind(kind: AuraKind): boolean {
  return kind === 'form_fireball';
}
