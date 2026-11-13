# Design and implementation references

Reviewed 2026-11-13 against upstream skills and relevant documentation. These are references, not dependencies installed wholesale. See [SKILL-APPLICATION.md](SKILL-APPLICATION.md) for concrete application and review checks.

- [Emil Kowalski's animate skill](https://github.com/emilkowalski/skills/blob/main/skills/animate/SKILL.md) (MIT): purposeful easing, duration, interruption and reduced motion; distilled in `.agents/skills/animation-craft`.
- [Impeccable skill](https://github.com/pbakaus/impeccable/blob/main/skill/SKILL.src.md) and [critique workflow](https://github.com/pbakaus/impeccable/blob/main/skill/reference/critique.md) (Apache-2.0): visual review, distilled in `.agents/skills/design-review`. Its [detector](https://github.com/pbakaus/impeccable/blob/main/src/detect-antipatterns.mjs) exists and includes subjective heuristics. It was not installed or run; no detector result is claimed.
- [Taste Skill](https://github.com/Leonxlnx/taste-skill/blob/main/skills/taste-skill/SKILL.md): subject-led art direction and browser review, distilled in `.agents/skills/design-review`. Its scripts, checker and Claude hooks are not installed.
- [Watermelon UI skill](https://github.com/WatermelonCorp/watermelon-platform/blob/main/skills/watermelon-ui/SKILL.md) (MIT): source-backed selection and adaptation, distilled in `.agents/skills/watermelon-ui`. Its catalog/MCP was not queried and no component was installed.
- [react-spring animated elements](https://www.react-spring.dev/docs/concepts/animated-elements): spring physics for physical interaction; no runtime installed.
- [React Bits Ripple Grid](https://reactbits.dev/backgrounds/ripple-grid): a water-ripple reference; the CSS effect is independently implemented, not the component.
- [Realtime Colors](https://github.com/juxtopposed/realtimecolors): evaluate palette roles in context. Its repository is CC BY-NC-ND; no source or artwork is copied.
- [Aceternity UI skill](https://github.com/secondsky/claude-skills/tree/main/plugins/aceternity-ui/skills/aceternity-ui): converted into the local Codex skill at `.agents/skills/aceternity-ui/SKILL.md`. Component source and dependencies should be checked against current documentation.
- [Motion accessibility](https://motion.dev/docs/react-accessibility): reduced-motion guidance applies to CSS effects; no runtime installed.
- [ln](https://github.com/fogleman/ln): Go 3D line-art engine; used by `tools/lineart/main.go` to generate the static `public/whale-blueprint.svg`, without a browser runtime dependency.

Consult current upstream licensing and component documentation before copying source or installing dependencies. `.agents/skills/visual-integration` records the library-specific guidance.
