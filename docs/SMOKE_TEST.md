# Browser Smoke Test — Virtual AI Office

Visual/interactive checks that require a real browser. Run against
`npm run dev:web` (default http://localhost:5173) with the backend running
(`npm run dev:server`, default http://localhost:4000).

## Setup
- [ ] Backend healthy: `curl http://localhost:4000/health` returns `status: "ok"`.
- [ ] Frontend serves: page loads, "Virtual AI Office" header visible, 3D office renders (floor, desks, characters — not a black/empty canvas).
- [ ] Loading state: on hard refresh a "Loading 3D office…" overlay appears briefly, then the scene appears.

## 3D scene
- [ ] 5 zones recognizable: open workspace (8 desks), meeting room (table + whiteboard), mission control (server racks + wall screen), lounge (sofas + rug), plants/windows/decor present.
- [ ] 8 agent characters visible at desks, each with a name label and a colored status ring.
- [ ] Status colors differ across agents (green/purple/gray/amber/red rings).
- [ ] Animations play: at least one agent bobs (working), one pulses (thinking). No frozen scene.

## Camera & interaction
- [ ] Drag rotates, wheel zooms (stops at min/max), right-drag pans.
- [ ] Click an agent → detail panel opens on the right AND camera smoothly moves toward that agent's desk.
- [ ] "Reset view" button returns camera to the default overview.
- [ ] "Focus" button in the detail panel moves the camera to the selected agent.
- [ ] Basic touch: one-finger rotate, pinch zoom on a mobile viewport.

## Dashboard
- [ ] Header shows connection indicator (green "LIVE" when backend connected).
- [ ] Stat cards show Total 8 / Online / Working / Errors — numbers match the agent list.
- [ ] Search filters the agent list as you type; status chips filter by status; clearing shows all 8.
- [ ] Selecting an agent shows task, progress bar, last-seen, workstation, activity history.
- [ ] Event timeline shows recent events; new demo events appear within ~10s (backend DEMO_MODE=true).
- [ ] DEMO MODE badge visible when using simulated data; absent/changed when real agents report in.
- [ ] Settings panel opens: API/WS URLs editable, stress-test toggle works (list grows toward 30, scene still interactive).

## Failure handling
- [ ] Stop the backend → connection indicator changes to reconnecting/error state; UI stays usable.
- [ ] Restart the backend → dashboard reconnects and shows LIVE again without a page reload.

## Performance (subjective)
- [ ] Scene feels smooth while orbiting with 8 agents; with stress mode (30 agents) it remains interactive.
- [ ] No console errors during a 2-minute session (ignore benign Vite HMR logs).
