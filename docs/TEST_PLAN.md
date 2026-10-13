# Mesh Studio 3D — Test Plan

Three layers, from fastest to slowest. Run the cheapest layer that can catch the bug.

| Layer | Tool | What it covers | Command | Runtime |
|---|---|---|---|---|
| Unit / API / hook / component | Vitest + Testing Library | store logic, input validation, API status codes, telemetry polling, side panel behaviour | `npm test` | ~6 s |
| End-to-end | Playwright (real Chromium, software WebGL) | the built app in a browser: 3D click selection, persistence across reload, render-loop behaviour, draw-call budget | `npm run test:e2e` | ~2 min |
| Smoke | Playwright `@smoke` + static checks | "is this build alive?" across the whole codebase | `npm run smoke` | ~2 min |
| Manual | this document | visual quality, feel, real GPUs and devices, things automation can't judge | — | ~20 min |

`npm run test:all` runs everything (type check, lint, unit with coverage, build, full E2E). CI runs it on every push and pull request (`.github/workflows/ci.yml`).

---

## 1. Smoke test (run on every build)

`npm run smoke` runs, in order, and stops at the first failure:

1. `tsc --noEmit`: the whole codebase type-checks
2. `next lint`: no lint errors
3. `vitest run`: all 65 unit/API/component tests
4. `next build`: production build succeeds
5. `playwright test --grep @smoke` against the built app:
   - `/` returns 200 and the panel is server-rendered with all part names
   - the WebGL canvas boots and draws real pixels (not a black frame), with **zero console errors**
   - all parts, the transform modes, the heatmap toggle and Save are present
   - `GET /api/parts` and `GET /api/telemetry` respond correctly
   - unknown routes return 404

### Manual 5-minute smoke (before a demo)

- [ ] `npm run build && npm start`, open http://localhost:3000
- [ ] Scene appears within ~2 s; machine, grid and moving heatmap visible
- [ ] Click the orange arm in 3D: it highlights with a blue outline, panel shows **Arm**
- [ ] Drag the red gizmo arrow: arm moves; release: Position readout updates
- [ ] Change colour: arm changes colour instantly
- [ ] Save, reload page, select Arm: change persisted
- [ ] DevTools console: no red errors

---

## 2. Manual test cases

Priority: **P1** = blocks release, **P2** = must fix soon, **P3** = polish.
"Auto" = where an automated test already covers the same behaviour.

### Loading

| ID | Steps | Expected | Pri | Auto |
|---|---|---|---|---|
| L-01 | Hard-reload `/` on a production build | Panel visible immediately; "Loading 3D scene…" spinner, then scene within ~2 s on a laptop | P1 | smoke |
| L-02 | DevTools > Network > "Slow 4G", reload | Panel usable while 3D loads; no layout jump when canvas appears | P2 | — |
| L-03 | DevTools > Network on load | No request to `/api/parts` during startup (data is in the HTML) | P2 | smoke (HTML check) |
| L-04 | Open in a browser with WebGL disabled (`chrome://flags` > disable WebGL) | Panel still renders; app does not white-screen | P2 | — |

### 3D interaction

| ID | Steps | Expected | Pri | Auto |
|---|---|---|---|---|
| I-01 | Hover each part | Soft white outline + cursor becomes a pointer; only the front-most part highlights | P1 | — |
| I-02 | Click a part | Blue outline, gizmo appears on it, panel shows its name and transform | P1 | e2e |
| I-03 | Click empty background | Selection cleared, gizmo disappears | P1 | e2e |
| I-04 | Left-drag on background / on a part | Camera orbits; a drag never selects a part | P1 | e2e |
| I-05 | Scroll wheel | Zooms between min and max distance; cannot go through the floor | P2 | — |
| I-06 | Move hover quickly from Arm onto Joint (they touch) | Highlight moves to Joint and stays (no flicker to none) | P3 | — |
| I-07 | Click a heatmap bar | Nothing is selected (heatmap is not part of the product) | P3 | — |

### Transform gizmo

| ID | Steps | Expected | Pri | Auto |
|---|---|---|---|---|
| T-01 | Select Arm, drag red (X) arrow | Arm moves along X in 0.05 steps; camera does **not** orbit during the drag | P1 | — |
| T-02 | Release the drag | Position readout updates once; Save button becomes enabled | P1 | unit |
| T-03 | Press E, drag a ring | Rotates in 5° steps | P1 | e2e (mode) |
| T-04 | Press R, drag a handle | Scales | P1 | e2e (mode) |
| T-05 | Move a part, look at the ground shadow | Soft contact shadow updates to the new position after release | P2 | — |
| T-06 | Press Ctrl+R / Cmd+R | Browser reloads; mode is **not** switched to Scale | P2 | unit |
| T-07 | Click the colour picker, type letters | Shortcuts don't fire while typing | P3 | unit |

### Materials, save and persistence

| ID | Steps | Expected | Pri | Auto |
|---|---|---|---|---|
| M-01 | Change colour / metalness / roughness | 3D updates live; values in panel match | P1 | unit |
| M-02 | Save | Button shows "Saving…" then "Saved" and disables | P1 | unit + e2e |
| M-03 | Reload after saving | Saved values are shown on first paint (no flash of defaults) | P1 | e2e |
| M-04 | Stop the server, click Save | "Save failed — try again." shown; button stays enabled; no crash | P2 | unit |
| M-05 | Reset | Default scene restored, selection cleared, Save enabled | P2 | unit |

### Live data (heatmap)

| ID | Steps | Expected | Pri | Auto |
|---|---|---|---|---|
| D-01 | Watch heatmap 10 s | Bars move smoothly (no jumps every 0.5 s), colours run blue > green > red | P1 | — |
| D-02 | Untick "Live sensor heatmap" | Heatmap disappears; Network tab shows telemetry polling stops | P2 | e2e |
| D-03 | Switch to another tab for 30 s, come back | No telemetry requests while hidden; polling resumes on return | P2 | unit |
| D-04 | Throttle network to "Slow 3G" | Bars still animate smoothly between updates | P3 | — |

### Performance (Chrome DevTools)

| ID | Steps | Expected | Pri | Auto |
|---|---|---|---|---|
| P-01 | `npm run dev` first load | Under ~6 s cold (Turbopack); under 1 s on reload | P2 | — |
| P-02 | Performance tab, record 5 s idle with heatmap off | Almost no frames rendered (on-demand rendering) | P2 | e2e |
| P-03 | Rendering > Frame Rendering Stats, heatmap on | Steady 60 fps on a mid laptop with a real GPU | P1 | — |
| P-04 | Throttle CPU 6x | Render resolution in panel drops (e.g. 1.5x to 1x) and stays usable | P2 | — |
| P-05 | Memory tab: toggle heatmap 20 times, take heap snapshot | No steady growth in heap or `renderer.info.memory` | P2 | — |
| P-06 | `npm run perf` against a running build | Draw calls ≤ 20/frame, telemetry ≤ 5 KB/poll | P2 | e2e budget |

### Cross-browser / device / accessibility

| ID | Steps | Expected | Pri | Auto |
|---|---|---|---|---|
| X-01 | Chrome, Edge, Firefox, Safari (latest) | All P1 cases pass | P1 | Chromium only |
| X-02 | Narrow window < 800 px / phone | Panel stacks under the viewport; nothing overflows horizontally | P2 | — |
| X-03 | Touch device | One-finger orbit, pinch zoom, tap to select | P2 | — |
| X-04 | Keyboard only: Tab through panel | All buttons reachable, visible focus ring, Space/Enter activate | P2 | — |
| X-05 | Screen reader (NVDA / VoiceOver) | Part buttons announce pressed state; save errors announced | P3 | unit (aria) |

### API robustness (Postman / curl)

| ID | Request | Expected | Pri | Auto |
|---|---|---|---|---|
| A-01 | `PUT /api/parts` with malformed JSON | 400 | P1 | unit |
| A-02 | `PUT` with invalid colour, NaN vectors, unknown geometry, duplicate ids | 422, saved scene unchanged | P1 | unit + e2e |
| A-03 | `PUT` with body > 256 KB | 413 | P2 | unit |
| A-04 | `GET /api/telemetry?size=99999` | Clamped to 64x64, not a huge response | P2 | unit |

---

## 3. Exploratory charters (30 min each)

- **Break the gizmo:** select, drag, switch modes mid-drag, press Esc mid-drag, scale to near zero or negative.
- **Abuse the network:** go offline mid-save, kill the server while the heatmap runs, restart it.
- **Long session:** leave the app open 30 min with the heatmap on; watch memory and fps.

## 4. Bug report template

```
Title: [Area] short description
Build / commit:
Browser + OS + GPU:
Steps to reproduce:
Expected:
Actual:
Console errors / screenshot / Playwright trace:
Severity (P1–P3):
```
