# Project Progress — Virtual AI Office

## Phase 1 — Monorepo scaffold + working 3D scene ✅
- npm workspaces monorepo (`apps/web`, `apps/server`, `packages/shared`).
- Pinned compatible set: React 19.3 + `@react-three/fiber` 9.8 + `@react-three/drei` 10.7 + three 0.186 + Vite 8.3 + Zustand 5 + Express 5 + ws 8 + Zod 4.
- Root `npm install` clean (this VM's npm wrapper lacks the `workspace:` protocol → intra-workspace deps use `"*"`; documented).

## Phase 2 — Office layout, camera, interaction ✅
- Procedural low-poly office: open workspace (8 desks), meeting room, mission-control room, lounge; reusable furniture; instanced chairs/plants; shared geometries/materials.
- Orbit/zoom/pan camera with limits, Reset View, Focus Agent with eased tween, click-to-select agents/desks, touch support via OrbitControls.

## Phase 3 — Agents + dashboard ✅
- 8 configurable sample agents, 6 statuses with distinct colors/animations (procedural placeholder characters — documented honestly).
- Dark dashboard: header, connection + demo badges, stat cards from live store state, searchable/filterable agent list, detail panel, event timeline, camera controls, settings (URLs, stress mode, reconnect).

## Phase 4 — Backend + shared + simulator ✅
- `packages/shared`: types + Zod schemas (single source of truth).
- Express REST (`/health`, `/api/agents*`) + WS `/ws` (snapshot/broadcast/heartbeat).
- Validation, rate limiting, malformed-input safety, offline sweep, `AgentAdapter` seam, `DemoAdapter`, sample client `examples/report-agent.mjs`.

## Phase 5 — Tests, docs, deployment ✅
- 45 tests total, all passing: shared 12, server 17 (REST/WS/offline), web 16 (RTL/jsdom).
- Docs: ARCHITECTURE, API, DEPLOYMENT, ASSETS, SMOKE_TEST + README.
- CI workflow (lint → typecheck → test → build).

## Phase 6 — Validation + local git ✅ (this run)
- `npm install` ✅ · `tsc --noEmit` (3 workspaces) ✅ · ESLint 0 errors ✅
- `vitest run` 45/45 ✅ · `vite build` ✅ · `tsc` server build ✅
- Live checks: `/health`, 8 demo agents, valid/invalid/malformed POSTs (400s), unknown agent 404, events limit, WS snapshot + broadcast + malformed-frame error reply, offline sweep + heartbeat revival, rate-limit 429s, sample client E2E, web dev server serves.
- Fixes during validation: Express 5 param typing, `ws` ESM/CJS interop import, vitest `dist` exclusion, test-free build configs, API envelope unwrapping in web client, `currentTask` nullability, SettingsPanel WS-URL save bug, RTL cleanup, `@types/react-dom`, eslint node-globals for `.mjs` example.
- Local `git init` + commit done. **Remote publishing intentionally not attempted** (no `gh` auth in this VM) — parent pushes via the GitHub connector in the foreground.

## Remaining for a human (browser)
- `docs/SMOKE_TEST.md` — visual/interactive checklist for the parent's browser pass (scene zones, animations, click→focus, filters, stress mode, reconnect behavior).

## 2026-10-22 — Building simplification + musola + day/night + honest loading gate

- **Simplified to 13 rooms, still 2 floors** (user: "hanya room penting dan guna saja"). Ground floor (8): reception, open workspace (live Kanban wall screen folded in from the cut PM room), conference room, server room, restrooms, pantry, recovery room (4 error pods), overflow hot desks (stress/spawn). Upper floor (5): musola, lounge & library, focus room, content studio, upper corridor. Kept only rooms that serve a real feature.
- **Cut**: PM room, executive suite, R&D lab, focus room B, glass meeting pods, training room, rooftop terrace, decorative elevator shaft.
- **Musola** (upper floor, west north-band): sajadah rows facing a qibla marker, shoe rack, wudu nook, calm lighting. Room id `musola`, type `musola`. Wander target `u-musola` added to `WANDER_WAYPOINT_IDS_2F`.
- **Day/night cycle**: auto follows the viewer's local time (day 06:00–18:00) + manual day/night override persisted in localStorage (`vao-daynight-mode`). Interior and garden lamps come on at night. Pure helpers `resolveIsNight` / `resolveIsNightAt` are unit-tested.
- **Honest first-frame loading overlay**: new `useSceneReadyStore` — the overlay now stays up until the first 3D frame has actually rendered (one-shot `useFrame` marker in OfficeScene), not just until the JS module loads.
- **Black-viewport root cause (confirmed, NOT a lighting/camera bug)**: the "Loading 3D office…" spinner disappeared at JS module load while the scene needed 20–90 s for its first frame (~1000 meshes × shadow pass ≈ 2000 draw calls on weak/software rendering) — users stared at the clear-color viewport. Mitigations: fewer meshes (simplification), honest first-frame gate.
- Tests: new `useDayNightStore.test.ts`, `useSceneReadyStore.test.ts`, `world/building/musola.test.ts`, `world/wander.test.ts`; stale room references fixed (`shell`, `useOccupancyStore`, `cameraRig` tests). Rooms-barrel mapping for `musola` is pending on the builder's `rooms/` rewrite (assertion captured as a skipped test in `musola.test.ts`).

## 2026-10-22 — Office redesign from user's dream-office denah (14 rooms)

- **Rebuilt to match the reference denah** (user: "kurang srek dengan desain sekarang"). Lantai 1 (Operasional & Kolaborasi): Ruang Meeting | Ruang Server | Pantry | Toilet (top row), Ruang Project (live Kanban project board from useTaskStore), Workspace (8 agent desks + hot-desk bullpen for stress/spawn), Resepsionis bottom-left with main entrance "Pintu Masuk". Lantai 2 (Strategi & Pengembangan): Ruang Direksi | Ruang Konten | Musola (top row), Ruang Fokus (mid-left), Lounge (center), Ruang Pemulihan bottom-left, Ruang R&D bottom-right. Stairs on the right/east side.
- **Ruang Pemulihan moved to floor 2** (was ground floor): RecoveryDirector + recoveryLogic route via the stair chain automatically (floor resolved from RECOVERY_BEDS roomId); manual controls + SIMULATED error injection unchanged.
- **New rooms**: ProjectRoom (planning table + LIVE Kanban board), DireksiRoom (director desk + strategy/analytics screens), KontenRoom (creator desks + camera tripod/ring light; replaces Studio), RnDRoom (dev desks + experiment board). Overflow + Corridors rooms deleted; circulation dressed by rooms/Circulation.tsx (not in ROOM_COMPONENTS).
- **Navigation**: waypoint graph rewritten for the new layout; findPath3D reaches all 14 rooms + L2 recovery beds; wander targets = lounge, garden hall, north landing upstairs + reception/pantry/north/south walkway on ground.
- Exterior: entrance path moved to the new west entrance, simple painted parking area added east of the building.
- Characters stay 2D pixel-art; day/night rig + toggle untouched; honest first-frame loading overlay untouched.
