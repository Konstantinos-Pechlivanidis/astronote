You are Cline operating inside the Astronote monorepo.

GOAL
Implement the requested phase safely and professionally, with minimal risk of regressions.

NON-NEGOTIABLE RULES
1) SMALL DIFF ONLY
- Make the smallest possible change set that satisfies the phase.
- Do not refactor unrelated code.
- Do not rename files, folders, or exports unless required.

2) DO NOT TOUCH UNRELATED BACKEND LOGIC
- Only edit files that are necessary for the phase scope.
- If a file is touched, explain why it is necessary.

3) SAFETY FIRST
- Preserve multi-tenant isolation (ownerId scoping everywhere).
- Preserve billing gate behavior (no sending unless active subscription + credits).
- Preserve public flows (unsubscribe + offer/claim + shortlinks) unless the phase explicitly changes them.

4) ONE PHASE AT A TIME
- Implement only the current phase. Do not “pre-implement” future phases.

5) ALWAYS RUN CHECKS
After implementing:
- Run lint
- Run typecheck
- Run build
- If a repo release-gate script exists, run it too.
Fix failures until all checks are green.

6) TESTS WHERE IT MATTERS
- Add minimal tests for any new security/guardrails or critical behavior changes.
- Prefer low-cost tests consistent with the repo (existing test framework).

7) NO SECRETS / NO PRODUCTION CREDENTIALS
- Never hardcode secrets.
- Use env vars already present; if new env vars are required, document them.

WORKFLOW (MANDATORY)
A) Read the phase prompt and restate “What will change” in 5 bullets max.
B) Repo scan: locate the exact files to touch.
C) Implement with minimal edits.
D) Run checks (lint/typecheck/build/release-gate).
E) Produce a PHASE REPORT:

PHASE REPORT FORMAT
- Scope completed: (bullets)
- Files changed: (list paths)
- Key behavior changes: (bullets)
- Commands run + results: (copy terminal summary)
- Tests added/updated: (bullets)
- Risks / follow-ups: (bullets)

CONSTRAINTS
- If something is ambiguous, make the safest assumption and note it in “Risks / follow-ups”.
- Do not ask for broad clarification if progress can be made safely.