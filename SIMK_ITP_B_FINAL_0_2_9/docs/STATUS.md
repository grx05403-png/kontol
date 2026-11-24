# Status SIMK ITP B — 0.2.9

## Bentuk paket
- Prototipe frontend React 19 + TypeScript + Vite 7.
- Fondasi backend Supabase berupa migration/schema, private storage policy, RLS dan Edge Functions; belum diterapkan ke staging dan belum semua halaman UI tersambung.
- Mode lokal demo memakai data browser dan bukan untuk data akademik nyata.

## Perbaikan instalasi 0.2.9
- Typecheck/build memakai TypeScript file lokal, bukan command `tsc` yang bergantung pada PATH.
- Clean install memaksa devDependencies dengan `npm ci --include=dev --ignore-scripts`.
- `npm cache verify` sebelum clean install.
- Hanya `esbuild@0.28.2` direbuild; tidak ada lifecycle script yang disetujui massal.
- `package-lock.json` npm asli dibuat otomatis pada first run karena registry tidak dapat dijangkau dari sandbox.
- Pembuka browser menunggu server Vite merespons; server dev hanya bind ke `127.0.0.1`.

## Identitas/data yang dipertahankan
- Satu Admin demo: Raman Dzulfitra, NIM Q1A126065.
- 38 data yang terlihat pada foto, nomor 41–78 saja; tidak membuat nomor 1–40.
- NIM Q1A126045 (ARYO BANYUBIRU24) dan Q1A126051 (JIHAN NURAFIFAH) diberi tanda verifikasi; nama tidak dilengkapi dengan dugaan.

## Fitur prototipe lokal
Dashboard Admin/mahasiswa demo, data mahasiswa, semester, draft impor roster/OCR, mata kuliah/jadwal, presensi demo, UTS/UAS, tugas, pengumuman, kalender, izin, pesan simulasi, AI berbasis aturan (bukan live), laporan PDF/CSV, backup lokal, dan animasi tampilan.

## Belum siap produksi
Seluruh halaman perlu diintegrasikan ke Supabase Auth/Database/Storage. Migrations/RLS/Edge Functions belum diuji pada staging. AI live membutuhkan provider dan secret server-side. Belum ada bukti pengujian browser E2E, RLS lintas mahasiswa, backup/restore produksi, atau deployment publik.

## Hasil pengujian source-level
- 48/48 tes Node lulus.
- 12 file TS/TSX/MTS lolos parse syntax, 0 diagnostic.
- 11 file MJS lulus `node --check`.
- Typecheck terbatas pada storage/seed/types lulus.
- Full lock generation/install/typecheck/build/audit belum dijalankan di sandbox karena registry npm tidak terjangkau. Detail ada di `TEST-REPORT.md`.
