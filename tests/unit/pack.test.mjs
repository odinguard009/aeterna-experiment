// v0.51.0 compact + compressed card pack (packages/engine/src/01a-card-pack.js, tools/build.mjs, tools/pack_size.mjs).
// Pure Node: the codec file is evaluated as the game runs it (atob, TextDecoder and JSON exist in Node too).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { randomBytes, randomInt } from 'node:crypto';
import { codec, packExpr, packJson, PACK_RE, buildParts } from '../../tools/build.mjs';
import { projectedCards, measure } from '../../tools/pack_size.mjs';
import { ROOT } from './lib/game.mjs';

const C = codec();
const live = JSON.parse(readFileSync(join(ROOT, 'build/all-cards.json'), 'utf8')).map(({ note, ...c }) => c);
const norm = L => L.map(c => Object.fromEntries(Object.keys(c).filter(k => c[k] != null).sort().map(k => [k, c[k]])));
const fromExpr = e => C.loadPack(e.match(/^loadPack\("([A-Za-z0-9+/=]*)"\)$/)[1]);
const staged = existsSync(join(ROOT, 'data/import/saga-01.json'));

test('P01 packCards -> unpackCards gives back every promoted card exactly (null fields dropped)', () => {
  assert.deepEqual(norm(C.unpackCards(C.packCards(live))), norm(live));
});
test('P02 the embedded expression (compressed) decodes to the same cards', () => {
  assert.deepEqual(norm(fromExpr(packExpr(live))), norm(live));
});
test('P03 image / block defaults: "<id>.png" and the ID digits are left out, missing ones survive', () => {
  const cs = [{ id: 'BS68-001', image: 'BS68-001.png', block: '68' }, { id: 'BS24-004', image: 'X.jpg', block: '25' }, { id: 'SD01-001' }, { id: 'T1', image: null }];
  const p = C.packCards(cs);
  assert.deepEqual(p.d[0], ['BS68-001']);
  assert.deepEqual(norm(C.unpackCards(p)), norm([cs[0], cs[1], { id: 'SD01-001' }, { id: 'T1' }]));
});
test('P04 levels become [cores, bp] / [cores]; an unexpected level shape stops the build', () => {
  const p = C.packCards([{ id: 'A-1', type: 'Spirit', levels: [{ cores: 1, bp: 2000 }, { cores: 3, bp: 4000 }] }, { id: 'A-2', type: 'Nexus', levels: [{ cores: 0 }, { cores: 2 }] }]);
  const i = p.f.indexOf('levels');
  assert.deepEqual(p.d[0][i], [[1, 2000], [3, 4000]]); assert.deepEqual(p.d[1][i], [[0], [2]]);
  assert.throws(() => C.packCards([{ id: 'A-3', levels: [{ cores: 1, bp: 1000, x: 1 }] }]), /unexpected level shape/);
});
test('P05 booleans are stored as 1/0 and come back as booleans; an old plain-array pack still loads', () => {
  const p = C.packCards([{ id: 'A-1', fxComplete: true }, { id: 'A-2', fxComplete: false }]);
  assert.deepEqual(C.unpackCards(p).map(c => c.fxComplete), [true, false]);
  assert.deepEqual(C.unpackCards([{ id: 'A-1' }]), [{ id: 'A-1' }]);
});
test('P06 inflateRaw matches node zlib on stored, fixed and dynamic blocks (300 random inputs, levels 0-9)', () => {
  for (let i = 0; i < 300; i++) {
    const x = randomBytes(randomInt(0, 4000)), y = Buffer.concat([x, x.subarray(0, randomInt(0, x.length + 1)), Buffer.from('ab'.repeat(randomInt(0, 400)))]);
    const z = deflateRawSync(y, { level: randomInt(0, 10) });
    assert.ok(Buffer.from(C.inflateRaw(z)).equals(y), 'input ' + i);
  }
  assert.equal(C.inflateRaw(deflateRawSync(Buffer.alloc(0))).length, 0);
});
test('P07 a cut or damaged pack throws instead of loading wrong cards', () => {
  const z = deflateRawSync(Buffer.from(packJson(live)), { level: 9 });
  assert.throws(() => C.inflateRaw(z.subarray(0, z.length >> 1)), /inflate/);
  assert.throws(() => C.inflateRaw(Uint8Array.of(0xff, 0xff)), /inflate/);
});
test('P08 the built page embeds the compressed pack on one line and it decodes to data/cards', () => {
  const m = buildParts().html.match(PACK_RE);
  assert.ok(m && !m[0].includes('\n'));
  assert.equal(new TextDecoder().decode(inflateRawSync(Buffer.from(m[1], 'base64'))), packJson(live));
});
test('P09 full projected pack (all cards: 8,041 Eternal + Standard block A since v0.62.0): round trip exact, compressed under 2.1 MB', { skip: !staged && 'light clone without data/import' }, () => {
  const cards = projectedCards();
  const ids = new Set(JSON.parse(readFileSync(join(ROOT, 'build/all-cards.json'), 'utf8')).map(c => c.id));      // v0.79.0: A1 partial cards are in both
  for (const f of readdirSync(join(ROOT, 'data/import')).filter(f => /^saga-\d\d\.json$/.test(f))) for (const c of JSON.parse(readFileSync(join(ROOT, 'data/import', f), 'utf8'))) ids.add(c.id);
  const total = ids.size;
  assert.equal(cards.length, total);
  assert.ok(total >= 8041 + 600, String(total));
  const m = measure(cards);
  assert.ok(m.roundTrip);
  assert.ok(m.compact < 2.1e6, String(m.compact));
  assert.deepEqual(norm(fromExpr(packExpr(cards))), norm(cards));
});
