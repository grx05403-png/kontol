# Arsitektur SIMK ITP B

## Dua mode yang dipisahkan

### 1. Demo lokal (mode aplikasi yang aktif pada paket ini)

- React + TypeScript + Vite menampilkan halaman aplikasi.
- `src/lib/storage.ts` menyimpan data demo pada `localStorage`.
- `src/data/seed.ts` menyediakan 38 mahasiswa nomor 41–78 dari foto sumber.
- `src/lib/archive.ts` menyimpan berkas sumber secara lokal di IndexedDB browser.
- Login demo mencocokkan nama lengkap + NIM dan password awal NIM; pergantian password disimpan sebagai hash PBKDF2 pada browser menggunakan Web Crypto.
- Ini **bukan** autentikasi aman untuk website publik. Data localStorage dapat dibaca/diubah oleh pengguna yang memiliki akses browser/DevTools.

### 2. Backend produksi (fondasi disertakan, belum tersambung ke seluruh halaman UI)

- PostgreSQL + Supabase Auth + Storage + Edge Functions.
- Schema/migration: `supabase/migrations/` dan `supabase/schema.sql`.
- RLS membatasi baris data, sedangkan grants membatasi operasi tabel; keduanya harus benar.
- Edge Functions memproses bootstrap Admin, provisioning, login NIM, manajemen akun, perubahan password, dan AI.
- Bucket `simk-private` disiapkan sebagai private bucket dengan policies terpisah.
- UI React saat ini belum melakukan query/mutasi Supabase; integrasi UI–backend adalah pekerjaan produksi tersisa.

## Autentikasi NIM

Supabase password Auth memakai email atau nomor telepon sebagai identitas. Kebutuhan nama lengkap + NIM + password dibuat melalui Edge Function `signin-by-nim`: fungsi memetakan NIM menjadi alias internal `.invalid`, memverifikasi password menggunakan Supabase Auth lebih dahulu, lalu membaca profil/mahasiswa menggunakan sesi pengguna dan RLS. Alias `.invalid` bukan alamat surat dan harus diuji dalam project staging serta konfigurasi Auth sebelum digunakan. Bila provider menolak alias tersebut, jangan meneruskan deployment; ubah metode login dengan mekanisme autentikasi yang telah diuji.

Admin pertama hanya dibuat sekali melalui `bootstrap-admin` dengan `BOOTSTRAP_ADMIN_SECRET` server-side dan password kuat yang ditentukan Admin. Akun mahasiswa dibuat oleh Admin melalui `provision-student`; password awal NIM wajib diganti saat pertama login. Tidak ada password produksi yang ditanam pada migration.

## Alur data penting

`semesters → course_offerings → course_lecturers → timetables → meetings → attendance_records`

`students → student_enrollments → attendance_records / exam_confirmations / leave_requests / conversations`

`roster_imports → draft preview → Admin correction/approval → official course/timetable records`

`AI request → backend authorization → scoped context → constrained provider → ai_drafts → Admin review → approved action`

## Prinsip keamanan dan akademik

- RLS dan grants digunakan bersama; secret/service keys hanya server-side.
- Catatan pertemuan mengikat dosen yang benar-benar mengajar; histori tidak berubah saat dosen berikutnya diaktifkan.
- Roster hanya mengisi data yang benar-benar tertera; jangan mengada-adakan kode, SKS, tanggal, pertemuan, atau pembagian dosen.
- `?` tidak dihitung Alpa; pertemuan dibatalkan tidak dihitung ketidakhadiran.
- Konfirmasi UTS/UAS bukan presensi ujian aktual.
- Semester baru tidak menimpa data semester lama.
- Laporan final perlu snapshot immutable ketika workflow report diintegrasikan.
- AI tidak boleh mengubah data resmi tanpa persetujuan Admin.
- File pribadi harus disimpan di bucket privat dengan policy khusus.

## Tampilan dan motion

- GSAP + ScrollTrigger untuk judul/teks yang reveal saat masuk viewport.
- Motion for React untuk animasi card, hover, dan transisi.
- Lenis untuk smooth scroll secara selektif.
- `prefers-reduced-motion` dihormati; cleanup effect animasi diperlukan agar aman di React StrictMode.
- Hindari motion yang memblokir aksesibilitas, gesture, atau performa mobile.

## Keterbatasan versi ini

UI masih memakai localStorage, sedangkan SQL dan Edge Functions adalah fondasi backend terpisah. Beberapa modul UI masih demo atau belum lengkap, termasuk attachment leave, weekly calendar, workflow urutan dosen, matching OCR presensi, report snapshot/history, notifications, audit view dan restore. Rincian ada di `docs/STATUS.md` serta `docs/TEST-REPORT.md`.
