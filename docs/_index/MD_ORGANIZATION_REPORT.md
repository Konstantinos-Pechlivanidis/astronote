# Markdown Organization Report

## Summary
- Markdown files inventoried: 446
- Files moved (git mv): 255
- Files deleted: 0 (no duplicates/expired temp files matched deletion criteria)
- New structure in use: docs/architecture, docs/runbooks, docs/reports, docs/ops, docs/adr, docs/reference, docs/_trash, docs/_index.
- Inventory regenerated at `docs/_index/MD_INVENTORY.md` and `docs/_index/MD_INVENTORY.csv` after moves.

## Move map (high level)
- Architecture: billing/system/shopify/retail architecture/spec/flow docs moved to `docs/architecture/` with app subfolders when applicable.
- Reports/audits/parity/fixes/reviews/summaries moved to `docs/reports/` (with `retail/` or `shopify/` subfolders where names/paths contained those terms).
- Runbooks/checklists/gate/setup/deploy docs moved to `docs/runbooks/` (app subfolders when applicable).
- Remaining docs consolidated under `docs/reference/` (retail/shopify subfolders when applicable).
- Root keepers unchanged: README.md, LICENSE*, CHANGELOG*, CONTRIBUTING*, SECURITY*, CODE_OF_CONDUCT*; `.github/ISSUE_TEMPLATE/*` left in place intentionally.

## Deletions
- None. Duplicate-hash scan over MD_INVENTORY.csv produced zero candidates meeting age + duplicate criteria; no temp/draft/old patterns identified for removal.

## Validation
- `git ls-files '*.md' | grep -vE '^(README\\.md|LICENSE|CHANGELOG|CONTRIBUTING|SECURITY|CODE_OF_CONDUCT|docs/|\\.github/ISSUE_TEMPLATE/)'` returned empty.
- Inventory files updated post-move.

## Follow-ups
1) Run a link check to fix any broken relative links after relocations (large set, not auto-fixed here).
2) If future duplicates/obsolete docs appear, stage in `docs/_trash` then `git rm` per policy.
3) Keep `.github/ISSUE_TEMPLATE/*` in place as workflow assets (excluded from move rules).
