// The deed-locale lazy loader seam (the i18n_lazy_loader shape scoped to the
// Book of Deeds). Release-fill deed tables live in per-base-locale chunks so a
// default-English player downloads zero deed locale bytes and a non-English
// visitor fetches only their own locale's chunk. Every lookup (deedName/deedDesc/
// deedTitleText) stays SYNCHRONOUS: before a chunk is resident, a non-English read
// falls back to the authored English.
//
// English is currently the only shipped locale, so DEED_LOCALE_LOADERS is empty
// and the fetch/reject/coalesce/one-chunk-only tests have nothing to drive them.
// They were removed rather than aimed at deleted locales.
//
// The eager-bundle regression guard below is the one that still earns its place,
// and it is the most valuable test in the file regardless of locale count: it reads
// deed_i18n.ts as TEXT, so it catches a static value import of a locale chunk —
// the mistake that would silently pull a locale table back into the eager renderer
// bundle through hud.ts and render/nameplate_painter.ts. That failure mode is a
// bundle-size regression with no functional symptom, which is exactly the kind
// nothing else notices.

import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { DEED_LOCALE_LOADERS, deedName, ensureDeedLocalesLoaded } from '../src/ui/deed_i18n';
import { setLanguage } from '../src/ui/i18n';

describe('lazy deed locales', () => {
  afterEach(() => setLanguage('en'));

  it('has no chunk for English', () => {
    // English deed text is the authored source read straight from the content
    // table, so it must never get a loader entry.
    expect(DEED_LOCALE_LOADERS.en).toBeUndefined();
  });

  it('is an instant no-op for English', async () => {
    await expect(ensureDeedLocalesLoaded('en')).resolves.toBeUndefined();
  });

  it('resolves rather than rejects for a locale with no chunk', async () => {
    // A stored locale from an older build can still reach this after a locale is
    // removed. It has to degrade to English, not break boot.
    await expect(ensureDeedLocalesLoaded('th_TH' as never)).resolves.toBeUndefined();
  });

  it('reads the authored English deed name synchronously', () => {
    setLanguage('en');
    expect(deedName('prog_level_cap')).toBe('The View From the Top');
  });

  it('deed_i18n.ts carries no static VALUE import of a per-locale deed chunk', () => {
    const src = readFileSync(new URL('../src/ui/deed_i18n.ts', import.meta.url), 'utf8');
    // Only a type-only import (erased at build) or a dynamic import() thunk inside
    // DEED_LOCALE_LOADERS may reference a per-locale chunk. The positive half of
    // this assertion — that at least one dynamic thunk exists — is dropped while
    // the loader map is empty; it comes back with the second locale.
    expect(src).not.toMatch(
      /(?:^|\n)\s*(?:import|export)\s+(?!type\b)[^;]*?from\s+'\.\/deed_i18n\.locales\//,
    );
  });
});
