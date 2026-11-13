import test from "node:test";
import assert from "node:assert/strict";
import { identityTransforms, normalizeTransform, hitTestPart, createHistory, beginGesture, updateGesture, commitGesture, cancelGesture, commitEdit, undo, redo } from "../src/editor-model.js";

const state = () => ({ parts: { head: "a" }, softness: 20, transforms: identityTransforms() });
test("gesture updates coalesce, cancellation preserves redo, and edits clear it", () => {
  let h = createHistory(state());
  h = beginGesture(h);
  h = updateGesture(h, { ...h.present, softness: 30 });
  h = updateGesture(h, { ...h.present, softness: 40 });
  h = commitGesture(h);
  assert.equal(h.past.length, 1);
  h = undo(h);
  assert.equal(h.present.softness, 20);
  h = beginGesture(h);
  h = updateGesture(h, { ...h.present, softness: 55 });
  h = cancelGesture(h);
  assert.equal(h.present.softness, 20);
  assert.equal(redo(h).present.softness, 40);
  h = commitEdit(h, { ...h.present, parts: { head: "b" } });
  assert.equal(h.future.length, 0);
  assert.equal(undo(h).present.parts.head, "a");
});
test("history is bounded and transform inputs are finite and clamped", () => {
  let h = createHistory(state());
  for (let i = 0; i < 55; i++) h = commitEdit(h, { ...h.present, softness: i });
  assert.equal(h.past.length, 50);
  assert.deepEqual(normalizeTransform({ x: Infinity, y: 999, scaleX: -1, scaleY: 9, rotation: -999 }), { x: 0, y: 600, scaleX: 0.1, scaleY: 3, rotation: -360 });
});
test("hit testing reverses translation, rotation, and nonuniform scale", () => {
  const t = { x: 40, y: 20, scaleX: 2, scaleY: 0.5, rotation: 90 };
  assert.equal(hitTestPart("head", { x: 140, y: 413 }, t), true);
  assert.equal(hitTestPart("head", { x: 140, y: 620 }, t), false);
  assert.equal(hitTestPart("unknown", { x: 0, y: 0 }, t), false);
});
