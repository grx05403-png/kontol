import test from 'node:test'
import assert from 'node:assert/strict'
import { validatePackageLock } from '../scripts/verify-lockfile.mjs'

const manifest = {
  name: 'simk-itp-b',
  version: '0.2.9',
  dependencies: { react: '19.1.1' },
  devDependencies: { typescript: '5.9.2', vite: '7.3.8', esbuild: '0.28.2' },
}
const validLock = {
  name: 'simk-itp-b',
  version: '0.2.9',
  lockfileVersion: 3,
  packages: {
    '': {
      name: 'simk-itp-b', version: '0.2.9',
      dependencies: { react: '19.1.1' },
      devDependencies: { typescript: '5.9.2', vite: '7.3.8', esbuild: '0.28.2' },
    },
    'node_modules/react': { version: '19.1.1' },
    'node_modules/typescript': { version: '5.9.2' },
    'node_modules/vite': { version: '7.3.8' },
    'node_modules/esbuild': { version: '0.28.2' },
    'node_modules/@types/react': { version: '19.1.12' },
    'node_modules/rollup': { version: '4.0.0' },
    'node_modules/postcss': { version: '8.0.0' },
    'node_modules/picocolors': { version: '1.0.0' },
    'node_modules/nanoid': { version: '3.0.0' },
    'node_modules/source-map-js': { version: '1.0.0' },
    'node_modules/fsevents': { version: '2.0.0', optional: true },
    'node_modules/@esbuild/win32-x64': { version: '0.28.2', optional: true },
    'node_modules/@esbuild/linux-x64': { version: '0.28.2', optional: true },
    'node_modules/@esbuild/darwin-arm64': { version: '0.28.2', optional: true },
    'node_modules/@rollup/rollup-win32-x64-msvc': { version: '4.0.0', optional: true },
    'node_modules/@rollup/rollup-linux-x64-gnu': { version: '4.0.0', optional: true },
    'node_modules/@rollup/rollup-darwin-arm64': { version: '4.0.0', optional: true },
    'node_modules/@types/estree': { version: '1.0.0' },
    'node_modules/csstype': { version: '3.0.0' },
    'node_modules/undici-types': { version: '6.0.0' },
    'node_modules/debug': { version: '4.0.0' },
  },
}

test('menerima package-lock v3 yang sinkron dan memiliki TypeScript, Vite, serta esbuild', () => {
  assert.deepEqual(validatePackageLock(manifest, validLock), [])
})

test('menolak lockfile yang belum mengunci TypeScript, Vite, atau esbuild', () => {
  const broken = structuredClone(validLock)
  delete broken.packages['node_modules/typescript']
  const errors = validatePackageLock(manifest, broken)
  assert.ok(errors.some((message) => message.includes('TypeScript tidak terkunci')))
  const noEsbuild = structuredClone(validLock)
  delete noEsbuild.packages['node_modules/esbuild']
  assert.ok(validatePackageLock(manifest, noEsbuild).some((message) => message.includes('esbuild tidak terkunci')))
})

test('menolak package-lock yang tidak sinkron dengan package.json', () => {
  const broken = structuredClone(validLock)
  broken.packages['node_modules/vite'].version = '7.3.7'
  const errors = validatePackageLock(manifest, broken)
  assert.ok(errors.some((message) => message.includes('Versi vite dalam lockfile')))
})

test('menolak lockfile dengan versi format yang salah', () => {
  const broken = structuredClone(validLock)
  broken.lockfileVersion = 1
  const errors = validatePackageLock(manifest, broken)
  assert.ok(errors.some((message) => message.includes('lockfileVersion harus 3')))
})
