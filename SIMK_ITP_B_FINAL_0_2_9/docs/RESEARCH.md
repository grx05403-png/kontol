# Riset teknis dan keputusan implementasi SIMK ITP B — 0.2.9

Tanggal pemeriksaan: 24 November 2026. Sumber yang diutamakan adalah dokumentasi primer teknologi.

## 1. Arsitektur proyek

- **Frontend:** React 19, TypeScript, Vite 7.
- **Backend yang direncanakan:** Supabase PostgreSQL, Auth, Storage, Row Level Security (RLS), Edge Functions. Pada paket ini backend masih fondasi dan belum tersambung menyeluruh ke halaman UI.
- **PDF/OCR:** PDF.js untuk membaca teks atau render halaman PDF; Tesseract.js untuk OCR gambar/hasil render PDF scan. Setiap hasil OCR harus berupa draft dan dikoreksi Admin.
- **Laporan:** jsPDF.
- **Animasi:** GSAP + ScrollTrigger, Motion, Lenis; penggunaan tetap harus mematuhi reduced motion dan performa HP.

Dokumentasi Vite menyatakan kebutuhan Node.js 20.19+ atau 22.12+. Node.js pengguna v26.13.1 berada di atas persyaratan minimum tersebut. Sumber: https://vite.dev/guide/

## 2. Masalah nyata dari laptop pengguna

- Node.js v26.13.1 berhasil dipasang.
- npm v11.20.0 dapat dijalankan sebagai `npm.cmd`; perintah `npm` PowerShell terkena Execution Policy karena alias `npm.ps1` diblokir. Peluncur memakai `npm.cmd`; tidak perlu menurunkan kebijakan keamanan PowerShell.
- `npm.cmd install` pernah menambahkan dependency tetapi typecheck berhenti dengan `'tsc' is not recognized`.
- Log install sebelumnya menampilkan lifecycle script dan warning ekstraksi `core-js/proposals`.

## 3. Perbaikan akar masalah TypeScript

- `typescript` dan `vite` ditetapkan eksplisit di `devDependencies` dan versi langsung dipin.
- Peluncur memasang dependency menggunakan `npm ci --include=dev` agar devDependencies tidak hilang ketika lingkungan npm sebelumnya mengatur omit=dev. Dokumentasi npm v11 menyatakan dependency yang tercantum pada `--include` tidak akan dihilangkan meskipun `omit` juga berlaku: https://docs.npmjs.com/cli/v11/commands/npm-ci/
- Skrip `typecheck` dan `build` memanggil `node ./node_modules/typescript/bin/tsc` secara langsung. Ini menghindari ketergantungan pada PowerShell PATH atau alias `tsc`.
- Sebelum menjalankan typecheck, launcher memeriksa keberadaan compiler lokal dan menampilkan pesan spesifik jika paket tidak ada.

## 4. Lockfile yang tidak tersedia di ZIP

`package-lock.json` mengunci pohon dependency transitif yang diselesaikan npm. Registry npm tidak dapat dijangkau dari lingkungan penyusunan karena DNS `EAI_AGAIN`, sehingga file lock penuh yang benar tidak dapat dibuat. Saya tidak membuat lockfile parsial/palsu. Pada pemakaian pertama, `MULAI_SIMK.bat` menjalankan `npm install --package-lock-only --include=dev --ignore-scripts`, memvalidasi manifest dan paket langsung, lalu memasang dengan `npm ci`. Ini otomatis, tetapi koneksi internet ke registry npm harus aktif. Dokumentasi npm `npm ci` menjelaskan penggunaan lockfile yang selaras dengan package manifest: https://docs.npmjs.com/cli/v11/commands/npm-ci/

Setelah lockfile dibuat di laptop, pengguna harus menyimpannya bersama folder proyek dan menyertakannya bila memindahkan source.

## 5. Kebijakan install scripts npm

- Clean install dijalankan dengan `--ignore-scripts` sehingga tidak ada lifecycle install script dependency yang berjalan saat instalasi massal.
- Setelah clean install, hanya `esbuild@0.28.2` yang direbuild secara eksplisit: `npm rebuild esbuild@0.28.2`.
- Dokumentasi npm menyebut `npm rebuild <package-spec>` menjalankan lifecycle scripts untuk paket yang cocok dengan package spec: https://docs.npmjs.com/cli/v11/commands/npm-rebuild/
- Paket `core-js` dan `tesseract.js` tidak direbuild karena aplikasi tidak membutuhkan hook postinstall keduanya untuk runtime demo.
- Tidak menggunakan `--dangerously-allow-all-scripts` dan tidak menyetujui semua package.

## 6. Cache npm dan warning ekstraksi

Peluncur menjalankan `npm cache verify` sebelum clean install. Ini memeriksa cache npm lokal. `npm ci` membuat ulang `node_modules` berdasarkan lockfile yang valid; bila masih ada warning `TAR_ENTRY_ERROR` atau npm gagal, hasil tersebut tidak boleh dianggap berhasil.

## 7. Keamanan lokal dan produksi

- Dev server Vite hanya bind `127.0.0.1`; bukan dibuka ke jaringan publik.
- `.env.example` tidak memuat secret nyata. Service-role key atau AI provider key tidak boleh diletakkan di variabel `VITE_` karena variabel frontend dapat diekspos.
- LocalStorage/login demo bukan pengganti Supabase Auth/RLS dan tidak aman untuk data akademik pribadi.
- Semua hasil AI/OCR harus melalui draft dan persetujuan Admin; uji RLS lintas akun diperlukan sebelum produksi.

## 8. Status validasi aktual

- 48/48 tes Node lulus.
- 12 berkas TypeScript/TSX/MTS diparse tanpa syntax diagnostic.
- 11 berkas MJS lulus `node --check`.
- Typecheck subset storage/seed/types lulus.
- Full npm lock generation/clean install/typecheck/build/audit tidak dapat diselesaikan di sandbox karena registry npm tidak merespons.
- Supabase staging, browser E2E, dan uji multiakun belum dilakukan.

Sumber resmi tambahan:
- npm config / `allowScripts`: https://docs.npmjs.com/cli/v11/using-npm/config/
- Supabase RLS: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- PDF.js: https://mozilla.github.io/pdf.js/api/index.html
- Tesseract.js API: https://github.com/naptha/tesseract.js/blob/master/docs/api.md
- GSAP ScrollTrigger: https://gsap.com/docs/v3/Plugins/ScrollTrigger/
- Motion for React: https://motion.dev/docs/react
- Lenis: https://github.com/darkroomengineering/lenis
