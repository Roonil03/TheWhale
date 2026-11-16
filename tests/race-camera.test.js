import test from "node:test";
import assert from "node:assert/strict";
import { segmentBoxEntry } from "../src/game/camera-model.js";

const lower = [-5, -2, -8];
const upper = [5, 3, 8];

test("camera boom stops at a hull even when both endpoints are outside it", () => {
  assert.equal(segmentBoxEntry([0, -10, 0], [0, 10, 0], lower, upper), 0.4);
  assert.equal(segmentBoxEntry([0, 10, 0], [0, -10, 0], lower, upper), 0.35);
});

test("a parallel camera boom clear of the hull is unchanged", () => {
  assert.equal(segmentBoxEntry([6, -10, 0], [6, 10, 0], lower, upper), null);
  assert.equal(segmentBoxEntry([0, -10, 0], [0, -5, 0], lower, upper), null);
});

test("a boom already in a prop clips immediately, including a zero-length boom", () => {
  assert.equal(segmentBoxEntry([0, 0, 0], [0, 10, 0], lower, upper), 0);
  assert.equal(segmentBoxEntry([0, 0, 0], [0, 0, 0], lower, upper), 0);
});

// ---------------------------------------------------------------- whale-sized framing
const { WHALE } = await import("../src/game/whale-mesh.js");
const { chaseBoom, firstPersonEye, fitDistance, insideBody, sideDistance } =
  await import("../src/game/camera-model.js");
const TAN = 0.6,
  SCALE = 0.68,
  LANDSCAPE = 16 / 9,
  PORTRAIT = 9 / 19.5;

test("fitDistance is limited by the narrow axis of the screen", () => {
  assert.equal(fitDistance(3, 3, 1, 0.5), 6);
  assert.ok(
    fitDistance(3, 1, PORTRAIT, TAN) > fitDistance(3, 1, LANDSCAPE, TAN),
  );
  // at the returned distance the half-width exactly fills half the frame
  const d = fitDistance(3, 0, PORTRAIT, TAN);
  assert.ok(Math.abs(d * TAN * PORTRAIT - 3) < 1e-9);
});

test("the first-person eye is on the snout, outside the hull and ahead of the flippers", () => {
  const eye = firstPersonEye(WHALE, SCALE);
  assert.ok(
    eye.forward < WHALE.noseZ * SCALE,
    "not floating ahead of the nose",
  );
  assert.ok(
    eye.forward > WHALE.flipperRoot[2] * SCALE + 0.5,
    "flippers stay behind the view",
  );
  assert.ok(eye.up > WHALE.eye[1] * SCALE, "above the eye line");
  assert.ok(eye.up < WHALE.top * SCALE, "below the top of the back");
  // scales with the animal
  const big = firstPersonEye(WHALE, 1);
  assert.ok(Math.abs(big.forward * SCALE - eye.forward) < 1e-9);
});

test("the chase boom clears the flukes and frames the flippers in landscape and portrait", () => {
  for (const aspect of [LANDSCAPE, 4 / 3, 1, PORTRAIT, 0.3]) {
    const boom = chaseBoom(WHALE, SCALE, aspect, TAN);
    const flukes = -WHALE.tailZ * SCALE;
    assert.ok(
      boom.back - flukes >= 6 - 1e-9,
      `open water behind the flukes at ${aspect}`,
    );
    assert.ok(boom.back <= flukes + 11 + 1e-9, `bounded boom at ${aspect}`);
    assert.ok(boom.up > WHALE.top * SCALE + 1, "looks over the back");
    if (aspect >= PORTRAIT) {
      const halfFrame = boom.back * TAN * aspect;
      assert.ok(
        halfFrame >= (WHALE.flipperSpan / 2) * SCALE + 0.5,
        `flippers in frame at ${aspect}`,
      );
    }
  }
  const wide = chaseBoom(WHALE, SCALE, LANDSCAPE, TAN),
    tall = chaseBoom(WHALE, SCALE, PORTRAIT, TAN);
  assert.ok(
    tall.back > wide.back + 2,
    "a portrait screen pulls the camera back",
  );
  assert.ok(
    chaseBoom(WHALE, 0.85, LANDSCAPE, TAN).back > wide.back,
    "a bigger whale needs a longer boom",
  );
});

test("the side camera backs off with the gap and stays inside its limits", () => {
  const half = (WHALE.length / 2) * SCALE;
  assert.equal(sideDistance(0, half, LANDSCAPE, TAN), 9);
  assert.equal(sideDistance(200, half, LANDSCAPE, TAN), 20);
  assert.equal(
    sideDistance(-12, half, LANDSCAPE, TAN),
    sideDistance(12, half, LANDSCAPE, TAN),
  );
  const d = sideDistance(18, half, LANDSCAPE, TAN);
  assert.ok(d > 9 && d < 20);
  assert.ok(
    d * TAN * LANDSCAPE >= 9 + half,
    "both racers fit across the frame",
  );
  assert.ok(
    sideDistance(0, half, PORTRAIT, TAN) * TAN * PORTRAIT >= half,
    "the whole whale fits in portrait",
  );
});

test("insideBody encloses every vertex of the whale and releases a clear camera", async () => {
  const { buildWhale } = await import("../src/game/whale-mesh.js");
  const points = [];
  buildWhale({
    v: (x, y, z) => points.push([x, y, z]) - 1,
    tri() {},
    quad() {},
  });
  for (const [x, y, z] of points) {
    // mesh +x is the whale's left, so right = -x
    assert.ok(
      insideBody(z * SCALE, -x * SCALE, y * SCALE, WHALE, SCALE),
      `vertex ${x},${y},${z}`,
    );
  }
  const boom = chaseBoom(WHALE, SCALE, LANDSCAPE, TAN);
  assert.equal(insideBody(-boom.back, 0, boom.up, WHALE, SCALE), false);
  assert.equal(insideBody(0, 9, 1.5, WHALE, SCALE), false);
  assert.equal(insideBody(0, 0, 14, WHALE, SCALE), false);
  const eye = firstPersonEye(WHALE, SCALE);
  assert.equal(
    insideBody(eye.forward, 0, eye.up, WHALE, SCALE),
    true,
    "first person is inside, so the body is hidden",
  );
});
