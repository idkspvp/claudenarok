// The character-creation class picker, as data.
//
// One chip per STARTABLE job (src/sim/content/jobs.ts), in the job tree's own
// order, carrying the ids the DOM consumer needs and the two i18n keys the shell
// catalog already owns. Adding a startable job is a row in that table and
// nothing here; the three pickers (index.html twice, play.html once) and both
// server validation lists all converge on the same source.
//
// Pure and DOM-free so a Node test can pin the derivation without a jsdom shell.
// The thin consumer that turns these into elements is ./class_picker.ts.

import { startableJobs } from '../sim/content/jobs';

export interface ClassChipSpec {
  /** The job id, written to `data-class` and read back on selection. */
  id: string;
  /** `classes.<id>`, the localized job name shown on the chip. */
  nameKey: string;
  /** `classes.<id>Aria`, the localized accessible name for the control. */
  ariaKey: string;
  /** The English name, used as the pre-localization textContent so the chip is
   *  never blank between first paint and the first t() pass. */
  englishName: string;
}

/** Every chip the picker should render, in order. */
export function classChipSpecs(): ClassChipSpec[] {
  return startableJobs().map((job) => ({
    id: job.id,
    nameKey: `classes.${job.id}`,
    ariaKey: `classes.${job.id}Aria`,
    englishName: job.name,
  }));
}
