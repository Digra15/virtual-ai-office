# Asset Attribution & Licensing — Virtual AI Office

## Policy: 100% procedural geometry, zero third-party assets

Every visual element in the 3D office — desks, chairs, monitors, walls, windows,
plants, sofas, server racks, whiteboards, rugs, lamps, and the agent characters
themselves — is generated **procedurally at runtime** from Three.js primitive
geometries (`BoxGeometry`, `CylinderGeometry`, `SphereGeometry`, `CapsuleGeometry`,
`TorusGeometry`, `PlaneGeometry`, `CircleGeometry`, `OctahedronGeometry`) with
`MeshStandardMaterial`s defined in code.

### What this means
- **No downloaded models, textures, fonts, or images** ship with the project.
- There is **no third-party asset licensing to track** — nothing with unclear
  provenance enters the repository.
- All original project code (including all procedural art) is MIT-licensed
  (see `LICENSE` at the repo root).

### Deliberate limitation (documented honestly)
The agent characters are **stylized procedural placeholders** (capsule body,
sphere head, status ring, floating status indicator) with simple code-driven
animations (bob, sway, pulse, blink). They are **not rigged character models**
and the project does not claim skeletal animation. Swapping in GLB/GLTF
characters later is supported by the `AgentAvatar` component boundary, guarded
by `AssetGuard` (renders a fallback if an external model fails to load).

### Third-party software (not assets)
The project depends on open-source libraries (see each `package.json`):
React, Three.js, @react-three/fiber, @react-three/drei, Zustand, Express, ws,
Zod, Vite, Vitest — each under its own OSI-approved license (MIT, Apache-2.0,
etc.). No license action is required to run or distribute the built app beyond
complying with those libraries' licenses, which permit commercial use.
