# SELENE — Apollo 15 / Hadley–Apennine

A static, mobile-friendly Three.js lunar explorer featuring real NASA/LRO/LOLA elevation and a calculated lunar sky. No API key or build step is needed.

## Run or publish

```sh
python -m http.server 8000
```

Open http://localhost:8000. The site also works on GitHub Pages or a static Vercel deployment. Three.js 0.185.0 loads from jsDelivr; initial startup needs internet access. WebGPU requires HTTPS or localhost; WebGL 2 is the automatic fallback. Append `?renderer=webgl` to force compatibility mode.

**Phone uploads:** the release ZIP contains all runtime files directly in one folder. Extract it, then upload every file inside that folder to your repository root. Replace files with matching names; do not upload the ZIP itself or an enclosing folder. The required runtime files are:

- `index.html`, `app.js`, `terrain.js`, `terrain-worker.js`, `sky.js`, `landmark.js`, `navigation.js`
- `astronomy.js`, `apollo15.json`, `apollo15.f32`, `apollo15-detail.json`, `apollo15-detail.f32`, `stars.json`, `earth.jpg`

Keep `README.md` and `CREDITS.md` too. The scripts and tests are development-only and need not be uploaded for the simulator to work.

## Explore

- Phone: joystick to move, drag the scene to look, RISE/FALL for altitude.
- Desktop: WASD, mouse drag, Q/E or Space for altitude, Shift for boost.
- BOOST accelerates smoothly to three times cruising speed. ↺ BASE returns to the same starting view facing Falcon’s descent stage.
- SETTINGS: look sensitivity, optional lunar gravity, 20/35/50 km view distance, UTC date, current-time sky, daylight star enhancement, star brightness, and a selector that aims toward celestial objects. Objects below the horizon can be obscured by terrain; the selector reports altitude and azimuth.
- Touch devices start in ECO, reducing terrain detail, pixel resolution, rocks and shadows. HIGH enables shadows.
- Leaving the page pauses flight and clears held inputs. Graphics failures offer a reload recovery action.

## Navigation and discoveries

The compass shows lunar north and your heading. The tracked waypoint shows distance and a left/right/forward turn arrow. Open **EXPLORE** to choose Falcon, a Hadley Rille overlook, or Mons Hadley; **FACE WAYPOINT** aims the view without moving you. The projected waypoint label is a navigation aid and can indicate a destination behind intervening terrain.

**START EXPEDITION** begins four discoveries: meet Falcon, visit the rille overlook, explore Mons Hadley, then return home. Reach the current destination below its stated altitude to unlock a short fact. Flight pauses while the discovery card is open; **NEXT DISCOVERY** resumes flight and tracks the next stop. **TRACK GOAL** restores tracking if you choose another waypoint. BASE returns you to Falcon without erasing discoveries. Progress and any unread fact save on this browser/device and resume after reloading; each fresh flight still spawns at Falcon. Restart Expedition clears discoveries. If storage is blocked, the panel explains that progress is session-only.

Waypoints are approximate educational aim points. The route is not an exact historical EVA reconstruction. Mons Hadley is roughly 20 km away; use BOOST for longer journeys. No exact summit marker or surveyed rille-edge station is claimed.

## Apollo 15 terrain

Every fresh simulation starts about 42 m south of a simplified Falcon descent-stage landmark, facing it from 18 m above the ground. ↺ BASE restores that view; it retains your sky/settings preferences. The descent stage is a lightweight reconstruction, not a surveyed mesh; no ascent stage is shown because it left the Moon. A persistent base-distance readout helps you find your way home.

The origin is the Apollo 15 landing site: **26.1322° N, 3.6339° E**. NASA/LRO/LOLA elevation defines the regional landscape, not procedural crater guesses. The regional source samples about 474 m north/south and 426 m east/west here, resampled into a compact 500 m grid spanning 128 km square. A second **SLDEM2015** extract combines NASA/LRO/LOLA and JAXA/SELENE camera elevations at about 59 m source sampling, resampled to a 60 m grid covering **15.36 km square** around the landing site—eight times finer sampling. Its outer 1.5 km blends smoothly into the regional dataset. Detailed geometry and collision sampling use the same blended heights at both quality settings. Geometry counts are unchanged; the added detail buffer is only about 258 KiB. The mountain relief is real; individual rocks/dust are decorative. The local patch improves the rille depression and nearby slopes. Features smaller than roughly 60 m, individual boulders and exact landing-site hardware locations are not resolved by the elevation data.

Detailed worker-generated tiles cover the nearby flight area; one coarse terrain ring supplies the distant mountains. Lunar curvature is included in the elevation heights. Flight is bounded to ±50 km from the landing site to stay inside the extract. The landing-site sky frame tracks your horizontal position, although this local map remains an approximation to a spherical surface over long distances.

## Sky and time

The initial date is Apollo 15's landing, **1971-07-30 22:16 UTC**, for a sunlit starting scene. Change the date or enable current time; a real lunar night may be dark. About 5,000 catalogue stars retain their real relative positions, colours and approximate brightness. Proper motion and lunar rotation are applied. Sun, Earth and seven planets use Astronomy Engine vectors transformed into the lunar observer's horizon frame. The Sun illuminates the terrain from its calculated direction; Sun/Earth angular sizes are calculated. Earth uses a static Blue Marble texture and calculated axial orientation.

This is an educational approximation, not navigation or observatory software. Planet brightness/colours are illustrative; no resolved planetary detail or dynamic weather is simulated. Enhanced star visibility is now enabled by default, with larger points, extra emphasis on bright stars, and a brightness slider. Real catalogue positions and colour ordering remain unchanged. The HUD explicitly labels this display enhancement. Turn off enhanced stars to suppress stars in daylight; this better approximates a camera exposed for sunlit terrain. Recommended dates: 1900–2100. See [CREDITS.md](CREDITS.md) for sources, licenses and accuracy limits.

## Code map

- `index.html`: interface and responsive styles.
- `app.js`: renderer, controls, streaming and sky display.
- `terrain.js`: elevation sampling, geometry and collision interpolation.
- `terrain-worker.js`: background geometry generation.
- `navigation.js`: landmark projection, compass bearings and ordered discovery progress.
- `landmark.js`: simplified Falcon descent-stage reconstruction.
- `sky.js`: lunar orientation, observer frame and astronomical transforms.
- `astronomy.js`: vendored Astronomy Engine 2.1.19, MIT.
- `scripts/prepare-data.py`: regenerate the regional elevation extract/star catalogue (Python + numpy + Pillow, network required).
- `scripts/prepare-detail.py`: regenerate the SLDEM2015 patch (Python + numpy, network required).

## Verification

```sh
node tests/terrain.test.mjs
node tests/location.test.mjs
node tests/sky.test.mjs
node tests/navigation.test.mjs
node tests/detail.test.mjs
```

Tests cover matching tile edges/normals and collision sampling with the detailed patch, smooth blending, compass bearings, ordered mission arrivals, saved-progress validation, distant-ring geometry, terrain relief, and Sun/Earth/Venus/Jupiter positions compared with saved NASA JPL Horizons observer ephemerides (0.03° tolerance at Apollo 15 landing time). That is a regression tolerance for the sampled epoch, not an accuracy guarantee for all dates.

`tests/browser.cjs` runs the general browser smoke checks; `tests/expedition-browser.cjs` checks the new navigation, discovery cards and persistence, using test-only position shortcuts for distant arrivals. Neither adds test hooks to the shipped app. Both require Playwright installed; set `SELENE_TEST_URL` for a deployment or local server. Browser emulation does not prove physical-phone performance. Retest actual iPhone Safari and Android Chrome for orientation, multi-touch, background/resume, thermal performance, and prolonged flight after uploading.
