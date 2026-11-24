import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export function validatePackageLock(manifest, lock) {
  const problems = []
  if (!lock || lock.lockfileVersion !== 3) problems.push('lockfileVersion harus 3 (npm modern).')
  const packages = lock?.packages
  if (!packages || typeof packages !== 'object') problems.push('Bagian packages tidak ditemukan.')
  const root = packages?.['']
  if (!root) problems.push('Metadata root package tidak ditemukan.')
  if (lock?.name !== manifest.name) problems.push('Nama project dalam lockfile tidak cocok.')
  if (lock?.version !== manifest.version) problems.push('Versi project dalam lockfile tidak cocok.')
  if (root?.name !== manifest.name || root?.version !== manifest.version) problems.push('Metadata root packages tidak cocok dengan package.json.')

  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    const expected = manifest[section] || {}
    const actual = root?.[section] || {}
    for (const [name, version] of Object.entries(expected)) {
      if (actual[name] !== version) problems.push(`${section}.${name} tidak sinkron (${actual[name] ?? 'hilang'} vs ${version}).`)
      const entry = packages?.[`node_modules/${name}`]
      if (!entry) problems.push(`Paket langsung ${name} tidak tercatat di lockfile.`)
      if (entry && entry.version !== version) problems.push(`Versi ${name} dalam lockfile (${entry.version}) tidak sama dengan manifest (${version}).`)
    }
    for (const name of Object.keys(actual)) {
      if (!(name in expected)) problems.push(`Paket ekstra ${name} tercatat pada ${section} lockfile.`)
    }
  }

  if (!packages?.['node_modules/typescript']) problems.push('TypeScript tidak terkunci; compiler bisa kembali tidak ditemukan.')
  if (!packages?.['node_modules/vite']) problems.push('Vite tidak terkunci.')
  if (!packages?.['node_modules/esbuild']) problems.push('esbuild tidak terkunci; binary bundler Vite tidak tersedia.')
  if (packages?.['node_modules/esbuild']?.version !== '0.28.2') problems.push('esbuild harus dipin pada versi 0.28.2 yang disetujui.')
  if (Object.keys(packages || {}).length < 20) problems.push('Pohon dependency lockfile terlihat tidak lengkap.')
  return problems
}

function main() {
  const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const manifestPath = path.join(rootDir, 'package.json')
  const lockPath = path.join(rootDir, 'package-lock.json')
  if (!fs.existsSync(manifestPath) || !fs.existsSync(lockPath)) {
    console.error('ERROR: package.json atau package-lock.json tidak ditemukan di folder proyek.')
    process.exit(1)
  }
  let manifest, lock
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
    lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'))
  } catch (error) {
    console.error(`ERROR: JSON manifest/lockfile tidak valid: ${error.message}`)
    process.exit(1)
  }
  const problems = validatePackageLock(manifest, lock)
  if (problems.length) {
    console.error('LOCKFILE TIDAK VALID:')
    for (const problem of problems) console.error(`- ${problem}`)
    process.exit(1)
  }
  console.log(`Lockfile valid: ${Object.keys(lock.packages).length - 1} paket tercatat; TypeScript ${lock.packages['node_modules/typescript'].version}; Vite ${lock.packages['node_modules/vite'].version}; esbuild ${lock.packages['node_modules/esbuild'].version}.`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
