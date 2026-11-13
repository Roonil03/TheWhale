# Source application and review guide

These are implementation mappings and future review checks, not claims that each upstream tool or full audit was run. The converted project skills are installed in `.agents/skills/` for Codex discovery. They are scoped to this repository.

- **Emil:** `src/style.css` contains the hero ripple and reduced-motion rule. Review its purpose, visual weight, transform/opacity and behavior when motion is reduced; preserve immediate feedback in `src/main.jsx` controls. See `.agents/skills/animation-craft`.
- **Impeccable:** Review hierarchy, spacing, contrast, focus, loading and errors in `src/main.jsx` and `src/style.css`. Its real detector has context-sensitive heuristics and was not run; avoid presenting a heuristic as an audit finding. See `.agents/skills/design-review`.
- **Taste:** The actual vendor specimens and collage are the content. Check visibility and layout at desktop and narrow widths. The upstream checker was not run.
- **Watermelon:** Treat the hero, gallery, and mixer as distinct purposeful sections; compare examples when a specific component is needed and preserve the project's plain CSS. No catalog component or MCP result was used.
- **React Spring:** Keep simple CSS state transitions; spring physics is an option if a future draggable or interruptible interaction requires it. No package is installed.
- **React Bits:** The hero's concentric ripple in `src/style.css` adapts the water-ripple idea, not copied Ripple Grid code. Keep it subordinate to the specimen.
- **Realtime Colors:** Judge palette roles on the hero, specimen labels, buttons and mixer in context, including contrast and focus visibility. Its restricted source and artwork were not copied.
- **Aceternity:** Its animated-background category informs placing an effect behind the hero while retaining readable foreground content. `.agents/skills/aceternity-ui` describes checks for future component use; none is installed.
- **Motion:** `prefers-reduced-motion` in `src/style.css` and scrolling behavior in `src/main.jsx` embody the accessibility principle without the library. Check essential content remains available in that mode.
- **ln:** `tools/lineart/main.go` generates `public/whale-blueprint.svg`; the blueprint is static. Regenerate and inspect the SVG if its geometry changes.
