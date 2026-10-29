// M5 types (v0.101.0): shapes of the engine's main records, for the TypeScript checker only (tools/lint.mjs passes this
// file next to build/game.js). The game never loads it. Engine parts refer to these names in JSDoc (`@type`, casts);
// add a property here when the engine starts writing it. Fields marked `any` are not typed yet (next M5 steps).

/** A card as `defCard` / `parseCard` store it in CARDS (only the fields the checker needs so far). */
interface CardDef {
  id: string; name: string; type: string; cost: number; reduction: Record<string, number>;
  levels: { cores: number; bp: number }[]; families?: string[]; symbols?: number | Record<string, number>;
  effects?: any[]; magic?: MagicSpec | null; brave?: BraveSpec | null; [k: string]: any;
}
/** One "by timing" variant of a Magic card (`magic.by.MAIN` / `magic.by.FLASH`). */
interface MagicVariant { effect: string; value: number; actions?: any[]; match?: any; if?: any }
/** `magic` of a Magic card after parseCard. */
interface MagicSpec {
  timing: string[]; effect: string | null; value: number; noMain?: boolean;
  trashUse?: { if?: any; actions?: any[] }; oppAttackHand?: { gwToVoid: number; match: any };
  actions?: any[]; by?: Record<string, MagicVariant>;
}
/** `costAlt`: a lower cost while a condition holds. */
interface CostAlt { cost: number; once: boolean; if?: any }
/** `tribute`: after paying the summon cost, send all cores of one of your matching Spirits to the Trash/Void. */
interface TributeSpec { costGe?: number; family?: string; to: 'trash' | 'void' }
/** `brave` of a Brave card: BP+ when combined and the combine condition. */
interface BraveSpec { bp: number; family?: string[]; name?: string[]; costGe?: number; costLe?: number; nexus?: { name: string[] } }
/** `contractAdvent` / `manifest` of a Contract-era Spirit or Ultimate. */
interface ContractAdventSpec { family: string; counterGe: number; turn: string; seal?: boolean }
interface ManifestSpec { name: string; counterGe: number; turn: string; ultra?: boolean; seal?: boolean }
/** A modal button (`ask({ buttons })`). */
interface AskButton { label: string; value: any; cls?: string }
/** A deck slot in the browser (My decks). */
interface DeckSlot { name: string; cards: any /* card id -> copies; typed with the deck helpers */; [k: string]: any }
/** Result of `runPortRecord` (input record replay through the port). */
interface PortRunResult {
  ok: boolean; reason: string; at?: number; total?: number; over?: boolean; final?: any; same?: boolean; cut?: any;
  sameCut?: boolean; build?: string; recBuild?: string; frames?: any[];
}
/* Web-only globals written by apps/web (never the engine): the test-hook object `window.BS` (16-events.js) and the
   dev board refs `window.SC` the same part expose, and `window.__cpuDecideLog` (13e-host.js, v0.105.0 M6 step 1:
   one { s, kind, cpuK } entry per cpu-marked decision the web host answered, for the tests). Declared so `window.*`
   uses in the web parts type-check. */
interface Window { BS?: unknown; SC?: unknown; __cpuDecideLog?: { s: string; kind: string; cpuK: string | null }[] }
