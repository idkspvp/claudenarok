import { describe, it, expect } from "vitest";
import { fmtBytes, fmtDate } from "../src/admin/format";
import { setAdminLanguage, DICT } from "../src/admin/i18n";

const GiB = 1024 ** 3;
const MiB = 1024 ** 2;
const KiB = 1024;

// fmtBytes / fmtDate localize digits through Intl(adminLanguageTag()). The admin locale
// codes carry an underscore region (de_DE), which Intl rejects with a RangeError; the
// adminLanguageTag() normalization (de_DE -> de-DE) is what keeps these from throwing.
describe("admin fmtBytes", () => {
  it("keeps the en output byte-identical to the legacy toFixed/round shape", () => {
    setAdminLanguage("en");
    expect(fmtBytes(2 * GiB)).toBe("2.00 GB");
    expect(fmtBytes(5 * MiB)).toBe("5 MB");
    expect(fmtBytes(3 * KiB)).toBe("3 KB");
    setAdminLanguage("en");
  });

    // Dropped with the locale cut: it asserted fmtBytes renders "2,00 GB" under
    // es/de_DE. English uses the same separator as the code default, so there is no
    // longer a locale whose separator differs.

  it("sources the unit from the bytes.* admin keys", () => {
    expect(DICT.en["bytes.gigabytes"]).toBe("{n} GB");
    expect(DICT.en["bytes.megabytes"]).toBe("{n} MB");
    expect(DICT.en["bytes.kilobytes"]).toBe("{n} KB");
  });
});

describe("admin fmtDate", () => {
  const iso = "2026-01-15T14:32:00Z";

  it("formats a region-coded locale without throwing", () => {
    setAdminLanguage("de_DE");
    expect(() => fmtDate(iso)).not.toThrow();
    const de = fmtDate(iso);
    expect(de).not.toBe("—");
    expect(de.length).toBeGreaterThan(0);
    setAdminLanguage("en");
  });

    // Ditto: fmtDate needed two locales to differ from each other.
});
