export type Role = 'ADMIN' | 'STUDENT'
export type AttendanceStatus = 'H' | 'I' | 'S' | 'A' | '?'
export type Student = { nim: string; name: string; role: Role; active: boolean; needsPasswordChange: boolean; sourceNo?: number; note?: string }
export type Semester = { id: string; name: string; academicYear: string; type: 'Ganjil' | 'Genap'; active: boolean; archived: boolean }
export type Course = { id: string; semesterId: string; code: string; name: string; sks: number | null; lecturers: string[]; day: string; start: string; end: string; room: string }
export type AttendanceRow = { nim: string; courseId: string; date: string; meeting: number; lecturer: string; status: AttendanceStatus }
export type Exam = { id: string; course: string; type: 'UTS' | 'UAS'; date: string; deadline: string; yes: string[]; no: string[] }
export type Assignment = { id: string; title: string; course: string; lecturer: string; deadline: string; detail: string }
export type Announcement = { id: string; title: string; body: string; date: string; type: string }
export type LeaveRequest = { id: string; nim: string; course: string; date: string; reason: string; status: 'Menunggu' | 'Disetujui' | 'Ditolak' }
export type ChatMessage = { id: string; nim: string; sender: 'student' | 'admin'; text: string; time: string }
export type RosterDraft = { id: string; semesterId: string; fileName: string; createdAt: string; sourceArchiveId?: string; rows: Array<{ course: string; lecturer: string; day: string; start: string; end: string; room: string; confidence: 'Tinggi' | 'Perlu cek'; source: string }>; status: 'Draft' | 'Disetujui' | 'Dibatalkan' }
export type AppUser = { nim: string; name: string; role: Role }
export type AppData = {
  students: Student[]; semesters: Semester[]; courses: Course[]; attendance: AttendanceRow[]; exams: Exam[];
  assignments: Assignment[]; announcements: Announcement[]; leaves: LeaveRequest[]; messages: ChatMessage[]; rosterDrafts: RosterDraft[]
}
