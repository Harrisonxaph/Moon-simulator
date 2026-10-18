# Source data and accuracy

## Apollo 15 terrain

NASA/LRO/LOLA, reformatted by NASA Scientific Visualization Studio (Ernie Wright), [CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/). Source: `ldem_64.tif`, 64 samples per degree, float32 kilometres above a sphere of radius 1737.4 km. NASA imagery/data usage: https://www.nasa.gov/nasa-brand-center/images-and-media/

The included 257 × 257 extract covers 128 km square, centred at 26.1322° N, 3.6339° E. It is resampled at 500 metres into an azimuthal equidistant local map. Heights include spherical lunar curvature and are relative to the landing-site tangent plane. Native north/south sampling is about 474 m; east/west about 426 m here. This resolves regional mountains and the broad rille depression, not individual landing-site rocks or detailed rille walls. Decorative boulders/dust are procedural. There are no invented large craters added to the elevation data.

Rebuild with `python scripts/prepare-data.py` (requires numpy and network access). The script fetches only necessary TIFF rows with byte-range requests.

## Stars

[HYG Database v4.1](https://github.com/astronexus/HYG-Database), David Nash / Astronexus; CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/. The derived `stars.json` is distributed under the same license. Columns: HYG id, proper name, J2000 right ascension (hours), declination (degrees), visual magnitude, B−V colour index, proper motion in RA*cos(dec) and dec (milliarcseconds/year). Stars through magnitude 6.0 are retained. Proper motions are applied; stellar parallax is omitted.

## Solar system and lunar orientation

[Astronomy Engine 2.1.19](https://github.com/cosinekitty/astronomy), Don Cross, MIT (license retained in `astronomy.js`). Geocentric J2000 vectors are translated to the Moon and corrected for the observer's position. Lunar orientation uses the IAU 2009 periodic model (Archinal et al., 2011, table 2, DOI 10.1007/s10569-010-9320-4). Lunar angles use Astronomy Engine terrestrial time; planetary light time is calculated for an Earth observer, then translated to the Moon. This is an educational sky, not an observatory ephemeris; small angular errors remain. No atmospheric refraction is applied on the airless Moon. Recommended dates: 1900–2100.

Sun and Earth use calculated angular sizes and shared lighting direction. Distant planets are point sources, with fixed illustrative colours/brightness rather than phase-dependent photometry or resolved surfaces. Earth's orientation uses sidereal rotation and precession/nutation; its texture is a static Blue Marble composite, not current weather. The texture is sourced from the Three.js planetary texture example (`earth_atmos_2048.jpg`, https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg), NASA Blue Marble imagery, resized to 1024 × 512. NASA imagery credit: NASA/GSFC; Three.js example distribution: MIT. Enhanced star visibility is enabled by default and explicitly labelled. It increases point size and brightness without changing catalogue positions; a slider controls brightness. Disable the enhancement to suppress daylight stars, approximating a camera exposed for sunlit terrain.

## Apollo 15 landmark

The Falcon descent-stage landmark is an original lightweight geometric reconstruction with a roughly 4.4 m body and 9.2 m leg span. Its shape, foil material, ladder and placement are illustrative, not a photogrammetric or surveyed asset. It is anchored at the Apollo 15 site coordinates used by the elevation extract. The camera starts 42 m south and 18 m above the nearby surface. The ascent stage is omitted because it returned the astronauts to lunar orbit.

## Higher-resolution Apollo 15 patch

The local patch uses **SLDEM2015**, a combined NASA/LRO/LOLA and JAXA/SELENE Terrain Camera elevation model at 512 samples per degree (about 59 m north/south and 53 m east/west at Apollo 15). Source: https://imbrium.mit.edu/DATA/SLDEM2015/TILES/FLOAT_IMG/SLDEM2015_512_00N_30N_000_045_FLOAT.IMG ; [PDS label](https://imbrium.mit.edu/DATA/SLDEM2015/TILES/FLOAT_IMG/SLDEM2015_512_00N_30N_000_045_FLOAT.LBL). NASA product description: https://pgda.gsfc.nasa.gov/products/54 . Cite Barker, M. K. et al. (2016), “A new lunar digital elevation model from the Lunar Orbiter Laser Altimeter and SELENE Terrain Camera,” Icarus 273, 346–355, DOI https://doi.org/10.1016/j.icarus.2015.07.039 .

`apollo15-detail.f32` contains a 257 × 257 grid resampled at 60 m, covering 15.36 km square. The source's measured landing-site elevation is recorded in `apollo15-detail.json`. Its local zero is aligned to the regional landing-site zero; an outer 1.5 km blend merges the two datasets without a vertical step. Spherical curvature is applied as for the regional extract. `scripts/prepare-detail.py` reproduces the extraction using HTTP byte ranges; `apollo15-detail-source.lbl` retains the original PDS label in the source archive. This is an eightfold sampling improvement over the 64 ppd regional source, not centimetre-scale surface reconstruction. Decorative rocks remain procedural.

## Waypoints and discovery facts

Waypoints use the same spherical azimuthal equidistant map as the elevation data. Falcon uses the existing Apollo 15 landing coordinates. The Hadley Rille overlook (26.15° N, 3.575° E) is an approximate educational viewpoint chosen near the landing area, not a historical EVA station. Mons Hadley uses a regional aim point (26.69° N, 4.17° E), not a surveyed summit marker. The four-stop route is designed for this simulator, not a reconstruction of the actual rover traverses.

Historical/geological facts are paraphrased from NASA's [Apollo 15 Lunar Surface Journal](https://www.nasa.gov/history/alsj/a15/a15.html), its [Hadley Rille / Station 9A account](https://www.nasa.gov/history/alsj/a15/a15.sta9a.html), and the [Apollo 15 mission overview](https://www.nasa.gov/mission/apollo-15/). Discoveries save locally in the browser; no external account or service is used.
