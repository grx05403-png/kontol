const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']

const clean = (value) => String(value ?? '').trim().replace(/\s+/g, ' ')
const key = (value) => clean(value).normalize('NFKC').toLocaleLowerCase('id-ID')
const timeMinutes = (value) => {
  const match = clean(value).match(/^([01]\d|2[0-3]):([0-5]\d)$/)
  return match ? Number(match[1]) * 60 + Number(match[2]) : -1
}
const cleanLecturer = (value) => {
  const normalized = clean(value)
  return !normalized || ['perlu dikonfirmasi', 'belum terbaca', 'tidak diketahui'].includes(key(normalized))
    ? ''
    : normalized
}
const cleanRoom = (value) => {
  const normalized = clean(value)
  return !normalized || ['belum terbaca', 'tidak diketahui'].includes(key(normalized)) ? '' : normalized
}

/**
 * Validate a roster draft and consolidate repeated course/time rows into one course
 * offering with multiple lecturers. Does not mutate inputs or invent missing fields.
 */
export function validateAndGroupRoster(rows, existingCourses = []) {
  const errors = []
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, errors: ['Draft roster tidak memiliki baris.'], courses: [] }
  }

  const grouped = new Map()
  const rawSeen = new Set()

  for (const [index, sourceRow] of rows.entries()) {
    const row = {
      course: clean(sourceRow?.course),
      lecturer: cleanLecturer(sourceRow?.lecturer),
      day: clean(sourceRow?.day),
      start: clean(sourceRow?.start),
      end: clean(sourceRow?.end),
      room: cleanRoom(sourceRow?.room),
    }
    const lecturerNames = row.lecturer
      ? row.lecturer.split(/[;\n]/).map(cleanLecturer).filter(Boolean)
      : []
    const rowLabel = `Baris ${index + 1} (${row.course || 'mata kuliah tidak diketahui'})`
    const canonicalDay = DAYS.find((day) => key(day) === key(row.day))
    const start = timeMinutes(row.start)
    const end = timeMinutes(row.end)

    if (!row.course) errors.push(`${rowLabel}: nama mata kuliah wajib diisi.`)
    if (!canonicalDay) errors.push(`${rowLabel}: hari tidak dikenali.`)
    if (start < 0 || end < 0 || end <= start) errors.push(`${rowLabel}: jam harus berformat HH:mm dan jam selesai harus setelah jam mulai.`)
    if (!row.course || !canonicalDay || start < 0 || end < 0 || end <= start) continue

    row.day = canonicalDay
    const rawKey = [key(row.course), key(row.day), row.start, row.end, key(row.room), lecturerNames.map(key).sort().join(';')].join('|')
    if (rawSeen.has(rawKey)) {
      errors.push(`${rowLabel}: baris identik terdeteksi lebih dari satu kali.`)
      continue
    }
    rawSeen.add(rawKey)

    const groupKey = [key(row.course), key(row.day), row.start, row.end].join('|')
    const existingGroup = grouped.get(groupKey)
    if (!existingGroup) {
      const withinRowKeys = lecturerNames.map(key)
      if (new Set(withinRowKeys).size !== withinRowKeys.length) {
        errors.push(`${rowLabel}: nama dosen yang sama tercantum lebih dari sekali.`)
        continue
      }
      grouped.set(groupKey, {
        course: row.course,
        day: row.day,
        start: row.start,
        end: row.end,
        room: row.room,
        lecturers: lecturerNames,
      })
      continue
    }

    if (existingGroup.room && row.room && key(existingGroup.room) !== key(row.room)) {
      errors.push(`${rowLabel}: mata kuliah dan jam yang sama tercatat pada dua ruang berbeda (${existingGroup.room} dan ${row.room}).`)
      continue
    }
    if (!existingGroup.room && row.room) existingGroup.room = row.room

    for (const lecturerName of lecturerNames) {
      if (existingGroup.lecturers.some((lecturer) => key(lecturer) === key(lecturerName))) {
        errors.push(`${rowLabel}: dosen ${lecturerName} tercatat ganda pada jadwal yang sama.`)
      } else {
        existingGroup.lecturers.push(lecturerName)
      }
    }
  }

  const courses = [...grouped.values()]
  const overlaps = (a, b) => timeMinutes(a.start) < timeMinutes(b.end) && timeMinutes(b.start) < timeMinutes(a.end)

  for (let i = 0; i < courses.length; i += 1) {
    for (let j = i + 1; j < courses.length; j += 1) {
      const a = courses[i]
      const b = courses[j]
      if (a.day !== b.day || !overlaps(a, b)) continue
      if (a.room && b.room && key(a.room) === key(b.room)) {
        errors.push(`Konflik ruang ${a.room}: ${a.course} bertabrakan dengan ${b.course}.`)
      }
      const sharedLecturer = a.lecturers.find((lecturer) => b.lecturers.some((other) => key(other) === key(lecturer)))
      if (sharedLecturer) errors.push(`Konflik dosen ${sharedLecturer}: ${a.course} bertabrakan dengan ${b.course}.`)
    }
  }

  for (const row of courses) {
    for (const existing of existingCourses) {
      if (key(row.course) === key(existing.name) && row.day === existing.day && row.start === existing.start && row.end === existing.end) {
        errors.push(`${row.course}: jadwal yang sama sudah terdaftar pada semester ini. Periksa apakah ini pembaruan roster.`)
        continue
      }
      if (row.day !== existing.day || !overlaps(row, existing)) continue
      if (row.room && existing.room && key(row.room) === key(existing.room)) {
        errors.push(`Konflik ruang ${row.room}: ${row.course} bertabrakan dengan ${existing.name}.`)
      }
      const sharedLecturer = row.lecturers.find((lecturer) => (existing.lecturers || []).some((other) => key(other) === key(lecturer)))
      if (sharedLecturer) errors.push(`Konflik dosen ${sharedLecturer}: ${row.course} bertabrakan dengan ${existing.name}.`)
    }
  }

  return { ok: errors.length === 0, errors: [...new Set(errors)], courses }
}
