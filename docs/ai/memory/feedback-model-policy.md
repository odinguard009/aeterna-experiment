---
name: Model policy (DeepSeek V4.1 Flash + V4 Pro advisor)
description: Main sessions run deepseek-flash (V4.1-Flash-1017); heavy work asks the Pro advisor first
type: feedback
---
Owner order, 2026-10-31: main model **DeepSeek V4.1 Flash 1017** with **DeepSeek V4 Pro as advisor**.

- **Main session model:** `deepseek-flash` (the catalog model whose version is DeepSeek-V4.1-Flash-1017). Do not switch the main model mid-session.
- **Advisor:** `deepseek-v4-pro`, called through the DSH `advisor` tool. Use it when the work is heavy or the approach matters: engine, compiler, protocol, UI redesign, a replacement/priority-rule design, or before fixing an approach and before finishing a heavy session. The advisor gets a **fresh, empty context**, so give it a self-contained brief (goal, the 2-3 files/snippets that matter, constraints, the decision wanted) and ask for a decision or review — do not ask it to edit files.
- **Economy:** advisor tokens are Pro tokens. One well-scoped consultation per heavy decision, not per file edit. Light card-JSON bundles and docs stay on Flash.
- **Context compaction (DSH desktop, owner 2026-10-31):** the profile compacts automatically at **300,000 tokens**. The trigger is `floor(min(W × thresholdRatio, W − O − headroomTokens))` with `W = 1,048,576` (the routed deepseek-flash window, 2^20), `O = 256,000` (routed output cap) and headroom 65,536, so `W − O − headroom = 727,040` and the ratio binds: `thresholdRatio: 0.286102294921875` (= 300000/1048576) gives exactly 300,000; a plain `0.3` would give 314,572. `retainRatio: 0.16` keeps the newest 16% of `W − O` verbatim and `auto: true` keeps provider-overflow recovery. The profile patch is read when the Desktop app loads the profile, so an edited value applies from the next app start. A long session therefore gets a summary near 300k — keep decisions in files/memory instead of relying on chat history.
- **DSH wiring (this machine):** the DSH desktop profile patch outside this repo (under the user home, path shown in DSH settings) carries: `agent-default-model` = provider `deepseek-official`, model `deepseek-flash`; `tool-advisor` = `@deepseek-ai/dsh-tool-subagent`, provider `spawn`, `toolName: advisor`, `agentOptions.model: deepseek-v4-pro`, `maxDepth: 1`.
- **Supersedes** the old CLAUDE.md "Sonnet 5.5 with Opus 5.5 advisor" note for DSH sessions only; the end hint stays `next=Sonnet` because Claude sessions still run that way.
