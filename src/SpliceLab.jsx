import React, { useEffect, useRef, useState } from "react";
import { PARTS, parseEditorRecipe, shareEditorUrl } from "./mixer";
import { drawWhale } from "./compositor";
import {
  PART_BOUNDS,
  normalizeTransform,
  createHistory,
  beginGesture,
  updateGesture,
  commitGesture,
  cancelGesture,
  commitEdit,
  undo,
  redo,
  hitTestPart,
} from "./editor-model";
import "./lab-editor.css";

const asset = (path) => import.meta.env.BASE_URL + path.replace(/^\/?/, "");
const name = (part) => part[0].toUpperCase() + part.slice(1);

export function SpliceLab() {
  const [items, setItems] = useState([]),
    [images, setImages] = useState({}),
    [failed, setFailed] = useState([]),
    [error, setError] = useState("");
  const [history, setHistory] = useState(null),
    [selected, setSelected] = useState("head"),
    [notice, setNotice] = useState(""),
    [exportUrl, setExportUrl] = useState("");
  const historyRef = useRef(null),
    canvas = useRef(null),
    stage = useRef(null),
    gesture = useRef(null),
    version = useRef(0);
  const setH = (next) => {
    historyRef.current = next;
    setHistory(next);
  };
  const invalidate = () => {
    version.current++;
    setExportUrl("");
    setNotice("");
  };
  useEffect(
    () => () => {
      if (exportUrl) URL.revokeObjectURL(exportUrl);
    },
    [exportUrl],
  );
  useEffect(() => {
    let alive = true;
    fetch(asset("whales/manifest.json"), { cache: "no-cache" })
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => {
        if (!Array.isArray(data) || !data.length) throw Error();
        if (!alive) return;
        setItems(data);
        setH(createHistory(parseEditorRecipe(data, location.search)));
        data.forEach((item) => {
          const img = new Image();
          img.onload = () => {
            if (alive) setImages((old) => ({ ...old, [item.id]: img }));
          };
          img.onerror = () => {
            if (alive) setFailed((old) => [...old, item.id]);
          };
          img.src = asset(item.file);
        });
      })
      .catch(() => {
        if (alive)
          setError(
            "The collection could not be loaded. Please refresh the page.",
          );
      });
    return () => {
      alive = false;
    };
  }, []);
  const state = history?.present;
  const ready = state && PARTS.every((part) => images[state.parts[part]]);
  useEffect(() => {
    if (ready && canvas.current)
      drawWhale(
        canvas.current,
        images,
        state.parts,
        state.softness,
        undefined,
        state.transforms,
      );
  }, [images, ready, state]);
  const edit = (next) => {
    invalidate();
    setH(commitEdit(historyRef.current, next));
  };
  const changeTransform = (patch) =>
    edit({
      ...state,
      transforms: {
        ...state.transforms,
        [selected]: normalizeTransform({
          ...state.transforms[selected],
          ...patch,
        }),
      },
    });
  const point = (event) => {
    const rect = stage.current.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) * 600) / rect.width,
      y: ((event.clientY - rect.top) * 600) / rect.height,
    };
  };
  const start = (event, mode, part = selected) => {
    if (!state || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const p = point(event),
      t = state.transforms[part],
      b = PART_BOUNDS[part];
    const center = { x: b.x + b.width / 2 + t.x, y: b.y + b.height / 2 + t.y };
    gesture.current = {
      id: event.pointerId,
      mode,
      part,
      start: p,
      transform: t,
      center,
      distance: Math.max(1, Math.hypot(p.x - center.x, p.y - center.y)),
      angle: Math.atan2(p.y - center.y, p.x - center.x),
    };
    setSelected(part);
    invalidate();
    setH(beginGesture(historyRef.current));
    stage.current.setPointerCapture(event.pointerId);
  };
  const move = (event) => {
    const g = gesture.current;
    if (!g || g.id !== event.pointerId) return;
    const p = point(event);
    let patch;
    if (g.mode === "move")
      patch = {
        x: g.transform.x + p.x - g.start.x,
        y: g.transform.y + p.y - g.start.y,
      };
    else if (g.mode === "resize") {
      const factor =
        Math.hypot(p.x - g.center.x, p.y - g.center.y) / g.distance;
      patch = {
        scaleX: g.transform.scaleX * factor,
        scaleY: g.transform.scaleY * factor,
      };
    } else
      patch = {
        rotation:
          g.transform.rotation +
          ((Math.atan2(p.y - g.center.y, p.x - g.center.x) - g.angle) * 180) /
            Math.PI,
      };
    const current = historyRef.current.present;
    setH(
      updateGesture(historyRef.current, {
        ...current,
        transforms: {
          ...current.transforms,
          [g.part]: normalizeTransform({ ...g.transform, ...patch }),
        },
      }),
    );
  };
  const finish = (event, cancelled = false) => {
    if (!gesture.current || gesture.current.id !== event.pointerId) return;
    gesture.current = null;
    setH(
      cancelled
        ? cancelGesture(historyRef.current)
        : commitGesture(historyRef.current),
    );
    if (stage.current?.hasPointerCapture(event.pointerId))
      stage.current.releasePointerCapture(event.pointerId);
  };
  const selectAt = (event) => {
    if (!state) return;
    const p = point(event),
      part = ["spout", "tail", "body", "head"].find((key) =>
        hitTestPart(key, p, state.transforms[key]),
      );
    if (part) start(event, "move", part);
  };
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && gesture.current) {
        const id = gesture.current.id;
        finish({ pointerId: id }, true);
        return;
      }
      if (
        /^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName) ||
        event.target.isContentEditable ||
        !historyRef.current
      )
        return;
      if (
        (event.ctrlKey || event.metaKey) &&
        (event.key.toLowerCase() === "z" || event.key.toLowerCase() === "y")
      ) {
        event.preventDefault();
        if (gesture.current) finish({ pointerId: gesture.current.id }, true);
        invalidate();
        setH(
          event.key.toLowerCase() === "y" || event.shiftKey
            ? redo(historyRef.current)
            : undo(historyRef.current),
        );
        return;
      }
      const delta = event.shiftKey ? 10 : 1,
        directions = {
          ArrowLeft: [-delta, 0],
          ArrowRight: [delta, 0],
          ArrowUp: [0, -delta],
          ArrowDown: [0, delta],
        };
      if (directions[event.key] && stage.current?.contains(event.target)) {
        event.preventDefault();
        const current = historyRef.current.present,
          t = current.transforms[selected],
          [x, y] = directions[event.key];
        invalidate();
        setH(
          commitEdit(historyRef.current, {
            ...current,
            transforms: {
              ...current.transforms,
              [selected]: normalizeTransform({ ...t, x: t.x + x, y: t.y + y }),
            },
          }),
        );
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });
  const download = () => {
    const currentVersion = version.current;
    try {
      canvas.current.toBlob((blob) => {
        if (currentVersion !== version.current) return;
        try {
          if (!blob) throw new Error("PNG creation failed");
          const url = URL.createObjectURL(blob);
          setExportUrl(url);
          const a = document.createElement("a");
          a.href = url;
          a.download = "the-whale-splice.png";
          document.body.appendChild(a);
          a.click();
          a.remove();
          setNotice(
            "Your transparent PNG is ready. Use the link below if the download did not start.",
          );
        } catch {
          setNotice("Could not create the PNG. Please try again.");
        }
      }, "image/png");
    } catch {
      setNotice("Could not create the PNG. Please try again.");
    }
  };
  const share = async () => {
    const url = shareEditorUrl(location.href, state);
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Share link copied.");
    } catch {
      setNotice("Copy this link: " + url);
    }
  };
  const b = PART_BOUNDS[selected],
    t = state?.transforms[selected];
  return (
    <section className="splice-editor wrap" aria-labelledby="lab-title">
      <div className="editor-heading">
        <div>
          <p className="eyebrow">
            <span className="dot yellow" /> THE SPLICE LAB / 01—04
          </p>
          <h1 id="lab-title">
            Make waves. <em>Make weird.</em>
          </h1>
          <p>
            Four pieces, countless improbable whales. Select a part and make it
            your own.
          </p>
        </div>
        <a href={asset("") + "#collection"}>← Back to collection</a>
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : !state ? (
        <p role="status">Preparing the lab…</p>
      ) : (
        <div className="editor-layout">
          <div className="editor-workspace">
            <div className="editor-toolbar">
              <div>
                <span className="editor-kicker">YOUR SPECIMEN</span>
                <strong>Assembly canvas</strong>
              </div>
              <div className="toolbar-actions">
                <button
                  onClick={() => {
                    invalidate();
                    setH(undo(historyRef.current));
                  }}
                  disabled={!history.past.length}
                  aria-label="Undo"
                >
                  ↶ <span>Undo</span>
                </button>
                <button
                  onClick={() => {
                    invalidate();
                    setH(redo(historyRef.current));
                  }}
                  disabled={!history.future.length}
                  aria-label="Redo"
                >
                  ↷ <span>Redo</span>
                </button>
              </div>
            </div>
            <div className="stage-shell">
              <div
                className="editor-stage"
                ref={stage}
                onPointerDown={selectAt}
                onPointerMove={move}
                onPointerUp={(e) => finish(e)}
                onPointerCancel={(e) => finish(e, true)}
                onLostPointerCapture={(e) => finish(e, true)}
                aria-label="Whale assembly canvas"
              >
                <canvas
                  ref={canvas}
                  width="600"
                  height="600"
                  aria-label="Preview of your spliced whale"
                  style={{ visibility: ready ? "visible" : "hidden" }}
                />
                {ready && (
                  <div
                    className={"selection-box part-" + selected}
                    style={{
                      left: `${(b.x + b.width / 2 + t.x) / 6}%`,
                      top: `${(b.y + b.height / 2 + t.y) / 6}%`,
                      width: `${(b.width * t.scaleX) / 6}%`,
                      height: `${(b.height * t.scaleY) / 6}%`,
                      transform: `translate(-50%, -50%) rotate(${t.rotation}deg)`,
                    }}
                    role="group"
                    aria-label={name(selected) + " selection"}
                  >
                    <button
                      className="move-surface"
                      aria-label={"Move " + name(selected)}
                      onPointerDown={(e) => start(e, "move")}
                    />
                    <span className="selection-label">{name(selected)}</span>
                    <button
                      className="rotate-handle"
                      aria-label={"Rotate " + name(selected)}
                      onPointerDown={(e) => start(e, "rotate")}
                    />
                    <button
                      className="resize-handle"
                      aria-label={"Resize " + name(selected)}
                      onPointerDown={(e) => start(e, "resize")}
                    />
                  </div>
                )}
                {!ready && (
                  <div className="stage-message" role="status">
                    {failed.some((id) =>
                      PARTS.some((part) => state.parts[part] === id),
                    )
                      ? "A selected image could not be loaded. Choose another specimen."
                      : "Preparing your specimen…"}
                  </div>
                )}
              </div>
            </div>
            <div className="stage-caption">
              <span>FIG. X / THE IMPROBABLE WHALE</span>
              <span>600 × 600 PX · TRANSPARENT PNG</span>
            </div>
            <p className="editor-help">
              Drag a slice to move it. Use the corner to resize and the top
              handle to rotate. Arrow keys nudge; hold Shift for 10 px. Escape
              cancels a drag.
            </p>
          </div>
          <aside className="editor-inspector">
            <div className="inspector-head">
              <span className="editor-kicker">ASSEMBLY / 01—04</span>
              <h2>
                Choose your parts<span>.</span>
              </h2>
              <p>Mix specimens, then adjust each slice.</p>
            </div>
            <div className="part-tabs" aria-label="Select a whale part">
              {PARTS.map((part, i) => (
                <button
                  key={part}
                  className={
                    selected === part ? "active part-" + part : "part-" + part
                  }
                  aria-pressed={selected === part}
                  onClick={() => setSelected(part)}
                >
                  <small>0{i + 1}</small>
                  {name(part)}
                </button>
              ))}
            </div>
            <label className="editor-field">
              {name(selected)} specimen
              <select
                value={state.parts[selected]}
                onChange={(e) =>
                  edit({
                    ...state,
                    parts: { ...state.parts, [selected]: e.target.value },
                  })
                }
              >
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="transform-title">
              <span>TRANSFORM / {name(selected).toUpperCase()}</span>
              <button
                onClick={() =>
                  changeTransform({
                    x: 0,
                    y: 0,
                    scaleX: 1,
                    scaleY: 1,
                    rotation: 0,
                  })
                }
              >
                Reset part ↺
              </button>
            </div>
            <div className="transform-grid">
              {[
                ["x", "X", "px"],
                ["y", "Y", "px"],
                ["scaleX", "Width", "%"],
                ["scaleY", "Height", "%"],
                ["rotation", "Rotation", "°"],
              ].map(([key, label, unit]) => (
                <label key={key}>
                  {label}
                  <span>
                    <input
                      type="number"
                      aria-label={name(selected) + " " + label}
                      value={
                        Math.round(
                          t[key] * (key.startsWith("scale") ? 100 : 1) * 10,
                        ) / 10
                      }
                      onChange={(e) => {
                        if (e.target.value !== "")
                          changeTransform({
                            [key]:
                              Number(e.target.value) /
                              (key.startsWith("scale") ? 100 : 1),
                          });
                      }}
                    />
                    <i>{unit}</i>
                  </span>
                </label>
              ))}
            </div>
            <label className="editor-seam">
              <span>
                SOFTEN SEAMS <b>{state.softness}%</b>
              </span>
              <input
                type="range"
                min="0"
                max="100"
                value={state.softness}
                onPointerDown={() => {
                  invalidate();
                  setH(beginGesture(historyRef.current));
                }}
                onPointerUp={() => setH(commitGesture(historyRef.current))}
                onPointerCancel={() => setH(cancelGesture(historyRef.current))}
                onChange={(e) => {
                  const current = historyRef.current;
                  const next = {
                    ...current.present,
                    softness: Number(e.target.value),
                  };
                  if (current.gesture) setH(updateGesture(current, next));
                  else edit(next);
                }}
              />
              <span>
                <small>SHARP</small>
                <small>SOFT</small>
              </span>
            </label>
            <div className="editor-actions">
              <button
                className="editor-download"
                disabled={!ready || !!history.gesture}
                onClick={download}
              >
                Download PNG <span>↓</span>
              </button>
              <button onClick={share}>
                Copy share link <span>↗</span>
              </button>
            </div>
            <div className="editor-secondary">
              <button
                onClick={() =>
                  edit({
                    ...state,
                    parts: Object.fromEntries(
                      PARTS.map((part) => [
                        part,
                        items[Math.floor(Math.random() * items.length)].id,
                      ]),
                    ),
                  })
                }
              >
                ↝ Shuffle parts
              </button>
              <button onClick={() => edit(parseEditorRecipe(items, ""))}>
                ↺ Reset lab
              </button>
            </div>
            <p className="editor-notice" role="status">
              {notice}
            </p>
            {exportUrl && (
              <a href={exportUrl} download="the-whale-splice.png">
                Save PNG ↗
              </a>
            )}
          </aside>
        </div>
      )}
      <div className="editor-foot">
        <span>MADE OF MANY WHALES. BELONGS TO NO OCEAN.</span>
        <span>YOUR CREATION STAYS IN YOUR BROWSER.</span>
      </div>
    </section>
  );
}
