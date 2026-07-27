// Thin DOM consumer for the character-creation class picker.
//
// Fills every `.mini-class-row` container with one chip per startable job. The
// markup used to be three hand-written blocks (index.html twice, play.html once)
// that drifted from the class list every time it changed; they are now empty
// containers this fills from ./class_picker_view.ts, so the job table is the one
// place a class is added or removed.
//
// The chip element type follows the container: a `<ul role="list">` gets `<li>`
// chips (play.html), anything else gets `<button type="button">` (index.html).
// Both carry `data-class`, which is what the click handlers and the E2E scripts
// select on.

import { type ClassChipSpec, classChipSpecs } from './class_picker_view';

const ROW_SELECTOR = '.mini-class-row';

function chipFor(spec: ClassChipSpec, asListItem: boolean): HTMLElement {
  const el = document.createElement(asListItem ? 'li' : 'button');
  el.className = 'mini-class';
  el.dataset.class = spec.id;
  el.dataset.i18n = spec.nameKey;
  el.dataset.i18nAria = spec.ariaKey;
  el.setAttribute('aria-pressed', 'false');
  el.textContent = spec.englishName;
  if (asListItem) {
    el.setAttribute('role', 'button');
    el.tabIndex = 0;
  } else {
    (el as HTMLButtonElement).type = 'button';
  }
  return el;
}

/** Populate every class-picker row on the page. Idempotent: a row that already
 *  holds chips is left alone, so this is safe to call again after a re-render. */
export function renderClassPickers(root: ParentNode = document): void {
  for (const row of Array.from(root.querySelectorAll<HTMLElement>(ROW_SELECTOR))) {
    if (row.querySelector('.mini-class')) continue;
    const asListItem = row.tagName === 'UL' || row.tagName === 'OL';
    for (const spec of classChipSpecs()) row.appendChild(chipFor(spec, asListItem));
  }
}
