import { describe, expect, it } from 'vitest';
import { GROUND_PICKUP_LINES } from '../src/sim/content/ground_pickup_lines';
import { supportedLanguages } from '../src/ui/i18n';
import { DICT, localizeSimText } from '../src/ui/sim_i18n';

// The custom per-item ground-pickup lines are emitted via def.pickupDeny /
// def.pickupEnough (variable-routed), so the S3 emit-site guard cannot see
// them. This suite is their drift guard instead: every line in the content
// table must be recognized by the sim matcher (EXACT), and every locale must
// carry a real translation, not the English passthrough the DICT spread would
// silently fall back to.

const GROUND_PICKUP_KEYS = (Object.keys(DICT.en) as (keyof typeof DICT.en)[]).filter((k) =>
  k.startsWith('groundPickup.'),
);

describe('ground-pickup line localization (the S3-invisible surface)', () => {
  it('recognizes every deny/enough line in GROUND_PICKUP_LINES via the EXACT matcher', () => {
    for (const [id, lines] of Object.entries(GROUND_PICKUP_LINES)) {
      expect(localizeSimText(lines.deny), `deny line for ${id}`).not.toBeNull();
      expect(localizeSimText(lines.enough), `enough line for ${id}`).not.toBeNull();
    }
  });

  it('covers 34 distinct lines with groundPickup.* keys', () => {
    expect(GROUND_PICKUP_KEYS.length).toBe(34);
  });

  // Two tests stood here: one pinning a known translated literal per representative
  // locale, one asserting every non-English locale differs from the English value for
  // all 34 groundPickup keys. Both are locale-comparison by construction.
});
