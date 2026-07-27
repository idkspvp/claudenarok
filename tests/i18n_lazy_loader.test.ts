// The i18n lazy-locale loader seam.
//
// ensureLocaleLoaded is the ONLY async surface in src/ui/i18n.ts; t() and setLanguage
// stay SYNCHRONOUS forever. A not-yet-loaded locale falls back to English without
// throwing, and renders synchronously once the chunk is resident.
//
// English is currently the only shipped locale, so LOCALE_LOADERS is empty and the
// interesting half of this seam, the real fetch, the soft rejection, the coalescing
// of concurrent loads, the once-only prefetch, has nothing to exercise it. Those
// tests were removed rather than pointed at a locale that no longer exists; keeping
// them green against English would have asserted nothing while looking like coverage.
//
// What remains is the contract that still holds with one locale, and that a future
// second locale must not break: English is resident without a fetch, the loader map
// has no entry for it, and asking to load or prefetch it is a no-op rather than an
// error. That last part is the zero-non-en-bytes guarantee, and it is exactly what
// would regress if someone "simplified" the empty-map case into a throw.

import { afterEach, describe, expect, it } from 'vitest';
import {
  en,
  ensureLocaleLoaded,
  isLocaleResident,
  prefetchLocale,
  setLanguage,
  t,
} from '../src/ui/i18n';
import { LOCALE_LOADERS } from '../src/ui/i18n.resolved.generated/loaders';

describe('lazy-locale loader: English is resident without a fetch', () => {
  afterEach(() => setLanguage('en'));

  it('treats English as always resident and instant', async () => {
    expect(isLocaleResident('en')).toBe(true);
    await expect(ensureLocaleLoaded('en')).resolves.toBeUndefined();
  });

  it('carries no loader entry for English', () => {
    // English is statically imported as the eager base. A loader for it would mean
    // the app fetches a chunk it already has in the bundle.
    expect(LOCALE_LOADERS.en).toBeUndefined();
  });

  it('renders the three language-load status keys via t()', () => {
    setLanguage('en');
    expect(t('settings.languageLoading')).toBe(en.settings.languageLoading);
    expect(t('settings.languageLoadFailed')).toBe(en.settings.languageLoadFailed);
    expect(t('settings.languageLoadUnavailable')).toBe(en.settings.languageLoadUnavailable);
  });
});

describe('prefetchLocale', () => {
  afterEach(() => setLanguage('en'));

  it('is a no-op for English rather than an error', () => {
    setLanguage('en');
    expect(() => prefetchLocale('en')).not.toThrow();
    expect(isLocaleResident('en')).toBe(true);
  });

  it('is a no-op for a code with no loader rather than an error', () => {
    // The empty-map path. A code that has no chunk must be swallowed, not thrown:
    // a stored locale from an older build can still arrive here after a locale is
    // removed, and it has to degrade to English instead of breaking boot.
    expect(() => prefetchLocale('th_TH' as never)).not.toThrow();
  });

  it('resolves ensureLocaleLoaded for a code with no loader instead of rejecting', async () => {
    await expect(ensureLocaleLoaded('th_TH' as never)).resolves.toBeUndefined();
  });
});
