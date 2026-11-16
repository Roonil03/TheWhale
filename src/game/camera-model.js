// First intersection of a camera boom segment with an axis-aligned box.
// The renderer transforms the boom into an object's local space for rotated props.
export function segmentBoxEntry(origin, end, lower, upper) {
  let entry = 0;
  let exit = 1;
  for (let axis = 0; axis < 3; axis++) {
    const direction = end[axis] - origin[axis];
    if (Math.abs(direction) < 1e-9) {
      if (origin[axis] < lower[axis] || origin[axis] > upper[axis]) return null;
      continue;
    }
    let near = (lower[axis] - origin[axis]) / direction;
    let far = (upper[axis] - origin[axis]) / direction;
    if (near > far) [near, far] = [far, near];
    entry = Math.max(entry, near);
    exit = Math.min(exit, far);
    if (entry > exit) return null;
  }
  return entry;
}

// ---------------------------------------------------------------- whale-sized framing
// `whale` is the WHALE measurement table from whale-mesh.js (mesh space, scale 1) and `scale`
// the racer's instance scale. `tanHalf` is the tangent of half the vertical field of view;
// the horizontal one is tanHalf * aspect, so a portrait phone sees a much narrower slice.

// Distance at which a half-width and half-height both fit in the frame.
export function fitDistance(halfWidth, halfHeight, aspect, tanHalf) {
  return Math.max(halfWidth / (tanHalf * aspect), halfHeight / tanHalf);
}

// First-person viewpoint: on the snout, just above the eye line, ahead of every
// part of the body that the tail beat or the flippers can swing into view.
export function firstPersonEye(whale, scale) {
  return {
    forward: (whale.noseZ - 0.3) * scale,
    up: (whale.eye[1] + 0.45) * scale,
  };
}

// Chase boom behind the body centre. `clearance` metres of open water stay between
// the fluke tips and the camera, and the boom lengthens on narrow screens until the
// flippers and the neighbouring lane (`laneHalf` metres either side) are in frame.
export function chaseBoom(whale, scale, aspect, tanHalf, laneHalf = 3.4) {
  const clearance = 6;
  const tail = -whale.tailZ * scale;
  const wide = Math.max(laneHalf, (whale.flipperSpan / 2) * scale + 0.5);
  const back = Math.min(
    Math.max(tail + clearance, fitDistance(wide, 0, aspect, tanHalf)),
    tail + clearance + 5,
  );
  return { back, up: 0.27 * back, ahead: 5 };
}

// Side-on distance that keeps both racers in frame while `gap` metres apart.
export function sideDistance(
  gap,
  bodyHalf,
  aspect,
  tanHalf,
  nearest = 9,
  farthest = 20,
) {
  const need =
    fitDistance(Math.abs(gap) / 2 + bodyHalf, 0, aspect, tanHalf) * 1.1;
  return Math.min(Math.max(need, nearest), farthest);
}

// True when a camera offset (metres along the racer's forward, right and up axes,
// measured from the mesh origin) lies inside the box bounding the body, flukes and
// flippers, with headroom for the tail beat. The renderer skips the player whale
// then, so a boom shortened by rock or the wreck never shows the inside of the mesh.
export function insideBody(forward, right, up, whale, scale, margin = 0.3) {
  const centre = ((whale.noseZ + whale.tailZ) / 2) * scale;
  const halfLength = (whale.length / 2) * scale + margin;
  const halfSpan = (whale.flipperSpan / 2) * scale + margin;
  const halfDepth = Math.max(whale.top, -whale.bottom) * 1.35 * scale + margin;
  return (
    Math.abs(forward - centre) < halfLength &&
    Math.abs(right) < halfSpan &&
    Math.abs(up) < halfDepth
  );
}
