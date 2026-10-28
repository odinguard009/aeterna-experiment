// v0.54.0 compiler patterns: (When Destroyed), Spirit/Ultimate targets, Your Attack Step static BP, colour + symbol,
// refresh / core / loot / deckbottom / Life sentences, and the {{Burst|...}} block.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { ROOT, quietBoard, closeBrowser } from './lib/game.mjs';

after(closeBrowser);
const py = code => JSON.parse(execFileSync('python3', ['-c', `import sys, json; sys.path.insert(0, 'tools'); import compile_effects as ce\n${code}`], { cwd: ROOT, encoding: 'utf8' }));
const card = (text, extra = {}) => JSON.stringify(Object.assign({ id: 'T-1', name: 'T', type: 'Spirit', color: 'red', cost: 3, levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }], text }, extra));
const compile = (text, extra) => py(`c = json.loads(${JSON.stringify(card(text, extra))})\ntry: print(json.dumps(ce.compile_card(c)))\nexcept ce.Review as e: print(json.dumps({'review': str(e)}))`);

test('C54-01 (When Destroyed) maps to DESTROYED; effects about this Spirit stay staged', () => {
  assert.deepEqual(compile('[LV1][LV2] (When Destroyed)\nDraw three cards.').effects, [{ trigger: 'DESTROYED', lv: [1, 2], actions: [{ do: 'DRAW', n: 3 }] }]);
  assert.deepEqual(compile('[LV1] (When Summoned/Destroyed) Draw a card.').effects.map(e => e.trigger), ['SUMMONED', 'DESTROYED']);
  assert.match(compile('[LV1] (When Destroyed) Refresh this Spirit.').review, /about this Spirit/);
  assert.equal(compile('[LV1] (When Depleted/Destroyed by the Opponent) Draw a card.').effects[0].alsoDepleted, true);   // v0.177.0
});
test('C54-02 new sentences use existing engine actions; Spirit/Ultimate targets read as opposing Spirits', () => {
  const a = s => { const r = compile('[LV1] (When Summoned) ' + s); return r.review || r.effects[0].actions; };
  assert.deepEqual(a('Refresh a Spirit you control.'), [{ do: 'REFRESH_SPIRIT' }]);
  assert.deepEqual(a('Refresh a "Star Dragon" family Spirit you control.'), [{ do: 'REFRESH_SPIRIT', match: { family: ['Star Dragon'] } }]);
  assert.deepEqual(a('Send a core from any opposing Spirit to their Reserve.'), [{ do: 'OPP_CORES_TO_RESERVE', targets: 1, each: 1 }]);
  assert.deepEqual(a('Draw two cards, then discard a card from your Hand.'), [{ do: 'LOOT', draw: 2, discard: 1 }]);
  assert.deepEqual(a('Draw a card from the deckbottom.'), [{ do: 'DRAW_BOTTOM', n: 1 }]);
  assert.deepEqual(a('Put a core from the Void to your Life.'), [{ do: 'VOID_TO_LIFE', n: 1 }]);
  assert.deepEqual(a('Destroy an opposing 4000 BP or less Spirit/Ultimate.'), [{ do: 'DESTROY', bpLe: 4000 }]);
  assert.deepEqual(a('Discard three cards from the opposing decktop.'), [{ do: 'CRUSH', n: 3 }]);
  assert.match(a('Discard 12 cards from the opposing decktop.'), /engine limit 5/);
});
test('C54-03 (Your Attack Step) static BP and a second colour for colour and symbol', () => {
  assert.deepEqual(compile('[LV2] (Your Attack Step) All your "Astral Dragon" family Spirits gain +1000 BP.').effects,
    [{ trigger: 'STATIC', bp: 1000, to: 'own', if: { attackStep: true, oppTurn: false }, match: { family: ['Astral Dragon'] }, lv: [2] }]);
  assert.deepEqual(compile('[LV1] (Your Attack Step) This Spirit gains +2000 BP.').effects[0], { trigger: 'STATIC', bp: 2000, to: 'self', if: { attackStep: true, oppTurn: false }, lv: [1] });
  assert.deepEqual(compile("[LV1][LV2]\nThis Spirit's color and symbol are also treated as White.", { color: 'purple' }).colors, ['purple', 'white']);
  assert.match(compile("[LV2]\nThis Spirit's color and symbol are also treated as White.").review, /only on some levels/);
});
test('C54-04 Burst block: known conditions, summon this card, then-Flash for Magic only', () => {
  const s = compile('{{Burst|After your Life is reduced}}\nDraw a card. After this effect resolves, summon this card without paying the cost.\n\n[LV1] (When Attacks)\nDraw a card.');
  assert.deepEqual(s.burst, { when: 'LIFE_DECREASE', actions: [{ do: 'DRAW', n: 1 }, { do: 'SUMMON_SELF' }] });
  const m = compile("{{Burst|After your Spirit is destroyed by the opponent}}\nDraw two cards. Then, by paying the cost, activate this card's Flash effect.\n\nFlash\nDraw a card.", { type: 'Magic', levels: [] });
  assert.deepEqual(m.burst, { when: 'ALLY_DESTROYED', actions: [{ do: 'DRAW', n: 2 }], thenFlash: true });
  assert.match(compile('{{Burst|After an opposing Grand Skill resolves}}\nSummon this card.\n\n[LV1] (When Attacks) Draw a card.').review, /Burst condition/);   // v0.71: "attacks" is a known condition now (OPP_ATTACK)
  assert.match(compile('{{Burst|After your Life is reduced}}\nDraw a card.\n\n[LV1] (When Attacks) Draw a card.').review, /without the summon/);
});
test('C54-05 in the game: a destroyed Spirit draws, Attack Step BP only on your turn, the second colour counts', async () => {
  const { page } = await quietBoard();
  const r = await page.evaluate(async () => {
    const G = BS.G, P = G.p.player, O = G.p.opponent; BS.SETTINGS.speed = 'instant'; G.active = P.key;
    for (let k = 0; k < 4; k++) P.deck.push(BS.mkInst('BS01-001'));
    const s = BS.mkInst('BS01-042'); s.cores = 1; P.spirits.push(s);
    const h = P.hand.length;
    BS.removeSpirit(P, s, 'destroyed', true);      // queues the DESTROYED event (06-rules), resolved with the queued Bursts/events
    await BS.flushBursts();
    const drew = P.hand.length - h;
    const fx = BS.CARDS['BS11-002'].effects.find(e => e.trigger === 'STATIC');
    return { drew, trig: fx.trigger, cond: fx.if, colors: BS.CARDS['BS12-009'].colors };
  });
  assert.deepEqual(r, { drew: 3, trig: 'STATIC', cond: { attackStep: true, oppTurn: false }, colors: ['purple', 'white'] });
});
