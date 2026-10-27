# Frontend Quality Gate — Virtual AI Office

Gerbang ini berlaku untuk SETIAP perubahan UI di proyek ini, di atas gate
proyek yang sudah ada (public/ <25 MiB per file, build + suite hijau,
push hanya via konektor GitHub). Tidak ada klaim "selesai/aman/lolos" tanpa
bukti dari perintah di bawah.

## 1. Sebelum coding

- [ ] Permukaan sudah diklasifikasikan: **layar kerja** (aturan no-slop +
      app-screen) atau **halaman publik** (page run taste-skill)?
- [ ] Satu kalimat tujuan layar + user + job-nya sudah ditulis?
- [ ] Token yang dipakai sudah ada di `DESIGN.md`? Bila belum, tambah token
      dulu — jangan nilai mentah di komponen.
- [ ] Scope tepat: hanya objek yang diminta yang diubah, tidak ada yang
      berdekatan ikut berubah.
- [ ] Semua state yang relevan sudah direncanakan (default, hover,
      focus-visible, active, disabled, loading, error, empty, success)?
- [ ] Checklist anti-slop (`ANTI_AI_UI_CHECKLIST.md` bagian A) sudah dibaca
      untuk permukaan ini?

## 2. Perintah verifikasi proyek (jalankan dari root repo)

```bash
# Dari ~/workspace/virtual-ai-office
npm run lint                    # eslint seluruh repo
npm run typecheck               # tsc --noEmit semua workspace
npm run test                    # vitest semua workspace (web + worker)
npm run build:web               # vite build (web saja)
# Gate file Pages: setiap file di apps/web/public/ harus < 25 MiB
find apps/web/public -type f -size +25M
```

Catatan dari pengalaman proyek ini (jangan diulangi):

- Jangan mem-pipe output test lewat `grep` di dalam rantai `&&` — exit
  code grep menutupi kegagalan test. Tulis output ke file dan periksa exit
  code secara eksplisit.
- Setelah mengubah skema shared (`packages/shared`), build shared dulu
  (`npm run build --workspace @virtual-ai-office/shared`) sebelum test
  worker/web atau deploy — kalau tidak, bundle memakai dist basi.
- Deploy Worker oleh user: `git pull` sampai HEAD = SHA push terbaru →
  build shared dari root → `npx wrangler deploy` dari `apps/worker` →
  beri jeda rollout beberapa menit (DO Cloudflare eventually consistent:
  404/500 sesaat setelah deploy belum tentu gagal) → verifikasi ulang.
- Push hanya via helper konektor GitHub (`gh_push_tree_full.py`), tidak
  pernah dua push bersamaan, dan jangan pernah preview via cloudflared
  quick tunnel, bore, atau Tailscale inbound (semua pernah gagal).
- `browser.open` mengembalikan snapshot basi untuk URL Pages — metode
  tepercaya untuk status live adalah `curl` + grep bundel.

## 3. Sesudah coding (wajib, sebelum menyatakan selesai)

- [ ] `npm run lint` hijau (0 error; warning diperbaiki, bukan dibiarkan).
- [ ] `npm run typecheck` hijau (0 error).
- [ ] `npm run test` hijau (web + worker; bila ada test merah, perbaiki —
      jangan dorong dengan test merah).
- [ ] `npm run build:web` hijau; gate public/ <25 MiB bersih.
- [ ] **Review render nyata** (bukan asumsi dari source):
  - Screenshot browser di 1440 / 768 / 390 — diperiksa satu per satu.
  - Untuk dashboard 3D: browser VM sudah terbukti bisa merender WebGL
    (terverifikasi 2026-10-27: kantor, avatar Difia & Kirana berbadan,
    Connection Live) — pakai jalur ini dulu, bukan menunggu screenshot user.
  - Bila browser VM gagal pada satu kasus, fallback: headless Chromium +
    SwiftShader, lalu layanan screenshot pihak ketiga.
- [ ] **Console bersih:** 0 error DAN 0 warning di halaman yang diubah.
- [ ] **Interaksi diuji:** setiap link/form/menu yang disentuh di-klik
      sampai selesai; toggle cepat 5× tanpa glitch/duplikat; tepat satu
      instance DOM; perubahan status diumumkan screen reader.
- [ ] **Keyboard walkthrough:** seluruh layar bisa dilalui keyboard sesuai
      urutan baca; focus terlihat; tidak ada informasi yang hanya ada di
      hover.
- [ ] **Aksesibilitas:** heading tidak ada level yang dilompati; semua
      kontrol berlabel (atau `aria-label` untuk ikon saja); kontras 4.5:1 /
      3:1; target ≥44×44px; zoom 200% tetap berfungsi; reduced-motion
      dihormati.
- [ ] **Responsif:** tidak ada scroll menyamping; tidak ada teks tumpang
      tindih; headline tidak pecah jadi 3+ baris di 390px; tabel sudah
      mengikuti aturan layar kecil.
- [ ] **States terlihat:** loading mempertahankan layout final (tanpa
      shimmer, tanpa layout shift); error di dalam blok yang gagal dengan
      tombol Retry; empty mempertahankan frame + header + satu kalimat.
- [ ] **Checklist anti-slop bagian B** dijalankan pada screenshot, dengan
      hasil per item (lolos/gagal/pengecualian + alasan).
- [ ] **Tidak ada regresi fitur:** fitur yang sudah berfungsi tidak
      dihapus atau diganti hanya demi tampilan.

## 4. Ambang performa (ukur, jangan klaim)

- Gate kirim per halaman: Lighthouse ≥95 di keempat kategori
  (Performance, Accessibility, Best Practices, SEO) + Core Web Vitals
  lolos — diukur per halaman, diukur ulang setiap perubahan.
- Lantai diagnostik: TTFB <800ms, LCP <2.5s, INP <200ms, CLS <0.1,
  aset statis content-hash + cache immutable, HTTP/2 atau HTTP/3,
  render-blocking diminimalkan, kompresi Brotli (fallback Gzip).
- INP menggantikan FID di semua dokumen (bagian vitals threejs-webgl
  yang masih menyebut FID sudah basi).
- 3D: <100 draw call/frame, pixel ratio ≤2 desktop / 1.5 mobile,
  dispose saat unmount, tidak ada alokasi di loop render, tidak ada
  setState di `useFrame` (R3F).

## 5. Definisi selesai

Pekerjaan UI dinyatakan selesai hanya bila SEMUA terpenuhi:

1. Lint, typecheck, test, build hijau (bukti perintah, bukan klaim).
2. Screenshot 1440/768/390 sudah dilihat dan dilalui checklist anti-slop.
3. Console 0 error + 0 warning.
4. States (loading/error/empty/disabled) sudah dilihat, bukan diasumsikan.
5. Tidak ada pola terlarang yang lolos tanpa pengecualian tertulis.
6. Laporan menyebutkan: apa yang diubah, apa yang diuji, apa yang gagal
   dan diperbaiki, dan apa yang masih terbuka — tanpa membulatkan skor.

Bila satu saja belum terpenuhi, statusnya adalah "belum selesai", bukan
"selesai dengan catatan".
