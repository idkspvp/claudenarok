// Shared class-presentation helpers used by the Classes pages, so the role badges,
// crest, and "feel" tags render identically everywhere. Pure HTML-string builders;
// all interpolation goes through esc().

import { type TranslationKey, t } from '../ui/i18n';
import { iconDataUrl } from '../ui/icons';
import { CLASS_META } from './class_meta';
import type { GuideRole } from './content.generated';
import { badge, tag, tagRow } from './pages/ui';

export function roleKey(role: GuideRole): TranslationKey {
  if (role === 'tank') return 'guide.role.tank';
  if (role === 'healer') return 'guide.role.healer';
  return 'guide.role.damage';
}

export const className = (id: string): string => t(`classes.${id}` as TranslationKey);
export const classLore = (id: string): string => t(`classDetails.lore.${id}` as TranslationKey);
export const classCrest = (id: string, size: number): string =>
  iconDataUrl('crest', `class_${id}`, size);
export const abilityHook = (id: string): string => t(`guide.abilityHook.${id}` as TranslationKey);

export function roleBadges(roles: GuideRole[]): string {
  return roles.map((r) => badge(t(roleKey(r)), `guide-role-${r}`)).join('');
}

// Qualitative "shape" tags from the curated class metadata, never numbers.
export function classTags(id: string): string {
  const m = CLASS_META[id];
  if (!m) return '';
  const styleKey: TranslationKey =
    m.style === 'melee'
      ? 'guide.tag.melee'
      : m.style === 'ranged'
        ? 'guide.tag.ranged'
        : 'guide.tag.both';
  const playKey: TranslationKey =
    m.play === 'solo'
      ? 'guide.tag.solo'
      : m.play === 'group'
        ? 'guide.tag.group'
        : 'guide.tag.flexible';
  const cxKey: TranslationKey =
    m.complexity === 'low'
      ? 'guide.tag.simple'
      : m.complexity === 'med'
        ? 'guide.tag.moderate'
        : 'guide.tag.complex';
  const chips = [
    tag(t(styleKey), 'guide-tag-style'),
    tag(t(playKey), 'guide-tag-play'),
    tag(t(cxKey), `guide-tag-cx guide-tag-cx-${m.complexity}`),
  ];
  if (m.goodFirst) chips.push(tag(t('guide.tag.goodFirst'), 'guide-tag-first'));
  return tagRow(chips.join(''));
}
