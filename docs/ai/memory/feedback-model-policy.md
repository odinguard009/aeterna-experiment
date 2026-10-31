---
name: Model policy (DeepSeek V4.1 Flash + V4 Pro advisor)
description: Main sessions run deepseek-flash (V4.1-Flash-1017); heavy work asks the Pro advisor first
type: feedback
---
Owner order, 2026-10-31: main model **DeepSeek V4.1 Flash 1017** with **DeepSeek V4 Pro as advisor**.

- **Main session model:** `deepseek-flash` (the catalog model whose version is DeepSeek-V4.1-Flash-1017). Do not switch the main model mid-session.
- **Advisor:** `deepseek-v4-pro`, called through the DSH `advisor` tool. Use it when the work is heavy or the approach matters: engine, compiler, protocol, UI redesign, a replacement/priority-rule design, or before fixing an approach and before finishing a heavy session. The advisor gets a **fresh, empty context**, so give it a self-contained brief (goal, the 2-3 files/snippets that matter, constraints, the decision wanted) and ask for a decision or review — do not ask it to edit files.
- **Economy:** advisor tokens are Pro tokens. One well-scoped consultation per heavy decision, not per file edit. Light card-JSON bundles and docs stay on Flash.
- **Context compaction (DSH desktop, owner 2026-10-31):** the profile compacts automatically at **300,000 tokens** (`compaction-basic`: thresholdRatio 0.3 of the 1M window with the default 65,536 headroom; newest 16% kept verbatim; `auto: true` keeps provider-overflow recovery). A long session therefore gets a summary near 300k — keep decisions in files/memory instead of relying on chat history.
- **DSH wiring (this machine):** the DSH desktop profile patch outside this repo (under the user home, path shown in DSH settings) carries: `agent-default-model` = provider `deepseek-official`, model `deepseek-flash`; `tool-advisor` = `@deepseek-ai/dsh-tool-subagent`, provider `spawn`, `toolName: advisor`, `agentOptions.model: deepseek-v4-pro`, `maxDepth: 1`.
- **Supersedes** the old CLAUDE.md "Sonnet 5.5 with Opus 5.5 advisor" note for DSH sessions only; the end hint stays `next=Sonnet` because Claude sessions still run that way.
