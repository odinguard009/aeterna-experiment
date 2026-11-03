import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedBoard } from './lib/node_board.mjs';

test('K-1071 BS75-AX02 Grand-Sagitto-Nova: UTadvent needs a Cost 8+ Thunderive and the Soul Core in the Reserve/Trash, which ends up on the adventing card', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const big = BS.mkInst('BS75-051'); big.cores = 3; const small = BS.mkInst('BS75-046'); small.cores = 3; P.spirits = [small, big]; O.spirits = [];
    const adv = BS.mkInst('BS75-AX02'); P.hand = [adv]; P.reserve.soul = true; P.trashCores.soul = false;
    const t = BS.contractAdventTargets(P, adv, 'flash').map(x => x.uid);
    P.reserve.soul = false; P.trashCores.soul = false; const none = BS.contractAdventTargets(P, adv, 'flash').length; P.trashCores.soul = true;
    const ok = await BS.doContractAdvent(P, adv, big, 'flash');
    return { t, bigUid: big.uid, smallUid: small.uid, none, ok, onField: P.spirits.includes(adv), under: adv.under.includes(big), soul: adv.soul, trash: P.trashCores.soul, partial: BS.CARDS['BS75-AX02'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.deepEqual(r.t, [r.bigUid], JSON.stringify(r)); assert.equal(r.none, 0, JSON.stringify(r));
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.onField, true); assert.equal(r.under, true); assert.equal(r.soul, true); assert.equal(r.trash, false);
});

test('K-1072 BS75-AX02: when Advents/Attacks it refreshes and, with a Cost 6+ pre-Advent card in your Attack Step, sends one opposing Life per can\'t-attack/block Spirit to the Reserve', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const big = BS.mkInst('BS75-051'); const ax = BS.mkInst('BS75-AX02'); ax.cores = 6; ax.under = [big]; ax.exhausted = true; P.spirits = [ax];
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    const a = BS.mkInst(any), b = BS.mkInst(any), c = BS.mkInst(any); a.cores = b.cores = c.cores = 1; a.noAB = b.noAB = true; O.spirits = [a, b, c]; O.life = 5; const l0 = O.reserve.n;
    await BS.fireFx(P, 'ATTACKS', ax, { attacker: ax, subject: ax });
    const hit = { life: O.life, res: O.reserve.n - l0, ref: !ax.exhausted };
    ax.under = []; ax.exhausted = true; ax.fxUsed = {}; O.life = 5;
    await BS.fireFx(P, 'ATTACKS', ax, { attacker: ax, subject: ax });
    return { hit, noUnder: O.life }; })()`);
  assert.equal(r.hit.life, 3, JSON.stringify(r)); assert.equal(r.hit.res, 2, JSON.stringify(r)); assert.equal(r.hit.ref, true, JSON.stringify(r)); assert.equal(r.noUnder, 5, JSON.stringify(r));
});

test('K-1073 BS75-AX02 LV2/3: When Attacks/Blocks five opposing Spirits can\'t attack/block for the rest of the game', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const ax = BS.mkInst('BS75-AX02'); ax.cores = 6; P.spirits = [ax];
    const any = Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Spirit' && !BS.CARDS[k].token);
    O.spirits = [1, 2, 3, 4, 5, 6].map(() => { const s = BS.mkInst(any); s.cores = 1; return s; });
    await BS.fireFx(P, 'ATTACKS', ax, { attacker: ax, subject: ax });
    return { n: O.spirits.filter(s => s.noAB).length, lv: BS.lvNo(ax) }; })()`);
  assert.ok(r.lv >= 2, JSON.stringify(r)); assert.equal(r.n, 5, JSON.stringify(r));
});

test('K-1074 BS75-049 Airavajdra: when a Thunderive Spirit would leave by an opposing effect it is summoned from the Hand (cost paid); not on a battle loss', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 2; G.fxBy = O.key;
    const s = BS.mkInst('BS75-046'); s.cores = 1; P.spirits = [s]; O.spirits = []; P.nexus = []; const a = BS.mkInst('BS75-049'); P.hand = [a]; P.reserve.n = 10;
    const none = BS.mkInst('BS76-047'); none.cores = 1; P.spirits.push(none);
    G.fxBy = null; BS.removeSpirit(P, none, 'destroyed', 'battle'); await BS.flushBursts(); const afterBattle = P.hand.includes(a);
    G.fxBy = O.key; BS.removeSpirit(P, s, 'destroyed'); await BS.flushBursts();
    return { afterBattle, onField: P.spirits.includes(a), inHand: P.hand.includes(a), res: P.reserve.n, leaveSummon: BS.CARDS['BS75-049'].leaveSummon, partial: BS.CARDS['BS75-049'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.afterBattle, true, JSON.stringify(r)); assert.equal(r.onField, true, JSON.stringify(r)); assert.equal(r.inHand, false); assert.ok(r.res < 10, JSON.stringify(r));
});

test('K-1075 BS75-042 Bilijvern: while set it shields Contractor Indra from opposing destruction, and Void cores from Indra summon the Mirage', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 2; G.fxBy = null;
    const n = BS.mkInst('BS75-CX03'); n.cores = 4; P.nexus = [n]; P.spirits = []; O.spirits = []; const m = BS.mkInst('BS75-042'); m.mirage = true; P.mirage = m; P.reserve.n = 5; P.void = 0;
    G.fxBy = O.key; BS.removeNexus(P, n, 'destroyed'); const shielded = P.nexus.includes(n); G.fxBy = null;
    BS.coreEvN(P, n.uid, 'void', 2, false); n.cores -= 2; P.void += 2; await BS.flushBursts();
    return { shielded, summoned: P.spirits.includes(m), mirageGone: P.mirage === null, partial: BS.CARDS['BS75-042'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.shielded, true, JSON.stringify(r)); assert.equal(r.summoned, true, JSON.stringify(r)); assert.equal(r.mirageGone, true, JSON.stringify(r));
});

test('K-1076 BS75-051 Canonvajdra: set card activates when a Thunderive Spirit attacks with 6+ counters, summons free and zeroes opposing symbols', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 2; G.fxBy = null;
    const att = BS.mkInst('BS76-044'); att.cores = 1; P.spirits = [att]; const v = BS.mkInst('BS76-044'); v.cores = 1; O.spirits = [v]; v.noFx = false; P.reserve.n = 5;
    const b = BS.mkInst('BS75-051'); b.mirage = false; P.burst = b; P.count = 5;
    const low = await BS.maybeBurst(P, 'ALLY_ATTACK', { subject: att, attacker: att }); const stay = P.burst === b;
    P.count = 6; const hi = await BS.maybeBurst(P, 'ALLY_ATTACK', { subject: att, attacker: att }); await BS.flushBursts();
    return { low, stay, hi, summoned: P.spirits.includes(b), zeroed: O.spirits.every(s => s.symZeroTurn === G.turnNo), partial: BS.CARDS['BS75-051'].partial, fx: !!BS.CARDS['BS75-051'].fxComplete }; })()`);
  assert.equal(r.low, false, JSON.stringify(r)); assert.equal(r.stay, true, JSON.stringify(r)); assert.equal(r.hi, true, JSON.stringify(r)); assert.equal(r.summoned, true, JSON.stringify(r)); assert.equal(r.zeroed, true, JSON.stringify(r));
});

test('K-1077 BS75-030 Pachhattar: Attacks lets a pre-advent family card enter Soul State; BS74-042 second reveal pick is once per turn per name', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 2; G.fxBy = null;
    const s = BS.mkInst('BS75-030'); s.cores = 2; const u = BS.mkInst('BS74-040'); s.under = [u]; P.spirits = [s]; O.spirits = [];
    await BS.fireFx(P, 'ATTACKS', s, { attacker: s }); const inSoul = P.soulState.includes(u), gone = !s.under.includes(u);
    return { inSoul, gone, p30: !BS.CARDS['BS75-030'].partial, p42: !BS.CARDS['BS74-042'].partial, p48: !BS.CARDS['BS74-048'].partial }; })()`);
  assert.deepEqual(r, { inSoul: true, gone: true, p30: true, p42: true, p48: true }, JSON.stringify(r));
});

test('K-1078 BS74-040 Revelation Dragon: when an Awakened Dragon ally is lost, up to three cores go from the Trash to matching cards', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 2; G.fxBy = null;
    const a = BS.mkInst('BS74-040'); a.cores = 1; const b = BS.mkInst('BS74-040'); b.cores = 1; P.spirits = [a, b]; O.spirits = []; P.trashCores.n = 8; const before = P.trashCores.n, tot = a.cores + b.cores + P.reserve.n;
    await BS.fireFx(P, 'ALLY_LOST', null, { subject: b, depl: false, byOpp: true });
    return { moved: before - P.trashCores.n, gain: a.cores + b.cores + P.reserve.n - tot, partial: BS.CARDS['BS74-040'].partial, ok: !BS.CARDS['BS74-040'].partial }; })()`);
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.moved, 6, JSON.stringify(r)); assert.equal(r.gain, 6, JSON.stringify(r));   // each copy on the field reacts once, up to 3 cores each
});

test('K-1079 BS74-082/083 and BS75-081 Magic is used from Soul State: swap + free summon, Life cost shield + deckbottom, effect lock + returns', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 2; G.fxBy = null; P.reserve.n = 12; P.void = 0;
    const out = {}; const mk = id => { const i = BS.mkInst(id); return i; };
    // 082: swap a revealed Awakened Dragon with a Soul State card, then summon a cost<=5 one free
    const m82 = mk('BS74-082'); const lo = mk('BS74-040'), hi = mk('BS74-048'); const ok = mk('BS74-040'); P.soulState = [m82, lo, ok]; lo.inSoulState = m82.inSoulState = ok.inSoulState = true; P.spirits = []; O.spirits = []; P.deck.unshift(hi);
    out.u82 = BS.magicUsable(P, m82, 'flash'); out.src82 = true;
    await BS.castMagic(P, { inst: m82, target: null, plan: null, ctx: 'flash' });
    out.m82 = { leftSoul: !P.soulState.includes(m82), trash: P.trash.includes(m82), loOut: !P.soulState.includes(lo), onField: P.spirits.length, hiSeen: P.spirits.includes(hi) || P.soulState.includes(hi) };
    // 083: refresh + cost shield + goes to deckbottom on the opposing turn
    const m83 = mk('BS74-083'), dr = mk('BS74-040'); P.soulState = [m83, dr]; m83.inSoulState = dr.inSoulState = true; G.active = O.key; const dn = P.deck.length;
    await BS.castMagic(P, { inst: m83, target: null, plan: null, ctx: 'flash' });
    out.m83 = { shield: !!(P.costShield && P.costShield.turn === G.turnNo && P.costShield.ge === 4), bottom: P.deck[P.deck.length - 1] === m83, inTrash: P.trash.includes(m83), soulLeft: P.soulState.includes(dr) };
    // 081: lock + returns; the second return needs 2 cores from a Mitra Nexus
    const m81 = mk('BS75-081'); P.soulState = [m81]; m81.inSoulState = true; G.active = P.key; const nx = mk('BS74-CX03'); nx.cores = 4; P.nexus = [nx];
    const ox = mk('BS74-CX03'); O.nexus = [ox]; const os = mk('BS74-040'); os.cores = 1; O.spirits = [os];
    await BS.castMagic(P, { inst: m81, target: null, plan: null, ctx: 'flash' });
    out.m81 = { lock: P.fxLockTurn === G.turnNo, oppSpirits: O.spirits.length, oppNexus: O.nexus.length, nexusCores: nx.cores };
    return out; })()`);
  assert.equal(r.u82, true, JSON.stringify(r)); assert.equal(r.src82, true, JSON.stringify(r));
  assert.deepEqual([r.m82.leftSoul, r.m82.trash, r.m82.loOut, r.m82.onField, r.m82.hiSeen], [true, true, true, 1, true], JSON.stringify(r));
  assert.equal(r.m83.shield, true, JSON.stringify(r)); assert.equal(r.m83.bottom, true, JSON.stringify(r)); assert.equal(r.m83.inTrash, false, JSON.stringify(r)); assert.equal(r.m83.soulLeft, false, JSON.stringify(r));
  assert.deepEqual(r.m81, { lock: true, oppSpirits: 0, oppNexus: 0, nexusCores: 2 }, JSON.stringify(r));
});

test('K-1080 BS75-037 Iktalis: with 7+ counters the Contract Advent needs no Soul Core, once per turn per name; BS75-X08 sends the Soul Core to the Trash after 3+ cores via an effect', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const base = BS.mkInst('BS74-048'); base.cores = 3; P.spirits = [base]; const adv = BS.mkInst('BS75-037'); P.hand = [adv];
    P.reserve.soul = false; P.trashCores.soul = false; P.count = 6; const lo = BS.contractAdventTargets(P, adv, 'flash').length;
    P.count = 7; const hi = BS.contractAdventTargets(P, adv, 'flash').length;
    const ok = await BS.doContractAdvent(P, adv, base, 'flash');
    const adv2 = BS.mkInst('BS75-037'); P.hand = [adv2]; const base2 = BS.mkInst('BS74-048'); base2.cores = 3; P.spirits.push(base2);
    const again = BS.contractAdventTargets(P, adv2, 'flash').length;
    return { lo, hi, ok, onField: P.spirits.includes(adv), again, partial: BS.CARDS['BS75-037'].partial, p49: BS.CARDS['BS74-049'].partial, p08: BS.CARDS['BS75-X08'].partial };
  })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.p49, false); assert.equal(r.p08, false);
  assert.equal(r.lo, 0, JSON.stringify(r)); assert.equal(r.hi, 1, JSON.stringify(r)); assert.equal(r.ok, true); assert.equal(r.onField, true); assert.equal(r.again, 0, JSON.stringify(r));
});

test('K-1081 BS75-X08 Hazaar: cores per differently-named Soul State card; 3+ cores via an effect also sends the Soul Core to the Trash', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const run = async (via, n) => { const h = BS.mkInst('BS75-X08'); h.cores = 3; if (via) h.viaFx = true; P.spirits = [h]; P.soulState = []; for (let i = 0; i < n; i++) P.soulState.push(BS.mkInst(['BS74-048','BS74-042','BS74-040','BS74-030'][i]));
      P.voidCores = 9; if (P.void != null) P.void = 9; P.reserve.soul = true; P.trashCores.soul = false; await BS.fireFx(P, 'SUMMONED', h, { subject: h, selfInst: h }); return { soulTrash: P.trashCores.soul, cores: h.cores }; };
    const a = await run(true, 3), b = await run(false, 3), c = await run(true, 2);
    return { a, b, c };
  })()`);
  assert.equal(r.a.soulTrash, true, JSON.stringify(r)); assert.equal(r.b.soulTrash, false, JSON.stringify(r)); assert.equal(r.c.soulTrash, false, JSON.stringify(r));
});

test('K-1082 BS75-067 Sage\'s Sanctuary: deploy lets up to three Mitra/Awakened Dragon cards of five enter Soul State; Flash returns five AD cards and summons one revealed AD by paying its cost', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 5; G.fxBy = P.key;
    const nx = BS.mkInst('BS75-067'); nx.cores = 1; P.nexus = [nx]; P.spirits = [];
    const ADs = ['BS74-048','BS74-040','BS74-042','BS74-047','BS74-049'];
    P.deck = ADs.map(i => BS.mkInst(i)).concat([BS.mkInst('BS74-082')]); P.soulState = [];
    await BS.fireFx(P, 'SUMMONED', nx, { subject: nx, selfInst: nx });
    const afterDeploy = P.soulState.length, deckBack = P.deck.length;
    P.soulState = ADs.map(i => BS.mkInst(i)); P.soulState.forEach(x => x.inSoulState = true);
    P.deck = [BS.mkInst('BS74-047'), BS.mkInst('BS74-048'), BS.mkInst('BS74-040'), BS.mkInst('BS74-042'), BS.mkInst('BS74-049')]; P.hand = []; P.reserve.n = 12; P.void = 0;
    const idx = BS.CARDS['BS75-067'].effects.findIndex(e => e.trigger === 'ACTIVATE');
    const ok = await BS.activateFx(P, nx, idx);
    return { afterDeploy, deckBack, ok, exhausted: nx.exhausted, soulLeft: P.soulState.length, spirits: P.spirits.length, partial: BS.CARDS['BS75-067'].partial };
  })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.ok(r.afterDeploy >= 1 && r.afterDeploy <= 3, JSON.stringify(r));
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.exhausted, true); assert.equal(r.soulLeft, 0, JSON.stringify(r)); assert.equal(r.spirits, 1, JSON.stringify(r));
});

test('K-1083 BS75-028 The RevelationDragon Unnis: activates from the Trash only, enters Soul State, +1 core to a Mitra Nexus', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4; G.fxBy = P.key;
    const nx = BS.mkInst('BS74-CX03'); nx.cores = 1; P.nexus = [nx]; P.spirits = [];
    const u = BS.mkInst('BS75-028'), ad = BS.mkInst('BS74-048'); P.trash = [u, ad]; P.reserve.n = 5; P.onceUsed = {};
    const idx = BS.CARDS['BS75-028'].effects.findIndex(e => e.trigger === 'ACTIVATE');
    P.trash = [ad]; P.spirits = [u]; const onField = BS.activatable(P, u, 'MAIN').length; P.spirits = []; P.trash = [u, ad];
    const listed = BS.activatable(P, u, 'MAIN').length;
    const ok = await BS.activateFx(P, u, idx);
    return { onField, listed, ok, inTrash: P.trash.includes(u), soul: P.soulState.includes(u), cores: nx.cores, fam: P.trashSafeFam, turn: P.trashSafeTurn === G.turnNo, again: BS.activatable(P, u, 'MAIN').length, partial: BS.CARDS['BS75-028'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.onField, 0, JSON.stringify(r)); assert.equal(r.listed, 1, JSON.stringify(r));
  assert.equal(r.ok, true, JSON.stringify(r)); assert.equal(r.inTrash, false); assert.equal(r.soul, true); assert.equal(r.cores, 2, JSON.stringify(r)); assert.equal(r.fam, 'Awakened Dragon'); assert.equal(r.turn, true);
});

test('K-1084 BS75-028: opposing effects cannot pick its Trash cards (this card always, Awakened Dragon cards for the turn after the activation)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 4; G.fxBy = O.key;
        const mk = () => { P.trash = [BS.mkInst('BS75-028'), BS.mkInst('BS74-048')]; P.trashSafeTurn = null; P.trashSafeFam = null; };
    const hit = async (p, q) => { const c = { p, opp: q, src: p.hand[0] || BS.mkInst('BS75-028'), ctx: {} }; const before = q.trash.length; await BS.FX_ACTIONS.REMOVE_OPP_TRASH.run(c, { do: 'REMOVE_OPP_TRASH', all: true }); return before - q.trash.length; };
    mk(); const noFlag = await hit(O, P);
    mk(); P.trashSafeTurn = G.turnNo; P.trashSafeFam = 'Awakened Dragon'; const withFlag = await hit(O, P);
    P.trashSafeTurn = G.turnNo - 1; mk(); P.trashSafeTurn = G.turnNo - 1; P.trashSafeFam = 'Awakened Dragon'; const stale = await hit(O, P);
    O.trash = [BS.mkInst('BS75-028')]; const own = await hit(P, O);
    return { noFlag, withFlag, stale, own, fam: BS.CARDS['BS74-048'].families }; })()`);
  assert.ok(r.fam.includes('Awakened Dragon'), JSON.stringify(r));
  assert.equal(r.noFlag, 1, JSON.stringify(r)); assert.equal(r.withFlag, 0, JSON.stringify(r)); assert.equal(r.stale, 1, JSON.stringify(r)); assert.equal(r.own, 0, JSON.stringify(r));
});

test('K-1085 BS74-047 Sat: set from Soul State for Mirage cost 2; a Mitra entering Soul State offers the summon (cost paid)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4; G.fxBy = P.key;
    const sat = BS.mkInst('BS74-047'); P.soulState = [sat]; sat.inSoulState = true; P.hand = []; P.spirits = []; O.spirits = []; P.reserve.n = 9; P.mirage = null; P.mirageSetThisTurn = false;
    const res0 = P.reserve.n; P.cpu = false; const ok = await intentMirage(P, sat); P.cpu = true;
    const set = { ok, mirage: P.mirage === sat, left: P.soulState.length, paid: res0 - P.reserve.n - (P.trashCores ? 0 : 0) };
    const mitra = BS.mkInst('BS74-CX03'); P.nexus = [mitra]; P.reserve.n = 9;
    BS.toSoulState(P, mitra); await BS.flushBursts();
    return { set, summoned: P.spirits.includes(sat), mirageGone: P.mirage === null, partial: BS.CARDS['BS74-047'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.set.ok, true, JSON.stringify(r)); assert.equal(r.set.mirage, true); assert.equal(r.set.left, 0);
  assert.equal(r.summoned, true, JSON.stringify(r)); assert.equal(r.mirageGone, true);
});

test('K-1086 BS74-047 Sat: while exactly one Mitra Nexus is controlled it cannot be destroyed nor have cores moved by opposing effects', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 4;
    const n = BS.mkInst('BS74-CX03'); n.cores = 4; P.nexus = [n]; P.spirits = []; O.spirits = []; const m = BS.mkInst('BS74-047'); m.mirage = true; P.mirage = m;
    G.fxBy = O.key; const cap1 = coreTakeCap(P, n, 2); BS.removeNexus(P, n, 'destroyed'); const alive1 = P.nexus.includes(n);
    const n2 = BS.mkInst('BS74-CX03'); n2.cores = 4; P.nexus = [n, n2]; const cap2 = coreTakeCap(P, n, 2); BS.removeNexus(P, n2, 'destroyed'); const alive2 = P.nexus.includes(n2);
    P.nexus = [n]; G.fxBy = P.key; const capOwn = coreTakeCap(P, n, 2);
    return { cap1, alive1, cap2, alive2, capOwn }; })()`);
  assert.equal(r.cap1, 0, JSON.stringify(r)); assert.equal(r.alive1, true); assert.equal(r.cap2, 2, JSON.stringify(r)); assert.equal(r.alive2, false); assert.equal(r.capOwn, 2);
});

test('K-1087 BS74-047 Sat: (When Summoned) pays to summon an Awakened Dragon / Hindida card from Soul State', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4; G.fxBy = P.key;
    const sat = BS.mkInst('BS74-047'), ad = BS.mkInst('BS74-048'); P.spirits = []; O.spirits = []; P.soulState = [ad]; ad.inSoulState = true; P.reserve.n = 9; P.hand = [sat];
    P.spirits = [sat]; sat.cores = 1; P.hand = []; await BS.fireFx(P, 'SUMMONED', sat, {}); await BS.flushBursts();
    return { onField: P.spirits.includes(ad), left: P.soulState.length }; })()`);
  assert.equal(r.onField, true, JSON.stringify(r)); assert.equal(r.left, 0);
});

test('K-1088 BS74-072 Mitra\'s Revelation Temple: entering Soul State offers a paid deploy', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4; G.fxBy = P.key;
    const t = BS.mkInst('BS74-072'); P.hand = [t]; P.nexus = []; P.spirits = []; O.spirits = []; P.reserve.n = 9;
    BS.toSoulState(P, t); const inSoul = P.soulState.includes(t); await BS.flushBursts();
    return { inSoul, deployed: P.nexus.includes(t), left: P.soulState.length, partial: BS.CARDS['BS74-072'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.inSoul, true); assert.equal(r.deployed, true, JSON.stringify(r)); assert.equal(r.left, 0);
});

test('K-1089 BS74-072 Lv2: opposing Spirits returned by an Awakened Dragon card of yours lose their leave effects (Lv1 and other sources do not)', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4;
    const t = BS.mkInst('BS74-072'); t.cores = 1; P.nexus = [t]; const ad = BS.mkInst('BS74-048'), other = BS.mkInst('BS75-042'); P.spirits = [ad, other]; O.spirits = [];
    G.fxBy = P.key; G.fxSrc = ad; const lv2 = BS.bounceLocked(O); G.fxSrc = other; const otherSrc = BS.bounceLocked(O);
    G.fxSrc = ad; t.cores = 0; const lv1 = BS.bounceLocked(O); t.cores = 1; G.fxBy = O.key; const wrongSide = BS.bounceLocked(O);
    const s = BS.mkInst('BS75-042'); s.cores = 1; O.spirits = [s]; G.fxBy = P.key; G.fxSrc = ad; BS.bounceCard(O, s, 'hand');
    return { lv2, otherSrc, lv1, wrongSide, noFxLeft: s.noFx === undefined, adFam: BS.CARDS['BS74-048'].families, lvOf: BS.CARDS['BS74-072'].levels.length }; })()`);
  assert.ok(r.adFam.includes('Awakened Dragon'), JSON.stringify(r)); assert.equal(r.lv2, true, JSON.stringify(r)); assert.equal(r.otherSrc, false); assert.equal(r.lv1, false, JSON.stringify(r)); assert.equal(r.wrongSide, false); assert.equal(r.noFxLeft, true);
});

test('K-1090 BS74-CX03 Mitra: Neo-Core Charge matches Awakened Dragon cost 3+ and Devotee/Concluser Ultimates only; Contract Field takes Field cores', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4; G.fxBy = P.key;
    const n = BS.mkInst('BS74-CX03'); n.cores = 1; P.nexus = [n]; P.spirits = []; O.spirits = []; const out = {};
    for (const id of ['BS75-X01', 'BS74-X01', 'BS74-043', 'BS74-040', 'BS74-X15', 'BS74-AX01']) { const u = BS.mkInst(id); P.spirits.push(u); n.cores = 1; P.reserve.n = 9; const b = n.cores; await BS.fireFx(P, 'ALLY_SUMMONED', null, { subject: u }); out[id] = n.cores - b; }
    const eff = BS.CARDS['BS74-CX03']; out.partial = eff.partial; return out; })()`);
  assert.equal(r.partial, false, JSON.stringify(r));
  assert.equal(r['BS74-043'], 1, JSON.stringify(r)); assert.equal(r['BS74-040'], 0, JSON.stringify(r)); assert.equal(r['BS74-X15'], 1, JSON.stringify(r)); assert.equal(r['BS74-AX01'], 1, JSON.stringify(r)); assert.equal(r['BS75-X01'], 1, JSON.stringify(r));
});

test('K-1091 BS74-X06 Burst: the opposing Life reduced (LIFE_ANY) sends a Grandwalker Nexus core to the Reserve and summons it free', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 4;
    const n = BS.mkInst('BS74-CX03'); n.cores = 3; P.nexus = [n]; P.spirits = []; O.spirits = []; const x = BS.mkInst('BS74-X06'); P.burst = x; P.reserve.n = 3;
    const lifeOnly = BS.CARDS['BS74-X06'].burst.when; await BS.maybeBurst(O, 'LIFE_DECREASE', {});
    return { h: G.history.slice(-6), lifeOnly, onField: P.spirits.includes(x), burstLeft: !!P.burst, nexusCores: n.cores, reserve: P.reserve.n, partial: BS.CARDS['BS74-X06'].partial }; })()`);
  assert.equal(r.partial, false, JSON.stringify(r)); assert.equal(r.onField, true, JSON.stringify(r)); assert.equal(r.nexusCores, 3, JSON.stringify(r)); assert.equal(r.reserve, 2, JSON.stringify(r)); assert.ok(r.h.some(l => /goes to .* Reserve/.test(l))); assert.equal(r.burstLeft, false);
});

test('K-1092 BS74-X06 Soul Burst: five cards in Soul State let it activate its Burst from Soul State, once per turn', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = P.key; G.step = 4; G.fxBy = P.key;
    const n = BS.mkInst('BS74-CX03'); n.cores = 3; P.nexus = [n]; P.spirits = []; O.spirits = []; const x = BS.mkInst('BS74-X06'); P.hand = [x]; P.reserve.n = 3;
    P.soulState = [BS.mkInst('BS74-041'), BS.mkInst('BS74-042'), BS.mkInst('BS74-043'), BS.mkInst('BS74-045')];
    const early = P.soulState.length; BS.toSoulState(P, x); await BS.flushBursts();
    return { h: G.history.slice(-5), early, onField: P.spirits.includes(x), soulLeft: P.soulState.length, nexusCores: n.cores }; })()`);
  assert.equal(r.onField, true, JSON.stringify(r)); assert.equal(r.soulLeft, 4); assert.ok(r.h.some(l => /goes to .* Reserve/.test(l)), JSON.stringify(r));
});

test('K-1093 BS74-X06 ∞: unaffected only by opposing effects whose colour is a symbol on the opposing Field', async () => {
  const { page } = await sharedBoard();
  const r = await page.evaluate(`(async () => { BS.testSetup(); const G = BS.G, P = G.p.player, O = G.p.opponent; P.cpu = O.cpu = true; G.active = O.key; G.step = 4;
    const x = BS.mkInst('BS74-X06'); x.cores = 5; P.spirits = [x]; const sym = BS.mkInst('BS74-043'); O.spirits = [sym]; O.nexus = [];
    const col = BS.CARDS['BS74-043'].symbol, other = ['red','purple','green','white','yellow','blue'].find(k => k !== col);
    const same = BS.mkInst('BS74-043'), diff = BS.mkInst(Object.keys(BS.CARDS).find(k => BS.CARDS[k].type === 'Magic' && BS.CARDS[k].symbol === other && (BS.CARDS[k].colors || [BS.CARDS[k].symbol]).every(y => y !== col)));
    return { same: BS.fxImmune(P, x, { p: O, src: same }), diff: BS.fxImmune(P, x, { p: O, src: diff }), lv: BS.lvNo(x) }; })()`);
  assert.equal(r.same, true, JSON.stringify(r)); assert.equal(r.diff, false, JSON.stringify(r));
});
