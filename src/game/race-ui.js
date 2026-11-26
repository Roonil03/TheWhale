/**
 * Race HUD for /game. Plain DOM, no framework.
 *
 * The HUD sits in a root element stacked over the WebGPU canvas. The engine
 * owns the race and pushes state in with `update(state)`. The HUD owns the
 * controls and reports what the player asked for through callbacks. It never
 * changes race state itself, so a button does nothing visible until the engine
 * answers with a new `update`.
 *
 * @typedef {'loading'|'ready'|'countdown'|'racing'|'paused'|'finished'|'error'} RacePhase
 * @typedef {'chase'|'first-person'|'side'|'overhead'} RaceCamera
 *
 * @typedef {object} RaceState
 * Every field is optional. `update` merges what it gets into the last state,
 * so the engine can send the whole object each frame or only what changed.
 * @property {RacePhase} [phase]
 * @property {RaceCamera} [camera]
 * @property {number} [elapsed] Race clock in seconds.
 * @property {number} [countdown] Seconds until the start. Shown rounded up.
 * @property {number} [progress] Player position along the course, 0 to 1.
 * @property {number} [whaleProgress] Rival position along the course, 0 to 1.
 * @property {number} [distance] Metres the player still has to swim.
 * @property {number} [lead] Metres between the two. Positive when the player
 *   is ahead, negative when the rival is.
 * @property {'player'|'whale'|'tie'} [winner] Read in the `finished` phase.
 *   `'whale'` is the rival. Falls back to the sign of `lead` when missing.
 * @property {string|{code?: string, title?: string, message?: string}} [error]
 *   Read in the `error` phase. A `code` containing "webgpu" selects the
 *   WebGPU explanation. So does a browser without `navigator.gpu`.
 * @property {boolean} [muted]
 * @property {boolean} [soundAvailable] The audio control is available.
 * @property {number} [stamina] Boost reserve, 0 to 1. The meter hides when
 *   this is missing.
 * @property {boolean} [boosting] Boost is currently adding speed.
 * @property {boolean} [exhausted] Boost is locked until stamina refills to 30%.
 * @property {number} [speed] Metres per second.
 * @property {number} [aimX] Heading-relative horizontal aim toward the next ring.
 * @property {number} [aimY] Heading-relative vertical aim toward the next ring.
 * @property {number} [aimYaw] Radians to turn to face the target.
 * @property {boolean} [aligned] The current heading passes through the next ring.
 * @property {number} [gate] Rings reached.
 * @property {number} [gates] Total rings.
 * @property {'hit'|'miss'|null} [gateResult] Result of the last ring.
 * @property {'ring'|'checkpoint'|'finish'} [aimTarget] Target named by the aim cue.
 * @property {boolean} [hasAim] Keep the cue for a missed checkpoint or the finish.
 * @property {string} [loadingLabel] What the engine is doing while loading.
 * @property {number} [loadProgress] 0 to 1. The bar loops when missing.
 *
 * @typedef {object} RaceInput
 * Held controls. The HUD sends only the keys that changed, so merge each
 * call into your own input object.
 * @property {boolean} [forward]
 * @property {boolean} [boost]
 * @property {boolean} [left]
 * @property {boolean} [right]
 * @property {boolean} [up]
 * @property {boolean} [down]
 *
 * @typedef {object} RaceUIOptions
 * @property {HTMLElement} root Empty element stacked over the canvas.
 * @property {() => void} [onStart] "Start racing" was pressed.
 * @property {(paused: boolean) => void} [onPause] The wanted pause state.
 *   `true` to pause, `false` to resume.
 * @property {() => void} [onRestart] "Race again" or "Restart" was pressed.
 * @property {(camera: RaceCamera) => void} [onCamera] The wanted camera.
 * @property {(input: RaceInput) => void} [onInput] Changed held controls.
 * @property {(muted: boolean) => void} [onSound] The wanted mute state.
 * @property {boolean} [keyboard=true] Set false if the engine binds its own
 *   keys. The HUD then listens to no keyboard events at all.
 * @property {string} [homeHref='../'] Target of the back link.
 */

const SVG_NS = "http://www.w3.org/2000/svg";

/* Icon geometry from Lucide (ISC licence), the icon set the rest of the site uses. */
const ICONS = {
  "arrow-left": [
    ["path", { d: "m12 19-7-7 7-7" }],
    ["path", { d: "M19 12H5" }],
  ],
  play: [
    [
      "path",
      {
        d: "M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z",
      },
    ],
  ],
  pause: [
    ["rect", { x: "14", y: "3", width: "5", height: "18", rx: "1" }],
    ["rect", { x: "5", y: "3", width: "5", height: "18", rx: "1" }],
  ],
  "rotate-ccw": [
    ["path", { d: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }],
    ["path", { d: "M3 3v5h5" }],
  ],
  "volume-2": [
    [
      "path",
      {
        d: "M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z",
      },
    ],
    ["path", { d: "M16 9a5 5 0 0 1 0 6" }],
    ["path", { d: "M19.364 18.364a9 9 0 0 0 0-12.728" }],
  ],
  "volume-x": [
    [
      "path",
      {
        d: "M11 4.702a.7.7 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.7.7 0 0 0 11 19.298z",
      },
    ],
    ["path", { d: "m16.5 14.5 5-5" }],
    ["path", { d: "m16.5 9.5 5 5" }],
  ],
  "chevron-up": [["path", { d: "m18 15-6-6-6 6" }]],
  "chevron-down": [["path", { d: "m6 9 6 6 6-6" }]],
  "chevron-left": [["path", { d: "m15 18-6-6 6-6" }]],
  "chevron-right": [["path", { d: "m9 18 6-6-6-6" }]],
  video: [
    [
      "path",
      {
        d: "m16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5",
      },
    ],
    ["rect", { x: "2", y: "6", width: "14", height: "12", rx: "2" }],
  ],
  "chevrons-up": [
    ["path", { d: "m17 11-5-5-5 5" }],
    ["path", { d: "m17 18-5-5-5 5" }],
  ],
};

const PHASES = new Set([
  "loading",
  "ready",
  "countdown",
  "racing",
  "paused",
  "finished",
  "error",
]);

const CAMERAS = [
  { id: "chase", label: "Chase" },
  { id: "first-person", label: "First person" },
  { id: "side", label: "Side" },
  { id: "overhead", label: "Overhead" },
];

const AXES = ["forward", "boost", "left", "right", "up", "down"];

const MOVE_KEYS = {
  KeyW: "forward",
  KeyA: "left",
  KeyD: "right",
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  KeyE: "up",
  KeyQ: "down",
  ShiftLeft: "boost",
  ShiftRight: "boost",
};

const CAMERA_KEYS = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
  Numpad1: 0,
  Numpad2: 1,
  Numpad3: 2,
  Numpad4: 3,
};

const MILESTONES = ["A quarter of the way", "Halfway", "Three quarters done"];

/* The pad ignores the middle fifth so a resting thumb steers nowhere. */
const PAD_DEAD_ZONE = 0.22;
/* tan(22.5deg). Splits the pad into eight directions. */
const PAD_DIAGONAL = 0.414;

function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value == null || value === false) continue;
      if (key === "class") el.className = value;
      else if (key === "text") el.textContent = value;
      else el.setAttribute(key, value === true ? "" : String(value));
    }
  }
  el.append(...children.filter((child) => child != null && child !== false));
  return el;
}

function icon(name) {
  const svg = document.createElementNS(SVG_NS, "svg");
  const attrs = {
    class: "race-icon",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    "aria-hidden": "true",
    focusable: "false",
  };
  for (const [key, value] of Object.entries(attrs))
    svg.setAttribute(key, value);
  for (const [tag, shape] of ICONS[name]) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [key, value] of Object.entries(shape))
      node.setAttribute(key, value);
    svg.append(node);
  }
  return svg;
}

function kbd(text) {
  return h("kbd", { class: "race-kbd", text });
}

function clamp01(value) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
}

/** 83.456 becomes "1:23.4" with one digit, "1:23.45" with two. */
export function formatTime(seconds, digits = 1) {
  const scale = 10 ** digits;
  const units = Math.floor(Math.max(0, Number(seconds) || 0) * scale + 1e-6);
  const whole = Math.floor(units / scale);
  const minutes = Math.floor(whole / 60);
  const secs = String(whole % 60).padStart(2, "0");
  const fraction = String(units % scale).padStart(digits, "0");
  return `${minutes}:${secs}.${fraction}`;
}

function formatMetres(value) {
  const abs = Math.abs(value);
  return abs < 10 ? abs.toFixed(1) : String(Math.round(abs));
}

function leadSide(lead) {
  if (!Number.isFinite(lead)) return null;
  if (Math.abs(lead) < 0.05) return "level";
  return lead > 0 ? "ahead" : "behind";
}

function leadText(lead) {
  const side = leadSide(lead);
  if (!side) return "";
  if (side === "level") return "Level";
  return side === "ahead"
    ? `You lead by ${formatMetres(lead)} m`
    : `Rival leads by ${formatMetres(lead)} m`;
}

function isTyping(target) {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable]"));
}

/**
 * Build the HUD inside `root`.
 * @param {RaceUIOptions} options
 * @returns {{ update(state?: RaceState): void, dispose(): void }}
 */
export function createRaceUI({
  root,
  onStart,
  onPause,
  onRestart,
  onCamera,
  onInput,
  onSound,
  keyboard = true,
  homeHref = "../",
} = {}) {
  if (!(root instanceof HTMLElement)) {
    throw new TypeError("createRaceUI needs a root element");
  }

  const listeners = new AbortController();
  const { signal } = listeners;
  const on = (target, type, handler, opts) =>
    target.addEventListener(type, handler, { ...opts, signal });

  /** @type {Required<RaceState>} */
  const state = {
    phase: "loading",
    camera: "chase",
    elapsed: 0,
    countdown: 0,
    progress: 0,
    whaleProgress: 0,
    distance: null,
    lead: null,
    winner: null,
    error: null,
    muted: false,
    soundAvailable: true,
    stamina: null,
    boosting: false,
    exhausted: false,
    speed: null,
    loadingLabel: null,
    loadProgress: null,
    aimX: 0,
    aimY: 0,
    aligned: false,
    gate: 0,
    gates: 0,
    gateResult: null,
  };

  /* Last value written per slot. Most frames change the clock and nothing else. */
  const written = new Map();
  const put = (slot, value, apply) => {
    if (written.get(slot) === value) return;
    written.set(slot, value);
    apply(value);
  };

  let disposed = false;
  let phase = null;
  let touch = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  let goTimer = 0;
  let quarter = 0;
  /* Touch only. While true the HUD holds `forward` for the player. */
  let cruise = true;
  let lastGate = 0;
  let gateFlash = 0;

  /* ---------- Top bar ---------- */

  const backLink = h(
    "a",
    {
      class: "race-btn race-back",
      href: homeHref,
      "aria-label": "Back to The Whale",
    },
    icon("arrow-left"),
    h("span", { class: "race-back-label", text: "The Whale" }),
  );

  const timerEl = h("span", {
    class: "race-timer",
    role: "timer",
    "aria-label": "Race time",
    text: "0:00.0",
  });
  const remainingEl = h("span", { class: "race-remaining" });
  const youMarker = h(
    "span",
    { class: "race-marker race-marker--you" },
    h("i", { class: "race-marker-dot" }),
  );
  const whaleMarker = h(
    "span",
    { class: "race-marker race-marker--whale" },
    h("i", { class: "race-marker-dot" }),
  );
  const track = h(
    "div",
    { class: "race-track", "aria-hidden": "true" },
    h("span", { class: "race-track-line" }),
    h("span", { class: "race-track-finish" }),
    whaleMarker,
    youMarker,
  );
  const leadEl = h("span", { class: "race-lead" });
  const aimCue = h(
    "span",
    { class: "race-aim", role: "img", hidden: true },
    icon("chevron-up"),
  );
  const leadGroup = h("span", { class: "race-lead-group" }, leadEl, aimCue);
  const readout = h(
    "div",
    { class: "race-readout", hidden: true },
    h("div", { class: "race-readout-row" }, timerEl, remainingEl),
    track,
    h(
      "div",
      { class: "race-readout-row race-readout-row--foot" },
      leadGroup,
      h(
        "span",
        { class: "race-key", "aria-hidden": "true" },
        h("span", { class: "race-key-item race-key-item--you", text: "You" }),
        h("span", {
          class: "race-key-item race-key-item--whale",
          text: "Rival",
        }),
      ),
    ),
  );

  const soundBtn = h("button", {
    class: "race-btn race-btn--icon",
    type: "button",
    hidden: true,
  });
  /* Touch layouts swap the four camera buttons for this one, which cycles. */
  const cameraCycleLabel = h("span", { class: "race-camera-cycle-label" });
  const cameraCycleBtn = h(
    "button",
    {
      class: "race-btn race-camera-cycle",
      type: "button",
      "aria-keyshortcuts": keyboard ? "C" : null,
      hidden: true,
    },
    icon("video"),
    cameraCycleLabel,
  );
  const pauseBtn = h(
    "button",
    {
      class: "race-btn race-btn--icon",
      type: "button",
      "aria-label": "Pause race",
      "aria-keyshortcuts": keyboard ? "P Escape" : null,
      hidden: true,
    },
    icon("pause"),
  );

  const top = h(
    "div",
    { class: "race-top" },
    backLink,
    readout,
    h("div", { class: "race-top-actions" }, cameraCycleBtn, soundBtn, pauseBtn),
  );

  /* ---------- Countdown ---------- */

  const countEl = h("div", {
    class: "race-countdown",
    "aria-hidden": "true",
    hidden: true,
  });

  /* ---------- Panels ---------- */

  function panel(name, labelId, ...children) {
    return h(
      "section",
      {
        class: `race-panel race-panel--${name}`,
        "aria-labelledby": labelId,
        hidden: true,
      },
      ...children,
    );
  }

  const primary = (label, iconName) =>
    h(
      "button",
      { class: "race-btn race-btn--primary", type: "button" },
      iconName ? icon(iconName) : null,
      h("span", { text: label }),
    );
  const secondary = (label, iconName) =>
    h(
      "button",
      { class: "race-btn", type: "button" },
      iconName ? icon(iconName) : null,
      h("span", { text: label }),
    );
  // Loading
  const loadLabel = h("h1", {
    class: "race-title race-title--small",
    id: "race-loading-title",
    text: "Loading the race",
  });
  const loadBar = h(
    "div",
    { class: "race-load race-load--loop", "aria-hidden": "true" },
    h("span", { class: "race-load-fill" }),
  );
  const gpuReady = "gpu" in navigator;
  const loadingPanel = panel(
    "loading",
    "race-loading-title",
    loadLabel,
    loadBar,
    gpuReady
      ? null
      : h(
          "p",
          { class: "race-capability race-capability--missing" },
          h("span", { class: "race-capability-name", text: "WebGPU" }),
          h("span", { text: "Not found in this browser" }),
        ),
  );

  // Intro
  const startBtn = primary("Start racing", "play");
  const legendRow = (keys, action) =>
    h(
      "div",
      { class: "race-legend-row" },
      h("dt", null, ...keys),
      h("dd", { text: action }),
    );
  const guides = [];
  function controlsGuide() {
    const keys = h(
      "dl",
      { class: "race-legend" },
      legendRow([kbd("W")], "Hold to swim"),
      legendRow([kbd("Shift")], "Hold to boost"),
      legendRow([kbd("A"), kbd("D")], "Turn left / right"),
      legendRow([kbd("↑"), kbd("↓")], "Pitch up / down"),
      legendRow([kbd("C"), kbd("1-4")], "Switch view"),
      legendRow([kbd("P")], "Pause"),
    );
    const boost = h("p", {
      class: "race-controls-boost",
      text: "Boost uses stamina. Release Shift to recharge. If you run out, refill to 30% before boosting again.",
    });
    const phone = h("p", {
      class: "race-controls-touch",
      text: "The pad turns and pitches. Hold Boost to sprint. Tap Swim to coast.",
    });
    const disclosure = h(
      "details",
      { class: "race-controls", open: keyboard && !touch },
      h("summary", { class: "race-controls-summary", text: "Controls" }),
      keyboard ? keys : null,
      keyboard ? boost : null,
      phone,
      h("p", {
        class: "race-controls-rule",
        text: "Rings refill stamina and give a speed surge. Miss one and you slow briefly.",
      }),
    );
    guides.push({ disclosure, keys, boost, phone });
    return disclosure;
  }
  const introPanel = panel(
    "intro",
    "race-intro-title",
    h("h1", {
      class: "race-title",
      id: "race-intro-title",
      text: "Whale race",
    }),
    h("div", { class: "race-panel-actions" }, startBtn),
    controlsGuide(),
    h("a", {
      class: "race-credit",
      href: "https://github.com/Noniv/abyssal-garden",
      target: "_blank",
      rel: "noreferrer",
      text: "World by Noniv · Abyssal Garden",
    }),
  );

  // Paused
  const resumeBtn = primary("Resume", "play");
  const pauseRestartBtn = secondary("Restart", "rotate-ccw");
  const pausedPanel = panel(
    "paused",
    "race-paused-title",
    h("h1", {
      class: "race-title race-title--small",
      id: "race-paused-title",
      text: "Paused",
    }),
    h("div", { class: "race-panel-actions" }, resumeBtn, pauseRestartBtn),
    controlsGuide(),
  );

  // Finished
  const againBtn = primary("Race again", "rotate-ccw");
  const finishTitle = h("h1", {
    class: "race-title",
    id: "race-finished-title",
  });
  const finishTime = h("dd", { class: "race-stat-value" });
  const finishMargin = h("dd", { class: "race-stat-value" });
  const finishMarginLabel = h("dt", { text: "Margin" });
  const finishedPanel = panel(
    "finished",
    "race-finished-title",
    finishTitle,
    h(
      "dl",
      { class: "race-stats" },
      h("div", { class: "race-stat" }, h("dt", { text: "Time" }), finishTime),
      h("div", { class: "race-stat" }, finishMarginLabel, finishMargin),
    ),
    h("div", { class: "race-panel-actions" }, againBtn),
  );

  // Error
  const reloadBtn = secondary("Reload page", "rotate-ccw");
  const errorTitle = h("h1", {
    class: "race-title race-title--small",
    id: "race-error-title",
  });
  const errorBody = h("p", { class: "race-panel-body" });
  const errorDetail = h("p", { class: "race-error-detail" });
  const errorPanel = panel(
    "error",
    "race-error-title",
    errorTitle,
    errorBody,
    errorDetail,
    h("div", { class: "race-panel-actions" }, reloadBtn),
  );
  errorPanel.setAttribute("role", "alert");

  const stage = h(
    "div",
    { class: "race-stage" },
    loadingPanel,
    introPanel,
    pausedPanel,
    finishedPanel,
    errorPanel,
  );

  /* ---------- Bottom: camera, vitals, touch controls ---------- */

  const cameraButtons = CAMERAS.map(({ id, label }, index) => {
    const button = h(
      "button",
      {
        class: "race-camera-btn",
        type: "button",
        "aria-pressed": "false",
        "aria-keyshortcuts": keyboard ? String(index + 1) : null,
        "data-camera": id,
      },
      h("span", { text: label }),
      keyboard
        ? h("span", {
            class: "race-camera-key",
            "aria-hidden": "true",
            text: String(index + 1),
          })
        : null,
    );
    on(button, "click", () => call(onCamera, id));
    return button;
  });
  const camera = h(
    "div",
    { class: "race-camera-group", role: "group", "aria-label": "Camera" },
    ...cameraButtons,
  );

  const staminaFill = h("span", { class: "race-meter-fill" });
  const staminaMeter = h(
    "div",
    {
      class: "race-meter",
      role: "meter",
      "aria-label": "Stamina",
      "aria-valuemin": "0",
      "aria-valuemax": "100",
      "aria-valuenow": "100",
    },
    staminaFill,
  );
  const staminaWrap = h(
    "div",
    { class: "race-vital race-vital--stamina", hidden: true },
    h("span", {
      class: "race-vital-label",
      "aria-hidden": "true",
      text: "Stamina",
    }),
    staminaMeter,
  );
  const speedEl = h("span", {
    class: "race-vital race-vital--speed",
    hidden: true,
  });
  const boostLabel = h("span", { text: "Hold to boost" });
  const boostHint = h(
    "span",
    {
      class: "race-vital race-vital--boost",
      hidden: true,
      title: "Hold Shift for extra speed. Release it to recharge stamina.",
    },
    kbd("Shift"),
    boostLabel,
  );
  const vitals = h("div", { class: "race-vitals" }, boostHint, staminaWrap, speedEl);

  const dock = h("div", { class: "race-dock", hidden: true }, camera, vitals);

  const padButton = (axis, label, iconName) =>
    h(
      "button",
      {
        class: `race-pad-btn race-pad-btn--${axis}`,
        type: "button",
        "aria-label": label,
        "data-axes": axis,
      },
      icon(iconName),
    );
  /* The visible ring. The pad itself is the larger, invisible touch area. */
  const padRing = h("span", { class: "race-pad-ring", "aria-hidden": "true" });
  const pad = h(
    "div",
    {
      class: "race-pad",
      role: "group",
      "aria-label": "Steering",
      hidden: true,
    },
    padRing,
    padButton("up", "Rise", "chevron-up"),
    padButton("left", "Steer left", "chevron-left"),
    padButton("right", "Steer right", "chevron-right"),
    padButton("down", "Dive", "chevron-down"),
  );

  const boostBtn = h(
    "button",
    {
      class: "race-hold race-hold--boost",
      type: "button",
      "aria-label": "Hold to boost",
      "data-axes": "boost",
    },
    icon("chevrons-up"),
    h("span", { text: "Boost" }),
  );
  const swimBtn = h(
    "button",
    {
      class: "race-swim",
      type: "button",
      "aria-pressed": "true",
    },
    h("span", { text: "Swim" }),
  );
  const actions = h(
    "div",
    { class: "race-actions", hidden: true },
    swimBtn,
    boostBtn,
  );

  const bottom = h("div", { class: "race-bottom" }, pad, dock, actions);

  /* ---------- Status line for screen readers ---------- */

  const status = h("p", {
    class: "race-sr",
    role: "status",
    "aria-live": "polite",
  });

  const scrim = h("div", { class: "race-scrim" });

  const nodes = [scrim, top, stage, bottom, countEl, status];
  root.classList.add("race-ui");
  root.append(...nodes);

  /* ---------- Helpers ---------- */

  function call(callback, ...args) {
    if (!disposed && typeof callback === "function") callback(...args);
  }

  function announce(text) {
    if (!text) return;
    // An unchanged string is not re-read, so clear first when it repeats.
    if (status.textContent === text) status.textContent = "";
    status.textContent = text;
  }

  function focusIfFree(el) {
    const active = document.activeElement;
    if (!active || active === document.body || root.contains(active)) {
      el.focus({ preventScroll: true });
    }
  }

  const inPlay = () => phase === "racing" || phase === "countdown";

  function nextCamera() {
    const current = CAMERAS.findIndex(({ id }) => id === state.camera);
    return CAMERAS[(current + 1) % CAMERAS.length];
  }

  /* ---------- Held input ---------- */

  /** axis -> set of sources holding it. A source is one key, pointer or button. */
  const holders = Object.fromEntries(AXES.map((axis) => [axis, new Set()]));
  const sent = Object.fromEntries(AXES.map((axis) => [axis, false]));
  const lit = [...pad.querySelectorAll("[data-axes]"), boostBtn];

  function flushInput() {
    const patch = {};
    let changed = false;
    for (const axis of AXES) {
      const held = holders[axis].size > 0;
      if (held !== sent[axis]) {
        sent[axis] = held;
        patch[axis] = held;
        changed = true;
      }
    }
    if (!changed) return;
    for (const el of lit) {
      el.classList.toggle("race-is-held", sent[el.dataset.axes]);
    }
    call(onInput, patch);
  }

  function hold(source, axes) {
    if (!inPlay()) return;
    for (const axis of AXES) {
      if (axes.includes(axis)) holders[axis].add(source);
      else holders[axis].delete(source);
    }
    flushInput();
  }

  function release(source) {
    for (const axis of AXES) holders[axis].delete(source);
    flushInput();
  }

  function releaseAll() {
    for (const axis of AXES) holders[axis].clear();
    flushInput();
  }

  /*
   * Touch players cruise without holding anything. The Swim toggle drops them
   * to a coast and back. Keyboard players hold W, so this stays out of it.
   */
  function syncCruise() {
    swimBtn.setAttribute("aria-pressed", String(cruise));
    if (touch && cruise && inPlay()) holders.forward.add("cruise");
    else holders.forward.delete("cruise");
    flushInput();
  }

  function setTouch(next) {
    if (touch === next) return;
    touch = next;
    for (const { disclosure } of guides) disclosure.open = keyboard && !touch;
    syncVisibility();
    syncCruise();
  }

  /* Press-and-hold button. Boost also holds forward so one thumb can sprint. */
  function bindHold(button, name, axes) {
    const pointers = new Set();
    const end = (event) => {
      if (!pointers.delete(event.pointerId)) return;
      release(`${name}:${event.pointerId}`);
    };
    on(button, "pointerdown", (event) => {
      if (event.button > 0) return;
      event.preventDefault();
      button.setPointerCapture?.(event.pointerId);
      pointers.add(event.pointerId);
      hold(`${name}:${event.pointerId}`, axes);
    });
    on(button, "pointerup", end);
    on(button, "pointercancel", end);
    on(button, "lostpointercapture", end);
    on(button, "contextmenu", (event) => event.preventDefault());
    on(button, "keydown", (event) => {
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) hold(`${name}:key`, axes);
    });
    on(button, "keyup", (event) => {
      if (event.key !== " " && event.key !== "Enter") return;
      event.stopPropagation();
      release(`${name}:key`);
    });
    on(button, "blur", () => release(`${name}:key`));
  }

  bindHold(boostBtn, "boost", ["forward", "boost"]);
  on(swimBtn, "click", () => {
    if (!inPlay()) return;
    cruise = !cruise;
    syncCruise();
    announce(cruise ? "Swimming." : "Coasting.");
  });
  for (const button of pad.querySelectorAll("button")) {
    const axis = button.dataset.axes;
    // Pointers are handled by the pad as a whole. These cover the keyboard.
    on(button, "keydown", (event) => {
      if (event.key !== " " && event.key !== "Enter") return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) hold(`pad-key:${axis}`, [axis]);
    });
    on(button, "keyup", (event) => {
      if (event.key !== " " && event.key !== "Enter") return;
      event.stopPropagation();
      release(`pad-key:${axis}`);
    });
    on(button, "blur", () => release(`pad-key:${axis}`));
  }

  /* The pad tracks one thumb. Sliding between directions needs no lift. */
  let padPointer = null;
  let padRect = null;
  function steer(event) {
    // Measured against the ring. A thumb outside it still steers that way.
    const x = ((event.clientX - padRect.left) / padRect.width) * 2 - 1;
    const y = ((event.clientY - padRect.top) / padRect.height) * 2 - 1;
    const axes = [];
    if (Math.hypot(x, y) >= PAD_DEAD_ZONE) {
      const ax = Math.abs(x);
      const ay = Math.abs(y);
      if (ax > ay * PAD_DIAGONAL) axes.push(x < 0 ? "left" : "right");
      if (ay > ax * PAD_DIAGONAL) axes.push(y < 0 ? "up" : "down");
    }
    hold("pad", axes);
  }
  function endSteer(event) {
    if (event.pointerId !== padPointer) return;
    padPointer = null;
    release("pad");
  }
  on(pad, "pointerdown", (event) => {
    if (event.button > 0 || padPointer !== null) return;
    event.preventDefault();
    pad.setPointerCapture?.(event.pointerId);
    padPointer = event.pointerId;
    padRect = padRing.getBoundingClientRect();
    steer(event);
  });
  on(pad, "pointermove", (event) => {
    if (event.pointerId === padPointer) steer(event);
  });
  on(pad, "pointerup", endSteer);
  on(pad, "pointercancel", endSteer);
  on(pad, "lostpointercapture", endSteer);
  on(pad, "contextmenu", (event) => event.preventDefault());

  /* ---------- Buttons ---------- */

  on(startBtn, "click", () => call(onStart));
  on(resumeBtn, "click", () => call(onPause, false));
  on(pauseBtn, "click", () => call(onPause, true));
  on(pauseRestartBtn, "click", () => call(onRestart));
  on(againBtn, "click", () => call(onRestart));
  on(soundBtn, "click", () => call(onSound, !state.muted));
  on(cameraCycleBtn, "click", () => call(onCamera, nextCamera().id));
  on(reloadBtn, "click", () => window.location.reload());

  /* ---------- Window-level events ---------- */

  on(
    window,
    "pointerdown",
    (event) => {
      if (event.pointerType === "touch") setTouch(true);
    },
    { capture: true, passive: true },
  );
  on(window, "blur", releaseAll);
  on(window, "focus", syncCruise);
  on(document, "visibilitychange", () => {
    if (!document.hidden) return;
    releaseAll();
    if (phase === "racing") call(onPause, true);
  });

  if (keyboard) {
    on(window, "keydown", (event) => {
      if (
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      ) {
        return;
      }
      if (isTyping(event.target)) return;

      const axis = MOVE_KEYS[event.code];
      if (axis) {
        if (!inPlay()) return;
        event.preventDefault();
        if (event.repeat) return;
        setTouch(false);
        hold(`key:${event.code}`, [axis]);
        return;
      }
      if (event.repeat) return;

      if (event.code === "KeyC" || event.code in CAMERA_KEYS) {
        if (phase === "loading" || phase === "error") return;
        const next =
          event.code === "KeyC"
            ? nextCamera()
            : CAMERAS[CAMERA_KEYS[event.code]];
        call(onCamera, next.id);
      } else if (event.code === "KeyP" || event.code === "Escape") {
        if (phase === "racing") call(onPause, true);
        else if (phase === "paused") call(onPause, false);
      } else if (event.code === "KeyM") {
        if (state.soundAvailable && phase !== "loading" && phase !== "error")
          call(onSound, !state.muted);
      }
    });
    on(window, "keyup", (event) => {
      if (MOVE_KEYS[event.code]) release(`key:${event.code}`);
    });
  }

  /* ---------- Rendering ---------- */

  function syncVisibility() {
    const live =
      phase === "countdown" ||
      phase === "racing" ||
      phase === "paused" ||
      phase === "finished";
    const playing = inPlay();
    root.classList.toggle("race-ui--touch", touch);
    scrim.hidden = playing;
    readout.hidden = !live;
    pauseBtn.hidden = phase !== "racing";
    dock.hidden = !playing;
    camera.hidden = touch;
    cameraCycleBtn.hidden = !(playing && touch);
    pad.hidden = !(playing && touch);
    actions.hidden = !(playing && touch);
    for (const { keys, boost, phone } of guides) {
      keys.hidden = touch;
      boost.hidden = touch;
      phone.hidden = keyboard && !touch;
    }
    boostHint.hidden = !keyboard || touch || !Number.isFinite(state.stamina);
    loadingPanel.hidden = phase !== "loading";
    introPanel.hidden = phase !== "ready";
    pausedPanel.hidden = phase !== "paused";
    finishedPanel.hidden = phase !== "finished";
    errorPanel.hidden = phase !== "error";
    countEl.hidden = !(phase === "countdown" || goTimer);
  }

  function showGo() {
    countEl.replaceChildren(
      h("span", {
        class: "race-countdown-num race-countdown-num--go",
        text: "Go",
      }),
    );
    window.clearTimeout(goTimer);
    goTimer = window.setTimeout(() => {
      goTimer = 0;
      countEl.hidden = phase !== "countdown";
    }, 900);
  }

  function winnerOf() {
    if (
      state.winner === "player" ||
      state.winner === "whale" ||
      state.winner === "tie"
    ) {
      return state.winner;
    }
    const side = leadSide(state.lead);
    if (side === "ahead") return "player";
    if (side === "behind") return "whale";
    return "tie";
  }

  function enterPhase(next) {
    const previous = phase;
    phase = next;
    root.dataset.phase = next;

    if (next !== "racing" && next !== "countdown") releaseAll();
    if (next !== "countdown") written.delete("count");
    if (next !== "finished") written.delete("finish");
    if (next !== "error") written.delete("error");
    if (next === "ready" || next === "countdown") {
      quarter = 0;
      cruise = true;
      lastGate = 0;
      window.clearTimeout(gateFlash);
      delete aimCue.dataset.result;
    }
    if (previous === "countdown" && next === "racing") showGo();
    else if (next !== "racing") {
      window.clearTimeout(goTimer);
      goTimer = 0;
    }

    syncVisibility();
    syncCruise();

    switch (next) {
      case "loading":
        announce("Loading the race.");
        break;
      case "ready":
        announce("Race ready. Press Start racing.");
        focusIfFree(startBtn);
        break;
      case "racing":
        announce(previous === "paused" ? "Race resumed." : "Go.");
        break;
      case "paused":
        announce(`Paused at ${formatTime(state.elapsed)}.`);
        focusIfFree(resumeBtn);
        break;
      case "finished":
        focusIfFree(againBtn);
        break;
      case "error":
        // The error panel is an alert and announces itself.
        focusIfFree(reloadBtn);
        break;
      default:
        break;
    }
  }

  function renderRace() {
    put("timer", formatTime(state.elapsed), (text) => {
      timerEl.textContent = text;
    });
    put("you", Math.round(clamp01(state.progress) * 2000) / 2000, (p) => {
      youMarker.style.setProperty("--race-p", String(p));
    });
    put(
      "whale",
      Math.round(clamp01(state.whaleProgress) * 2000) / 2000,
      (p) => {
        whaleMarker.style.setProperty("--race-p", String(p));
      },
    );
    put(
      "remaining",
      Number.isFinite(state.distance)
        ? `${Math.max(0, Math.round(state.distance))} m to go`
        : "",
      (text) => {
        remainingEl.textContent = text;
      },
    );
    put("lead", leadText(state.lead), (text) => {
      leadEl.textContent = text;
    });
    put("lead-side", leadSide(state.lead) ?? "", (side) => {
      leadEl.dataset.side = side;
    });

    const hasStamina = Number.isFinite(state.stamina);
    boostHint.hidden = !keyboard || touch || !hasStamina;
    put("stamina-on", hasStamina, (shown) => {
      staminaWrap.hidden = !shown;
      root.classList.toggle("race-ui--stamina", shown);
    });
    if (hasStamina) {
      const stamina = clamp01(state.stamina);
      const boostState = state.exhausted
        ? "exhausted"
        : state.boosting
          ? "boosting"
          : "ready";
      put("boost-state", boostState, (value) => {
        boostHint.dataset.state = value;
        boostLabel.textContent =
          value === "exhausted"
            ? "Refill to 30%"
            : value === "boosting"
              ? "Boosting"
              : "Hold to boost";
      });
      put("stamina", Math.round(stamina * 200) / 200, (value) => {
        // On the root, so the bar and the ring round Boost read one value.
        root.style.setProperty("--race-stamina", String(value));
      });
      put("stamina-low", stamina < 0.2, (low) => {
        root.classList.toggle("race-ui--low", low);
      });
      // Assistive tech hears tenths, never every frame.
      put("stamina-aria", Math.round(stamina * 10) * 10, (value) => {
        staminaMeter.setAttribute("aria-valuenow", String(value));
      });
      const staminaStatus = state.exhausted
        ? "Refill stamina to 30% to boost again."
        : state.boosting
          ? "Boosting. Release to recharge."
          : touch || !keyboard
            ? "Hold Boost to sprint."
            : "Hold Shift to boost.";
      const staminaText = `${Math.round(stamina * 10) * 10}% stamina. ${staminaStatus}`;
      put("stamina-description", staminaText, (text) => {
        staminaMeter.setAttribute("aria-valuetext", text);
      });
    }
    put(
      "speed",
      Number.isFinite(state.speed) ? `${state.speed.toFixed(1)} m/s` : "",
      (text) => {
        speedEl.textContent = text;
        speedEl.hidden = !text;
      },
    );
  }

  function renderGate() {
    const active =
      inPlay() &&
      (state.hasAim ??
        (Number.isFinite(state.gates) && state.gate < state.gates));
    aimCue.hidden = !active;
    if (active) {
      let x = Number.isFinite(state.aimX) ? state.aimX : 0;
      const y = Number.isFinite(state.aimY) ? state.aimY : 0;
      // A target directly behind has no sideways offset. Keep a turn cue until it is in front of the nose.
      if (Math.abs(state.aimYaw) > Math.PI / 2) {
        x = Math.sign(state.aimYaw) * Math.max(Math.abs(x), 1);
      }
      put(
        "aim-angle",
        Math.round((Math.atan2(x, y) * 180) / Math.PI / 5) * 5,
        (angle) => {
          aimCue.style.setProperty("--race-aim-angle", angle + "deg");
        },
      );
      put("aim-aligned", Boolean(state.aligned), (aligned) => {
        aimCue.dataset.aligned = String(aligned);
      });
      const directions = [];
      if (Math.abs(x) > 0.2) directions.push(x > 0 ? "right" : "left");
      if (Math.abs(y) > 0.2) directions.push(y > 0 ? "rise" : "dive");
      const target =
        state.aimTarget === "checkpoint"
          ? "Return to checkpoint"
          : state.aimTarget === "finish"
            ? "Finish"
            : "Next ring";
      const label = state.aligned
        ? target + " aligned"
        : target + ": " + (directions.join(" and ") || "hold direction");
      put("aim-label", label, (text) =>
        aimCue.setAttribute("aria-label", text),
      );
    }
    if (state.gate > lastGate) {
      lastGate = state.gate;
      if (state.gateResult === "hit" || state.gateResult === "miss") {
        aimCue.dataset.result = state.gateResult;
        window.clearTimeout(gateFlash);
        gateFlash = window.setTimeout(() => {
          delete aimCue.dataset.result;
        }, 550);
        announce(
          state.gateResult === "hit"
            ? "Ring cleared. Surge."
            : "Ring missed. Recover for the next one.",
        );
      }
    }
  }

  function renderFinish() {
    const winner = winnerOf();
    const time = formatTime(state.elapsed, 2);
    const margin = Number.isFinite(state.lead)
      ? `${Math.abs(state.lead).toFixed(1)} m`
      : "";
    put("finish", `${winner}|${time}|${margin}`, () => {
      finishTitle.textContent =
        winner === "player"
          ? "You won"
          : winner === "whale"
            ? "Rival won"
            : "Dead heat";
      finishTime.textContent = time;
      finishMargin.textContent = margin || "None";
      finishMarginLabel.textContent =
        winner === "player"
          ? "Won by"
          : winner === "whale"
            ? "Lost by"
            : "Margin";
      const gap = margin && winner !== "tie" ? ` by ${margin}` : "";
      announce(
        winner === "player"
          ? `You won${gap}. Time ${time}.`
          : winner === "whale"
            ? `Rival won${gap}. Time ${time}.`
            : `Dead heat. Time ${time}.`,
      );
    });
  }

  function renderError() {
    const error = state.error;
    const info = error && typeof error === "object" ? error : {};
    const message = typeof error === "string" ? error : (info.message ?? "");
    const noGpu = !("gpu" in navigator) || /webgpu/i.test(info.code ?? "");
    put("error", `${noGpu}|${info.title ?? ""}|${message}`, () => {
      if (noGpu) {
        errorTitle.textContent = info.title ?? "This race needs WebGPU";
        errorBody.textContent = window.isSecureContext
          ? "This browser or graphics driver doesn't offer the WebGPU renderer. Try an updated WebGPU-capable browser with graphics acceleration enabled, then reload."
          : "The scene renders with WebGPU, and browsers only offer it over HTTPS or on localhost. This page came over plain HTTP. Open the HTTPS address, then reload.";
      } else {
        errorTitle.textContent = info.title ?? "The race couldn't load";
        errorBody.textContent =
          "Something failed while the scene was being set up. Reloading usually clears it.";
      }
      errorDetail.textContent = message;
      errorDetail.hidden = !message;
    });
  }

  function render() {
    const next = PHASES.has(state.phase) ? state.phase : "loading";
    if (next !== phase) enterPhase(next);

    put(
      "sound-visible",
      state.soundAvailable && phase !== "loading" && phase !== "error",
      (visible) => {
        soundBtn.hidden = !visible;
      },
    );
    put("muted", Boolean(state.muted), (muted) => {
      soundBtn.replaceChildren(icon(muted ? "volume-x" : "volume-2"));
      soundBtn.setAttribute(
        "aria-label",
        muted ? "Turn sound on" : "Turn sound off",
      );
      if (keyboard) soundBtn.setAttribute("aria-keyshortcuts", "M");
    });

    put("camera", state.camera, (id) => {
      const first = !written.has("camera-seen");
      written.set("camera-seen", true);
      root.dataset.camera = id;
      for (const button of cameraButtons) {
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.camera === id),
        );
      }
      const found = CAMERAS.find((entry) => entry.id === id);
      if (found) {
        cameraCycleLabel.textContent = found.label;
        cameraCycleBtn.setAttribute(
          "aria-label",
          `Camera: ${found.label}. Switch to ${nextCamera().label}`,
        );
      }
      if (!first && found) announce(`${found.label} camera.`);
    });

    if (phase === "loading") {
      put("load-label", state.loadingLabel || "Loading the race", (text) => {
        loadLabel.textContent = text;
      });
      const known = Number.isFinite(state.loadProgress);
      put("load-loop", !known, (loop) => {
        loadBar.classList.toggle("race-load--loop", loop);
      });
      if (known) {
        put(
          "load",
          Math.round(clamp01(state.loadProgress) * 100) / 100,
          (p) => {
            loadBar.style.setProperty("--race-load", String(p));
          },
        );
      }
      return;
    }

    if (phase === "error") {
      renderError();
      return;
    }

    if (phase === "ready") return;

    renderRace();

    if (phase === "countdown") {
      put("count", Math.max(1, Math.ceil(state.countdown || 0)), (count) => {
        countEl.replaceChildren(
          h("span", { class: "race-countdown-num", text: String(count) }),
        );
        announce(String(count));
      });
    } else if (phase === "racing") {
      const reached = Math.min(3, Math.floor(clamp01(state.progress) * 4));
      if (reached > quarter) {
        quarter = reached;
        announce(`${MILESTONES[reached - 1]}. ${leadText(state.lead)}.`);
      }
    } else if (phase === "finished") {
      renderFinish();
    }
    renderGate();
  }

  function update(patch) {
    if (disposed) return;
    if (patch && typeof patch === "object") Object.assign(state, patch);
    render();
  }

  function dispose() {
    if (disposed) return;
    releaseAll();
    disposed = true;
    listeners.abort();
    window.clearTimeout(goTimer);
    window.clearTimeout(gateFlash);
    for (const node of nodes) node.remove();
    root.classList.remove(
      "race-ui",
      "race-ui--touch",
      "race-ui--stamina",
      "race-ui--low",
    );
    root.style.removeProperty("--race-stamina");
    delete root.dataset.phase;
    delete root.dataset.camera;
  }

  render();

  return { update, dispose };
}
