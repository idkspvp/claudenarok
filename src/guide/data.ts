// Presentational data for the Guide, mirrored from src/sim/content/. Class brand colors
// match CLASSES[id].color and zone bands match the ZoneDefs; a scripts/wiki generator
// derives the full per-class and per-zone dataset from the sim in a later phase, so
// only the small bits the landing needs live here. Names reuse existing i18n keys.

import type { TranslationKey } from '../ui/i18n';

export const LEVEL_CAP = 20;

export interface ClassChip {
  id: string;
  nameKey: TranslationKey;
  color: string;
}

// The five first jobs, in the job tree's own order (src/sim/content/jobs.ts).
export const CLASS_CHIPS: ClassChip[] = [
  { id: 'swordman', nameKey: 'classes.swordman', color: '#d67a54' },
  { id: 'mage', nameKey: 'classes.mage', color: '#33c1f1' },
  { id: 'archer', nameKey: 'classes.archer', color: '#a6d84f' },
  { id: 'acolyte', nameKey: 'classes.acolyte', color: '#c6d4f0' },
  { id: 'thief', nameKey: 'classes.thief', color: '#fcee58' },
];

export interface ZoneTeaser {
  id: string;
  nameKey: TranslationKey;
  blurbKey: TranslationKey;
  min: number;
  max: number;
}

export const ZONE_TEASERS: ZoneTeaser[] = [
  {
    id: 'vale',
    nameKey: 'guide.home.world.valeName',
    blurbKey: 'guide.home.world.valeBlurb',
    min: 1,
    max: 7,
  },
  {
    id: 'marsh',
    nameKey: 'guide.home.world.marshName',
    blurbKey: 'guide.home.world.marshBlurb',
    min: 6,
    max: 13,
  },
  {
    id: 'peaks',
    nameKey: 'guide.home.world.peaksName',
    blurbKey: 'guide.home.world.peaksBlurb',
    min: 13,
    max: 20,
  },
];
