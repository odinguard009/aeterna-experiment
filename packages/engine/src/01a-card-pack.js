/* ---------------------------------------------------------------------
   CARD PACK CODEC (v0.51.0; this part must load before 03-imported-cards.js: its consts are used at load): compact, synchronous format of the built-in card pack
   The build (tools/build.mjs) calls packCards() on build/all-cards.json and embeds it compressed;
   the game calls loadPack() once at load, before parseCard() (03-imported-cards.js).
   Format: { v: 1, f: [field names, most frequent first], b: [boolean fields], e: { field: [values] }, d: [rows] }
     row[i] = value of f[i]; null = field absent; trailing nulls are trimmed
     b: stored as 1/0; e: stored as an index into e[field] (low-cardinality strings such as type and colour)
     levels: [[cores, bp], ...] or [[cores], ...] (Nexus / Magic levels have no BP)
     null fields are dropped (parseCard treats null and absent alike)
     image: absent when it is "<id>.png", "" when the card has none; block: absent when it equals the digits
     after the ID prefix ("BS68-012" -> "68"), "" when the card has none
   The build compresses that JSON (see loadPack below); decoding stays synchronous, offline, from file:// on PC and Android.
   --------------------------------------------------------------------- */
function packBlockOf(id) { const m = /^[A-Za-z]+(\d+)/.exec(String(id)); return m ? m[1] : undefined; }
function packCards(cards) {
  const count = {}, kinds = {}, vals = {};
  for (const c of cards) for (const k of Object.keys(c)) {
    if (c[k] == null) continue;                                       // null and absent are the same to parseCard()
    count[k] = (count[k] || 0) + 1;
    const t = typeof c[k]; (kinds[k] = kinds[k] || new Set()).add(t);
    if (t === 'string') (vals[k] = vals[k] || new Set()).add(c[k]);
  }
  for (const k of ['id', 'image', 'block']) if (count[k] == null) count[k] = 0;
  const f = Object.keys(count).sort((a, b) => (a === 'id' ? -1 : b === 'id' ? 1 : count[b] - count[a] || (a < b ? -1 : 1)));
  const plain = k => kinds[k] && kinds[k].size === 1;
  const b = f.filter(k => plain(k) && kinds[k].has('boolean'));
  const e = {};
  for (const k of f) if (k !== 'id' && k !== 'image' && k !== 'block' && plain(k) && kinds[k].has('string') && vals[k].size <= 64 && count[k] >= 16) e[k] = [...vals[k]].sort();
  const d = cards.map(c => {
    const row = f.map(k => {
      let v = c[k];
      if (v === null) v = undefined;
      if (k === 'image') return v === c.id + '.png' ? null : v === undefined ? '' : v;
      if (k === 'block') return v === packBlockOf(c.id) ? null : v === undefined ? '' : v;
      if (v === undefined) return null;
      if (k === 'levels' && Array.isArray(v)) return v.map(L => {
        const ks = Object.keys(L);
        if (ks.some(x => x !== 'cores' && x !== 'bp') || L.bp === null || L.bp === undefined && ks.includes('bp')) throw new Error('packCards: unexpected level shape in ' + c.id);
        return 'bp' in L ? [L.cores, L.bp] : [L.cores];
      });
      if (b.includes(k)) return v ? 1 : 0;
      if (e[k]) return e[k].indexOf(v);
      return v;
    });
    while (row.length && row[row.length - 1] === null) row.pop();
    return row;
  });
  return { v: 1, f, b, e, d };
}
function unpackCards(p) {
  if (Array.isArray(p)) return p;                                      // older plain-array packs still load
  const { f, b, e, d } = p, isB = new Set(b), out = new Array(d.length);
  for (let r = 0; r < d.length; r++) {
    const row = d[r], c = {};
    for (let i = 0; i < f.length; i++) {
      const k = f[i]; let v = row[i];
      if (k === 'image') { v = v == null ? c.id + '.png' : v; if (v !== '') c.image = v; continue; }
      if (k === 'block') { v = v == null ? packBlockOf(c.id) : v; if (v !== '' && v !== undefined) c.block = v; continue; }
      if (v == null) continue;
      if (k === 'levels') v = v.map(L => (L.length > 1 ? { cores: L[0], bp: L[1] } : { cores: L[0] }));
      else if (isB.has(k)) v = v === 1;
      else if (e[k]) v = e[k][v];
      c[k] = v;
    }
    out[r] = c;
  }
  return out;
}
/* v0.51.0 compressed pack: raw DEFLATE (RFC 1951) of the compact JSON above, base64 encoded by the build (node zlib).
   inflateRaw is a small synchronous decoder (stored, fixed and dynamic Huffman blocks, table-driven decoding), so the
   start-up order of the game is unchanged (no DecompressionStream / Promise). Checked against node zlib on the full
   projected pack and random data by tests/unit/pack.test.mjs. */
const INF_LBASE = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
const INF_LEXT = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
const INF_DBASE = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577];
const INF_DEXT = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13];
const INF_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];
function inflateRaw(src) {
  const n = src.length;
  let out = new Uint8Array(Math.max(1024, n * 8)), op = 0, ip = 0, bit = 0, bits = 0;
  const fail = m => { throw new Error('inflate: ' + m); };
  const fill = k => {                                       // up to 4 zero bytes may be read past the end (look-ahead); checked below
    while (bits < k) { if (ip >= n + 4) fail('truncated'); bit |= (ip < n ? src[ip] : 0) << bits; ip++; bits += 8; }
  };
  const get = k => { fill(k); const v = bit & ((1 << k) - 1); bit >>>= k; bits -= k; return v; };
  const table = lens => {                                   // canonical Huffman -> lookup table indexed by the next `max` bits
    const count = new Uint16Array(16), next = new Uint16Array(16);
    let max = 0;
    for (let i = 0; i < lens.length; i++) { count[lens[i]]++; if (lens[i] > max) max = lens[i]; }
    count[0] = 0;
    for (let L = 1, code = 0; L < 16; L++) { code = (code + count[L - 1]) << 1; next[L] = code; }
    const t = new Uint16Array(1 << max);
    for (let sym = 0; sym < lens.length; sym++) {
      const L = lens[sym]; if (!L) continue;
      let c = next[L]++, r = 0;
      for (let k = 0; k < L; k++) { r = (r << 1) | (c & 1); c >>= 1; }
      for (let j = r; j < t.length; j += 1 << L) t[j] = (sym << 4) | L;
    }
    return { t, max, mask: (1 << max) - 1 };
  };
  const decode = h => {
    fill(h.max);
    const e = h.t[bit & h.mask], L = e & 15;
    if (!L) fail('bad code');
    bit >>>= L; bits -= L; return e >> 4;
  };
  const room = k => { if (op + k > out.length) { const o = new Uint8Array(Math.max(out.length * 2, op + k)); o.set(out.subarray(0, op)); out = o; } };
  let fixedL = null, fixedD = null, last = 0;
  while (!last) {
    last = get(1);
    const type = get(2);
    if (type === 0) {                                       // stored block: drop the partial byte, give back whole look-ahead bytes
      bit >>>= bits & 7; bits -= bits & 7; ip -= bits >> 3; bit = 0; bits = 0;
      if (ip + 4 > n) fail('truncated');
      const len = src[ip] | (src[ip + 1] << 8), nlen = src[ip + 2] | (src[ip + 3] << 8); ip += 4;
      if (len !== (~nlen & 0xffff)) fail('stored length');
      if (ip + len > n) fail('truncated');
      room(len); out.set(src.subarray(ip, ip + len), op); op += len; ip += len;
      continue;
    }
    let lt, dt;
    if (type === 1) {
      if (!fixedL) {
        const l = new Uint8Array(288);
        l.fill(8, 0, 144); l.fill(9, 144, 256); l.fill(7, 256, 280); l.fill(8, 280, 288);
        fixedL = table(l); fixedD = table(new Uint8Array(30).fill(5));
      }
      lt = fixedL; dt = fixedD;
    } else if (type === 2) {
      const nlen = get(5) + 257, ndist = get(5) + 1, ncode = get(4) + 4, cl = new Uint8Array(19);
      if (nlen > 286 || ndist > 30) fail('bad counts');
      for (let i = 0; i < ncode; i++) cl[INF_ORDER[i]] = get(3);
      const ct = table(cl), lens = new Uint8Array(nlen + ndist);
      for (let i = 0; i < nlen + ndist;) {
        const s = decode(ct);
        if (s < 16) { lens[i++] = s; continue; }
        let v = 0, r;
        if (s === 16) { if (!i) fail('repeat without length'); v = lens[i - 1]; r = 3 + get(2); }
        else if (s === 17) r = 3 + get(3);
        else r = 11 + get(7);
        if (i + r > nlen + ndist) fail('too many lengths');
        while (r--) lens[i++] = v;
      }
      if (!lens[256]) fail('no end-of-block code');
      lt = table(lens.subarray(0, nlen)); dt = table(lens.subarray(nlen));
    } else fail('block type 3');
    for (;;) {
      let s = decode(lt);
      if (s < 256) { if (op >= out.length) room(1); out[op++] = s; continue; }
      if (s === 256) break;
      s -= 257; if (s >= 29) fail('bad length code');
      const len = INF_LBASE[s] + get(INF_LEXT[s]), d = decode(dt);
      if (d >= 30) fail('bad distance code');
      const dist = INF_DBASE[d] + get(INF_DEXT[d]);
      if (dist > op) fail('distance too far');
      room(len);
      if (dist >= len) { out.copyWithin(op, op - dist, op - dist + len); op += len; }
      else for (let k = 0; k < len; k++, op++) out[op] = out[op - dist];
    }
  }
  if (ip - (bits >> 3) > n) fail('truncated');
  return out.subarray(0, op);
}
function packBytes(b64) { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; }
// the embedded pack: base64 of the raw DEFLATE of JSON.stringify(packCards(cards)) -> card list
function loadFlavor(b64) { return JSON.parse(new TextDecoder().decode(inflateRaw(packBytes(b64)))); }   // v0.131.0 U14g: the Lore tab's flavor index
function loadPack(b64) { return unpackCards(JSON.parse(new TextDecoder().decode(inflateRaw(packBytes(b64))))); }
