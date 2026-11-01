// Builds tests/shard-times.json (seconds per unit-test file) from junit reports written with BS_TIMES_OUT.
// Usage: node tools/shard_times.mjs build/times-*.xml
import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
const sum = {};
for (const f of process.argv.slice(2)) {
  for (const m of readFileSync(f, 'utf8').matchAll(/<testcase [^>]*?time="([\d.]+)"[^>]*?file="([^"]+)"/g)) {
    const k = basename(m[2].replace(/\\/g, '/')); sum[k] = (sum[k] || 0) + Number(m[1]);
  }
}
const out = Object.fromEntries(Object.entries(sum).sort().map(([k, v]) => [k, Math.round(v * 10) / 10]));
writeFileSync('tests/shard-times.json', JSON.stringify(out, null, 1) + '\n');
console.log(`${Object.keys(out).length} files, ${Math.round(Object.values(out).reduce((a, b) => a + b, 0))} s total`);
