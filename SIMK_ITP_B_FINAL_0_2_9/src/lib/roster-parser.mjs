const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
const TIME_RANGE = /(\d{1,2}[:.]\d{2})\s*(?:-|–|—|sampai|to)\s*(\d{1,2}[:.]\d{2})/i

function normalizeTime(value) {
  const [hours, minutes] = value.replace('.', ':').split(':').map(Number)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return ''
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/**
 * Conservative roster parser. It only extracts fields that can be matched in a source line.
 * Unknown lecturer/room fields are left as review placeholders instead of guessed values.
 */
export function parseRosterRows(text) {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const rows = []

  for (const line of lines) {
    const day = DAYS.find((item) => new RegExp(`\\b${item}\\b`, 'i').test(line))
    const timeMatch = line.match(TIME_RANGE)
    if (!day || !timeMatch) continue

    const separators = line.split(/\s*\|\s*/).map((part) => part.trim()).filter(Boolean)
    const beforeTime = line.slice(0, timeMatch.index).trim().replace(/[|,;\-–—]+$/, '').trim()
    const afterTime = line.slice((timeMatch.index ?? 0) + timeMatch[0].length).trim().replace(/^[|,;\-–—]+/, '').trim()
    const course = separators.length >= 2
      ? separators[0]
      : beforeTime.replace(new RegExp(`\\b${day}\\b`, 'i'), '').trim()
    const lecturer = separators.length >= 4 ? separators[1] : 'Perlu dikonfirmasi'
    const room = afterTime || (separators.length >= 3 ? separators[separators.length - 1] : '') || 'Belum terbaca'
    const start = normalizeTime(timeMatch[1])
    const end = normalizeTime(timeMatch[2])
    if (!course || !start || !end || end <= start) continue

    rows.push({
      course,
      lecturer,
      day,
      start,
      end,
      room,
      confidence: separators.length >= 4 && lecturer !== 'Perlu dikonfirmasi' && room !== 'Belum terbaca' ? 'Tinggi' : 'Perlu cek',
      source: line,
    })
  }

  return rows
}
