import { localizeAbilityTitle } from './ability_i18n';
import { localizeSimAuraName } from './sim_i18n';

// Localize an aura/buff name that surfaces by its raw English name (buff frame tooltip,
// combat-log gain/fade, proc self-notes). Most auras are granted by an ability and have
// a localized title already; a few are pure flavor and live in sim_i18n.
export function auraDisplayNameFromSource(name: string): string {
  const viaTitle = localizeAbilityTitle(name);
  if (viaTitle !== name) return viaTitle;
  return localizeSimAuraName(name) ?? name;
}
