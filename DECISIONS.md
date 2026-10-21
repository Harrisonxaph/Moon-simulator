# SELENE decisions

The detailed existing owner agreements and scientific limits were preserved from
agent.md into AGENTS.md. README.md and CREDITS.md remain the source of recorded
terrain/astronomy rationale. Historic dates/alternatives are not reconstructed.

## 2026-10-21 — one authoritative instruction source

- Decision: migrate the complete detailed agent.md guidance into AGENTS.md;
  replace agent.md with a one-way redirect and add thin assistant adapters.
- Reason: existing AGENTS.md delegated to agent.md. Simply adding a reverse
  redirect would create a circular/ambiguous hierarchy. Owner requested AGENTS.md
  as the preferred entry point without losing existing instructions.
- Affected: shared instructions and compatibility files; runtime unaffected.
- Alternative rejected: leaving two independently editable full copies.

## 2026-10-21 — partial, honest CI with a test-path correction

- Decision: correct the root test's import to the adjacent terrain.js, initialise the checked-in elevation fixtures as app.js boot does, and run its four
  existing cases, syntax-check current JavaScript, parse runtime JSON and check
  required runtime files; validate shared docs. Do not invent an absent full suite.
- Evidence: baseline ERR_MODULE_NOT_FOUND resolved to parent `/workspace/terrain.js`;
  runtime app.js correctly imports `./terrain.js`. After the import fix, the test exposed missing elevation initialisation.
  Loading the existing datasets via configureTerrain/configureDetail makes
  the test runnable without application changes.
- Reason: provide meaningful PR checks within authorised workflow scope.
- Affected: terrain.test.mjs setup and `.github/` workflow/checkers only.
- Broader browser/archive restoration is a follow-up, not performed or approved
  as a feature change here. Hosted CI is unverified until a run is observed.
