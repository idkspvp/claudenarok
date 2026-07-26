import { describe, expect, it } from 'vitest';
import { planProfessionEvent } from '../src/ui/profession_event_lines_core';

// An attunementMasterForPair suite stood here. The map it read was derived from
// the attunement acceptance QUESTS, so with no quests every pair reads unseated.

describe('planProfessionEvent', () => {
  it('plans the trend nudge with the no-master variant', () => {
    // Every pair reads unseated now: the master map was derived from the
    // attunement acceptance quests, so the anchor-master arm of this case has
    // nothing to resolve until the profession pass gives the masters a new anchor.
    expect(
      planProfessionEvent(
        { type: 'profTrendNudge', pairId: 'jewelcrafting+weaponcrafting' },
        false,
      ),
    ).toEqual({
      kind: 'trendNudge',
      pairId: 'jewelcrafting+weaponcrafting',
      masterNpcId: null,
    });
  });

  it('plans the tier tutorial trigger', () => {
    expect(planProfessionEvent({ type: 'profTierTutorial' }, false)).toEqual({
      kind: 'tierTutorial',
    });
  });

  it('plans the zone attunement line carrying the celebrant name and pair', () => {
    expect(
      planProfessionEvent(
        { type: 'attunedZone', celebrantName: 'Ari', pairId: 'alchemy+cooking' },
        false,
      ),
    ).toEqual({ kind: 'attunedZone', celebrantName: 'Ari', pairId: 'alchemy+cooking' });
  });

  it('plans the personal attunement banner, gating motion but never sound', () => {
    expect(planProfessionEvent({ type: 'attuned', pairId: 'alchemy+cooking' }, false)).toEqual({
      kind: 'attunement',
      pairId: 'alchemy+cooking',
      playSound: true,
      motion: true,
    });
    // Reduced motion trims the flourish only; the sound (information cue) stays.
    expect(planProfessionEvent({ type: 'attuned', pairId: 'alchemy+cooking' }, true)).toEqual({
      kind: 'attunement',
      pairId: 'alchemy+cooking',
      playSound: true,
      motion: false,
    });
  });
});
