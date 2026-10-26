---
name: feedback-mockup-parity
description: "Owner wants the web game to look like docs/design/mockup-v14.html as closely as possible, screen by screen (not just the same ideas)"
metadata:
  node_type: memory
  type: feedback
  originSessionId: 1719d7ad-9361-4672-b568-48b0034ad13d
  modified: 2026-10-26T05:34:42.158Z
---

On 2026-10-26 the owner opened the web game and said many things differ from the v14 mockup ("saya ingin tampilan web benar-benar mirip dengan mock up"). The U14a-U15 releases (v0.121.0-v0.134.1) built the foundations and the features, but the page layouts are not 1:1 clones of the mockup.

**Why:** the owner approved the mockup as the target look; matching ideas is not enough.

**How to apply:** treat "mockup parity" as the next UI lane before more K sessions. Work screen by screen (lobby, play, my decks, deck builder, library, card page, battle, profile, settings, learn, dialogs; PC and phone). For each: screenshot the mockup (`go('<screen>')` in `docs/design/mockup-v14.html`) and the game at the same size, port the mockup's markup and CSS, and compare side by side until they match; keep every game function. Title Case text, not upper case. Release per batch ([[feedback-batch-releases]]). Card art in the mockup is drawn placeholders; the game uses real images (online mirror) or its own placeholder.
