# Audit kode SIMK ITP B — revisi 0.2.9

## Temuan sebelumnya dan perbaikannya

1. **`tsc` tidak ditemukan**: penyebab yang mungkin pada instalasi lama ialah devDependencies tidak disertakan atau PATH npm tidak memuat binary lokal. Revisi sekarang menggunakan `npm ci --include=dev`, memeriksa `node_modules/typescript/bin/tsc` secara langsung, dan skrip typecheck/build menjalankan file compiler lokal melalui Node.
2. **Lockfile tidak disertakan**: tidak dibuat lockfile palsu. Launcher membuat lockfile npm v3 dari registry saat pertama kali, memvalidasi metadata root dan paket langsung, lalu menjalankan `npm ci`. Registry harus dapat dijangkau saat first run.
3. **Skrip instalasi npm**: lifecycle scripts ditahan selama clean install. Hanya `esbuild@0.28.2` yang direbuild secara eksplisit. Tidak ada approval massal atau `--dangerously-allow-all-scripts`.
4. **Cache npm**: launcher menjalankan `npm cache verify` sebelum clean install.
5. **`TAR_ENTRY_ERROR` yang pernah muncul**: clean install menghapus `node_modules` yang tidak konsisten melalui `npm ci`; cache diverifikasi terlebih dahulu. Jika warning berulang atau instalasi gagal, hasil instalasi lokal tetap perlu diperiksa dan tidak boleh dianggap lulus.
6. **Pembukaan browser terlalu cepat**: skrip pembuka menunggu HTTP server Vite benar-benar merespons sebelum membuka `127.0.0.1:5173`.
7. **Pratinjau roster lama, duplikasi semester/mata kuliah, gabungan dosen, validasi waktu/ruang, dan perlindungan riwayat**: tes invariant/validasi roster dipertahankan.

## Pengujian aktual

- `node --test tests/*.test.mjs`: **48/48 lulus**.
- TypeScript Compiler API 5.8.3 mem-parsing 12 file TS/TSX/MTS: **0 syntax diagnostic**.
- `node --check` pada 11 file MJS: **lulus**.
- Typecheck terbatas `storage.ts`, `seed.ts`, dan `types.ts` memakai TypeScript global 5.8.3: **lulus**.
- JSON parse `package.json`: **lulus**.

## Belum diverifikasi

- npm registry tidak dapat dijangkau dalam sandbox (`EAI_AGAIN`), sehingga lockfile transitif asli tidak dapat dibuat di sini.
- `npm ci`, full `tsc -b`, Vite production build, dan npm audit final belum dijalankan di lingkungan penyusunan.
- Peluncur `.bat` belum dieksekusi pada Windows pada lingkungan ini.
- Supabase migrations/RLS/Auth/Storage/Edge Functions, AI live provider, browser E2E dan uji lintas akun belum diuji pada project staging.

## Risiko tersisa

Paket ini masih prototipe lokal. UI utama memakai storage browser lokal; login lokal bukan autentikasi produksi; AI di mode lokal bukan model live. Jangan masukkan data akademik pribadi sungguhan atau deploy publik sebelum backend, RLS, storage, autentikasi, AI provider, dan uji multiakun diselesaikan. Tidak ada klaim zero-bug.
