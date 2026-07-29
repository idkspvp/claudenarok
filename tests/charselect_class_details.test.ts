import { describe, expect, it } from 'vitest';
import { ABILITIES, CLASSES } from '../src/sim/content/classes';
import type { PlayerClass } from '../src/sim/types';
import { CLASS_DETAILS, SIGNATURE_ABILITIES } from '../src/ui/class_details_data';

// Guards the hand-maintained character-select showcase data against drift from
// the sim's source of truth. If a class's ability kit or roster changes, these
// assertions force the showcase metadata to be updated in the same change.

const classIds = Object.keys(CLASSES) as PlayerClass[];

describe('character-select class details parity', () => {
  it('covers every playable class exactly once', () => {
    for (const cls of classIds) {
      expect(CLASS_DETAILS[cls], `missing CLASS_DETAILS for ${cls}`).toBeTruthy();
      expect(SIGNATURE_ABILITIES[cls], `missing SIGNATURE_ABILITIES for ${cls}`).toBeTruthy();
    }
    expect(Object.keys(CLASS_DETAILS).sort()).toEqual([...classIds].sort());
    expect(Object.keys(SIGNATURE_ABILITIES).sort()).toEqual([...classIds].sort());
  });

  for (const cls of classIds) {
    describe(cls, () => {
      const picks = SIGNATURE_ABILITIES[cls];

      it('lists three signature abilities, or none while the class has no kit', () => {
        // A class with no authored abilities cannot name three of them, and
        // borrowing another class's would put a Warrior's kit on a Knight's
        // select screen. Those classes are unstartable, so the screen never
        // shows the empty list; when their kits land this returns to three.
        const hasKit = CLASSES[cls].abilities.length > 0;
        expect(picks).toHaveLength(hasKit ? 3 : 0);
        expect(new Set(picks).size).toBe(picks.length); // no duplicates
      });

      for (const id of picks) {
        it(`"${id}" is a real ability that ${cls} can learn`, () => {
          const ability = ABILITIES[id];
          expect(ability, `ability "${id}" does not exist`).toBeTruthy();
          expect(ability.class, `"${id}" belongs to ${ability?.class}, not ${cls}`).toBe(cls);
          expect(
            CLASSES[cls].abilities,
            `"${id}" is not in ${cls}'s learnable ability list`,
          ).toContain(id);
        });
      }
    });
  }
});

// The specialization-card metadata block that stood here (SPEC_CARD_INFO, the
// 27-spec coverage guard, and the per-spec example checks) went with the
// specializations themselves in Phase D0.
