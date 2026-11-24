import { jsPDF } from 'jspdf'
import type { AppData } from '../types'

export function exportStudentsCsv(data: AppData) {
  const rows = [['No', 'NIM', 'Nama Lengkap', 'Role', 'Status'], ...data.students.map((s, i) => [String(s.sourceNo ?? i + 1), s.nim, s.name, s.role, s.active ? 'Aktif' : 'Nonaktif'])]
  const csv = '\uFEFF' + rows.map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(';')).join('\n')
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'data-mahasiswa-itp-b.csv')
}

export function buildLecturerReport(data: AppData, courseName: string, lecturer: string): { blob: Blob; name: string } {
  const doc = new jsPDF()
  const matchingCourse = data.courses.find((c) => c.name === courseName)
  const rows = data.attendance.filter((a) => a.courseId === matchingCourse?.id && a.lecturer === lecturer)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('LAPORAN PERKULIAHAN', 18, 22)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text('SIMK ITP B — Ilmu dan Teknologi Pangan B', 18, 30)
  doc.text(`Mata kuliah: ${courseName}`, 18, 42)
  doc.text(`Dosen: ${lecturer}`, 18, 49)
  doc.text('Catatan: laporan ini dibuat dari data demo/lokal dan perlu diverifikasi sebelum digunakan secara resmi.', 18, 58, { maxWidth: 175 })
  let y = 72
  doc.setFont('helvetica', 'bold')
  doc.text('NIM', 18, y); doc.text('Nama', 53, y); doc.text('Pertemuan', 145, y); doc.text('Status', 178, y)
  y += 7
  doc.setFont('helvetica', 'normal')
  rows.forEach((row) => {
    if (y > 275) { doc.addPage(); y = 20 }
    const student = data.students.find((s) => s.nim === row.nim)
    doc.text(row.nim, 18, y)
    doc.text((student?.name || 'Nama tidak ditemukan').slice(0, 35), 53, y)
    doc.text(`${row.meeting} • ${row.date}`, 145, y)
    doc.text(row.status, 178, y)
    y += 7
  })
  const name = `laporan-${courseName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`
  return { blob: doc.output('blob'), name }
}

export function exportLecturerReport(data: AppData, courseName: string, lecturer: string) {
  const file = buildLecturerReport(data, courseName, lecturer)
  downloadBlob(file.blob, file.name)
  return file
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url; anchor.download = name; anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1500)
}
