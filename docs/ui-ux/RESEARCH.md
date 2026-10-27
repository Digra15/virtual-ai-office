# UI/UX Research — Sumber yang Benar-Benar Dipelajari

Tanggal riset: 2026-10-27. Lokasi clone referensi (di luar repo aplikasi):
`~/workspace/.agent-research/ui-ux-repositories/`. Repo aplikasi TIDAK pernah
dibuka selama riset ini; tidak ada skrip dari repo referensi yang dijalankan;
tidak ada skill yang diinstal ke proyek mana pun. Dokumen ini adalah sintesis
dengan bahasa sendiri, bukan salinan isi repo. Hormati lisensi masing-masing
(MIT untuk taste-skill, no-slop-ui, design-md-skill; agent-skills sesuai
LICENSE di repo tersebut).

## 1. Repositori yang dipelajari

| Repo | Commit | Bentuk |
|---|---|---|
| `Leonxlnx/taste-skill` (v2.1.5) | `12af471` | Satu skill `design-taste-frontend` + `references/` (11 file) + `library/` JSON (direction, hero, section, palet, type, foto, situs, app) + `scripts/*.mjs` + `assets/` CSS/JS |
| `LeoStehlik/no-slop-ui` (v0.3.0) | `3c8f9e5` | Satu `SKILL.md` + `references/` (2 file) + `examples/` (demo before-after, review checklist) + `docs/` |
| `Emmraan/agent-skills` (180+ skill) | `4c2ea06` | 12 direktori kategori di `skills/`; instal via CLI `npx skills` + manifest `skills.sh.json` |
| `cxbl-ops/design-md-skill` (rilis awal) | `13bc4d4` | Hanya 2 file: `README.md` + `SKILL.md`. Tidak ada references/examples/scripts |

## 2. File yang benar-benar dibaca

- **no-slop-ui (penuh):** `SKILL.md`, `README.md`,
  `references/banned-patterns.md`, `references/colour-palettes.md`,
  `examples/review-checklist.md`, `docs/agent-snippets.md`,
  `docs/conversion-proof.md`.
- **design-md-skill (penuh):** `README.md`, `SKILL.md` (SKILL.md sebagian
  berbahasa Mandarin, README berbahasa Inggris; keduanya dibaca).
- **taste-skill (penuh, via pembaca yang didelegasikan):** `README.md`,
  `skills/taste-skill/SKILL.md`, `skills/taste-skill/README.md`,
  `references/colour.md`, `type.md`, `layout.md`, `copy.md`, `critique.md`,
  `tells.md`, `scenes.md`, `research.md`, `app-screens.md`, `imagery.md`,
  `motion.md`; `library/*.json` dibaca sekilas (struktur dan jumlah).
- **agent-skills (11 SKILL.md penuh, via pembaca yang didelegasikan):**
  `design-ux/ui-ux`, `frontend-ui/frontend-craft`,
  `frontend-ui/frontend-core`, `design-ux/refactoring-ui`,
  `design-ux/ux-heuristics`, `frontend-ui/frontend-performance`,
  `testing-quality/browser-testing-with-devtools`,
  `frontend-ui/high-perf-browser`, `animation-webgl/threejs-webgl`,
  `animation-webgl/react-three-fiber`, `animation-webgl/motion`.
  Plus sekilas: `skills.sh.json`, `SKILLS_CATEGORIES.md`,
  `SKILLS_INSTALLATION_GUIDE.md`, `README.md`.

## 3. Yang TIDAK dibaca / TIDAK dijalankan (jangan diklaim)

- Semua sub-file `references/` dan `rules/` di agent-skills (mis. 14 file fase
  frontend-core, 8 file fase frontend-performance, 120+ file aturan
  threejs-webgl, 70+ file aturan react-three-fiber, `R3F_BEST_PRACTICES.md`).
- Skrip taste-skill (`draw/lint/inspect/assets/scenes`), aset CSS/JS-nya,
  `evals/evals.json`, `CHANGELOG.md`, gambar `examples/v2/*`.
- Demo before-after dan skrip validator no-slop-ui (tidak dibuka/dijalankan).
- Tidak ada eksekusi: tidak ada `npx skills`, tidak ada
  `npx @google/design.md lint`, tidak ada Lighthouse, tidak ada sesi DevTools.
  Semua klaim perkakas di dokumen ini adalah klaim repo sumber, bukan hasil
  pengukuran di sini.
- **File hilang di checkout ini:** `taste-skill/.../library/scenes.json`
  (dirujuk SKILL.md/scenes.md tapi tidak ada). Scroll scenes di taste-skill
  karena itu adalah jalur bangun-sendiri, bukan library siap pakai.
- **Catatan basi di sumber (jangan disalin mentah):** bagian vitals
  threejs-webgl masih menyebut "FID" (sudah diganti INP); contoh `useScroll`
  di skill motion mengimpor dari `"framer-motion"` padahal setup-nya
  `motion/react`; frontend-core menulis "React + TypeScript + Vite + Next.js"
  (Next.js tidak berjalan di atas Vite — baca sebagai alternatif, bukan satu
  stack harfiah).

## 4. Skill terverifikasi dan cara mengaktifkannya

Semua 11 skill agent-skills yang dicari ADA (tidak ada yang hilang/berganti
nama). Jalur di bawah relatif terhadap
`~/workspace/.agent-research/ui-ux-repositories/`.

| Skill | Lokasi | Aktivasi |
|---|---|---|
| design-taste-frontend (taste-skill) | `taste-skill/skills/taste-skill/SKILL.md` | Saat membangun/mendesain ulang/mengulas landing page, marketing site, portfolio, product page, hero, halaman publik; juga app screen (dashboard, admin, analytics, settings, inbox). Instal: `npx skills add …/taste-skill --skill "design-taste-frontend"`, plugin Claude/Codex, atau `install.sh` |
| no-slop-ui | `no-slop-ui/SKILL.md` | HANYA saat user eksplisit meminta desain UI / implementasi frontend / polish visual / design review, atau deliverable utama adalah antarmuka terlihat. Tempel/rujuk SKILL.md, lalu jalankan `examples/review-checklist.md` sebagai acceptance pass |
| design-md | `design-md-skill/SKILL.md` | Hermes auto-discovery dari `~/.hermes/skills/creative/design-md`. Pemicu: `DESIGN.md`, design system, visual spec, color/font spec |
| ui-ux | `agent-skills/skills/design-ux/ui-ux/SKILL.md` | Desain/redesain/kritik interface produk, PRD-to-experience, persona, journey, JTBD, IA, wireframe, design system, states, responsive, WCAG, heuristic audit |
| frontend-craft | `agent-skills/skills/frontend-ui/frontend-craft/SKILL.md` | Build/restyle interface user-facing apa pun, kata kunci estetika/motion, permintaan "jangan terlihat AI / awwwards / wow". Phase 0 analisis intent WAJIB sebelum coding |
| frontend-core | `agent-skills/skills/frontend-ui/frontend-core/SKILL.md` | Greenfield/fitur/komponen/refactor/arsitektur/state/styling/data/perf/a11y/testing/build dengan konteks implementasi frontend |
| refactoring-ui | `agent-skills/skills/design-ux/refactoring-ui/SKILL.md` | UI "terlihat aneh/amateur", "perbaiki desain", styling Tailwind, palet, hierarki, token, dark mode, kejelasan data-viz, polish pra-rilis |
| ux-heuristics | `agent-skills/skills/design-ux/ux-heuristics/SKILL.md` | "Usability audit", "user bingung", usability form, masalah navigasi, heuristik Nielsen, cognitive walkthrough, "apakah ini mudah dipakai" |
| frontend-performance | `agent-skills/skills/frontend-ui/frontend-performance/SKILL.md` | Situs/halaman/interaksi lambat, pengukuran/optimasi CWV, bundle/rendering/gambar/font/network/memory, budget/CI gate, monitoring |
| browser-testing-with-devtools | `agent-skills/skills/testing-quality/browser-testing-with-devtools/SKILL.md` | Apa pun yang dirender di browser; debugging UI; analisis console/network/perf; verifikasi perbaikan. Butuh konfigurasi server MCP chrome-devtools (terpisah dari instal skill) |
| high-perf-browser | `agent-skills/skills/frontend-ui/high-perf-browser/SKILL.md` | "Situs saya lambat", CWV, HTTP/2-3, resource hints, latensi, render blocking, TCP/TLS, service worker, strategi caching, critical rendering path, pilihan WebSocket-vs-SSE |
| threejs-webgl | `agent-skills/skills/animation-webgl/threejs-webgl/SKILL.md` | Menulis/mengulas/mengoptimalkan kode Three.js; scene 3D, WebGL/WebGPU, geometri, material, tekstur, lighting, shader, TSL |
| react-three-fiber | `agent-skills/skills/animation-webgl/react-three-fiber/SKILL.md` | Menulis/mengulas/mengoptimalkan kode R3F; `@react-three/fiber`/`drei`/`postprocessing`/`rapier`, `zustand`, `leva` |
| motion | `agent-skills/skills/animation-webgl/motion/SKILL.md` | Animasi enter/exit/scroll/hover/tap di React atau vanilla Motion API. Pemicu: framer motion, motion one, motion react, animations, useScroll, animate, variants, spring, layout animations |

Rute instal kelompok agent-skills (dari dokumentasi repo, tidak dieksekusi):
`npx skills add https://github.com/Emmraan/agent-skills/tree/main/skills/<kategori>`
per kategori, atau `--skill <nama>` untuk satu skill.

## 5. Referensi untuk audit berikutnya

- Dokumen ini + `DESIGN_PRINCIPLES.md` + `ANTI_AI_UI_CHECKLIST.md` +
  `FRONTEND_QUALITY_GATE.md` di direktori yang sama, dan `DESIGN.md` di root
  proyek (format design-md-skill: front matter YAML token + body Markdown
  dengan urutan seksi tetap).
- Clone referensi tetap di `~/workspace/.agent-research/ui-ux-repositories/`
  (bukan bagian dari repo aplikasi, tidak ikut ter-push).
- Saat butuh detail yang di sini ditandai "tidak dibaca", baca sub-file
  referensinya langsung sebelum mengutip — jangan mengarang isinya.
