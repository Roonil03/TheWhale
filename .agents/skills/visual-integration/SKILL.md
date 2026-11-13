---
name: visual-integration
description: Choose and adapt visual effects, palette tools, or animation libraries to an existing web project without unnecessary runtime dependencies.
---
# Visual integration

This is local integration guidance based on official library documentation, not an upstream agent skill. Keep the existing framework and use the simplest technique that meets the brief.

- [React Bits Ripple Grid](https://reactbits.dev/backgrounds/ripple-grid) is a water-like grid reference; inspect the component and its dependencies before reuse. This project's CSS ripple expresses that idea without importing a component.
- [React Spring animated elements](https://www.react-spring.dev/docs/concepts/animated-elements) connect spring values to animated elements without React rendering on each update. Use a spring when interruptible physical interaction needs it, not for a simple fade; wrapped components must forward styles.
- [Motion accessibility](https://motion.dev/docs/react-accessibility) recommends reducing large transforms, autoplay and parallax for reduced motion. Apply the principle even without Motion. If integrating Motion, consult its current API and bundle guidance.
- [Realtime Colors](https://github.com/juxtopposed/realtimecolors) demonstrates judging palette roles on a rendered interface, not isolated swatches. Its repository is CC BY-NC-ND: do not copy its implementation or artwork into this project. Check text and control contrast separately.
- [ln](https://github.com/fogleman/ln) renders 3D line art to SVG. This repository uses it offline in `tools/lineart/main.go`; the generated blueprint is static, not an animation runtime.

The project evidence and integration status are recorded in `docs/SKILL-APPLICATION.md`. Recheck upstream licensing before copying component source.
