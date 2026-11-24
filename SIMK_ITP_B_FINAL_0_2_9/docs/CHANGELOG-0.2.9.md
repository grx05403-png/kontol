# Revisi 0.2.9 — koreksi instalasi yang diketahui

- Akar masalah `tsc` tidak ditemukan ditangani dengan `--include=dev`, verifikasi path compiler TypeScript lokal, dan skrip typecheck/build yang memanggil `node_modules/typescript/bin/tsc` secara langsung.
- Menambahkan verifikasi cache npm sebelum clean install.
- Hanya `esbuild@0.28.2` direbuild, bukan semua versi esbuild yang mungkin muncul secara transitif.
- Browser hanya dibuka setelah server `127.0.0.1:5173` benar-benar merespons.
- Menambahkan satu panduan Windows yang menyebutkan dengan jelas bahwa package-lock penuh dibuat otomatis pada first run karena registry npm tidak dapat dijangkau dari sandbox. Tidak ada lockfile palsu.
- 48 tes source-level lulus. Full npm install, full typecheck, Vite build dan audit final masih harus diverifikasi melalui launcher Windows karena sandbox tidak dapat mengakses registry npm.
