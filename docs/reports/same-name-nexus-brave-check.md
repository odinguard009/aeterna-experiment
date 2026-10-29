# Same-name check: Nexus and Brave reprints

Read-only check; no card data was changed.

- Nexus: 20 same-name groups checked against the Fandom export. Level thresholds are keyed per wiki page (page-title hash), so an original and its RV reprint share one value. Not verifiable without card images.
- Brave: 7 groups with differing data. Combine condition and braved BP are keyed per page title, so they are shared too. Several reprints differ in cost or BP from the original (Sabershark, Reticle-Arms, Poppor, Chihyu, Oborogissha); the cause could not be proven from text sources.
- God icon: BS51-CP/RV, BS46-081 and BS71-RV005 differ from the source only by the god icon in the reduction. This is the intentional drop (`tools/import_fandom.py:75`, issue #5), not a data error.
- BS07-051: text differs from the source wording; looks like a deliberate rewrite, not checked further.
- Staged-only ids (e.g. BS51-CP03) live in `data/import`, not `data/cards`.

Open: confirm the Nexus/Brave values against card images when available.
