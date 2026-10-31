/* ---------------------------------------------------------------------
   CARD DATABASE (Training cards + the built-in pack is registered further below)
   type: 'Spirit' | 'Nexus' | 'Magic'      symbol: card color     symbols: number of symbols
   reduction: {color: n}         levels: [{cores, bp}]  (Nexus levels have no bp)
   --------------------------------------------------------------------- */
const VERSION = '0.200.0';
const CARDS = {};
function defCard(o) {
  CARDS[o.id] = Object.assign({ type: 'Spirit', reduction: {}, symbols: 1, families: [], keywords: [], implemented: true, desc: 'Vanilla test card (no effect).', block: 'A' }, o);
  CARDS[o.id].countLv = isCountLv(CARDS[o.id]);
}
// Generic vanilla Training cards (neutral names, no real card): a plain deck for sims and a first-run fallback
/** @type {[string, string, number, number, number, number[][]][]} */
const TRAIN = [
  ['01', 'Ember Pup', 1, 1, 1, [[1, 2000], [2, 3000]]], ['02', 'Spark Lizard', 2, 1, 1, [[1, 3000], [2, 4000], [3, 5000]]],
  ['03', 'Flame Hound', 2, 1, 1, [[1, 2000], [2, 4000], [3, 6000]]], ['04', 'Magma Guard', 3, 1, 1, [[1, 4000], [2, 6000]]],
  ['05', 'Scale Raider', 3, 2, 1, [[1, 3000], [2, 5000], [3, 7000]]], ['06', 'Blaze Colt', 3, 1, 1, [[1, 3000], [2, 5000], [4, 8000]]],
  ['07', 'Ash Raptor', 4, 2, 1, [[1, 4000], [2, 6000], [4, 9000]]], ['08', 'Cinder Drake', 5, 2, 1, [[1, 5000], [3, 8000], [5, 11000]]],
  ['09', 'Basalt Brute', 4, 2, 1, [[1, 5000], [2, 7000]]], ['10', 'Volcano Behemoth', 6, 3, 2, [[1, 6000], [3, 9000], [5, 13000]]],
  ['11', 'Crimson Wyrm', 6, 3, 2, [[1, 6000], [3, 10000], [6, 14000]]], ['12', 'Dawn Dragon Emperor', 7, 4, 2, [[1, 7000], [3, 11000], [5, 15000]]]
];
for (const [n, name, cost, red, sym, lv] of TRAIN) {
  defCard({ id: 'TRAIN-' + n, name, symbol: 'red', cost, reduction: { red }, symbols: sym, levels: lv.map(([cores, bp]) => ({ cores, bp })), families: ['Training'] });
}
defCard({ id: 'TRAIN-N1', name: 'Training Forge', type: 'Nexus', symbol: 'red', cost: 2, reduction: { red: 1 }, levels: [{ cores: 0 }, { cores: 2 }], desc: 'Vanilla test Nexus.' });
defCard({ id: 'TRAIN-N2', name: 'Practice Battlement', type: 'Nexus', symbol: 'red', cost: 3, reduction: { red: 1 }, levels: [{ cores: 0 }, { cores: 3 }], desc: 'Vanilla test Nexus.' });

const PRESET_DECK = {            // 40 generic Training cards
  'TRAIN-01': 3, 'TRAIN-02': 3, 'TRAIN-03': 3, 'TRAIN-04': 3, 'TRAIN-05': 3, 'TRAIN-06': 3, 'TRAIN-07': 3,
  'TRAIN-08': 3, 'TRAIN-09': 3, 'TRAIN-10': 3, 'TRAIN-11': 2, 'TRAIN-12': 2, 'TRAIN-N1': 3, 'TRAIN-N2': 3
};


