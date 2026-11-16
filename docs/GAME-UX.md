# Race HUD

The HUD for `/game` lives in `src/game/race-ui.js` and `src/game/race-ui.css`. It is plain DOM with native buttons, and it draws over the WebGPU canvas. The engine owns the race. The HUD shows whatever state the engine last sent and reports what the player asked for.

## Wiring

```js
import "@fontsource-variable/dm-sans/wght.css";
import "@fontsource/dm-mono/latin-400.css";
import "@fontsource/dm-mono/latin-500.css";
import "./race-ui.css";
import { createRaceUI } from "./race-ui.js";

const raceUI = createRaceUI({
  root: document.getElementById("game-ui"),
  onStart: () => callbacks.start?.(),
  onPause: (paused) => callbacks.pause?.(paused),
  onRestart: () => callbacks.restart?.(),
  onCamera: (camera) => callbacks.camera?.(camera),
  onInput: (input) => callbacks.input?.(input),
  onSound: (muted) => callbacks.sound?.(muted),
});

raceUI.update({ phase: "ready" });
```

`createRaceUI` adds the class `race-ui` to the root and fills it. `dispose()` removes every node and listener and takes the class off again. The root should be empty and should be a sibling of the canvas. The stylesheet makes it `position: fixed` over the whole viewport with `pointer-events: none`, so drags on open water still reach the canvas.

## Callbacks

| Callback | Argument | When |
| --- | --- | --- |
| `onStart()` | none | "Start racing" on the intro panel |
| `onPause(paused)` | `true` to pause, `false` to resume | Pause button, Resume button, `P`, `Escape`, or the tab being hidden mid-race |
| `onRestart()` | none | "Race again" after the finish, "Restart" on the pause panel |
| `onCamera(camera)` | `'chase'`, `'first-person'`, `'side'` or `'overhead'` | Camera buttons, the camera button in the top bar on touch, `C` to cycle, `1` to `4` to pick |
| `onInput(input)` | the controls that changed | Keys and touch controls, see below |
| `onSound(muted)` | the wanted mute state | Sound button, `M` |

Every callback states what the player wants. None of them change what the HUD shows. The Pause button keeps showing "pause" until the engine calls `update({ phase: 'paused' })`. An engine that only toggles can ignore the argument.

## State

`update(state)` merges its argument into the previous state, so sending the full object every frame and sending only the changed fields both work. The HUD compares each value with what it last wrote and skips the DOM when nothing changed. A normal frame rewrites the clock text and two transforms.

| Field | Type | Notes |
| --- | --- | --- |
| `phase` | `'loading'`, `'ready'`, `'countdown'`, `'racing'`, `'paused'`, `'finished'`, `'error'` | Decides which parts of the HUD exist. Anything else is treated as `'loading'`. |
| `camera` | `'chase'`, `'first-person'`, `'side'`, `'overhead'` | Marks the pressed camera button and names the camera on the touch button. |
| `elapsed` | seconds | Race clock. Shown to tenths while racing and to hundredths on the results panel. |
| `countdown` | seconds | Rounded up for display, so 2.4 shows as 3. |
| `progress` | 0 to 1 | Player position on the course strip. |
| `whaleProgress` | 0 to 1 | Rival position on the course strip. |
| `distance` | metres | What the player has left. Shown in the readout during the race. |
| `lead` | metres | Positive when the player is ahead. Under 5 cm reads as level. |
| `winner` | `'player'`, `'whale'`, `'tie'` | Read during `finished`. `'whale'` is the rival. Without it, the sign of `lead` decides. |
| `error` | string, or `{ code, title, message }` | Read during `error`. |
| `muted` | boolean | Picks the sound icon and its label. |
| `stamina` | 0 to 1 | Boost reserve. A bar on desktop, a ring round Boost on touch. Both turn coral under 20% and hide when the field is missing. |
| `boosting` | boolean | Desktop Boost hint reads "Boosting" while extra speed is active. |
| `exhausted` | boolean | Desktop Boost hint reads "Refill to 30%" until stamina recovers enough to boost again. |
| `speed` | metres per second | Hidden when missing, and on touch. |
| `loadingLabel` | string | What the engine is doing during `loading`, for example "Compiling shaders". |
| `loadProgress` | 0 to 1 | Fills the loading bar. Without it the bar loops. |

### What each phase shows

- `loading` shows a panel with the loading label and a bar. A WebGPU warning appears only when the browser has no `navigator.gpu`. The backdrop is opaque because the canvas may still be blank.
- `ready` shows the intro panel: the title, "Start racing", Controls and the world credit. Controls starts open on desktop and closed on touch. It explains held keys, Boost's stamina cost and recovery, and the ring bonus and miss penalty.
- `countdown` shows large numerals, the course readout, the camera switch and the touch controls. On touch the HUD starts holding `forward` here.
- `racing` adds the Pause button. "Go" flashes for 0.9 s when the phase arrives from `countdown`.
- `paused` shows Resume, Restart and the same Controls guide. The readout stays, dimmed, and carries the stopped clock.
- `finished` shows the result, the time, the margin and "Race again".
- `error` shows a panel with "Reload page".

The back link in the top bar is present in every phase, so no panel repeats it.

### Copy

Both racers are whales, so the HUD calls them "You" and "Rival". Each panel has one heading and no eyebrow or subtitle. Controls is expanded by default on desktop, where players need to learn the keyboard, and can be reviewed when paused. The camera buttons carry their own number keys. The live desktop bar pairs a Shift keycap with "Hold to boost", "Boosting" or "Refill to 30%" beside the stamina meter. Touch keeps the compact Boost ring and its label.

### WebGPU and errors

The error panel explains WebGPU when `error.code` contains "webgpu", or when the browser has no `navigator.gpu` at all. If the page is not a secure context it says so, because browsers hide WebGPU on plain HTTP. That is the usual cause when a dev server is opened through a LAN or Tailscale IP. Any other error gets a generic panel. `error.message` is printed in a mono block on both.

The only recovery button reloads the page. A lost device or a failed shader compile rarely survives an in-place retry, so the HUD does not call `onRestart` here.

## Input

`onInput` receives a partial object with any of `forward`, `boost`, `left`, `right`, `up` and `down`. It holds only the keys whose value changed. Merge it:

```js
const input = { forward: false, boost: false, left: false, right: false, up: false, down: false };
const onInput = (patch) => Object.assign(input, patch);
```

Input is accepted during `countdown` and `racing` only. The engine decides whether countdown input does anything. Every held control is released, and reported as `false`, when the phase leaves those two, when the window loses focus, when the tab is hidden, and on `dispose()`. A `pointercancel` or lost pointer capture releases that pointer's control the same way, so a notification or a system gesture cannot leave the player stuck boosting.

`forward` supplies thrust along the player's world heading. Left/right turn that heading; up/down pitch it. Releasing a direction holds the new heading. The player receives no automatic course following, lane clamp or correction toward a ring. Terrain blocks movement without changing the heading. The rival follows the marked route.

### Keyboard

| Key | Control |
| --- | --- |
| `W` | `forward` |
| `A`, `D`, left and right arrows | `left`, `right` |
| Up and down arrows, `E`, `Q` | `up`, `down` |
| `Shift` | `boost` |
| `C` | next camera |
| `1` to `4` | Chase, First person, Side, Overhead |
| `P`, `Escape` | pause or resume |
| `M` | sound |

The HUD ignores any key event that already has `defaultPrevented` set, and anything typed with Ctrl, Alt or Meta. If the engine binds the same keys, pass `keyboard: false`. The HUD then adds no key listeners and leaves the key list out of the Controls disclosure. Running both is harmless for movement, since the merges are idempotent, but two handlers for `C` can skip a camera.

### Touch

The touch controls appear when the primary pointer is coarse, or after the first touch on a hybrid device. Pressing a movement key hides them again and brings back the desktop dock.

Touch controls sit in the bottom corners to leave the water visible. The camera switch sits in the top bar, and stamina wraps around Boost. No control row spans the width of the screen.

- **Steering pad**, bottom left, `.race-pad`. It draws a 128px outlined ring (`.race-pad-ring`, 116px on a sideways phone) but takes touches in a square 20px larger on every side, out to the screen edge. It tracks one thumb. Position relative to the ring centre picks from eight directions, with a dead zone in the middle fifth, so sliding from "left" to "up" needs no lift. A thumb that drifts outside the ring keeps steering.
- **Boost**, bottom right, `.race-hold--boost`. Hold it to send `forward` and `boost` together. It draws 76px and takes touches 16px beyond that. The ring round it is the stamina reserve, so the eye stays on the one control that spends it.
- **Swim**, left of Boost, `.race-swim`. This is a toggle with `aria-pressed`, and it starts on. See below.
- **Camera**, top bar, `.race-camera-cycle`. One 44px button showing the current camera's name. Each tap asks for the next of the four. Its accessible name reads "Camera: Chase. Switch to First person". The four-button group is hidden on touch.

The readout on phones is one line with no card: clock, course strip, distance left, and the lead beneath. The You and Rival key is dropped there. The lead line already says "You lead" in the player's colour.

#### Auto cruise

On touch the HUD holds `forward` itself from the countdown until the race stops. This supplies thrust only; the player must turn and pitch with the pad to follow the route. Tapping Swim turns thrust off and the whale drifts to a stop. Tapping again swims. Holding Boost sprints whichever way Swim is set.

The engine receives `forward: true` and `forward: false` through `onInput`. The hold is released on pause, finish, window blur and tab hide, and returns on resume or when focus returns. Swim resets to on at every `ready` and `countdown`. Keyboard players hold `W`; pressing a movement key hides the touch controls and drops the cruise hold.

Pad directions and Boost are native buttons. With a keyboard or switch, holding Space or Enter on a focused one holds it. Swim and Camera answer an ordinary click.

## Accessibility

- One polite status region reports phase changes, each countdown number, camera changes, the quarter marks of the course with the current lead, and the result. Nothing is announced per frame. The clock uses `role="timer"`, which is silent unless the reader is moved to it.
- The stamina meter is a `role="meter"` whose value changes in steps of ten. On touch it is visually hidden and the Boost ring shows the same value, so screen readers still find the meter.
- Every discrete touch control is at least 44px. The four pad directions are 44px buttons inside the ring.
- Focus moves to the main button when a panel opens, unless focus sits somewhere outside the HUD.
- The player and the rival differ by shape on the course strip as well as by colour. The player is a filled dot and the rival is a ring.
- `prefers-reduced-motion` removes every transition and animation. `prefers-reduced-transparency` swaps the glass for solid fills. Forced-colours mode keeps the pressed and held states visible.
- Padding follows `env(safe-area-inset-*)`. The page needs `viewport-fit=cover` in its viewport meta tag for the insets to be non-zero.

## Styling

Every selector starts with `.race-ui`, and the custom properties are named `--race-*` and declared on that element. Nothing is set on `html`, `body`, the canvas or bare elements. The HUD stays dark in both site themes because it sits on an underwater scene. Colours follow the gallery's dark palette: ice text, cyan for the rival, and the acid yellow for the player, the stamina fill and the one primary button.

Icons are Lucide outlines copied into `race-ui.js` as path data, so the page needs neither React nor `lucide-react`.

## Steering rings

The aim cue sits beside the lead. It points in control coordinates using `aimX` and `aimY`, turns lime on `aligned`, and briefly flashes on `gateResult` when `gate` advances. It points to the finish after the last ring, or back to a required checkpoint the player missed. `aimTarget` names that target for assistive technology and `hasAim` keeps the cue active. Gate outcomes are announced once. The Controls disclosure explains that steering through rings restores stamina and gives a surge; the intro stays unchanged.

## Design exploration

Three Fable 5.2 investigations examined racing decisions, game feel, and learning and replay. The proposals below are follow-up experiments, not implemented behavior.

The intended loop is to read the canyon, thread a ring, enter the rival's wake and choose when to boost past it. Free heading and immediate release of turning input remain essential.

| Priority | Proposed experiment | What a playtest should establish |
| --- | --- | --- |
| 1 | Match ring scoring to a visibly clean hull pass, with a neutral outcome for rim clips. | Players can explain a miss and trust a clean pass. |
| 2 | Put a small heading marker in the water, and preserve the current turn radius during a ring surge. | Players aim earlier, and earning a surge does not cause the next miss. |
| 3 | Demonstrate two easy but deliberate opening turns with the rival, then introduce Boost on a clear straight. | New players discover steering, rings and Boost through play. |
| 4 | Make rival pace readable by course section, with a visible wake measured from the rival's body. | Players choose when to follow, recover stamina and overtake. |
| 5 | Show a local personal best and the cleared-ring sequence at the finish. | Players can choose a specific improvement for their next attempt. |

Collision response and checkpoint recovery also need a playtest. A scrape currently stops movement much like a head-on collision; a missed required checkpoint is indicated by the small aim cue. Any sliding response must preserve the chosen heading and make wall-riding slower than a clean line.

Pure simulations on the extracted 481.93 m course showed a large gap between precise ring-taking pilots and pilots following the course line. These simulations omit terrain collision and the renderer's fitted gate offsets, and their pilots know exact target positions. They establish rule interactions, not human difficulty or fun. Raising rival speed should follow the aiming and learning experiments.

Start with ring fairness, the heading marker and surge control. Compare the first three attempts on desktop and touch: ring hit rate, course completion, recovery after contact, deliberate Boost use and voluntary retries. The proposed scoring tolerances and rival tuning need real players before adoption.

The design approach draws on [MDA](https://www.cs.northwestern.edu/~hunicke/pubs/MDA.pdf), which connects desired player experience to rules and iteration, and [Celeste & Forgiveness](https://maddymakesgames.com/articles/celeste_and_forgiveness/index.html), which describes generous input and positioning windows.
