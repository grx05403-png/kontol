import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8')

test('install state hanya ditandai setelah verifikasi dependency dan lockfile', () => {
  const state = read('scripts/install-state.mjs')
  assert.match(state, /lockSha256/)
  assert.match(state, /missingOrWrongPackages/)
  assert.match(state, /action === 'check'/)
  assert.match(state, /action === 'mark'/)
})

test('launcher memeriksa esbuild dan status instalasi sebelum melewati instalasi bersih', () => {
  const helper = read('scripts/prepare-and-check.bat')
  assert.match(helper, /node node_modules\\esbuild\\bin\\esbuild --version/)
  assert.match(helper, /install-state\.mjs check/)
  assert.match(helper, /install-state\.mjs mark/)
})


test('install-state menandai dependency yang sesuai lock dan mendeteksi lockfile yang berubah', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'simk-install-state-'))
  try {
    fs.mkdirSync(path.join(temp, 'scripts'), { recursive: true })
    fs.copyFileSync(path.join(root, 'scripts/install-state.mjs'), path.join(temp, 'scripts/install-state.mjs'))
    const manifest = {
      name: 'simk-fixture', version: '1.0.0',
      dependencies: { react: '19.1.1' },
      devDependencies: { typescript: '5.9.2', vite: '7.3.8', esbuild: '0.28.2' },
    }
    fs.writeFileSync(path.join(temp, 'package.json'), JSON.stringify(manifest))
    const packages = {
      '': { name: manifest.name, version: manifest.version, dependencies: manifest.dependencies, devDependencies: manifest.devDependencies },
      'node_modules/react': { version: '19.1.1' },
      'node_modules/typescript': { version: '5.9.2' },
      'node_modules/vite': { version: '7.3.8' },
      'node_modules/esbuild': { version: '0.28.2' },
    }
    const lockPath = path.join(temp, 'package-lock.json')
    fs.writeFileSync(lockPath, JSON.stringify({ name: manifest.name, version: manifest.version, lockfileVersion: 3, packages }))
    for (const [name, version] of [['react','19.1.1'], ['typescript','5.9.2'], ['vite','7.3.8'], ['esbuild','0.28.2']]) {
      const dir = path.join(temp, 'node_modules', name)
      fs.mkdirSync(dir, { recursive: true })
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name, version }))
    }
    const run = (action) => spawnSync(process.execPath, ['scripts/install-state.mjs', action], { cwd: temp, encoding: 'utf8' })
    assert.equal(run('mark').status, 0)
    assert.equal(run('check').status, 0)
    const changed = JSON.parse(fs.readFileSync(lockPath, 'utf8'))
    changed.version = '1.0.1'
    fs.writeFileSync(lockPath, JSON.stringify(changed))
    assert.notEqual(run('check').status, 0)
  } finally {
    fs.rmSync(temp, { recursive: true, force: true })
  }
})
