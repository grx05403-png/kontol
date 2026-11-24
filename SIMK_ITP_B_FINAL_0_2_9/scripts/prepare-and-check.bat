@echo off
setlocal EnableExtensions
cd /d "%~dp0.."
if errorlevel 1 goto failed

title SIMK ITP B - Pemeriksaan dan Start Otomatis
echo ==============================================================
echo       SIMK ITP B - PERSIAPAN DAN PEMERIKSAAN OTOMATIS
echo ==============================================================
echo.
echo Folder proyek: %CD%
echo Website hanya dijalankan jika tes, typecheck, dan build berhasil.
echo.

where node.exe >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js tidak ditemukan. Pasang Node.js minimal 22.12 dari https://nodejs.org/.
  goto failed
)
where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo ERROR: npm.cmd tidak ditemukan. Pasang Node.js resmi agar npm ikut terpasang.
  goto failed
)

node -e "const v=process.versions.node.split('.').map(Number);if(v[0]<22||(v[0]===22&&v[1]<12))process.exit(1)"
if errorlevel 1 (
  echo ERROR: Versi Node.js terlalu lama. Minimal 22.12 diperlukan oleh Vite 7.
  node --version
  goto failed
)

for /f "tokens=1 delims=." %%A in ('npm.cmd --version') do set "NPM_MAJOR=%%A"
if not defined NPM_MAJOR goto npm_version_failed
if %NPM_MAJOR% LSS 11 goto npm_version_failed

echo Node.js: & node --version
echo npm: & npm.cmd --version
echo.

set "LOCK_CREATED=0"
set "NEED_INSTALL=0"

if exist "package-lock.json" goto validate_lock

goto create_lock

:validate_lock
echo [1/9] Memvalidasi package-lock.json...
call node scripts\verify-lockfile.mjs
if errorlevel 1 goto invalid_existing_lock
goto dependency_check

:create_lock
echo [1/9] Membuat package-lock.json ASLI dari registry npm...
echo Ini berjalan otomatis pada pemasangan pertama; koneksi internet diperlukan.
call npm.cmd install --package-lock-only --include=dev --ignore-scripts --no-audit --no-fund
if errorlevel 1 goto lock_failed
if not exist "package-lock.json" goto lock_failed
set "LOCK_CREATED=1"
call node scripts\verify-lockfile.mjs
if errorlevel 1 goto lock_failed

goto dependency_check

:dependency_check
echo.
echo [2/9] Memeriksa apakah dependency lokal lengkap dan sesuai...
if "%LOCK_CREATED%"=="1" set "NEED_INSTALL=1"
if not exist "node_modules\typescript\bin\tsc" set "NEED_INSTALL=1"
if not exist "node_modules\vite\bin\vite.js" set "NEED_INSTALL=1"
if not exist "node_modules\esbuild\bin\esbuild" set "NEED_INSTALL=1"
if "%NEED_INSTALL%"=="0" (
  node node_modules\esbuild\bin\esbuild --version >nul 2>nul
  if errorlevel 1 set "NEED_INSTALL=1"
)
if "%NEED_INSTALL%"=="0" (
  call node scripts\install-state.mjs check >nul 2>nul
  if errorlevel 1 set "NEED_INSTALL=1"
)
if "%NEED_INSTALL%"=="1" goto clean_install

echo Dependency sudah lengkap. Instalasi bersih dilewati.
goto verify_tools

:clean_install
echo.
echo [3/9] Memverifikasi cache npm sebelum instalasi bersih...
call npm.cmd cache verify
if errorlevel 1 goto install_failed

echo.
echo [4/9] Memasang dependency dari lockfile termasuk devDependencies...
echo Lifecycle scripts ditahan agar hanya binary esbuild yang dijalankan setelahnya.
call npm.cmd ci --include=dev --ignore-scripts --no-audit --no-fund --prefer-online
if errorlevel 1 goto install_failed

echo.
echo [5/9] Menyiapkan binary esbuild 0.28.2 yang dipin untuk proyek...
call npm.cmd rebuild esbuild@0.28.2 --no-audit
if errorlevel 1 goto install_failed
node node_modules\esbuild\bin\esbuild --version
if errorlevel 1 goto install_failed
call node scripts\install-state.mjs mark
if errorlevel 1 goto install_failed

goto verify_tools

:verify_tools
echo.
echo [6/9] Memastikan compiler TypeScript, Vite, dan esbuild tersedia...
if not exist "node_modules\typescript\bin\tsc" (
  echo ERROR: TypeScript tidak ditemukan. DevDependencies harus dipasang.
  goto install_failed
)
if not exist "node_modules\vite\bin\vite.js" (
  echo ERROR: Vite tidak ditemukan.
  goto install_failed
)
if not exist "node_modules\esbuild\bin\esbuild" (
  echo ERROR: Binary esbuild tidak ditemukan.
  goto install_failed
)
node node_modules\typescript\bin\tsc --version
if errorlevel 1 goto install_failed
node node_modules\vite\bin\vite.js --version
if errorlevel 1 goto install_failed
node node_modules\esbuild\bin\esbuild --version
if errorlevel 1 goto install_failed

echo.
echo [7/9] Menjalankan tes otomatis...
call npm.cmd test
if errorlevel 1 goto test_failed

echo.
echo [8/9] Memeriksa tipe TypeScript...
call npm.cmd run typecheck
if errorlevel 1 goto typecheck_failed

echo.
echo [9/9] Membuat production build...
call npm.cmd run build
if errorlevel 1 goto build_failed

echo.
echo Memeriksa advisori dependency high/critical...
call npm.cmd audit --audit-level=high
if errorlevel 1 (
  echo.
  echo PERINGATAN: Audit gagal karena jaringan atau menemukan advisori high/critical.
  echo Pengujian lokal dapat diteruskan, tetapi JANGAN deploy publik sebelum audit berhasil.
) else (
  echo Audit npm tidak menemukan advisori high/critical pada registry saat ini.
)

echo.
echo ==============================================================
echo       TES, TYPECHECK, DAN BUILD BERHASIL
echo ==============================================================
echo package-lock.json asli tersimpan di folder proyek.
echo Website siap dijalankan secara lokal.
exit /b 0

:invalid_existing_lock
echo.
echo ERROR: package-lock.json tidak valid atau tidak sinkron.
echo Menyimpan salinan lama sebagai package-lock.invalid.backup.json lalu membuat ulang.
if exist "package-lock.invalid.backup.json" del /q "package-lock.invalid.backup.json"
copy /y "package-lock.json" "package-lock.invalid.backup.json" >nul
if errorlevel 1 goto lock_failed
del /q "package-lock.json"
if errorlevel 1 goto lock_failed
set "LOCK_CREATED=1"
goto create_lock

:npm_version_failed
echo ERROR: npm 11 atau lebih baru diperlukan oleh kebijakan allowScripts proyek ini.
call npm.cmd --version
echo Perbarui Node.js dari https://nodejs.org/ lalu buka terminal baru.
goto failed

:lock_failed
echo.
echo ERROR LOCKFILE: npm tidak dapat membuat atau memvalidasi package-lock.json asli.
echo Periksa koneksi internet/registry npm. Lockfile palsu tidak akan dibuat.
goto failed

:install_failed
echo.
echo ERROR DEPENDENCY: dependency penting tidak berhasil dipasang.
echo Pastikan npm ci berhasil menyertakan devDependencies dan esbuild.
goto failed

:test_failed
echo.
echo ERROR TES: ada pengujian otomatis yang gagal.
goto failed

:typecheck_failed
echo.
echo ERROR TYPESCRIPT: pemeriksaan tipe belum lulus. Website tidak akan dijalankan.
goto failed

:build_failed
echo.
echo ERROR BUILD: Vite gagal membuat folder dist. Website tidak akan dijalankan.
goto failed

:failed
echo.
echo ==============================================================
echo       PEMERIKSAAN GAGAL - WEBSITE TIDAK DIJALANKAN
echo ==============================================================
echo Jangan tutup jendela sebelum screenshot diambil.
pause
exit /b 1
