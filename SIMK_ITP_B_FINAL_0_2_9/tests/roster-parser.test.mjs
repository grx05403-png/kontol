import test from 'node:test'
import assert from 'node:assert/strict'
import { parseRosterRows } from '../src/lib/roster-parser.mjs'

test('extracts explicit fields from a pipe-separated roster row', () => {
  const rows = parseRosterRows('KIMIA DASAR | Dr. A B | Senin | 08:00 - 09:40 | D5.2.03')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].course, 'KIMIA DASAR')
  assert.equal(rows[0].lecturer, 'Dr. A B')
  assert.equal(rows[0].day, 'Senin')
  assert.equal(rows[0].start, '08:00')
  assert.equal(rows[0].end, '09:40')
  assert.equal(rows[0].room, 'D5.2.03')
  assert.equal(rows[0].confidence, 'Tinggi')
})

test('does not invent lecturer or room when the source line omits them', () => {
  const rows = parseRosterRows('PENGANTAR PANGAN Senin 13:30 - 15:10')
  assert.equal(rows.length, 1)
  assert.equal(rows[0].lecturer, 'Perlu dikonfirmasi')
  assert.equal(rows[0].room, 'Belum terbaca')
  assert.equal(rows[0].confidence, 'Perlu cek')
})

test('rejects invalid clock times and end times before start times', () => {
  assert.equal(parseRosterRows('KIMIA | Dr A | Senin | 27:30 - 29:00 | D1').length, 0)
  assert.equal(parseRosterRows('KIMIA | Dr A | Senin | 10:00 - 09:00 | D1').length, 0)
})

test('ignores lines without a weekday and explicit time range', () => {
  assert.equal(parseRosterRows('Daftar mata kuliah semester ganjil').length, 0)
  assert.equal(parseRosterRows('Kamis akan diinformasikan kemudian').length, 0)
})
