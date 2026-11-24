import type { AppData, Student } from '../types'

export const ADMIN_NIM = 'Q1A126065'

const rawStudents: Array<[string, string]> = [
  ['Q1A126041', 'ANDI ALIF INZANIAL DZAKWAN'],
  ['Q1A126042', 'ANDINI DESYA PUTRI'],
  ['Q1A126043', 'ARIEL REZKY PRATAMA'],
  ['Q1A126044', 'ARYA DWI PANGGA'],
  ['Q1A126045', 'ARYO BANYUBIRU24'],
  ['Q1A126046', 'ASRUL ANSI SABARA'],
  ['Q1A126047', 'EGI ANDIKA NURYADIN'],
  ['Q1A126048', 'ERIKA FEBRIANI'],
  ['Q1A126049', 'FARIS DAWLAH NASIR'],
  ['Q1A126050', 'GIAT ALFARIZI'],
  ['Q1A126051', 'JIHAN NURAFIFAH'],
  ['Q1A126052', 'LA ODE MUH. HASRAT. H'],
  ['Q1A126053', 'LISMINA JULIYANA ODE'],
  ['Q1A126054', 'MASIANI ALFIN'],
  ['Q1A126055', 'MUH ARBAINI ALFATHA'],
  ['Q1A126056', 'MUHAMMAD ABDILLAH HADARUL'],
  ['Q1A126057', 'MUHAMMAD KENZIE SULTAN'],
  ['Q1A126058', 'MUHAMMAD ZOULTAN FAHREZI'],
  ['Q1A126059', 'NADIAH FATHINA AINIYAH AZMI'],
  ['Q1A126060', 'NAILA IRENE YUSNADI'],
  ['Q1A126061', 'NARISYA ZAHRATUN NADIRA SYAM KADIR'],
  ['Q1A126062', 'NISBA BERKAH ABADI'],
  ['Q1A126063', 'NUR AZIZAH MUBARAQ'],
  ['Q1A126064', 'NURFAIDA GITA LESTARI'],
  ['Q1A126065', 'RAMAN DZULFITRA'],
  ['Q1A126066', 'RESTIKA SARI'],
  ['Q1A126067', 'SALMAN ALFARIZI'],
  ['Q1A126068', 'SALWA RIZQULLAH'],
  ['Q1A126069', 'SARMILA AULIA FUTRI'],
  ['Q1A126070', 'SELPI SELPI'],
  ['Q1A126071', 'SITTI SELA YUNIARSI'],
  ['Q1A126072', 'SYANIA DWI ZAFIRA'],
  ['Q1A126073', 'TANTI NADA'],
  ['Q1A126074', 'VINA CANDRAWATI'],
  ['Q1A126075', 'WA ODE SITTI HAJRA'],
  ['Q1A126076', 'WAODE FETRA'],
  ['Q1A126077', 'YUNANDA'],
  ['Q1A126078', 'ZAITUN AMALIAH'],
]

export const seedStudents: Student[] = rawStudents.map(([nim, name]) => ({
  nim, name, role: nim === ADMIN_NIM ? 'ADMIN' : 'STUDENT', active: true,
  needsPasswordChange: true, sourceNo: Number(nim.slice(-3)),
  note: nim === 'Q1A126045'
    ? 'Periksa ejaan nama pada daftar sumber; jangan diubah tanpa konfirmasi.'
    : nim === 'Q1A126051'
      ? 'Periksa nama lengkap berdasarkan daftar resmi; teks pada foto sumber belum cukup jelas untuk memastikan seluruh nama.'
      : undefined,
}))

export const initialData: AppData = {
  students: seedStudents,
  semesters: [],
  courses: [],
  attendance: [],
  exams: [],
  assignments: [],
  announcements: [],
  leaves: [],
  messages: [],
  rosterDrafts: [],
}
