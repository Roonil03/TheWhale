// Pure race mechanics for the whale race: no DOM, no GPU, no clocks.
// The renderer (race-engine.js) feeds it frame times; everything inside runs in
// fixed steps, so a race plays out the same at any frame rate.

export const STEP = 1 / 120;
export const COUNTDOWN = 3;
export const CHECKPOINTS = 8; // the finish is the last one
export const GATES_PER_CHECKPOINT = 2; // steering gates per checkpoint leg; the finish itself is not a gate
export const CAMERAS = ["chase", "first-person", "side", "overhead"];

export const TUNING = Object.freeze({
  glide: 0, // m/s with no forward input: the player drifts to a stop
  cruise: 7.5, // m/s of thrust along the heading while holding forward
  winded: 6.2, // cruise while exhausted
  boost: 12.5, // m/s while boosting
  accel: 2, // 1/s, exponential approach to the target speed
  drain: 0.26, // stamina per second of boost
  regen: 0.11, // stamina per second without boost
  recover: 0.3, // stamina needed to boost again after running dry
  gateRadius: 1, // m from a gate's centre that still counts as swimming through it
  gateBonus: 0.1, // stamina for swimming through a gate
  surgeTime: 1, // s of extra speed after a gate
  surgeSpeed: 3, // m/s
  stallTime: 1.4, // s of turbulence after missing a gate
  stallFactor: 0.6, // target speed in that turbulence
  missKeep: 0.8, // share of the current speed kept on a miss
  draftMin: 3, // m behind the whale where its wake helps
  draftMax: 14,
  draftRegen: 2.2, // regen multiplier in the wake
  draftSpeed: 0.6, // m/s added in the wake
  draftWidth: 6, // m from the course line where the wake still reaches
  yawRate: 1.4, // rad/s of turn holding left / right (a 5.4 m turn radius at cruise, 9 m at boost)
  pitchRate: 1.0, // rad/s holding up / down
  pitchMax: 1.05, // rad, the steepest climb or dive
  turnAccel: 7, // 1/s, how fast the turn rate follows the keys
  gateReach: 6, // m from a gate's centre where crossing its plane settles it there and then
  gatePass: 1.5, // m of course progress past a gate that was swum around before it counts as missed
  checkpointRadius: 10, // m from a checkpoint's centre (the finish too) that its plane must be crossed within
  projectWindow: 10, // m of course either side of the last progress searched for the new one
  offCourse: 12, // m from the course line reported as off course
  whaleCruise: 9,
  whaleRubber: 0.04, // m/s of whale speed per metre of gap
  whaleRubberMin: -0.6,
  whaleRubberMax: 1.2,
  coast: 2, // speed both racers settle to after the finish
  overrun: 15, // metres past the finish the racers may coast
});

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

// ---------------------------------------------------------------- course
// Gate centres as [right, up] metres from the course line, repeated along the course. Every one is more than a
// gate radius from the line, so a whale swimming straight down the line passes through none of them, and
// neighbours are close enough to turn between at full boost.
export const GATE_PATTERN = Object.freeze([
  [1.5, 0.2],
  [-1.4, 0.5],
  [-1.9, -0.3],
  [0.9, 1.1],
  [1.9, 0.3],
  [-0.6, 1.2],
  [-1.8, 0.4],
  [1.3, -0.4],
  [1.8, 0.8],
  [-1.5, 0.9],
  [0.4, 1.3],
  [1.7, -0.2],
  [-1.9, 0.5],
  [-1.2, 1.0],
  [1.4, 0.3],
]);

// points: flat [x, y, z, x, y, z, ...] (array or typed array), at least two points
// options: gatesPerCheckpoint (0 for a course without gates), pattern, gateRadius
export function createCourse(points, checkpoints = CHECKPOINTS, options = {}) {
  const n = Math.floor(points.length / 3);
  if (n < 2) throw new Error("A course needs at least two points");
  const pts = Float64Array.from(points.slice ? points.slice(0, n * 3) : points);
  const cum = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    const dx = pts[i * 3] - pts[i * 3 - 3],
      dy = pts[i * 3 + 1] - pts[i * 3 - 2],
      dz = pts[i * 3 + 2] - pts[i * 3 - 1];
    cum[i] = cum[i - 1] + Math.hypot(dx, dy, dz);
  }
  const length = cum[n - 1];
  if (!(length > 0)) throw new Error("A course needs a positive length");
  const marks = [];
  for (let i = 1; i <= checkpoints; i++) marks.push((length * i) / checkpoints);
  const per = options.gatesPerCheckpoint ?? GATES_PER_CHECKPOINT,
    pattern = options.pattern ?? GATE_PATTERN,
    r = options.gateRadius ?? TUNING.gateRadius,
    total = checkpoints * per,
    gates = [];
  // evenly spaced, the last slot being the finish line, which needs no aim
  for (let i = 1; i < total; i++) {
    const [x, y] = pattern[(i - 1) % pattern.length];
    gates.push({ s: (length * i) / total, x, y, r });
  }
  return { pts, cum, n, length, checkpoints: marks, gates };
}

// The line a whale swims to take every gate: [right, up] metres from the course line at distance s, easing from
// one gate centre to the next. It starts and finishes on the course line. The renderer draws its guide beads on it.
export function courseLine(course, s, out = [0, 0]) {
  const g = course.gates;
  let i = 0;
  while (i < g.length && g[i].s <= s) i++;
  const a = i > 0 ? g[i - 1] : null,
    b = i < g.length ? g[i] : null;
  const s0 = a ? a.s : 0,
    s1 = b ? b.s : course.length;
  let t = clamp((s - s0) / (s1 - s0 || 1), 0, 1);
  t = t * t * (3 - 2 * t);
  const x0 = a ? a.x : 0,
    y0 = a ? a.y : 0;
  out[0] = x0 + ((b ? b.x : 0) - x0) * t;
  out[1] = y0 + ((b ? b.y : 0) - y0) * t;
  return out;
}

// position at distance s along the course into out[o..o+2]; past either end it continues in a straight line
export function coursePoint(course, s, out, o = 0) {
  const { pts, cum, n } = course;
  let i;
  if (s <= 0) i = 0;
  else if (s >= cum[n - 1]) i = n - 2;
  else {
    let lo = 0,
      hi = n - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (cum[m] <= s) lo = m;
      else hi = m;
    }
    i = lo;
  }
  const seg = cum[i + 1] - cum[i] || 1e-9,
    t = (s - cum[i]) / seg;
  for (let k = 0; k < 3; k++)
    out[o + k] = pts[i * 3 + k] + (pts[i * 3 + 3 + k] - pts[i * 3 + k]) * t;
  return out;
}

// position (out[0..2]) plus unit direction of travel (out[3..5]) at s, the direction averaged over ±span metres
const tmpA = new Float64Array(3),
  tmpB = new Float64Array(3);
export function sampleCourse(course, s, out, span = 2) {
  coursePoint(course, s, out, 0);
  coursePoint(course, s - span, tmpA, 0);
  coursePoint(course, s + span, tmpB, 0);
  let dx = tmpB[0] - tmpA[0],
    dy = tmpB[1] - tmpA[1],
    dz = tmpB[2] - tmpA[2];
  const l = Math.hypot(dx, dy, dz) || 1;
  out[3] = dx / l;
  out[4] = dy / l;
  out[5] = dz / l;
  return out;
}

// ---------------------------------------------------------------- world frame
// Travel frame at distance s: out = position, forward, right, up (12 numbers). Right is level and up completes the
// frame, the same one the renderer builds, so a gate's [right, up] offset lands where its ring is drawn.
export const BASIS_SPAN = 2.5;
export function courseBasis(course, s, out) {
  sampleCourse(course, s, out, BASIS_SPAN);
  const fx = out[3],
    fy = out[4],
    fz = out[5];
  let rx = -fz,
    rz = fx;
  const rl = Math.hypot(rx, rz) || 1;
  rx /= rl;
  rz /= rl;
  out[6] = rx;
  out[7] = 0;
  out[8] = rz;
  out[9] = -rz * fy + 0; // + 0: no negative zeros
  out[10] = rz * fx - rx * fz;
  out[11] = rx * fy + 0;
  return out;
}

// world centre of a gate into out[0..2] and the direction of travel through it into out[3..5]; reads the gate's
// offsets every time, so gates moved after the course was made are judged where they now are
export function gatePoint(course, gate, out) {
  courseBasis(course, gate.s, out);
  out[0] += out[6] * gate.x + out[9] * gate.y;
  out[1] += out[10] * gate.y;
  out[2] += out[8] * gate.x + out[11] * gate.y;
  return out;
}

// unit heading for a yaw and pitch: yaw 0 looks down -z and grows turning right, pitch grows climbing
export function headingVector(yaw, pitch, out = [0, 0, 0]) {
  const c = Math.cos(pitch);
  out[0] = Math.sin(yaw) * c;
  out[1] = Math.sin(pitch);
  out[2] = -Math.cos(yaw) * c;
  return out;
}

// The course distance nearest the point (x, y, z), searched only between distances lo and hi, so a far stretch of
// the course that happens to pass close by is never picked. out = [s, metres from the course there]. Past either
// end the course continues in a straight line.
export function projectOnCourse(course, x, y, z, lo, hi, out = [0, 0]) {
  const { pts, cum, n } = course;
  let i = 0;
  if (lo > 0) {
    let a = 0,
      b = n - 1;
    while (b - a > 1) {
      const m = (a + b) >> 1;
      if (cum[m] <= lo) a = m;
      else b = m;
    }
    i = Math.min(a, n - 2);
  }
  let best = Infinity,
    bestS = clamp(out[0], lo, hi);
  for (; i < n - 1 && (i === 0 || cum[i] <= hi); i++) {
    const len = cum[i + 1] - cum[i];
    if (!(len > 0)) continue;
    const ax = pts[i * 3],
      ay = pts[i * 3 + 1],
      az = pts[i * 3 + 2],
      dx = (pts[i * 3 + 3] - ax) / len,
      dy = (pts[i * 3 + 4] - ay) / len,
      dz = (pts[i * 3 + 5] - az) / len;
    const sMin = Math.max(lo, i === 0 ? -Infinity : cum[i]),
      sMax = Math.min(hi, i === n - 2 ? Infinity : cum[i + 1]);
    if (sMin > sMax) continue;
    const t =
      clamp(
        cum[i] + (x - ax) * dx + (y - ay) * dy + (z - az) * dz,
        sMin,
        sMax,
      ) - cum[i];
    const d = Math.hypot(ax + dx * t - x, ay + dy * t - y, az + dz * t - z);
    if (d < best) {
      best = d;
      bestS = cum[i] + t;
    }
  }
  out[0] = bestS;
  out[1] = best;
  return out;
}

// ---------------------------------------------------------------- race state
const emptyInput = () => ({
  forward: 0,
  boost: false,
  left: false,
  right: false,
  up: false,
  down: false,
});

const B = new Float64Array(12), // scratch frames
  PR = [0, 0];

export function createRace(course, tuning = TUNING) {
  const race = { course, tuning, input: emptyInput() };
  // Optional world collision, set by the renderer: (player, previousPosition {x, y, z}) => {}. It is called after
  // every fixed-step move and may move player.x/y/z back and cut player.speed. Unset, the water is open.
  race.resolvePlayerMotion = undefined;
  resetRace(race);
  return race;
}

// derives the course-relative fields (s is left alone) from the world position
function locate(race) {
  const p = race.player;
  courseBasis(race.course, p.s, B);
  const dx = p.x - B[0],
    dy = p.y - B[1],
    dz = p.z - B[2];
  p.lx = dx * B[6] + dz * B[8];
  p.ly = dx * B[9] + dy * B[10] + dz * B[11];
}

// Puts the player at course distance s, offset [right, up] metres from the line. `face` (the default) also points
// it along the course there and stops any turn; this is the only place the course ever sets the heading.
export function placePlayer(race, s, lx = 0, ly = 0, face = true) {
  const p = race.player;
  courseBasis(race.course, s, B);
  p.s = s;
  p.x = B[0] + B[6] * lx + B[9] * ly;
  p.y = B[1] + B[10] * ly;
  p.z = B[2] + B[8] * lx + B[11] * ly;
  if (face) {
    p.yaw = Math.atan2(B[3], -B[5]);
    p.pitch = Math.asin(clamp(B[4], -1, 1));
    p.yawRate = p.pitchRate = 0;
  }
  locate(race);
  p.courseDistance = Math.hypot(p.lx, p.ly);
  return p;
}

export function resetRace(race) {
  race.phase = "ready";
  race.resume = null; // phase to return to from a pause
  race.countdown = COUNTDOWN;
  race.elapsed = 0;
  race.acc = 0; // unspent frame time
  race.winner = null;
  race.finishTime = null;
  race.whaleTime = null;
  race.finishLead = null;
  race.checkpoint = 0; // checkpoints the player has reached, in order
  race.splits = [];
  race.gate = 0; // gates settled so far, swum through or not
  race.gateLog = []; // true for each gate swum through, false for each one missed
  race.gateHits = 0;
  race.streak = 0; // gates in a row
  race.player = {
    // world position (metres) and heading (radians); the keys turn the heading, nothing else does
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
    yawRate: 0, // rad/s, eased towards the keys
    pitchRate: 0,
    speed: 0, // m/s along the heading
    stamina: 1,
    exhausted: false,
    boosting: false,
    drafting: false,
    surge: 0, // seconds of gate surge left
    stall: 0, // seconds of turbulence left after a miss
    // derived from the position each step: progress along the course, metres right of / above the course line
    // there (unbounded), and the distance from the line
    s: 0,
    lx: 0,
    ly: 0,
    courseDistance: 0,
  };
  placePlayer(race, 0);
  race.whale = { s: 0, speed: 0 };
  return race;
}

// partial: any of forward (0..1 or boolean), boost, left, right, up, down
export function setInput(race, partial) {
  if (!partial) return race.input;
  const inp = race.input;
  if ("forward" in partial) inp.forward = clamp(+partial.forward || 0, 0, 1);
  for (const k of ["boost", "left", "right", "up", "down"])
    if (k in partial) inp[k] = !!partial[k];
  return inp;
}

export function clearInput(race) {
  Object.assign(race.input, emptyInput());
}

// ready or finished -> countdown (a finished race starts over); paused -> resume
export function startRace(race) {
  if (race.phase === "paused") return setPaused(race, false);
  if (race.phase === "finished") resetRace(race);
  if (race.phase !== "ready") return false;
  race.phase = "countdown";
  race.countdown = COUNTDOWN;
  return true;
}

export function restartRace(race) {
  const input = race.input;
  resetRace(race);
  race.input = input;
  race.phase = "countdown";
  return true;
}

// paused: true pauses a countdown or race, false resumes, undefined toggles
export function setPaused(race, paused) {
  const running = race.phase === "countdown" || race.phase === "racing";
  if (paused === undefined) paused = running;
  if (paused && running) {
    race.resume = race.phase;
    race.phase = "paused";
    race.acc = 0;
    return true;
  }
  if (!paused && race.phase === "paused") {
    race.phase = race.resume || "racing";
    race.resume = null;
    return true;
  }
  return false;
}

// whale cruise speed at race time t, before the rubber band
export function whalePace(t, tuning = TUNING) {
  return (
    tuning.whaleCruise *
    (1 +
      0.06 * Math.sin((t * 2 * Math.PI) / 11) +
      0.04 * Math.sin((t * 2 * Math.PI) / 4.3 + 1.3))
  );
}

function approach(v, target, k, h) {
  return v + (target - v) * (1 - Math.exp(-k * h));
}

const wrapAngle = (a) =>
  a > Math.PI ? a - 2 * Math.PI : a <= -Math.PI ? a + 2 * Math.PI : a;

function step(race, h) {
  const T = race.tuning,
    p = race.player,
    w = race.whale,
    inp = race.input,
    course = race.course,
    marks = course.checkpoints,
    L = course.length;
  if (race.phase === "countdown") {
    race.countdown -= h;
    if (race.countdown <= 1e-9) {
      race.countdown = 0;
      race.phase = "racing";
    }
    return;
  }
  if (race.phase !== "racing" && race.phase !== "finished") return;
  const racing = race.phase === "racing";
  const pBefore = p.s,
    wBefore = w.s,
    x0 = p.x,
    y0 = p.y,
    z0 = p.z;
  if (racing) race.elapsed += h;

  // thrust: the speed along the heading
  const gapBehind = w.s - p.s;
  p.drafting =
    racing &&
    gapBehind >= T.draftMin &&
    gapBehind <= T.draftMax &&
    p.courseDistance <= T.draftWidth;
  if (p.exhausted && p.stamina >= T.recover) p.exhausted = false;
  p.boosting = racing && inp.boost && !p.exhausted && p.stamina > 0;
  let target;
  if (!racing) target = 0;
  else if (p.boosting) target = T.boost;
  else
    target =
      T.glide + ((p.exhausted ? T.winded : T.cruise) - T.glide) * inp.forward;
  const moving = racing && (p.boosting || inp.forward > 0);
  if (moving && p.drafting) target += T.draftSpeed;
  if (moving && p.surge > 0) target += T.surgeSpeed;
  if (racing && p.stall > 0) target *= T.stallFactor;
  p.surge = Math.max(0, p.surge - h);
  p.stall = Math.max(0, p.stall - h);
  if (p.boosting) {
    p.stamina -= T.drain * h;
    if (p.stamina <= 0) {
      p.stamina = 0;
      p.exhausted = true;
      p.boosting = false;
    }
  } else if (racing)
    p.stamina = Math.min(
      1,
      p.stamina + T.regen * (p.drafting ? T.draftRegen : 1) * h,
    );
  p.speed = approach(p.speed, target, T.accel, h);

  // steering turns the heading and nothing turns it back: released keys leave the whale on the heading it has
  const yawIn = racing ? (inp.right ? 1 : 0) - (inp.left ? 1 : 0) : 0,
    pitchIn = racing ? (inp.up ? 1 : 0) - (inp.down ? 1 : 0) : 0;
  p.yawRate = yawIn
    ? approach(p.yawRate, yawIn * T.yawRate, T.turnAccel, h)
    : 0;
  p.pitchRate = pitchIn
    ? approach(p.pitchRate, pitchIn * T.pitchRate, T.turnAccel, h)
    : 0;
  p.yaw = wrapAngle(p.yaw + p.yawRate * h);
  p.pitch += p.pitchRate * h;
  if (Math.abs(p.pitch) > T.pitchMax) {
    p.pitch = clamp(p.pitch, -T.pitchMax, T.pitchMax);
    p.pitchRate = 0;
  }

  // the move, in the world, then whatever the world makes of it
  const cp = Math.cos(p.pitch);
  p.x += Math.sin(p.yaw) * cp * p.speed * h;
  p.y += Math.sin(p.pitch) * p.speed * h;
  p.z -= Math.cos(p.yaw) * cp * p.speed * h;
  if (race.resolvePlayerMotion)
    race.resolvePlayerMotion(p, { x: x0, y: y0, z: z0 });

  // Progress is where the whale now is along the course: the nearest point within a short stretch of the last
  // one, and never beyond the next checkpoint it has yet to reach.
  const cap =
    racing && race.checkpoint < marks.length
      ? marks[race.checkpoint] + T.projectWindow
      : L + T.overrun;
  PR[0] = p.s;
  projectOnCourse(
    course,
    p.x,
    p.y,
    p.z,
    Math.max(p.s - T.projectWindow, -T.overrun),
    Math.max(p.s, Math.min(p.s + T.projectWindow, cap, L + T.overrun)),
    PR,
  );
  p.s = PR[0];
  p.courseDistance = PR[1];
  locate(race);

  // whale: a fixed pace plus a rubber band that keeps the race close
  const wTarget = racing
    ? whalePace(race.elapsed, T) +
      clamp((p.s - w.s) * T.whaleRubber, T.whaleRubberMin, T.whaleRubberMax)
    : T.coast;
  w.speed = approach(w.speed, wTarget, T.accel, h);
  w.s = Math.min(w.s + w.speed * h, L + T.overrun);

  if (!racing) return;
  // Gates, in order. Crossing a gate's plane near it settles it: inside the ring is a hit (stamina and a surge),
  // outside a miss (turbulence, which wears off, so the next gate is a fresh chance). Swimming wide around one
  // misses it once the whale is past it on the course.
  const gates = course.gates;
  while (race.gate < gates.length) {
    const g = gates[race.gate];
    gatePoint(course, g, B);
    const d0 = (x0 - B[0]) * B[3] + (y0 - B[1]) * B[4] + (z0 - B[2]) * B[5],
      d1 = (p.x - B[0]) * B[3] + (p.y - B[1]) * B[4] + (p.z - B[2]) * B[5];
    let hit = false,
      settled = false;
    if (d0 < 0 && d1 >= 0) {
      const f = d0 / (d0 - d1),
        off = Math.hypot(
          x0 + (p.x - x0) * f - B[0],
          y0 + (p.y - y0) * f - B[1],
          z0 + (p.z - z0) * f - B[2],
        );
      hit = off <= g.r;
      settled = off <= Math.max(g.r, T.gateReach);
    }
    if (!settled && p.s < g.s + T.gatePass) break;
    race.gate++;
    race.gateLog.push(hit);
    if (hit) {
      race.gateHits++;
      race.streak++;
      p.stamina = Math.min(1, p.stamina + T.gateBonus);
      p.surge = T.surgeTime;
      p.stall = 0;
    } else {
      race.streak = 0;
      p.surge = 0;
      p.stall = T.stallTime;
      p.speed *= T.missKeep;
    }
  }
  // Checkpoints, in order: the whale has to swim through the checkpoint itself, forwards, within its radius.
  // Being level with it somewhere else on the map, coming at it from the far side, or reaching a later one first
  // counts for nothing.
  let pf = Infinity;
  while (race.checkpoint < marks.length) {
    sampleCourse(course, marks[race.checkpoint], B, BASIS_SPAN);
    const d0 = (x0 - B[0]) * B[3] + (y0 - B[1]) * B[4] + (z0 - B[2]) * B[5],
      d1 = (p.x - B[0]) * B[3] + (p.y - B[1]) * B[4] + (p.z - B[2]) * B[5];
    if (!(d0 < 0 && d1 >= 0)) break;
    const f = d0 / (d0 - d1);
    if (
      Math.hypot(
        x0 + (p.x - x0) * f - B[0],
        y0 + (p.y - y0) * f - B[1],
        z0 + (p.z - z0) * f - B[2],
      ) > T.checkpointRadius
    )
      break;
    race.checkpoint++;
    race.splits.push(race.elapsed);
    if (race.checkpoint === marks.length) pf = f; // when within this step the finish was crossed
  }
  const pDone = pf <= 1,
    wDone = w.s >= L;
  if (pDone || wDone) {
    // Compare crossing times within this step. A faster racer can travel farther
    // beyond the line while still having crossed it later.
    const wf = wDone ? (L - wBefore) / (w.s - wBefore) : Infinity;
    const first = Math.min(pf, wf),
      before = race.elapsed - h;
    race.winner =
      Math.abs(pf - wf) < 1e-9 ? "tie" : pf < wf ? "player" : "whale";
    if (pDone) race.finishTime = before + pf * h;
    if (wDone) race.whaleTime = before + wf * h;
    race.elapsed = before + first * h;
    race.finishLead =
      pBefore + (p.s - pBefore) * first - wBefore - (w.s - wBefore) * first;
    race.phase = "finished";
  }
}

// advance by a frame time dt (seconds); returns the number of fixed steps taken
export function advance(race, dt) {
  if (race.phase === "ready" || race.phase === "paused") {
    race.acc = 0;
    return 0;
  }
  race.acc += clamp(dt, 0, 0.25);
  let n = 0;
  while (race.acc >= STEP - 1e-12) {
    race.acc -= STEP;
    step(race, STEP);
    n++;
  }
  return n;
}

// ---------------------------------------------------------------- aim
// Where a ring at world point B[0..2], facing B[3..5], radius r, is from the player's nose:
//   aimX, aimY   metres right of / above the line of the heading (+ = turn right / pitch up to bring it on)
//   aimYaw, aimPitch   radians of turn that would point the heading at its centre
//   aligned      holding this heading swims through the ring
//   distance     metres to its centre
function aimAt(p, r) {
  const vx = B[0] - p.x,
    vy = B[1] - p.y,
    vz = B[2] - p.z,
    sy = Math.sin(p.yaw),
    cy = Math.cos(p.yaw),
    sp = Math.sin(p.pitch),
    cp = Math.cos(p.pitch),
    hx = sy * cp,
    hy = sp,
    hz = -cy * cp;
  // the heading's own right (level) and up
  const aimX = vx * cy + vz * sy,
    aimY = -vx * sy * sp + vy * cp + vz * cy * sp;
  // where the heading meets the ring's plane
  const along = hx * B[3] + hy * B[4] + hz * B[5],
    t = along > 1e-6 ? (vx * B[3] + vy * B[4] + vz * B[5]) / along : -1;
  const aligned =
    t >= 0 && Math.hypot(hx * t - vx, hy * t - vy, hz * t - vz) <= r;
  return {
    aimX,
    aimY,
    aimYaw: wrapAngle(Math.atan2(vx, -vz) - p.yaw),
    aimPitch: Math.atan2(vy, Math.hypot(vx, vz)) - p.pitch,
    aligned,
    distance: Math.hypot(vx, vy, vz),
  };
}
const NO_AIM = Object.freeze({
  aimX: 0,
  aimY: 0,
  aimYaw: 0,
  aimPitch: 0,
  aligned: false,
  distance: 0,
});

// aim at the next gate, relative to the player's heading; all zero with no gate left. gateDistance = distance.
export function gateAim(race) {
  const g = race.course.gates[race.gate];
  if (!g) return { ...NO_AIM, gateDistance: 0 };
  gatePoint(race.course, g, B);
  const a = aimAt(race.player, g.r);
  a.gateDistance = a.distance;
  return a;
}

// aim at the next checkpoint the player has to reach (the finish last); all zero once they are all reached
export function checkpointAim(race) {
  const marks = race.course.checkpoints;
  if (race.checkpoint >= marks.length) return { ...NO_AIM };
  sampleCourse(race.course, marks[race.checkpoint], B, BASIS_SPAN);
  return aimAt(race.player, race.tuning.checkpointRadius);
}

// the fields the race UI shows
export function snapshot(race) {
  const L = race.course.length,
    p = race.player,
    w = race.whale,
    gates = race.course.gates,
    aim = gateAim(race),
    cp = checkpointAim(race);
  return {
    phase: race.phase,
    elapsed: race.elapsed,
    countdown:
      race.phase === "countdown" ||
      (race.phase === "paused" && race.resume === "countdown")
        ? race.countdown
        : 0,
    progress: clamp(p.s / L, 0, 1),
    whaleProgress: clamp(w.s / L, 0, 1),
    distance: clamp(L - p.s, 0, L), // metres of course left for the player
    courseLength: L,
    lead: race.phase === "finished" ? race.finishLead : p.s - w.s, // metres; frozen at the finish
    winner: race.winner,
    finishTime: race.finishTime,
    stamina: p.stamina,
    exhausted: p.exhausted,
    boosting: p.boosting,
    drafting: p.drafting,
    speed: p.speed,
    whaleSpeed: w.speed,
    // the player in the world
    x: p.x,
    y: p.y,
    z: p.z,
    yaw: p.yaw,
    pitch: p.pitch,
    courseDistance: p.courseDistance, // metres from the course line
    offCourse: p.courseDistance > race.tuning.offCourse,
    checkpoint: race.checkpoint,
    checkpoints: race.course.checkpoints.length,
    // the next checkpoint to reach, from the player's nose (zero once the race is run)
    checkpointDistance: cp.distance,
    checkpointAimX: cp.aimX,
    checkpointAimY: cp.aimY,
    checkpointAimYaw: cp.aimYaw,
    checkpointAimPitch: cp.aimPitch,
    // steering: where the next gate's centre is from the player's nose (metres, + = turn right / pitch up; 0 with
    // no gate left), the turn to face it (radians), and whether the heading as it is swims through it
    aimX: aim.aimX,
    aimY: aim.aimY,
    aimYaw: aim.aimYaw,
    aimPitch: aim.aimPitch,
    aligned: aim.aligned,
    gateDistance: aim.gateDistance, // metres to that gate's centre
    gate: race.gate, // gates settled so far
    gates: gates.length,
    gateHits: race.gateHits,
    gateResult: race.gate
      ? race.gateLog[race.gate - 1]
        ? "hit"
        : "miss"
      : null, // the last gate settled
    streak: race.streak,
    surge: p.surge > 0,
    stalled: p.stall > 0,
  };
}
