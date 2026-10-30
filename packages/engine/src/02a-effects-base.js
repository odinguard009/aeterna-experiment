/* ---------------------------------------------------------------------
   EFFECT ENGINE  (v0.11)  - card effects are DATA: card.effects = [ ... ]
   Triggered effect: { trigger, lv:[1,2], if:{...}, once:true, optional:true, match:{name:[..],family:[..]}, actions:[ {do:'DRAW', n:1}, ... ] }
   Static effect:    { trigger:'STATIC', lv:[2], if:{...}, bp:5000, to:'self'|'own', match:{...}, attackingOnly:true }
   Triggers: SUMMONED (this card enters), ATTACKS (this card attacks), ALLY_ATTACKS (one of your cards matching "match" attacks),
             ALLY_BLOCKED (your attacking card matching "match" is blocked; zone:'hand' = the effect works from the Hand),
             v0.33: BLOCKS (this card blocks; an ATTACKS effect with alsoBlocks:true also activates), DESTROYED (this card is destroyed; resolved with its level at destruction),
             REVEALED (this card is revealed from the deck by your effect), ALLY_DESTROYS (your attacker matching "match" destroys the blocker in battle)
             v0.55: BATTLE_WIN (this card attacked or blocked and only the opposing Spirit was destroyed by BP comparison, Standard CR 8-1-6-2);
             conditions byOpp (DESTROYED by an opposing effect or BP comparison, CR 12-2-1-12-1) and hasSymbol (Rush: "while you have a X symbol")
             v0.73: LEAVES (this card leaves the Field due to the opponent: destroyed, depleted, returned or removed by an opposing effect,
             or destroyed by BP comparison; resolved while it waits in Standby / from its new zone); condition byOppFx (by an opposing effect only)
   --------------------------------------------------------------------- */
/* v0.59.4 STRICT EFFECTS (Q1, Aegis idea): an unknown trigger, action, condition or STATIC flag name is a bug, never a silent no-op.
   Strict (automated runs: navigator.webdriver = Playwright tests and sims, or ?strict=1): throw. Release: warn once per name and skip it. */
let FX_STRICT = (() => { try { return !!(navigator.webdriver || /[?&]strict=1(&|$)/.test(location.search)); } catch (e) { return false; } })();
const FX_WARNED = new Set();
function fxUnknown(kind, name) {
  const m = `unknown effect ${kind} "${name}"`;
  if (FX_STRICT) throw new Error(m);
  if (!FX_WARNED.has(m)) { FX_WARNED.add(m); try { console.warn('[effects] ' + m); } catch (e) { /* no console */ } }
  return false;
}
const FX_COND_KEYS = new Set(['trashAllColor', 'pickedCostIn', 'pickedKeyword', 'handLe', 'soulGe', 'oppHandGe', 'voidGe', 'controlName', 'oppTurn', 'soulLe', 'putGe', 'hasName', 'prev', 'sealed', 'lifeLe', 'lifeGe', 'anyLifeLe', 'counterGe', 'soulOn', 'attackStep', 'nexusBraved', 'oppSpiritsLe', 'oppNoAB', 'oppNexusGe', 'oppTrashGe', 'oppRemovedGe', 'oppRemovedSpirit', 'byOpp', 'hasSymbol', 'removedGe', 'utHit', 'ctrl', 'step', 'burstSet', 'oppBurstSet', 'byOppFx', 'fewerSpirits', 'nexusGe', 'lifeReduced', 'allHave', 'ctrlFamily', 'magicUsed', 'viaFormChange', 'viaHS', 'viaLegacy', 'soulPaid', 'selfSoul', 'not', 'symbolsOnGe', 'onlySymbols', 'selfBpGe', 'viaEffect', 'selfAttacking', 'firstAttack', 'firstBlock', 'blockerBpLe', 'selfBlocked', 'oppLostByFx', 'trashGe', 'ownLostSpirit', 'byOwnFx', 'attackerCostLe']);
const FX_TRIGGERS = ['SUMMONED', 'ATTACKS', 'ALLY_ATTACKS', 'ALLY_BLOCKED', 'ALLY_BLOCKS', 'ALLY_SUMMONED', 'ADVENT', 'ACTIVATE', 'STATIC', 'OPP_HAND_UP', 'ALLY_LIFE_HIT', 'OWN_LIFE_HIT', 'ALLY_LOST', 'START_ATTACK', 'MIRAGE_OWN_LIFE', 'MIRAGE_OPP_LIFE', 'SOUL_PLACED', 'MANIFEST', 'BLOCKS', 'DESTROYED', 'REVEALED', 'ALLY_DESTROYS', 'OPP_REMOVED', 'ACCEL', 'SILVER_WHEEL', 'BATTLE_WIN', 'OPP_ATTACKS', 'LEAVES', 'ALLY_BATTLE_WIN', 'MAGIC_USED', 'END_STEP', 'TRIBUTED', 'RUMBLE_DISCARD', 'OPP_DESTROYED_FX', 'NEXUS_EXHAUST', 'AMPLIFY', 'START_MAIN', 'OPP_START_ATTACK'];
const FX_TRIGGER_TEXT = { START_MAIN: 'Start of Your Main Step', OPP_START_ATTACK: 'Start of Opposing Attack Step', OPP_DESTROYED_FX: 'When opposing Spirits are destroyed by your effect', NEXUS_EXHAUST: 'When this Nexus exhausts', AMPLIFY: 'When your Spirit activates Amplify', RUMBLE_DISCARD: 'When cards are discarded from the opposing deck by your Rumble', TRIBUTED: 'When this Spirit becomes the target of Tribute', ALLY_BATTLE_WIN: 'When only the opposing Spirit is destroyed by BP comparison with your X', OPP_ATTACKS: 'When an opposing Spirit attacks', BATTLE_WIN: 'When Battles (only the opposing Spirit is destroyed by BP comparison)', ACCEL: 'Accel', SILVER_WHEEL: 'When you activate Silver Wheel', SUMMONED: 'When Summoned', ATTACKS: 'When Attacks', ALLY_ATTACKS: 'When an ally attacks', ALLY_BLOCKED: 'When an ally is blocked', ALLY_BLOCKS: 'When an ally blocks', ALLY_SUMMONED: 'When an ally is summoned', ADVENT: 'When Advents', ACTIVATE: 'Activate', OPP_HAND_UP: 'When the opposing Hand increases by an opposing effect', ALLY_LIFE_HIT: 'When an ally attack reduces the Life', OWN_LIFE_HIT: 'When your Life is reduced by an opposing attack', ALLY_LOST: 'When an ally is depleted/destroyed by the opponent', START_ATTACK: 'Start of your Attack Step', END_STEP: 'Your End Step', MIRAGE_OWN_LIFE: 'Mirage: when your Life is reduced', MIRAGE_OPP_LIFE: 'Mirage: when the opposing Life is reduced', SOUL_PLACED: 'When your Soul Core is sent to a Nexus', MANIFEST: 'When Manifests', BLOCKS: 'When Blocks', DESTROYED: 'When Destroyed', LEAVES: 'When this Spirit would leave the Field due to the opponent', REVEALED: 'When revealed from the deck', ALLY_DESTROYS: 'When your X destroys an opposing Spirit in battle', OPP_REMOVED: 'When cards are put onto the opposing Removed Zone', MAGIC_USED: 'When you use a Magic card' };
/* v0.60.0 Brave completion: a Spirit combined with a Brave gains the Brave's [When Braved] / During (Spirit) Brave effects (braved:true; JP 合体時);
   an effect with braved:true is off while its card is not combined (a Brave alone in Spirit form, an unbraved Spirit). Brave effects are indexed from BR_IDX. */
const BR_IDX = 200;
function fxEntries(f) {
  const card = CARDS[f.id], out = [];
  (card.effects || []).forEach((e, idx) => { if (!e.nexusBrave && (!e.braved || f.brave)) out.push({ e, idx }); });
  if (f.brave && card.type !== 'Nexus' && CARDS[f.brave.id]) (CARDS[f.brave.id].effects || []).forEach((e, j) => { if (e.braved && !e.nexusBrave) out.push({ e, idx: BR_IDX + j, fromBrave: true }); });
  return out;
}
function fxMatch(card, m, inst) {
  if (!m || (!m.name && !m.family && !m.familyAll && !m.keyword && !m.noText && m.costGe == null && m.costLe == null && !m.costIn && !m.type && !m.color && !m.noUlt && !m.team && m.symbolsGe == null && m.bpLe == null)) return true;
  if (m.noUlt && card.type === 'Ultimate') return false;      // v0.59: the text says "Spirit"; texts that include Ultimates print "Spirit/Ultimate"
  if (m.color && ![].concat(m.color).some(x => (card.colors || [card.symbol]).includes(x))) return false;      // v0.39: "Purple" Sorcerer cards (colour = card colour); v0.75: "Red/White" = either colour
  if (m.costGe != null && card.cost < m.costGe) return false;
  if (m.costLe != null && card.cost > m.costLe) return false;      // v0.69 "Cost N or less" (reveal effects)
  if (m.costIn && !m.costIn.includes(card.cost)) return false;      // v0.168 "Cost 6/8" = cost 6 or 8
  if (m.type && card.type !== m.type) return false;
  if (m.typeAny && !m.typeAny.includes(card.type)) return false;      // v0.196 "Spirit card/Nexus card" (a list of card types)
  if (m.team && !cardTeams(card).includes(m.team)) return false;      // v0.184 (schema 55) "a Red Stella Spirit card": the [Team: X] head line
  if (m.bpLe != null && !(inst && bpOf(inst) <= m.bpLe)) return false;      // v0.183 "an opposing 6000 BP or less Spirit" (current BP; needs the instance)
  if (m.symbolsGe != null && !((card.symbols || 0) >= m.symbolsGe)) return false;      // v0.78 "your Spirit with two or more symbols"
  if (m.familyAll && !m.familyAll.every(n => (card.families || []).includes(n))) return false;      // v0.88 S1 '"RYUKI" & "Kamen" family' (every listed family)
  if (m.keyword && !cardHasKeyword(card, m.keyword)) return false;      // v0.90 S1 'a Spirit with Clash'; v0.120.0 Amplify: the card's keywords list is authoritative ({{Amplify|...}} prints no "(...)" head)
  if (m.noText) { const t = String(card.desc || card.text || '').trim(); if (t && t !== 'Vanilla card (no effect text).') return false; }      // v0.90 S1 'with no printed effects'
  if (!m.name && !m.family) return true;
  return [].concat(m.name || []).some(n => card.name.toLowerCase().includes(n.toLowerCase())) || (m.family || []).some(n => (card.families || []).includes(n));
}
/* v0.70 STATIC BLOCK_EXHAUSTED ("This Spirit can block while exhausted", usually inside a step window): an exhausted Spirit may still block */
const cantAttack = (p, s) => !!s.noAB || (!!G && s.noAtkTurn === G.turnNo) || flagActive(p, 'CANT_ATTACK', s);      // v0.170: the printed "This Spirit can't attack." (STATIC flag CANT_ATTACK) besides the effect lock noAB
const canBlockState = (p, s) => !s.noAB && !(s.noBlockB && s.noBlockB === G.battleNo) && !flagActive(p, 'CANT_BLOCK', s) && (!s.exhausted || flagActive(p, 'BLOCK_EXHAUSTED', s) || (s.blockExB != null && s.blockExB === G.battleNo));      // v0.89 S1: BLOCK_EXHAUSTED_OPP (02p)
function fxIf(owner, opp, c, ctx) {
  if (!c) return true;
  for (const k in c) if (!FX_COND_KEYS.has(k)) return fxUnknown('condition', k);     // v0.59.4 strict effects
  if (c.soulGe != null && !(owner.soulState.length >= c.soulGe)) return false;
  if (c.oppHandGe != null && !(opp.hand.length >= c.oppHandGe)) return false;
  if (c.handLe != null && !(owner.hand.length <= c.handLe)) return false;      // v0.166 "If your Hand is five or less"
  if (c.voidGe != null && !(owner.void >= c.voidGe)) return false;
  if (c.controlName != null && ![].concat(c.controlName).some(n => fieldList(owner).some(f => CARDS[f.id].name.toLowerCase().includes(String(n).toLowerCase())))) return false;
  if (c.oppTurn != null && (G.active !== owner.key) !== c.oppTurn) return false;
  if (c.soulLe != null && !(owner.soulState.length <= c.soulLe)) return false;
  if (c.putGe != null && !((ctx && ctx.put || 0) >= c.putGe)) return false;
  if (c.hasName != null) { const nm = String(c.hasName).toLowerCase(); if (!fieldList(owner).concat(owner.soulState).some(f => CARDS[f.id].name.toLowerCase().includes(nm))) return false; }
  if (c.prev != null && !!(ctx && ctx.prev) !== c.prev) return false;
  if (c.sealed != null && isSealed(owner) !== c.sealed) return false;        // v0.48 [During Seal]
  if (c.lifeLe != null && !(owner.life <= c.lifeLe)) return false;
  if (c.lifeGe != null && !(owner.life >= c.lifeGe)) return false;
  if (c.anyLifeLe != null && !(owner.life <= c.anyLifeLe || opp.life <= c.anyLifeLe)) return false;
  if (c.counterGe != null && !(owner.count >= c.counterGe)) return false;
  if (c.soulOn != null) { const nm = String(c.soulOn).toLowerCase(); if (!owner.nexus.some(n => n.soul && CARDS[n.id].name.toLowerCase().includes(nm))) return false; }
  if (c.attackStep != null && (G.step === 5) !== c.attackStep) return false;
  if (c.step != null && G.step !== STEPS.indexOf(c.step)) return false;          // v0.70 step window "(Your|Opposing|Either) X Step)" (whose turn = oppTurn)
  if (c.nexusBraved != null) { const nm = String(c.nexusBraved).toLowerCase(); if (!owner.nexus.some(n => n.brave && CARDS[n.id].name.toLowerCase().includes(nm))) return false; }   // "if you control any braved Contractor Nuadha" (v0.37)
  if (c.oppSpiritsLe != null && !(opp.spirits.length <= c.oppSpiritsLe)) return false;      // v0.39: "if the opponent doesn't control any Spirit"
  if (c.oppNoAB != null && opp.spirits.some(s => s.noAB) !== c.oppNoAB) return false;      // v0.40: "if any opposing Spirit is under can't attack/block effects"
  if (c.oppTrashGe != null && !(opp.trash.length >= c.oppTrashGe)) return false;      // v0.195 "If there are N or more cards in the opposing Trash"
  if (c.oppNexusGe != null && !(opp.nexus.length >= c.oppNexusGe)) return false;           // v0.40: "if the opponent controls any Nexus"
  if (c.oppRemovedGe != null && !(opp.removed.length >= c.oppRemovedGe)) return false;      // v0.38: cards in the opposing Removed Zone
  if (c.oppRemovedSpirit != null && opp.removed.some(t => ['Spirit', 'Ultimate'].includes(CARDS[t.id].type)) !== c.oppRemovedSpirit) return false;
  if (c.byOpp != null && !!(ctx && ctx.byOpp) !== c.byOpp) return false;                  // v0.55 "(When Destroyed by the Opponent)"
  if (c.byOppFx != null && !!(ctx && ctx.byOppFx) !== c.byOppFx) return false;            // v0.73 "destroyed by / would leave the Field due to opposing effects" (not BP comparison)
  if (c.hasSymbol != null && ![].concat(c.hasSymbol).every(k => (symbolsOn(owner)[k] || 0) >= 1)) return false;   // v0.55 Rush: a Field symbol of that colour
  if (c.onlySymbols != null) { const sy = symbolsOn(owner); if (!((sy[c.onlySymbols] || 0) >= 1) || Object.keys(sy).some(k => k !== c.onlySymbols && sy[k] > 0)) return false; }      // v0.179 "only White symbols on your Field" (at least one, none of another colour)
  if (c.firstBlock != null && ((owner.blocksThisTurn || 0) <= 1) !== c.firstBlock) return false;      // v0.196 (counter bumped when the block is declared; BLOCKS fires after)
  if (c.firstAttack != null && ((owner.attacksThisTurn || 0) <= 1) !== c.firstAttack) return false;      // v0.185 (counter bumped when the attack is declared; the attack triggers fire after)
  if (c.symbolsOnGe != null && !((symbolsOn(owner)[c.symbolsOnGe.color] || 0) >= c.symbolsOnGe.n)) return false;      // v0.168 "If you control/have three or more White symbols" (Field symbols of the owner, counted when it is checked)
  if (c.removedGe != null && !((ctx && ctx.removedN || 0) >= c.removedGe)) return false;   // cards this effect put onto the opposing Removed Zone
  if (c.utHit != null && !!(ctx && ctx.utHit) !== c.utHit) return false;               // v0.56 Ultimate Trigger hit
  if (c.burstSet != null && !!(owner.burst && !owner.burst.mirage) !== c.burstSet) return false;      // v0.71 "if/while you have a (set) Burst" (Fandom Burst: a face-down card in the Burst Area)
  if (c.oppBurstSet != null && !!(opp.burst && !opp.burst.mirage) !== c.oppBurstSet) return false;   // v0.71 "while the opponent has a set Burst"
  if (c.ctrl != null && ![].concat(c.ctrl).every(q => q.nLe != null ? ctrlCount(owner, q, ctx) <= q.nLe : ctrlCount(owner, q, ctx) >= (q.n == null ? 1 : q.n))) return false;   // v0.56 Ultimate summon conditions
  if (c.fewerSpirits != null && (spiritCount(owner) < spiritCount(opp)) !== c.fewerSpirits) return false;   // v0.77 "if you control fewer Spirits than the opponent" (Spirits only, counted when it resolves)
  if (c.nexusGe != null && !(perCount(owner, Object.assign({ type: 'Nexus' }, c.nexusGe, { n: undefined })) >= (c.nexusGe.n || 1))) return false;   // v0.77 "if you control a <colour> Nexus"
  if (c.trashGe && owner.trash.filter(t => fxMatch(CARDS[t.id], c.trashGe.match)).length < c.trashGe.n) return false;   // v0.196 "two or more <family> Magic cards in your Trash"
  if (c.oppLostByFx != null && (owner.oppFxLossTurn === G.turnNo) !== c.oppLostByFx) return false;   // v0.196 "an opposing Spirit was depleted/destroyed by your effect this turn"
  if (c.byOwnFx && !(ctx && ctx.selfInst && ctx.selfInst.lostFxSrc && (CARDS[ctx.selfInst.lostFxSrc.id].families || []).some(x => c.byOwnFx.family.includes(x)))) return false;   // v0.197 "destroyed by your <family> effect"
  if (c.ownLostSpirit != null && (owner.lostSpiritTurn === G.turnNo) !== c.ownLostSpirit) return false;   // v0.197 "if your Spirit is destroyed this turn"
  if (c.lifeReduced != null && (owner.lifeRedTurn === G.turnNo) !== c.lifeReduced) return false;   // v0.88 S1 "if your Life was reduced (during) this turn"
  if (c.not != null && fxIf(owner, opp, c.not, ctx)) return false;      // v0.135 "unless C": the otherwise branch of an "If C, B instead" pair
  if (c.viaLegacy != null && !!(ctx && ctx.viaLegacy) !== c.viaLegacy) return false;      // v0.195 "summoned using Legacy": at least one EX-symbol card was banished for it
  if (c.viaHS != null && !!(ctx && ctx.viaHS) !== c.viaHS) return false;      // v0.194 Rush chain: only when this Spirit was summoned with High Speed
  if (c.pickedCostIn != null && !(ctx && ctx.picked && c.pickedCostIn.includes(CARDS[ctx.picked.id].cost))) return false;      // v0.196 "If that's Cost 2/4/6/8" (the card revealed by REVEAL_PICK peek)
  if (c.pickedKeyword != null && !(ctx && ctx.picked && (CARDS[ctx.picked.id].desc || '').includes('{{' + c.pickedKeyword + '|'))) return false;      // v0.196 "if it has Form Change" (the Spirit picked by BP_TARGET)
  if (c.viaFormChange != null && !!(ctx && ctx.viaFC) !== c.viaFormChange) return false;      // v0.135 "If summoned via Form Change" (false = the otherwise branch)
  if (c.soulPaid != null && !!(ctx && ctx.selfInst && ctx.selfInst.soulPaid) !== c.soulPaid) return false;      // v0.176 "If (Soul Core) was used to pay the summon cost" (the Soul Core was among the cores paid by the normal summon)
  if (c.selfSoul != null && !!(ctx && ctx.selfInst && (ctx.selfInst.soul || ctx.selfInst.soulLost)) !== c.selfSoul) return false;      // v0.176 "If (Soul Core) is on this Spirit" (soulLost = held when it left the Field)
  if (c.selfBlocked != null && !!(ctx && ctx.selfInst && G.attacker === ctx.selfInst && G.blocker) !== c.selfBlocked) return false;      // v0.185 "this Spirit is being blocked"
  if (c.blockerBpLe != null && !(ctx && ctx.blocker && bpOf(ctx.blocker) <= c.blockerBpLe)) return false;      // v0.185 "blocked by an opposing N BP or less Spirit" (ALLY_BLOCKED)
  if (c.selfBpGe != null && !(ctx && ctx.selfInst && bpOf(ctx.selfInst) >= c.selfBpGe)) return false;      // v0.181 "If this Spirit has N BP or more" (BP when the effect resolves)
  if (c.trashAllColor != null && !owner.trash.every(t => { const k = CARDS[t.id]; return (k.colors || [k.color, k.symbol]).includes(c.trashAllColor); })) return false;      // v138 "all cards in your Trash are <colour>"
  if (c.attackerCostLe != null && !(G.attacker && CARDS[G.attacker.id].cost <= c.attackerCostLe)) return false;      // v135 "blocks an opposing Cost N or less Spirit"
  if (c.selfAttacking != null && !!(ctx && ctx.selfInst && G.attacker === ctx.selfInst) !== c.selfAttacking) return false;      // v0.185 "(During Attack)": this Spirit is the attacker
  if (c.viaEffect != null && !!(ctx && ctx.selfInst && ctx.selfInst.viaFx) !== c.viaEffect) return false;      // v0.181 "If this Spirit is summoned via an effect" (summonFree sets viaFx; the paid summons clear it)
  if (c.allHave != null && !allHaveOK(owner, c.allHave)) return false;
  if (c.ctrlFamily != null && owner.spirits.some(f => c.ctrlFamily.any.some(x => (CARDS[f.id].families || []).includes(x))) !== c.ctrlFamily.is) return false;   // v0.89 S1 "if you control any X/Y family Spirit"                             // v0.88 S1 "if all your Spirits/Nexuses have X" (02p)
  if (c.magicUsed != null && !(owner.magicTurn && owner.magicTurn.turn === G.turnNo && owner.magicTurn.cards.some(id => fxMatch(CARDS[id], c.magicUsed)))) return false;   // v0.116 "if you used a <family>/<colour> Magic card this turn"
  return true;
}
/* v0.56 "you control N or more <colour/cost/family> Spirits/Ultimates" (Ultimate summon conditions, {{Sumcon|...}}):
   q = { n, type: 'Spirit'|'Ultimate'|'Both', colors: [any of], costGe, family }; counts the owner's Spirit-form cards on the Field */
const cardHasKeyword = (card, kw) => (card.keywords || []).some(k => String(k).toUpperCase() === String(kw).toUpperCase()) || new RegExp('(^|[\\]\\)\\s])' + String(kw).replace(/[^A-Za-z ]/g, '') + ' \\(').test(card.desc || card.text || '') || new RegExp('\\(' + String(kw).replace(/[^A-Za-z ]/g, '') + '\\)', 'i').test(card.desc || card.text || '')
  || (String(kw).toUpperCase() === 'LEGACY' && (card.legacy === true || /^\(Legacy\)/.test(card.desc || card.text || '')))      // v0.167 "Spirit with Legacy": the (Legacy) head line / legacy flag
  || (String(kw).toUpperCase() === 'CURRENT' && /\{\{Current\|/.test(card.desc || card.text || ''))
  || (String(kw).toUpperCase() === 'SHAMANISM' && /\{\{Shaman\|/.test(card.desc || card.text || ''));      // v0.167 "Spirit with Shamanism": the {{Shaman|...}} holder template
const fxNoText = k => { const t = String(k.desc || k.text || '').trim(); return !t || t === 'Vanilla card (no effect text).'; };      // v0.167 ctrl.noText: "a Spirit with no printed effects"
const ctrlCount = (owner, q, ctx) => owner.spirits.concat(q.nexus ? owner.nexus : []).filter(f => { const k = CARDS[f.id], u = k.type === 'Ultimate';
  if (q.other && ctx && ctx.selfUid === f.uid) return false;      // v0.150 "another / besides this Spirit"
  if (q.keyword && !cardHasKeyword(k, q.keyword)) return false;      // v0.150 "a Spirit with Evolution"
  return (q.type === 'Both' || (q.type === 'Ultimate') === u) && (!q.colors || q.colors.some(x => (k.colors || [k.symbol]).includes(x)))
    && (q.costIn == null || q.costIn.includes(k.cost)) && (q.costGe == null || k.cost >= q.costGe) && (q.costLe == null || k.cost <= q.costLe) && (q.bpGe == null || bpOf(f) >= q.bpGe) && (!q.noText || fxNoText(k)) && (!q.name || k.name.includes(q.name)) && (!q.team || cardTeams(k).includes(q.team)) && (!q.family || [].concat(q.family).some(x => (k.families || []).includes(x))) && (!q.exhausted || f.exhausted) && (!q.refreshed || !f.exhausted); }).length;      // v0.169 family may be a list (either family)      // v0.76 exhausted: "any exhausted X"
const spiritCount = q => q.spirits.filter(f => CARDS[f.id].type !== 'Ultimate').length;      // v0.77 fewerSpirits
/* v0.72 "for each X you control": cards on the owner's Field matching per {type: 'Spirit'|'Nexus', colors, family, name (part of the name)}; the source itself counts */
const PER_TYPES = ['Spirit', 'Nexus'];
const perOk = q => !!q && typeof q === 'object' && PER_TYPES.includes(q.type) && (q.colors == null || (Array.isArray(q.colors) && q.colors.length && q.colors.every(x => COLORS.includes(x))))
  && (q.family == null || typeof q.family === 'string') && (q.name == null || typeof q.name === 'string') && (q.keyword == null || typeof q.keyword === 'string') && (q.team == null || typeof q.team === 'string');
const perCount = (owner, q) => (q.type === 'Nexus' ? owner.nexus : owner.spirits.filter(f => CARDS[f.id].type !== 'Ultimate')).filter(f => { const k = CARDS[f.id];
  return (!q.colors || q.colors.some(x => (k.colors || [k.color, k.symbol]).includes(x))) && (!q.family || (k.families || []).includes(q.family)) && (!q.name || k.name.includes(q.name)) && (!q.team || cardTeams(k).includes(q.team)) && (!q.keyword || cardHasKeyword(k, q.keyword)); }).length;
function ownerOf(i) { if (!G) return null; for (const k of ['player', 'opponent']) if (fieldList(G.p[k]).includes(i)) return G.p[k]; return null; }
const STATIC_FLAGS = ['MUST_BLOCK', 'NO_RETURN', 'CORES_DRAW', 'UNAFFECTED_SOUL', 'COST_DESTROY_PLUS', 'EXTRA_REDUCTION', 'SUMMON_SYMBOL', 'NO_END_ATTACK', 'UNAFFECTED', 'HAND_UNAFFECTED', 'BLOCK_EXHAUSTED', 'CANT_ATTACK', 'CANT_BLOCK', 'NO_DECK_DISCARD', 'NO_ATTACK_LIFE', 'HAND_COST', 'DRAW_PLUS', 'TREAT_LV3', 'TRIBUTE_SAFE', 'IMMORTALITY', 'NO_BLOCK_INFERIOR'];
/* flag effects: MUST_BLOCK (opposing Spirits must block this attacker), NO_RETURN (cannot be returned by opposing effects), CORES_DRAW (draw once per turn when cores are sent by your effects),
   UNAFFECTED_SOUL (Ometeotl Contract Field: this card is unaffected by opposing effects while a Soul Core is on it),
   NO_END_ATTACK (v0.43: while the matching Spirit of the owner attacks, the opponent can't end the Attack Step via effects; Sunya Lv3, Crimson Crater Lv2) */
/* v0.58 "unaffected" (session E): STATIC UNAFFECTED { to: 'self'|'own', match, from: { colors, types } } = unaffected by OPPOSING effects
   whose source card has one of those colours and card types (Armor: Spirit/Nexus/Magic, Heavy Armor: Spirit/Brave/Nexus/Magic,
   Ultra Armor: Spirit/Ultimate/Nexus/Magic; no "from" = all opposing effects). c = the acting effect { p: its owner, src: its card }.
   Priority (Eternal manual FAQ Q4): "cannot be prevented" (action ignoreImmune) > "unaffected" > "cannot activate". */
const fxImmune = (owner, t, c) => !!t && ((!!t.soul && flagActive(owner, 'UNAFFECTED_SOUL', t)) || (!!c && !!c.p && !!c.src && c.p !== owner && unaffectedBy(owner, t, c.src)));
function unaffectedBy(owner, t, src) {
  const k = CARDS[src.id]; if (!k) return false;
  const cols = k.colors || [k.symbol];
  return flagActive(owner, 'UNAFFECTED', t, e => !e.from || ((!e.from.colors || e.from.colors.some(x => cols.includes(x))) && (!e.from.types || e.from.types.includes(k.type))));
}
/* v0.181 STATIC DRAW_PLUS {n} ("(Your Draw Step) You draw +N card(s)" / "increase the number of cards you draw by +N", optionally "If <cond>,"): extra cards in the owner's Draw Step */
function drawPlusOf(p) {
  if (!G) return 0;
  const opp = G.p[other(p.key)]; let n = 0;
  for (const src of fieldList(p)) {
    const L = lvNo(src);
    for (const { e } of fxEntries(src)) {
      if (e.trigger !== 'STATIC' || e.flag !== 'DRAW_PLUS' || (e.lv && !e.lv.includes(L)) || (e.oc && !ocActive(src)) || !fxIf(p, opp, e.if, { selfInst: src })) continue;
      n += e.n;
    }
  }
  return n;
}
/* v0.186 STATIC NO_ATTACK_LIFE {costLe} ("Neither player's Life can be reduced by the attacks of Cost N or less Spirits."): while any Spirit/Nexus of either player carries it, an unblocked attack of a Spirit with cost <= N takes no Life */
const attackLifeLocked = att => !!G && ['player', 'opponent'].some(k => fieldList(G.p[k]).some(s => flagActive(G.p[k], 'NO_ATTACK_LIFE', s, e => CARDS[att.id].cost <= e.costLe)));
/* v0.180 STATIC NO_DECK_DISCARD ("Cards can't be discarded from either deck."): while any Spirit/Nexus of either player carries it, nothing goes from a Deck to a Trash */
const deckDiscardLocked = () => !!G && ['player', 'opponent'].some(k => fieldList(G.p[k]).some(s => flagActive(G.p[k], 'NO_DECK_DISCARD', s)));
function flagActive(owner, flag, subject, pred) {
  if (!STATIC_FLAGS.includes(flag)) return fxUnknown('flag', flag);                  // v0.59.4 strict effects
  if (!G || !owner || !subject) return false;
  const opp = G.p[other(owner.key)];
  for (const side of [owner, opp]) for (const src of fieldList(side)) {      // v0.183 to:'all' reaches the Spirits of both players ("Cost 0/3 Spirits can't attack/block")
    const L = lvNo(src), sideOpp = side === owner ? opp : owner;
    for (const { e } of fxEntries(src)) {
      if (e.trigger !== 'STATIC' || e.flag !== flag || (pred && !pred(e))) continue;
      if (side !== owner && e.to !== 'all') continue;
      if (e.lv && !e.lv.includes(L)) continue;
      if (e.oc && !ocActive(src)) continue;
      if (e.to === 'own' || e.to === 'all' ? !fxMatch(CARDS[subject.id], e.match) : src !== subject) continue;
      if (!fxIf(side, sideOpp, e.if, { selfInst: src })) continue;
      return true;
    }
  }
  return false;
}
/* v0.37 "Cost Destruction effects" (destroy a Spirit/Ultimate with cost N or less): the limit grows with STATIC COST_DESTROY_PLUS effects of the owner's Field cards and of a Brave combined with a Nexus
   (Bulwark Temple: +1 per Saga Brave for Celtica/Scalostle sources; Railgun on a Nexus: +1). src = the card whose effect destroys. */
function costDestroyBonus(p, src) {
  if (!G) return 0;
  const sagaBraves = () => fieldList(p).reduce((n, f) => n + (CARDS[f.id].type === 'Brave' && (CARDS[f.id].families || []).includes('Saga') ? 1 : 0) + (f.brave && (CARDS[f.brave.id].families || []).includes('Saga') ? 1 : 0), 0);
  let n = 0;
  const one = (e, f, L, braveSrc) => {
    if (e.trigger !== 'STATIC' || e.flag !== 'COST_DESTROY_PLUS') return;
    if (e.lv && !e.lv.includes(L)) return;
    if (e.srcFamily && !(src && (CARDS[src.id].families || []).some(x => e.srcFamily.includes(x)))) return;
    n += e.n * (e.perSagaBrave ? sagaBraves() : 1);
  };
  for (const f of fieldList(p)) {
    const card = CARDS[f.id], L = lvNo(f);
    for (const e of card.effects || []) if (!e.nexusBrave) one(e, f, L);
    if (f.brave && card.type === 'Nexus') for (const e of CARDS[f.brave.id].effects || []) if (e.nexusBrave) one(e, f, 0);
  }
  return n;
}
function coresSent(p, inst, n) {                      // call after your effect put n cores onto inst
  if (n > 0 && flagActive(p, 'CORES_DRAW', inst)) {
    const key = 'coresdraw:' + CARDS[inst.id].name; p.onceUsed = p.onceUsed || {};
    if (p.onceUsed[key] === G.turnNo) return; p.onceUsed[key] = G.turnNo;
    const k = draw(p, 1); log(`${CARDS[inst.id].name}: ${who(p)} ${p.cpu ? 'draws' : 'draw'} ${k} card (cores were sent to it).`); handUp(p, k);
  }
}
function staticBp(i) {
  if (!G || !isSpiritForm(CARDS[i.id])) return 0;
  const o = ownerOf(i); if (!o) return 0;
  const opp = G.p[other(o.key)]; let sum = 0; const seenNS = new Set();
  for (const src of fieldList(o)) {
    const L = lvNo(src);
    for (const { e } of fxEntries(src)) {
      if (e.trigger !== 'STATIC' || !e.bp) continue;
      if (e.lv && !e.lv.includes(L)) continue;
      if (e.oc && !ocActive(src)) continue;
      if ((e.to || 'self') === 'self' ? src !== i : !fxMatch(CARDS[i.id], e.match)) continue;
      if (e.targetRefreshed && i.exhausted) continue;      // v132 "Spirits in refreshed state gain +N BP"
      if (e.attackingOnly && G.attacker !== i) continue;
      if (e.blockingOnly && G.blocker !== i) continue;           // v0.159 (During Block)
      if (e.fightingOnly && G.attacker !== i && G.blocker !== i) continue;      // v0.168 "attacking/blocking Spirits"
      if (!fxIf(o, opp, e.if)) continue;
      if (e.noStack) { const k = CARDS[src.id].name + ':' + e.bp + ':' + JSON.stringify(e.match || null); if (seenNS.has(k)) continue; seenNS.add(k); }      // v0.168 (Can't Stack): one copy counts
      sum += e.perHand ? e.bp * o.hand.length : e.perReserve ? e.bp * o.reserve.n : e.perCores ? e.bp * (i.cores || 0) : e.per ? e.bp * (perCount(o, e.per) - (e.besides && perCount({ spirits: [src], nexus: [src] }, e.per) ? 1 : 0)) : e.bp;      // v0.72 "For each X you control, this Spirit gains +N BP" (per)
    }
  }
  return sum;
}
/* official (Standard Comprehensive Rules 4-8-1/4-8-2, Eternal Rule Manual p.11/p.20): the Void is the supply of cores and has no limit;
   when it runs out, cores are added from outside the game. p.void is this player's Void; taking more than it holds adds new cores (made). */
function takeFromVoid(p, n) { if (n <= 0) return 0; if (p.void < n) { p.made += n - p.void; p.void = n; } p.void -= n; return n; }
function releaseCores(p, i) {                          // official: a Grandwalker Nexus' cores go to the Void, other cards' cores to the Reserve
  if (isCountLv(CARDS[i.id])) p.void += i.cores; else p.reserve.n += i.cores;
  if (i.soul) p.reserve.soul = true;
}
function removeNexus(p, n, why) {
  if (!removeFrom(p.nexus, n)) return;
  releaseCores(p, n);
  n.cores = 0; n.soul = false; shedBrave(p, n, p.trash);
  p.trash.push(n); log(`${poss(p)} ${CARDS[n.id].name} is ${why}.`);
}
async function fxPickTarget(c, cands, text) {
  if (!cands.length) return null;
  if (c.p.cpu) return cands.slice().sort((a, b) => (bpOf(b) - bpOf(a)) || (b.cores - a.cores))[0];
  if (cands.length === 1) return cands[0];
  const uid = await pickFromField({ text, uids: cands.map(t => t.uid) });
  return cands.find(t => t.uid === uid) || cands[0];
}
/* ---- Soul State / Void helpers (v0.13) ---- */
function toSoulState(p, inst) {                       // any zone (Hand, Trash, Deck, revealed, field) -> Soul State
  if (p.spirits.includes(inst) || p.nexus.includes(inst)) {
    removeFrom(p.spirits, inst); removeFrom(p.nexus, inst);
    releaseCores(p, inst);
    for (const u of inst.under) { u.under = []; p.trash.push(u); }
    inst.under = []; shedBrave(p, inst, p.trash);
    if (inst.token) { tokenHome(p, inst); log(`${poss(p)} ${CARDS[inst.id].name} Token returns to the Token supply.`); return false; }
  } else if (![p.hand, p.trash, p.standby, p.deck, p.revealed, p.soulState].some(z => removeFrom(z, inst))) return false;
  inst.cores = 0; inst.soul = false; inst.exhausted = false; inst.heavy = false; inst.noAB = false; inst.bpMod = 0; inst.mirage = false; inst.inSoulState = true;
  p.soulState.push(inst);
  log(`${poss(p)} ${CARDS[inst.id].name} enters Soul State.`);
  return true;
}
async function chooseCard(c, L, title, text, optional) {
  if (!L.length) return null;
  if (c.p.cpu) return L.slice().sort((a, b) => CARDS[b.id].cost - CARDS[a.id].cost)[0];
  const ids = Array.from(new Set(L.map(x => x.id))).slice(0, 8);
  /** @type {AskButton[]} */
  const buttons = ids.map(i => ({ label: CARDS[i].name, value: i }));
  if (optional) buttons.push({ label: 'Skip', cls: 'cancel', value: null });
  const id = await ask({ title, peek: true, wide: true, html: text, cards: cardIds(ids), buttons });
  if (id == null) return optional ? null : L[0];
  return L.find(x => x.id === id) || L[0];
}
function bounceCard(owner, t, to) {                   // return a field card to the Hand or the bottom of the Deck (cores go to the Reserve)
  const wasSpirit = owner.spirits.includes(t); if (wasSpirit) t.lostLv = lvIndex(t);
  if (!removeFrom(owner.spirits, t)) removeFrom(owner.nexus, t);
  if (wasSpirit && G && G.fxBy && G.fxBy !== owner.key) leaveEvent(owner, t, true, true);   // v0.73 LEAVES: returned by an opposing effect
  releaseCores(owner, t);
  t.cores = 0; t.soul = false; t.exhausted = false; t.heavy = false; t.noAB = false; t.bpMod = 0; t.viaFC = false; t.viaHS = false; t.legacyN = 0; t.viaFx = false;
  for (const u of t.under) { u.under = []; owner.trash.push(u); }
  t.under = [];
  if (t.token) { shedBrave(owner, t, to === 'deckBottom' ? owner.deck : owner.hand); tokenHome(owner, t); log(`${poss(owner)} ${CARDS[t.id].name} Token returns to the Token supply.`); return; }
  if (to === 'deckBottom') owner.deck.push(t); else owner.hand.push(t);
  shedBrave(owner, t, to === 'deckBottom' ? owner.deck : owner.hand);
  log(`${poss(owner)} ${CARDS[t.id].name} returns to the ${to === 'deckBottom' ? 'bottom of the Deck' : 'Hand'}.`);
}
const SOUL_SRC = ['self', 'hand', 'trash', 'handOrTrash', 'reveal'];
const hasMatch = m => !!m && (m.name || m.family || m.costGe != null || m.costLe != null || m.costIn || m.type || m.typeAny || m.color || m.familyAll || m.keyword || m.noText || m.team);
