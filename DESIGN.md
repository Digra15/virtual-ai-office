---
# DESIGN.md — Virtual AI Office
# Format: standar terbuka design.md (Google Labs).
# Front matter = token yang bisa dibaca mesin. Body = rasional yang bisa
# dibaca manusia. Urutan seksi body TETAP (boleh dihilangkan, tidak boleh
# diacak): Overview, Colors, Typography, Layout & Spacing, Elevation &
# Depth, Shapes, Components, Do's and Don'ts.
# ATURAN PAKAI: saat menulis kode UI, selalu rujuk nilai token di sini,
# jangan hardcode warna/font/spasi. Token warna proyek (colors.*) AKAN
# diisi dari audit Phase 5 (warna proyek yang sudah ada didahulukan) —
# jangan dikarang sebelum audit.

design:
  name: "Virtual AI Office"
  version: "0.1.0-draft"
  description: "Dashboard monitoring 3D untuk agen AI + panel admin. Alat kerja, bukan halaman showcase."

colors:
  # TBD — diisi Phase 5 dari warna yang sudah ada di codebase (prioritas
  # no-slop: warna proyek dulu, palet terkurasai kedua, tidak pernah acak).
  # Struktur peran yang akan dipakai (bukan nilai):
  # ground, surface (satu langkah nada dari ground), ink, muted,
  # accent (di bawah 5% layar, hanya aksi + satu hal berulang),
  # accent-ink, success, warning, error, info (+ varian bg/border/text).
  # Tema gelap: satu ground nyaris-hitam (bukan navy/slate, bukan gradient).
  # Violet/indigo: bukan brand wash; hanya satu hue data yang
  # didokumentasikan perannya, bila dipakai.
  ground: "TBD-audit"
  surface: "TBD-audit"
  ink: "TBD-audit"
  muted: "TBD-audit"
  accent: "TBD-audit"
  accent-ink: "TBD-audit"
  success: "TBD-audit"
  warning: "TBD-audit"
  error: "TBD-audit"
  info: "TBD-audit"

typography:
  # Layar kerja (permukaan dominan): judul 18-32px, tubuh 14-16px,
  # tidak ada yang >=48px; meta/axis 11-12px, tidak ada yang <11px.
  # Halaman publik (bila ada): display >=4x tubuh, headline <=2 baris.
  fontFamily:
    display: "TBD-audit"
    body: "TBD-audit"
    mono: "TBD-audit (hanya ID/angka/kode)"
  scale:
    title: "18-32px"
    body: "14-16px"
    meta: "11-12px"
  lineHeight:
    heading: "1.0-1.25"
    body: "1.45-1.6"
  measure: "45-75ch"

spacing:
  scale: [4, 8, 12, 16, 24, 32, 48, 64, 96]
  sectionGapDesktop: "120-240px (publik) / 24-64px (layar kerja)"
  cardGap: "6-24px (median 16)"
  cardPadding: "12-34px (median 20)"
  grid: "satu grid, satu pasang margin ketat, kiri = kanan di semua lebar"

elevation:
  # Pemisahan default = tone step ATAU border 1px, tidak keduanya.
  # Bayangan hanya untuk yang melayang, alpha kecil.
  resting: "none"
  floating: "0 2px 8px rgba(0,0,0,0.08) (maksimum layar kerja)"

shapes:
  # Keluarga tight (satu keluarga per produk).
  control: "6-8px"
  card: "8px"
  chip: "4px"
  button: "6-10px (bukan pill, bukan gradient)"

motion:
  # Layar kerja: feedback saja, 100-200ms ease, opacity/warna.
  # Halaman publik: entrance terkoreografi, stagger 60-90ms.
  # Selalu transform/opacity/clip-path + fallback prefers-reduced-motion.
  duration:
    press: "140ms"
    hover: "180-200ms"
    reveal: "700-900ms"
    pictureOpen: "1100-1300ms"
  easing: "ease (tidak pernah bounce/elastic)"
---

# DESIGN.md — Virtual AI Office

## 1. Overview / Brand & Style

Virtual AI Office adalah **alat kerja**: dashboard 3D mission-control untuk
memantau agen AI yang bekerja, plus panel admin. Penggunanya membuka layar
yang sama berulang kali untuk bekerja — bukan sekali untuk dikagumi. Maka
identitas visualnya adalah **tenang, rapat, standar, dan jujur**: permukaan
kerja mengikuti aturan no-slop-ui + app-screen taste-skill; aturan halaman
publik (direction yang di-deal, field warna, tipografi display besar,
motion terkoreografi) hanya berlaku bila suatu hari ada halaman
publik/read-scroll, bukan untuk dashboard dan admin.

Prinsip yang tidak bisa ditawar: satu aksi utama per layar; hierarki dari
ukuran/bobot/warna yang digabung bukan dikali; token sebelum nilai mentah;
konten nyata (tidak ada metrik/kutipan/logo karangan); semua state
dirancang; aksesibilitas WCAG 2.1 AA sebagai lantai; usabilitas mengalahkan
efek visual, dengan tradeoff yang didokumentasikan bila terjadi.

Satu-satunya data "simulasi" yang boleh tampil adalah yang dilabeli
SIMULATED secara eksplisit di UI. Tidak ada klaim "paid" tanpa verifikasi
provider pembayaran, tidak ada klaim "pekerjaan AI selesai" tanpa hasil
worker connector.

## 2. Colors

**Status: TBD — diisi dari audit Phase 5.** Sesuai prioritas warna no-slop,
warna proyek yang sudah ada di codebase dipakai dulu; palet terkurasai
hanya bila tidak ada; kombinasi acak tidak pernah.

Peran yang akan dipakai: ground, surface (satu langkah nada dari ground),
ink, muted, accent, accent-ink, success, warning, error, info (dengan
varian background/border/text). Proporsi: ground 70–90% halaman; accent
di bawah 5% layar mana pun, hanya pada aksi + maksimal satu hal berulang
lainnya; di layar kerja warna ~3% piksel dan hanya menempel pada data,
bukan chrome. Tema gelap: satu ground nyaris-hitam (bukan navy/slate,
bukan gradient), ink dilembutkan, elevasi lewat langkah surface yang
lebih terang, bukan glow. Warna menyatakan baik/buruk, bukan naik/turun.
Kontras: 4.5:1 teks tubuh, 3:1 teks besar dan komponen UI. Teks sekunder
memakai face yang sama dengan ink lebih lembut, bukan weight lebih ringan
atau ukuran lebih kecil.

## 3. Typography

Satu family utama (maksimal dua), setiap face satu pekerjaan. Layar kerja:
judul 18–32px, tubuh 14–16px, tidak ada yang ≥48px; meta/axis 11–12px,
tidak ada yang <11px. Halaman publik: display ≥4× tubuh, headline ≤2
baris di semua viewport. Tubuh leading 1.45–1.6, lebar 45–75 karakter;
heading leading 1.0–1.25. Muat hanya weight yang dipakai (2–3),
`font-display: swap`. Mono hanya untuk ID/angka/kode sebagai keputusan
sengaja. Detail: kutip keriting, dash asli, en dash untuk rentang,
`tabular-nums` untuk angka yang disejajarkan, `text-wrap: balance` untuk
heading / `pretty` untuk paragraf, tanpa justified, tanpa paragraf rata
tengah lebih dari 3 baris.

## 4. Layout & Spacing

Skala spasi: 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 (+96 gap antar-seksi).
Tidak ada nilai arbitrer. Gap antar-grup > gap dalam grup; ruang di atas
heading ≥2× ruang di bawahnya. Satu grid, satu pasang margin ketat, margin
kiri = kanan di semua lebar; tepi kiri teks menempel pada garis kolom.
Layar kerja: aritmetika grid harus menutup; card satu baris berbagi tepi
bawah. Rata kiri default; rata tengah hanya satu momen satu elemen.
Responsif mobile-first (320/480/768/1024/1280/1440/1920); HP adalah
komposisi kedua (crop portrait ulang, line break sendiri, margin 16–20px,
target ≥44px). Tabel <~640px menjadi daftar dua baris; tabel yang harus
tetap tabel di-scroll dalam framenya dengan kolom pertama terkunci.

## 5. Elevation & Depth

Pemisahan default adalah tone step ATAU border 1px — tidak pernah
keduanya. Bayangan hanya untuk yang melayang (menu, popover, tooltip,
composer, dialog/modal), maksimum `0 2px 8px rgba(0,0,0,0.08)` di layar
kerja. Card yang diam tidak berbayang. Di tema gelap, elevasi disampaikan
lewat surface yang lebih terang, bukan bayangan atau cahaya berwarna.

## 6. Shapes

Keluarga tight: kontrol 6–8px, card 8px, chip 4px, tombol 6–10px.
Tombol: solid fill atau border sederhana, bukan pill, bukan gradient.
Input: border solid, focus ring sederhana, label di atas field. Ikon
16–20px, monokrom atau warna halus, satu set per proyek, tanpa latar
dekoratif; ikon di KPI/card tidak pernah di dalam lingkaran berwarna
atau kotak tinted. Keluarga radius 9–16px ("soft tengah") dihindari.

## 7. Components

- **Button:** varian primer (solid accent)/sekunder (border)/teks; state
  default, hover, focus-visible, active, disabled, loading. Disabled tetap
  terbaca dan menjelaskan mengapa disabled.
- **Input/FormField:** label di atas field, 14px/500, gap 8–10px; satu
  tinggi kontrol per konteks (form 38–40px, toolbar/filter 28–40px);
  validasi on blur dengan pesan spesifik; tandai field *opsional*, bukan
  required.
- **Card:** hanya untuk item berulang, modal, atau tool berbingkai;
  tidak ada card di dalam card; padding 12–34px (median 20).
- **Table:** rules + alignment, tanpa zebra, tanpa header band, angka
  rata kanan dengan `tabular-nums`; satu baris = satu item.
- **KPI:** sebagai tipografi, bukan tile; tanpa ikon lingkaran berwarna,
  tanpa sparkline; satu pertanyaan + satu temuan per layar.
- **Chart:** satu pertanyaan, satu seri default, maks 3 seri, tanpa
  legend untuk seri tunggal, dibangun sebagai SVG sendiri (bukan default
  library, bukan gambar chart).
- **Modal/Sheet:** fokus terperangkap, Esc menutup, backdrop solid
  (bukan frosted berat).
- **States (semua komponen):** loading mempertahankan layout final
  (bar abu-abu datar ukuran asli, tanpa shimmer, tanpa layout shift);
  error di dalam blok yang gagal + tombol Retry teks; empty
  mempertahankan frame + header + satu kalimat; sukses diakui
  ("Tersimpan"), tidak pernah diam-diam.

## 8. Do's and Don'ts

**Do:**
- Klasifikasikan permukaan dulu (layar kerja vs halaman publik) sebelum
  memilih aturan.
- Pakai token dari front matter ini; tambah token bila belum ada.
- Satu aksi utama per layar, dinamai sesuai aksinya.
- Uji squint, uji glance 3 detik, dan uji keyboard di setiap layar.
- Nilai hasil render di 1440/768/390, bukan source.
- Dokumentasikan tradeoff dan pengecualian (alasan + persetujuan +
  jadwal tinjau ulang).
- Pertahankan fitur yang sudah berfungsi; jangan hapus demi tampilan.

**Don't:**
- Gradient dekoratif, glassmorphism berlebihan, semua-card, metrik palsu,
  chart palsu, bukti sosial karangan, label eyebrow, pill di mana-mana,
  rata tengah semuanya, radius medium di semua hal, copy generik, ikon
  dekoratif, animasi dekoratif, bayangan/glow di semua hal, hero di dalam
  dashboard, status dot via `::before`, teks furnitur, layout template
  berulang, wash ungu→biru.
- Mengorbankan aksesibilitas, keyboard, atau kebenaran data demi efek.
- Mengklaim selesai tanpa menjalankan gate (`FRONTEND_QUALITY_GATE.md`).
- Mengarang nilai token warna sebelum audit Phase 5 mengonfirmasi warna
  proyek yang sudah ada.
