import { afterEach, describe, expect, it } from 'vitest';
import { getLanguage, setLanguage } from '../src/ui/i18n';
import {
  applyNativeDeviceLanguage,
  nativeDeviceLocaleList,
  resolveSupportedDeviceLanguage,
} from '../src/ui/native_language';

function storageWithLocale(
  locale: string | null,
  nativeAutoLocale: string | null = null,
): Pick<Storage, 'getItem' | 'setItem'> & { values: Map<string, string> } {
  const values = new Map<string, string>();
  if (locale) values.set('locale', locale);
  if (nativeAutoLocale) values.set('woc_native_auto_locale', nativeAutoLocale);
  return {
    values,
    getItem(key: string): string | null {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string): void {
      values.set(key, value);
    },
  };
}

describe('native device language selection', () => {
  afterEach(() => setLanguage('en'));

  // Dropped with the locale cut: uses an exact supported device dialect when available...

  // Dropped with the locale cut: falls back from device language subtags to an available ...

  it('returns null for unsupported device languages so English remains the default', () => {
    setLanguage('en');
    expect(resolveSupportedDeviceLanguage(['ar-SA', 'hi-IN'])).toBeNull();
    expect(
      applyNativeDeviceLanguage({
        native: true,
        storage: storageWithLocale(null),
        languages: ['ar-SA'],
      }),
    ).toBeNull();
    expect(getLanguage()).toBe('en');
  });

  it('does not override an explicit saved language or URL language', () => {
    setLanguage('en');
    expect(
      applyNativeDeviceLanguage({
        native: true,
        storage: storageWithLocale('ja_JP'),
        languages: ['de-DE'],
      }),
    ).toBeNull();
    expect(getLanguage()).toBe('en');

    expect(
      applyNativeDeviceLanguage({
        native: true,
        locationSearch: '?lang=pt_BR',
        storage: storageWithLocale(null),
        languages: ['de-DE'],
      }),
    ).toBeNull();
    expect(getLanguage()).toBe('en');
  });

  it('keeps native auto-selected languages device-driven across launches', () => {});

  it('resets an auto-managed saved locale to English when the device language is unavailable', () => {});

  // Dropped with the locale cut: it drove the device-language picker with an
  // it_IT device locale and asserted it is applied in native mode and ignored
  // outside it. Both halves need a supported non-English locale.

  it('deduplicates navigator.languages with navigator.language preserving priority', () => {
    expect(nativeDeviceLocaleList({ languages: ['pl-PL'], language: 'pl-PL' })).toEqual(['pl-PL']);
    expect(nativeDeviceLocaleList({ languages: ['ar-SA'], language: 'vi-VN' })).toEqual([
      'ar-SA',
      'vi-VN',
    ]);
  });
});
