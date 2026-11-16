import test from "node:test";
import assert from "node:assert/strict";
import {
  CAMERAS,
  COUNTDOWN,
  GATE_PATTERN,
  STEP,
  TUNING,
  advance,
  checkpointAim,
  clearInput,
  courseBasis,
  courseLine,
  coursePoint,
  createCourse,
  createRace,
  gateAim,
  gatePoint,
  headingVector,
  placePlayer,
  projectOnCourse,
  restartRace,
  sampleCourse,
  setInput,
  setPaused,
  snapshot,
  startRace,
} from "../src/game/race-model.js";

// a straight 480 m course, about the length of the real one
const straight = () => createCourse([0, 0, 0, 0, 0, 240, 0, 0, 480]);
const noGates = () =>
  createCourse([0, 0, 0, 0, 0, 240, 0, 0, 480], 8, { gatesPerCheckpoint: 0 });

// a 100 m run down -z, a quarter turn to the right of 40 m radius, then 300 m along +x
function curved(options) {
  const pts = [];
  for (let z = 0; z <= 100; z += 5) pts.push(0, 0, -z);
  for (let a = 1; a <= 18; a++) {
    const t = (a * Math.PI) / 36;
    pts.push(40 - 40 * Math.cos(t), 0, -100 - 40 * Math.sin(t));
  }
  for (let x = 5; x <= 300; x += 5) pts.push(40 + x, 0, -140);
  return createCourse(pts, 8, options);
}
// a closed 80 m square lap in the level plane: the finish is where the start is
const lap = () =>
  createCourse([0, 0, 0, 0, 0, -80, 80, 0, -80, 80, 0, 0, 0, 0, 0], 8, {
    gatesPerCheckpoint: 0,
  });

// frame-sized steps, since one advance() covers at most a quarter second
function tick(race, secs, dt = 1 / 60) {
  let n = Math.round(secs / dt),
    steps = 0;
  while (n--) steps += advance(race, dt);
  return steps;
}
// a race past its countdown
function begin(course = straight(), tuning) {
  const race = createRace(course, tuning);
  startRace(race);
  tick(race, COUNTDOWN);
  return race;
}
// drops the player on the course at s, as if it had swum there: checkpoints and gates behind it are done
function drop(race, s, lx = 0, ly = 0) {
  const c = race.course;
  race.checkpoint = c.checkpoints.filter((m) => m <= s).length;
  race.gate = c.gates.filter((g) => g.s <= s).length;
  return placePlayer(race, s, lx, ly);
}
// runs a race with `policy(race) -> input` at a fixed frame time until it ends
function run(policy, { dt = 1 / 60, limit = 300, course = straight() } = {}) {
  const race = createRace(course);
  startRace(race);
  for (let t = 0; t < limit && race.phase !== "finished"; t += dt) {
    setInput(race, policy(race));
    advance(race, dt);
  }
  return race;
}
// boost from a healthy reserve down to nearly empty, then cruise while it refills; no steering
function boostOnly() {
  let on = false;
  return (race) => {
    const p = race.player;
    if (p.stamina > 0.6) on = true;
    if (p.stamina < 0.08) on = false;
    return { forward: true, boost: on };
  };
}
// Turn the heading at the next gate, or at the next checkpoint once the gates are done (sign -1: away from it);
// `take(i)` false leaves gate i alone and holds whatever heading the whale has.
function steer(race, sign = 1, take = () => true) {
  const out = { left: false, right: false, up: false, down: false },
    gate = race.gate < race.course.gates.length;
  if (gate && !take(race.gate)) return out;
  const a = gate ? gateAim(race) : checkpointAim(race),
    yaw = sign * a.aimYaw,
    pitch = sign * a.aimPitch;
  if (yaw > 0.01) out.right = true;
  else if (yaw < -0.01) out.left = true;
  if (pitch > 0.01) out.up = true;
  else if (pitch < -0.01) out.down = true;
  return out;
}
// the intended way to race: manage the boost and steer through the gates
function smartBoost(sign = 1, take) {
  const boost = boostOnly();
  return (race) => ({ ...boost(race), ...steer(race, sign, take) });
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;
// the turn from heading a to heading b, the short way round
const turn = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

test("a course measures its length and places checkpoints evenly, the finish last", () => {
  const c = straight();
  assert.equal(c.length, 480);
  assert.equal(c.checkpoints.length, 8);
  assert.equal(c.checkpoints[0], 60);
  assert.equal(c.checkpoints.at(-1), 480);
  assert.throws(() => createCourse([0, 0, 0]));
  assert.throws(() => createCourse([1, 2, 3, 1, 2, 3]));
});

test("course sampling interpolates by distance and continues straight past both ends", () => {
  const c = createCourse([0, 0, 0, 10, 0, 0, 10, 0, 10]);
  const out = new Float64Array(6);
  assert.deepEqual([...coursePoint(c, 5, out)].slice(0, 3), [5, 0, 0]);
  assert.deepEqual([...coursePoint(c, 15, out)].slice(0, 3), [10, 0, 5]);
  assert.deepEqual([...coursePoint(c, -3, out)].slice(0, 3), [-3, 0, 0]);
  assert.deepEqual([...coursePoint(c, 23, out)].slice(0, 3), [10, 0, 13]);
  sampleCourse(c, 2, out, 1);
  assert.deepEqual([...out.slice(3)], [1, 0, 0]);
  sampleCourse(c, 10, out, 1); // the corner: halfway between the two directions
  assert.ok(
    Math.abs(out[3] - Math.SQRT1_2) < 1e-9 &&
      Math.abs(out[5] - Math.SQRT1_2) < 1e-9,
  );
});

test("nothing moves until the countdown ends, then the race clock starts", () => {
  const race = createRace(straight());
  setInput(race, { forward: true, boost: true });
  tick(race, 1);
  assert.equal(race.phase, "ready");
  assert.equal(race.player.s, 0);
  assert.equal(race.player.z, 0);
  assert.equal(startRace(race), true);
  assert.equal(snapshot(race).countdown, COUNTDOWN);
  tick(race, 1.5);
  assert.equal(race.phase, "countdown");
  assert.ok(Math.abs(snapshot(race).countdown - 1.5) < 1e-9);
  assert.equal(race.player.s, 0);
  assert.equal(race.whale.s, 0);
  assert.equal(race.player.stamina, 1);
  tick(race, 1.5);
  assert.equal(race.phase, "racing");
  assert.equal(race.elapsed, 0);
  tick(race, 1);
  assert.ok(race.player.s > 0 && race.whale.s > 0);
  assert.ok(near(race.player.s, race.player.z, 1e-9), "progress is position");
  assert.ok(Math.abs(race.elapsed - 1) < 1e-9);
});

test("the rival beats a player who sits still or only cruises", () => {
  const idle = run(() => ({}));
  assert.equal(idle.winner, "whale");
  assert.equal(idle.player.s, 0, "nothing moves the player but its own thrust");
  assert.deepEqual([idle.player.x, idle.player.y, idle.player.z], [0, 0, 0]);
  assert.equal(idle.checkpoint, 0);

  const cruise = run(() => ({ forward: true }));
  assert.equal(cruise.winner, "whale");
  assert.equal(cruise.phase, "finished");
  assert.ok(
    cruise.finishTime === null &&
      cruise.whaleTime > 50 &&
      cruise.whaleTime < 70,
  );
});

test("forward alone holds the heading: it leaves a curving course instead of following it", () => {
  const race = run(() => ({ forward: true }), { course: curved() });
  const p = race.player;
  assert.equal(race.winner, "whale");
  // still pointing down -z, and far beyond the bend it never took
  assert.equal(p.yaw, 0);
  assert.equal(p.pitch, 0);
  assert.ok(near(p.x, 0) && near(p.y, 0), `drifted to x ${p.x}`);
  assert.ok(p.z < -300, `z ${p.z}`);
  // the course went right; progress stops in the bend, the later checkpoints are never reached
  assert.ok(p.s < 170, `progress ${p.s}`);
  assert.ok(race.checkpoint <= 2);
  assert.equal(race.finishTime, null);
  const s = snapshot(race);
  assert.ok(s.offCourse && s.courseDistance > 100);
  assert.ok(s.progress < 0.4);
  // boosting does not find the bend either
  const hold = run(() => ({ forward: true, boost: true }), {
    course: curved(),
  });
  assert.equal(hold.player.x, 0);
  assert.equal(hold.finishTime, null);
});

test("turning changes the world heading and releasing the keys keeps it", () => {
  const race = begin(noGates());
  const p = race.player;
  assert.ok(near(Math.abs(p.yaw), Math.PI), "starts facing down the course");
  assert.deepEqual(headingVector(p.yaw, p.pitch).map(Math.round), [0, 0, 1]);
  setInput(race, { forward: true });
  tick(race, 2);
  const yaw0 = p.yaw,
    x0 = p.x;
  assert.ok(near(x0, 0));
  // right: the heading swings to the whale's right (-x when swimming down +z), and the path bends with it
  setInput(race, { right: true });
  tick(race, 0.6);
  const releasedYaw = p.yaw;
  setInput(race, { right: false });
  tick(race, 1.5);
  assert.equal(p.yaw, releasedYaw, "release holds the heading immediately");
  const yaw1 = p.yaw,
    h1 = headingVector(p.yaw, p.pitch);
  assert.ok(turn(yaw0, yaw1) > 0.5, `turned ${turn(yaw0, yaw1)}`);
  assert.ok(h1[0] < -0.5 && p.x < x0 - 1);
  // hands off: no recentring, no pull back to the line, however long
  const xa = p.x;
  tick(race, 4);
  assert.equal(p.yaw, yaw1);
  assert.equal(p.yawRate, 0);
  assert.ok(p.x < xa - 10, "still swimming away from the course line");
  assert.ok(p.lx > 15 && near(p.courseDistance, Math.abs(p.x), 1e-6));
  // left undoes it
  setInput(race, { left: true });
  tick(race, 0.3);
  assert.ok(turn(yaw0, p.yaw) < turn(yaw0, yaw1) - 0.2);
  setInput(race, { left: false });
  // up and down pitch the heading, which moves the whale in y; the pitch is bounded
  tick(race, 1.5);
  const y0 = p.y;
  assert.equal(p.pitch, 0);
  setInput(race, { up: true });
  tick(race, 0.5);
  const releasedPitch = p.pitch;
  setInput(race, { up: false });
  tick(race, 1.5);
  assert.equal(p.pitch, releasedPitch, "release holds the pitch immediately");
  const pitch1 = p.pitch;
  assert.ok(pitch1 > 0.3 && p.y > y0 + 1);
  tick(race, 1);
  assert.equal(p.pitch, pitch1, "the climb holds");
  setInput(race, { up: true });
  tick(race, 5);
  assert.equal(p.pitch, TUNING.pitchMax);
  setInput(race, { up: false, down: true });
  tick(race, 5);
  assert.equal(p.pitch, -TUNING.pitchMax);
  // without thrust the keys still turn the whale, on the spot
  const still = begin(noGates());
  setInput(still, { left: true });
  tick(still, 1);
  assert.ok(Math.abs(Math.abs(still.player.yaw) - Math.PI) > 0.8);
  assert.ok(Math.hypot(still.player.x, still.player.z) < 1e-9);
});

test("a full turn takes a few seconds and a few metres", () => {
  const race = begin(noGates());
  setInput(race, { forward: true });
  tick(race, 3);
  const { x, z } = race.player;
  setInput(race, { forward: true, right: true });
  tick(race, Math.PI / TUNING.yawRate + 0.15); // about a half turn
  const h = headingVector(race.player.yaw, race.player.pitch);
  assert.ok(h[2] < -0.95, "heading back the way it came");
  const across = Math.hypot(race.player.x - x, race.player.z - z);
  assert.ok(across > 6 && across < 14, `turned around in ${across} m`);
});

test("steering round a bend reaches every checkpoint and wins", () => {
  const race = run(smartBoost(), { course: curved() });
  assert.equal(race.winner, "player");
  assert.equal(race.checkpoint, 8);
  assert.equal(race.splits.length, 8);
  assert.ok(race.gateHits >= race.course.gates.length - 1);
  const p = race.player,
    end = coursePoint(race.course, race.course.length, [0, 0, 0]);
  assert.ok(Math.hypot(p.x - end[0], p.y - end[1], p.z - end[2]) < 1);
  // it really turned: now swimming along +x
  assert.ok(headingVector(p.yaw, p.pitch)[0] > 0.95);
  // without boost the same steering takes the gates but not the race
  const slow = run((r) => ({ forward: true, ...steer(r) }), {
    course: curved(),
  });
  assert.equal(slow.winner, "whale");
  assert.ok(slow.gateHits >= 14);
  // a course that climbs needs the pitch keys
  const hill = createCourse([0, 0, 0, 0, 0, -120, 0, 40, -240, 0, 40, -360]);
  const up = run(smartBoost(), { course: hill });
  assert.equal(up.winner, "player");
  assert.ok(up.player.y > 39);
  assert.equal(
    run(() => ({ forward: true }), { course: hill }).finishTime,
    null,
  );
});

test("progress is the projection of the position, searched only near the last one", () => {
  const c = lap();
  const out = [0, 0];
  // near the first leg; the last leg ends at the same place but is outside the window
  projectOnCourse(c, 1, 0, -5, -10, 10, out);
  assert.deepEqual(out, [5, 1]);
  projectOnCourse(c, 1, 0, -5, 310, 330, out);
  assert.ok(near(out[0], 319) && near(out[1], 5));
  // clamped to the window, and continued straight past the ends
  projectOnCourse(c, 0, 0, -30, 0, 10, out);
  assert.deepEqual(out, [10, 20]);
  projectOnCourse(c, 2, 0, 6, -15, 10, out);
  assert.deepEqual(out, [-6, 2]);
  // swimming backwards loses progress
  const race = begin(noGates());
  drop(race, 100);
  race.player.yaw = 0; // facing -z, against the course
  setInput(race, { forward: true });
  tick(race, 4);
  assert.ok(race.player.s < 80 && near(race.player.s, race.player.z));
  assert.ok(snapshot(race).distance > 400);
});
test("a player who manages stamina beats the rival", () => {
  const race = run(smartBoost());
  assert.equal(race.winner, "player");
  assert.ok(
    race.finishTime > 40 && race.finishTime < 60,
    `finished in ${race.finishTime}`,
  );
  assert.equal(race.splits.length, 8);
  const s = snapshot(race);
  assert.equal(s.progress, 1);
  assert.equal(s.distance, 0);
  assert.ok(s.lead > 0);
  assert.equal(race.gateHits, race.course.gates.length);
});

test("gates sit off the course line, between the start and the finish", () => {
  const c = straight();
  assert.equal(c.gates.length, 15);
  assert.equal(c.gates[0].s, 30);
  assert.equal(c.gates.at(-1).s, 450);
  for (const g of c.gates)
    assert.ok(Math.hypot(g.x, g.y) > g.r + 0.25, "off the line");
  // each gate can be turned onto from the one before at full boost: the sideways step is well inside what the
  // turn radius allows over the gap
  const radius = (TUNING.boost + TUNING.surgeSpeed) / TUNING.yawRate;
  for (let i = 1; i < GATE_PATTERN.length; i++) {
    const [ax, ay] = GATE_PATTERN[i - 1],
      [bx, by] = GATE_PATTERN[i];
    assert.ok(Math.hypot(bx - ax, by - ay) < (30 * 30) / (4 * radius));
  }
  // a gate is in the world where the course frame puts it: on +z the whale's right is -x
  const B = new Float64Array(12);
  gatePoint(c, c.gates[0], B);
  assert.deepEqual([...B.slice(0, 6)], [-1.5, 0.2, 30, 0, 0, 1]);
  courseBasis(c, 30, B);
  assert.deepEqual([...B.slice(6)], [-1, 0, 0, 0, 1, 0]);
  // and follows its offsets if they are changed later
  const moved = straight();
  moved.gates[0].x = -2;
  moved.gates[0].y = 1;
  assert.deepEqual(
    [...gatePoint(moved, moved.gates[0], B).slice(0, 3)],
    [2, 1, 30],
  );
  // the guide line runs from the course line through every gate centre and back
  assert.deepEqual(courseLine(c, 0), [0, 0]);
  assert.deepEqual(courseLine(c, 480), [0, 0]);
  assert.deepEqual(courseLine(c, 60), [c.gates[1].x, c.gates[1].y]);
  const [mx] = courseLine(c, 45);
  assert.ok(Math.abs(mx - (c.gates[0].x + c.gates[1].x) / 2) < 1e-9);
  assert.equal(noGates().gates.length, 0);
});

test("swimming through a gate gives stamina and a surge, missing it stalls", () => {
  const at = (x, y) => {
    const race = begin();
    const g = race.course.gates[0];
    drop(race, g.s - 0.5, g.x + x, g.y + y);
    Object.assign(race.player, { speed: 7.5, stamina: 0.5 });
    setInput(race, { forward: true });
    tick(race, 0.5);
    return race;
  };
  const hit = at(0.3, -0.3),
    edge = at(-0.8, -0.8),
    miss = at(-1.6, 0);
  assert.deepEqual(hit.gateLog, [true]);
  assert.deepEqual(edge.gateLog, [false], "outside the gate's radius");
  assert.deepEqual(miss.gateLog, [false]);
  assert.ok(hit.player.stamina > 0.5 + TUNING.gateBonus);
  assert.ok(miss.player.stamina < 0.5 + TUNING.gateBonus);
  assert.ok(hit.player.speed > 7.5 && miss.player.speed < 6);
  assert.ok(hit.player.s > miss.player.s + 0.5);
  const h = snapshot(hit),
    m = snapshot(miss);
  assert.deepEqual(
    [h.gateResult, h.surge, h.stalled, h.streak, h.gateHits, h.gate],
    ["hit", true, false, 1, 1, 1],
  );
  assert.deepEqual(
    [m.gateResult, m.surge, m.stalled, m.streak, m.gateHits, m.gate],
    ["miss", false, true, 0, 0, 1],
  );
  assert.equal(h.gates, 15);
});

test("a gate is settled by where the whale is in the world, not by the course moving on", () => {
  const c = straight();
  const g = c.gates[0];
  // parked just short of the ring: nothing is decided however long the clock runs
  const parked = begin(c);
  drop(parked, g.s - 2, g.x, g.y);
  tick(parked, 5);
  assert.equal(parked.gate, 0);
  assert.deepEqual(parked.gateLog, []);
  // swimming back through the ring from beyond it is not going through it: it was passed, so it is a miss
  const back = begin(straight());
  drop(back, g.s + 3, g.x, g.y);
  back.player.yaw = 0;
  setInput(back, { forward: true });
  back.gate = 0;
  tick(back, 2);
  assert.ok(back.player.z < g.s - 1);
  assert.deepEqual(back.gateLog, [false]);
  // swimming wide around it, out of reach of the ring, misses it once past
  const wide = begin(straight());
  drop(wide, g.s - 1, g.x + 9, g.y);
  wide.player.speed = 7.5;
  setInput(wide, { forward: true });
  tick(wide, 0.2);
  assert.deepEqual(wide.gateLog, [], "level with it, not yet past");
  tick(wide, 0.5);
  assert.deepEqual(wide.gateLog, [false]);
  // a gate the engine has moved is judged where it now is
  const moved = begin(straight());
  moved.course.gates[0].x = -2;
  moved.course.gates[0].y = 1;
  drop(moved, g.s - 0.5, -2, 1);
  moved.player.speed = 7.5;
  setInput(moved, { forward: true });
  tick(moved, 0.3);
  assert.deepEqual(moved.gateLog, [true]);
  assert.ok(near(moved.player.x, 2, 1e-9));
});

test("the HUD aim is measured from the player's heading", () => {
  const race = begin();
  const g = race.course.gates[0];
  let s = snapshot(race);
  // on the line, facing down the course: the gate is 1.5 m to the right and 0.2 m up of dead ahead
  assert.ok(near(s.aimX, g.x) && near(s.aimY, g.y) && !s.aligned);
  assert.ok(near(s.gateDistance, Math.hypot(30, g.x, g.y)));
  assert.ok(near(s.aimYaw, Math.atan2(g.x, 30)) && s.aimPitch > 0);
  assert.equal(s.gateResult, null);
  assert.deepEqual(
    [s.aimX, s.aimY, s.aligned, s.gateDistance],
    Object.values(gateAim(race)).filter((_, i) => [0, 1, 4, 6].includes(i)),
  );
  // turning the nose onto it, without moving, lines it up
  race.player.yaw += s.aimYaw;
  race.player.pitch += s.aimPitch;
  s = snapshot(race);
  assert.ok(near(s.aimX, 0, 1e-9) && near(s.aimY, 0, 1e-9) && s.aligned);
  assert.ok(near(s.aimYaw, 0) && near(s.aimPitch, 0));
  // sitting in front of the ring but pointing well off it is not aligned, and the aim says which way to turn
  drop(race, g.s - 10, g.x, g.y);
  assert.equal(snapshot(race).aligned, true);
  race.player.yaw -= 0.3; // nose swung left
  s = snapshot(race);
  assert.ok(!s.aligned && s.aimX > 2 && near(s.aimYaw, 0.3));
  race.player.yaw += 0.3;
  race.player.pitch = -0.3; // nose down
  s = snapshot(race);
  assert.ok(!s.aligned && s.aimY > 2 && near(s.aimPitch, 0.3));
  // facing away from it
  race.player.pitch = 0;
  race.player.yaw = 0;
  s = snapshot(race);
  assert.ok(!s.aligned && near(Math.abs(s.aimYaw), Math.PI));
  // the aim follows a gate that has been moved
  placePlayer(race, 0);
  g.x = -1;
  g.y = 0;
  assert.ok(near(snapshot(race).aimX, -1));
  // the run to the finish needs no gate aim; the checkpoint aim leads there
  race.gate = race.course.gates.length;
  s = snapshot(race);
  assert.deepEqual(
    [s.aimX, s.aimY, s.aligned, s.gateDistance],
    [0, 0, false, 0],
  );
  assert.equal(s.checkpointDistance, 60);
  assert.ok(near(s.checkpointAimYaw, 0) && near(s.checkpointAimX, 0));
  assert.equal(checkpointAim(race).aligned, true);
});

test("choosing a direction decides the race", () => {
  const good = run(smartBoost()),
    none = run(boostOnly()),
    wrong = run(smartBoost(-1)),
    hold = run(() => ({ forward: true, boost: true })),
    pinned = run(() => ({ forward: true, boost: true, right: true }), {
      limit: 120,
    });
  assert.equal(good.winner, "player");
  for (const [name, race] of Object.entries({ none, wrong, hold, pinned })) {
    assert.equal(race.winner, "whale", name);
    assert.ok(race.gateHits <= 3, `${name} took ${race.gateHits} gates`);
    assert.ok(
      snapshot(race).lead < -4,
      `${name} lost by ${snapshot(race).lead}`,
    );
    assert.ok(race.player.s < 480 - 4);
  }
  assert.equal(none.gateHits, 0);
  assert.equal(wrong.gateHits, 0);
  // the same boosting with and without the gates: over ten seconds apart at the pace of the steering run
  assert.ok(good.finishTime + 8 < none.whaleTime);
  // steering alone, never boosting, is not enough either
  assert.equal(
    run((race) => ({ forward: true, ...steer(race) })).winner,
    "whale",
  );
});

test("a missed gate costs time but the race stays winnable", () => {
  const clean = run(smartBoost());
  // miss the first three gates, then swim the rest
  const late = run(smartBoost(1, (i) => i >= 3));
  assert.deepEqual(late.gateLog.slice(0, 4), [false, false, false, true]);
  assert.equal(late.gateHits, 12);
  assert.equal(late.checkpoint, 8);
  assert.equal(late.winner, "player");
  assert.ok(late.finishTime > clean.finishTime + 1);
  // every third gate missed all the way round still wins, by less
  const sloppy = run(smartBoost(1, (i) => i % 3 !== 1));
  assert.ok(sloppy.gateHits >= 10 && sloppy.gateHits <= 11);
  assert.equal(sloppy.winner, "player");
  assert.ok(snapshot(sloppy).lead < snapshot(clean).lead);
  // the stall wears off: speed is back at cruise before the next gate
  const race = begin();
  setInput(race, { forward: true });
  while (race.gate < 1) advance(race, 1 / 60);
  assert.equal(race.player.stall > 0, true);
  const dip = race.player.speed;
  tick(race, TUNING.stallTime + 1.5);
  assert.equal(race.gate, 1);
  assert.equal(race.player.stall, 0);
  assert.ok(race.player.speed > dip + 1 && race.player.speed > 7);
});

test("boost drains stamina, an empty tank locks boost out until it recovers", () => {
  const race = createRace(straight());
  startRace(race);
  tick(race, COUNTDOWN);
  setInput(race, { forward: 1, boost: true });
  tick(race, 1);
  assert.ok(race.player.boosting);
  assert.ok(Math.abs(race.player.stamina - (1 - TUNING.drain)) < 1e-6);
  tick(race, 1 / TUNING.drain); // runs dry
  assert.ok(
    race.player.exhausted || race.player.stamina < TUNING.recover,
    "a checkpoint bonus may have landed",
  );
  // empty it for sure, then hold boost: no boosting until the reserve is back
  race.player.stamina = 0.01;
  tick(race, 0.1);
  assert.equal(race.player.exhausted, true);
  assert.equal(race.player.boosting, false);
  tick(race, 1);
  assert.equal(
    race.player.boosting,
    false,
    "still locked out while holding boost",
  );
  const locked = race.player.stamina;
  assert.ok(locked > 0.01, "stamina refills while locked out");
  race.player.stamina = TUNING.recover;
  tick(race, STEP * 2);
  assert.equal(race.player.exhausted, false);
  assert.equal(race.player.boosting, true);
});

test("swimming in the whale's wake refills stamina faster", () => {
  const make = (gap, side = 0) => {
    const race = begin();
    drop(race, 70, side); // between gates, so no bonus lands
    race.whale.s = 70 + gap;
    race.player.stamina = 0.5;
    race.whale.speed = race.player.speed = 7.5;
    setInput(race, { forward: true });
    tick(race, 0.5);
    return race;
  };
  const wake = make(8),
    clear = make(40);
  assert.equal(wake.player.drafting, true);
  assert.equal(clear.player.drafting, false);
  assert.ok(wake.player.stamina - 0.5 > (clear.player.stamina - 0.5) * 2);
  assert.ok(wake.player.speed > clear.player.speed);
  // the wake is where the whale is: level with it but well off to one side there is none
  assert.equal(make(8, 20).player.drafting, false);
});

test("checkpoints are counted once each, with a split time", () => {
  const race = begin(noGates());
  drop(race, 59.99);
  setInput(race, { forward: true });
  tick(race, 0.1);
  assert.equal(race.checkpoint, 1);
  assert.equal(race.splits.length, 1);
  tick(race, 0.1);
  assert.equal(race.checkpoint, 1);
  assert.equal(snapshot(race).checkpoints, 8);
});

test("a checkpoint has to be reached where it is, and in order", () => {
  // level with the first checkpoint but 30 m to the side: not reached, and progress waits for it
  const race = begin(noGates());
  placePlayer(race, 40, 30);
  setInput(race, { forward: true });
  tick(race, 20);
  assert.ok(race.player.z > 150);
  assert.equal(race.checkpoint, 0);
  assert.ok(race.player.s <= 60 + TUNING.projectWindow);
  assert.ok(snapshot(race).progress < 0.15);
  // sitting on the third checkpoint without the first two earns nothing
  placePlayer(race, 180.5);
  tick(race, 0.5);
  assert.equal(race.checkpoint, 0);
  // going back for the first one counts it
  placePlayer(race, 59);
  tick(race, 1);
  assert.equal(race.checkpoint, 1);
  // within the radius counts, off the line or not; just outside it does not
  for (const [off, count] of [
    [TUNING.checkpointRadius - 1, 1],
    [TUNING.checkpointRadius + 1, 0],
  ]) {
    const side = begin(noGates());
    placePlayer(side, 58, off);
    setInput(side, { forward: true });
    tick(side, 1.5);
    assert.equal(side.checkpoint, count);
  }
  // crossing it backwards does not count
  const back = begin(noGates());
  placePlayer(back, 63);
  back.player.yaw = 0;
  setInput(back, { forward: true });
  tick(back, 2);
  assert.ok(back.player.z < 57);
  assert.equal(back.checkpoint, 0);
});

test("the finish cannot be claimed off the route or the wrong way round", () => {
  // a lap whose finish is where the start is: sitting there, or backing over the line, is not a finish
  const sit = begin(lap());
  tick(sit, 5);
  assert.equal(sit.checkpoint, 0);
  assert.equal(sit.phase, "racing");
  const over = begin(lap());
  over.player.yaw = Math.PI; // facing back over the start line
  setInput(over, { forward: true });
  tick(over, 3);
  assert.ok(over.player.z > 5);
  over.player.yaw = 0;
  tick(over, 4);
  assert.ok(over.player.z < 0, "came back across the line forwards");
  assert.equal(over.checkpoint, 0);
  assert.equal(over.finishTime, null);
  // the whole lap backwards passes every checkpoint, last first: none count
  const pilot = (race, order) => {
    let k = 0;
    return () => {
      const [x, z] = order[k];
      const p = race.player,
        err = turn(p.yaw, Math.atan2(x - p.x, p.z - z));
      if (Math.hypot(x - p.x, z - p.z) < 4 && ++k === order.length) return null;
      return { forward: true, left: err < -0.03, right: err > 0.03 };
    };
  };
  const fly = (order, tuning) => {
    const race = begin(lap(), tuning);
    const policy = pilot(race, order);
    for (let t = 0; t < 80 && race.phase === "racing"; t += 1 / 60) {
      const keys = policy();
      if (!keys) break; // flew the whole route
      setInput(race, keys);
      advance(race, 1 / 60);
    }
    return race;
  };
  // a rival slow enough to leave the lap to the player
  const slow = { ...TUNING, whaleCruise: 2, whaleRubberMax: 0 };
  const backwards = fly(
    [
      [80, 0],
      [80, -80],
      [0, -80],
      [0, 0],
      [0, 20],
    ],
    slow,
  );
  assert.equal(backwards.checkpoint, 0);
  assert.equal(backwards.finishTime, null);
  assert.equal(backwards.phase, "racing");
  assert.ok(Math.hypot(backwards.player.x, backwards.player.z - 20) < 5);
  assert.ok(snapshot(backwards).progress < 0.1);
  // cutting the corner straight to the last leg skips checkpoints, so the finish stays closed
  const cut = fly(
    [
      [0, -50],
      [80, -50],
      [80, 0],
      [0, 0],
      [-20, 0],
    ],
    slow,
  );
  assert.equal(cut.checkpoint, 1, "the one it swam through before leaving");
  assert.ok(
    Math.hypot(cut.player.x + 20, cut.player.z) < 5,
    "it swam over the finish line",
  );
  assert.equal(cut.finishTime, null);
  // the lap the right way round does finish
  const round = fly(
    [
      [0, -80],
      [80, -80],
      [80, 0],
      [0, 0],
      [-20, 0],
    ],
    slow,
  );
  assert.equal(round.checkpoint, 8);
  assert.equal(round.winner, "player");
  // on an open course, swimming off beyond the far end and around does not finish either
  const off = begin(noGates());
  placePlayer(off, 470, 40);
  setInput(off, { forward: true });
  tick(off, 4);
  assert.ok(off.player.z > 480);
  assert.equal(off.finishTime, null);
  assert.equal(off.phase, "racing");
});

test("the world can stop the player without the model steering it", () => {
  const race = begin(noGates());
  const seen = [];
  // a wall across the course at z = 20
  race.resolvePlayerMotion = (p, prev) => {
    if (seen.length < 1) seen.push({ ...prev, to: p.z });
    if (p.z > 20) {
      p.x = prev.x;
      p.y = prev.y;
      p.z = prev.z;
      p.speed *= 0.5;
    }
  };
  setInput(race, { forward: true });
  tick(race, 8);
  assert.deepEqual(Object.keys(seen[0]), ["x", "y", "z", "to"]);
  assert.ok(
    seen[0].z === 0 && seen[0].to > 0,
    "called with the position before the move",
  );
  const p = race.player;
  assert.ok(p.z <= 20 && p.z > 19.8);
  assert.ok(p.s <= 20, "progress stops where the whale does");
  assert.ok(
    near(Math.abs(p.yaw), Math.PI) && p.pitch === 0,
    "heading untouched",
  );
  assert.ok(p.speed < 1);
  assert.equal(race.checkpoint, 0);
  // the way round is the player's to find
  setInput(race, { forward: true, right: true });
  tick(race, 0.5);
  assert.ok(Math.abs(p.yaw) < Math.PI - 0.3);
  // the callback survives a restart
  const fn = race.resolvePlayerMotion;
  restartRace(race);
  assert.equal(race.resolvePlayerMotion, fn);
});

test("the result does not depend on the frame rate", () => {
  // boost on the race clock rather than on a stamina threshold, which a frame of delay can tip either way
  const timed = (take) => (race) => ({
    forward: true,
    boost: race.elapsed % 6 < 2.5,
    ...steer(race, 1, take),
  });
  const a = run(timed(), { dt: 1 / 30 });
  const b = run(timed(), { dt: 1 / 144 });
  const c = run(timed(), { dt: 1 / 60 });
  assert.equal(a.winner, "player");
  assert.equal(a.winner, b.winner);
  // the keys are read once a frame, so a pilot's corrections land at slightly different moments
  assert.ok(
    Math.abs(a.finishTime - b.finishTime) < 0.5,
    `${a.finishTime} vs ${b.finishTime}`,
  );
  assert.ok(Math.abs(a.finishTime - c.finishTime) < 0.5);
  // the same frame times give exactly the same race
  const d = run(timed(), { dt: 1 / 60 });
  assert.equal(c.finishTime, d.finishTime);
  assert.equal(c.whale.s, d.whale.s);
  assert.deepEqual(
    [c.player.x, c.player.y, c.player.z, c.player.yaw],
    [d.player.x, d.player.y, d.player.z, d.player.yaw],
  );
  // the same keys held for the same times trace the same path at any frame rate
  const path = (dt) => {
    const race = begin(noGates());
    const script = [
      [1, { forward: true }],
      [0.5, { right: true }],
      [1, { right: false, up: true, boost: true }],
      [0.5, { up: false, left: true }],
      [2, { left: false, boost: false }],
    ];
    for (const [secs, keys] of script) {
      setInput(race, keys);
      tick(race, secs, dt);
    }
    return race.player;
  };
  const p30 = path(1 / 30),
    p120 = path(1 / 120);
  for (const k of ["x", "y", "z", "yaw", "pitch", "speed", "stamina"])
    assert.ok(near(p30[k], p120[k], 1e-6), `${k}: ${p30[k]} vs ${p120[k]}`);
  assert.ok(Math.abs(p30.x) > 1 && p30.y > 1);
  // gates are judged where the whale crosses them, so the same ones are taken at any frame rate
  assert.deepEqual(a.gateLog, b.gateLog);
  const sloppy = (dt) =>
    run(
      timed((i) => i % 3 !== 1),
      { dt },
    );
  assert.deepEqual(sloppy(1 / 30).gateLog, sloppy(1 / 144).gateLog);
});

test("a long frame advances at most a quarter second", () => {
  const race = createRace(straight());
  startRace(race);
  assert.equal(advance(race, 10), Math.round(0.25 / STEP));
  assert.ok(race.countdown > COUNTDOWN - 0.26);
});

test("pausing freezes the race and resumes the phase it interrupted", () => {
  const race = createRace(straight());
  assert.equal(
    setPaused(race, true),
    false,
    "nothing to pause before the start",
  );
  startRace(race);
  tick(race, 1);
  assert.equal(setPaused(race, true), true);
  assert.equal(race.phase, "paused");
  const left = race.countdown;
  tick(race, 5);
  assert.equal(race.countdown, left);
  assert.equal(snapshot(race).countdown, left);
  assert.equal(setPaused(race, false), true);
  assert.equal(race.phase, "countdown");
  tick(race, COUNTDOWN);
  setInput(race, { forward: true });
  tick(race, 2);
  setPaused(race); // toggles
  assert.equal(race.phase, "paused");
  const s = race.player.s,
    t = race.elapsed;
  tick(race, 3);
  assert.equal(race.player.s, s);
  assert.equal(race.elapsed, t);
  // steering held through a pause turns and moves nothing
  const { x, z, yaw } = race.player;
  setInput(race, { right: true, up: true });
  tick(race, 1);
  assert.deepEqual(
    [race.player.x, race.player.z, race.player.yaw, race.player.pitch],
    [x, z, yaw, 0],
  );
  setInput(race, { right: false, up: false });
  assert.equal(startRace(race), true, "start resumes a paused race");
  assert.equal(race.phase, "racing");
});

test("restart puts both racers back on the line and counts down again", () => {
  const race = run(smartBoost());
  assert.equal(race.phase, "finished");
  restartRace(race);
  assert.equal(race.phase, "countdown");
  assert.equal(race.player.s, 0);
  assert.equal(race.whale.s, 0);
  assert.equal(race.winner, null);
  assert.equal(race.checkpoint, 0);
  assert.equal(race.player.stamina, 1);
  assert.deepEqual(
    [race.gate, race.gateHits, race.streak, race.gateLog.length],
    [0, 0, 0, 0],
  );
  assert.deepEqual([race.player.lx, race.player.ly], [0, 0]);
  assert.deepEqual([race.player.x, race.player.y, race.player.z], [0, 0, 0]);
  assert.ok(near(Math.abs(race.player.yaw), Math.PI), "facing down the course");
  assert.deepEqual(
    [race.player.pitch, race.player.yawRate, race.player.pitchRate],
    [0, 0, 0],
  );
  assert.equal(race.player.surge + race.player.stall, 0);
  // a restart mid-turn, well off the course, also starts clean and facing down it
  const lost = begin(curved());
  setInput(lost, { forward: true, right: true, up: true });
  tick(lost, 3);
  assert.ok(lost.player.courseDistance > 5);
  restartRace(lost);
  tick(lost, COUNTDOWN);
  assert.deepEqual(
    [lost.player.x, lost.player.y, lost.player.z, lost.player.pitch],
    [0, 0, 0, 0],
  );
  assert.equal(lost.player.yaw, 0, "this course starts down -z");
  tick(lost, 0.5);
  assert.ok(
    lost.player.yaw > 0 && lost.player.pitch > 0,
    "the held keys act once it is racing",
  );
  clearInput(lost);
  // start after a finish also begins a new race
  const done = run(() => ({}));
  assert.equal(startRace(done), true);
  assert.equal(done.phase, "countdown");
  assert.equal(done.elapsed, 0);
});

test("nothing holds the player to the course", () => {
  const race = begin();
  setInput(race, { forward: true, right: true, up: true });
  tick(race, 1);
  setInput(race, { right: false, up: false });
  tick(race, 12);
  const { lx, ly, courseDistance } = race.player;
  assert.ok(lx > 20 && ly > 20, `${lx}, ${ly}`);
  assert.ok(near(courseDistance, Math.hypot(lx, ly), 1e-6));
  assert.equal(snapshot(race).offCourse, true);
  clearInput(race);
  assert.deepEqual(race.input, {
    forward: 0,
    boost: false,
    left: false,
    right: false,
    up: false,
    down: false,
  });
  // and with the keys released it drifts to a stop where it is, still pointing where it was
  const { yaw, pitch } = race.player;
  tick(race, 6);
  assert.ok(race.player.speed < 0.01);
  assert.ok(race.player.lx > lx);
  assert.deepEqual([race.player.yaw, race.player.pitch], [yaw, pitch]);
});

test("input patches merge and accept booleans", () => {
  const race = createRace(straight());
  setInput(race, { forward: true, boost: true });
  setInput(race, { boost: false });
  assert.equal(race.input.forward, 1);
  assert.equal(race.input.boost, false);
  setInput(race, { forward: 0.5, nonsense: 1 });
  assert.equal(race.input.forward, 0.5);
  assert.equal("nonsense" in race.input, false);
  setInput(race, null);
  assert.equal(race.input.forward, 0.5);
});

test("snapshot reports the HUD fields", () => {
  const race = createRace(straight());
  const s = snapshot(race);
  assert.equal(s.phase, "ready");
  assert.equal(s.distance, 480);
  assert.equal(s.winner, null);
  assert.equal(s.stamina, 1);
  assert.equal(s.offCourse, false);
  for (const k of [
    "elapsed",
    "countdown",
    "progress",
    "whaleProgress",
    "lead",
    "speed",
    "x",
    "y",
    "z",
    "yaw",
    "pitch",
    "courseDistance",
    "checkpointDistance",
    "aimX",
    "aimY",
    "aimYaw",
    "aimPitch",
    "gateDistance",
  ])
    assert.equal(typeof s[k], "number", k);
  assert.deepEqual(CAMERAS, ["chase", "first-person", "side", "overhead"]);
});

test("a dead heat is a tie", () => {
  // pin both racers to the same speed: no whale pace waves, a rubber band fixed at 7.5 m/s, no wake bonus
  const tuning = {
    ...TUNING,
    whaleCruise: 0,
    whaleRubberMin: 7.5,
    whaleRubberMax: 7.5,
    glide: 7.5,
    cruise: 7.5,
    draftSpeed: 0,
  };
  const race = begin(noGates(), tuning);
  drop(race, 479.99);
  race.whale.s = 479.99;
  setInput(race, { forward: true });
  race.player.speed = race.whale.speed = 7.5;
  tick(race, STEP * 2);
  assert.equal(race.phase, "finished");
  assert.equal(race.winner, "tie");
});

test("finish order uses crossing time rather than overshoot within a step", () => {
  const tuning = { ...TUNING, accel: 0, draftSpeed: 0 };
  const race = begin(noGates(), tuning);
  drop(race, 479.999);
  race.player.speed = 1;
  race.whale.s = 479.91;
  race.whale.speed = 12;
  advance(race, STEP);
  assert.equal(race.winner, "player");
  assert.ok(
    race.whale.s > race.player.s,
    "the whale overshoots farther but crosses later",
  );
  assert.ok(Math.abs(race.finishTime - 0.001) < 1e-8);
});

test("the result margin stays fixed while the racers coast beyond the finish", () => {
  const race = run(smartBoost());
  const result = snapshot(race);
  tick(race, 4);
  assert.equal(snapshot(race).lead, result.lead);
  assert.equal(snapshot(race).elapsed, result.elapsed);
  assert.equal(race.winner, result.winner);
});
