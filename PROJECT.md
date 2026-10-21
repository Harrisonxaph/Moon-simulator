# SELENE — shared project context

Verified 2026-10-21 against main `41f7b5e`; no open PRs at audit. Read
[AGENTS.md](AGENTS.md) for preserved owner agreements and technical constraints,
[README.md](README.md) for operation and [CREDITS.md](CREDITS.md) for scientific
sources/licences. Those remain the detailed feature and realism record.

## Objective and current implementation

An accessible educational lunar explorer, built for the owner's nephew, with
mobile flight, Apollo 15 terrain and a calculated sky. The static root entry is
index.html/app.js; no application API key, backend, package.json or build step
exists. app.js uses the import map's CDN Three.js 0.185.0 WebGPU renderer, with
WebGL 2 fallback and `?renderer=webgl`. Vendored Three.js and older js/terrain
modules also exist: actual imports, not filename similarity, determine the active
application. Startup currently requires network access to the CDN.

Source inspection confirms elevation metadata/buffers and blended terrain in
terrain.js, worker-generated geometry, flight/control/quality/lifecycle logic in
app.js, astronomical transforms in sky.js/Astronomy Engine, and ordered waypoint/
discovery progression in navigation.js. Existing detailed/immersive views,
missions/map controls, local discoveries and saved preferences must remain intact.
Terrain, stars, educational simplifications and mobile workload limits are
specified in AGENTS.md, README and CREDITS; do not replace them with decorative
approximations or overstate their accuracy.

## Deployment and limits

README documents static serving (`python -m http.server 8000`), HTTPS/localhost
for WebGPU and Vercel/GitHub Pages compatibility. The historical public URL is
https://moonsimulator.vercel.app/; live account/deployment/v0 wiring is not verified
by this task. There is no configured production deployment workflow in the tree.
Physical Safari/Android, thermal/battery and native WebGPU behaviour remain
unverified for future edits. The owner's past report of good device performance
is useful context, not a fresh benchmark.

## Verification gap and workflow task

README/legacy agent guidance refers to tests/ and scripts/ source-archive files
not present in audited main. Do not run imaginary commands or claim the historical
19-case/full-browser suite passed here. Root terrain.test.mjs exists, but initially
failed because its `../terrain.js` import pointed outside the repository. This
workflow branch corrects the test import to `./terrain.js` and initialises the checked-in elevation fixtures through the same configuration functions used by app.js; production
application/data files remain byte-unchanged. Its four deterministic geometry/
collision cases pass locally and are partial coverage, not full lunar dataset,
astronomy, educational progression or browser acceptance testing.

This PR adds source syntax/runtime-file/JSON checks and documentation validation,
plus the corrected existing test. Shared adapters import authoritative AGENTS.md;
TASKS.md records gaps, DECISIONS.md records evidence-backed workflow choices. No
feature expansion, production release or external service change is authorised.
