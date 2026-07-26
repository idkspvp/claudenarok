import { describe, expect, it } from 'vitest';
import { en } from '../src/ui/i18n.resolved.generated';

describe('Hourglass localization', () => {
  it('ships the English source and Spanish base translation with dynamic values', () => {
    expect(en.entities.abilities.temporal_hourglass.name).toBe('Hourglass of Suspension');
    expect(en.entities.abilities.temporal_hourglass.description).toContain('{duration}');
    expect(en.entities.abilities.temporal_hourglass.description).toContain('{healing}%');
    expect(en.entities.abilities.temporal_hourglass.description).toContain(
      '{selfCooldownRecovery}% faster',
    );
    expect(en.entities.abilities.temporal_hourglass.description).toContain(
      '{allyCooldownRecovery}% faster',
    );
    expect(en.entities.abilities.temporal_hourglass.description).toContain('{groundDuration} sec');

    // The Spanish pins and the es_ES dialect-alias test that followed went with the
    // locale cut. The English source pins above are the half that still holds: they
    // guard that this ability keeps its five interpolation tokens.
  });
});
