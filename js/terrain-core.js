// SELENE terrain core — deterministic lunar height/albedo field shared by the
// main thread (collision, altitude) and the terrain workers (mesh building).
// Units are metres. World axes: +X east, -Z north, +Y up.

export const MOON_RADIUS = 1737400;

// ---------------------------------------------------------------- hashing / noise
function hi(ix, iz, s) {
  let h = Math.imul(ix | 0, 0x27d4eb2d) ^ Math.imul(iz | 0, 0x165667b1) ^ Math.imul(s | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}
export function hash01(ix, iz, s) { return hi(ix, iz, s) / 4294967296; }

const GX = new Float64Array(16), GZ = new Float64Array(16);
for (let i = 0; i < 16; i++) { const a = (i + 0.5) / 16 * Math.PI * 2; GX[i] = Math.cos(a); GZ[i] = Math.sin(a); }

export function perlin(x, z, s) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
  const v = fz * fz * fz * (fz * (fz * 6 - 15) + 10);
  const a = hi(ix, iz, s) & 15, b = hi(ix + 1, iz, s) & 15, c = hi(ix, iz + 1, s) & 15, d = hi(ix + 1, iz + 1, s) & 15;
  const n00 = GX[a] * fx + GZ[a] * fz;
  const n10 = GX[b] * (fx - 1) + GZ[b] * fz;
  const n01 = GX[c] * fx + GZ[c] * (fz - 1);
  const n11 = GX[d] * (fx - 1) + GZ[d] * (fz - 1);
  const p = n00 + (n10 - n00) * u, q = n01 + (n11 - n01) * u;
  return (p + (q - p) * v) * 1.41;
}

// Number of octaves worth evaluating for a feature wavelength at a given LOD spacing.
function octaves(wavelength, lod, max) {
  if (lod <= 0) return max;
  const n = Math.floor(Math.log2(wavelength / (lod * 2.2))) + 1;
  return n < 0 ? 0 : n > max ? max : n;
}

export function fbm(x, z, oct, s) {
  let sum = 0, amp = 0.5, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * perlin(x, z, s + i * 31);
    norm += amp;
    const nx = 1.6 * x - 1.2 * z, nz = 1.2 * x + 1.6 * z;
    x = nx; z = nz; amp *= 0.5;
  }
  return norm > 0 ? sum / norm : 0;
}

function ridged(x, z, oct, s) {
  let sum = 0, amp = 0.5, w = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    let n = 1 - Math.abs(perlin(x, z, s + i * 57));
    n *= n * w;
    w = n * 1.6; if (w > 1) w = 1;
    sum += n * amp; norm += amp;
    const nx = 1.6 * x - 1.2 * z, nz = 1.2 * x + 1.6 * z;
    x = nx; z = nz; amp *= 0.5;
  }
  return norm > 0 ? sum / norm : 0;
}

const smooth = (e0, e1, x) => { let t = (x - e0) / (e1 - e0); t = t < 0 ? 0 : t > 1 ? 1 : t; return t * t * (3 - 2 * t); };
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// Polynomial smooth minimum — used to round off degraded crater rims.
function smin(a, b, k) {
  if (k <= 0) return a < b ? a : b;
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

// ---------------------------------------------------------------- crater morphology
// Depth / rim relations follow Pike (1977) for fresh lunar craters:
//   simple (D < 15 km): depth ≈ 0.2 D, rim ≈ 0.036 D
//   complex:            depth ≈ 1.044 D^0.301 km, rim ≈ 0.236 D^0.399 km
let accAlb = 0, accRock = 0;

function craterProfile(t, D, age, o) {
  const fresh = 1 - age;
  let d, hr;
  const complex = D >= 15000;
  if (o && o.depth) { d = o.depth; hr = o.rim; }
  else if (!complex) { d = 0.2 * D; hr = 0.036 * D; }
  else { const k = D / 1000; d = 1044 * Math.pow(k, 0.301); hr = 236 * Math.pow(k, 0.399); }
  d *= 1 - 0.68 * age;
  hr *= 1 - 0.82 * age;

  let inside;
  const floorFrac = o && o.floor !== undefined ? o.floor : complex ? 0.42 : 0;
  if (floorFrac <= 0.001) {
    const s = t * t;
    inside = -d + (d + hr) * (s * (0.38 + 0.62 * s));
    const fill = -d * (0.55 + 0.45 * fresh);
    if (inside < fill) inside = fill + (inside - fill) * 0.15;
  } else {
    const fl = -d * 0.94;
    if (t < floorFrac) inside = fl;
    else {
      const w = (t - floorFrac) / (1 - floorFrac);
      const N = o && o.terraces !== undefined ? o.terraces : complex ? 5 : 0;
      let wt = w;
      if (N > 0) {
        const k = w * N, fi = Math.floor(k), fp = k - fi;
        const step = (fi + smooth(0.55, 1, fp)) / N;
        wt = w + (step - w) * 0.6 * fresh;
      }
      inside = fl + (hr - fl) * Math.pow(wt, 1.55);
    }
  }
  const te = t < 0.35 ? 0.35 : t;
  const outside = hr / (te * te * te) * (1 - smooth(1.65, 2.2, t));
  const h = smin(inside, outside, (0.04 + 0.9 * age) * (hr + 0.08 * d));

  // Fresh craters expose bright immature material and blocky ejecta.
  if (age < 0.3) {
    const f = (0.3 - age) / 0.3;
    const halo = t < 1 ? 1 : Math.pow(t, -2.4) * (1 - smooth(1.6, 2.2, t));
    accAlb += 0.55 * f * halo;
    accRock += 2.2 * f * (t < 1 ? 0.55 + 0.6 * smooth(0.6, 1, t) : halo);
  } else if (t < 1.15) {
    accRock += 0.18 * (1 - age) * smooth(0.7, 1.0, t);
  }
  return h;
}

// Procedural crater population, from basins down to metre-scale pits.
// p: probability a cell hosts a crater (highlands, maria — maria are younger and less cratered).
const LAYERS = [
  { cell: 52000, p: 0.5, pm: 0.06, r0: 0.16, r1: 0.42, s: 11, warp: 0 },
  { cell: 19000, p: 0.55, pm: 0.1, r0: 0.16, r1: 0.42, s: 23, warp: 0 },
  { cell: 7000, p: 0.6, pm: 0.18, r0: 0.15, r1: 0.42, s: 37, warp: 0 },
  { cell: 2600, p: 0.66, pm: 0.3, r0: 0.14, r1: 0.42, s: 41, warp: 1 },
  { cell: 950, p: 0.7, pm: 0.45, r0: 0.14, r1: 0.42, s: 53, warp: 1 },
  { cell: 340, p: 0.72, pm: 0.55, r0: 0.14, r1: 0.42, s: 67, warp: 1 },
  { cell: 120, p: 0.72, pm: 0.62, r0: 0.14, r1: 0.42, s: 71, warp: 2 },
  { cell: 42, p: 0.7, pm: 0.62, r0: 0.14, r1: 0.42, s: 83, warp: 2 },
  { cell: 15, p: 0.62, pm: 0.6, r0: 0.14, r1: 0.4, s: 97, warp: 0 },
  { cell: 5.4, p: 0.5, pm: 0.5, r0: 0.14, r1: 0.38, s: 101, warp: 0 },
];
const MACRO_CELL = 900; // layers at or above this are "macro" (flattened at landing sites)

function craterLayer(L, x, z, lod, mare, seed, mask) {
  const cell = L.cell;
  if (lod > 0 && cell * L.r1 < lod * 1.4) return 0;
  const gx = Math.floor(x / cell), gz = Math.floor(z / cell);
  const p = L.p + (L.pm - L.p) * mare;
  let sum = 0;
  for (let iz = gz - 1; iz <= gz + 1; iz++) {
    for (let ix = gx - 1; ix <= gx + 1; ix++) {
      const s = L.s + seed;
      if (hash01(ix, iz, s) > p) continue;
      const cx = (ix + hash01(ix, iz, s + 1)) * cell;
      const cz = (iz + hash01(ix, iz, s + 2)) * cell;
      const u = hash01(ix, iz, s + 3);
      const r = cell * (L.r0 + (L.r1 - L.r0) * u * u);
      const dx = x - cx, dz = z - cz;
      const reach = r * 2.2;
      if (dx > reach || dx < -reach || dz > reach || dz < -reach) continue;
      const t = Math.sqrt(dx * dx + dz * dz) / r;
      if (t >= 2.2) continue;
      const age = Math.pow(hash01(ix, iz, s + 4), 0.62);
      sum += craterProfile(t, r * 2, age, null);
    }
  }
  return sum * mask;
}

// ---------------------------------------------------------------- region terrain
// A region describes a location: maria distribution, named features and sun.
export function createTerrain(config) {
  const seed = config.seed | 0;
  const features = (config.features || []).map((f) => ({ ...f }));
  const mareCfg = config.mare || { base: 0, contrast: 0 };
  const craters = features.filter((f) => f.type === 'crater');
  const massifs = features.filter((f) => f.type === 'massif');
  const flats = features.filter((f) => f.type === 'flatten');
  const albedoZones = features.filter((f) => f.type === 'albedo');
  for (const c of craters) {
    c.r = c.D / 2;
    if (c.peak) c.peakR = c.peakR || c.r * 0.16;
  }
  for (const m of massifs) {
    const a = ((m.rot || 0) * Math.PI) / 180;
    m.ca = Math.cos(a); m.sa = Math.sin(a);
  }

  function mareMask(x, z) {
    let m = mareCfg.base || 0;
    if (mareCfg.contrast) {
      m += fbm(x / (mareCfg.scale || 60000), z / (mareCfg.scale || 60000), 4, seed + 900) * mareCfg.contrast;
    }
    if (mareCfg.zones) {
      for (const zn of mareCfg.zones) {
        let d;
        if (zn.band) d = Math.abs((x - zn.x) * zn.band[0] + (z - zn.z) * zn.band[1]);
        else d = Math.hypot(x - zn.x, z - zn.z);
        const w = 1 - smooth(zn.r, zn.r + zn.feather, d);
        m = m + (zn.v - m) * w;
      }
    }
    return clamp01(m);
  }

  const out = { h: 0, alb: 0, rock: 0, mare: 0 };

  function evalTerrain(x, z, lod, skipFlatten) {
    accAlb = 0; accRock = 0;
    const mare = mareMask(x, z);

    // Highland relief: broad undulation + ridged massifs + rolling hills.
    let hl = 0;
    hl += 1500 * fbm(x / 70000, z / 70000, octaves(70000, lod, 4), seed + 101);
    hl += 1250 * (ridged(x / 26000, z / 26000, octaves(26000, lod, 5), seed + 202) - 0.32);
    hl += 170 * fbm(x / 3200, z / 3200, octaves(3200, lod, 4), seed + 303);
    // Mare: flooded basalt plains with low wrinkle ridges.
    let mr = -1400 + 300 * fbm(x / 90000, z / 90000, octaves(90000, lod, 3), seed + 404);
    mr += 70 * Math.pow(ridged(x / 11000, z / 11000, octaves(11000, lod, 3), seed + 505), 2);
    mr += 14 * fbm(x / 1600, z / 1600, octaves(1600, lod, 3), seed + 606);
    let macro = hl + (mr - hl) * smooth(0.0, 1.0, mare);

    // Named massifs (Taurus-Littrow, ranges).
    for (let i = 0; i < massifs.length; i++) {
      const m = massifs[i];
      const dx = x - m.x, dz = z - m.z;
      const lx = (dx * m.ca + dz * m.sa) / m.rx, lz = (-dx * m.sa + dz * m.ca) / m.rz;
      const e = lx * lx + lz * lz;
      if (e >= 1.6) continue;
      const shape = Math.pow(1 - smooth(0, 1.6, e), 1.6);
      const gul = 0.72 + 0.4 * ridged(x / (m.rx * 0.45), z / (m.rx * 0.45), octaves(m.rx * 0.45, lod, 4), seed + 707 + i);
      macro += m.h * shape * gul;
      accRock += 0.6 * shape;
    }

    // Procedural macro craters, suppressed inside named craters (younger impacts erase older terrain).
    let mask = 1;
    for (let i = 0; i < craters.length; i++) {
      const c = craters[i];
      const t = Math.hypot(x - c.x, z - c.z) / c.r;
      if (t < 1.6) mask = Math.min(mask, smooth(0.85, 1.6, t));
    }
    for (let i = 0; i < LAYERS.length; i++) {
      const L = LAYERS[i];
      if (L.cell < MACRO_CELL) break;
      let wx = x, wz = z;
      if (L.warp === 1) { wx += perlin(x / 900, z / 900, seed + 11) * L.cell * 0.05; wz += perlin(x / 900, z / 900, seed + 12) * L.cell * 0.05; }
      macro += craterLayer(L, wx, wz, lod, mare, seed, i < 3 ? mask : 0.35 + 0.65 * mask);
    }

    // Named craters.
    for (let i = 0; i < craters.length; i++) {
      const c = craters[i];
      const dx = x - c.x, dz = z - c.z;
      const dist = Math.sqrt(dx * dx + dz * dz);
      // Gentle rim irregularity so rims are not perfect circles.
      const wob = c.D > 2000 ? 1 + 0.035 * perlin(x / (c.r * 0.35), z / (c.r * 0.35), seed + 30 + i) : 1;
      const t = dist / (c.r * wob);
      const reach = c.rays ? c.rays.length : 2.2;
      if (t >= Math.max(2.2, reach)) continue;
      if (t < 2.2) {
        const inner = 1 - smooth(0.8, 1.05, t);
        macro = macro * (1 - inner * 0.88) + craterProfile(t, c.D, c.age || 0, c);
        if (c.peak && t < 0.42) {
          const pr = dist / c.peakR;
          const n = ridged(x / (c.peakR * 0.7), z / (c.peakR * 0.7), octaves(c.peakR * 0.7, lod, 4), seed + 40 + i);
          const cl = c.peakCluster ? 0.55 + 0.6 * Math.abs(perlin(x / (c.peakR * 0.55), z / (c.peakR * 0.55), seed + 41 + i)) : 1;
          macro += c.peak * Math.exp(-pr * pr * 1.3) * (0.45 + 0.75 * n) * cl;
          accRock += 1.2 * Math.exp(-pr * pr);
        }
        if (c.floorHummocks && t < (c.floor || 0.42)) {
          macro += c.floorHummocks * fbm(x / 1800, z / 1800, octaves(1800, lod, 4), seed + 50 + i);
        }
      }
      // Bright ray system (Tycho, Copernicus): narrow streaks of fresh ejecta.
      if (c.rays && t > 0.9) {
        const nx = dx / (dist + 1e-6), nz = dz / (dist + 1e-6);
        let ray = perlin(nx * 9 + 3.1, nz * 9 - 1.7, seed + 60 + i) * 0.6 + perlin(nx * 26, nz * 26, seed + 61 + i) * 0.4;
        ray = Math.max(0, ray);
        ray = ray * ray * (0.55 + 0.45 * perlin(dist / 9000, ray * 3, seed + 62 + i));
        const fade = Math.exp(-(t - 1) / (c.rays.length * 0.35)) * smooth(0.9, 1.3, t);
        accAlb += c.rays.strength * Math.max(0, ray) * fade * 3;
      }
    }

    // Landing sites: flatten macro relief.
    let microScale = 1;
    if (!skipFlatten) {
      for (let i = 0; i < flats.length; i++) {
        const f = flats[i];
        const d = Math.hypot(x - f.x, z - f.z);
        if (d > f.r * 2) continue;
        const w = 1 - smooth(f.r * 0.5, f.r * 2, d);
        if (f.hc === undefined) f.hc = evalTerrainMacroOnly(f.x, f.z);
        macro = macro + (f.hc - macro) * w;
        if (f.pad) microScale = Math.min(microScale, smooth(f.pad * 0.6, f.pad * 1.6, d));
      }
    }

    // Meso / micro craters and regolith texture.
    let micro = 0;
    for (let i = 0; i < LAYERS.length; i++) {
      const L = LAYERS[i];
      if (L.cell >= MACRO_CELL) continue;
      let wx = x, wz = z;
      if (L.warp === 1) { wx += perlin(x / 300, z / 300, seed + 13) * L.cell * 0.06; wz += perlin(x / 300, z / 300, seed + 14) * L.cell * 0.06; }
      else if (L.warp === 2) { wx += perlin(x / 30, z / 30, seed + 15) * L.cell * 0.06; wz += perlin(x / 30, z / 30, seed + 16) * L.cell * 0.06; }
      micro += craterLayer(L, wx, wz, lod, mare, seed, 1);
    }
    micro += 3.2 * fbm(x / 140, z / 140, octaves(140, lod, 3), seed + 808);
    micro += 0.35 * fbm(x / 9, z / 9, octaves(9, lod, 3), seed + 909);

    out.h = macro + micro * microScale;

    // Albedo (normal reflectance): highlands ~0.15, maria ~0.075 — the Moon is as dark as worn asphalt.
    let alb = 0.15 + (0.074 - 0.15) * mare;
    alb *= 1 + 0.14 * fbm(x / 2600, z / 2600, octaves(2600, lod, 3), seed + 1001) + 0.06 * fbm(x / 220, z / 220, octaves(220, lod, 2), seed + 1002);
    alb *= 1 + accAlb;
    for (let i = 0; i < albedoZones.length; i++) {
      const a = albedoZones[i];
      const d = Math.hypot(x - a.x, z - a.z);
      if (a.inner !== undefined) {
        if (d < a.inner - a.feather || d > a.r + a.feather) continue;
        const w = smooth(a.inner - a.feather, a.inner, d) * (1 - smooth(a.r, a.r + a.feather, d));
        alb *= 1 + a.delta * w;
      } else {
        if (d > a.r + a.feather) continue;
        alb *= 1 + a.delta * (1 - smooth(a.r, a.r + a.feather, d));
      }
    }
    out.alb = alb;
    out.rock = (0.25 + (0.08 - 0.25) * mare + accRock) * microScale;
    out.mare = mare;
    return out;
  }

  function evalTerrainMacroOnly(x, z) {
    const saveA = accAlb, saveR = accRock;
    const r = evalTerrain(x, z, 60, true).h;
    accAlb = saveA; accRock = saveR;
    return r;
  }

  // Upper bound of terrain height; used to terminate shadow rays early.
  let maxH = 3600;
  for (const c of craters) maxH = Math.max(maxH, 3600 + (c.peak || 0) + (c.rim || 1500));
  for (const m of massifs) maxH = Math.max(maxH, 3600 + m.h * 1.2);

  return {
    sample: (x, z, lod) => evalTerrain(x, z, lod || 0, false),
    height: (x, z, lod) => evalTerrain(x, z, lod || 0, false).h,
    maxHeight: maxH,
  };
}

// Sun-disc occlusion along the sun direction (soft shadows from the 0.53° solar disc).
// Returns 1 = fully lit, 0 = fully shadowed.
const SUN_ANGULAR_DIAMETER = 0.0093;
export function sunVisibility(terrain, x, z, h0, sun, spacing, maxDist) {
  const horiz = Math.hypot(sun.x, sun.z);
  if (horiz < 1e-4) return 1;
  const ux = sun.x / horiz, uz = sun.z / horiz;
  const tanE = sun.y / horiz;
  const maxH = terrain.maxHeight;
  let t = Math.max(0.6, spacing * 0.8);
  let vis = 1;
  const start = h0 + 0.05;
  while (t < maxDist) {
    const rayH = start + t * tanE;
    if (rayH > maxH) break;
    // Coarser terrain detail is sufficient further along the ray.
    const lod = Math.max(spacing * 0.5, t * 0.06);
    const h = terrain.height(x + ux * t, z + uz * t, lod);
    const pen = t * SUN_ANGULAR_DIAMETER;
    const s = 0.5 + (rayH - h) / pen;
    if (s < vis) { vis = s; if (vis <= 0) return 0; }
    t = t * 1.3 + spacing * 0.25;
  }
  return vis > 1 ? 1 : vis;
}

export function sunDirection(azDeg, elDeg) {
  const az = (azDeg * Math.PI) / 180, el = (elDeg * Math.PI) / 180;
  return { x: Math.sin(az) * Math.cos(el), y: Math.sin(el), z: -Math.cos(az) * Math.cos(el) };
}

// Direction of Earth in the local sky for a near-side site at selenographic lat/lon
// (sub-Earth point at 0°,0°; libration ignored). Returns {x,y,z} in world axes.
export function earthDirection(latDeg, lonDeg) {
  const p = (latDeg * Math.PI) / 180, l = (lonDeg * Math.PI) / 180;
  const up = Math.cos(p) * Math.cos(l);
  const east = -Math.sin(l);
  const north = -Math.sin(p) * Math.cos(l);
  const len = Math.hypot(up, east, north);
  return { x: east / len, y: up / len, z: -north / len };
}
