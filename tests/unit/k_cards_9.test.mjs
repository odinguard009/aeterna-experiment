// Lane K tests, file 9 (rule 1b: at most 25 tests per file, sharedBoard from lib/game.mjs).
// Bundle v194: 26RCB01-031, 26RDB01-002, 26RDB01-045 (SYMBOL_TARGET.picked / TRASH_CORES_TO instance match).
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sharedBoard, closeBrowser } from './lib/game.mjs';

after(async () => { await closeBrowser(); });
const SPEC = n => JSON.parse(readFileSync(new URL('../scenarios/' + n + '.json', import.meta.url), 'utf8'));

test('K-250 data: the three bundle cards carry their printed clauses as effects', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(() => ['26RCB01-031', '26RDB01-002', '26RDB01-045'].map(id => {
    const fx = BS.CARDS[id].effects || [];
    return [id, fx.length, fx.map(e => e.trigger).join(',')];
  }));
  assert.deepEqual(r, [
    ['26RCB01-031', 2, 'SUMMONED,ALLY_ATTACKS'],
    ['26RDB01-002', 2, 'SUMMONED,END_STEP'],
    ['26RDB01-045', 2, 'ATTACKS,ALLY_BATTLE_END'],
  ], JSON.stringify(r));
});

test('K-251 26RCB01-031 LV1-2: with every Field card RYUKI, a Void core goes to the Trash; a non-RYUKI card stops it', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player, O = G.p.opponent;
    const x = window.SC.dragreder;
    const t0 = P.trashCores.n;
    await BS.fireFx(P, 'SUMMONED', x);
    const all = P.trashCores.n - t0;
    const other = BS.mkInst('26RBS01-002'); other.cores = 1; P.spirits.push(other);   // Red Cloud, not RYUKI
    const t1 = P.trashCores.n;
    await BS.fireFx(P, 'SUMMONED', x);
    return [all, P.trashCores.n - t1, BS.fxIf(P, O, { allHave: { family: 'RYUKI' } })];
  }, SPEC('dragreder-ryuki-symbols'));
  assert.deepEqual(r, [1, 0, false], JSON.stringify(r));
});

test('K-252 26RCB01-031 LV2 (Your Attack Step): a Ryuki attack gives the attacking Spirit +2000 BP, and a Cost 8 one two White symbols (locked)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const x = window.SC.dragreder, ry = window.SC.ryukiSurvive;
    G.step = 5; G.active = P.key; G.attacker = ry; G.battleNo = 5;
    const bp0 = BS.bpOf(ry), sy0 = BS.attackSymbols(ry);
    await BS.fireFx(P, 'ALLY_ATTACKS', ry, { attacker: ry, subject: ry });
    return [BS.bpOf(ry) - bp0, BS.attackSymbols(ry) - sy0, ry.symLockBattle === G.battleNo, BS.CARDS[ry.id].cost];
  }, SPEC('dragreder-ryuki-symbols'));
  assert.deepEqual(r, [2000, 2, true, 8], JSON.stringify(r));
});

test('K-253 26RCB01-031 LV2: a Cost 3 Ryuki attacker gets the +2000 BP but no extra symbols', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const x = window.SC.dragreder;
    P.spirits = P.spirits.filter(s => s !== window.SC.ryukiSurvive);
    const ry = BS.mkInst('26RCB01-026'); ry.cores = 1; P.spirits.push(ry);       // cost 3
    G.step = 5; G.active = P.key; G.attacker = ry; G.battleNo = 6;
    const bp0 = BS.bpOf(ry), sy0 = BS.attackSymbols(ry);
    await BS.fireFx(P, 'ALLY_ATTACKS', ry, { attacker: ry, subject: ry });
    return [BS.bpOf(ry) - bp0, BS.attackSymbols(ry) - sy0, ry.symLockBattle == null];
  }, SPEC('dragreder-ryuki-symbols'));
  assert.deepEqual(r, [2000, 0, true], JSON.stringify(r));
});

test('K-254 26RDB01-002 LV1-2: all Red Stella, Trash cores go to this Spirit and to an exhausted Red Stella Spirit; the allHave gate stops it', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const a = window.SC.rabbey, b = window.SC.redStellaAlly;
    const before = [a.cores, b.cores, P.trashCores.n];
    await BS.fireFx(P, 'SUMMONED', a);
    const after = [a.cores, b.cores, P.trashCores.n];
    const other = BS.mkInst('26RBS01-002'); other.cores = 1; P.spirits.push(other);   // no Red Stella team
    P.trashCores.n = 3;
    await BS.fireFx(P, 'SUMMONED', a);
    return [before, after, a.cores, b.cores, P.trashCores.n];
  }, SPEC('rabbey-darling-red-stella'));
  assert.deepEqual(r, [[1, 1, 3], [2, 2, 1], 2, 2, 3], JSON.stringify(r));
});

test('K-255 26RDB01-002 LV2 (Your End Step): refresh one of your Red Stella Spirits', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const a = window.SC.rabbey; a.cores = 3;                     // LV2
    const b = window.SC.redStellaAlly; b.exhausted = true;
    G.step = 7; G.active = P.key;
    await BS.fireFx(P, 'END_STEP', null, {});
    return [b.exhausted, BS.CARDS['26RDB01-002'].effects[1].actions[0].do];
  }, SPEC('rabbey-darling-red-stella'));
  assert.deepEqual(r, [false, 'REFRESH_SPIRIT'], JSON.stringify(r));
});

test('K-256 26RDB01-045 LV1-2: all Blue Beat puts a Void core in the Trash; LV2 refreshes a Formulia Execeeda at the end of its battle', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(async spec => {
    const l = BS.loadScenario(spec); if (l.error) return ['scenario', l.error];
    const G = BS.G, P = G.p.player;
    const x = window.SC.gail, f = window.SC.formulia;
    G.step = 4; G.active = P.key;
    const t0 = P.trashCores.n;
    await BS.fireFx(P, 'ATTACKS', x, { attacker: x });
    const gain = P.trashCores.n - t0;
    G.step = 5; G.attacker = x; G.battleNo = 7;
    await BS.fireFx(P, 'ALLY_BATTLE_END', null, { subject: x, attacker: x });
    return [gain, f.exhausted, BS.CARDS['26RDB01-045'].effects[0].if.allHave.team];
  }, SPEC('gail-fenique-blue-beat'));
  assert.deepEqual(r, [1, false, 'Blue Beat'], JSON.stringify(r));
});
