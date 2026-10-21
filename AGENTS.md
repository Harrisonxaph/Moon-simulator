# SELENE Moon Simulator — shared agent instructions

This file preserves project context and working agreements from the development conversation through 2026-10-21. Read it alongside README.md and CREDITS.md. Current code and fresh verification take precedence over historical descriptions.

## Purpose and priorities

The owner is a beginner building a realistic, accessible lunar exploration simulator for his nephew. Explain changes in plain language and provide short progress updates during longer tasks.

Prioritise, in this order:
1. Reliable iPhone Safari and Android Chrome operation.
2. Smooth flight and responsive simultaneous touch controls.
3. Credible lunar terrain, lighting and astronomical positions.
4. Clear, enjoyable exploration and educational discoveries.

The owner has reported good performance on his device. Preserve that experience: measure the effect of more geometry, textures, shadows or interface layers rather than assuming a phone can afford them.

## Repository and delivery

- Repository: https://github.com/Harrisonxaph/Moon-simulator
- Default branch at the time of writing: main.
- Public deployment used in this conversation: https://moonsimulator.vercel.app/
- The owner also uses an existing v0 project and reported updating it through a pull request. Do not assume a GitHub change automatically updates every v0 preview or project. Check the actual connected repository, branch and deployment.
- Inspect the latest remote files before editing; do not overwrite newer user/v0 changes with an old conversation snapshot.
- Respect read-only requests. Keep work within the requested scope and distinguish local work, committed changes, and live deployments in reports.

## Architecture to preserve

This is a static HTML/JavaScript application; its current root entry point is index.html. It needs no application API key, backend or build step. Do not introduce a framework migration just because v0 is involved.

Primary files:
- index.html: welcome screen, responsive interface, import map and module loading.
- app.js: renderer, flight controls, lifecycle, streaming, sky display and interface state.
- terrain.js: elevation sampling, blended detail, tile/horizon geometry and collision sampling.
- terrain-worker.js: background terrain generation and transferable geometry buffers.
- navigation.js: waypoint coordinates, compass bearings, ordered discoveries and saved progress.
- landmark.js: simplified Falcon descent-stage reconstruction.
- sky.js: lunar orientation, observer frame and astronomical transforms.
- astronomy.js: vendored Astronomy Engine; retain its MIT license.
- apollo15.json / apollo15.f32: regional elevation metadata and binary samples.
- apollo15-detail.json / apollo15-detail.f32: local SLDEM2015 metadata and samples.
- stars.json: catalogue stars, including proper motions.
- earth.jpg: static Earth imagery.
- README.md / CREDITS.md: operating instructions, data sources, credits and accuracy limits.

The current repository also contains assets/, js/ and vendor/three/. Inspect the actual imports before changing, consolidating or deleting these folders. Do not assume every similarly named file is active.

Use an HTTP server for local development:
```sh
python -m http.server 8000
```
Open http://localhost:8000/. WebGPU requires HTTPS or localhost. Preserve automatic WebGL 2 fallback and the explicit ?renderer=webgl compatibility path. Check the current import map: external dependencies may still require internet access.

## Terrain and realism

- The landing-site origin is approximately 26.1322 degrees north, 3.6339 degrees east.
- Regional NASA/LRO/LOLA data is resampled at 500 m across a 128 km square.
- The local NASA/LRO/LOLA + JAXA/SELENE SLDEM2015 extract has about 59 m native sampling, resampled to 60 m over a 15.36 km square.
- Blend the local patch into the regional data over the outer 1.5 km. Keep rendering and collision heights consistent.
- The local tangent-plane heights include lunar curvature. Flight is bounded to the available extract, currently +/-50 km horizontally.
- Keep terrain generation off the UI thread, tile boundaries compatible, distant scenery coarse, and boulders fixed in world coordinates.
- Rocks, dust appearance and the Falcon model are illustrative. The descent stage is not a surveyed asset; the ascent stage is intentionally absent.
- Never describe source sampling as centimetre-scale accuracy or claim that decorative features are measured NASA geometry.
- Retain source attribution, licensing and scientific limitations in CREDITS.md when replacing or extending data.

Fresh flights begin about 42 m south of Falcon, 18 m above the nearby ground, facing the descent stage. BASE restores that starting view without erasing discoveries.

## Flight and mobile behaviour

Preserve:
- Joystick movement plus independent scene dragging for look.
- Simultaneous RISE/FALL input, pointer capture/cancellation and reliable release on focus loss.
- Desktop WASD, mouse drag, Q/E or Space for altitude, and Shift boost.
- Gradual acceleration, braking and boost transitions; assisted hover is the default.
- Optional simplified 1.62 m/s^2 lunar gravity, not a claim of full spacecraft dynamics.
- Ground clearance based on the rendered triangular surface.
- Background pause/resume, cleared held inputs, graphics recovery and phone safe-area spacing.
- Touch-device ECO defaults, capped pixel density, and a meaningful workload reduction relative to HIGH.

Avoid synchronous terrain rebuilds in the flight loop, unbounded scenery, large global-data downloads at runtime, and unnecessary per-frame allocations or DOM work.

## Sky and visual settings

The starting date is 1971-07-30 22:16 UTC, Apollo 15's landing, so the initial scene is sunlit. Preserve the UTC date selector, current-time option and the ability to aim at a celestial object.

Keep the real catalogue star positions and the calculated Sun, Earth and planetary positions. Do not replace them with randomly scattered stars or fixed decorative planets.

Enhanced star visibility is intentionally enabled by default because the owner found realistic daylight suppression too hard to see. Preserve:
- Brighter/larger points and a star brightness slider.
- A clear enhanced-visibility label.
- The option to disable enhanced daylight stars.
- Actual catalogue directions even when brightness is enhanced.

A previous textured star-glow effect failed in the WebGL compatibility view. Verify both backends before reintroducing such an effect.

Earth imagery is static, planet colours/brightness are illustrative, and the sky is an educational approximation. Historical regression checks compared selected bodies with JPL Horizons within 0.03 degrees at Apollo 15's landing epoch; this is not an accuracy guarantee for every date.

## Missions, navigation and discoverability

The owner previously could not find missions or points of interest. Keep direct, clearly labelled MISSIONS and MAP & PLACES controls. Do not bury mission start beneath map content or make a dropdown the only way to discover destinations.

There are three approximate educational waypoints:
- Falcon landing site.
- Hadley Rille overlook.
- Mons Hadley.

Preserve the compass, heading, distance, relative turn indication, destination cards, FACE WAYPOINT and TRACK GOAL. Waypoint labels are navigation aids; they do not certify an unobstructed line of sight or an exact historical EVA station.

The four discoveries are:
1. Meet Falcon.
2. Visit the Hadley Rille overlook.
3. Explore Mons Hadley.
4. Return to Falcon.

Arrival requires proximity and the mission's allowed altitude. Award stops in order, pause flight while reading a discovery card, and retain progress and unread facts across reloads. BASE does not reset discoveries; Restart Expedition does.

Progress is local to the browser/device, with a session-only fallback if storage is blocked. Keep the current localStorage keys or provide a migration:
- selene-apollo15-discoveries-v1
- selene-immersive

Historical facts must remain accurate: Apollo 15 was the first Apollo mission to use a lunar rover, not the first lunar mission of any kind to use a rover.

## Detailed and immersive views

- Detailed view exposes the standard controls, menus, readouts and navigation.
- HIDE MENUS switches to immersive view.
- On phones, immersive view leaves only the joystick, RISE, FALL and a small SHOW MENUS control visible.
- Hide the compass, statistics, menus, hints, labels and reticle in immersive view.
- SHOW MENUS must always remain discoverable and usable in portrait and landscape.
- Retain flight settings, boost and discovery progress when toggling. Close open settings/navigation panels.
- Remember the view preference where browser storage permits.
- Queue discovery facts reached in immersive view; show them when menus are restored.
- Keep the welcome screen and graphics recovery messages usable. Finish an open discovery card before changing modes.
- Desktop keyboard/mouse flight must continue to work.

## Verification and known repository limitations

Do not claim success from a file upload, a screenshot alone, a past conversation or a hidden element's CSS visibility. Verify the actual user flow and, for critical controls, their screen bounds.

For relevant changes check:
- Fresh startup, restart and the Falcon starting view.
- Touch movement, look and altitude controls together.
- Boost/braking, terrain crossings and ground clearance.
- Portrait, landscape and small-phone layouts; earlier checks used 390x844, 844x390 and 320x568.
- Actual visibility and reachability of MISSIONS, MAP & PLACES and START EXPEDITION.
- Waypoint selection, ordered arrivals, discovery cards, saving/reloading and storage failure.
- Immersive hide/show, touch flight, keyboard activation, saved preference and deferred discoveries.
- Background/resume, pointer cancellation and graphics recovery.
- Automatic renderer selection and forced WebGL 2; test native WebGPU where available.
- Browser errors and failed requests.

The development source archives described in README.md included 19 calculation/terrain/navigation tests and Playwright browser flows. At the time this document was added, the remote tree did not include those tests/ or scripts/ directories. A legacy root terrain.test.mjs exists; it is not the full suite and its paths must be checked before relying on it.

If a checkout actually contains the development suite, relevant commands are:
```sh
node tests/terrain.test.mjs
node tests/location.test.mjs
node tests/sky.test.mjs
node tests/navigation.test.mjs
node tests/detail.test.mjs
```
Browser scripts may include browser.cjs, expedition-browser.cjs, visibility-browser.cjs and immersive-browser.cjs under tests/. They require Playwright/browser setup; inspect the scripts before running. SELENE_TEST_URL selects a deployment. Some distant mission-arrival tests used test-only position shortcuts: do not present those as physical-device long-flight testing.

Confirm files exist before invoking these commands. If the suite is absent, report that limitation and restore it from an authoritative source or agree the needed test scope; do not invent passing CI results.

Historical browser checks passed on emulated phone layouts, and the owner reported good device performance. Neither establishes current iPhone/Android thermal, battery, Safari or native WebGPU behaviour after future changes.

## Publishing and handoff

The owner commonly uploads files through GitHub on an iPhone. When providing a manual release, keep required runtime files together in a simple folder and explain that its contents go into the repository root, replacing matching files. Uploading only index.html is insufficient.

The immersive release used 14 runtime files plus README.md and CREDITS.md (16 files). Recalculate this list if dependencies change; agent documentation is not a runtime dependency.

When checking a release, compare the GitHub files and the actual deployed assets, then test the live flow. Distinguish GitHub commits, Vercel production and v0 previews. Report exactly what was verified, what changed, and any remaining device/data limitations.


## Authoritative context and handover

AGENTS.md is now the authoritative shared instruction source; the detailed legacy
agent.md content above was preserved here. agent.md is a one-way compatibility
redirect. Confirm current code, README.md and CREDITS.md before trusting historical
results. Read [PROJECT.md](PROJECT.md), [TASKS.md](TASKS.md),
[DECISIONS.md](DECISIONS.md) and [docs/AGENT-WORKFLOW.md](docs/AGENT-WORKFLOW.md).
Follow the shared branch/status/open-PR/acceptance-criteria checks and completion
summary. Preserve unmerged work; never merge or deploy production automatically.
Commit and push before handing off the exact branch/commit/PR; uncommitted or
unsynchronised files are not available to another assistant. Never commit secrets
or private data. The root terrain.test.mjs import path and elevation fixture setup were corrected by the
workflow task; its four cases do not replace the absent development suite.
