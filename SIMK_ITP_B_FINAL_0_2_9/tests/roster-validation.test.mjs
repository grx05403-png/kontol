import test from 'node:test'
import assert from 'node:assert/strict'
import { validateAndGroupRoster } from '../src/lib/roster-validation.mjs'

const row = (overrides = {}) => ({
  course: 'KIMIA DASAR', lecturer: 'Dr. A', day: 'Senin',
  start: '08:00', end: '09:40', room: 'D5.2.03', ...overrides,
})

test('menggabungkan beberapa dosen untuk mata kuliah dan jadwal yang sama', () => {
  const result = validateAndGroupRoster([
    row({ lecturer: 'Dr. A' }),
    row({ lecturer: 'Dr. B' }),
  ])
  assert.equal(result.ok, true)
  assert.equal(result.courses.length, 1)
  assert.deepEqual(result.courses[0].lecturers, ['Dr. A', 'Dr. B'])
})

test('tidak membuat dosen atau ruang ketika sumber tidak menyebutkannya', () => {
  const result = validateAndGroupRoster([
    row({ lecturer: 'Perlu dikonfirmasi', room: 'Belum terbaca' }),
  ])
  assert.equal(result.ok, true)
  assert.deepEqual(result.courses[0].lecturers, [])
  assert.equal(result.courses[0].room, '')
})

test('menolak baris identik yang terduplikasi', () => {
  const result = validateAndGroupRoster([row(), row()])
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.includes('identik')))
})

test('menolak nama dosen identik yang ditulis dua kali dalam satu sel', () => {
  const result = validateAndGroupRoster([row({ lecturer: 'Dr. A; dr. a' })])
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.includes('dosen yang sama tercantum lebih dari sekali')))
})

test('menolak mata kuliah yang sama pada jam yang sama tetapi ruang berbeda', () => {
  const result = validateAndGroupRoster([row(), row({ lecturer: 'Dr. B', room: 'D5.2.04' })])
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.includes('dua ruang berbeda')))
})

test('menolak bentrok ruang dan bentrok dosen antar mata kuliah', () => {
  const roomConflict = validateAndGroupRoster([row(), row({ course: 'FISIKA DASAR', lecturer: 'Dr. B' })])
  assert.equal(roomConflict.ok, false)
  assert.ok(roomConflict.errors.some((error) => error.includes('Konflik ruang')))

  const lecturerConflict = validateAndGroupRoster([
    row(), row({ course: 'FISIKA DASAR', lecturer: 'Dr. A', room: 'D5.2.04' }),
  ])
  assert.equal(lecturerConflict.ok, false)
  assert.ok(lecturerConflict.errors.some((error) => error.includes('Konflik dosen')))
})

test('menolak jadwal invalid dan hari yang tidak dikenal', () => {
  const result = validateAndGroupRoster([row({ start: '8:00' }), row({ course: 'FISIKA', day: 'SeninX' })])
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.includes('format HH:mm')))
  assert.ok(result.errors.some((error) => error.includes('hari tidak dikenali')))
})

test('menolak duplikasi terhadap mata kuliah semester yang sudah ada', () => {
  const result = validateAndGroupRoster([row()], [{ name: 'Kimia Dasar', day: 'Senin', start: '08:00', end: '09:40', room: 'D5.2.03', lecturers: ['Dr. A'] }])
  assert.equal(result.ok, false)
  assert.ok(result.errors.some((error) => error.includes('sudah terdaftar')))
})
