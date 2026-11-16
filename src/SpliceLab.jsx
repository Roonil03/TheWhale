import React, { useEffect, useRef, useState } from "react";
import { PARTS, parseEditorRecipe, shareEditorUrl } from "./mixer";
import specimens from "virtual:whale-manifest";
import { RENDER_SIZE, createWhaleRenderer } from "./compositor";
import { createImageLoader } from "./image-loader";
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
import {
  Check,
  ChevronDown,
  CircleAlert,
  Download,
  Link,
  LoaderCircle,
  Redo2,
  RefreshCcw,
  RefreshCw,
  RotateCcw,
  Shuffle,
  Undo2,
} from "lucide-react";
import "./lab-editor.css";

const asset = (path) => import.meta.env.BASE_URL + path.replace(/^\/?/, "");
const name = (part) => part[0].toUpperCase() + part.slice(1);

export function SpliceLab() {
  const items = specimens;
  const [images, setImages] = useState({}),
    [failed, setFailed] = useState([]),
    [retryRevision, setRetryRevision] = useState(0);
  const [history, setHistory] = useState(() =>
      createHistory(parseEditorRecipe(specimens, location.search)),
    ),
    [selected, setSelected] = useState("head"),
    [notice, setNotice] = useState(""),
    [exportUrl, setExportUrl] = useState("");
  const historyRef = useRef(history),
    canvas = useRef(null),
    stage = useRef(null),
    gesture = useRef(null),
    version = useRef(0),
    loader = useRef(null),
    renderer = useRef(null),
    frame = useRef(null),
    pendingPoint = useRef(null);
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
  const state = history?.present;
  const selectedIds = state
    ? [...new Set(PARTS.map((part) => state.parts[part]))].sort()
    : [];
  const selectedKey = selectedIds.join("|");
  useEffect(() => {
    const imageLoader = createImageLoader();
    const whaleRenderer = createWhaleRenderer();
    loader.current = imageLoader;
    renderer.current = whaleRenderer;
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      imageLoader.dispose();
      whaleRenderer.dispose();
      loader.current = null;
      renderer.current = null;
    };
  }, []);
  useEffect(() => {
    if (!selectedKey || !loader.current) return;
    let active = true;
    selectedKey.split("|").forEach((id) => {
      const item = items.find((candidate) => candidate.id === id);
      if (!item) return;
      loader.current.load(id, asset(item.file)).then((entry) => {
        if (!active) return;
        if (entry.status === "ready")
          setImages((old) =>
            old[id] === entry.image ? old : { ...old, [id]: entry.image },
          );
        else setFailed((old) => (old.includes(id) ? old : [...old, id]));
      });
    });
    return () => {
      active = false;
    };
  }, [items, selectedKey, retryRevision]);
  const ready = state && selectedIds.every((id) => images[id]);
  useEffect(() => {
    if (ready && canvas.current)
      renderer.current?.render(
        canvas.current,
        images,
        state.parts,
        state.softness,
        state.transforms,
      );
  }, [ready, state, images]);
  const retryImages = () => {
    failed.forEach((id) => loader.current.retry(id));
    setFailed([]);
    setRetryRevision((revision) => revision + 1);
  };
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
  const applyMove = (p) => {
    const g = gesture.current;
    if (!g || !p) return;
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
  const move = (event) => {
    if (!gesture.current || gesture.current.id !== event.pointerId) return;
    pendingPoint.current = point(event);
    if (frame.current === null)
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        const latest = pendingPoint.current;
        pendingPoint.current = null;
        applyMove(latest);
      });
  };
  const finish = (event, cancelled = false) => {
    if (!gesture.current || gesture.current.id !== event.pointerId) return;
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    if (!cancelled) {
      if (typeof event.clientX === "number")
        pendingPoint.current = point(event);
      applyMove(pendingPoint.current);
    }
    pendingPoint.current = null;
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
  const icon = { size: 16, strokeWidth: 1.75, "aria-hidden": true };
  return (
    <section className="splice-editor wrap" aria-labelledby="lab-title">
      <header className="lab-heading">
        <h1 id="lab-title">Splice lab</h1>
        <p>Combine four parts from different whales.</p>
      </header>
      {
        <div className="lab-layout">
          <div className="lab-workspace">
            <div className="lab-viewport">
              <div className="lab-toolbar">
                <div className="lab-history">
                  <button
                    className="lab-button"
                    onClick={() => {
                      invalidate();
                      setH(undo(historyRef.current));
                    }}
                    disabled={!history.past.length}
                    aria-label="Undo"
                    title="Undo (Ctrl+Z)"
                  >
                    <Undo2 {...icon} />
                    <span>Undo</span>
                  </button>
                  <button
                    className="lab-button"
                    onClick={() => {
                      invalidate();
                      setH(redo(historyRef.current));
                    }}
                    disabled={!history.future.length}
                    aria-label="Redo"
                    title="Redo (Ctrl+Y)"
                  >
                    <Redo2 {...icon} />
                    <span>Redo</span>
                  </button>
                </div>
                <div className="lab-secondary">
                  <button
                    className="lab-button lab-ghost"
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
                    <Shuffle {...icon} />
                    <span>Shuffle parts</span>
                  </button>
                  <button
                    className="lab-button lab-ghost"
                    onClick={() => edit(parseEditorRecipe(items, ""))}
                  >
                    <RefreshCcw {...icon} />
                    <span>Reset lab</span>
                  </button>
                </div>
              </div>
              <div className="lab-stage-shell">
                <div
                  className="lab-stage"
                  ref={stage}
                  onPointerDown={selectAt}
                  onPointerMove={move}
                  onPointerUp={(e) => finish(e)}
                  onPointerCancel={(e) => finish(e, true)}
                  onLostPointerCapture={(e) => finish(e, true)}
                  aria-label="Whale assembly canvas"
                  aria-describedby="lab-hint"
                >
                  <canvas
                    ref={canvas}
                    width={RENDER_SIZE}
                    height={RENDER_SIZE}
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
                      <div
                        className="lab-blur lab-blur-veil"
                        aria-hidden="true"
                      >
                        <i />
                        <i />
                        <i />
                        <i />
                        <i />
                      </div>
                      {failed.some((id) =>
                        PARTS.some((part) => state.parts[part] === id),
                      ) ? (
                        <div className="stage-message-text">
                          <p>
                            <CircleAlert {...icon} />A selected image could not
                            be loaded.
                          </p>
                          <p>
                            <button
                              type="button"
                              className="lab-button lab-retry"
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={retryImages}
                            >
                              <RefreshCw {...icon} />
                              Retry
                            </button>
                            or choose another specimen.
                          </p>
                        </div>
                      ) : (
                        <div className="stage-message-text">
                          <p>
                            <LoaderCircle {...icon} className="lab-spin" />
                            Preparing your specimen…
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="lab-blur lab-blur-down" aria-hidden="true">
                <i />
                <i />
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="lab-footnote">
              <p className="lab-hint" id="lab-hint">
                Drag to move, corner to resize, top handle to rotate. Arrow keys
                nudge (Shift: 10 px), Esc cancels.
              </p>
              <span className="lab-caption">
                {RENDER_SIZE} × {RENDER_SIZE} transparent PNG
              </span>
            </div>
          </div>
          <aside className="lab-inspector">
            <div className="lab-inspector-body">
              <div className="part-tabs" aria-label="Select a whale part">
                {PARTS.map((part) => (
                  <button
                    key={part}
                    className={
                      selected === part ? "active part-" + part : "part-" + part
                    }
                    aria-pressed={selected === part}
                    onClick={() => setSelected(part)}
                  >
                    {name(part)}
                  </button>
                ))}
              </div>
              <label className="lab-field">
                <span className="lab-label">{name(selected)} specimen</span>
                <span className="lab-select">
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
                  <ChevronDown {...icon} />
                </span>
              </label>
              <div className="lab-group">
                <div className="lab-row">
                  <span className="lab-label">Transform</span>
                  <button
                    className="lab-link"
                    aria-label={"Reset " + name(selected)}
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
                    <RotateCcw {...icon} />
                    Reset
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
                    <label key={key} className={"transform-field field-" + key}>
                      <span className="lab-label">{label}</span>
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
                    </label>
                  ))}
                </div>
              </div>
              <label className="lab-seam">
                <span className="lab-row">
                  <span className="lab-label">Soften seams</span>
                  <b>{state.softness}%</b>
                </span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={state.softness}
                  style={{ "--fill": state.softness + "%" }}
                  onPointerDown={() => {
                    invalidate();
                    setH(beginGesture(historyRef.current));
                  }}
                  onPointerUp={() => setH(commitGesture(historyRef.current))}
                  onPointerCancel={() =>
                    setH(cancelGesture(historyRef.current))
                  }
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
              </label>
              <div className="lab-dock">
                <div className="lab-blur lab-blur-up" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
                <div className="lab-actions">
                  <button
                    className="lab-button lab-download"
                    disabled={!ready || !!history.gesture}
                    onClick={download}
                  >
                    <Download {...icon} />
                    Download PNG
                  </button>
                  <button className="lab-button" onClick={share}>
                    {notice === "Share link copied." ? (
                      <Check {...icon} />
                    ) : (
                      <Link {...icon} />
                    )}
                    Copy share link
                  </button>
                </div>
                <div className="lab-feedback">
                  <p className="lab-notice" role="status">
                    <span key={notice}>{notice}</span>
                  </p>
                  {exportUrl && (
                    <a
                      className="lab-link lab-save"
                      href={exportUrl}
                      download="the-whale-splice.png"
                    >
                      <Download {...icon} />
                      Save PNG
                    </a>
                  )}
                </div>
              </div>
            </div>
          </aside>
        </div>
      }
    </section>
  );
}
