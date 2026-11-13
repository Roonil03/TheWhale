export const PART_BOUNDS = {
  spout: { x: 0, y: 0, width: 600, height: 186 },
  head: { x: 0, y: 186, width: 200, height: 414 },
  body: { x: 200, y: 186, width: 200, height: 414 },
  tail: { x: 400, y: 186, width: 200, height: 414 },
};

const IDENTITY = { x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0 };
const clamp = (value, min, max, fallback) =>
  typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;

export function normalizeTransform(value = {}) {
  value = value && typeof value === "object" ? value : {};
  return {
    x: clamp(value.x, -600, 600, 0),
    y: clamp(value.y, -600, 600, 0),
    scaleX: clamp(value.scaleX, 0.1, 3, 1),
    scaleY: clamp(value.scaleY, 0.1, 3, 1),
    rotation: clamp(value.rotation, -360, 360, 0),
  };
}

export function identityTransforms() {
  return Object.fromEntries(Object.keys(PART_BOUNDS).map((key) => [key, { ...IDENTITY }]));
}

export function normalizeTransforms(value = {}) {
  return Object.fromEntries(
    Object.keys(PART_BOUNDS).map((key) => [key, normalizeTransform(value?.[key])]),
  );
}

export function hitTestPart(part, point, transform) {
  const bounds = PART_BOUNDS[part];
  if (!bounds || !point) return false;
  const t = normalizeTransform(transform);
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const dx = point.x - cx - t.x;
  const dy = point.y - cy - t.y;
  const angle = t.rotation * Math.PI / 180;
  const x = (dx * Math.cos(angle) + dy * Math.sin(angle)) / t.scaleX;
  const y = (-dx * Math.sin(angle) + dy * Math.cos(angle)) / t.scaleY;
  return Math.abs(x) <= bounds.width / 2 && Math.abs(y) <= bounds.height / 2;
}

const copy = (state) => structuredClone(state);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const LIMIT = 50;
export function createHistory(state) {
  return { past: [], present: copy(state), future: [], gesture: null };
}
export function beginGesture(history) {
  return history.gesture ? history : { ...history, gesture: copy(history.present) };
}
export function updateGesture(history, state) {
  return history.gesture ? { ...history, present: copy(state) } : history;
}
export function commitGesture(history) {
  if (!history.gesture) return history;
  if (same(history.gesture, history.present)) return { ...history, gesture: null };
  return { past: [...history.past, history.gesture].slice(-LIMIT), present: history.present, future: [], gesture: null };
}
export function cancelGesture(history) {
  return history.gesture ? { ...history, present: history.gesture, gesture: null } : history;
}
export function commitEdit(history, state) {
  const base = cancelGesture(history);
  if (same(base.present, state)) return base;
  return { past: [...base.past, base.present].slice(-LIMIT), present: copy(state), future: [], gesture: null };
}
export function undo(history) {
  const base = cancelGesture(history);
  if (!base.past.length) return base;
  return { past: base.past.slice(0, -1), present: base.past.at(-1), future: [base.present, ...base.future], gesture: null };
}
export function redo(history) {
  const base = cancelGesture(history);
  if (!base.future.length) return base;
  return { past: [...base.past, base.present].slice(-LIMIT), present: base.future[0], future: base.future.slice(1), gesture: null };
}
