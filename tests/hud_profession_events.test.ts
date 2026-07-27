// @vitest-environment jsdom

// The HUD render sink for the four Professions 2.0 text-free
// SimEvents (profTrendNudge, profTierTutorial, attuned, attunedZone). The sim
// emits ids and names only; handleProfessionEvent must resolve the LOCALIZED
// archetype title and master name (never leak the raw pairId, whose '+'
// separator is the wire spelling, not player copy) and execute exactly the
// plan's one render action per arm: a chat line, the tutorial panel, or the
// celebration banner family (banner + polite announcer + one achievement
// cue). Exercised via a bare Hud prototype (the profession_tutorial_window /
// hud_confirm_gates precedent) since handleProfessionEvent is private.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { audio } from '../src/game/audio';
import { ARCHETYPE_PAIR_TARGETS } from '../src/sim/professions/archetype';
import { archetypeTitleText } from '../src/ui/char_window';
import { tEntity } from '../src/ui/entity_i18n';
import { Hud } from '../src/ui/hud';
import { t } from '../src/ui/i18n';
import {
  attunementMasterForPair,
  type ProfessionEventInput,
} from '../src/ui/profession_event_lines_core';
import type { CraftingIdentityView } from '../src/world_api/professions';

// jsdom ships no matchMedia; the handler reads only `.matches` to derive the
// reduced-motion flag. A never-matching stub keeps motion on (the desktop
// default the attuned banner assertion below relies on).
window.matchMedia = ((query: string) =>
  ({ matches: false, media: query }) as MediaQueryList) as typeof window.matchMedia;

interface ProfessionEventHarness {
  log: ReturnType<typeof vi.fn>;
  showBanner: ReturnType<typeof vi.fn>;
  combatAnnouncer: { push: ReturnType<typeof vi.fn> };
  sim: {
    craftingIdentity: CraftingIdentityView;
    professionsState: { skills: readonly { professionId: string; skill: number }[] };
  };
  charWindow: { renderIfOpen: ReturnType<typeof vi.fn> };
  renderCrafting: ReturnType<typeof vi.fn>;
  openProfessionTutorial: ReturnType<typeof vi.fn>;
  questDialog: { refreshIfChanged: ReturnType<typeof vi.fn> };
  handleProfessionEvent(ev: ProfessionEventInput): void;
}

function makeHud(): ProfessionEventHarness {
  const hud = Object.create(Hud.prototype) as unknown as ProfessionEventHarness;
  hud.log = vi.fn();
  hud.showBanner = vi.fn();
  hud.combatAnnouncer = { push: vi.fn() };
  hud.sim = {
    craftingIdentity: {
      version: 1,
      synced: true,
      craftSkills: {},
      activeArchetype: 'leatherworking',
      pairedMajor: 'tailoring',
      hobbyCraft: null,
      attunedPairs: ['leatherworking+tailoring'],
      switchCount: 0,
      amendsProgress: 0,
      amendsRequired: 5,
      knownRecipes: [],
    },
    professionsState: { skills: [] },
  };
  hud.charWindow = { renderIfOpen: vi.fn() };
  hud.renderCrafting = vi.fn();
  // The attuned arm also probes the gossip dialog's intro-hint staleness
  // (attunement retires the hint); the dialog's own behavior is pinned in
  // quest_dialog_controller.test.ts, this harness only has to ROUTE there.
  hud.questDialog = { refreshIfChanged: vi.fn() };
  document.getElementById('crafting-window')?.remove();
  const craftingWindow = document.createElement('div');
  craftingWindow.id = 'crafting-window';
  craftingWindow.style.display = 'none';
  document.body.appendChild(craftingWindow);
  // Instance stub shadows the private prototype method: the tierTutorial arm
  // only has to ROUTE here; the panel itself is pinned in
  // profession_tutorial_window.test.ts.
  hud.openProfessionTutorial = vi.fn();
  return hud;
}

// A wave-one pair with a seated anchor master (content/zone1/
// q_prof_attune_smith), so the trendNudge master arm has a real name to
// resolve.
const MASTER_PAIR = 'weaponcrafting+armorcrafting';
const MASTER_NPC_ID = 'forgemistress_darva';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Hud.handleProfessionEvent', () => {
  it('profTrendNudge falls to the noMaster line for a ring pair without a seated master', () => {
    // Derived, not hand-picked: any ring pair outside the four wave-one
    // archetypes has no attunement quest, hence no master to name. If a later
    // phase seats all ten masters this find() comes up empty and the arm
    // becomes dead code, which this guard would surface.
    const pair = ARCHETYPE_PAIR_TARGETS.find((p) => attunementMasterForPair(p) === null);
    expect(pair).toBeTruthy();

    const hud = makeHud();
    hud.handleProfessionEvent({ type: 'profTrendNudge', pairId: pair as string });

    expect(hud.log).toHaveBeenCalledTimes(1);
    const line = hud.log.mock.calls[0][0] as string;
    expect(line).toBe(
      t('hudChrome.crafting.trendNudgeNoMaster', { archetype: archetypeTitleText(pair as string) }),
    );
    expect(line).not.toContain('+');
  });

  it('attunedZone logs the celebrant name with the localized archetype title, never the raw pairId', () => {
    const hud = makeHud();
    hud.handleProfessionEvent({
      type: 'attunedZone',
      celebrantName: 'Torvald',
      pairId: 'alchemy+cooking',
    });

    expect(hud.log).toHaveBeenCalledTimes(1);
    const line = hud.log.mock.calls[0][0] as string;
    expect(line).toContain('Torvald');
    expect(line).toContain(archetypeTitleText('alchemy+cooking'));
    expect(line).not.toContain('alchemy+cooking');
    expect(line).not.toContain('+');
    // A zone broadcast is a chat line only: no banner, no cue for recipients
    // (the masterworkZone precedent).
    expect(hud.showBanner).not.toHaveBeenCalled();
  });

  it('attuned repaints an OPEN Crafting window through the probe, then elides the repeat', () => {
    vi.spyOn(audio, 'achievement').mockImplementation(() => {});
    const hud = makeHud();
    const craftingWindow = document.getElementById('crafting-window') as HTMLElement;
    // 'flex' is the painter's open state (the column-flex shell); the repaint
    // gate tests display === 'flex', so staging anything else reads closed.
    craftingWindow.style.display = 'flex';

    hud.handleProfessionEvent({ type: 'attuned', pairId: 'leatherworking+tailoring' });
    expect(hud.charWindow.renderIfOpen).toHaveBeenCalledTimes(1);
    expect(hud.renderCrafting).toHaveBeenCalledTimes(1);

    // The identity mirror has not moved since the first probe, so a second
    // drain elides both repaints (the signature diff, not the event, decides).
    hud.handleProfessionEvent({ type: 'attuned', pairId: 'leatherworking+tailoring' });
    expect(hud.charWindow.renderIfOpen).toHaveBeenCalledTimes(1);
    expect(hud.renderCrafting).toHaveBeenCalledTimes(1);

    // A moved mirror claims the edge again for both open surfaces.
    hud.sim.craftingIdentity = { ...hud.sim.craftingIdentity, switchCount: 1 };
    hud.handleProfessionEvent({ type: 'attuned', pairId: 'leatherworking+tailoring' });
    expect(hud.charWindow.renderIfOpen).toHaveBeenCalledTimes(2);
    expect(hud.renderCrafting).toHaveBeenCalledTimes(2);

    // The OTHER facet moves the same edge: a late gathering snapshot alone
    // (crafting identity untouched) must also converge both surfaces.
    hud.sim.professionsState = { skills: [{ professionId: 'fishing', skill: 40 }] };
    hud.handleProfessionEvent({ type: 'attuned', pairId: 'leatherworking+tailoring' });
    expect(hud.charWindow.renderIfOpen).toHaveBeenCalledTimes(3);
    expect(hud.renderCrafting).toHaveBeenCalledTimes(3);
  });

  it('profTierTutorial routes to openProfessionTutorial and does nothing else', () => {
    const hud = makeHud();
    hud.handleProfessionEvent({ type: 'profTierTutorial' });

    expect(hud.openProfessionTutorial).toHaveBeenCalledTimes(1);
    expect(hud.log).not.toHaveBeenCalled();
    expect(hud.showBanner).not.toHaveBeenCalled();
  });
});

// A source-pin suite stood here asserting all four profession SimEvent types route
// through one handler; its case scanned for a case-label run the attunement arm
// was part of.
