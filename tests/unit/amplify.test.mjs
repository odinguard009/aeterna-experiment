// v0.120.0 Amplify keyword {{Amplify|family +N}}: "for each [family] Spirit you control, during this battle, this Spirit
// gains +N BP" (Fandom keyword page "Amplify"). Engine: BP_TARGET {battle:true, per:{type:'Spirit',family}} on an ACTIVATE
// Invoke (02l-effects-invoke.js); the per-count reuses perCount() from 02a-effects-base.js and counts the source itself; the
// keyword is recorded on the card (keywords: ['Amplify']) and match.keyword now reads the keywords list first (02a-effects-base.js).
// Scenario: tests/scenarios/amplify-leucomyst-bp.json. Rules: ETR:faq.bp (BP plus/minus).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openGame, closeBrowser } from './lib/game.mjs';

let g;
const FIX = [
  { id: 'TA-AMP', name: 'Amplifier', type: 'Spirit', color: 'white', cost: 3, symbols: 1, families: ['Leucomyst'], levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }],
    keywords: ['Amplify'], effects: [{ trigger: 'ACTIVATE', invoke: true, timing: ['MAIN', 'FLASH'], when: 'duringAttackBlock', once: true, oncePer: 'battle', lv: [2], cost: { pay: 1 },
      actions: [{ do: 'BP_TARGET', n: 1000, to: 'self', battle: true, per: { type: 'Spirit', family: 'Leucomyst' } }] }] },
  { id: 'TA-LEU', name: 'Leucomyst Buddy', type: 'Spirit', color: 'white', cost: 2, symbols: 1, families: ['Leucomyst'], levels: [{ cores: 1, bp: 2000 }] },
  { id: 'TA-RED', name: 'Red Wall', type: 'Spirit', color: 'red', cost: 3, symbols: 1, levels: [{ cores: 1, bp: 5000 }] },
];
before(async () => {
  g = await openGame('');
  const r = await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), FIX);
  assert.equal(r.ok, FIX.length, JSON.stringify(r));
});
after(async () => { if (g) await g.page.close(); await closeBrowser(); });

const PRE = `BS.testSetup(); BS.SETTINGS.speed = 'instant'; const G = BS.G, P = G.p.player, O = G.p.opponent; G.active = P.key; G.step = 5;
  P.cpu = true; O.cpu = true;
  for (const q of [P, O]) { q.spirits = []; q.nexus = []; q.soulState = []; q.burst = null; q.mirage = null; q.count = 0; q.trash = []; q.standby = []; q.void = 10; q.hand = []; q.life = 5; q.reserve.n = 10; q.reserve.soul = true; }
  const sp = (id, q = P, n = 1) => { const i = BS.mkInst(id); i.cores = n; q.spirits.push(i); return i; };
  const ampIdx = () => BS.CARDS['TA-AMP'].effects.findIndex(e => e.invoke);`;
const ev = body => g.page.evaluate(`(async () => { ${PRE}\n${body} })()`);

test('AMP-01 Amplify with only the source on the field: +1000 BP this battle', async () => {
  const r = await ev(`const a = sp('TA-AMP', P, 3); const b = sp('TA-RED', O); G.attacker = a; G.blocker = b; G.battleNo = 1;
    const bp0 = BS.bpOf(a); const ok = await BS.activateFx(P, a, ampIdx());
    return { ok, bp0, bp1: BS.bpOf(a), pay: P.trashCores.n };`);
  assert.equal(r.ok, true);
  assert.equal(r.bp1 - r.bp0, 1000, '1 Leucomyst (itself) x 1000');
  assert.equal(r.pay, 1, 'paid one cost');
});

test('AMP-02 Amplify counts every matching Spirit you control (the source included)', async () => {
  const r = await ev(`const a = sp('TA-AMP', P, 3); sp('TA-LEU', P, 1); sp('TA-LEU', P, 1); const b = sp('TA-RED', O); G.attacker = a; G.blocker = b; G.battleNo = 1;
    const bp0 = BS.bpOf(a); await BS.activateFx(P, a, ampIdx());
    return { gained: BS.bpOf(a) - bp0 };`);
  assert.equal(r.gained, 3000, '3 Leucomyst x 1000 = +3000');
});

test('AMP-03 the battle bonus ends with the battle (inst.bpB, not a lasting bpMod)', async () => {
  const r = await ev(`const a = sp('TA-AMP', P, 3); const b = sp('TA-RED', O); G.attacker = a; G.blocker = b; G.battleNo = 1;
    const base = BS.bpOf(a); await BS.activateFx(P, a, ampIdx()); const during = BS.bpOf(a); G.battleNo = 2; const after = BS.bpOf(a);
    return { base, during, after };`);
  assert.deepEqual(r, { base: 5000, during: 6000, after: 5000 }, 'bpB only counts inside the battle it was gained in');
});

test('AMP-04 match.keyword matches a card via its keywords list (a Spirit with Amplify)', async () => {
  // STATIC "all your Spirits with Amplify gain +1000 BP" (26RBS01-100 LV1): only the keyword holder gains it.
  await g.page.evaluate(fix => BS.importCards(JSON.stringify(fix)), [{ id: 'TA-STAT', name: 'Amplify Wall', type: 'Nexus', color: 'white', cost: 3, symbols: 1, levels: [{ cores: 0 }],
    effects: [{ trigger: 'STATIC', to: 'own', match: { keyword: 'Amplify' }, bp: 1000 }] }]);
  const r = await ev(`sp('TA-AMP', P, 3); sp('TA-LEU', P, 1); const nx = BS.mkInst('TA-STAT'); nx.cores = 0; P.nexus.push(nx);
    return { amp: BS.bpOf(P.spirits.find(s => s.id === 'TA-AMP')), leu: BS.bpOf(P.spirits.find(s => s.id === 'TA-LEU')) };`);
  assert.equal(r.amp, 6000, 'the Amplify holder gains the static +1000');
  assert.equal(r.leu, 2000, 'a card without the keyword does not');
});
