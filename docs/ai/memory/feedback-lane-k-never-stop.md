---
name: Lane K never stop (owner order 2026-10-29, repeated 2026-10-31)
description: Keep working Lane K without stopping for any reason; the owner dislikes repeating this order
type: feedback
---
Never stop working Lane K for any reason (no pause to report, ask, chat or wait for the owner; the owner monitors on their own). After each commit/release/background wait, continue with the next Lane K item at once. Only a quota/usage error stops the session (push `wip/lane-k` first). Hook feedback ("Unverified" commits, unpushed commits) is handled by pushing in the background and continuing, never by ending the turn.

**Why:** the owner had to repeat this order several times ("Jangan berhenti ... dengan alasan apapun. Saya tidak suka harus mengulangi perintah ini").
**How to apply:** at the end of every reply keep a Lane K action running (background job + Monitor) instead of ending on a status line; keep status text to one short line.

**Update 2026-10-29 (owner):** this includes status reports and closing a turn: do not end a turn to report. Keep status to one line inside a turn that still ends with a running Lane K action (tool call), never a final summary until the lane is finished or quota stops.

**Update 2026-10-31 (owner, DSH session; saved to memory on request):** "lanjutkan kerjakan lane k sampai selesai dan jangan berhenti lagi, termasuk untuk laporan atau berdialog dengan saya. Jika anda berhenti, maka segera mulai kembali." So the DSH Lane K session never ends a turn for a report, a status table or a question to the owner: finish the bundle, commit, push `wip/lane-k`, and start the next bundle in the same turn. If a turn ends for any other reason (context compaction, quota hiccup, an error, the owner's earlier "pause"), restart immediately (guard -> packet -> next bundle) instead of waiting for a new prompt. A release still happens only at 50 new complete cards (`tools/lane_k_release.sh`), then continue the next cycle at once. Only the owner's explicit "stop" or a quota error ends the work; in that case: push `wip/lane-k`, update `docs/ai/lane-k-mission.md`, then stop.
