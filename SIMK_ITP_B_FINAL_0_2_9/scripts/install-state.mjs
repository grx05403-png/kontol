import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const manifestPath = path.join(root, 'package.json')
const lockPath = path.join(root, 'package-lock.json')
const nodeModules = path.join(root, 'node_modules')
const markerPath = path.join(nodeModules, '.simk-install-state.json')

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

function currentState() {
  const manifest = readJson(manifestPath)
  const lockRaw = fs.readFileSync(lockPath)
  const lock = readJson(lockPath)
  return {
    manifest,
    lock,
    digest: crypto.createHash('sha256').update(lockRaw).digest('hex'),
  }
}

function missingOrWrongPackages(manifest) {
  const problems = []
  for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    for (const [name, expected] of Object.entries(manifest[section] || {})) {
      const packageJson = path.join(nodeModules, ...name.split('/'), 'package.json')
      if (!fs.existsSync(packageJson)) {
        problems.push(`${name} tidak ditemukan di node_modules`)
        continue
      }
      try {
        const installed = readJson(packageJson)
        if (installed.version !== expected) problems.push(`${name} terpasang ${installed.version}, seharusnya ${expected}`)
      } catch {
        problems.push(`package.json ${name} tidak dapat dibaca`)
      }
    }
  }
  return problems
}

const action = process.argv[2]
if (!['check', 'mark'].includes(action)) {
  console.error('Gunakan: node scripts/install-state.mjs check|mark')
  process.exit(2)
}

try {
  if (!fs.existsSync(lockPath)) throw new Error('package-lock.json belum tersedia')
  const { manifest, digest } = currentState()
  const packageProblems = missingOrWrongPackages(manifest)
  if (packageProblems.length) throw new Error(packageProblems.join('; '))

  if (action === 'check') {
    if (!fs.existsSync(markerPath)) throw new Error('Penanda instalasi belum ada; dependency perlu diselaraskan')
    const marker = readJson(markerPath)
    if (marker.lockSha256 !== digest || marker.projectVersion !== manifest.version) {
      throw new Error('Lockfile berubah sejak instalasi terakhir; dependency perlu dipasang ulang')
    }
    console.log('Dependency lokal cocok dengan package.json dan package-lock.json.')
    process.exit(0)
  }

  if (action === 'mark') {
    fs.writeFileSync(markerPath, JSON.stringify({ projectVersion: manifest.version, lockSha256: digest, recordedAt: new Date().toISOString() }, null, 2) + '\n')
    console.log('Status instalasi lokal berhasil dicatat.')
    process.exit(0)
  }
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
