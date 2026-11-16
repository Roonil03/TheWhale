# Abyssal Garden

Source: https://github.com/Noniv/abyssal-garden

Pinned revision: `a596354eff400d458bc2aeb9bdf5e0a9734b2bcf`

Copyright 2026 Maksymilian Dendura. Used under the MIT license in `LICENSE`.

The readable renderer, world generation, shaders, math, audio, and quality modules are vendored here. The race adapts the renderer and controls locally. The files are joined into one async startup function by the Vite game plugin, preserving the upstream shared scope. They are loaded only by the game entry point.
