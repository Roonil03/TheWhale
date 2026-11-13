# Design and implementation references

Reviewed 2026-11-13 against the linked upstream project descriptions and READMEs. These are references, not dependencies installed wholesale.

- [Emil Kowalski's skills](https://github.com/emilkowalski/skills): animation and design-engineering guidance. Use intentional easing, duration and restrained motion; inspect interactions and reduced-motion behavior.
- [Impeccable](https://github.com/pbakaus/impeccable): a catalog of design commands plus a deterministic detector for web interfaces. Its README describes 62 rules and local/CLI scans. The detector and installer were not run; catalog availability is not evidence that a scan passed. Review hooks before installing.
- [taste-skill](https://github.com/leonxlnx/taste-skill): art direction, visual references and browser review are useful for avoiding generic output. No package installed.
- [Watermelon Platform](https://github.com/WatermelonCorp/watermelon-platform): the browsing, preview and documentation platform for Watermelon components, blocks, dashboards and templates; useful for interface inspiration; no runtime dependency required.
- [react-spring](https://github.com/pmndrs/react-spring): spring-physics React animation library; useful when physical interactions warrant it, but unnecessary for simple transitions.
- [React Bits](https://github.com/DavidHDev/react-bits): animated and interactive React components; useful as a selective effect reference rather than a reason to add multiple effects.
- [Realtime Colors](https://github.com/juxtopposed/realtimecolors): real-time UI color exploration; informs checking a palette in context rather than copying its implementation.
- [Aceternity UI skill](https://github.com/secondsky/claude-skills/tree/main/plugins/aceternity-ui/skills/aceternity-ui): converted into the local Codex skill at `skills/aceternity-ui/SKILL.md`. Component source and dependencies should be checked against current documentation.
- [Motion](https://github.com/motiondivision/motion): animation library for JavaScript and React; use only where it adds value beyond CSS.
- [ln](https://github.com/fogleman/ln): Go 3D line-art engine; used by `tools/lineart/main.go` to generate the static `public/whale-blueprint.svg`, without a browser runtime dependency.
