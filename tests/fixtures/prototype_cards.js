/* Test-only fixture cards (NOT part of the shipped game). Generic stand-ins used by older suites; written in the current effect format.
   Injected by tests/sitecustomize.py after every page.goto(). Safe to run twice. */
(() => {
  if (!window.BS || !BS.defBuiltin || BS.CARDS['TST-001']) return 1;
  const fx = a => BS.parseEffects(a).effects;
  const red = { symbol: 'red' };
  BS.defBuiltin({ id: 'TST-001', name: 'FlameLizard', symbol: 'red', cost: 1, reduction: { red: 1 }, levels: [{ cores: 1, bp: 3000 }, { cores: 3, bp: 5000 }],
    effects: fx([{ trigger: 'SUMMONED', lv: [1, 2], actions: [{ do: 'DRAW', n: 1 }] }]), desc: '[LV1-LV2] (When Summoned) Draw 1 card.' });
  BS.defBuiltin({ id: 'TST-N01', name: 'Volcanic Temple', type: 'Nexus', symbol: 'red', cost: 2, reduction: { red: 1 }, levels: [{ cores: 0 }, { cores: 2 }], desc: '[LV1] Red Nexus. Its red symbol is used for cost reduction.' });
  BS.defBuiltin({ id: 'TST-X01', name: 'Siegwurm Fixture', symbol: 'red', cost: 7, reduction: { red: 3 }, symbols: 2, levels: [{ cores: 1, bp: 6000 }, { cores: 3, bp: 10000 }, { cores: 5, bp: 18000 }],
    effects: fx([{ trigger: 'ATTACKS', lv: [1, 2, 3], actions: [{ do: 'DESTROY', bpLe: 5000 }] }]), desc: '[LV1-LV3] (When Attacks) Destroy 1 opposing Spirit with 5000 BP or less.' });
  BS.defBuiltin({ id: 'TST-CNT1', name: 'Counter Fixture', symbol: 'red', cost: 0, levels: [{ cores: 1, bp: 1000 }, { cores: 2, bp: 3000 }], keywords: ['CONTRACT'], contract: true,
    effects: fx([{ trigger: 'ATTACKS', lv: [1, 2], actions: [{ do: 'COUNTER', n: 1 }] }]), desc: '[Contract Spirit] (When Attacks) Count +1. If destroyed by the opponent, it enters Soul State.' });
  BS.defBuiltin({ id: 'TST-BST1', name: 'Flame Dragon Burst', symbol: 'red', cost: 4, reduction: { red: 2 }, levels: [{ cores: 1, bp: 4000 }, { cores: 3, bp: 7000 }], keywords: ['BURST'],
    burst: BS.parseBurst({ when: 'LIFE_DECREASE', actions: [{ do: 'DESTROY', bpLe: 7000 }] }).burst, desc: '[Burst: After Your Life Decreases] Destroy 1 opposing Spirit with 7000 BP or less.' });
  BS.defBuiltin({ id: 'TST-MIR1', name: 'Mirage Wisp', symbol: 'red', cost: 3, reduction: { red: 1 }, levels: [{ cores: 1, bp: 3000 }, { cores: 2, bp: 5000 }], keywords: ['MIRAGE'],
    mirage: { cost: 2 }, implemented: false, desc: '[Mirage: pay 2] Set face up in the Burst Area.' });
  const mg = (id, name, cost, red, kw, magic, desc) => BS.defBuiltin({ id, name, type: 'Magic', symbol: 'red', cost, reduction: { red }, levels: [{ cores: 0 }], keywords: kw, magic, desc });
  mg('TST-MG1', 'Test Fireburst', 3, 1, [], { timing: ['MAIN'], effect: 'DESTROY_BP_LE', value: 6000 }, '[Main] Destroy 1 opposing Spirit with 6000 BP or less.');
  mg('TST-MG2', 'Scorch Ward', 2, 1, ['FLASH'], { timing: ['FLASH'], effect: 'BP_PLUS', value: 5000 }, '[Flash] 1 of your Spirits gets +5000 BP until the end of the turn.');
  mg('TST-MG3', 'Sudden Strike', 4, 2, ['FLASH'], { timing: ['MAIN', 'FLASH'], effect: 'DESTROY_BP_LE', value: 5000 }, '[Main][Flash] Destroy 1 opposing Spirit with 5000 BP or less.');
  mg('TST-MG4', 'Ember Insight', 2, 1, [], { timing: ['MAIN'], effect: 'DRAW', value: 2 }, '[Main] Draw 2 cards.');
  mg('TST-MG5', 'Binding Flame', 2, 1, ['FLASH'], { timing: ['FLASH'], effect: 'EXHAUST_OPP', value: 0 }, '[Flash] Exhaust 1 opposing Spirit.');
  mg('TST-MG6', 'Banishing Light', 3, 1, [], { timing: ['MAIN'], effect: 'BANISH_BP_LE', value: 4000 }, '[Main] Banish 1 opposing Spirit with 4000 BP or less.');
  return 1;
})()
