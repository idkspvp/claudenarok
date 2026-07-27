// Localize a content title that surfaces by its raw ENGLISH name rather than by
// id: buff-frame aura names, combat-log gain/fade lines, proc self-notes. The
// sim emits those strings verbatim (it is language-agnostic), and almost all of
// them are an ability's name, so resolving the name back to its ability id and
// asking the entity dictionary is the whole job.
//
// This was the surviving half of the retired talent_i18n module's title
// resolver: the other half looked up talent-row grant titles and a per-locale
// talent-title override table, and both went with the talent trees.

import { ABILITIES } from '../sim/data';
import { tEntity } from './entity_i18n';
import { getLanguage, isAuthoredEnglish, type SupportedLanguage } from './i18n';

const abilityIdByName = new Map(
  Object.values(ABILITIES).map((ability) => [ability.name, ability.id]),
);

/** Localize an English ability title, or return it unchanged when it is not an
 *  ability name (a pure-flavor aura, say) or the locale authors in English. */
export function localizeAbilityTitle(
  source: string,
  lang: SupportedLanguage = getLanguage(),
): string {
  if (isAuthoredEnglish(lang)) return source;
  const abilityId = abilityIdByName.get(source);
  if (abilityId === undefined) return source;
  const abilityTitle = tEntity({ kind: 'ability', id: abilityId, field: 'name' });
  return abilityTitle !== source ? abilityTitle : source;
}
