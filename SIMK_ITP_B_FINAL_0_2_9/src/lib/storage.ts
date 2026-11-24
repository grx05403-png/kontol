import { initialData } from '../data/seed'
import type { AppData } from '../types'

const DATA_KEY = 'simk-itpb-data-v2'
const SESSION_KEY = 'simk-itpb-session-v2'
const PASSWORD_KEY = 'simk-itpb-password-hashes-v2'

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(DATA_KEY)
    if (!raw) return structuredClone(initialData)
    const parsed = JSON.parse(raw) as Partial<AppData>
    const base = structuredClone(initialData)
    const arrayKeys: Array<keyof AppData> = ['students','semesters','courses','attendance','exams','assignments','announcements','leaves','messages','rosterDrafts']
    for (const key of arrayKeys) {
      const value = parsed[key]
      if (!Array.isArray(value)) continue
      ;(base[key] as unknown[]) = value
    }
    // Add new source-verification warnings to existing local demo records only
    // when the stored name still exactly matches the imported source name.
    // This avoids overriding a name the local Admin has already corrected.
    const sourceStudents = new Map(initialData.students.map((student) => [student.nim, student]))
    base.students = base.students.map((student) => {
      const source = sourceStudents.get(student.nim)
      return source?.note && student.name === source.name && !student.note
        ? { ...student, note: source.note }
        : student
    })
    return base
  } catch {
    return structuredClone(initialData)
  }
}

export function saveData(data: AppData): boolean {
  try { localStorage.setItem(DATA_KEY, JSON.stringify(data)); return true }
  catch { return false }
}

export function loadSession(): string | null {
  try { return sessionStorage.getItem(SESSION_KEY) } catch { return null }
}

export function saveSession(nim: string | null) {
  try { if (nim) sessionStorage.setItem(SESSION_KEY, nim); else sessionStorage.removeItem(SESSION_KEY) } catch { /* Browser session persistence is optional in local demo mode. */ }
}

const PBKDF2_ITERATIONS = 310_000
const toBase64 = (bytes: Uint8Array) => btoa(Array.from(bytes, (value) => String.fromCharCode(value)).join(''))
const fromBase64 = (value: string) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0))

async function derivePasswordBits(value: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(value),
    'PBKDF2',
    false,
    ['deriveBits'],
  )

  // TypeScript's DOM declarations require an ArrayBuffer-backed BufferSource.
  // Copy the bytes so this also works with Uint8Array<ArrayBufferLike> inputs.
  const saltBuffer = new ArrayBuffer(salt.byteLength)
  new Uint8Array(saltBuffer).set(salt)

  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: saltBuffer, iterations },
    material,
    256,
  )
  return new Uint8Array(derived)
}

export async function hashPassword(value: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const digest = await derivePasswordBits(value, salt, PBKDF2_ITERATIONS)
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toBase64(salt)}$${toBase64(digest)}`
}

export async function verifyPassword(value: string, encoded: string): Promise<boolean> {
  if (!encoded.startsWith('pbkdf2$')) {
    // Compatibility only for browser-demo passwords created by the earlier SHA-256 prototype.
    const legacyDigest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
    const legacyHex = Array.from(new Uint8Array(legacyDigest)).map((x) => x.toString(16).padStart(2, '0')).join('')
    return legacyHex === encoded
  }
  const [, iterationsText, saltText, hashText] = encoded.split('$')
  const iterations = Number(iterationsText)
  if (!Number.isInteger(iterations) || iterations < 100_000 || iterations > 1_000_000 || !saltText || !hashText) return false
  try {
    const expected = fromBase64(hashText)
    const actual = await derivePasswordBits(value, fromBase64(saltText), iterations)
    if (expected.length !== actual.length) return false
    let difference = 0
    for (let index = 0; index < expected.length; index += 1) difference |= expected[index] ^ actual[index]
    return difference === 0
  } catch {
    return false
  }
}

export function getPasswordHashes(): Record<string, string> {
  try { const value = JSON.parse(localStorage.getItem(PASSWORD_KEY) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, string> : {} }
  catch { return {} }
}

export function setPasswordHash(nim: string, hash: string): boolean {
  try { localStorage.setItem(PASSWORD_KEY, JSON.stringify({ ...getPasswordHashes(), [nim]: hash })); return true } catch { return false }
}

export function resetDemo() {
  try {
    localStorage.removeItem(DATA_KEY)
    localStorage.removeItem(PASSWORD_KEY)
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // A browser may block storage in private/restricted contexts.
  }
}
