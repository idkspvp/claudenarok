// The saved-character half of the D1 collapse: renamed classes are rewritten in
// place, cut classes move to an archive with their state intact. Both run in the
// boot transaction on every start, so the load-bearing property is that they are
// additive and idempotent, and that neither one can strand a character.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ARCHIVE_REASON_CLASS_CUT,
  CUT_CLASSES,
  FIRST_JOBS_ARCHIVE_SCHEMA,
  FIRST_JOBS_ARCHIVE_SQL,
  FIRST_JOBS_RENAME_SQL,
  RENAMED_CLASSES,
} from '../server/first_jobs_migration_db';
import { ALL_CLASSES } from '../src/sim/types';

describe('the class list the migration targets', () => {
  it('renames onto live classes and cuts classes that are gone', () => {
    for (const [from, to] of RENAMED_CLASSES) {
      expect(ALL_CLASSES, `${from} -> ${to}`).toContain(to);
      expect(ALL_CLASSES as string[], `${from} is retired`).not.toContain(from);
    }
    for (const cut of CUT_CLASSES) expect(ALL_CLASSES as string[]).not.toContain(cut);
  });

  it('covers every pre-D1 class exactly once, so no saved character is missed', () => {
    const handled = [...RENAMED_CLASSES.map(([from]) => from), ...CUT_CLASSES];
    // Classes that ARRIVED after D1 are out of the migration's scope by
    // definition: no saved character can carry an id that did not exist when the
    // save was written. Excluded by name rather than by a live list so a future
    // class cannot silently widen what this claims to cover.
    const POST_D1_CLASSES = ['knight', 'summoner'];
    const untouched = ALL_CLASSES.filter(
      (c) => !RENAMED_CLASSES.some(([, to]) => to === c) && !POST_D1_CLASSES.includes(c),
    );
    // mage is the one PRE-D1 id that neither moved nor was cut.
    expect(untouched).toEqual(['mage']);
    expect(new Set(handled).size).toBe(handled.length);
    expect([...handled, ...untouched].sort()).toEqual(
      [
        'druid',
        'hunter',
        'mage',
        'paladin',
        'priest',
        'rogue',
        'shaman',
        'warlock',
        'warrior',
      ].sort(),
    );
  });
});

describe('archive schema', () => {
  it('is additive and idempotent, and never touches the live table', () => {
    expect(FIRST_JOBS_ARCHIVE_SCHEMA).toContain('CREATE TABLE IF NOT EXISTS archived_characters');
    expect(FIRST_JOBS_ARCHIVE_SCHEMA).toContain(
      'CREATE INDEX IF NOT EXISTS archived_characters_account',
    );
    expect(FIRST_JOBS_ARCHIVE_SCHEMA).not.toMatch(/DROP |ALTER TABLE characters|DELETE FROM/);
  });

  it('keeps the JSONB state and the layout, so an archived character is restorable', () => {
    expect(FIRST_JOBS_ARCHIVE_SCHEMA).toContain('state JSONB');
    expect(FIRST_JOBS_ARCHIVE_SCHEMA).toContain('hotbar_layout JSONB');
  });

  it('cascades from accounts, so an archive row is not an exemption from deletion', () => {
    expect(FIRST_JOBS_ARCHIVE_SCHEMA).toContain(
      'account_id INT REFERENCES accounts(id) ON DELETE CASCADE',
    );
    // Never a FK to characters(id): the row has to outlive the row it came from.
    expect(FIRST_JOBS_ARCHIVE_SCHEMA).not.toContain('REFERENCES characters');
  });
});

describe('rename statements', () => {
  it('rewrites each retired id to its live one and nothing else', () => {
    for (const [from, to] of RENAMED_CLASSES) {
      expect(FIRST_JOBS_RENAME_SQL).toContain(
        `UPDATE characters SET class = '${to}' WHERE class = '${from}';`,
      );
    }
    // One statement per rename, no extras.
    expect(FIRST_JOBS_RENAME_SQL.trim().split('\n')).toHaveLength(RENAMED_CLASSES.length);
    expect(FIRST_JOBS_RENAME_SQL).not.toMatch(/DELETE|DROP/);
  });

  it('is a no-op on a second run because no row can carry an old id again', () => {
    // The predicate is the old id, which nothing writes any more (the create path
    // validates against startableJobs), so re-running matches zero rows.
    for (const [from] of RENAMED_CLASSES) {
      expect(FIRST_JOBS_RENAME_SQL).toContain(`WHERE class = '${from}'`);
    }
  });
});

describe('archive move', () => {
  it('copies before it deletes, and copies idempotently', () => {
    const insertAt = FIRST_JOBS_ARCHIVE_SQL.indexOf('INSERT INTO archived_characters');
    const deleteAt = FIRST_JOBS_ARCHIVE_SQL.indexOf('DELETE FROM characters');
    expect(insertAt).toBeGreaterThanOrEqual(0);
    expect(deleteAt).toBeGreaterThan(insertAt);
    expect(FIRST_JOBS_ARCHIVE_SQL).toContain('ON CONFLICT (id) DO NOTHING');
  });

  it('scopes both halves to exactly the four cut classes', () => {
    const list = CUT_CLASSES.map((c) => `'${c}'`).join(', ');
    expect(FIRST_JOBS_ARCHIVE_SQL).toContain(`WHERE class IN (${list})`);
    expect(FIRST_JOBS_ARCHIVE_SQL).toContain(`DELETE FROM characters WHERE class IN (${list});`);
    for (const live of ALL_CLASSES) expect(FIRST_JOBS_ARCHIVE_SQL).not.toContain(`'${live}'`);
  });

  it('stamps a reason so a later retirement is distinguishable from this one', () => {
    expect(FIRST_JOBS_ARCHIVE_SQL).toContain(`'${ARCHIVE_REASON_CLASS_CUT}'`);
  });
});

describe('boot wiring', () => {
  // Scope to ensureSchema's body: db.ts has other BEGIN/COMMIT pairs, and the
  // ordering claims below are about the boot transaction specifically.
  const source = readFileSync(new URL('../server/db.ts', import.meta.url), 'utf8');
  const db = source.slice(source.indexOf('export async function ensureSchema('));

  it('applies all three inside the advisory-locked boot transaction', () => {
    for (const stmt of [
      'FIRST_JOBS_ARCHIVE_SCHEMA',
      'FIRST_JOBS_RENAME_SQL',
      'FIRST_JOBS_ARCHIVE_SQL',
    ]) {
      expect(db, stmt).toContain(`await client.query(${stmt});`);
    }
    // The copy and the delete must land before COMMIT, or a crash between them
    // would drop a character that was never archived.
    const archiveAt = db.indexOf('await client.query(FIRST_JOBS_ARCHIVE_SQL);');
    const commitAt = db.indexOf("await client.query('COMMIT');");
    expect(archiveAt).toBeGreaterThan(0);
    expect(commitAt).toBeGreaterThan(archiveAt);
  });

  it('creates the archive table after the core schema it references', () => {
    const schemaAt = db.indexOf('await client.query(SCHEMA);');
    const archiveSchemaAt = db.indexOf('await client.query(FIRST_JOBS_ARCHIVE_SCHEMA);');
    expect(schemaAt).toBeGreaterThan(0);
    expect(archiveSchemaAt).toBeGreaterThan(schemaAt);
  });
});
