# Soul Core icon audit (2026-11-01)

The Fandom export dropped every inline icon, so the English text of 839 cards lost a printed "(Soul Core)"
("besides , from", "without on it"). The official page (`data/sources/official-fields.json`, `textJp`, icon `{soulcore}`)
is the reference for where the icon is printed.

- Fixed (re-run on v0.204.1, 2026-11-02): `python3 tools/restore_soulcore.py --apply` put "(Soul Core)" back into `text` and
  `residual` (1,494 rows across `data/cards` and `data/import`), only where the gap count equals the missing icon count or the
  surrounding words identify the gap. `python3 tools/restore_soulcore_manual.py` then fixed 12 cards by hand (24 rows):
  non-breaking-space gaps and two-icon clauses (BS31-088, BS31-X04, BS32-071, BS32-X01, BS33-062, BS74-062 and the Reverse
  Contract Advent cards BS64-X01/X03, BS65-X02/X04, BS66-X05, BS67-X07). Both tools are idempotent; run them after every import.
- No text gap left to fill: 36 cards. 32 are Soul Magic Magic cards (the printed "use with only the Soul Core" reminder is the
  structured `soulMagic` field, rendered by the engine, never body text); 4 carry the icon inside a keyword cost header
  (BS64-039 Contract Advent, BS71-CX01 Contract Field, BS74-X13 Soul Realm, BS76-006 Manifest) that the EN text states as
  keyword words only. Nothing is lost for play; the dry run still lists them.
- Other dropped icons (colour symbols, `{pup}`, god, Ultimate) are not restored; `{pup}` 77, god 9, Ultimate 9, all 1 cards.
- Engine: "send a core, besides Soul Core" is already the default of the core-removal actions (`02n`, `02s`), and
  `noSoul` covers "without Soul Core on it". The text fix is display and audit data; no effect JSON changed.
- BP numbers in the effect text vs the official text: 12 cards differ (BS01-109, BS01-128, BS01-145, BS05-X19, BS06-093,
  BS06-104, BS14-X01, BS75-CX01/X01/X03, BS76-060/X01); Brave "+5000" lives in the official `braveBp` field, not in `textJp`,
  so the BS75/BS76 rows are expected. BS06-093 and BS06-104 are real BP differences (partial cards).

## Complete cards whose official text has a Soul Core icon (104; sentence with the icon | engine actions)

- 26RBS01-013 Thorel | 自分のトラッシュの {soulcore} 以外のコア合計3個までをそれらに置く。 | TRASH_CORES_TO
- 26RBS01-025 Dulla-Coshta | それの {soulcore} 以外のコア1個をリザーブに置く。 | SUMMON_HAND,OPP_CORES_TO_RESERVE
- 26RBS01-028 The MysticPurple Baphomendes | それの {soulcore} 以外のコア1個をリザーブに置く。 | OPP_CORES_TO_RESERVE,DRAW
- 26RBS01-039 Hammergrau | [Lv2]《真界放》『アタック時』 {soulcore} が置かれていない相手のスピリット1体を指定できる。 | EXHAUST_OPP
- 26RBS01-095 The High-Rise Tombs | それの {soulcore} 以外のコア1個をリザーブに置く。 | OPP_CORES_TO_RESERVE,DRAW
- 26RBS01-102 Rock Pit | 自分のトラッシュの {soulcore} 以外のコア1個をそれに置く。 | CANT_BE_BLOCKED_BY,TRASH_CORES_TO
- 26RBS01-111 Vermillion Roar | 《ソウルマジック：赤》 自分の赤シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RBS01-113 Awakening | 《ソウルマジック：紫》 自分の紫シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RBS01-116 Double Vortex | 《ソウルマジック：緑》 自分の緑シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RBS01-120 Punish Gate | 《ソウルマジック：白》 自分の白シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RBS01-122 Bolt Grid | 《ソウルマジック：黄》 自分の黄シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RBS01-123 Thunder Shutter | それの {soulcore} 以外のコア1個をライフに置く。 | 
- 26RBS01-124 Find Treasure | 《ソウルマジック：青》 自分の青シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RBS02-014 Blackshar | それの {soulcore} 以外のコア1個をリザーブに置く。 | OPP_CORES_TO_RESERVE
- 26RBS02-015 Cemerippet | それの {soulcore} 以外のコア1個をリザーブに置く。 | OPP_CORES_TO_RESERVE
- 26RBS02-019 Wyll-Gale | それの {soulcore} 以外のコア2個をリザーブに置く。 | OPP_CORES_TO_RESERVE
- 26RBS02-021 The UndyingSwordSlave Duskalon | それらの {soulcore} 以外のコア1個ずつをリザーブに置く。 | OPP_CORES_TO_RESERVE
- 26RBS02-057 The SedutiveDance Waltana | [Lv2]『アタック中』ターンの2回目以降のアタックなら、このスピリットは {soulcore} が置かれていない相手のスピリットからブロックされない。 | BP_MINUS,CANT_BE_BLOCKED_BY
- 26RBS02-074 War Phase: Overcast of Floating Crags | 自分のトラッシュの {soulcore} 以外のコア1個をそれに置く。 | BP_TARGET,TRASH_CORES_TO
- 26RBS02-076 War Phase: Barrier of Scale Dust | それの {soulcore} 以外のコア1個をリザーブに置く。 | MILL,OPP_CORES_TO_RESERVE
- 26RBS02-087 Flame Summoning | 《ソウルマジック：赤》 自分の赤シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RBS02-088 Unmask | 《ソウルマジック：紫》 自分の紫シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RBS02-089 Rapid Ripper | 《ソウルマジック：緑》 自分の緑シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RBS02-090 Rush Out | 《ソウルマジック：白》 自分の白シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RBS02-091 Portal Hack | 《ソウルマジック：黄》 自分の黄シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RBS03-002 Cloudrock | 自分のトラッシュの {soulcore} 以外のコア1個をそれに置く。 | END_BATTLE
- 26RBS03-005 Suscrofa | 自分のトラッシュの {soulcore} 以外のコア1個をそれに置く。 | BP_PLUS,TRASH_CORES_TO
- 26RBS03-011 Boggarl | それの {soulcore} 以外のコア2個をリザーブに置く。 | OPP_CORES_TO_RESERVE
- 26RBS03-016 The CurseLady Pienetta | それの {soulcore} 以外のコア1個をリザーブに置く。 | OPP_CORES_TO_RESERVE
- 26RBS03-018 The SnakePossessed Sthenon | それの {soulcore} 以外のコア1個をリザーブに置く。 | OPP_CORES_TO_RESERVE,DEPLOY_TRASH
- 26RBS03-019 The Hatredfiend Jackalpio | それの {soulcore} 以外のコア1個をリザーブに置く。 // それらの {soulcore} 以外のコア合計2個をリザーブに置く。 | OPP_CORES_TO_RESERVE,OPP_CORES_TO_RESERVE
- 26RBS03-020 The WaspArmor Menotera | それの {soulcore} 以外のコア1個をリザーブに置く。 | OPP_CORES_TO_RESERVE
- 26RBS03-023 The Unyielding Salisrola | それの {soulcore} 以外のコア2個をリザーブに置く。 | OPP_CORES_TO_RESERVE
- 26RBS03-038 The ExoticLithoid Dia-Mold | [Lv1-2]『アタック中』バトル終了時、このスピリットが回復状態で、自分のライフが2以下なら、自分のリザーブの {soulcore} 以外のコア1個をライフに置ける。 | RESERVE_TO_LIFE,BOUNCE_OPP
- 26RBS03-075 War Feat: Crushing of the Purple Moon | 自分のトラッシュの {soulcore} をそれに置く。 | DESTROY,SOUL_TRASH_TO
- 26RBS03-077 War Toll: Sundering of the Moon | それの {soulcore} 以外のコア1個をリザーブに置く。 | OPP_CORES_TO_RESERVE,OPP_CORES_TO_RESERVE
- 26RBS03-087 Flame Storm | 《ソウルマジック：赤》 自分の赤シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RBS03-088 Evil Hazard | [フラッシュ] {soulcore} が置かれている相手のスピリット1体を指定する。 | 
- 26RBS03-089 Grand Theft | 《ソウルマジック：紫》 自分の紫シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RBS03-091 Bubble Shield | 《ソウルマジック：緑》 自分の緑シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RBS03-094 Hallucination | 《ソウルマジック：白》 自分の白シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RBS03-096 Flash Run | 《ソウルマジック：黄》 自分の黄シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RBS03-097 Sharp Thorn | 《ソウルマジック：青》 自分の青シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RBS03-X01 The DeepRedBladessom Rittenia | [Lv2]《真界放》『自分のエンドステップ』自分のトラッシュの {soulcore} 以外のコア1個をこのスピリットに置ける。 | DESTROY,TRASH_CORES_TO
- 26RBS03-X03 The PurgatoryPhoenix Zekuga | [Lv1-2]【ソウル覚醒】『アタック時』自分のフィールド/トラッシュの {soulcore} を、このスピリットに置ける。 | SOUL_AWAKEN,LIFE_TO_RESERVE
- 26RBS03-X05 The TwilightEmpress Kuramagrama | それの {soulcore} 以外のコア1個をリザーブに置く。 | SUMMON_HAND,OPP_CORES_TO_RESERVE
- 26RBS03-X06 The SevenShogun Desperado | それの {soulcore} 以外のコアが1個になるようにリザーブに置く。 | CORES_ANY_TO_RESERVE,OPP_CORES_TO_RESERVE
- 26RCB01-002 Kamen Rider Gridon Donguri Arms | このスピリットの {soulcore} 以外のコア1個をそれに置き、このバトル中、それをBP+3000する。 | DESTROY,BP_TARGET
- 26RCB01-003 Kamen Rider Knuckle Kurumi Arms | このスピリットの {soulcore} 以外のコア1個をそれに置き、このバトル中、それをBP+3000する。 | BP_TARGET
- 26RCB01-004 Kamen Rider Ryugen Budou Arms | このスピリットの {soulcore} 以外のコア1個をそれに置き、このバトル中、それをBP+3000する。 | BP_TARGET
- 26RCB01-007 Kamen Rider Marika Peach Energy Arms | このスピリットの {soulcore} 以外のコア1個をそれに置き、このバトル中、それをBP+3000する。 // このスピリットの {soulcore} 以外のコア1個をそれに置き、このバトル中、それをBP+3000する。 | BP_TARGET,BP_TARGET
- 26RCB01-023 Kamen Rider Zeztz Plasma Booster | それの {soulcore} 以外のコア1個をリザーブに置く。 | OPP_CORES_TO_RESERVE,SHOW_RETURN,DESTROY
- 26RCB01-053 Kamen Rider Brave Legacy Gamer Level 100 | [Lv2]『アタック中』BP比べで相手のスピリットだけを破壊した時、自分のトラッシュの {soulcore} 以外のコア1個をライフに置ける。 | TREAT_LV2,TREAT_LV2,TRASH_CORES_TO
- 26RCB01-057 Sakura Hurricane | 自分のトラッシュの {soulcore} 以外のコア2個までをそれに置く。 | DRAW,TRASH_CORES_TO
- 26RCB01-062 Burai Kick | 《ソウルマジック：赤》 自分の赤シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RCB01-068 Sword Vent | 《ソウルマジック：白》 自分の白シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RCB01-071 Mighty Critical Strike | 《ソウルマジック：青》 自分の青シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RDB01-002 ［Star Rabbit Origin］Rabbey Darling | 【チーム：レッドステラ/シャイニーハーツ】 [Lv1-2]『召喚時』自分のスピリット/ネクサスすべてが【レッドステラ】を持つなら、自分のトラッシュの {soulcore} 以外のコア1個をこのスピリットに置く。 // 自分のトラッシュの {soulcore} 以外のコア1個をそれに置く。 | TRASH_CORES_TO,TRASH_CORES_TO,REFRESH_SPIRIT
- 26RDB01-012 ［Dragon Emperor Origin］Siegfreeda | [Lv2]『相手による破壊時』自分のスピリット/ネクサスすべてが【レッドステラ】を持つなら、自分のトラッシュの {soulcore} 以外のコア1個をライフに置く。 | CORE_GIVE_ANY,TRASH_CORES_TO
- 26RDB01-013 ［Burning Origin］Banri-Sora | 破壊したスピリット1体につき、自分のトラッシュの {soulcore} 以外のコア1個をこのスピリットに置く。 | DESTROY,TRASH_CORES_TO
- 26RDB01-021 ［Retsu Hero Origin］Seina Ryumin |  [Lv1-2]『召喚時』疲労状態の【グリーンウェーブ】を持つ自分のスピリットがいるなら、自分のトラッシュの {soulcore} 以外のコア2個までをこのスピリットに置く。 | TRASH_CORES_TO
- 26RDB01-038 ［Monkey Origin］Yellow-Merlin | 【チーム：ブルービート/レジェンドール】 [Lv1-2]『自分のアタックステップ』【ブルービート】を持つ自分のスピリットがアタックした時、自分のリザーブに {soulcore} があるなら、Lv1の相手のスピリット1体を指定できる。 | CANT_BLOCK_OPP
- 26RDB01-039 ［Tiger Origin］Riolu Tida | [Lv2]『アタック時』自分のリザーブに {soulcore} があるなら、自分のデッキの上から2枚をオープンできる。 | REVEAL_SUMMON
- 26RDB01-041 ［Boar Origin］Cahlamy Tiboar | [Lv2]『アタック時』自分のリザーブに {soulcore} があるなら、コスト3以下の相手のスピリット1体を指定する。 | REFRESH_SPIRIT,DESTROY
- 26RDB01-056 Sengoku Fire Dance | 《ソウルマジック：赤》 自分の赤シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RDB01-059 Deep Strike | 《ソウルマジック：緑》 自分の緑シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RDB01-061 Great Success | 自分のリザーブに {soulcore} があるなら、かわりに指定する対象を【ブルービート】を持つスピリットカード/ネクサスカードにする。 | 
- 26RDB01-062 Greed Shout | 《ソウルマジック：青》 自分の青シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RDB01-X06 ［Snake Origin］Tia Madoola | 【チーム：ブルービート】 [Lv1-2]『アタック時』自分のリザーブに {soulcore} があるなら、自分のデッキの上から3枚をオープンできる。 | REVEAL_DEPLOY
- 26RSD01-006 Cupell | [Lv1-2]『召喚時』自分のトラッシュの {soulcore} 以外のコア2個までをこのスピリットに置く。 // 自分のトラッシュの {soulcore} をそれに置く。 | TRASH_CORES_TO,SOUL_TRASH_TO
- 26RSD01-010 Utmost Depth: The Windfang Crag | 自分のトラッシュの {soulcore} 以外のコア1個をそれに置く。 | BP_TARGET,TRASH_CORES_TO,TRASH_CORES_TO
- 26RSD01-012 Break Claw | その後、疲労状態の自分の赤のスピリットがいるなら、自分のトラッシュの {soulcore} 以外のコア1個をリザーブに置く。 | 
- 26RSD01-014 Flame Hurricane | 《ソウルマジック：赤》 自分の赤シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RSD01-X01 The FlyingScarlet Rensis | 自分のトラッシュの {soulcore} 以外のコア2個までをそれに置く。 | DESTROY,TRASH_CORES_TO
- 26RSD02-001 Sclouse | それの {soulcore} 以外のコア1個をリザーブに置く。 | OPP_CORES_TO_RESERVE
- 26RSD02-004 Garsis | それの {soulcore} 以外のコア1個をリザーブに置く。 | OPP_CORES_TO_RESERVE
- 26RSD02-007 Lady Lamica | それの {soulcore} 以外のコア1個をリザーブに置く。 | OPP_CORES_TO_RESERVE
- 26RSD02-008 Ogrul | それの {soulcore} 以外のコア1個をリザーブに置く。 | OPP_CORES_TO_RESERVE
- 26RSD02-010 The Violet Witherlands | それの {soulcore} 以外のコア1個をリザーブに置く。 | OPP_CORES_TO_RESERVE,OPP_CORES_TO_RESERVE
- 26RSD02-014 Soul Bite | 《ソウルマジック：紫》 自分の紫シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RSD02-X01 The HeadNurse Nephila | それの {soulcore} 以外のコア1個をリザーブに置く。 | OPP_CORES_TO_RESERVE,OPP_CORES_TO_RESERVE
- 26RSD03-014 Tentacle Attack | 《ソウルマジック：緑》 自分の緑シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RSD04-014 Defensive Gate | 《ソウルマジック：白》 自分の白シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RSD05-014 Triple Thunder | 《ソウルマジック：黄》 自分の黄シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RSD06-013 Stem Lance | 《ソウルマジック：青》 自分の青シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RSD07-008 Kamen Rider Zeztz Esprim Barrier | それらの {soulcore} 以外のコア1個ずつをリザーブに置く。 | OPP_CORES_TO_RESERVE
- 26RSD07-010 Kamen Rider Zeztz Paradigm Wonder | それの {soulcore} 以外のコア1個をリザーブに置く。 | FORM_CHANGE,SHOW_RETURN,OPP_CORES_TO_RESERVE
- 26RSD07-011 CODE Zeroider | それの {soulcore} 以外のコア1個をリザーブに置く。 | OPP_CORES_TO_RESERVE
- 26RSD07-013 Catastrom Crusher | それの {soulcore} 以外のコア1個をリザーブに置く。 | 
- 26RSD07-014 Breakam Slash | 《ソウルマジック：紫》 自分の紫シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RSD07-X02 Kamen Rider Zeztz Orderm | それの {soulcore} 以外のコア1個をリザーブに置く。 | FORM_CHANGE,OPP_CORES_TO_RESERVE
- 26RSD08-002 ［Evil Sacred Origin］Chaori Pegasuros | [Lv2]『アタック中』このスピリットのアタックによって相手のライフを減らした時、自分のライフが2以下なら、自分のリザーブの {soulcore} 以外のコア1個をライフに置く。 | RETURN_TRASH,RESERVE_TO_LIFE
- 26RSD08-014 Shining Sword Song | 《ソウルマジック：黄》 自分の黄シンボルがあれば {soulcore} だけで使用できる。 | 
- 26RSD09-001 Lalyre | [Lv1-2] {soulcore} が置かれていないこのスピリットはアタックできない。 | 
- 26RSD09-007 The ThreeTreasures Cornix | 自分のトラッシュに {soulcore} があるなら、かわりに指定するBPを4000以下にする。 | RETURN_TRASH,DESTROY,DESTROY
- 26RSD09-009 The Silver-Clad Assipha | [Lv2]『アタック時』自分のトラッシュに {soulcore} があるなら、BP5000以下の相手のスピリット1体を指定する。 | DESTROY
- 26RSD09-010 The Floating Crag Link | [Lv2]『自分のアタックステップ』【起動：フラッシュ】自分の {soulcore} をトラッシュに置く▶自分のスピリット1体を指定する。 | BP_TARGET
- 26RSD09-X01 The HundredEyes Boreowl | 召喚コストの支払いに {soulcore} を使用していたなら、かわりに手札に加える枚数を2枚にする。 // [Lv2]『自分のアタックステップ』自分のトラッシュに {soulcore} があるなら、自分のスピリットすべてをBP+1000する。 | REVEAL_PICK
- BS31-029 The WindDemon Ninkouchou |  召喚コストに {soulcore} （ソウルコア）を使用していたら、さらに、ボイドからコア1個をこのスピリットに置く。 | EXHAUST_OPP,CORE_TO_SELF
- BS31-039 The CleverMachineDog Setadog | ［Lv1-Lv2］ このスピリットに {soulcore} （ソウルコア）が置かれている間、このスピリットをBP+5000する。 | 
- BS32-010 Soul Ogre | ［Lv1-Lv2-Lv3］『このスピリットの破壊時』 このスピリットに {soulcore} （ソウルコア）が置かれているとき、自分はデッキから1枚ドローする。 | DRAW
- BS32-021 The WindDemon Sasakunai |  召喚コストに {soulcore} （ソウルコア）を使用していたら、さらに、ボイドからコア1個を自分のリザーブに置く。 | BP_PLUS
- BS40-002 Euparlance | ［Lv1-Lv2-Lv3］ このスピリットに {soulcore} が置かれている間、このスピリットをBP+4000する。 | 
- BS76-006 Generator Yajdragon | ［フラッシュ］《顕現：「契約神ブラフマー」》『お互いのアタックステップ』 自分の {soulcore} をトラッシュに置くことで、対象から1コスト支払って手札から召喚する。 | COUNTER,DESTROY,COUNTER,DESTROY,SEND_TOKEN
