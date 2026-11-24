import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8')

test('seed memuat tepat 38 mahasiswa sumber nomor 41–78', () => {
  const seed = read('src/data/seed.ts')
  const rows = [...seed.matchAll(/\['(Q1A126\d{3})',\s*'([^']+)'\]/g)]
  assert.equal(rows.length, 38)
  const nims = rows.map((row) => row[1])
  assert.equal(new Set(nims).size, 38)
  assert.equal(nims[0], 'Q1A126041')
  assert.equal(nims.at(-1), 'Q1A126078')
  assert.ok(nims.every((nim) => Number(nim.slice(-3)) >= 41 && Number(nim.slice(-3)) <= 78))
})

test('Raman adalah satu-satunya Admin demo; nama yang perlu diverifikasi tidak dikoreksi diam-diam', () => {
  const seed = read('src/data/seed.ts')
  assert.match(seed, /export const ADMIN_NIM = 'Q1A126065'/)
  assert.match(seed, /nim === ADMIN_NIM \? 'ADMIN' : 'STUDENT'/)
  assert.match(seed, /Q1A126045', 'ARYO BANYUBIRU24'/)
  assert.match(seed, /Q1A126045/ )
  assert.match(seed, /Periksa ejaan nama pada daftar sumber; jangan diubah tanpa konfirmasi\./)
  assert.match(seed, /Q1A126051/)
  assert.match(seed, /teks pada foto sumber belum cukup jelas untuk memastikan seluruh nama\./)
})

test('SQL mengaktifkan RLS, membatasi role Admin, dan memakai storage privat', () => {
  const sql = read('supabase/migrations/202611230001_initial.sql')
  assert.match(sql, /enable row level security/i)
  assert.match(sql, /simk_only_one_admin/)
  assert.match(sql, /role = 'ADMIN' and nim = 'Q1A126065'/)
  assert.match(sql, /values \('simk-private','simk-private',false/i)
  assert.match(sql, /'Q1A126051','JIHAN NURAFIFAH',true,'Nama pada foto sumber perlu diverifikasi/i)
  assert.match(sql, /revoke all on table/i)
  assert.match(sql, /revoke all on function public\.is_simk_admin\(\) from public, anon/i)
  for (const table of ['attendance_records','exam_confirmations','leave_requests','conversations','messages','ai_drafts','report_snapshots','audit_logs']) {
    assert.match(sql, new RegExp(`create table if not exists public\\.${table}\\b`, 'i'))
  }
})

test('migration hardening mencegah konfirmasi ujian setelah tenggat', () => {
  const sql = read('supabase/migrations/202611230002_security_hardening.sql')
  assert.match(sql, /confirmation_deadline/)
  assert.match(sql, /Batas waktu konfirmasi ujian sudah lewat/)
  assert.match(sql, /student_enrollments/)
  assert.match(sql, /exam_confirmation_admin_all/)
  assert.match(sql, /drop function if exists public\.mark_password_changed\(\)/)
})

test('secret AI dan Supabase secret tidak didefinisikan sebagai VITE frontend environment', () => {
  const env = read('.env.example')
  assert.match(env, /VITE_SUPABASE_URL/)
  assert.match(env, /VITE_SUPABASE_PUBLISHABLE_KEY/)
  assert.doesNotMatch(env, /VITE_.*(?:SERVICE_ROLE|SECRET|AI_PROVIDER_API_KEY)/)
  assert.match(env, /AI_PROVIDER_API_KEY/)
  assert.match(env, /SUPABASE_SECRET_KEYS/)
})

test('package mempunyai test/typecheck/build dan compiler lokal dipanggil langsung', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.ok(pkg.scripts.test)
  assert.ok(pkg.scripts.typecheck)
  assert.ok(pkg.scripts.build)
  assert.ok(pkg.scripts.check)
  assert.equal(pkg.engines.node, '>=22.12.0')
  assert.match(pkg.devDependencies.typescript, /^5\.9\.2$/)
  assert.match(pkg.scripts.typecheck, /node \.\/node_modules\/typescript\/bin\/tsc/)
  assert.match(pkg.scripts.build, /node \.\/node_modules\/typescript\/bin\/tsc/)
})

test('AI edge function memakai daftar modul yang diizinkan dan membuat draft, bukan menulis langsung ke tabel resmi', () => {
  const fn = read('supabase/functions/ai-assistant/index.ts')
  assert.match(fn, /const moduleNames: Record<ModuleKey, string>/)
  assert.match(fn, /ai_drafts/)
  assert.match(fn, /draft_requires_admin_approval/)
  assert.doesNotMatch(fn, /\.from\('attendance_records'\)\.update/)
})

test('Admin account-management Edge Function checks Admin identity and blocks unverified activation/reset', () => {
  const fn = read('supabase/functions/admin-manage-student/index.ts')
  assert.match(fn, /actor\.role !== 'ADMIN'/)
  assert.match(fn, /actor\.nim !== 'Q1A126065'/)
  assert.match(fn, /student\.needs_verification && action !== 'DEACTIVATE'/)
  assert.match(fn, /admin_set_student_active/)
  assert.match(fn, /must_change_password: true/)
  assert.match(fn, /NIM_TEMPORARY/)
})

test('trigger-only and security-definer helper functions are not publicly executable', () => {
  const sql = read('supabase/migrations/202611230001_initial.sql')
  for (const fn of ['protect_profile_identity', 'write_simk_audit_log', 'set_updated_at']) {
    assert.match(sql, new RegExp(`revoke all on function public\\.${fn}\\(\\) from PUBLIC, anon, authenticated`, 'i'))
  }
  const hardening = read('supabase/migrations/202611230002_security_hardening.sql')
  assert.match(hardening, /revoke all on function public\.validate_exam_confirmation\(\) from PUBLIC, anon, authenticated/i)
})

test('consolidated schema matches the current ordered migration source', () => {
  const combined = read('supabase/schema.sql')
  assert.ok(combined.includes(read('supabase/migrations/202611230001_initial.sql').trim()))
  assert.ok(combined.includes(read('supabase/migrations/202611230002_security_hardening.sql').trim()))
})

test('no production default password or secret value is committed in environment template', () => {
  const env = read('.env.example')
  assert.match(env, /BOOTSTRAP_ADMIN_SECRET=/)
  assert.match(env, /AI_PROVIDER_API_KEY=/)
  assert.doesNotMatch(env, /BOOTSTRAP_ADMIN_SECRET=.{8,}/)
  assert.doesNotMatch(env, /AI_PROVIDER_API_KEY=.{8,}/)
  const bootstrap = read('supabase/functions/bootstrap-admin/index.ts')
  assert.match(bootstrap, /password\.length < 12/)
  assert.match(bootstrap, /Admin utama sudah pernah dibuat/)
})

test('login NIM memverifikasi password lewat Supabase Auth sebelum membaca profil dengan RLS', () => {
  const fn = read('supabase/functions/signin-by-nim/index.ts')
  const authPosition = fn.indexOf('authClient.auth.signInWithPassword')
  const profilePosition = fn.indexOf("from('profiles')")
  assert.ok(authPosition > -1 && profilePosition > authPosition)
  assert.match(fn, /createClient\(url, publishableKey/)
  assert.doesNotMatch(fn, /getSecretKey|SUPABASE_SECRET_KEYS|SERVICE_ROLE/)
  assert.match(fn, /signedInClient\.from\('students'\)/)
  assert.match(fn, /genericAuthError/)
})

test('OCR Tesseract menginisialisasi bahasa Indonesia dan Inggris sebagai array pada API multi-language', () => {
  const roster = read('src/lib/roster.ts')
  assert.equal((roster.match(/createWorker\(\['ind', 'eng'\]\)/g) ?? []).length, 3)
  assert.doesNotMatch(roster, /createWorker\('ind\+eng'\)/)
})


test('declaration file matches the ESM .mjs roster parser and obsolete declaration is removed', () => {
  assert.ok(fs.existsSync(path.join(root, 'src/lib/roster-parser.d.mts')))
  assert.ok(!fs.existsSync(path.join(root, 'src/lib/roster-parser.d.ts')))
  const declaration = read('src/lib/roster-parser.d.mts')
  assert.match(declaration, /parseRosterRows\(text: string\): ParsedRosterRow\[\]/)
})

test('PBKDF2 salt is copied to an ArrayBuffer-backed BufferSource for Web Crypto', () => {
  const storage = read('src/lib/storage.ts')
  assert.match(storage, /const saltBuffer = new ArrayBuffer\(salt\.byteLength\)/)
  assert.match(storage, /salt: saltBuffer/)
  assert.doesNotMatch(storage, /salt, iterations\s*\}/)
})

test('AI reads contextual data through the caller JWT and therefore the caller RLS policies', () => {
  const fn = read('supabase/functions/ai-assistant/index.ts')
  assert.match(fn, /buildContext\(userClient, profile, moduleKey\)/)
  assert.doesNotMatch(fn, /buildContext\(adminClient, profile, moduleKey\)/)
})

test('frontend packages include fixed versions for the known Vite and jsPDF security issues', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.devDependencies.vite, '7.3.8')
  assert.equal(pkg.dependencies.jspdf, '4.2.1')
  assert.equal(pkg.devDependencies['@vitejs/plugin-react'], '5.1.4')
})

test('npm install-script policy permits only the required esbuild binary installer and blocks donation-only postinstall hooks', () => {
  const pkg = JSON.parse(read('package.json'))
  assert.equal(pkg.allowScripts['esbuild@0.28.2'], true)
  assert.equal(pkg.devDependencies.esbuild, '0.28.2')
  assert.equal(pkg.allowScripts['core-js'], false)
  assert.equal(pkg.allowScripts['tesseract.js'], false)
  assert.equal(pkg.allowScripts['*'], undefined)
})

test('one-click Windows launcher creates/validates lockfile and checks before server start', () => {
  const launcher = read('MULAI_SIMK.bat')
  const helper = read('scripts/prepare-and-check.bat')
  for (const marker of ['prepare-and-check.bat', 'npm.cmd run dev', '127.0.0.1:5173', 'open-browser-when-ready.mjs']) {
    assert.ok(launcher.includes(marker), `Missing launcher marker: ${marker}`)
  }
  for (const marker of ['npm.cmd install --package-lock-only', 'npm.cmd ci --include=dev --ignore-scripts', 'npm.cmd rebuild esbuild@0.28.2', 'node node_modules\\esbuild\\bin\\esbuild --version', 'install-state.mjs check', 'install-state.mjs mark', 'npm.cmd test', 'npm.cmd run typecheck', 'npm.cmd run build', 'verify-lockfile.mjs']) {
    assert.ok(helper.includes(marker), `Missing setup command: ${marker}`)
  }
  assert.doesNotMatch(helper, /npm\.cmd (?:approve-scripts|install-scripts)/)
  assert.match(helper, /npm\.cmd ci --include=dev --ignore-scripts/)
  assert.match(read('.npmrc'), /package-lock=true/)
  assert.match(helper, /PEMERIKSAAN GAGAL/)
})

test('hanya satu peluncur utama dan server Vite dibatasi ke loopback 127.0.0.1', () => {
  const vite = read('vite.config.ts')
  assert.ok(fs.existsSync(path.join(root, 'MULAI_SIMK.bat')))
  assert.ok(!fs.existsSync(path.join(root, 'START_SIMK.bat')))
  assert.ok(!fs.existsSync(path.join(root, 'APPLY_UPDATE.bat')))
  assert.match(vite, /host: '127\.0\.0\.1'/)
})


test('draft roster approval consolidates lecturer rows and prevents duplicate semesters/courses', () => {
  const app = read('src/App.tsx')
  assert.match(app, /validateAndGroupRoster\(draft\.rows/)
  assert.match(app, /semester dengan nama atau tahun akademik/i)
  assert.match(app, /Jadwal bertabrakan dengan ruang atau dosen/)
  assert.match(app, /mata kuliah tidak dapat dihapus karena sudah memiliki presensi/i)
})

test('new roster selection clears previous preview and disables save while scanning', () => {
  const app = read('src/App.tsx')
  assert.match(app, /setDraftName\(f\.name\);setRows\(\[\]\);setText\(''\);setSourceInfo\(''\);setIsScanning\(true\)/)
  assert.match(app, /disabled=\{!rows\.length\|\|isScanning\}/)
})

test('local data upgrade adds source warnings without overwriting an Admin-corrected name', () => {
  const storage = read('src/lib/storage.ts')
  assert.match(storage, /student\.name === source\.name && !student\.note/)
  assert.match(storage, /note: source\.note/)
})


test('unverified student source rows cannot stay logged in through an old local session', () => {
  const app = read('src/App.tsx')
  assert.match(app, /user\?\.active && !user\.note/)
  assert.match(app, /!user\.active \|\| user\.note/)
  assert.match(app, /Identitas akun ini sedang menunggu verifikasi Admin/)
})


test('Windows helper installs devDependencies from a valid lockfile and verifies local TypeScript', () => {
  const helper = read('scripts/prepare-and-check.bat')
  assert.match(helper, /npm\.cmd ci --include=dev --ignore-scripts/i)
  assert.match(helper, /node_modules\\typescript\\bin\\tsc/i)
  assert.match(helper, /npm\.cmd run typecheck/i)
  assert.match(helper, /npm\.cmd install --package-lock-only/i)
  assert.match(helper, /:invalid_existing_lock[\s\S]*package-lock.invalid.backup.json[\s\S]*goto create_lock/i)
  assert.match(helper, /:create_lock[\s\S]*npm\.cmd install --package-lock-only/i)
})


test('npm install policy pins only esbuild 0.28.2 and rebuilds only that binary after scripts are disabled', () => {
  const pkg = JSON.parse(read('package.json'))
  const helper = read('scripts/prepare-and-check.bat')
  assert.equal(pkg.allowScripts['esbuild@0.28.2'], true)
  assert.equal(pkg.allowScripts['core-js'], false)
  assert.equal(pkg.allowScripts['tesseract.js'], false)
  assert.match(helper, /npm\.cmd ci --include=dev --ignore-scripts/)
  assert.match(helper, /npm\.cmd rebuild esbuild/)
  assert.match(helper, /NPM_MAJOR% LSS 11/)
  assert.doesNotMatch(helper, /approve-scripts --all|dangerously-allow-all-scripts/i)
})

test('dev server mengikuti host loopback dari vite.config dan tidak override ke localhost', () => {
  const pkg = JSON.parse(read('package.json'))
  const vite = read('vite.config.ts')
  assert.equal(pkg.scripts.dev, 'vite')
  assert.equal(pkg.scripts.preview, 'vite preview')
  assert.match(vite, /host: '127\.0\.0\.1'/)
  assert.match(vite, /strictPort: true/)
})
