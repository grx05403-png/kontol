# SIMK ITP B — Paket Revisi 0.2.9

**Sistem Informasi Manajemen Kelas B — Ilmu dan Teknologi Pangan, Universitas Halu Oleo**

Paket ini adalah **prototipe web lokal React + fondasi backend Supabase**. Tujuannya agar proyek dapat diperiksa dan dicoba di laptop Windows 10 sebelum disambungkan ke database serta layanan produksi.

> **Batas penggunaan:** jangan gunakan data pribadi mahasiswa, roster asli, presensi resmi, lampiran izin, atau pesan sebenarnya untuk operasional sampai UI terhubung ke Supabase, migration/RLS/Storage diuji di staging, serta pengujian autentikasi dan akses lintas akun selesai. Saat ini UI utama masih menggunakan `localStorage`/IndexedDB demo. Folder `supabase/` berisi fondasi backend, bukan bukti bahwa semua halaman React telah terhubung ke database online.

## Cara menjalankan di Windows 10/11

**Persiapan:** Node.js minimal 22.12. Pengguna yang sebelumnya mengikuti panduan sudah memiliki Node.js v26.13.1 dan npm v11.20.0. Jangan instal ulang bila perintah `node -v` sudah menampilkan versi yang sesuai.

1. Unduh ZIP dan ekstrak sekali ke `Downloads`. Folder hasil ekstraksi bernama `SIMK_ITP_B_FINAL_0_2_9`; di dalam folder itu `package.json`, `MULAI_SIMK.bat`, `src`, dan `supabase` berada langsung.
2. Klik dua kali **`MULAI_SIMK.bat`**. Tidak perlu membuka PowerShell atau mengetik perintah.
3. Pada pemasangan pertama, launcher membuat `package-lock.json` asli dari registry npm, memvalidasinya, lalu menginstal paket dari lockfile. Sebelum clean install, launcher juga menjalankan `npm cache verify` untuk memeriksa cache lokal dan mengurangi masalah ekstraksi paket yang tidak lengkap. Proses ini memerlukan koneksi internet. Pemeriksaan advisory npm saat peluncuran juga membutuhkan koneksi; jika audit gagal karena jaringan, tampilkan peringatan dan jangan anggap paket telah lulus audit keamanan. File lock disimpan di folder proyek dan tidak dibuat ulang pada pemakaian berikutnya.
4. Launcher menjalankan tes otomatis, pemeriksaan TypeScript, production build, dan audit dependency. Website hanya dijalankan jika tes, typecheck, dan build lulus.
5. Pembuka browser menunggu server Vite benar-benar merespons, lalu membuka `http://127.0.0.1:5173`. Biarkan jendela terminal tetap terbuka. Tekan `Ctrl+C` pada jendela itu untuk menghentikan server.

### Mengapa package-lock.json tidak disertakan di ZIP?

`package-lock.json` harus memuat versi seluruh dependency transitif yang benar-benar diselesaikan npm dari registry. Registry npm tidak dapat diakses dari lingkungan saat arsip ini disusun, jadi saya tidak membuat lockfile palsu/parsial yang justru berisiko membuat `npm ci` gagal. Sebagai gantinya, launcher membuat lockfile lengkap secara otomatis di laptopmu pada pemakaian pertama menggunakan `npm install --package-lock-only --include=dev --ignore-scripts`, memvalidasi versi React/TypeScript/Vite/esbuild, lalu menjalankan `npm ci --include=dev --ignore-scripts` dan hanya `npm rebuild esbuild@0.28.2` saja. Simpan folder proyek beserta `package-lock.json` setelah proses pertama selesai. `npm ci` memerlukan lockfile yang valid dan selaras dengan `package.json`; ia tidak memperbarui lockfile secara diam-diam.

### Kebijakan skrip instalasi npm

`package.json` mempin `esbuild@0.28.2` sebagai devDependency langsung dan mencatat hanya versi tersebut pada `allowScripts`. Pada instalasi, seluruh lifecycle script ditahan melalui `npm ci --include=dev --ignore-scripts`. Sesudahnya, peluncur hanya menjalankan `npm rebuild esbuild@0.28.2` agar lifecycle script versi yang direview saja yang dijalankan. `core-js` dan `tesseract.js` tidak direbuild; hook donation keduanya tidak dibutuhkan oleh runtime aplikasi. Peluncur memerlukan npm 11 atau lebih baru.

### Jika proses gagal

Launcher berhenti dan menampilkan tahap yang gagal. Ambil screenshot seluruh jendela terminal. Jangan menjalankan `npm audit fix --force`, jangan menghapus `package-lock.json`, dan jangan mengubah Execution Policy PowerShell.

## Teknologi

- React 19 + TypeScript + Vite 7.
- Supabase JS/PostgreSQL/Auth/Storage/Edge Functions sebagai fondasi backend.
- GSAP + ScrollTrigger, Motion for React, Lenis untuk animasi dan scroll.
- PDF.js untuk ekstraksi teks/render halaman PDF.
- Tesseract.js untuk OCR gambar dan halaman PDF hasil scan.
- jsPDF untuk laporan PDF.
- Node.js minimal 22.12.

Dependency langsung yang dipin untuk revisi 0.2.9 (versi langsung ditulis tanpa rentang caret/tilde):
- Vite `7.3.8` (menerima perbaikan keamanan yang tersedia pada jalur 7.3.7+).
- jsPDF `4.2.1` (perbaikan advisori keamanan yang dirilis pada 4.2.0 dan 4.2.1).
- `@vitejs/plugin-react` `5.1.4` agar tetap pada jalur yang kompatibel dengan Vite 7.
- `esbuild` `0.28.2` untuk binary bundler lokal Vite; install script-nya dipin dan direbuild secara eksplisit.
- `@supabase/supabase-js` `2.119.2`.
- GSAP `3.15.1`.
- Lenis `1.3.27`.


## Akun demo

- Admin demo: Raman Dzulfitra — NIM `Q1A126065` — password awal demo `Q1A126065`.
- Mahasiswa demo: gunakan NIM yang tersedia sebagai identitas dan password awal.
- Pada login pertama mode demo, pengguna diminta mengganti password.

**Peringatan:** login lokal ini bukan autentikasi produksi. Data dan hash demo berada di browser. Role lokal dapat dimodifikasi oleh orang yang memiliki akses ke browser/DevTools. Jangan pakai akun demo untuk situs publik.

## Data mahasiswa awal

Sumber foto yang diberikan hanya menampilkan 38 entri nomor **41–78**. Hanya 38 entri ini yang dimasukkan. Nomor 1–40 belum tersedia dan tidak dibuat.

Nama nomor 45 dipertahankan persis seperti terbaca pada foto: **ARYO BANYUBIRU24** dan diberi flag verifikasi. Nama nomor 51 ditampilkan sebagai **JIHAN NURAFIFAH** sesuai teks yang terbaca, tetapi diberi flag verifikasi karena foto sumber belum cukup jelas untuk memastikan seluruh nama. Jangan melengkapi atau mengubah kedua nama tersebut berdasarkan dugaan. Akun kedua NIM tersebut tidak boleh diprovisikan pada backend sebelum identitas dikonfirmasi.

Raman Dzulfitra, `Q1A126065`, adalah satu-satunya Admin pada konfigurasi awal. Semua data lainnya ber-role Student. Bootstrap Admin backend harus dilakukan melalui secret sekali pakai dan password kuat yang dipilih sendiri; tidak ada password Admin produksi yang ditanamkan ke kode.

## Perbaikan pada revisi 0.2.9

- Package-lock asli dibuat otomatis pada pemakaian pertama, divalidasi dengan skrip khusus, cache npm diverifikasi, lalu digunakan oleh `npm ci`.
- TypeScript dan Vite dipastikan terpasang sebagai devDependencies; launcher memeriksa compiler lokal sebelum typecheck.
- Perintah instalasi diperjelas: `npm ci --include=dev --ignore-scripts`, kemudian `npm rebuild esbuild@0.28.2`.
- Skrip instalasi dependency ditahan secara default; hanya esbuild versi 0.28.2 yang direbuild secara eksplisit. Cache npm diverifikasi sebelum clean install.
- Launcher alternatif dihapus; hanya ada satu tombol utama `MULAI_SIMK.bat`.

## Perbaikan logika roster dan integritas data pada 0.2.4

- Baris roster dengan mata kuliah/hari/jam yang sama digabungkan menjadi satu penawaran dengan daftar dosen unik; nama dosen yang sama berulang, baris identik, waktu invalid, ruang berbeda untuk slot sama, bentrok ruang/dosen, dan duplikasi terhadap data semester yang sudah ada akan menahan persetujuan.
- Memilih dokumen roster baru mengosongkan pratinjau dokumen sebelumnya dan menonaktifkan kontrol selama OCR berjalan, sehingga dokumen baru tidak dapat tersimpan bersama baris hasil dokumen lama.
- Draft roster yang dibuat saat semester aktif tetap dapat disetujui setelah semester tersebut diarsipkan; data tetap masuk ke semester asal, bukan semester aktif baru.
- Pembuatan semester ganda dicegah berdasarkan nama atau pasangan tahun akademik/jenis semester.
- Penambahan mata kuliah memeriksa format jam dan bentrok ruang/dosen. Mata kuliah dengan riwayat presensi, ujian, atau tugas tidak dapat dihapus dari demo.
- Data lokal lama menerima tanda verifikasi sumber untuk NIM 045/051 hanya bila nama yang tersimpan masih persis sama dengan nama sumber; koreksi yang telah dilakukan Admin tidak ditimpa.

## Fitur prototipe yang dapat dicoba

- Dashboard Admin dan mahasiswa dengan menu berbeda.
- Data mahasiswa, pencarian, penambahan demo, status akun, dan ekspor CSV.
- Semester baru dan arsip semester demo.
- Impor roster PDF teks/scan/gambar ke draft; koreksi manual; persetujuan demo.
- Mata kuliah dan jadwal yang dihasilkan secara lokal.
- Presensi H/I/S/A/? dan pembaca teks dari foto presensi sebagai draft OCR.
- UTS/UAS dengan konfirmasi Ya/Tidak/Belum menjawab; konfirmasi terpisah dari presensi aktual.
- Tugas, pengumuman, kalender agenda, izin, dan pesan privat simulasi.
- Pusat AI demo berbasis aturan; **bukan model AI live**.
- Laporan PDF/CSV, backup JSON, reset data lokal.
- Animasi kartu, hero, dan scroll dengan pengaturan reduced-motion.

## Fondasi backend yang disertakan

`supabase/migrations/` memiliki migration SQL berurutan, `supabase/functions/` berisi Edge Functions, dan `supabase/schema.sql` merupakan salinan gabungan migration untuk inspeksi. Fitur keamanan yang dirancang meliputi RLS, akses storage privat, pembatasan Admin utama, verifikasi identitas, dan draft AI yang harus disetujui Admin.

**Belum selesai:** halaman React belum tersambung ke Supabase sebagai sumber data operasional. Database, Auth, Storage, RLS, Edge Functions, AI live, snapshot laporan, notifikasi, backup/restore produksi, dan workflow OCR/approval lengkap masih memerlukan integrasi dan uji staging.

## Cara deploy

### Deploy prototipe statis (demo saja)

1. Jalankan `MULAI_SIMK.bat` hingga test, typecheck, dan build lulus.
2. Pastikan folder `dist` terbentuk.
3. Upload **isi folder `dist`** ke static hosting yang mendukung SPA fallback ke `index.html`.
4. Ingat: ini hanya prototipe lokal yang dipublikasikan. LocalStorage per browser bukan database terpusat; login demo bukan autentikasi aman; AI demo bukan layanan AI live.

### Deploy penggunaan produksi

Jangan langsung upload dan menganggap sistem operasional. Urutannya:
1. Buat Supabase project baru/staging pada akun pengelola yang berwenang.
2. Simpan publishable key di `VITE_SUPABASE_PUBLISHABLE_KEY`; jangan masukkan secret/service role/AI key dengan prefix `VITE_`.
3. Tinjau dan jalankan migration berurutan pada database staging kosong.
4. Deploy Edge Functions dan masukkan secret server-side melalui Supabase secrets.
5. Bootstrap satu Admin utama dengan secret sekali pakai dan password kuat.
6. Hubungkan semua halaman React dengan Supabase Auth/Database/Storage (pekerjaan ini belum selesai pada paket ini).
7. Uji akses anon, Admin, Mahasiswa A, dan Mahasiswa B; pastikan akses lintas mahasiswa diblokir pada database, bukan hanya UI.
8. Uji impor roster, OCR presensi, AI provider, persetujuan draft, laporan snapshot, backup/restore, dan E2E browser.
9. Baru setelah semua lulus, isi roster resmi dan gunakan domain/hosting produksi.

Panduan arsitektur, riset, status, perubahan dan hasil pengujian tersedia di `docs/`.

## Troubleshooting

### `npm.ps1 cannot be loaded because running scripts is disabled`
Gunakan `MULAI_SIMK.bat`. Tidak perlu mengubah Execution Policy PowerShell.

### `TS7016` pada `roster-parser.mjs`
Pastikan file `src/lib/roster-parser.d.mts` ada dan file lama `roster-parser.d.ts` sudah tidak ada. Jalankan `MULAI_SIMK.bat`.

### `TS2322` pada PBKDF2 / BufferSource
Pastikan `src/lib/storage.ts` versi revisi menggunakan `saltBuffer` yang dibuat dari `new ArrayBuffer(...)`. Jalankan `MULAI_SIMK.bat`.

### `npm audit` menemukan kerentanan
Jangan jalankan `npm audit fix --force`. Paket ini memperbarui Vite dan jsPDF untuk mengatasi advisory yang diketahui. Jalankan `npm.cmd audit` dan simpan hasil lengkap jika masih ada temuan transitif.

### `npm.cmd run build` gagal
Jangan upload `dist`. Simpan screenshot atau salin seluruh error (jangan hanya baris terakhir). Periksa bahwa dependency terpasang melalui `MULAI_SIMK.bat`.

### Port 5173 sudah dipakai
Tutup server SIMK yang lama dengan `Ctrl+C`. Jika port 5173 masih digunakan aplikasi lain, hentikan aplikasi itu sebelum menjalankan SIMK.

## File penting

- `BACA_DULU.txt` — petunjuk paling singkat.
- `MULAI_SIMK.bat` — proses satu klik: install, test, typecheck, build, audit, jalankan lokal.
- `src/App.tsx` — UI dan alur prototipe.
- `src/lib/storage.ts` — penyimpanan demo dan hash demo password.
- `src/lib/roster.ts` — ekstraksi PDF dan OCR.
- `src/lib/roster-parser.mjs` + `roster-parser.d.mts` — parser dan deklarasi tipe ESM.
- `supabase/migrations/` — schema/migrations backend.
- `supabase/functions/` — Edge Functions.
- `docs/TEST-REPORT.md` — catatan tes yang benar-benar dijalankan.
- `docs/STATUS.md` — status fitur dan batasan yang tersisa.
