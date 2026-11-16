// ============================================================================
// whale race (TheWhale): course, racers, cameras and the HUD contract
// ============================================================================
// Joined after vendor/abyssal/main.js and before audio.js inside startGarden({ ui: raceUI, callbacks }), so it
// shares the renderer's scope (device, F, render, collide, Mesh, S_B, ...). The race rules are in race-model.js,
// imported as `raceModel` by the Vite plugin, with the whale geometry (`buildWhale`, `WHALE`) from whale-mesh.js and
// the pure camera framing helpers from camera-model.js. Keys are bound by the HUD; input arrives through `callbacks`.
const RM = raceModel;

// ---------------------------------------------------------------- course
// The upstream flight path: the world generator keeps it clear of kelp, rocks and sponges. It starts with a short
// hook, so the race begins 3.5 m in, and it runs low over the sea floor, so the racers ride a little higher.
// Both racers are the same humpback mesh (7.6 m at scale 1): the rival at 6.5 m, the player a little smaller at
// 5.2 m. The player swims freely in world space; only the rival follows the course. It keeps a lane to the right
// and gives way, sideways and then upwards, while the player is alongside.
const R_SKIP = 3.5, R_LIFT = 0.6, R_WLANE = 1.8, R_WMAX = 3.2, R_WSCALE = 0.85, R_PSCALE = 0.68;
const R_APART = (WHALE.halfWidth * (R_WSCALE + R_PSCALE) + 1.35), R_NEAR = WHALE.length * (R_WSCALE + R_PSCALE) / 2;
const R_GATE_RIM = 0.75, R_BEADS = 3; // a gate ring is this much wider than the gate; guide beads between gates
const raceCourse = (() => {
  const pts = []; let px = 0, py = 0, pz = 0, run = 0;
  for (let k = 0; k <= LUTN; k++) {
    F[SPL] = flyLUT[k]; flyRaw();
    if (k) run += hypot(F[CX] - px, F[CY] - py, F[CZ] - pz);
    px = F[CX]; py = F[CY]; pz = F[CZ];
    if (run >= R_SKIP) pts.push(px, py + R_LIFT, pz);
  }
  return RM.createCourse(pts);
})();
const race = RM.createRace(raceCourse);

// position + travel frame at distance s with sideways / vertical offsets: RB = pos, forward, right, up
const RB = new Float64Array(12), RP = new Float64Array(12), RW = new Float64Array(12), RQ = new Float64Array(4);
function raceBasis(s, lx, ly) {
  RM.sampleCourse(raceCourse, s, RB, 2.5);
  const fx = RB[3], fy = RB[4], fz = RB[5];
  let rx = -fz, rz = fx; const rl = sqrt(rx * rx + rz * rz) || 1; rx /= rl; rz /= rl;
  const ux = -rz * fy, uy = rz * fx - rx * fz, uz = rx * fy;
  RB[6] = rx; RB[7] = 0; RB[8] = rz; RB[9] = ux; RB[10] = uy; RB[11] = uz;
  RB[0] += rx * lx + ux * ly; RB[1] += uy * ly; RB[2] += rz * lx + uz * ly;
}
// The player's frame comes from its own heading, never from the route tangent.
function playerBasis(p) {
  const sy = sin(p.yaw), cy = cos(p.yaw), sp = sin(p.pitch), cp = cos(p.pitch);
  RP[0] = p.x; RP[1] = p.y; RP[2] = p.z;
  RP[3] = sy * cp; RP[4] = sp; RP[5] = -cy * cp;
  RP[6] = cy; RP[7] = 0; RP[8] = sy;
  RP[9] = -sy * sp; RP[10] = cp; RP[11] = cy * sp;
}
// rotation taking the mesh frame (+x left, +y up, +z forward) to the frame in B, rolled by `bank`, into RQ
function raceQuat(B, bank) {
  const cb = cos(bank), sb = sin(bank);
  const X0 = -B[6], X1 = -B[7], X2 = -B[8], Y0 = B[9], Y1 = B[10], Y2 = B[11];
  const m00 = X0 * cb + Y0 * sb, m10 = X1 * cb + Y1 * sb, m20 = X2 * cb + Y2 * sb;
  const m01 = Y0 * cb - X0 * sb, m11 = Y1 * cb - X1 * sb, m21 = Y2 * cb - X2 * sb;
  const m02 = B[3], m12 = B[4], m22 = B[5], tr = m00 + m11 + m22;
  if (tr > 0) { const S = sqrt(tr + 1) * 2; RQ[3] = 0.25 * S; RQ[0] = (m21 - m12) / S; RQ[1] = (m02 - m20) / S; RQ[2] = (m10 - m01) / S; }
  else if (m00 > m11 && m00 > m22) { const S = sqrt(1 + m00 - m11 - m22) * 2; RQ[3] = (m21 - m12) / S; RQ[0] = 0.25 * S; RQ[1] = (m01 + m10) / S; RQ[2] = (m02 + m20) / S; }
  else if (m11 > m22) { const S = sqrt(1 + m11 - m00 - m22) * 2; RQ[3] = (m02 - m20) / S; RQ[0] = (m01 + m10) / S; RQ[1] = 0.25 * S; RQ[2] = (m12 + m21) / S; }
  else { const S = sqrt(1 + m22 - m00 - m11) * 2; RQ[3] = (m10 - m01) / S; RQ[0] = (m02 + m20) / S; RQ[1] = (m12 + m21) / S; RQ[2] = 0.25 * S; }
}
// distance to the rock at any point (metres, > 0 inside, clamped to ±1), from the collision bricks in main.js
function rockDist(x, y, z) {
  const gx = (x - OX) / VS - CO, gy = (y - OY) / VS, gz = (z - OZ) / VS - CO;
  if (!(gx >= 0 && gz >= 0 && gy >= 0 && gx < CN * 4 - 1 && gz < CN * 4 - 1 && gy < NY - 1)) return -1;
  const ix = gx | 0, iy = gy | 0, iz = gz | 0, u = gx - ix, v = gy - iy, a = cv(ix, iy, iz), b = cv(ix, iy + 1, iz), c = cv(ix, iy, iz + 1), d = cv(ix, iy + 1, iz + 1);
  const p = a + (cv(ix + 1, iy, iz) - a) * u, q = b + (cv(ix + 1, iy + 1, iz) - b) * u, r = c + (cv(ix + 1, iy, iz + 1) - c) * u, s = d + (cv(ix + 1, iy + 1, iz + 1) - d) * u;
  const e = p + (q - p) * v; return (e + (r + (s - r) * v - e) * (gz - iz)) / 127;
}
// Resolve a fixed-step world move against terrain. A collision stops forward movement; it never turns the whale
// or pulls it back to the race line. Steering remains available while blocked, so the player can turn away.
race.resolvePlayerMotion = (p, previous) => {
  const bounded = p.y >= -52 && p.y <= -1.2 && hypot(p.x, p.z) < 150;
  const clearance = rockDist(p.x, p.y, p.z);
  if (bounded && (clearance < -0.75 || clearance < rockDist(previous.x, previous.y, previous.z))) return;
  p.x = previous.x; p.y = previous.y; p.z = previous.z;
  p.speed *= 0.65;
};

// ---------------------------------------------------------------- racer meshes (solid vertex format, aux = part)
// The whale comes from whale-mesh.js: aux 1 body, 0.5 flippers, 0.2 flukes, -1 eyes. Both racers draw the same mesh.
// ring in the xy plane, radius 1, facing +z
function meshRaceRing(r, NU) {
  const m = new Mesh(), NV = 8, idx = [];
  for (let i = 0; i < NU; i++) {
    const a = i / NU * TAU, row = [];
    for (let j = 0; j < NV; j++) { const b = j / NV * TAU, rr2 = 1 + r * cos(b); row.push(m.v(cos(a) * rr2, sin(a) * rr2, r * sin(b), 1)); }
    idx.push(row);
  }
  for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const i2 = (i + 1) % NU, j2 = (j + 1) % NV; m.quad(idx[i][j], idx[i2][j], idx[i2][j2], idx[i][j2]); }
  return m;
}
const raceMeshes = [buildWhale(new Mesh()), meshRaceRing(0.045, 64), meshRaceRing(0.3, 16)].map((m) => m.build());
let rNV = 0, rNI = 0;
for (const m of raceMeshes) { m.v0 = rNV; m.i0 = rNI; rNV += m.nv; rNI += m.ib.length; }
const vbRace = (() => { const a = new Uint8Array(rNV * 16); for (const m of raceMeshes) a.set(new Uint8Array(m.vb), m.v0 * 16); return buf(a, BU.VERTEX); })();
const ixRace = (() => { const a = new Uint32Array(rNI); for (const m of raceMeshes) a.set(m.ib, m.i0); return buf(a, BU.INDEX); })();
const [R_WHALE, R_RING, R_BEAD] = raceMeshes;

// course rings: a gold ring on the start and the finish, and between them the steering gates, each a ring off the
// course line that the player has to swim through. Small beads trace the line from one gate to the next.
const raceGates = raceCourse.gates, R_NG = raceGates.length, R_NR = R_NG + 2, R_NB = (R_NG + 1) * R_BEADS;
const raceBeads = [];
for (let i = 0; i <= R_NG; i++) {
  const s0 = i ? raceGates[i - 1].s : 0, s1 = i < R_NG ? raceGates[i].s : raceCourse.length;
  for (let k = 1; k <= R_BEADS; k++) raceBeads.push(s0 + (s1 - s0) * k / (R_BEADS + 1));
}
const R_NI = 2 + R_NR + R_NB, RI = new Float32Array(R_NI * 12);
const ibRace = device.createBuffer({ size: RI.byteLength, usage: BU.VERTEX | BU.COPY_DST });
// instance: position + scale, rotation, then (kind, phase, param, hi). Whales are kind 0: param = tail-beat
// strength, hi = 0 for the rival and 1 for the player. Rings and beads are kind 1: hi = brightness, param = style
// (0 bead, 1 gate ahead, 2 start / finish, 3 next gate with the player lined up, 4 gate taken, 5 gate missed).
function racePut(n, B, sc, kind, ph, param, hi) {
  const o = n * 12;
  RI[o] = B[0]; RI[o + 1] = B[1]; RI[o + 2] = B[2]; RI[o + 3] = sc;
  RI[o + 4] = RQ[0]; RI[o + 5] = RQ[1]; RI[o + 6] = RQ[2]; RI[o + 7] = RQ[3];
  RI[o + 8] = kind; RI[o + 9] = ph; RI[o + 10] = param; RI[o + 11] = hi;
}
const RL = [0, 0];
function placeCourse() {
  raceBasis(0, 0, 0.3); raceQuat(RB, 0); racePut(2, RB, 4, 1, 0, 2, 0.5);
  raceBasis(raceCourse.length, 0, 0.3); raceQuat(RB, 0); racePut(3 + R_NG, RB, 4, 1, 0, 2, 0.5);
  raceGates.forEach((g, i) => { raceBasis(g.s, g.x, g.y); raceQuat(RB, 0); racePut(3 + i, RB, g.r + R_GATE_RIM, 1, 0, 1, 0.5); });
  raceBeads.forEach((s, i) => { RM.courseLine(raceCourse, s, RL); raceBasis(s, RL[0], RL[1]); raceQuat(RB, 0); racePut(2 + R_NR + i, RB, 0.38, 1, 0, 0, 0.5); });
}

// ---------------------------------------------------------------- racer shader: scene lighting from S_B
const W_RACE = S_B + /*wgsl*/`
struct VI { @location(0) p: vec3f, @location(1) n: vec4f, @location(2) a: vec4f, @location(3) b: vec4f, @location(4) c: vec4f };
struct VO { @builtin(position) cp: vec4f, @location(0) wp: vec3f, @location(1) n: vec3f, @location(2) op: vec3f, @location(3) on: vec3f,
  @location(4) @interpolate(flat) k: vec4f, @location(5) @interpolate(flat) aux: f32 };
@vertex fn vs(i: VI) -> VO {
  var o: VO;
  let kind = i32(i.c.x + .5); let ph = i.c.y; let aux = i.n.w;
  var l = i.p; var n = i.n.xyz;
  if (kind == 0) {
    // whale: a wave of vertical flex travels from the shoulders to the flukes and grows towards the tail (t = 0 at the shoulders, 1 at the flukes),
    // the flukes feather about the peduncle a quarter beat behind it, and the head nods gently against the stroke
    let t = clamp((1.2 - l.z) / 4.8, 0., 1.);
    let dtz = select(0., -1. / 4.8, t > 0. && t < 1.);
    let amp = .42 * i.c.z;
    let wv = ph + l.z * .75;
    let head = max(l.z - 1.2, 0.);
    let fk = max(-3.05 - l.z, 0.);
    let feather = .62 * i.c.z * cos(ph - 2.29);
    let nod = .035 * i.c.z * sin(ph - .9);
    l.y += amp * t * t * sin(wv) - .06 * i.c.z * sin(ph) - head * nod - fk * feather;
    // the displacement is a shear y(z), so the normal tilts by its slope
    let sl = amp * (2. * t * dtz * sin(wv) + .75 * t * t * cos(wv)) - select(0., nod, head > 0.) + select(0., feather, fk > 0.);
    n = vec3f(n.x, n.y, n.z - sl * n.y);
    // flippers scull slowly, rising and falling from the root outwards
    if (abs(aux - .5) < .08) { l.y += (abs(l.x) - .6) * (.2 + .08 * i.c.z) * sin(ph * .5 + .8); }
  }
  let w = i.a.xyz + qrot(i.b, l * i.a.w);
  o.cp = g.vp * vec4f(w, 1.); o.wp = w; o.n = qrot(i.b, n); o.op = i.p; o.on = n; o.k = i.c; o.aux = aux;
  return o;
}
@fragment fn fs(i: VO, @builtin(front_facing) ff: bool) -> @location(0) vec4f {
  let kind = i32(i.k.x + .5);
  let fl_ = select(-1., 1., ff);
  let N = normalize(i.n) * fl_; let on = normalize(i.on) * fl_;
  let dist = length(i.wp - g.cam.xyz);
  let ca = caus(i.wp, dist);
  let tx = textureSample(tD, sR, i.op.xz * .35 + i.op.y * .2);
  let V = normalize(g.cam.xyz - i.wp); let L = g.sun.xyz;
  let z = zone(i.wp); let vv = vol(i.wp);
  let ndv = sat(dot(N, V));
  if (kind == 1) {
    // course ring: cyan beads and gates, gold start and finish. The next gate glows brightest and turns the player
    // whale's lime once the player is lined up with it; a gate taken stays lime, a gate missed turns red.
    var base = select(vec3f(.2, .85, 1.), vec3f(1.5, 1.05, .3), i.k.z > 1.5);
    if (i.k.z > 2.5) { base = vec3f(.7, 1.5, .2); }
    if (i.k.z > 4.5) { base = vec3f(1.6, .22, .16); }
    let lit = mix(.15, 1., i.k.w) * select(.6, 1., i.k.z > .5);
    let pulse = .8 + .2 * sin(g.cam.w * 5. - atan2(i.op.y, i.op.x) * 3.);
    return fin(fog(base * lit * (1.6 * pulse + .8 * pow(1. - ndv, 2.)), i.wp, z));
  }
  // whale: countershaded, with throat grooves under the head. The rival is a blue-black humpback; the player is a
  // pale lime-gold whale, the colour of its HUD marker, bright enough to hold that tint through the blue water.
  let own = i.k.w > .5;
  var gloss = .35;
  let top = ss(-.3, .25, on.y);
  var belly = select(vec3f(.78, .8, .8), vec3f(.96, .93, .74), own) * (.85 + .3 * tx.b);
  belly *= 1. - .45 * ss(.55, .9, sin(i.op.x * 34.)) * ss(-.2, 1., i.op.z) * (1. - top);
  var back = select(vec3f(.045, .065, .095), vec3f(.5, .62, .13), own) * (.8 + .5 * tx.a);
  back = mix(back, select(vec3f(.5, .55, .58), vec3f(.9, .95, .6), own), ss(.72, .9, tx.a) * .35);
  var alb = mix(belly, back, top);
  let pale = select(vec3f(.85, .88, .88), vec3f(.97, .95, .78), own);
  if (abs(i.aux - .5) < .08) { alb = mix(pale, back, top * .6); }
  if (abs(i.aux - .2) < .08) { alb = mix(pale * (.6 + .5 * tx.b), back, top); }
  if (i.aux < -.5) { alb = vec3f(.01); gloss = 1.; }
  let emi = alb * select(.05, .16, own);
  let E = sunE(i.wp.y, z) * shadow4(i.wp + N * .3);
  let ndl = sat(dot(N, L));
  let fillN = vec3f(N.x, abs(N.y) * .5 + .3, N.z);
  var c = alb * (E * ndl * (.3 + ca) + amb(i.wp, fillN, vv.g, z) * 1.2 + side(i.wp, N, 1., z) * .8) + emi;
  c += E * pow(sat(dot(N, normalize(V + L))), mix(12., 60., gloss)) * gloss * (.3 + ca) * .8;
  c += amb(i.wp, vec3f(0., 1., 0.), vv.g, z) * pow(1. - ndv, 3.) * .45;
  return fin(fog(c, i.wp, z));
}
`;
device.pushErrorScope('validation');
const pRace = scenePipe(mod(W_RACE), 'vs', 'fs', [vbSolid, ibSolid]);
const raceGpuCheck = device.popErrorScope();

// ---------------------------------------------------------------- per-frame race, racers and camera
let rCam = 'chase', rSnap = true, rSide = 1, rSideT = 0, rReady = false, rUiT = 0, rLastPhase = '', rLastCam = '';
let rPh = 0, rWPh = 0, rPAmp = 0.6, rBank = 0, rWFit = 1, rWLane = R_WLANE, rWRise = 0, rHide = false;
let rLastGate = 0, rGateT = 9;
function drawRace(r) {
  if (!rReady) return;
  r.setPipeline(pRace); r.setVertexBuffer(0, vbRace); r.setVertexBuffer(1, ibRace); r.setIndexBuffer(ixRace, 'uint32');
  r.drawIndexed(R_WHALE.ib.length, 1, R_WHALE.i0, R_WHALE.v0, 0);
  // the player whale is left out when the camera is inside its body: first person, or a boom cut short by rock
  if (!rHide) r.drawIndexed(R_WHALE.ib.length, 1, R_WHALE.i0, R_WHALE.v0, 1);
  r.drawIndexed(R_RING.ib.length, R_NR, R_RING.i0, R_RING.v0, 2);
  r.drawIndexed(R_BEAD.ib.length, R_NB, R_BEAD.i0, R_BEAD.v0, 2 + R_NR);
}

// camera target for the current mode: RC = position, look-at point
const RC = new Float64Array(6);
function cameraTarget(dt) {
  const ag = hypot(RW[0] - RP[0], RW[1] - RP[1], RW[2] - RP[2]);
  const wt = ag <= 40 ? 0.5 : 20 / ag; // frame both racers while they are close, else stay on the player
  const asp = W / max(H, 1);
  const mx = RP[0] + (RW[0] - RP[0]) * wt, my = RP[1] + (RW[1] - RP[1]) * wt, mz = RP[2] + (RW[2] - RP[2]) * wt;
  if (rCam === 'first-person') {
    // from the player whale's snout, just above the eye line
    const e = firstPersonEye(WHALE, R_PSCALE);
    RC[0] = RP[0] + RP[3] * e.forward + RP[9] * e.up; RC[1] = RP[1] + RP[4] * e.forward + RP[10] * e.up; RC[2] = RP[2] + RP[5] * e.forward + RP[11] * e.up;
    RC[3] = RC[0] + RP[3] * 12; RC[4] = RC[1] + RP[4] * 12; RC[5] = RC[2] + RP[5] * 12;
  } else if (rCam === 'side') {
    const d = sideDistance(min(ag, 40), R_NEAR / 2, asp, TANH), rx = RP[6], rz = RP[8];
    // stay on the side with open water
    if ((rSideT -= dt) <= 0) {
      rSideT = 0.6;
      if (rockDist(mx + rx * d * rSide, my + 1.5, mz + rz * d * rSide) > -0.5 && rockDist(mx - rx * d * rSide, my + 1.5, mz - rz * d * rSide) < -0.5) { rSide = -rSide; rSnap = true; }
    }
    RC[0] = mx + rx * d * rSide; RC[1] = my + 1.5; RC[2] = mz + rz * d * rSide; RC[3] = mx; RC[4] = my; RC[5] = mz;
  } else if (rCam === 'overhead') {
    const hgt = 14 + 0.25 * min(ag, 30);
    RC[0] = mx - RP[3] * 4; RC[1] = my + hgt; RC[2] = mz - RP[5] * 4; RC[3] = mx + RP[3] * 1.5; RC[4] = my; RC[5] = mz + RP[5] * 1.5;
  } else {
    // behind and above the flukes; the boom lengthens on a portrait screen so the flippers and the rival's lane fit
    const b = chaseBoom(WHALE, R_PSCALE, asp, TANH);
    RC[0] = RP[0] - RP[3] * b.back + RP[9] * b.up;
    RC[1] = RP[1] - RP[4] * b.back + RP[10] * b.up;
    RC[2] = RP[2] - RP[5] * b.back + RP[11] * b.up;
    RC[3] = RP[0] + RP[3] * b.ahead + RP[9] * 0.3; RC[4] = RP[1] + RP[4] * b.ahead + RP[10] * 0.3; RC[5] = RP[2] + RP[5] * b.ahead + RP[11] * 0.3;
  }
  if (RC[1] > -1.5) RC[1] = -1.5;
}
// The terrain collision grid does not include the shipwreck. Use its actual
// instance transform and mesh bounds to keep the camera boom below the hull.
const shipCameraBounds = (() => {
  const mesh = meshes[11], vertices = new Float32Array(mesh.vb);
  const lower = [Infinity, Infinity, Infinity], upper = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < vertices.length; i += 4) for (let k = 0; k < 3; k++) {
    lower[k] = min(lower[k], vertices[i + k]); upper[k] = max(upper[k], vertices[i + k]);
  }
  return { lower, upper, instance: Wd.solids.ranges[11][0] * 12 };
})();
const boomLocalA = new Float64Array(3), boomLocalB = new Float64Array(3);
function shipLocal(x, y, z, out) {
  const i = shipCameraBounds.instance, a = Wd.solids.data;
  x = (x - a[i]) / a[i + 3]; y = (y - a[i + 1]) / a[i + 3]; z = (z - a[i + 2]) / a[i + 3];
  const qx = -a[i + 4], qy = -a[i + 5], qz = -a[i + 6], qw = a[i + 7];
  const tx = 2 * (qy * z - qz * y), ty = 2 * (qz * x - qx * z), tz = 2 * (qx * y - qy * x);
  out[0] = x + qw * tx + qy * tz - qz * ty;
  out[1] = y + qw * ty + qz * tx - qx * tz;
  out[2] = z + qw * tz + qx * ty - qy * tx;
}

// ---------------------------------------------------------------- gates in open water
// The model's gate pattern knows nothing of the canyon, so each gate is fitted here once, before the first frame:
// its ring, a whale's width around it and the water on the way in and out must be clear of rock and of the wreck.
// A gate that is not is tried mirrored, then closer to the course line, and at worst sits on the line itself.
// Player movement uses the same terrain clearance; the route is only a guide through this open water.
const GQ = new Float64Array(9);
function waterAt(s, x, y, side, above, below, margin) {
  raceBasis(s, x, y); GQ.set(RB.subarray(0, 3)); GQ[3] = RB[6]; GQ[4] = RB[8]; GQ[6] = RB[9]; GQ[7] = RB[10]; GQ[8] = RB[11];
  const at = (r, u) => {
    const px = GQ[0] + GQ[3] * r + GQ[6] * u, py = GQ[1] + GQ[7] * u, pz = GQ[2] + GQ[4] * r + GQ[8] * u;
    if (rockDist(px, py, pz) > margin) return false;
    shipLocal(px, py, pz, boomLocalA);
    for (let k = 0; k < 3; k++) if (boomLocalA[k] < shipCameraBounds.lower[k] - 0.5 || boomLocalA[k] > shipCameraBounds.upper[k] + 0.5) return true;
    return false;
  };
  return at(0, 0) && at(side, 0) && at(-side, 0) && at(0, above) && at(0, -below);
}
const gateFits = (g, x, y) => waterAt(g.s, x, y, 1.1, 0.9, 0.8, -0.85) && [-9, -4.5, 4.5, 9].every((d) => waterAt(g.s + d, x, y, 0.7, 0.5, 0.5, -0.8));
const raceGateFit = { moved: 0, centred: 0 };
{
  for (const g of raceGates) {
    const tries = [];
    for (const k of [1, 0.8, 0.6, 0.45]) tries.push([g.x * k, g.y * k], [-g.x * k, g.y * k], [g.x * k, g.y * k + 0.4], [-g.x * k, g.y * k + 0.4]);
    const fit = tries.find(([x, y]) => gateFits(g, x, y));
    if (fit && fit[0] === g.x && fit[1] === g.y) continue;
    raceGateFit.moved++; if (!fit) raceGateFit.centred++;
    g.x = fit ? fit[0] : 0; g.y = fit ? fit[1] : 0;
  }
  // the line between gates: where it meets rock, pull the nearer gate in until it does not
  for (let pass = 0, bad = true; bad && pass < 6; pass++) {
    bad = false;
    for (let s = 3; s < raceCourse.length; s += 3) {
      RM.courseLine(raceCourse, s, RL);
      if (waterAt(s, RL[0], RL[1], 0.6, 0.4, 0.4, -0.75)) continue;
      let near = null; for (const g of raceGates) if (!near || abs(g.s - s) < abs(near.s - s)) near = g;
      if (!near || abs(near.x) + abs(near.y) < 0.05) continue;
      near.x *= 0.6; near.y *= 0.6; if (abs(near.x) + abs(near.y) < 0.05) near.x = near.y = 0;
      bad = true; raceGateFit.moved++;
    }
  }
  if (raceGateFit.moved) console.info(`race: ${raceGateFit.moved} gate adjustments for rock, ${raceGateFit.centred} on the course line`, raceGates.map((g) => [+g.x.toFixed(2), +g.y.toFixed(2)]));
  placeCourse();
}

function clearCameraBoom() {
  if (rCam === 'first-person') return;
  const x = RP[0], y = RP[1], z = RP[2];
  const dx = RC[0] - x, dy = RC[1] - y, dz = RC[2] - z;
  const length = hypot(dx, dy, dz);
  if (length < 0.1) return;
  let fraction = 1;
  shipLocal(x, y, z, boomLocalA); shipLocal(RC[0], RC[1], RC[2], boomLocalB);
  const hit = segmentBoxEntry(boomLocalA, boomLocalB, shipCameraBounds.lower, shipCameraBounds.upper);
  if (hit !== null) fraction = max(0, hit - 0.65 / length);
  // A clear camera position can still look through a rock arch. Trace the boom
  // from the player, so it shortens before the first obstruction on that ray.
  for (let distance = 0.75; distance < length * fraction; distance += 0.5) {
    const t = distance / length;
    if (rockDist(x + dx * t, y + dy * t, z + dz * t) > -0.35) {
      fraction = max(0, (distance - 0.65) / length); break;
    }
  }
  if (fraction < 1) {
    RC[0] = x + dx * fraction; RC[1] = y + dy * fraction; RC[2] = z + dz * fraction;
    RC[3] = x; RC[4] = y; RC[5] = z;
    // Avoid smoothing the camera through the intervening hull or cliff.
    rSnap = true;
  }
}

// Move the camera towards its target through collide(). A snap starts at the player's actual position.
function placeCamera(dt) {
  cameraTarget(dt);
  clearCameraBoom();
  if (rSnap) {
    F[CX] = RP[0]; F[CY] = RP[1]; F[CZ] = RP[2];
    F[MX] = RC[0] - F[CX]; F[MY] = RC[1] - F[CY]; F[MZ] = RC[2] - F[CZ]; rSnap = false;
  } else {
    const k = 1 - exp(-dt * (rCam === 'first-person' ? 40 : 5));
    F[MX] = (RC[0] - F[CX]) * k; F[MY] = (RC[1] - F[CY]) * k; F[MZ] = (RC[2] - F[CZ]) * k;
  }
  F[VX] = F[VY] = F[VZ] = 0;
  collide();
  if (F[CY] > -1.3) F[CY] = -1.3;
  // stuck behind rock: start over from the player next frame
  if (hypot(RC[0] - F[CX], RC[1] - F[CY], RC[2] - F[CZ]) > 10) rSnap = true;
  P6[0] = F[CX]; P6[1] = F[CY]; P6[2] = F[CZ]; P6[3] = RC[3]; P6[4] = RC[4]; P6[5] = RC[5]; aim();
  if (F[PIT] < -1.45) F[PIT] = -1.45; else if (F[PIT] > 1.45) F[PIT] = 1.45;
  // wherever rock, the wreck or the smoothing left the camera, never draw the player whale around it
  const ox = F[CX] - RP[0], oy = F[CY] - RP[1], oz = F[CZ] - RP[2];
  rHide = rCam === 'first-person' || insideBody(ox * RP[3] + oy * RP[4] + oz * RP[5], ox * RP[6] + oy * RP[7] + oz * RP[8], ox * RP[9] + oy * RP[10] + oz * RP[11], WHALE, R_PSCALE);
}

function raceFrame(dt) {
  RM.advance(race, dt);
  const p = race.player, w = race.whale, inp = race.input, t = F[TIME];
  playerBasis(p);
  // rival: weaves in its own lane, gives way sideways while the player is alongside and close, and is pulled
  // towards the course line where the lane meets rock
  raceBasis(w.s, R_WLANE, 0.3);
  const separation = hypot(RB[0] - RP[0], RB[1] - RP[1], RB[2] - RP[2]);
  const along = 1 - clamp((separation - R_NEAR) / 3, 0, 1);
  const want = max(R_WLANE, p.lx + R_APART), short = clamp((want - R_WMAX) / 1.2, 0, 1);
  rWLane += (min(want, R_WMAX) * along + R_WLANE * (1 - along) - rWLane) * (1 - exp(-dt * 3));
  rWRise += (along * short * (1.9 + max(p.ly, 0)) - rWRise) * (1 - exp(-dt * 3));
  const wlx = rWLane + 0.5 * sin(t * 0.45) * (1 - along), wly = 0.3 + 0.35 * sin(t * 0.31) + rWRise;
  let fit = 1;
  for (; fit > 0.05; fit *= 0.6) { raceBasis(w.s, wlx * fit, wly * fit); if (rockDist(RB[0], RB[1], RB[2]) <= -0.99) break; }
  rWFit += (fit - rWFit) * (1 - exp(-dt * 3));
  raceBasis(w.s, wlx * rWFit, wly * rWFit); RW.set(RB);
  // animation: the tail beats follow speed; the smaller player whale beats faster, and harder while boosting
  rPh = (rPh + dt * TAU * (0.26 + 0.034 * p.speed)) % (TAU * 64);
  rPAmp += ((p.boosting || p.surge > 0 ? 1.3 : p.stall > 0 ? 0.35 : clamp(0.5 + p.speed / 14, 0.5, 1.1)) - rPAmp) * (1 - exp(-dt * 5));
  rWPh = (rWPh + dt * TAU * (0.2 + 0.025 * w.speed)) % (TAU * 64);
  rBank += (((inp.right ? 1 : 0) - (inp.left ? 1 : 0)) * 0.4 - rBank) * (1 - exp(-dt * 4));
  raceQuat(RW, 0.12 * sin(t * 0.45 + 1.2)); racePut(0, RW, R_WSCALE, 0, rWPh, clamp(0.55 + w.speed / 16, 0.55, 1.2), 0);
  raceQuat(RP, rBank); racePut(1, RP, R_PSCALE, 0, rPh, rPAmp, 1);
  // rings: the next gate is the bright one, lime while the player is lined up with it; a gate just reached flashes
  // lime (taken) or red (missed) and then dims; beads are brightest on the stretch being swum
  const ng = race.gate, live = race.phase === 'racing' || race.phase === 'countdown' || race.phase === 'paused';
  if (ng !== rLastGate) { rGateT = ng > rLastGate ? 0 : 9; rLastGate = ng; } else rGateT += dt;
  const gNext = ng < R_NG ? raceGates[ng] : null, lined = gNext && RM.gateAim(race).aligned;
  RI[2 * 12 + 11] = race.phase === 'ready' ? 1 : p.s > 2 ? 0.12 : 0.5;
  RI[(3 + R_NG) * 12 + 11] = ng >= R_NG ? 1 : 0.5;
  for (let i = 0; i < R_NG; i++) {
    const o = (3 + i) * 12;
    if (i < ng) { RI[o + 10] = race.gateLog[i] ? 4 : 5; RI[o + 11] = 0.3 + (i === ng - 1 ? 0.7 * exp(-rGateT * 2.5) : 0); }
    else { RI[o + 10] = i === ng && lined && live ? 3 : 1; RI[o + 11] = i === ng ? 1 : i === ng + 1 ? 0.55 : 0.3; }
  }
  const sNext = gNext ? gNext.s : raceCourse.length;
  for (let i = 0; i < R_NB; i++) { const s = raceBeads[i]; RI[(2 + R_NR + i) * 12 + 11] = s < p.s ? 0.08 : s < sNext ? 1 : 0.35; }
  Q.writeBuffer(ibRace, 0, RI);
  placeCamera(dt);
  menu = race.phase !== 'racing' && race.phase !== 'countdown';
  if (race.phase !== rLastPhase || rCam !== rLastCam || ng !== rPushGate || (rUiT += dt) > 1 / 15) racePush();
}

// ---------------------------------------------------------------- HUD contract
let rPushGate = 0;
function racePush() {
  if (!rReady || dead) return;
  const s = RM.snapshot(race);
  const nextCheckpoint = raceCourse.checkpoints[race.checkpoint];
  const missedCheckpoint = Number.isFinite(nextCheckpoint) && race.player.s > nextCheckpoint + 0.5;
  const aimTarget = missedCheckpoint ? 'checkpoint' : s.gate >= s.gates ? 'finish' : 'ring';
  const a = aimTarget === 'ring' ? s : RM.checkpointAim(race);
  rUiT = 0; rLastPhase = s.phase; rLastCam = rCam; rPushGate = s.gate;
  hudSend({ phase: s.phase, camera: rCam, elapsed: s.elapsed, countdown: s.countdown, progress: s.progress, whaleProgress: s.whaleProgress,
    distance: s.distance, lead: s.lead, winner: s.winner, stamina: s.stamina, boosting: s.boosting, exhausted: s.exhausted,
    speed: s.speed, muted, quality: QNAME[LV], error: null,
    // steering gates: heading-relative aim (+ = turn right / up)
    aimX: a.aimX, aimY: a.aimY, aimYaw: a.aimYaw, aligned: a.aligned, aimTarget,
    hasAim: race.checkpoint < raceCourse.checkpoints.length,
    gateDistance: s.gateDistance, gate: s.gate, gates: s.gates, gateHits: s.gateHits,
    gateResult: s.gateResult, streak: s.streak, surge: s.surge, stalled: s.stalled });
}
// every callback states what the player wants; the HUD only changes once racePush() reports the new state
callbacks.start = () => { if (!rReady) return; sound(); if (RM.startRace(race)) { RM.clearInput(race); racePush(); } };
callbacks.pause = (paused) => { if (!rReady) return; if (RM.setPaused(race, paused === undefined ? undefined : !!paused)) { RM.clearInput(race); racePush(); } };
callbacks.restart = () => { if (!rReady) return; sound(); RM.restartRace(race); RM.clearInput(race); rSnap = true; racePush(); };
callbacks.camera = (id) => { if (!RM.CAMERAS.includes(id) || id === rCam) return; rCam = id; rSnap = true; if (rReady) racePush(); };
callbacks.input = (patch) => { if (rReady) RM.setInput(race, patch); };
callbacks.sound = (want) => { sound(); if ((want === undefined ? !muted : !!want) !== muted) mute(); racePush(); };
document.addEventListener('visibilitychange', () => { if (document.hidden && rReady) { RM.clearInput(race); if (RM.setPaused(race, true)) racePush(); } });
addEventListener('blur', () => RM.clearInput(race));

// ---------------------------------------------------------------- startup
// Not awaited: audio.js (joined after this file) has to run before any callback can reach sound() and mute().
(async () => {
  try {
    const err = await raceGpuCheck;
    if (err) fail('The racers could not be drawn: ' + err.message);
    await say('Letting the light in…', 1);
    rReady = true;
    raceFrame(0); render(); await Q.onSubmittedWorkDone();
    setTimeout(keep, 15e3, 'abyssalLoad', ''); // the load counts as survived after 15 s of frames
    racePush();
    requestAnimationFrame((t) => { F[LAST] = t; requestAnimationFrame(frame); });
  } catch (e) {
    console.error(e);
    rReady = false;
    hudSend({ phase: 'error', error: { code: /webgpu|gpu/i.test(e.message) ? 'webgpu' : 'startup', title: 'The race could not start', message: e.message } });
  }
})();
