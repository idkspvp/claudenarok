import { describe, expect, it } from 'vitest';
import { ABILITIES } from '../src/sim/data';
import { iconDataUrl } from '../src/ui/icons';

// Buff/debuff aura frames (the player buff bar and a mob's DoT debuffs, both via
// Hud.renderAuras) request their icon with kind 'aura'. When the aura carries a
// real ability id that ships an image-based skill icon (public/ui/skills/<class>/<id>.webp),
// the aura must show that SAME image, not the older procedural recipe, otherwise a
// DoT/buff renders one art on the action bar and a different one as an aura.
//
// Note: this suite runs in the default `node` env (no canvas), so it only exercises
// the early-return image branch of iconDataUrl. Ids without an image fall through to
// the procedural canvas path, which needs a DOM and is covered by the renderer E2E.

// A representative DoT (debuff) per applicable class plus a few persistent buffs,
// every id below is in ABILITY_IMAGE_IDS, so it has a shipped WebP icon.
// The Warlock, Druid, and Shaman DoTs that used to head this list went with
// their classes in D1, and so did Mark of the Wild.
const IMAGE_AURA_IDS = [
  'serpent_sting', // archer DoT
  'shadow_word_pain', // acolyte DoT
  'rupture',
  'garrote', // thief DoTs
  'arcane_intellect',
  'battle_shout',
  'power_word_fortitude', // buffs
];

describe('aura icons reuse image-based ability art', () => {
  it('every sampled aura id actually ships a PNG (guards the fixture)', () => {
    for (const id of IMAGE_AURA_IDS) {
      const url = iconDataUrl('ability', id);
      expect(url, `${id} should have an image-based ability icon`).toMatch(/^\/ui\/skills\//);
    }
  });

  it('an aura with an image-backed ability id renders that image, not a procedural data URL', () => {
    for (const id of IMAGE_AURA_IDS) {
      const cls = ABILITIES[id]?.class;
      expect(cls, `${id} must be a known ability`).toBeTruthy();
      const expected = `/ui/skills/${cls}/${id}.webp`;
      expect(iconDataUrl('aura', id), `aura ${id}`).toBe(expected);
      // and it matches what the action bar shows for the same ability
      expect(iconDataUrl('aura', id)).toBe(iconDataUrl('ability', id));
    }
  });
});
