# Owner instructions (record, kept in the repo by the owner's request of 2026-10-16)

Copy of the claude.ai Project instructions of "Aeterna" and of the owner's auto-mode request, in the owner's words (Indonesian). The working rules derived from them are CLAUDE.md, skill `bs-session-runner` and `docs/ai/next-session-prompt.md`; when this record and those files differ, those files win and this record is updated.

## Current Project instructions (claude.ai Project, moved to the owner's second Claude account 2026-10-20)
Work moved to the second Claude account on 2026-10-20; the repo, the issue #1 switch and all working rules stayed in this repo. Description: "Game bisa dimainkan offline atau online. Semua kartu bisa dimainkan. Semua rule BS TCG diterapkan secara benar."
1. Pakai repo odinguard009/aeterna-experiment dan roadmap terbaru; ikuti skill bs-session-runner (alur, ukuran sesi, backup, mind map).
2. Awal sesi "lanjutkan roadmap": tulis "Ver. X.XX" dan "gunakan model …" sesuai ukuran sesi.
3. Hemat token tanpa menurunkan hasil; pertahankan proses yang teruji. Beri saran efisiensi kapan saja.
4. Backup setiap 5 versi rilis. Kirim file game setiap sesi; mind map HTML setiap 3 rilis.
5. Sumber data/aturan, berurutan: ekspor Fandom (data/sources, data/import) → manual resmi → Fandom Wiki → situs lain. Pembanding UI/perilaku: aegis-digi.online dan Battle Spirits Crossover.
6. Otonom: pilih opsi paling stabil/aman tanpa bertanya, setujui prompt izin otomatis. Berhenti hanya untuk keputusan yang tidak bisa dibatalkan.
7. Izin tetap: github.com, repo odinguard009/aeterna-experiment, battlespirits.fandom.com, situs resmi BS, dan perangkat terhubung (browser, komputer). Jadwal yang dibuat/diubah langsung disimpan.
8. Jika WebFetch/WebSearch gagal: langsung pakai browser (bawaan → desktop lokal → Chrome).
9. Jika akses GitHub gagal: ulangi hingga 10x (jeda ~30 dtk), lalu beri tahu satu kalimat dan coba lagi setelah saya menjawab.
10. Model: pilih Sonnet/Opus sesuai tingkat kesulitan, termasuk untuk subagent.

Style preferences (user preferences, always): "Selalu jujur. Jangan berbohong, jangan berhalusinasi, dan jangan mengarang cerita/jawaban. kurangi pujian-pujian yang tidak perlu."

Notes: instruction 9 (GitHub retry up to 10x, ~30 s apart) is not yet in CLAUDE.md or the session skill; the scheduled prompt and the gate scripts do not retry either. Instruction 10 restores the Sonnet/Opus choice by difficulty that the 2026-10-17 "Model" entry below had set aside; CLAUDE.md "Model" (2026-10-20) is the working rule. Optional wording the owner may adopt for instruction 10 (not applied here): "Model: Sonnet untuk docs/cleanup dan bundel kartu yang hanya menulis JSON efek; Opus untuk engine, protokol, compiler. Tanpa subagent kecuali player-view pass (read-only)."

## Earlier Project instructions (claude.ai, until 2026-10-20; superseded, kept as a record)
1. Pakai roadmap terbaru di repo odinguard009/aeterna-experiment. Ikuti skill bs-session-runner untuk alur sesi, ukuran sesi, backup, dan mind map.
2. Di awal sesi "lanjutkan roadmap": tulis "Ver. X.XX" (versi yang direncanakan atau dihasilkan) dan rekomendasikan model dengan format "gunakan model …" sesuai ukuran sesi.
3. Hemat token tanpa mengorbankan hasil. Pertahankan proses yang sudah teruji.
4. Sampaikan saran efisiensi atau improvement kapan saja, termasuk di tengah sesi.
5. Buat backup setiap 5 versi rilis.
6. Sumber utama aturan, format, mekanik, dan data kartu: data ekspor Fandom di data/sources dan data/impor di reppo, manual resmi Battle Spirits, dan Battle Spirits Fandom Wiki. Kalau tidak bisa diakses, pakai situs lain atau data lokal. Pembanding UI dan perilaku game: aegis-digi.online (web dan repo GitHub) dan game Battle Spirits Connected Battler.
7. Saat ada pilihan teknis, pilih opsi paling stabil atau aman tanpa bertanya.
8. Kirim mind map roadmap (HTML) setiap akhir sesi.
9. Pemilihan model: pilih Sonnet, Opus, atau model lain secara otomatis sesuai tingkat kesulitan task, dengan tetap mempertimbangkan penggunaan token. Ini berlaku juga untuk subagent.
10. Always allow, situs: selalu izinkan dan masukkan ke allowlist sesi semua halaman dari github.com, battlespirits.fandom.com, situs resmi Battle Spirits, dan semua situs lain yang dipakai dalam sesi proyek ini.
11. Always allow, persetujuan: jika muncul permintaan persetujuan atau pilihan, pilih opsi paling stabil atau aman, setujui otomatis, dan masukkan ke allowlist sesi. Berlaku untuk semua sesi di proyek ini.
12. Always allow, perangkat: jika ada perangkat terhubung (browser, komputer, dan lainnya) yang dibutuhkan proyek, langsung gunakan tanpa menunggu izin.
13. Browser otomatis: jika WebFetch atau WebSearch gagal (halaman tidak bisa dirender, butuh login, butuh klik atau isi form, atau perlu uji game secara visual), langsung gunakan browser tanpa bertanya. Prioritas: browser bawaan aplikasi Claude, lalu Claude in Chrome. Berlaku untuk Battle Spirits Fandom, situs resmi Battle Spirits, aegis-digi.online, GitHub, dan uji index.html Aeterna.
14. Jadwal: semua jadwal atau perubahan jadwal yang dibuat Claude dianggap disetujui dan langsung disimpan.
15. Nama sesi: beri nama sesi "lanjutkan roadmap" sesuai nomor versi, misalnya "Ver. 0.40".

## Auto mode request (2026-10-16)
1. Setelah sesi terakhir selesai dan file versi terakhir dikirim, jika dalam 30 menit tidak ada perintah "lanjutkan roadmap", Claude melanjutkan roadmap sendiri secara otomatis.
2. Setelah sesi otomatis terakhir selesai dan file versi terakhir dikirim, jika dalam 30 menit tidak ada respon apa pun, lanjutkan kembali pengerjaan roadmap.
3. Pengerjaan otomatis selalu memakai mode auto; model Claude sesuai beratnya item roadmap.
4. Mode otomatis harus mudah di-on/off-kan.
5. Semua data dan instruksi disimpan di repo.

Implementation and its limits (scheduled runs cannot see chats; the real delay is 20 minutes (owner, 2026-10-17; was 30) plus up to one schedule interval; no per-run model setting): `docs/ai/next-session-prompt.md`.

## Deck builder (2026-10-16, chat)

"Saya ingin juga anda memikirkan UI dan UX untuk deck builder. Saya ingin UI yang user friendly, fungsional, namun tetap stylish waktu digunakan untuk versi PC atau HP. Rencanakan pekerjaan ini di roadmap dan sesi berikutnya."

Plan: archived in `docs/ai/roadmap-archive.md` (next session, before the batch promotion).

## Details (2026-10-16, chat)

"Selalu perhatikan detail. Walau sekecil apa pun."

## Model (2026-10-17, chat)

"mulai sekarang, saya akan menggunakan Opus karena saya merasa saya lebih yakin menggunakan itu."

Applied: Opus for every manual and auto session and for subagents; the gate treats every `next=` as Opus; the Sonnet scheduled task is disabled (not deleted). Earlier Project instruction 9 (automatic Sonnet/Opus choice) was superseded by this; the current Project instruction 10 brings the choice by difficulty back (Opus for engine work, Sonnet for docs and JSON-only card bundles, per CLAUDE.md "Model").

## Monorepo (2026-10-17, chat)

"saya rasa ini perlu untuk ditiru juga karena saya juga ingin membuat aeterna menjadi seperti itu" / "ya, saya ingin repo kita bisa menjadi lebih rapi dan lebih baik dari aegis". Answers: online + offline; no server hosting yet; migration step by step, alternating with card sessions. Plan: `docs/ai/monorepo-plan.md`.

## Repo cleanup (2026-10-17, chat)

"oke, rencanakan untuk merapikan repo aeterna." Plan: archived in `docs/ai/roadmap-archive.md`.

## Roadmap order and Thai UI (2026-10-17, chat)

"oke, atur ulang kembali rencana roadmap. lalu untuk UI berbahasa Indonesia saya rasa tidak perlu, malah saya ingin ada UI berbahasa Thailand". Applied: "Session order" in `docs/ai/roadmap-open.md`.

"rencana bahasa UI: 1. Inggris, 2. Jepang, 3. Thailand, 4. China, dan seterusnya mengikuti pasar populer Battle Spirits" (2026-10-17). Applied: roadmap-open.md "Session order" item 9.

## Front page and releases (2026-10-17, chat)

"Saya melihat halaman repo github Aeterna terlalu panjang dan semrawut. Buat halaman seperti halaman repo github Aegis yang terlihat rapi dan terstruktur. Coba cari tempat lain untuk menulis hasil update dari setiap versi Aeterna, Misal di halaman release. Masukan rencana ke update berikutnya." Plan: `docs/ai/repo-cleanup-plan.md` "C5", roadmap-open "Session order" item 2b.

## Team session in one chat (2026-10-19, chat)

"Bagaimana jika aturan dirombak sehingga bisa menjalankan semuanya dalam 1 sesi? Misal main hanya untuk engine, agent 1 card, agent 2 ui, agent 3 saya lupa" / "Saya ada bonus token dan bisa dipakai boros. Tidak apa tidak hemat. Sebelum memulai, cek apakah ada dari proses roadmap dan rencana sesi kita yang bisa dibuat agent lagi?" / "ya, ubah aturannya. Q3 ikut." Applied: main keeps engine + the card head (a separate card agent would edit the same engine files); agents A1 UI (`lane/ui` worktree), A2/A3 card prep, A4 mechanic check + deck data, A5 Q3 (`lane/q3` worktree), A6 player-view every session, A7 reviewer, A8 Regression watcher. CLAUDE.md "Team session", skill `bs-session-runner` step 8, `docs/ai/lanes/README.md`, `tools/lane_merge.sh --local`.

## Mode hemat ON / OFF (2026-10-19 12:27, chat)

"setelah saya cek satu sesi memakai banyak agent terlalu mahal dan boros token. Saya ingin ada penggunaan dua mode, mode HEMAT ON dan mode HEMAT OFF. untuk mode HEMAT ON gunakan pengaturan seperti versi sebelumnya (versi sebelum 0.68) dan HEMAT OFF gunakan pengaturan seperti ver 0.68. buat switch ini bisa diaktifkan seperti mode otomatis dan cek setiap akhir sesi." / "buat mode hemat on sebagai default". Applied: `session_gate.sh hemat on|off|status` (comments `HEMAT ON|OFF` on issue #1, none = ON), chat commands `hemat on` / `hemat off` / `hemat status`; CLAUDE.md "Mode hemat"; skill `bs-session-runner` step 8 (read at start, decides team or not) and End step 6 (`Mode hemat: ON|OFF` in the final summary); the team session (v0.68) runs only with HEMAT OFF.

## Foundation first, one session, no agents (2026-10-20 17:00-17:08, chat)

"saya ingin anda mengevaluasi semuanya. dan usahakan saran dan pengaturan yang menghasilkan hasil paling baik, menghemat paling banyak token, dan mempersingkat waktu. saya juga ada pikiran untuk menyelesaikan infrastruktur dan ui dulu sebelum nanti memprogram kartu karena ada pikiran kalau sistem tidak stabil maka kartu hanya akan menggoyahkan sistem." / (on the session size limit) "tidak perlu disertakan. saya takut jika diberi batasan maka bisa mengganggu sesi coding" / "Saya setuju. Jadwal otomatis buat menjadi 2 kali per jam"

Agreed plan: phase F (effect schema + validator, host port M2/M3, replays M4, test waits Q2) before more card bundles; UI U5-U8 after the card rate is steady; no subagents except the read-only player-view pass; Mode hemat and team sessions retired; push after every commit; long runs on GitHub Actions; Opus for engine work, Sonnet for docs and JSON-only card bundles; no per-session size limit; auto runs at :00 and :30.

## Lane order 2 : 1 (2026-10-20, chat)

"Saya ingin pengerjaan roadmap menjadi 1 kali lane kartu setelah itu 1 kali lane ui atau infra. Bagaimana menurutmu?" / (after the proposal: F first, ratio can be tuned, UI only with an approved design, no idle lane) "Oke saya setuju, lakukan rasio 2 kartu : 1 UI/infra, dan rencanakan sisanya." Applied: item L in `docs/ai/roadmap-open.md` (cycle K, K, U/I after phase F, queue, fallbacks), `tools/lane_next.mjs` + `- Lane:` CHANGELOG bullet, `session_start.sh` prints the lane, CLAUDE.md "Lane order", skill `bs-session-runner` step 4, `docs/ai/next-session-prompt.md` "Rules for sessions".

## Chain mode / mode rantai (2026-10-20, chat)

"Bisakah jika satu sesi hanya menghabiskan kurang dari 300k token sesi tersebut otomatis jalan ke sesi berikutnya sampai mencapai 500k token?" / "Rubah batas menjadi 600k token. Buat sesi tak akan berhenti dan terus menjalankan sesi berikutnya sampai mencapai 600k. Saya ingin mode ini bisa di on/off via chat, namakan saja mode rantai. Dan jika ada satu sesi berjalan menggunakan lebih dari 600k maka langsung matikan mode untuk sesi selanjutnya." / "Sama seperti pengaturan otomatis. Buat pada akhir sesi ada info status mode rantai". Applied in v0.81.1: `session_gate.sh rantai on|off|status|next` (comments `RANTAI ON|OFF` on issue #1, none = OFF; `done ... tokens=N [rantai]`), chat commands `rantai on` / `rantai off` / `rantai status`, Actions workflow "Auto mode" options `rantai-on` / `rantai-off`; CLAUDE.md "Chain mode", skill `bs-session-runner` End steps 5-6, `docs/ai/next-session-prompt.md` "Chain mode"; final summary line `Mode rantai: ...`.

## Lane order: S1 Standard, U/I first, languages deferred (2026-10-21, chat)

"Saya rasa L1b lebih baik kita tunda dulu. Kita prioritaskan yang lain" / "Seluruh lane L kita tunda dulu. Prioritaskan bahasa Inggris" / "Oke, kita rubah rasio menjadi 2 kali U/I dan 1 kali K dengan prioritas menyelesaikan format standard terlebih dahulu agar game playable. Susun rencananya" / (after the note that cards would grow in only 6 of the first ~17 sessions) "Jika kartu complete hanya naik di 6 sesi K selama sekitar 17 sesi pertama, apakah sebaiknya tidak menyelesaikan lane U/I dulu baru fokus ke K?" / (after the proposal: phase F, then S1 = the 58 Standard Magic cards not yet playable, then the whole U/I queue, then cards with Standard first) "Oke atur seperti itu. Saya serahkan detail kepada anda". Applied: item L in `docs/ai/roadmap-open.md` (order, S1, U/I queue line, K queue Standard first, L1 deferred), `tools/lane_next.mjs` + `tests/unit/lane803.test.mjs`, `python3 tools/pack_plan.py --block A` -> `docs/reports/pack-plan-standard.md`, CLAUDE.md "Lane order" and Next, `docs/ai/next-session-prompt.md`.

## UI details, field lock, light animations (2026-10-21, chat)

"Saya ingatkan lagi untuk UI, pikirkan juga perintilan seperti design pop up window, design tombol di bagian card detail, dan lain-lain, sesuaikan dengan design tema yang sudah kita buat di mock up. Lalu terakhir kemarin saya mencoba main, lebar field masih sering berubah tergantung posisi kartu, saat kartu vertikal field melebar, saat kartu horizontal field mengecil, saya ingin anda perbaiki itu agar terkunci. Pikirkan juga menambahkan animasi kecil yang tidak memberatkan seperti tanda panah saat menyerang, core pecah saat life berkurang, dan lain-lain agar UX lebih bagus." Applied: item X1 (field lock, first task of the next session) and item U "Details and animations" (mockup style for every popup and the card detail buttons; U5b light animations in the U/I queue) in `docs/ai/roadmap-open.md`.

## Time efficiency (2026-10-21, chat)
- The owner asked why v0.89.0 took so long (about 69 minutes from the v0.88.0 release to the v0.89.0 release for 9 cards) and whether it can be made faster. Suggestions given: mechanic sessions separate from card sessions, group cards by shared mechanic, rank by cards unlocked, write docs while CI runs, add a time line per release.
- Owner: "oke, saya menerima saran anda asal tidak ada kompromi pada hasil". Recorded as item T in `docs/ai/roadmap-open.md` (rules live there).

## Roadmap audit fixes, layout deferred (2026-10-21, chat)
- After a full audit of the non-card roadmap and a UI audit: "tunda dulu masalah layout, sarankan penyelesaian masalah dari hasil full audit dulu" / (after the proposal) "oke masukan semua rencana perbaikan itu". Applied: U/I queue `docs cleanup, format default, Standard decks, Standard rules, U8a, Q3 + Q4, M5, CPU benchmark, M6, M7, M8, card images`, the "Audit fixes" and "Deferred UI" notes under item L in `docs/ai/roadmap-open.md`, and the M6-M8 additions in `docs/ai/monorepo-plan.md`.
- Earlier the same day: "majukan format default dan Standard decks" (applied in bad8a65); the owner finds the battle animations not impressive enough and wants the CrossOver style, phone popups that rise from the bottom to the centre within thumb reach, and bigger PC elements; all of that is in "Deferred UI" until the owner lifts it (mockup `claude/layout-proposal.html` in the owner's Project).
- Same day, later: "fitur key spirit tetap masukan. satu kartu key spirit per deck" (the owner picks one Key Spirit per deck that is more likely to be drawn until it is in the Hand or on the Field). Applied: "Key Spirit" in the U/I queue after the CPU benchmark (item L, "Audit fixes" notes).
- Same day, after a repo audit (junk files, dead code, naming, docs, branches): "oke lakukan semua saran. jika bisa gabungkan di sesi berikutnya" (parallel-lanes tooling may be removed). Applied: "repo cleanup" replaces "docs cleanup" at the front of the U/I queue (parts A-D, Opus) in item L.
