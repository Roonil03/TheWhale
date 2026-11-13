---
name: aceternity-ui
description: Integrate or adapt Aceternity UI animated React components when a user asks for that library or a suitable effect. Check the existing stack and component source before installing.
license: MIT
---

# Aceternity UI

Adapted for Codex from [secondsky/claude-skills Aceternity UI skill](https://github.com/secondsky/claude-skills/tree/main/plugins/aceternity-ui/skills/aceternity-ui), version 1.1.0 (MIT). Aceternity supplies editable React component source, typically styled with Tailwind and animated with Motion. Choose individual components to fit the product; do not assume an existing project uses Next.js or Tailwind.

Inspect the project's framework, aliases, dependencies and styles first. Consult the [component documentation](https://ui.aceternity.com/) for the current component source, dependencies, and installation steps. The upstream skill describes a shadcn registry at `https://ui.aceternity.com/registry/{name}.json`; verify current registry instructions before using it. Review generated files and dependency changes before incorporating them. Preserve existing conventions instead of initializing a new stack unnecessarily.

Keep effects subordinate to content and interaction. Provide keyboard-accessible controls, respect `prefers-reduced-motion`, and verify responsive layout and performance. For server-rendered React, isolate browser APIs and interactive animation in an appropriate client component. Favor transform and opacity for motion, and avoid large perpetual effects when a static treatment communicates as well.
