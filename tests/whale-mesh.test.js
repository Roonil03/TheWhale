import test from "node:test";
import assert from "node:assert/strict";
import { WHALE, WHALE_PART, buildWhale } from "../src/game/whale-mesh.js";

// recording sink with the vendor Mesh contract: v() returns the new index, quad = abc + acd
function record() {
  const sink = {
    p: [],
    aux: [],
    i: [],
    v(x, y, z, aux) {
      this.p.push([x, y, z]);
      this.aux.push(aux);
      return this.p.length - 1;
    },
    tri(a, b, c) {
      this.i.push([a, b, c]);
    },
    quad(a, b, c, d) {
      this.i.push([a, b, c], [a, c, d]);
    },
  };
  return buildWhale(sink);
}

const mesh = record();
const P = mesh.p;
const tagged = (aux) => P.filter((_, k) => mesh.aux[k] === aux);
const trisOf = (aux) => mesh.i.filter((t) => t.every((k) => mesh.aux[k] === aux));
const range = (pts, axis) => {
  let lo = Infinity,
    hi = -Infinity;
  for (const p of pts) {
    lo = Math.min(lo, p[axis]);
    hi = Math.max(hi, p[axis]);
  }
  return [lo, hi];
};
const cross = (a, b, c) => {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]],
    v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
};
const volume = (tris) =>
  tris.reduce((s, [a, b, c]) => {
    const p = P[a],
      q = P[b],
      r = P[c];
    return (
      s +
      (p[0] * (q[1] * r[2] - q[2] * r[1]) +
        p[1] * (q[2] * r[0] - q[0] * r[2]) +
        p[2] * (q[0] * r[1] - q[1] * r[0])) /
        6
    );
  }, 0);

// hull rings: body vertices sharing one exact z, many per ring (the dorsal fin has at most two)
const rings = (() => {
  const groups = new Map();
  for (const p of tagged(WHALE_PART.body)) {
    const key = p[2].toFixed(9);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  return [...groups.values()].filter((g) => g.length >= 16).sort((a, b) => a[0][2] - b[0][2]);
})();
const ringNear = (z) =>
  rings.reduce((best, r) => (Math.abs(r[0][2] - z) < Math.abs(best[0][2] - z) ? r : best));
const ringSize = (r) => ({
  halfWidth: (range(r, 0)[1] - range(r, 0)[0]) / 2,
  halfHeight: (range(r, 1)[1] - range(r, 1)[0]) / 2,
});

test("indices are valid, coordinates finite, every vertex used and no triangle degenerate", () => {
  assert.ok(P.length > 1000 && mesh.i.length > 2000);
  const used = new Uint8Array(P.length);
  for (const t of mesh.i) {
    for (const k of t) {
      assert.ok(Number.isInteger(k) && k >= 0 && k < P.length, `bad index ${k}`);
      used[k] = 1;
    }
    const n = cross(P[t[0]], P[t[1]], P[t[2]]);
    assert.ok(Math.hypot(...n) / 2 > 1e-8, `degenerate triangle ${t}`);
  }
  assert.ok(P.every((p) => p.every(Number.isFinite)));
  assert.equal(used.indexOf(0), -1, "unreferenced vertex");
  assert.ok(mesh.aux.every((a) => Object.values(WHALE_PART).includes(a)));
});

test("stays within the vertex budget and matches the recorded counts", () => {
  assert.ok(P.length <= 6000, `${P.length} vertices`);
  assert.equal(WHALE.vertices, P.length);
  assert.equal(WHALE.triangles, mesh.i.length);
});

test("is mirror symmetric about x = 0, part by part", () => {
  const key = (x, y, z, a) => `${a}|${x.toFixed(4)}|${y.toFixed(4)}|${z.toFixed(4)}`;
  const set = new Set(P.map((p, k) => key(Math.abs(p[0]) < 5e-5 ? 0 : p[0], p[1], p[2], mesh.aux[k])));
  for (let k = 0; k < P.length; k++) {
    const [x, y, z] = P[k],
      mx = Math.abs(x) < 5e-5 ? 0 : -x;
    assert.ok(set.has(key(mx, y, z, mesh.aux[k])), `no mirror for vertex ${k} (${x}, ${y}, ${z})`);
  }
});

test("every part is a closed surface with consistent winding", () => {
  for (const aux of Object.values(WHALE_PART)) {
    const edges = new Map();
    for (const [a, b, c] of trisOf(aux))
      for (const [u, v] of [[a, b], [b, c], [c, a]]) {
        const e = `${u}>${v}`;
        assert.ok(!edges.has(e), `edge ${e} used twice in the same direction (aux ${aux})`);
        edges.set(e, true);
      }
    for (const e of edges.keys()) {
      const [u, v] = e.split(">");
      assert.ok(edges.has(`${v}>${u}`), `open edge ${e} (aux ${aux})`);
    }
  }
  // no triangle mixes parts
  assert.equal(
    Object.values(WHALE_PART).reduce((n, a) => n + trisOf(a).length, 0),
    mesh.i.length,
  );
});

test("winding is outward: positive volume for the whole mesh and each part", () => {
  assert.ok(volume(mesh.i) > 0);
  for (const aux of Object.values(WHALE_PART))
    assert.ok(volume(trisOf(aux)) > 0, `part ${aux} is inside out`);
  // the hull alone: roughly an ellipsoid-ish body of a few cubic metres
  const body = volume(trisOf(WHALE_PART.body));
  assert.ok(body > 4 && body < 14, `body volume ${body}`);
  // and hull triangle normals face away from the ring centre line
  let away = 0,
    total = 0;
  for (const r of rings) {
    const z = r[0][2],
      [y0, y1] = range(r, 1),
      cy = (y0 + y1) / 2;
    for (const [a, b, c] of mesh.i) {
      if (P[a][2] !== z) continue;
      const n = cross(P[a], P[b], P[c]),
        m = [(P[a][0] + P[b][0] + P[c][0]) / 3, (P[a][1] + P[b][1] + P[c][1]) / 3 - cy];
      total++;
      if (n[0] * m[0] + n[1] * m[1] > 0) away++;
    }
  }
  assert.ok(total > 1000 && away / total > 0.99, `${away}/${total} hull normals face out`);
});

test("WHALE measurements agree with the built vertices", () => {
  const eps = 1e-3,
    near = (a, b, msg, e = eps) => assert.ok(Math.abs(a - b) <= e, `${msg}: ${a} vs ${b}`);
  const [zMin, zMax] = range(P, 2);
  near(WHALE.noseZ, zMax, "noseZ");
  near(WHALE.tailZ, zMin, "tailZ");
  near(WHALE.length, zMax - zMin, "length");
  near(WHALE.noseZ, 3.5, "nose frame", 0.05);
  assert.ok(WHALE.tailZ < -3.9 && WHALE.tailZ > -4.3, `tailZ ${WHALE.tailZ}`);

  const hullPts = rings.flat();
  near(WHALE.halfWidth, range(tagged(WHALE_PART.body), 0)[1], "halfWidth");
  near(WHALE.halfWidth, range(hullPts, 0)[1], "halfWidth (hull)");
  assert.ok(WHALE.halfWidth > 0.7 && WHALE.halfWidth < 0.9);
  assert.ok(WHALE.widestZ > -0.2 && WHALE.widestZ < 1.2, `widest at ${WHALE.widestZ}`);
  near(WHALE.halfHeight, Math.max(...rings.map((r) => ringSize(r).halfHeight)), "halfHeight");
  const [bodyLo, bodyHi] = range(tagged(WHALE_PART.body), 1);
  near(WHALE.top, bodyHi, "top");
  near(WHALE.bottom, bodyLo, "bottom");
  near(WHALE.hullTop, range(hullPts, 1)[1], "hullTop");
  assert.ok(Math.abs((WHALE.top + WHALE.bottom) / 2) < 0.15, "body centred near y = 0");

  near(WHALE.flukeSpan, 2 * range(tagged(WHALE_PART.fluke), 0)[1], "flukeSpan");
  near(WHALE.flipperSpan, 2 * range(tagged(WHALE_PART.flipper), 0)[1], "flipperSpan");

  const eyes = tagged(WHALE_PART.eye).filter((p) => p[0] > 0);
  for (let k = 0; k < 3; k++)
    near(WHALE.eye[k], eyes.reduce((s, p) => s + p[k], 0) / eyes.length, `eye[${k}]`);
  near(WHALE.eyeRadius, (range(eyes, 1)[1] - range(eyes, 1)[0]) / 2, "eyeRadius");

  // the flipper root is the innermost flipper station
  const flipper = tagged(WHALE_PART.flipper).filter((p) => p[0] > 0);
  near(WHALE.flipperRoot[0], range(flipper, 0)[0], "flipperRoot x", 0.03);
  const root = flipper.filter((p) => Math.abs(p[0] - WHALE.flipperRoot[0]) < 1e-6);
  assert.ok(root.length >= 3);
  for (const p of root) near(p[1], WHALE.flipperRoot[1], "flipperRoot y", 0.06);
  assert.ok(root.some((p) => p[2] > WHALE.flipperRoot[2]) && root.some((p) => p[2] < WHALE.flipperRoot[2]));

  // the blowhole sits on the top of the head
  assert.equal(WHALE.blowhole[0], 0);
  const head = ringNear(WHALE.blowhole[2]);
  assert.ok(Math.abs(head[0][2] - WHALE.blowhole[2]) < 0.12);
  near(WHALE.blowhole[1], range(head, 1)[1], "blowhole on the back", 0.03);
  assert.ok(WHALE.blowhole[2] > 1.2 && WHALE.blowhole[2] < WHALE.noseZ - 0.8);
  assert.ok(Object.isFrozen(WHALE) && Object.isFrozen(WHALE.eye));
});

test("the head is broad and blunt, not a pointed rostrum", () => {
  const near = ringSize(ringNear(WHALE.noseZ - 0.25)),
    tip = ringSize(ringNear(WHALE.noseZ - 0.1)),
    jaw = ringSize(ringNear(WHALE.noseZ - 0.6));
  assert.ok(near.halfWidth >= 0.45 * WHALE.halfWidth, `width 0.25 m back: ${near.halfWidth}`);
  assert.ok(near.halfHeight >= 0.45 * WHALE.halfHeight, `height 0.25 m back: ${near.halfHeight}`);
  assert.ok(tip.halfWidth >= 0.25 * WHALE.halfWidth, `width 0.1 m back: ${tip.halfWidth}`);
  assert.ok(jaw.halfWidth >= 0.65 * WHALE.halfWidth && jaw.halfHeight >= 0.55 * WHALE.halfHeight);
  // fuller below than above near the head (throat), flattened top
  const head = ringNear(2.2),
    [lo, hi] = range(head, 1),
    side = head.reduce((m, p) => (p[0] > m[0] ? p : m));
  assert.ok(side[1] - lo > hi - side[1], "throat deeper than the back above the widest line");
});

test("the body is widest at the shoulders and tapers to a laterally compressed peduncle", () => {
  const shoulder = ringSize(ringNear(0.6)),
    mid = ringSize(ringNear(-1.5)),
    peduncle = ringSize(ringNear(-3.0));
  assert.ok(shoulder.halfWidth > mid.halfWidth && mid.halfWidth > peduncle.halfWidth);
  assert.ok(peduncle.halfWidth < 0.25 * WHALE.halfWidth);
  assert.ok(peduncle.halfHeight > 1.3 * peduncle.halfWidth, "peduncle taller than wide");
  // the widths fall monotonically from the shoulders to the tail
  const aft = rings.filter((r) => r[0][2] < 0.6 && r[0][2] > -3.3).map((r) => ringSize(r).halfWidth);
  for (let k = 1; k < aft.length; k++) assert.ok(aft[k] >= aft[k - 1] - 1e-9);
});

test("flukes are wide, thin, horizontal, swept, with a median notch", () => {
  const fluke = tagged(WHALE_PART.fluke),
    [x0, x1] = range(fluke, 0),
    [y0, y1] = range(fluke, 1),
    [z0, z1] = range(fluke, 2);
  const span = x1 - x0;
  assert.ok(span >= 2.6 && span <= 3.4, `span ${span}`);
  assert.ok(span > 10 * (y1 - y0), "horizontal, not a vertical fish tail");
  assert.ok(z1 < -2.9, "attached at the peduncle, aft of z = -2.9");
  assert.ok(z0 > -4.3);
  // the root is buried in the peduncle
  const ped = ringNear(z1);
  assert.ok(Math.abs(ped[0][2] - z1) < 0.15);
  // trailing edge: forward at the centre (notch), aft at the lobes, swept back to the tips
  const te = (x) =>
    Math.min(...fluke.filter((p) => Math.abs(p[0] - x) < 0.05).map((p) => p[2]));
  const le = (x) =>
    Math.max(...fluke.filter((p) => Math.abs(p[0] - x) < 0.05).map((p) => p[2]));
  assert.ok(te(0) > te(0.45) + 0.15, `notch ${te(0)} vs lobe ${te(0.45)}`);
  assert.ok(te(0) > te(-0.45) + 0.15);
  assert.ok(le(1.2) < le(0) - 0.3, "leading edge swept back");
  const tip = fluke.reduce((m, p) => (p[0] > m[0] ? p : m));
  assert.ok(tip[2] < te(0), "tips trail behind the notch");
});

test("pectoral flippers are long blades reaching well beyond the body, flapping from |x| ~ 0.6", () => {
  const flipper = tagged(WHALE_PART.flipper);
  assert.ok(flipper.every((p) => Math.abs(p[0]) >= 0.55), "flipper vertex inside |x| = 0.55");
  assert.ok(flipper.filter((p) => p[0] > 0).length === flipper.filter((p) => p[0] < 0).length);
  assert.ok(WHALE.flipperSpan / 2 > WHALE.halfWidth + 1);
  const reach = Math.max(
    ...flipper.filter((p) => p[0] > 0).map((p) => Math.hypot(...p.map((v, k) => v - WHALE.flipperRoot[k]))),
  );
  assert.ok(reach > 1.7 && reach < 2.7, `flipper length ${reach}`);
  // root near the body side at z ~ 1.4, tip out, back and down
  assert.ok(Math.abs(WHALE.flipperRoot[0] - 0.6) < 0.06 && Math.abs(WHALE.flipperRoot[2] - 1.4) < 0.2);
  assert.ok(WHALE.flipperTip[2] < WHALE.flipperRoot[2] - 0.8 && WHALE.flipperTip[1] < WHALE.flipperRoot[1] - 0.3);
  // flattened: thin compared with its chord (vertices near mid-span lie close to a plane)
  const midSpan = flipper.filter((p) => p[0] > 1.2 && p[0] < 1.3),
    [my0, my1] = range(midSpan, 1),
    [mz0, mz1] = range(midSpan, 2);
  assert.ok(mz1 - mz0 > 2 * (my1 - my0) || my1 - my0 < 0.25, "flipper blade is flat");
});

test("a small low dorsal fin rises from the back about two-thirds of the way aft", () => {
  const hull = new Set(rings.flat());
  const fin = tagged(WHALE_PART.body).filter((p) => !hull.has(p) && p[1] > 0.3);
  const back = ringNear(WHALE.dorsalZ),
    backTop = range(back, 1)[1];
  const above = fin.filter((p) => p[1] > backTop + 0.05);
  assert.ok(above.length > 5, "fin sticks out of the back");
  assert.ok(Math.max(...above.map((p) => p[1])) < backTop + 0.3, "fin is low");
  assert.ok(above.every((p) => Math.abs(p[0]) < 0.08), "fin is thin and on the midline");
  const frac = (WHALE.noseZ - WHALE.dorsalZ) / (WHALE.noseZ - WHALE.hullTailZ);
  assert.ok(frac > 0.55 && frac < 0.8, `dorsal at ${frac}`);
});

test("two small eyes sit low on the head, proud of the surface", () => {
  const eyes = tagged(WHALE_PART.eye);
  const left = eyes.filter((p) => p[0] > 0),
    right = eyes.filter((p) => p[0] < 0);
  assert.ok(left.length > 10 && left.length === right.length);
  const [ex, ey, ez] = WHALE.eye;
  assert.ok(ez > 1.6 && ez < WHALE.noseZ - 0.6, "on the head, behind the snout");
  assert.ok(ey < 0 && ey > WHALE.bottom * 0.6, "low on the side");
  assert.ok(WHALE.eyeRadius < 0.12);
  // outermost eye point is outside the hull ring at the eye's height
  const ring = ringNear(ez).filter((p) => p[0] > 0).sort((a, b) => a[1] - b[1]);
  let surface = 0;
  for (let k = 0; k < ring.length - 1; k++) {
    const a = ring[k],
      b = ring[k + 1];
    if (a[1] <= ey && b[1] >= ey) surface = a[0] + ((b[0] - a[0]) * (ey - a[1])) / (b[1] - a[1] || 1);
  }
  assert.ok(surface > 0.4, "found the hull surface at the eye");
  assert.ok(range(left, 0)[1] > surface + 0.01, "eye is not buried");
  assert.ok(ex < surface + WHALE.eyeRadius, "eye is attached, not floating");
});
