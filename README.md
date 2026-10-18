# SELENE — Lunar Flight

A static Three.js lunar explorer. Open it through an HTTP server, not by double-clicking `index.html`:

```sh
python -m http.server 8000
```

Visit http://localhost:8000. GitHub Pages can serve these files directly; no build step or API key is needed. Keep `index.html`, `app.js`, `terrain.js`, and `terrain-worker.js` together when publishing. Three.js 0.185.0 loads from jsDelivr, so initial startup needs internet access. HTTPS or localhost is needed for WebGPU. WebGL 2 is the automatic fallback; append `?renderer=webgl` to test it explicitly.

## Controls

- Phone: left joystick moves; drag the scene to look; RISE/FALL controls altitude.
- Desktop: WASD moves, mouse drag looks, Q/E descends/ascends, Shift boosts.
- BOOST switches on gradual acceleration to three times cruising speed.
- SETTINGS adjusts look sensitivity and enables optional 1.62 m/s² lunar gravity. Assisted hover is the default, with braking and ground avoidance. Gravity mode remains simplified flight, not a spacecraft dynamics model.
- ECO reduces pixel resolution, terrain vertices and boulder counts, and disables shadows. Touch devices start in ECO; HIGH enables terrain and rock shadows.
- Leaving the page clears controls and pauses motion. A graphics failure offers a reload recovery action.

## Code map

- `index.html`: interface and responsive styles, including landscape safe areas.
- `app.js`: rendering, flight, lifecycle and terrain scheduling.
- `terrain.js`: deterministic terrain generation, tile buffers and triangle-based collision sampling.
- `terrain-worker.js`: generates tile buffers off the UI thread and transfers them back.

Tiles share a fixed-resolution world grid at each quality level, so crossing tile boundaries does not change their shape. Skirts hide temporary gaps during quality changes. World-seeded boulders stay fixed while exploring. Quality changes intentionally replace tiles gradually; small changes to ground detail are expected during the switch.

## Realism and limits

The terrain is procedural, **not surveyed lunar geography**. It includes darker smoother maria-like areas, brighter rugged highlands, irregular overlapping craters, ejecta and central peaks in larger basins. Earth is stylised. There is no planetary curvature, geographic navigation or physical spacecraft simulation. Importing a real NASA/LOLA landing-site elevation dataset is future work; no remote elevation service is silently substituted.

## Validation

```sh
node --test tests/terrain.test.mjs
```

Tests compare neighbouring tile edges and normals, validate geometry indices, and check collision interpolation against rendered triangles at both quality levels and negative coordinates.

Before publishing, test on real iPhone Safari and midrange Android Chrome: startup, two-thumb movement/look, rise/fall, boost/braking, both quality levels, portrait/landscape, background/resume, and at least several tile crossings. Browser emulation cannot establish battery use, thermal throttling, safe-area behaviour or physical-device frame rates.
