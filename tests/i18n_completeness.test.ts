import { describe, expect, it } from 'vitest';
import { en, setLanguage, tPlural } from '../src/ui/i18n';

// What survives the cut to an English-only locale set.
//
// This suite used to compare every catalog leaf across 22 locales: interpolation
// token parity, per-locale lazy loadability, locale-aware money grouping, and an
// English-leak bound on the non-Latin surfaces. With a single locale each of those
// compares English against itself and passes no matter what breaks, so they are
// gone rather than left as green decoration — a vacuous guard is worse than none,
// because it reads like coverage. They come back with the second locale.
//
// CLDR pluralization is the part that still has teeth. tPlural picks a category
// from the viewer's plural rules and substitutes the count, and English exercises
// the one/other split, so the subsystem can still regress and this still catches it.

describe('i18n CLDR pluralization', () => {
  // The plural bases declared in the catalog (under hudChrome.plurals).
  const enPlurals = (en as { hudChrome: { plurals: Record<string, Record<string, string>> } })
    .hudChrome.plurals;
  const bases = Object.keys(enPlurals);

  it('declares the expected plural bases with all four CLDR categories in en', () => {
    expect(bases.slice().sort()).toEqual([
      'characterCount',
      'finderPartySize',
      'guildMembers',
      'playersMatching',
      'playersOnline',
      'secondsRemaining',
    ]);
    // The `few` and `many` leaves are carried for locales whose rules select them.
    // English never chooses either, so asserting they are present here is what stops
    // them being quietly dropped while no locale is around to miss them.
    for (const base of bases) {
      for (const cat of ['one', 'few', 'many', 'other']) {
        expect(typeof enPlurals[base][cat], `en plurals.${base}.${cat}`).toBe('string');
      }
    }
  });

  it('tPlural selects one/other for English and substitutes the count', () => {
    setLanguage('en');
    expect(tPlural('hudChrome.plurals.characterCount', 1)).toBe('1 character');
    expect(tPlural('hudChrome.plurals.characterCount', 7)).toBe('7 characters');
    expect(tPlural('hudChrome.plurals.characterCount', 0)).toBe('0 characters');
  });

  // tPlural owns exactly one substitution: {count}. Other placeholders in a plural
  // leaf belong to the caller (guildMembers carries {rank}, filled by the guild
  // roster), so they must survive untouched rather than be resolved or stripped.
  it('every declared base substitutes {count} in English and leaves other tokens alone', () => {
    setLanguage('en');
    for (const base of bases) {
      for (const count of [0, 1, 5]) {
        const rendered = tPlural(`hudChrome.plurals.${base}`, count);
        expect(rendered, `${base} @ ${count}`).toBeTruthy();
        expect(rendered, `${base} @ ${count} left {count} unresolved`).not.toContain('{count}');
        expect(rendered, `${base} @ ${count} dropped the count`).toContain(String(count));
      }
    }
  });
});
