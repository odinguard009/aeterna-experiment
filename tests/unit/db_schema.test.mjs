// v0.106.0 (roadmap M7 step 1): the database schema, its migration runner and the compose file are
// checked without a database. Postgres is not installed in the session and the plan says the npm
// client only installs in CI, so the cheap half lives here: naming, transaction wrapping, the
// no-destructive-change rule, indexes on every foreign key, and the promise that every table is
// documented. The live half (apply the migrations, run the repository tests) needs a service
// container and belongs to a later M7 step.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/game.mjs';

const DB = join(ROOT, 'db');
const MIG = join(DB, 'migrations');
const files = readdirSync(MIG).filter((f) => f.endsWith('.sql')).sort();
const sql = files.map((f) => ({ name: f, text: readFileSync(join(MIG, f), 'utf8') }));
const all = sql.map((s) => s.text).join('\n');

test('DB01 migrations are numbered from 0001 without gaps, one change per file', () => {
  assert.ok(files.length >= 1, 'no migration found');
  files.forEach((f, i) => {
    assert.match(f, /^\d{4}_[a-z0-9_]+\.sql$/, `${f} must look like 0001_init.sql`);
    assert.equal(Number(f.slice(0, 4)), i + 1, `${f} is out of order (expected ${String(i + 1).padStart(4, '0')})`);
  });
});

test('DB02 every migration is one transaction, so a failure cannot half-apply', () => {
  for (const { name, text } of sql) {
    const dirs = text.split('\n').map((l) => l.trim()).filter((l) => /^(BEGIN|COMMIT|ROLLBACK);$/i.test(l));
    assert.deepEqual(dirs.map((l) => l.toUpperCase()), ['BEGIN;', 'COMMIT;'], `${name}: needs exactly one BEGIN ... COMMIT pair`);
  }
});

test('DB03 no migration destroys data (the reversible-first rule)', () => {
  for (const { name, text } of sql) {
    const lines = text.split('\n');
    lines.forEach((l, i) => {
      const body = l.replace(/--.*$/, '');
      if (!/\b(drop\s+(table|column|database|schema)|truncate|delete\s+from)\b/i.test(body)) return;
      const marked = /--\s*destructive:/i.test(l) || /--\s*destructive:/i.test(lines[i - 1] || '');
      assert.ok(marked, `${name}:${i + 1} destroys data without a "-- destructive: <reason>" marker`);
    });
  }
});

test('DB04 every table has a primary key and every foreign key is indexed', () => {
  const tables = [...all.matchAll(/CREATE TABLE IF NOT EXISTS (\w+) \(([\s\S]*?)\n\);/g)].map((m) => ({ name: m[1], body: m[2] }));
  assert.ok(tables.length >= 4, `only ${tables.length} tables found`);
  const indexes = [...all.matchAll(/CREATE INDEX IF NOT EXISTS (\w+) ON (\w+)\s*\(([^)]*)\)/g)].map((m) => ({ table: m[2], cols: m[3].split(',').map((c) => c.trim()) }));
  for (const t of tables) {
    assert.match(t.body, /PRIMARY KEY/i, `${t.name} has no primary key`);
    for (const m of t.body.matchAll(/(\w+)\s+uuid\s+REFERENCES\s+(\w+)/g)) {
      const col = m[1];
      const covered = indexes.some((i) => i.table === t.name && i.cols.some((c) => c === col))
        || indexes.some((i) => i.table === t.name && i.cols.some((c) => c.startsWith(col)))          // composite index starting with it
        || new RegExp(`UNIQUE\\s*\\([^)]*\\b${col}\\b`, 'i').test(t.body);
      assert.ok(covered, `${t.name}.${col} is a foreign key but no index starts with it`);
    }
  }
});

test('DB05 every table is documented in docs/DATA.md, and nothing there is imaginary', () => {
  const doc = readFileSync(join(ROOT, 'docs/DATA.md'), 'utf8');
  const tables = [...all.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)].map((m) => m[1]);
  for (const t of tables) assert.ok(new RegExp('`' + t + '`').test(doc), `${t} is missing from docs/DATA.md`);
  for (const m of doc.matchAll(/^\| `(\w+)` \|/gm)) assert.ok(tables.includes(m[1]), `docs/DATA.md documents ${m[1]}, which no migration creates`);
});

test('DB06 the compose file pins the image and mounts the migration folder', () => {
  const p = join(ROOT, 'docker/compose.yml');
  assert.ok(existsSync(p), 'docker/compose.yml is missing');
  const y = readFileSync(p, 'utf8');
  for (const m of y.matchAll(/image:\s*(\S+)/g)) assert.doesNotMatch(m[1], /:latest$/, `${m[1]} uses :latest; pin a version`);
  assert.match(y, /postgres:1[0-9]/, 'no pinned postgres image');
  assert.match(y, /\.\.\/db:\/db/, 'the migrate service must mount db/ so it runs the same script as CI');
});

test('DB07 the runner stops on the first error and refuses to rewrite an applied migration', () => {
  const s = readFileSync(join(DB, 'migrate.sh'), 'utf8');
  assert.match(s, /set -eu/, 'the runner must fail fast');
  assert.match(s, /ON_ERROR_STOP=1/, 'psql must stop at the first error');
  assert.match(s, /checksum/, 'the runner must record checksums');
  assert.match(s, /write a new migration/, 'editing an applied migration must be refused, not silently re-run');
});
