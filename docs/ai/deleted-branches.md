# Branches to delete (restorable)

Branch housekeeping for this repo (keep the newest 3 `backup/v*` branches). The session proxy blocks branch deletion (git push --delete and the REST API), so listed branches are deleted on GitHub's Branches page; then remove the row here. Restore one with `git push origin <sha>:refs/heads/<name>`.

The rows from before 2026-10-17 belonged to the owner's private vault repo (its branches were not copied here).

| Branch | SHA |
|---|---|
| backup/v0.57.0 | 762524d81550712effd1bf4331b195a5fbe19075 |
| backup/v0.59.3 | afcfa1d2523024b1deb3209e3f0d865efcd7a4e0 |
| backup/v0.59.4 | 2ecdf4607d62172f25c28fc4d19cae87194ee1ab |
| backup/v0.60.0 | 4141e28b029c5b3897d9733dd8f2db1d6965c6ff |
| backup/v0.62.0 | 2cef565fec02d3bc4981ca9bed391c18f5fc1e7b |
| backup/v0.62.1 | 13fc3ae03b92adf6f6b7971d0bc46acde96ef70c |
| backup/v0.63.0 | 44abfea6b09ace960cb1848704ced4560c5174ca |
| backup/v0.64.0 | c27d6b8911b5a8f698f6c60a6c39b100e935d63f |
| backup/v0.66.0 | 17f3e9d15500658af802272e04dc81a948c029fb |

## Owner decision (2026-10-21): keep everything below
The owner decided to keep all `backup/v*` branches, `wip/v0.80.0`, `tooling/dev-tools` and the three old claude.ai account skills in case they are needed later. Sessions do not list them as owner steps any more; the list stays as a reference only.

## Reference list (2026-10-21, v0.96.0)
- Every `backup/v*` branch except the newest 3 (23 existed on 2026-10-21; list them with `gh api repos/odinguard009/aeterna-experiment/branches --paginate -q '.[].name' | grep '^backup/' | sort -V`).
- `wip/v0.80.0` (merged in v0.80.0).
- `tooling/dev-tools` (optional tool guide, unused).

Keep `experiment-omniroute` (PC labels without abbreviations) until the deferred layout work.

Also on claude.ai: delete the three old account skills `bs-card-image-reader`, `bs-effect-mechanic-adder`, `bs-playwright-tester` (named "BS Eternal"); the copies in `.claude/skills` are current.
