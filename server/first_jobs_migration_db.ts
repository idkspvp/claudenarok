// D1 (first jobs): moving saved characters onto the five-job class list.
//
// The class ids stored in characters.class are the pre-D1 nine. Two things have
// to happen to them at boot, and both are additive and idempotent so every realm
// process can run them on every start (see server/CLAUDE.md):
//
//   RENAME  warrior/hunter/priest/rogue became swordman/archer/acolyte/thief.
//           A saved character on an old id would fail every class lookup, so the
//           rows are rewritten in place. Re-running matches nothing.
//
//   ARCHIVE paladin/shaman/warlock/druid were cut outright. Their rows move to
//           archived_characters with their JSONB state INTACT and leave the live
//           table. Keeping them in place looks cheaper right up until the skill
//           re-home leaves those characters loading with no kit at all, which is
//           broken quietly rather than loudly; an archive row can still be read,
//           refunded, or restored by hand if the job ever returns.
//
// The archive keeps its FK to accounts so a deleted account still takes its
// archived characters with it: an archive is not an exemption from account
// deletion. It does NOT reference characters(id), because the whole point is to
// outlive that row; the original id is kept as the primary key so re-running the
// move is a no-op rather than a duplicate.

/** The four cut classes, and the two renames, as one place both halves read. */
export const CUT_CLASSES = ['paladin', 'shaman', 'warlock', 'druid'] as const;
export const RENAMED_CLASSES: ReadonlyArray<readonly [from: string, to: string]> = [
  ['warrior', 'swordman'],
  ['hunter', 'archer'],
  ['priest', 'acolyte'],
  ['rogue', 'thief'],
];

/** Why a row is in the archive. One value today; a column so a later retirement
 *  is distinguishable from this one rather than silently mixed into it. */
export const ARCHIVE_REASON_CLASS_CUT = 'class_cut_d1_first_jobs';

const CUT_LIST = CUT_CLASSES.map((c) => `'${c}'`).join(', ');

export const FIRST_JOBS_ARCHIVE_SCHEMA = `
CREATE TABLE IF NOT EXISTS archived_characters (
  id INT PRIMARY KEY,
  account_id INT REFERENCES accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  class TEXT NOT NULL,
  realm TEXT,
  level INT,
  state JSONB,
  hotbar_layout JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  archived_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS archived_characters_account ON archived_characters(account_id);
`;

/** Rewrite the four renamed class ids in place. Idempotent: after the first run
 *  no row matches, and no live code writes an old id. */
export const FIRST_JOBS_RENAME_SQL = RENAMED_CLASSES.map(
  ([from, to]) => `UPDATE characters SET class = '${to}' WHERE class = '${from}';`,
).join('\n');

/** Copy every cut-class character into the archive, then drop it from the live
 *  table. ON CONFLICT DO NOTHING makes the copy idempotent; the DELETE is
 *  idempotent by construction. The two run in the boot transaction together, so
 *  a failure between them cannot lose a row. */
export const FIRST_JOBS_ARCHIVE_SQL = `
INSERT INTO archived_characters (
  id, account_id, name, class, realm, level, state, hotbar_layout,
  created_at, updated_at, reason
)
SELECT id, account_id, name, class, realm, level, state, hotbar_layout,
       created_at, updated_at, '${ARCHIVE_REASON_CLASS_CUT}'
FROM characters
WHERE class IN (${CUT_LIST})
ON CONFLICT (id) DO NOTHING;
DELETE FROM characters WHERE class IN (${CUT_LIST});
`;
