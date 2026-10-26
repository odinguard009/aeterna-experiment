/* ---------------------------------------------------------------------
   HOST PORT (v0.82.0, phase F2 = monorepo step M2; docs/ai/monorepo-plan.md "Design" 1)
   The engine talks to its host only through `io`: one engine, several hosts (browser UI, headless
   Node runner, later the server). Every record passed through the port is a plain, serializable object.
     io.view(ev)            the board or a screen changed; the host draws (web) or ignores it (headless)
     io.log(text)           one game log line was written (G.history keeps the text; hosts may react, e.g. sounds)
     io.decide(seat, d)     v0.83.0 (M3 part 1): every prompt of a seat as a decision record (kinds and answers:
                            packages/engine/src/05b-decide.js); resolves the answer; v0.84.0: board actions too (action -> intent records, packages/engine/src/05c-intent.js)
   View records (`type`):
     board                  redraw the playmat from G
     decks                  the format or the deck list changed (lobby + deck builder)
     screen  {id}           show an app screen ('view-playmat', 'view-deckbuilder', 'view-lobby')
     reset                  a new match starts: drop open prompts and field picks of the previous one
     matchEnd {winner}      the match is over (G.over, G.winner set; after the last board view)
     effect {side, id, text} v0.125.0 (U14d2): an effect of the card `id` (of seat `side`) starts resolving; display only (the Effect Active panel), hosts may ignore it
     core {side, kind, from, to}  v0.126.0 (U14d3): one core ('core' | 'soul') moved; from / to = a card uid or a zone ('reserve', 'void', 'trash'; v0.138.0 Core and Refresh Steps; nth = stagger index); sent just before the board is redrawn so a host can fly it; display only
     draw {side}            v0.138.0: the Draw Step of `side` is about to add a card (a host may fly one from the deck); display only
     burst {side, id}       v0.126.0 (U14d3): the set Burst of `side` is flipped to resolve; display only
     acted {seat, ok}       v0.84.0: the seat's intent (answer to an action decision) was applied (ok) or refused
   --------------------------------------------------------------------- */
const VIEW_TYPES = ['board', 'decks', 'screen', 'reset', 'matchEnd', 'acted', 'effect', 'core', 'draw', 'burst'];
/** @typedef {{ type: string, id?: string, winner?: string }} ViewRecord */
/** @typedef {{ name: string, view: (ev: ViewRecord) => void, log: (text: string) => void, decide: (p: any, d: any) => Promise<any> }} Host */
/** @type {Host} */
const HOST_NONE = { name: 'none', view: () => {}, log: () => {}, decide: () => Promise.reject(new Error('io.decide: no host answers decisions (bind one with bindHost)')) };
const io = {
  host: HOST_NONE,
  view(ev) { this.host.view(ev); },
  log(text) { this.host.log(text); },
  decide(p, d) { return this.host.decide(p, d); }
};
/** Binds a host ({name, view, log, decide}); missing handlers fall back to the no-op host. Returns the previous host. */
function bindHost(h) {
  const prev = io.host;
  io.host = Object.assign({}, HOST_NONE, h || {});
  return prev;
}
