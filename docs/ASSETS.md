# Asset Attribution & Licensing — Virtual AI Office

## Policy: 100% procedural art, zero third-party assets

Every visual element in the office — desks, chairs, monitors, walls, windows,
plants, sofas, server racks, whiteboards, rugs, lamps, and the agent characters
themselves — is generated **procedurally at runtime in code**. The 3D
environment uses Three.js primitive geometries; the agent characters are
**2D pixel-art sprites** (28×36 px each) drawn pixel-by-pixel on canvas from
each agent's `CharacterPreset` (hair style/color, skin tone, eye color, outfit,
accessory), rendered with `NearestFilter` so the pixels stay visible.

### What this means
- **No downloaded models, textures, fonts, or images** ship with the project.
- There is **no third-party asset licensing to track** — nothing with unclear
  provenance enters the repository.
- All original project code (including all procedural art) is MIT-licensed
  (see `LICENSE` at the repo root).

### Deliberate limitation (documented honestly)
The agent characters are **2D billboard sprites, not 3D models**. Animation is
**frame-based** (hand-drawn frame sets per activity: idle, typing, thinking,
walking, meeting, celebrate — plus blinking), which reads as lively but is not
skeletal or transform animation. Characters always face the camera
(Paper-Mario style); they do not turn to face their monitors when seated.

Swapping in custom artwork later is supported by the `PixelAvatar` component
boundary: the admin panel accepts uploaded **PNG sprite sheets** (28×36 px
frames, animation → frame-count manifest, see `CHARACTER_ASSET_MANIFEST_DOC`
in `apps/web/src/world/characters/characterTypes.ts`), guarded by `AssetGuard`
(renders a fallback if an external sheet fails to load). Every sheet needs
`url`, `attribution`, and `license` in the manifest.

### Third-party software (not assets)
The project depends on open-source libraries (see each `package.json`):
React, Three.js, @react-three/fiber, @react-three/drei, Zustand, Express, ws,
Zod, Vite, Vitest — each under its own OSI-approved license (MIT, Apache-2.0,
etc.). No license action is required to run or distribute the built app beyond
complying with those libraries' licenses, which permit commercial use.
