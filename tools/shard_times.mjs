// Builds tests/shard-times.json (seconds per unit-test file) from junit reports written with BS_TIMES_OUT.
// The node junit reporter has no file attribute, so each testcase is mapped back to its file by the test name.
// Usage: node tools/shard_times.mjs build/times-*.xml
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const unesc = (s) => s.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const owner = {};
for (const f of readdirSync('tests/unit').filter((x) => x.endsWith('.test.mjs'))) {
  for (const m of readFileSync(`tests/unit/${f}`, 'utf8').matchAll(/\btest(?:\.\w+)?\(\s*(['"`])((?:\\.|(?!\1).)*)\1/g)) owner[m[2].replace(/\\(.)/g, '$1')] = f;
}
const sum = {}; let lost = 0;
for (const f of process.argv.slice(2)) {
  for (const m of readFileSync(f, 'utf8').matchAll(/<testcase name="([^"]*)" time="([\d.]+)"/g)) {
    const k = owner[unesc(m[1])]; if (!k) { lost++; continue; }
    sum[k] = (sum[k] || 0) + Number(m[2]);
  }
}
const out = Object.fromEntries(Object.entries(sum).sort().map(([k, v]) => [k, Math.round(v * 10) / 10]));
writeFileSync('tests/shard-times.json', JSON.stringify(out, null, 1) + '\n');
console.log(`${Object.keys(out).length} files, ${Math.round(Object.values(out).reduce((a, b) => a + b, 0))} s total, ${lost} unmapped tests`);
