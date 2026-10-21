# SELENE tasks and handover

## Completed/source-verified

Current main `41f7b5e` includes the Apollo 15 explorer and detailed agent context.
Implemented features are documented in PROJECT.md, README.md and AGENTS.md; do
not duplicate their design/accuracy detail here. No open PRs were found at audit.

## Current authorised task

Unify assistant entry points, preserve legacy agent context, add project memory,
handover and suitable PR checks. The root test import/fixture correction is test-only;
production app, terrain, astronomy, navigation and mobile controls are unchanged.

## Outstanding validation defects/gaps

- Reproduced baseline: `node terrain.test.mjs` failed with ERR_MODULE_NOT_FOUND
  for a parent-directory terrain.js. The workflow branch corrects that import, loads the checked-in elevation fixtures and
  the four cases pass; review this test-only fix with the workflow PR.
- The README's broader tests/ and preparation scripts/ are absent. Restore them
  only from an authoritative source/archive in an approved follow-up; no 19-test
  or full browser result can be claimed from this checkout.
- Real-device/mobile/native-WebGPU acceptance remains outstanding in the recorded
  guidance. Current partial checks do not prove the entire flight/discovery flow.

## Suggested next actions (owner priority not established)

Review/merge the workflow PR, confirm loaded instructions in each assistant and
identify the authoritative missing test archive. Then agree restoration and
browser/device acceptance scope before further visual or terrain changes. These
recommendations are not new feature authorisation.

Use docs/AGENT-WORKFLOW.md to record task/acceptance criteria, pushed commit/branch,
PR, exact validation results, unavailable checks, risks and next action.
