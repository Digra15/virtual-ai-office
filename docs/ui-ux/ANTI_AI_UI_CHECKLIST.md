# Checklist Anti AI-UI (Anti-Slop)

Dipakai pada SETIAP review visual, sebelum dan sesudah coding. Satu item
yang gagal = temuan yang harus diperbaiki atau didokumentasikan
pengecualiannya (alasan + siapa yang menyetujui + kapan ditinjau ulang).
Checklist ini membedakan **layar kerja** (dashboard, admin — permukaan
dominan proyek ini) dari **halaman publik** (landing/marketing — bila ada).
Aturan yang ditandai [PUBLIK] tidak berlaku untuk layar kerja, dan
sebaliknya.

## A. Pola yang dilarang — dan gantinya

| # | Pola buruk (jangan kirim) | Ganti dengan |
|---|---|---|
| 1 | Gradient dekoratif di ground, tombol, card, teks, tile KPI | Warna solid dari token; gradient hanya untuk scrim netral di atas foto (30–55%, di area teks saja) atau fade area di bawah satu garis chart (≤14%) |
| 2 | Glassmorphism / panel frosted di mana-mana | Surface solid satu langkah nada dari ground + border 1px ATAU tone step (tidak keduanya) |
| 3 | Semua elemen berbentuk card, termasuk card di dalam card | Card hanya untuk item berulang, modal, atau tool yang benar-benar berbingkai; di layar kerja utamakan satu divided card atau strip polos daripada grid tile |
| 4 | Grid metrik palsu sebagai layout default dashboard | KPI sebagai tipografi, bukan tile (tanpa ikon di lingkaran berwarna, tanpa sparkline); metrik hanya bila datanya nyata dan menjawab satu pertanyaan |
| 5 | Chart palsu / gambar chart / default library chart untuk mengisi ruang | Chart SVG sendiri yang menjawab satu pertanyaan, satu seri default, maks 3 seri, tanpa legend untuk seri tunggal, tanpa sumbu/angka yang dikarang |
| 6 | Bukti sosial karangan (logo, kutipan, baris bintang, "10.000+ tim") | Bukti nyata atau tidak ada sama sekali; konten contoh dilabeli untuk diganti |
| 7 | Label eyebrow/kicker, pill badge di mana-mana, pill nav | Judul langsung tanpa pemanasan; badge hanya bila datanya nyata dan hanya di dalam baris/di samping nilai (layar kerja) |
| 8 | Rata tengah semuanya (heading + paragraf + dua tombol menumpuk) | Rata kiri default; rata tengah hanya satu momen satu elemen |
| 9 | Satu radius medium (12–16px) di semua hal | Keluarga radius tight proyek: kontrol 6–8px, card 8px, chip 4px |
| 10 | 9 ukuran font yang nyaris sama | Skala yang diputuskan dan berjauhan (layar kerja: judul 18–32px, tubuh 14–16px, meta 11–12px; publik: display ≥4× tubuh) |
| 11 | Label mono micro, penomoran 01/02/03, hairline dekoratif [PUBLIK] | Di halaman publik: label kalimat biasa, tanpa penomoran dekoratif, pemisah berupa field warna atau gambar, bukan garis tipis |
| 12 | Copy generik ("Build something amazing", "Unlock your potential", "Welcome to X", "Operational clarity without the clutter") | Copy konkret: kata benda nyata + angka nyata + klaim yang bisa dibuktikan |
| 13 | Ikon dekoratif tanpa fungsi (ikon di lingkaran berwarna, kotak tinted, latar dekoratif) | Ikon 16–20px monokrom/halus, satu set per proyek, tanpa latar; ikon hanya-ikon tetap punya nama aksesibel |
| 14 | Animasi dekoratif (entrance di layar kerja, hover lift di semua card, bounce/elastic) | Layar kerja: feedback saja (press/hover/focus/menu/sheet/baris tiba), 100–200ms, opacity/warna; hover = perubahan warna/border/shadow, bukan transform |
| 15 | Bayangan lembut/glow di semua hal | Bayangan hanya untuk yang melayang (menu, popover, tooltip, dialog); card diam tanpa bayangan |
| 16 | Hero section di dalam dashboard internal | Dashboard dibuka langsung oleh konten kerjanya: pertanyaan + temuan + aksi, tanpa hero |
| 17 | Status dot via `::before`, badge nav tanpa data nyata | Elemen badge/icon asli (lebih baik untuk screen reader); badge hanya bila datanya nyata |
| 18 | Teks furnitur (strip locale/waktu, koordinat, stempel versi, "Scroll to explore") | Hapus; hanya tampilkan yang membantu tugas user |
| 19 | Layout template berulang (hero → logo → fitur → testimoni → pricing → CTA; atau grid card 3 kolom sebagai satu-satunya layout) | Urutan mengikuti argumen/klaim; variasi komposisi per seksi (publik) atau permukaan kerja yang standar dan konsisten (layar kerja) |
| 20 | Ungu→biru gradient hero + body putih (crutch gelap-ungu) | Satu ground gelap yang diputuskan + satu accent yang didokumentasikan perannya; tidak ada wash ungu default |

## B. Checklist review cepat (lalui satu per satu)

- [ ] **Sekilas (3 detik):** apa yang dilihat pertama kali adalah hal
      terpenting layar itu? Bila bukan, hierarki gagal.
- [ ] **Squint:** layar diburamkan menyisakan 2–3 massa besar dengan
      perbedaan ukuran jelas?
- [ ] **Tepi:** semua tepi kiri teks menempel pada garis kolom (2–3 tepi
      kiri yang dipakai ulang, bukan 6 tepi acak)?
- [ ] **Satu aksi utama:** hanya satu CTA primer per layar, dinamai sesuai
      aksinya, nama yang sama di semua tempat?
- [ ] **Warna:** accent <5% layar, hanya pada aksi + maksimal satu hal
      berulang lain; warna menempel pada data, bukan chrome?
- [ ] **Tipografi:** maksimal 2 family, ukuran berjauhan, tidak ada teks
      <11px (layar kerja) / <13px (publik), angka pakai `tabular-nums`?
- [ ] **Spasi:** semua nilai dari skala 4/8/12/16/24/32/48/64 (+96); gap
      antar-grup > gap dalam grup; card satu baris berbagi tepi bawah?
- [ ] **Konten nyata:** tidak ada metrik/kutipan/logo/angka karangan;
      nol asli tercetak sebagai nol, data hilang sebagai dash abu-abu?
- [ ] **States:** default, hover, focus-visible, active, disabled, loading,
      error, empty, success — semuanya dirancang dan terlihat?
- [ ] **Copy:** setiap kalimat membawa klaim + bukti? Kalimat tanpa klaim
      dihapus?
- [ ] **Motion:** setiap gerakan punya alasan (feedback atau koreografi
      permukaan publik)? Ada fallback `prefers-reduced-motion`?
- [ ] **HP (390px):** bukan desktop yang diperas — crop, line break,
      margin, dan target sentuh sudah komposisi kedua?
- [ ] **Konsistensi:** tidak ada tombol/radius/nilai spasi baru yang
      ditemukan di layar ini? Pengecualian tercatat di Decision Log?

## C. Pengecualian yang diizinkan (dengan catatan)

- **Mode showcase (halaman publik, Mode A):** satu efek dominan per
  viewport boleh berupa gradient mesh atau glassmorphism yang disengaja —
  bukan dekorasi default, dan tidak pernah di layar kerja.
- **Brand-owned banned device:** bila brand pemilik punya elemen yang
  masuk daftar larangan (mis. tile bergaya node di builder), boleh dipakai
  dengan catatan di laporan.
- **Eskalasi (paling penting):** bila aturan anti-slop bertentangan dengan
  aksesibilitas, kebutuhan produk, lokalisasi, keamanan, atau design
  system yang ada — kebutuhan yang lebih tinggi menang, dan tradeoff
  didokumentasikan. Anti-slop adalah lapisan kualitas visual, bukan
  alasan merusak produk.

## D. Cara memakai checklist ini

1. Sebelum coding: baca bagian A untuk permukaan yang akan dikerjakan,
   pastikan tidak ada pola terlarang di rencana.
2. Setelah coding: jalankan bagian B pada screenshot render nyata
   (bukan pada source), di 1440/768/390.
3. Setiap item gagal: perbaiki dulu; bila memang harus dikecualikan,
   tulis alasannya di laporan (bagian C) — jangan diam-diam.
4. Jangan membulatkan skor ke atas. Bila ronde review masih menemukan
   masalah yang akan dilihat orang asing, laporkan apa adanya.
