# Laporan pemeriksaan SIMK ITP B — revisi 0.2.9

Tanggal: 24 November 2026.

## Tes yang benar-benar dijalankan di lingkungan penyusunan

| Pemeriksaan | Hasil aktual | Batas cakupan |
|---|---:|---|
| `node --test tests/*.test.mjs` | **48 lulus, 0 gagal** | Unit/invariant, fixture lockfile, alur instalasi, validasi roster, dan kesiapan pembuka browser. |
| TypeScript Compiler API 5.8.3 — parse TS/TSX/MTS | **12 berkas, 0 parse diagnostic** | Pemeriksaan sintaks saja; bukan full-project typecheck. |
| `node --check` untuk seluruh MJS di `src`, `scripts`, `tests` | **11 berkas lulus** | Pemeriksaan sintaks JavaScript. |
| Typecheck terbatas `storage.ts`, `seed.ts`, `types.ts` memakai TypeScript global 5.8.3 | **Lulus** | Hanya subset yang tidak membutuhkan seluruh tipe React/Vite/Supabase. |
| Validasi JSON `package.json` | **Lulus** | Manifest versi 0.2.9 terbaca. |
| Audit struktur/CRC ZIP | **Lulus** | Arsip final diuji dengan `unzip -t`; tidak ada entri rusak. |

## Pemeriksaan yang belum dapat dijalankan di lingkungan penyusunan

| Pemeriksaan | Status | Alasan |
|---|---|---|
| Pembuatan lockfile penuh melalui npm | **Belum dapat dijalankan** | Akses `registry.npmjs.org` dari sandbox gagal dengan DNS `EAI_AGAIN`. |
| `npm ci` clean install | **Belum dapat dijalankan** | Memerlukan lockfile dan registry yang dapat dijangkau. |
| Full `npm run typecheck` (`tsc -b`) | **Belum dapat diverifikasi** | Dependency dan tipe lengkap tidak tersedia di sandbox. |
| Full `npm run build` (Vite production) | **Belum dapat diverifikasi** | Vite dan seluruh dependency tidak dapat diunduh di sandbox. |
| `npm audit --audit-level=high` final | **Belum dapat diverifikasi** | Memerlukan registry npm dan lockfile penuh. |
| Eksekusi `.bat` pada Windows | **Belum dapat dijalankan di sandbox Linux** | Perlu dijalankan pada Windows pengguna. Sintaks/alur diperiksa statis dan lewat tes Node. |
| Supabase migration/RLS/Auth/Storage | **Belum dijalankan** | Memerlukan project staging, kredensial, dan akun uji. |
| Browser E2E dan tampilan mobile nyata | **Belum dijalankan** | Memerlukan install penuh dan browser runtime. |

## Perbaikan instalasi pada 0.2.9

1. `typescript` dan `vite` dipin sebagai `devDependencies`; skrip typecheck/build memanggil file compiler lokal secara langsung (`node ./node_modules/typescript/bin/tsc`) sehingga tidak bergantung pada PowerShell PATH.
2. Peluncur memakai `npm ci --include=dev --ignore-scripts`, memaksa devDependencies tetap diinstal walaupun konfigurasi lingkungan sebelumnya meng-omit dev.
3. Lifecycle script ditahan saat clean install. Setelahnya hanya `npm rebuild esbuild@0.28.2` dijalankan secara spesifik.
4. `npm cache verify` dijalankan sebelum clean install untuk memeriksa cache npm dan mengurangi risiko artefak cache yang tidak lengkap.
5. Tidak ada perintah `npm audit fix --force`, tidak ada persetujuan semua script, dan tidak ada pemasangan TypeScript global sebagai jalan pintas.
6. Jika package-lock tidak tersedia, peluncur membuat lockfile npm asli secara otomatis dari registry. Jika lockfile tidak valid, file lama disalin sebagai backup sebelum dibuat ulang.
7. Website hanya dimulai setelah tes, full typecheck dan Vite build berhasil pada komputer pengguna.

## Mengapa `package-lock.json` tidak disertakan di ZIP?

Lockfile harus memuat pohon dependency transitif yang benar-benar diselesaikan npm dari registry. Registry tidak dapat dijangkau dari sandbox ini; membuat lockfile tebakan atau parsial akan tidak jujur dan dapat menyebabkan `npm ci` gagal. Karena itu `MULAI_SIMK.bat` membuat lockfile npm v3 yang asli pada pemakaian pertama, memvalidasinya, lalu menggunakannya untuk `npm ci`. Koneksi internet aktif diperlukan saat pertama kali. Setelah muncul, simpan file tersebut bersama folder proyek.

## Kesimpulan

Tes source-level yang tersedia lulus, tetapi paket **belum dapat dinyatakan bebas bug, full-build lulus, atau siap produksi**. Pengguna harus menjalankan peluncur Windows untuk menyelesaikan clean install, full typecheck, build, dan audit pada laptopnya. Aplikasi tetap prototipe demo lokal dengan fondasi Supabase; integrasi backend/AI live dan tes keamanan staging masih menjadi pekerjaan terpisah.
