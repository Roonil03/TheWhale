// Humpback whale geometry for the whale race: pure, dependency-free, Node and browser.
//
// Mesh space: +x = the whale's left, +y = up, +z = forward. The snout tip is at z = +3.5,
// the peduncle (fluke root) near z = -3.3 and the fluke tips trail to about z = -4.1; the body
// is centred near y = 0 and is widest (half-width ~0.8) around z = 0.4.
//
// Every vertex carries an aux tag (WHALE_PART) that the racer shader reads:
//   1 body (hull, dorsal fin), 0.5 pectoral flippers, 0.2 flukes, -1 eyes (black, glossy).
//
// Animation constraints the shapes respect:
// - The body flexes vertically with amplitude t^2, t = clamp((1.2 - z) / 4.8, 0, 1), so all
//   geometry aft of z = 1.2 bends; the flukes lie in a horizontal plane (wide in x, thin in y)
//   so the up/down beat reads as a whale tail rather than a fish tail.
// - Flipper vertices flap by (|x| - 0.6) * k, so every flipper vertex has |x| >= ~0.6 and |x|
//   grows from the root outward.
//
// Winding: for every triangle (a, b, c), (b - a) x (c - a) points out of the surface, matching
// the area-weighted normals in the vendor Mesh.build(). Every part is a closed, consistently
// oriented surface; the flipper, fin, fluke and eye roots are buried in the hull.

const { abs, cos, sin, sqrt, min, max, hypot, PI } = Math;

export const WHALE_PART = Object.freeze({
  body: 1,
  flipper: 0.5,
  fluke: 0.2,
  eye: -1,
});

const smooth = (e0, e1, x) => {
  const t = min(1, max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

// ---------------------------------------------------------------- hull profile
// z, half-width, top (y of the back), bottom (y of the belly); the head stays broad and deep
// right up to the snout, which is closed by an elliptical cap (NOSE_CAP metres long).
const PROFILE = [
  [-3.42, 0.06, 0.11, -0.09],
  [-2.9, 0.12, 0.23, -0.17],
  [-2.3, 0.25, 0.37, -0.3],
  [-1.5, 0.46, 0.56, -0.5],
  [-0.6, 0.67, 0.72, -0.7],
  [0.4, 0.8, 0.79, -0.82],
  [1.3, 0.79, 0.7, -0.85],
  [2.2, 0.7, 0.53, -0.78],
  [2.9, 0.58, 0.35, -0.65],
  [3.5, 0.46, 0.2, -0.5],
];
const NOSE_Z = 3.5;
const NOSE_CAP = 0.45;
const TAIL_Z = -3.42; // tip of the hull (the flukes trail further)
const TAIL_CAP = 0.14;
const SIDES = 32;
const MAIN_RINGS = 56;
const NOSE_RINGS = 9;
const TAIL_RINGS = 4;
const CAP_PHI = 1.45; // last cap ring at cos(1.45) ~ 12% of the cap base before the tip vertex

// Hermite interpolation with finite-difference tangents over the non-uniform z knots
const TANGENTS = PROFILE.map((row, i) => {
  const a = PROFILE[max(i - 1, 0)],
    b = PROFILE[min(i + 1, PROFILE.length - 1)];
  return row.map((_, c) => (c ? (b[c] - a[c]) / (b[0] - a[0]) : 0));
});
function profile(z) {
  let i = 0;
  while (i < PROFILE.length - 2 && z > PROFILE[i + 1][0]) i++;
  const p = PROFILE[i],
    q = PROFILE[i + 1],
    h = q[0] - p[0],
    t = min(1, max(0, (z - p[0]) / h)),
    t2 = t * t,
    t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1,
    h10 = t3 - 2 * t2 + t,
    h01 = -2 * t3 + 3 * t2,
    h11 = t3 - t2;
  const out = [0, 0, 0];
  for (let c = 1; c < 4; c++)
    out[c - 1] =
      h00 * p[c] +
      h10 * h * TANGENTS[i][c] +
      h01 * q[c] +
      h11 * h * TANGENTS[i + 1][c];
  // the widest line sits a little above mid-depth, so the throat and belly are fuller than the back
  const mid = out[2] + (0.5 + 0.06 * smooth(-2.6, -1, z)) * (out[1] - out[2]);
  return { w: out[0], top: out[1], bot: out[2], mid };
}
// flatter top of the head: the upper half of the section becomes a superellipse forward of z ~ 1
const headFlat = (z) => 1 - 0.28 * smooth(1, 2.6, z);

// point on the hull section at z scaled by f (cap factor), angle a (0 = +x side, PI / 2 = top)
function hullPoint(z, f, a) {
  const P = profile(z),
    A = (P.top - P.bot) / 2,
    D = (P.top + P.bot) / 2 - P.mid,
    c = cos(a),
    s = sin(a),
    p = s > 0 ? headFlat(z) : 1,
    x = P.w * f * Math.sign(c) * abs(c) ** p,
    y = P.mid + f * s * (A + D * s);
  return [x, y, z];
}
// x of the hull surface on the +x side at height y (uncapped section), or 0 if y is off the section
function hullSideX(z, y) {
  const P = profile(z),
    A = (P.top - P.bot) / 2,
    D = (P.top + P.bot) / 2 - P.mid,
    dy = y - P.mid,
    s = abs(D) < 1e-9 ? dy / A : (-A + sqrt(max(A * A + 4 * D * dy, 0))) / (2 * D);
  if (abs(s) >= 1) return 0;
  return P.w * sqrt(1 - s * s) ** (s > 0 ? headFlat(z) : 1);
}

function makeHull() {
  const stations = []; // [z, f]
  for (let k = TAIL_RINGS; k >= 1; k--) {
    const phi = (CAP_PHI * k) / TAIL_RINGS;
    stations.push([TAIL_Z + TAIL_CAP - TAIL_CAP * sin(phi), cos(phi)]);
  }
  const z0 = TAIL_Z + TAIL_CAP,
    z1 = NOSE_Z - NOSE_CAP;
  for (let k = 0; k <= MAIN_RINGS; k++)
    stations.push([z0 + ((z1 - z0) * k) / MAIN_RINGS, 1]);
  for (let k = 1; k <= NOSE_RINGS; k++) {
    const phi = (CAP_PHI * k) / NOSE_RINGS;
    stations.push([z1 + NOSE_CAP * sin(phi), cos(phi)]);
  }
  const pos = [],
    tri = [],
    rings = [];
  for (const [z, f] of stations) {
    const ring = [];
    for (let k = 0; k < SIDES; k++) {
      ring.push(pos.length);
      pos.push(hullPoint(z, f, (k / SIDES) * 2 * PI));
    }
    rings.push(ring);
  }
  for (let j = 0; j < rings.length - 1; j++)
    for (let k = 0; k < SIDES; k++) {
      const k2 = (k + 1) % SIDES,
        a = rings[j][k],
        b = rings[j][k2],
        c = rings[j + 1][k2],
        d = rings[j + 1][k];
      tri.push([a, b, c], [a, c, d]);
    }
  const tail = pos.length;
  pos.push([0, profile(TAIL_Z).mid, TAIL_Z]);
  const nose = pos.length;
  pos.push([0, profile(NOSE_Z).mid, NOSE_Z]);
  const first = rings[0],
    last = rings[rings.length - 1];
  for (let k = 0; k < SIDES; k++) {
    const k2 = (k + 1) % SIDES;
    tri.push([first[k2], first[k], tail], [last[k], last[k2], nose]);
  }
  return { pos, tri, rings: rings.length };
}

// ---------------------------------------------------------------- blades (flukes, flippers, fin)
// A closed lens over a span x chord grid: point(i, j, side) gives the upper (side = 1) and lower
// (side = -1) surfaces. Leading/trailing edges and both end stations have zero thickness and
// share one vertex between the two surfaces, so the lens is watertight.
function makeBlade(spanN, chordN, point) {
  const pos = [],
    tri = [],
    top = [],
    bot = [],
    onEdge = (i, j) => i === 0 || i === spanN || j === 0 || j === chordN;
  for (let i = 0; i <= spanN; i++) {
    top.push([]);
    bot.push([]);
    for (let j = 0; j <= chordN; j++) {
      top[i].push(pos.length);
      pos.push(point(i, j, 1));
      if (onEdge(i, j)) bot[i].push(top[i][j]);
      else {
        bot[i].push(pos.length);
        pos.push(point(i, j, -1));
      }
    }
  }
  for (let i = 0; i < spanN; i++)
    for (let j = 0; j < chordN; j++) {
      // split along the diagonal i,j -> i+1,j+1 unless both its ends lie on the closed edge (two
      // corner quads), where the upper and lower surfaces would share it; then use the other one
      const flip = onEdge(i, j) && onEdge(i + 1, j + 1);
      const a = top[i][j],
        b = top[i + 1][j],
        c = top[i + 1][j + 1],
        d = top[i][j + 1];
      if (flip) tri.push([b, c, d], [b, d, a]);
      else tri.push([a, b, c], [a, c, d]);
      const e = bot[i][j],
        f = bot[i][j + 1],
        g = bot[i + 1][j + 1],
        h = bot[i + 1][j];
      if (flip) tri.push([f, g, h], [f, h, e]);
      else tri.push([e, f, g], [e, g, h]);
    }
  return { pos, tri };
}

// cosine spacing along the chord: dense at the rounded leading edge and the thin trailing edge
const chordAt = (j, n) => (1 - cos((PI * j) / n)) / 2;
// thickness distribution, 1 at c = 1/3, rounded nose, sharp trailing edge
const thick = (c) => 2.598 * sqrt(c) * (1 - c);
// rounded tip: the chord shrinks along a quarter ellipse over the last `from` of the span
const tipRound = (a, from) =>
  a <= 1 - from ? 1 : sqrt(max(1 - ((a - 1 + from) / from) ** 2, 0.014));

// flukes: one lens across the full span; lobes swept back with a median notch at the trailing edge
const FLUKE_HALF_SPAN = 1.5;
function makeFlukes() {
  const N = 18,
    M = 12;
  return makeBlade(2 * N, M, (i, j, side) => {
    const u = (i - N) / N,
      a = abs(u),
      le = -3.12 - 0.86 * a ** 1.6,
      notch = 1 - (1 - min(a / 0.3, 1)) ** 2,
      te = -3.52 - 0.28 * notch - 0.3 * a ** 3,
      lead = te + (le - te) * tipRound(a, 0.16),
      c = chordAt(j, M),
      t = 0.075 * (1 - a * a) * thick(c),
      y = 0.015 + 0.05 * a * a;
    return [u * FLUKE_HALF_SPAN, y + side * t, lead + (te - lead) * c];
  });
}

// pectoral flipper (+x side; mirrored for -x): a ~2.2 m blade sweeping out, back and down,
// streamwise chords (no x component) so |x| only grows from the root outward
const FLIPPER = { root: [0.6, -0.32, 1.45], ctrl: [1.45, -0.62, 1.05], tip: [2.1, -0.98, 0.02] };
const bez = (p0, p1, p2, t) =>
  p0.map((_, k) => (1 - t) ** 2 * p0[k] + 2 * (1 - t) * t * p1[k] + t * t * p2[k]);
const bezD = (p0, p1, p2, t) =>
  p0.map((_, k) => 2 * (1 - t) * (p1[k] - p0[k]) + 2 * t * (p2[k] - p1[k]));
function makeFlipper(sx) {
  const N = 22,
    M = 10,
    dl = hypot(0.1, 1),
    D = [0, 0.1 / dl, -1 / dl]; // leading edge forward, trailing edge aft
  return makeBlade(N, M, (i, j, side) => {
    const a = i / N,
      P = bez(FLIPPER.root, FLIPPER.ctrl, FLIPPER.tip, a),
      T = bezD(FLIPPER.root, FLIPPER.ctrl, FLIPPER.tip, a);
    let n = [T[1] * D[2] - T[2] * D[1], T[2] * D[0] - T[0] * D[2], T[0] * D[1] - T[1] * D[0]];
    const nl = hypot(...n) * (n[1] < 0 ? -1 : 1);
    n = n.map((v) => v / nl);
    // humpback tubercles: a scalloped leading edge along the middle of the span
    const bump = 0.028 * sin(a * PI * 9) ** 2 * smooth(0.12, 0.25, a) * (1 - smooth(0.8, 0.92, a));
    const chord = (0.14 + 0.32 * (1 - a) ** 0.8) * tipRound(a, 0.14),
      c = chordAt(j, M),
      s = (c - 0.3) * chord - bump * (1 - c) * (1 - c),
      t = 0.075 * (1 - a) ** 0.7 * smooth(0, 0.07, a) * thick(c);
    return [
      sx * (P[0] + n[0] * side * t),
      P[1] + D[1] * s + n[1] * side * t,
      P[2] + D[2] * s + n[2] * side * t,
    ];
  });
}

// small low dorsal fin on a hump about two-thirds of the way back; thickness along x
const DORSAL_Z = -1.6;
function makeDorsal() {
  const N = 8,
    M = 8,
    back = profile(DORSAL_Z).top,
    root = [0, back - 0.14, DORSAL_Z + 0.12],
    tip = [0, back + 0.15, DORSAL_Z - 0.3];
  return makeBlade(N, M, (i, j, side) => {
    const a = i / N,
      chord = (0.06 + 0.62 * (1 - a) ** 1.3) * tipRound(a, 0.2),
      c = chordAt(j, M),
      t = 0.065 * (1 - a * a) * smooth(0, 0.12, a) * thick(c),
      y = root[1] + (tip[1] - root[1]) * a,
      z = root[2] + (tip[2] - root[2]) * a ** 1.4 - (c - 0.25) * chord;
    return [side * t, y, z];
  });
}

// ---------------------------------------------------------------- eyes
function icosphere(sub) {
  const g = (1 + sqrt(5)) / 2;
  let V = [
    [-1, g, 0], [1, g, 0], [-1, -g, 0], [1, -g, 0], [0, -1, g], [0, 1, g],
    [0, -1, -g], [0, 1, -g], [g, 0, -1], [g, 0, 1], [-g, 0, -1], [-g, 0, 1],
  ].map((v) => v.map((c) => c / hypot(...v)));
  let F = [
    [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4],
    [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8],
    [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
  ];
  for (let s = 0; s < sub; s++) {
    const cache = new Map(),
      F2 = [];
    const mid = (a, b) => {
      const key = a < b ? a * 65536 + b : b * 65536 + a;
      let r = cache.get(key);
      if (r === undefined) {
        const p = [0, 1, 2].map((k) => V[a][k] + V[b][k]),
          l = hypot(...p);
        r = V.length;
        V.push(p.map((c) => c / l));
        cache.set(key, r);
      }
      return r;
    };
    for (const [a, b, c] of F) {
      const ab = mid(a, b),
        bc = mid(b, c),
        ca = mid(c, a);
      F2.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    F = F2;
  }
  return { V, F };
}
// low on the side of the head, just above and behind the corner of the mouth, slightly proud
const EYE_Z = 2.25,
  EYE_Y = -0.18,
  EYE_R = 0.065,
  EYE_X = hullSideX(EYE_Z, EYE_Y) - 0.45 * EYE_R;
function makeEye(sx) {
  const { V, F } = icosphere(2);
  return {
    pos: V.map((v) => [sx * EYE_X + v[0] * EYE_R, EYE_Y + v[1] * EYE_R, EYE_Z + v[2] * EYE_R]),
    tri: F.map((f) => [...f]),
  };
}

// ---------------------------------------------------------------- assembly
function signedVolume(pos, tri) {
  let v = 0;
  for (const [a, b, c] of tri) {
    const p = pos[a],
      q = pos[b],
      r = pos[c];
    v +=
      p[0] * (q[1] * r[2] - q[2] * r[1]) +
      p[1] * (q[2] * r[0] - q[0] * r[2]) +
      p[2] * (q[0] * r[1] - q[1] * r[0]);
  }
  return v / 6;
}
// every part is closed and consistently wound, so a negative volume means inside-out: flip it
function outward(part) {
  if (signedVolume(part.pos, part.tri) < 0) for (const t of part.tri) [t[1], t[2]] = [t[2], t[1]];
  return part;
}

const HULL = makeHull();
const PARTS = [
  { name: "hull", aux: WHALE_PART.body, ...HULL },
  { name: "dorsal", aux: WHALE_PART.body, ...makeDorsal() },
  { name: "flukes", aux: WHALE_PART.fluke, ...makeFlukes() },
  { name: "flipperLeft", aux: WHALE_PART.flipper, ...makeFlipper(1) },
  { name: "flipperRight", aux: WHALE_PART.flipper, ...makeFlipper(-1) },
  { name: "eyeLeft", aux: WHALE_PART.eye, ...makeEye(1) },
  { name: "eyeRight", aux: WHALE_PART.eye, ...makeEye(-1) },
].map(outward);

// emits the whale into sink ({ v(x, y, z, aux) -> index, tri(a, b, c), quad(a, b, c, d) }); returns sink
export function buildWhale(sink) {
  for (const part of PARTS) {
    const ids = part.pos.map((p) => sink.v(p[0], p[1], p[2], part.aux));
    for (const [a, b, c] of part.tri) sink.tri(ids[a], ids[b], ids[c]);
  }
  return sink;
}

// ---------------------------------------------------------------- measurements (scale 1, mesh space)
const partPos = (name) => PARTS.find((p) => p.name === name).pos;
const all = PARTS.flatMap((p) => p.pos);
const ext = (pts, k, f) => pts.reduce((m, p) => f(m, p[k]), f === max ? -Infinity : Infinity);
const hull = partPos("hull"),
  body = [...hull, ...partPos("dorsal")],
  flukes = partPos("flukes"),
  flipper = partPos("flipperLeft");
const widest = hull.reduce((m, p) => (p[0] > m[0] ? p : m), hull[0]);
let halfHeight = 0;
for (let r = 0; r < HULL.rings; r++) {
  const ring = hull.slice(r * SIDES, r * SIDES + SIDES);
  halfHeight = max(halfHeight, (ext(ring, 1, max) - ext(ring, 1, min)) / 2);
}
const flipperTip = FLIPPER.tip;
const BLOWHOLE_Z = 1.85;
const round = (x) => Math.round(x * 1e4) / 1e4;
const r3 = (p) => Object.freeze(p.map(round));

export const WHALE = Object.freeze({
  noseZ: round(ext(all, 2, max)),
  tailZ: round(ext(all, 2, min)), // fluke tips
  length: round(ext(all, 2, max) - ext(all, 2, min)),
  hullTailZ: TAIL_Z,
  halfWidth: round(widest[0]), // hull only (the dorsal fin is narrower)
  widestZ: round(widest[2]),
  halfHeight: round(halfHeight), // half the deepest hull section
  top: round(ext(body, 1, max)), // highest body point, hull or dorsal fin (the shoulders win)
  hullTop: round(ext(hull, 1, max)),
  bottom: round(ext(body, 1, min)),
  flukeSpan: round(2 * ext(flukes, 0, max)),
  flukeRootZ: round(ext(flukes, 2, max)),
  flipperSpan: round(2 * ext(flipper, 0, max)),
  flipperLength: round(hypot(...flipperTip.map((v, k) => v - FLIPPER.root[k]))),
  flipperRoot: r3(FLIPPER.root),
  flipperTip: r3(flipperTip),
  dorsalZ: DORSAL_Z,
  eye: r3([EYE_X, EYE_Y, EYE_Z]),
  eyeRadius: EYE_R,
  blowhole: r3([0, hullPoint(BLOWHOLE_Z, 1, PI / 2)[1], BLOWHOLE_Z]),
  vertices: all.length,
  triangles: PARTS.reduce((n, p) => n + p.tri.length, 0),
});
