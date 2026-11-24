import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Activity, AlertCircle, Pencil, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, BookOpen, CalendarDays, Check,
  CheckCircle2, ChevronDown, ChevronRight, CircleHelp, ClipboardCheck, ClipboardList, Clock3, Database,
  Download, FileCheck2, FileClock, FileInput, FilePlus2, FileSpreadsheet, FileText, Filter, GraduationCap,
  LayoutDashboard, LogOut, Mail, Menu, MessageCircle, MessageSquare, Plus, Search, Send, Settings,
  ShieldCheck, Sparkles, Trash2, UploadCloud, User, UserRound, Users, X, XCircle, Zap,
} from 'lucide-react'
import { ADMIN_NIM, initialData } from './data/seed'
import type { AppData, AppUser, AttendanceStatus, Course, LeaveRequest, RosterDraft, Student } from './types'
import { getPasswordHashes, hashPassword, verifyPassword, loadData, loadSession, resetDemo, saveData, saveSession, setPasswordHash } from './lib/storage'
import { extractPdf, extractRosterImage, extractAttendanceImage, parseRosterRows } from './lib/roster'
import { validateAndGroupRoster } from './lib/roster-validation.mjs'
import { archiveSourceFile, clearArchivedSources, downloadArchivedSource } from './lib/archive'
import { buildLecturerReport, exportLecturerReport, exportStudentsCsv } from './lib/export'
import { usePageAnimations } from './lib/usePageAnimations'

const nowLocal = new Date()
const today = `${nowLocal.getFullYear()}-${String(nowLocal.getMonth() + 1).padStart(2, '0')}-${String(nowLocal.getDate()).padStart(2, '0')}`
const dateLabel = (value: string) => value ? new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`)) : 'Belum ditentukan'
const statusLabel: Record<AttendanceStatus, string> = { H: 'Hadir', I: 'Izin', S: 'Sakit', A: 'Alpa', '?': 'Belum dicatat' }
const initials = (name: string) => name.split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase()

const adminNav = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'UTAMA' },
  { id: 'students', label: 'Data Mahasiswa', icon: Users, group: 'DATA AKADEMIK' },
  { id: 'semester', label: 'Semester', icon: CalendarDays, group: 'DATA AKADEMIK' },
  { id: 'roster', label: 'Impor Roster', icon: FileInput, group: 'DATA AKADEMIK' },
  { id: 'academic', label: 'Mata Kuliah & Jadwal', icon: BookOpen, group: 'AKADEMIK' },
  { id: 'attendance', label: 'Presensi', icon: ClipboardCheck, group: 'AKADEMIK' },
  { id: 'exams', label: 'UTS / UAS', icon: GraduationCap, group: 'AKADEMIK' },
  { id: 'assignments', label: 'Tugas', icon: ClipboardList, group: 'AKADEMIK' },
  { id: 'announcements', label: 'Pengumuman', icon: Bell, group: 'KOMUNIKASI' },
  { id: 'calendar', label: 'Kalender', icon: CalendarDays, group: 'KOMUNIKASI' },
  { id: 'leaves', label: 'Pengajuan Izin', icon: FileClock, group: 'KOMUNIKASI' },
  { id: 'messages', label: 'Pesan Mahasiswa', icon: MessageSquare, group: 'KOMUNIKASI' },
  { id: 'assistant', label: 'Pusat AI', icon: Sparkles, group: 'INTELIJEN KELAS' },
  { id: 'reports', label: 'Laporan PDF', icon: FileText, group: 'INTELIJEN KELAS' },
  { id: 'settings', label: 'Pengaturan', icon: Settings, group: 'SISTEM' },
]
const studentNav = [
  { id: 'dashboard', label: 'Beranda', icon: LayoutDashboard, group: 'MENU' },
  { id: 'academic', label: 'Jadwal Kuliah', icon: BookOpen, group: 'AKADEMIK' },
  { id: 'attendance', label: 'Presensi Saya', icon: ClipboardCheck, group: 'AKADEMIK' },
  { id: 'exams', label: 'UTS / UAS', icon: GraduationCap, group: 'AKADEMIK' },
  { id: 'assignments', label: 'Tugas', icon: ClipboardList, group: 'AKADEMIK' },
  { id: 'announcements', label: 'Pengumuman', icon: Bell, group: 'INFORMASI' },
  { id: 'calendar', label: 'Kalender', icon: CalendarDays, group: 'INFORMASI' },
  { id: 'leaves', label: 'Ajukan Izin', icon: FileClock, group: 'LAYANAN' },
  { id: 'messages', label: 'Pesan Admin', icon: MessageSquare, group: 'LAYANAN' },
  { id: 'assistant', label: 'Asisten Belajar', icon: Sparkles, group: 'LAYANAN' },
]

function App() {
  const [data, setData] = useState<AppData>(() => loadData())
  const [userNim, setUserNim] = useState<string | null>(() => loadSession())
  const [page, setPage] = useState('dashboard')
  const [mobileMenu, setMobileMenu] = useState(false)
  const [toast, setToast] = useState('')
  const [passwordChangeFor, setPasswordChangeFor] = useState<string | null>(null)
  const [loginError, setLoginError] = useState('')
  const scope = useRef<HTMLDivElement>(null)
  const user = data.students.find((s) => s.nim === userNim)
  const userActive = user?.active
  const userNeedsPasswordChange = user?.needsPasswordChange
  const userNeedsVerification = user?.note
  const currentUser: AppUser | null = user?.active && !user.note ? { nim: user.nim, name: user.name, role: user.nim === ADMIN_NIM ? 'ADMIN' : 'STUDENT' } : null
  const isAdmin = currentUser?.role === 'ADMIN'

  useEffect(() => {
    if (!saveData(data)) setToast('Penyimpanan browser penuh atau tidak tersedia. Unduh backup dan kurangi ukuran file lokal.')
  }, [data])
  useEffect(() => {
    if (userNim && (!user || !user.active || user.note)) {
      if (user?.note) setLoginError('Identitas akun ini sedang menunggu verifikasi Admin. Silakan hubungi Ketua Tingkat.')
      setUserNim(null); saveSession(null); return
    }
    if (userNim && user && (user.needsPasswordChange || !getPasswordHashes()[userNim])) {
      setPasswordChangeFor(userNim)
    }
  }, [userNim, userActive, userNeedsPasswordChange, userNeedsVerification])
  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 3200)
    return () => window.clearTimeout(timer)
  }, [toast])
  usePageAnimations(scope, page)

  const updateData = (updater: (prev: AppData) => AppData) => setData((prev) => updater(prev))
  const notify = (message: string) => setToast(message)

  async function handleLogin(fullName: string, identity: string, password: string) {
    setLoginError('')
    const clean = identity.trim().toUpperCase()
    const normalizedName = fullName.trim().replace(/\s+/g, ' ').toLocaleUpperCase('id-ID')
    const found = data.students.find((s) => s.nim.toUpperCase() === clean && s.name.trim().replace(/\s+/g, ' ').toLocaleUpperCase('id-ID') === normalizedName)
    if (!found || !found.active) { setLoginError('Nama lengkap dan NIM tidak cocok, akun tidak ditemukan, atau akun dinonaktifkan.'); return }
    if (found.note) { setLoginError('Data identitas pada daftar sumber masih perlu diverifikasi Admin sebelum akun dapat digunakan.'); return }
    const hashes = getPasswordHashes()
    const savedHash = hashes[found.nim]
    const valid = savedHash ? await verifyPassword(password, savedHash) : password === found.nim
    if (!valid) { setLoginError('Kata sandi tidak sesuai. Untuk akun demo awal, gunakan NIM sebagai kata sandi.'); return }
    setUserNim(found.nim); saveSession(found.nim); setPage('dashboard')
    if (!savedHash || found.needsPasswordChange) setPasswordChangeFor(found.nim)
  }

  async function changePassword(newPassword: string) {
    if (!passwordChangeFor) return
    if (newPassword.length < 8) { notify('Kata sandi minimal 8 karakter.'); return }
    const saved = setPasswordHash(passwordChangeFor, await hashPassword(newPassword))
    if (!saved) { notify('Kata sandi demo tidak dapat disimpan di browser ini. Periksa ruang penyimpanan dan coba lagi.'); return }
    updateData((prev) => ({ ...prev, students: prev.students.map((s) => s.nim === passwordChangeFor ? { ...s, needsPasswordChange: false } : s) }))
    setPasswordChangeFor(null)
    notify('Kata sandi demo berhasil diperbarui pada browser ini.')
  }

  function logout() { setUserNim(null); saveSession(null); setPage('dashboard'); setMobileMenu(false) }
  function navigate(id: string) { setPage(id); setMobileMenu(false) }

  if (!currentUser) return <LoginScreen onLogin={handleLogin} error={loginError} />

  const visibleNav = isAdmin ? adminNav : studentNav
  const activeItem = visibleNav.find((item) => item.id === page) || visibleNav[0]

  return (
    <div className="app-shell" ref={scope}>
      <div className={`mobile-scrim ${mobileMenu ? 'visible' : ''}`} onClick={() => setMobileMenu(false)} />
      <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><span>SIMK</span><i /></div>
          <div><strong>SIMK ITP B</strong><small>Ruang digital kelas</small></div>
          <button className="icon-button sidebar-close" onClick={() => setMobileMenu(false)} aria-label="Tutup menu"><X size={18}/></button>
        </div>
        <div className="workspace-chip"><span className="online-dot"/> <span>ITP B · Angkatan 26</span><ChevronDown size={14}/></div>
        <nav className="side-nav">
          {Array.from(new Set(visibleNav.map((item) => item.group))).map((group) => (
            <div className="nav-group" key={group}>
              <div className="nav-label">{group}</div>
              {visibleNav.filter((item) => item.group === group).map((item) => {
                const Icon = item.icon
                return <button key={item.id} className={`nav-link ${page === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}>
                  <Icon size={17} strokeWidth={1.8}/><span>{item.label}</span>
                  {item.id === 'leaves' && isAdmin && data.leaves.some((l) => l.status === 'Menunggu') && <i className="nav-count"/>}
                </button>
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><div className="help-icon"><Sparkles size={15}/></div><strong>Butuh bantuan?</strong><p>Asisten kelas siap membantu merangkum informasi.</p><button onClick={() => navigate('assistant')}>Buka asisten <ArrowRight size={13}/></button></div>
          <div className="profile-mini"><div className="avatar">{initials(currentUser.name)}</div><div className="profile-copy"><strong>{currentUser.name}</strong><span>{isAdmin ? 'Admin · Ketua Tingkat' : 'Mahasiswa ITP B'}</span></div><button className="icon-button" onClick={logout} title="Keluar"><LogOut size={16}/></button></div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left"><button className="icon-button mobile-menu-btn" onClick={() => setMobileMenu(true)}><Menu size={20}/></button><div className="breadcrumb">SIMK ITP B <ChevronRight size={14}/> <span>{activeItem.label}</span></div></div>
          <div className="topbar-actions"><div className="date-pill"><CalendarDays size={14}/>{new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</div><button className="icon-button notification-button" onClick={() => navigate('announcements')} title="Pengumuman"><Bell size={18}/><i/></button><div className="avatar avatar-small">{initials(currentUser.name)}</div></div>
        </header>
        <div className="page-wrap">
          <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-line"/> SISTEM INFORMASI MANAJEMEN KELAS</div><h1 className="gsap-title-target">{activeItem.label.split(' ').map((word, index) => <span className="gsap-word" key={`${word}-${index}`}>{word}{index < activeItem.label.split(' ').length - 1 ? ' ' : ''}</span>)}</h1><p>{pageDescription(page, isAdmin)}</p></div><div className="heading-actions"><span className="demo-indicator"><span/> MODE DEMO LOKAL</span></div></div>
          <PageContent page={page} user={currentUser} data={data} updateData={updateData} notify={notify} onNavigate={navigate} />
          <footer className="footer"><span>© 2026 SIMK ITP B</span><span>Dibuat untuk Kelas B · Ilmu dan Teknologi Pangan</span><span className="footer-status"><i/> Sistem demo aktif</span></footer>
        </div>
      </main>
      <AnimatePresence>{toast && <motion.div className="toast" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}><CheckCircle2 size={17}/>{toast}</motion.div>}</AnimatePresence>
      <AnimatePresence>{passwordChangeFor && <PasswordModal name={data.students.find((s) => s.nim === passwordChangeFor)?.name || 'Pengguna'} onSave={changePassword} />}</AnimatePresence>
    </div>
  )
}

function pageDescription(page: string, admin: boolean) {
  const descriptions: Record<string, string> = {
    dashboard: admin ? 'Ringkasan aktivitas, informasi terbaru, dan kontrol kelas dalam satu tempat.' : 'Lihat agenda perkuliahan dan informasi kelasmu hari ini.',
    students: 'Kelola identitas dan status akun mahasiswa yang terdaftar.', semester: 'Atur semester aktif dan simpan arsip akademik secara terpisah.',
    roster: 'Unggah roster PDF, periksa hasil ekstraksi, lalu setujui data jadwal.', academic: 'Kelola mata kuliah, dosen pengampu, dan jadwal perkuliahan.',
    attendance: 'Catat kehadiran dan pantau rekap presensi sesuai hak akses.', exams: 'Kelola jadwal ujian dan konfirmasi keikutsertaan mahasiswa.',
    assignments: 'Pantau tugas dan tenggat waktu perkuliahan.', announcements: 'Informasi dan perubahan terbaru untuk seluruh kelas.',
    calendar: 'Agenda kuliah, ujian, tugas, dan kegiatan kelas.', leaves: 'Ajukan izin atau tinjau permohonan mahasiswa.',
    messages: 'Percakapan pribadi mahasiswa dengan Ketua Tingkat.', assistant: 'AI pembantu untuk administrasi dan pendamping belajar.',
    reports: 'Susun dan unduh laporan per dosen dan mata kuliah.', settings: 'Atur profil, data demo, dan kesiapan integrasi aplikasi.',
  }
  return descriptions[page] || ''
}

function LoginScreen({ onLogin, error }: { onLogin: (fullName: string, identity: string, password: string) => void; error: string }) {
  const [fullName, setFullName] = useState('RAMAN DZULFITRA')
  const [identity, setIdentity] = useState(ADMIN_NIM)
  const [password, setPassword] = useState(ADMIN_NIM)
  const [showPassword, setShowPassword] = useState(false)
  return (
    <div className="login-screen">
      <div className="login-art">
        <div className="art-grid" />
        <div className="art-orbit orbit-one" />
        <div className="art-orbit orbit-two" />
        <div className="login-art-content">
          <div className="brand-lockup brand-light">
            <div className="brand-mark"><span>SIMK</span><i /></div>
            <div><strong>SIMK ITP B</strong><small>Ruang digital kelas</small></div>
          </div>
          <div className="login-manifesto">
            <span className="hero-kicker">ONE CLASS · ONE SPACE</span>
            <h1>Kelola kelas.<br /><em>Lebih teratur.</em><br />Lebih hidup.</h1>
            <p>Satu ruang untuk jadwal, presensi, informasi, dan kolaborasi mahasiswa Ilmu dan Teknologi Pangan B.</p>
            <div className="mini-showcase">
              <div className="mini-showcase-top"><span>Karya pilihan</span><span className="mini-dots">•••</span></div>
              <div className="mini-grid">
                <div className="mini-card blue"><div className="mini-shape circle" /><small>Akademik</small></div>
                <div className="mini-card pale"><div className="mini-shape triangle" /><small>Presensi</small></div>
                <div className="mini-card dark"><div className="mini-lines"><i /><i /><i /></div><small>Informasi</small></div>
                <div className="mini-card sky"><div className="mini-shape circle" /><small>Kalender</small></div>
                <div className="mini-card lavender"><div className="mini-shape triangle" /><small>Asisten AI</small></div>
                <div className="mini-card cobalt"><div className="mini-lines"><i /><i /><i /></div><small>Laporan</small></div>
              </div>
              <div className="motion-tags"><span><b>1</b> GSAP</span><span><b>2</b> Motion</span><span><b>3</b> Lenis</span></div>
            </div>
          </div>
        </div>
        <div className="login-art-bottom"><span>Ilmu dan Teknologi Pangan · UHO</span><span>DESIGNED FOR CLASS B</span></div>
      </div>
      <div className="login-panel">
        <div className="login-box">
          <div className="login-mobile-brand"><div className="brand-mark"><span>SIMK</span><i /></div><strong>SIMK ITP B</strong></div>
          <div className="login-welcome">
            <span className="eyebrow"><span className="eyebrow-line" /> SELAMAT DATANG</span>
            <h2>Masuk ke<br /><span>ruang kelasmu.</span></h2>
            <p>Masukkan nama lengkap, NIM, dan kata sandi akun kelas.</p>
          </div>
          <form onSubmit={(e) => { e.preventDefault(); onLogin(fullName, identity, password) }} className="login-form">
            <label>Nama lengkap</label>
            <div className="input-wrap"><UserRound size={17} /><input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Sesuai daftar mahasiswa" autoComplete="name" required /></div>
            <label>NIM</label>
            <div className="input-wrap"><UserRound size={17} /><input value={identity} onChange={(e) => setIdentity(e.target.value)} placeholder="Masukkan NIM" autoComplete="username" required /></div>
            <label>Kata sandi</label>
            <div className="input-wrap"><ShieldCheck size={17} /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Masukkan kata sandi" autoComplete="current-password" /><button type="button" className="show-pass" onClick={() => setShowPassword(!showPassword)}>{showPassword ? 'Sembunyi' : 'Lihat'}</button></div>
            {error && <div className="form-error"><AlertCircle size={15} />{error}</div>}
            <button className="btn btn-primary login-submit" type="submit">Masuk ke SIMK <ArrowRight size={17} /></button>
          </form>
          <div className="login-demo-note"><AlertCircle size={16} /><div><strong>Akses demo lokal</strong><p>Admin: Q1A126065 · Password awal: NIM yang sama. Mahasiswa demo: gunakan NIM masing-masing sebagai password awal. Wajib diganti saat masuk pertama kali.</p></div></div>
          <p className="login-footnote">Data demo tersimpan di browser perangkat ini. Jangan masukkan data sensitif asli sebelum backend dan keamanan produksi diaktifkan.</p>
        </div>
      </div>
    </div>
  )
}

function PasswordModal({ name, onSave }: { name: string; onSave: (value: string) => void }) {
  const [value, setValue] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><motion.div className="modal-card password-modal" initial={{ y: 22, scale: .98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 18, opacity: 0 }}><div className="modal-icon"><ShieldCheck size={22}/></div><h2>Perbarui kata sandi</h2><p>Hai {name}, untuk keamanan mode demo, ganti kata sandi awal yang masih menggunakan NIM.</p><label>Kata sandi baru</label><input className="field" type="password" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Minimal 8 karakter"/><label>Ulangi kata sandi</label><input className="field" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Ketik ulang kata sandi"/>{error && <div className="form-error">{error}</div>}<div className="modal-actions"><button className="btn btn-primary" onClick={() => { if (value.length < 8) setError('Minimal 8 karakter.'); else if (value !== confirm) setError('Kata sandi belum sama.'); else onSave(value) }}>Simpan kata sandi</button></div><small>Ini hanya proteksi demo browser, bukan pengganti autentikasi backend produksi.</small></motion.div></motion.div>
}

function PageContent({ page, user, data, updateData, notify, onNavigate }: { page: string; user: AppUser; data: AppData; updateData: (fn: (prev: AppData) => AppData) => void; notify: (message: string) => void; onNavigate: (page: string) => void }) {
  const admin = user.role === 'ADMIN'
  if (!admin && ['students', 'semester', 'roster', 'reports', 'settings'].includes(page)) return <EmptyState title="Menu ini khusus Admin" text="Akun mahasiswa tidak memiliki izin untuk membuka halaman administrasi." icon={<ShieldCheck/>}/>
  switch (page) {
    case 'dashboard': return <Dashboard data={data} user={user} onNavigate={onNavigate}/>
    case 'students': return <StudentsPage data={data} updateData={updateData} notify={notify}/>
    case 'semester': return <SemesterPage data={data} updateData={updateData} notify={notify}/>
    case 'roster': return <RosterPage data={data} updateData={updateData} notify={notify}/>
    case 'academic': return <AcademicPage data={data} admin={admin} updateData={updateData} notify={notify}/>
    case 'attendance': return <AttendancePage data={data} user={user} admin={admin} updateData={updateData} notify={notify}/>
    case 'exams': return <ExamsPage data={data} user={user} admin={admin} updateData={updateData} notify={notify}/>
    case 'assignments': return <AssignmentsPage data={data} admin={admin} updateData={updateData} notify={notify}/>
    case 'announcements': return <AnnouncementsPage data={data} admin={admin} updateData={updateData} notify={notify}/>
    case 'calendar': return <CalendarPage data={data}/>
    case 'leaves': return <LeavesPage data={data} user={user} admin={admin} updateData={updateData} notify={notify}/>
    case 'messages': return <MessagesPage data={data} user={user} updateData={updateData} notify={notify}/>
    case 'assistant': return <AssistantPage data={data} user={user}/>
    case 'reports': return <ReportsPage data={data}/>
    case 'settings': return <SettingsPage data={data} updateData={updateData} notify={notify}/>
    default: return <Dashboard data={data} user={user} onNavigate={onNavigate}/>
  }
}

function Dashboard({ data, user, onNavigate }: { data: AppData; user: AppUser; onNavigate: (page: string) => void }) {
  const mine = data.attendance.filter((a) => a.nim === user.nim)
  const present = mine.filter((a) => a.status === 'H').length
  const upcoming = data.assignments.slice().sort((a, b) => a.deadline.localeCompare(b.deadline)).slice(0, 3)
  const admin = user.role === 'ADMIN'
  return <div className="page-content">
    <section className="hero-panel gsap-reveal"><div className="hero-copy"><div className="hero-kicker"><span/> {admin ? 'PUSAT KENDALI KELAS' : 'RUANG AKADEMIK PRIBADI'}</div><h2 className="gsap-title-target">{admin ? <><span className="gsap-word">Satu ruang.</span><br/><em className="gsap-word">Banyak hal</em><span className="gsap-word"> jadi</span><br/><span className="gsap-word">lebih terarah.</span></> : <><span className="gsap-word">Halo,</span> <em className="gsap-word">{user.name.split(' ')[0].toLowerCase()}.</em><br/><span className="gsap-word">Siap jalani hari ini?</span></>}</h2><p>{admin ? 'Pantau aktivitas kelas, kelola data akademik, dan biarkan sistem membantu pekerjaan administrasi.' : 'Semua informasi kuliah yang kamu perlukan, tersusun rapi dalam satu ruang.'}</p><div className="hero-actions"><button className="btn btn-light" onClick={() => onNavigate(admin ? 'roster' : 'academic')}>{admin ? 'Mulai kelola data' : 'Lihat jadwal'} <ArrowRight size={16}/></button><button className="hero-text-link" onClick={() => onNavigate('assistant')}><Sparkles size={15}/> Tanya asisten AI</button></div><div className="hero-orbit-dot dot-a"/><div className="hero-orbit-dot dot-b"/></div><div className="hero-art"><div className="hero-art-top"><span>SIMK / CLASS SPACE</span><span>2026 — 2027</span></div><div className="hero-art-window"><div className="window-bar"><i/><i/><i/><span>kelas-itpb / overview</span></div><div className="window-title">Karya kelas</div><div className="window-cards"><div className="window-card card-indigo"><span>01</span><div className="window-circle"/><small>Akademik</small></div><div className="window-card card-blue"><span>02</span><div className="window-triangle"/><small>Presensi</small></div><div className="window-card card-white"><span>03</span><div className="window-lines"><i/><i/><i/></div><small>Informasi</small></div></div><div className="window-progress"><span/><span/><span/></div></div><div className="hero-art-caption"><span><b>GSAP</b> scroll reveal</span><span><b>Motion</b> interaction</span><span><b>Lenis</b> smooth scroll</span></div><div className="hero-sticker">ITP<br/><b>B</b></div></div></section>
    <div className="stats-grid">
      <StatCard icon={<Users/>} label="Mahasiswa terdata" value={String(data.students.length)} helper="38 data awal dari foto" tone="blue"/>
      <StatCard icon={<BookOpen/>} label="Mata kuliah" value={String(data.courses.length)} helper="Data roster semester" tone="purple"/>
      <StatCard icon={<ClipboardCheck/>} label={admin ? 'Catatan presensi' : 'Hadir tercatat'} value={String(admin ? data.attendance.length : present)} helper={admin ? 'Seluruh catatan demo' : 'Pada catatan milikmu'} tone="mint"/>
      <StatCard icon={<FileClock/>} label={admin ? 'Izin menunggu' : 'Izin saya'} value={String(admin ? data.leaves.filter((l) => l.status === 'Menunggu').length : data.leaves.filter((l) => l.nim === user.nim).length)} helper={admin ? 'Perlu ditinjau' : 'Permohonan pribadi'} tone="amber"/>
    </div>
    <div className="dashboard-grid">
      <section className="panel gsap-reveal"><div className="panel-heading"><div><span className="panel-kicker">QUICK ACCESS</span><h3>Akses cepat</h3></div><span className="soft-tag">Pintasan</span></div><div className="quick-grid">
        {(admin ? [['roster','Impor roster',FileInput,'blue'],['students','Mahasiswa',Users,'violet'],['attendance','Presensi',ClipboardCheck,'mint'],['assistant','Pusat AI',Sparkles,'amber']] : [['academic','Jadwal kuliah',BookOpen,'blue'],['attendance','Presensi saya',ClipboardCheck,'mint'],['exams','Konfirmasi ujian',GraduationCap,'violet'],['assistant','Asisten belajar',Sparkles,'amber']]).map(([id, label, Icon, tone]) => { const I = Icon as typeof Users; return <button className="quick-item" key={String(id)} onClick={() => onNavigate(String(id))}><span className={`quick-icon ${tone}`}><I size={19}/></span><span>{String(label)}</span><ArrowUpRight size={14}/></button> })}
      </div></section>
      <section className="panel gsap-reveal"><div className="panel-heading"><div><span className="panel-kicker">LATEST UPDATE</span><h3>Pengumuman terbaru</h3></div><button className="text-button" onClick={() => onNavigate('announcements')}>Lihat semua <ArrowRight size={14}/></button></div><div className="announcement-list">{data.announcements.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,3).map((a) => <div className="announcement-row" key={a.id}><span className="announcement-date">{dateLabel(a.date)}</span><div><strong>{a.title}</strong><p>{a.body}</p></div><ChevronRight size={16}/></div>)}{data.announcements.length === 0 && <EmptyInline text="Belum ada pengumuman."/>}</div></section>
    </div>
    <div className="dashboard-grid dashboard-grid-bottom">
      <section className="panel gsap-reveal"><div className="panel-heading"><div><span className="panel-kicker">UPCOMING</span><h3>Tugas terdekat</h3></div><button className="text-button" onClick={() => onNavigate('assignments')}>Semua tugas <ArrowRight size={14}/></button></div><div className="task-list">{upcoming.map((task, i) => <div className="task-row" key={task.id}><div className={`task-index idx-${i+1}`}>0{i+1}</div><div className="task-info"><strong>{task.title}</strong><span>{task.course}</span></div><div className="task-date"><Clock3 size={13}/>{dateLabel(task.deadline)}</div></div>)}{upcoming.length === 0 && <EmptyInline text="Belum ada tugas."/>}</div></section>
      <section className="panel ai-promo gsap-reveal"><div className="ai-promo-glow"/><div className="ai-icon-large"><Sparkles size={22}/></div><span className="panel-kicker">AI CLASS COMPANION</span><h3>Kerjaan administratif<br/>jadi lebih ringan.</h3><p>Tanya data kelas, ringkas informasi, dan siapkan draf pekerjaan melalui pusat AI.</p><button className="btn btn-dark" onClick={() => onNavigate('assistant')}>Buka pusat AI <ArrowRight size={15}/></button></section>
    </div>
    <div className="tech-signature gsap-reveal"><span>DESIGNED TO MOVE</span><div><b>GSAP</b><i/> Word reveal</div><div><b>Motion</b><i/> Card interactions</div><div><b>Lenis</b><i/> Smooth scrolling</div></div>
  </div>
}

function StatCard({ icon, label, value, helper, tone }: { icon: ReactNode; label: string; value: string; helper: string; tone: string }) {
  return <motion.div className="stat-card" whileHover={{ y: -4, transition: { duration: .2 } }}><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value}</div><div className="stat-helper">{helper}</div><ArrowUpRight className="stat-arrow" size={16}/></motion.div>
}

function StudentsPage({ data, updateData, notify }: { data: AppData; updateData: (fn: (p: AppData) => AppData) => void; notify: (v: string) => void }) {
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [nim, setNim] = useState('')
  const [statusFilter, setStatusFilter] = useState('Semua')
  const filtered = data.students.filter((s) => `${s.name} ${s.nim}`.toLowerCase().includes(search.toLowerCase()) && (statusFilter === 'Semua' || (statusFilter === 'Aktif' ? s.active : !s.active)))
  function addStudent(e: FormEvent) { e.preventDefault(); const id = nim.trim().toUpperCase(); if (!/^Q1A126\d{3}$/.test(id)) { notify('Format NIM belum sesuai. Periksa kembali.'); return }; if (data.students.some((s) => s.nim === id)) { notify('NIM sudah terdaftar.'); return }; if (!name.trim()) { notify('Nama lengkap wajib diisi.'); return }; updateData((p) => ({ ...p, students: [...p.students, { nim: id, name: name.trim().toUpperCase(), role: 'STUDENT', active: true, needsPasswordChange: true }] })); setName(''); setNim(''); setShowAdd(false); notify('Mahasiswa ditambahkan sebagai draft data lokal.') }
  return <div className="page-content"><div className="content-toolbar"><div className="search-field"><Search size={16}/><input placeholder="Cari nama atau NIM…" value={search} onChange={(e)=>setSearch(e.target.value)}/></div><div className="toolbar-actions"><select className="select-field" value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}><option>Semua</option><option>Aktif</option><option>Nonaktif</option></select><button className="btn btn-outline" onClick={()=>exportStudentsCsv(data)}><Download size={15}/> Ekspor CSV</button><button className="btn btn-primary" onClick={()=>setShowAdd(!showAdd)}><Plus size={16}/> Tambah mahasiswa</button></div></div>
    {showAdd && <form className="panel add-form gsap-reveal" onSubmit={addStudent}><div className="panel-heading"><div><span className="panel-kicker">DATA BARU</span><h3>Tambah mahasiswa</h3></div><button type="button" className="icon-button" onClick={()=>setShowAdd(false)}><X size={17}/></button></div><div className="form-grid"><div><label>Nama lengkap</label><input className="field" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Nama sesuai daftar resmi"/></div><div><label>NIM</label><input className="field" value={nim} onChange={(e)=>setNim(e.target.value)} placeholder="Q1A1260XX"/></div></div><div className="form-note"><AlertCircle size={14}/> Akun baru berperan sebagai mahasiswa biasa. Password awal demo mengikuti NIM dan wajib diganti saat login.</div><button className="btn btn-primary" type="submit">Simpan data mahasiswa</button></form>}
    <div className="panel table-panel"><div className="panel-heading"><div><span className="panel-kicker">CLASS DIRECTORY</span><h3>Daftar mahasiswa <span className="count-badge">{filtered.length}</span></h3></div><span className="soft-tag">Data awal nomor 41–78</span></div><div className="table-scroll"><table><thead><tr><th>No.</th><th>Nama mahasiswa</th><th>NIM</th><th>Hak akses</th><th>Status</th><th>Aksi</th></tr></thead><tbody>{filtered.map((s) => <tr key={s.nim}><td className="muted-cell">{s.sourceNo ?? data.students.findIndex((x)=>x.nim===s.nim)+1}</td><td><div className="person-cell"><div className="avatar avatar-table">{initials(s.name)}</div><div><strong>{s.name}</strong>{s.note && <small className="warning-text">Perlu verifikasi nama</small>}</div></div></td><td className="mono-cell">{s.nim}</td><td>{s.nim === ADMIN_NIM ? <span className="role-pill admin">Admin utama</span> : <span className="role-pill">Mahasiswa</span>}</td><td><span className={`status-pill ${s.active?'success':'muted'}`}><i/>{s.active?'Aktif':'Nonaktif'}</span></td><td><div className="table-actions"><button className="icon-button table-action" title="Periksa atau koreksi nama berdasarkan daftar resmi" onClick={()=>{const updated=window.prompt('Nama lengkap sesuai daftar resmi:',s.name);if(updated===null)return;if(!updated.trim()){notify('Nama tidak boleh kosong.');return};updateData(p=>({...p,students:p.students.map(x=>x.nim===s.nim?{...x,name:updated.trim().replace(/\s+/g,' ').toLocaleUpperCase('id-ID'),note:undefined}:x)}));notify('Nama diperbarui pada data demo. Pastikan sesuai dokumen sumber.')}}><Pencil size={15}/></button><button className="icon-button table-action" title={s.nim===ADMIN_NIM?'Admin utama tidak dapat dinonaktifkan':'Ubah status'} disabled={s.nim===ADMIN_NIM} onClick={()=>{updateData(p=>({...p,students:p.students.map(x=>x.nim===s.nim?{...x,active:!x.active}:x)}));notify('Status akun diperbarui di mode demo.')}}>{s.active?<XCircle size={16}/>:<CheckCircle2 size={16}/>}</button></div></td></tr>)}</tbody></table></div><div className="table-foot"><span>Menampilkan {filtered.length} dari {data.students.length} data.</span><span className="foot-warning"><AlertCircle size={14}/> Data nomor 1–40 belum ditambahkan.</span></div></div>
  </div>
}

function SemesterPage({ data, updateData, notify }: { data: AppData; updateData: (p: (d: AppData)=>AppData)=>void; notify:(v:string)=>void }) {
  const [name,setName]=useState(''); const [year,setYear]=useState('2026/2027'); const [type,setType]=useState<'Ganjil'|'Genap'>('Ganjil')
  function create(e:FormEvent){
    e.preventDefault()
    const cleanName=name.trim().replace(/\s+/g,' ')
    const cleanYear=year.trim().replace(/\s+/g,' ')
    if(!cleanName||!cleanYear){notify('Nama semester dan tahun akademik wajib diisi.');return}
    const duplicate=data.semesters.some(s=>s.academicYear.trim().toLocaleLowerCase('id-ID')===cleanYear.toLocaleLowerCase('id-ID')&&s.type===type)
      || data.semesters.some(s=>s.name.trim().toLocaleLowerCase('id-ID')===cleanName.toLocaleLowerCase('id-ID'))
    if(duplicate){notify('Semester dengan nama atau tahun akademik dan jenis yang sama sudah terdaftar. Buka arsip semester yang ada, jangan membuat duplikat.');return}
    const id=crypto.randomUUID()
    updateData(p=>({...p,semesters:p.semesters.map(s=>({...s,active:false,archived:s.active?true:s.archived})).concat([{id,name:cleanName,academicYear:cleanYear,type,active:true,archived:false}])}))
    setName('')
    notify('Semester baru dibuat. Semester aktif sebelumnya dipindahkan ke arsip; data historisnya tetap disimpan.')
  }
  return <div className="page-content"><div className="info-banner"><Database size={18}/><div><strong>Setiap semester berdiri sendiri.</strong><span>Data lama tetap menjadi arsip. Jangan mengimpor roster baru ke semester yang salah.</span></div></div><div className="two-col-layout"><form className="panel form-panel" onSubmit={create}><span className="panel-kicker">NEW SEMESTER</span><h3>Buat semester baru</h3><p className="muted-copy">Semester baru akan menjadi semester aktif dan semester sebelumnya tetap tersimpan.</p><label>Nama semester</label><input className="field" value={name} onChange={e=>setName(e.target.value)} placeholder="Contoh: Semester Genap 2026/2027"/><div className="form-grid"><div><label>Tahun akademik</label><input className="field" value={year} onChange={e=>setYear(e.target.value)}/></div><div><label>Jenis semester</label><select className="field" value={type} onChange={e=>setType(e.target.value as 'Ganjil'|'Genap')}><option>Ganjil</option><option>Genap</option></select></div></div><button className="btn btn-primary" type="submit"><Plus size={16}/> Buat semester</button></form><div className="panel semester-note"><div className="semester-note-icon"><ShieldCheck size={22}/></div><span className="panel-kicker">DATA PROTECTION</span><h3>Arsip tidak tertimpa</h3><p>Setiap data mata kuliah, jadwal, pertemuan, presensi, ujian, dan laporan harus terhubung ke semester masing-masing.</p><div className="note-check"><Check size={15}/> Riwayat lama tetap bisa dibuka</div><div className="note-check"><Check size={15}/> Impor ulang wajib melalui preview</div><div className="note-check"><Check size={15}/> Perubahan dicatat dalam audit log</div></div></div><div className="panel semester-list"><div className="panel-heading"><div><span className="panel-kicker">SEMESTER ARCHIVE</span><h3>Daftar semester</h3></div></div>{data.semesters.map((s)=> <div className="semester-row" key={s.id}><div className="semester-symbol"><CalendarDays size={20}/></div><div className="semester-details"><strong>{s.name}</strong><span>{s.academicYear} · {s.type}</span></div>{s.active?<span className="status-pill success"><i/>Aktif</span>:<span className={`status-pill ${s.archived?'muted':'warning'}`}>{s.archived?'Arsip':'Nonaktif'}</span>}{!s.active&&!s.archived&&<button className="btn btn-small btn-outline" onClick={()=>{updateData(p=>({...p,semesters:p.semesters.map(x=>({...x,active:x.id===s.id,archived:x.id===s.id?false:x.archived}))}));notify('Semester diaktifkan. Semester sebelumnya tetap tersimpan.')}}>Aktifkan</button>}{s.active&&<button className="btn btn-small btn-outline" onClick={()=>{updateData(p=>({...p,semesters:p.semesters.map(x=>x.id===s.id?{...x,active:false,archived:true}:x)}));notify('Semester dipindahkan ke arsip. Data historis tidak dihapus.')}}>Arsipkan</button>}</div>)}</div></div>
}

function RosterPage({ data, updateData, notify }: { data: AppData; updateData:(p:(d:AppData)=>AppData)=>void; notify:(v:string)=>void }) {
  const [file,setFile]=useState<File|null>(null);const [progress,setProgress]=useState('');const [text,setText]=useState('');const [rows,setRows]=useState<RosterDraft['rows']>([]);const [draftName,setDraftName]=useState('');const [isScanning,setIsScanning]=useState(false);const [sourceInfo,setSourceInfo]=useState('')
  async function processFile(f:File){if(f.size>25*1024*1024){notify('Ukuran file melebihi batas demo 25 MB.');return};const isPdf=f.type==='application/pdf'||f.name.toLowerCase().endsWith('.pdf');const isImage=['image/png','image/jpeg','image/webp'].includes(f.type)||/\.(png|jpe?g|webp)$/i.test(f.name);if(!isPdf&&!isImage){notify('Gunakan PDF, PNG, JPG, atau WebP.');return};setFile(f);setDraftName(f.name);setRows([]);setText('');setSourceInfo('');setIsScanning(true);setProgress('Membuka dokumen…');try{const result=isPdf?await extractPdf(f,setProgress):await extractRosterImage(f,setProgress);setText(result.text);setRows(result.rows);setSourceInfo(`${result.pages} halaman · ${result.usedOcr?'OCR':'ekstraksi teks PDF'}`);notify(result.rows.length?`${result.rows.length} baris kandidat terdeteksi. Periksa seluruh kolom dengan dokumen asli.`:'Teks terbaca, tetapi pola jadwal belum terdeteksi. Periksa teks dan koreksi secara manual.')}catch(e){console.error(e);notify('Dokumen gagal dibaca. Coba file lain atau salin teks roster ke kotak manual.')}finally{setIsScanning(false);setProgress('')}}
  function parseManual(){const parsed=parseRosterRows(text);setRows(parsed);setSourceInfo('Ekstraksi dari teks manual');notify(`${parsed.length} baris yang memiliki pola hari dan jam ditemukan.`)}
  function updateRow(i:number,key:'course'|'lecturer'|'day'|'start'|'end'|'room',value:string){setRows(prev=>prev.map((r,index)=>index===i?{...r,[key]:value,confidence:'Perlu cek'}:r))}
  async function saveDraft(){
    const activeSemester=data.semesters.find(s=>s.active&&!s.archived)
    if(!activeSemester){notify('Buat dan aktifkan semester terlebih dahulu sebelum menyimpan draft roster.');return}
    if(!rows.length){notify('Belum ada baris untuk disimpan.');return}
    const draftId=crypto.randomUUID()
    if(file){try{await archiveSourceFile(draftId,file)}catch(error){console.error(error);notify('File asli belum berhasil diarsipkan. Draft tidak disimpan agar sumber tidak hilang.');return}}
    const draft:RosterDraft={id:draftId,semesterId:activeSemester.id,fileName:draftName||'Teks roster manual',createdAt:new Date().toISOString(),sourceArchiveId:file?draftId:undefined,rows:rows.map(row=>({...row})),status:'Draft'}
    updateData(p=>({...p,rosterDrafts:[draft,...p.rosterDrafts]}))
    notify('Draft roster tersimpan untuk semester aktif. Periksa seluruh baris sebelum disetujui.')
  }
  function approveDraft(draft:RosterDraft){
    const targetSemester=data.semesters.find((semester)=>semester.id===draft.semesterId)
    if(!targetSemester){notify('Semester asal draft tidak ditemukan. Draft tidak dapat disetujui.');return}
    if(!data.rosterDrafts.some(item=>item.id===draft.id&&item.status==='Draft')){notify('Draft sudah diproses atau tidak lagi tersedia. Muat ulang data sebelum mengulangi tindakan.');return}
    const validation=validateAndGroupRoster(draft.rows,data.courses.filter(course=>course.semesterId===draft.semesterId))
    if(!validation.ok){notify(`Persetujuan ditahan: ${validation.errors.slice(0,2).join(' ')}${validation.errors.length>2?' Periksa baris lainnya juga.':''}`);return}
    updateData(p=>{
      const additions=validation.courses.map((row,index)=>({
        id:`${draft.id}-${index}`,
        semesterId:draft.semesterId,
        code:'',
        name:row.course,
        sks:null,
        lecturers:row.lecturers,
        day:row.day,
        start:row.start,
        end:row.end,
        room:row.room,
      }))
      return {...p,courses:[...p.courses,...additions],rosterDrafts:p.rosterDrafts.map(item=>item.id===draft.id?{...item,status:'Disetujui'}:item)}
    })
    notify(`Draft disetujui menjadi ${validation.courses.length} jadwal/mata kuliah. Dosen pada baris dengan jadwal sama digabung tanpa membuat nama dosen atau kode/SKS baru.`)
  }


  return <div className="page-content"><div className="info-banner info-amber"><AlertCircle size={18}/><div><strong>Mode impor saat ini adalah demo lokal.</strong><span>Hasil OCR dan jadwal yang disetujui tersimpan di browser ini. Jangan unggah roster berisi data pribadi asli sebelum penyimpanan privat backend dipasang.</span></div></div><div className="roster-layout"><div className="panel upload-panel"><span className="panel-kicker">AI ROSTER IMPORT</span><h3>Unggah roster perkuliahan</h3><p className="muted-copy">Sistem membaca PDF teks dan mencoba OCR pada PDF hasil scan. Semua hasil masuk ke pratinjau terlebih dahulu.</p><label className="upload-drop"><input type="file" disabled={isScanning} accept="application/pdf,.pdf,image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f)void processFile(f)}}/><div className="upload-cloud"><UploadCloud size={25}/></div><strong>{file?file.name:'Klik untuk memilih PDF roster'}</strong><span>PDF atau gambar · teks maupun hasil scan</span><small>File diproses pada browser untuk mode demo.</small></label>{isScanning&&<div className="progress-box"><div className="spinner"/><span>{progress}</span></div>}{sourceInfo&&<div className="extract-meta"><CheckCircle2 size={15}/>{sourceInfo}</div>}<div className="manual-divider"><span>ATAU TEMPEL TEKS ROSTER</span></div><textarea className="field textarea" rows={5} value={text} onChange={e=>setText(e.target.value)} placeholder="Tempel teks hasil salin dari PDF. Pola yang dikenali: nama mata kuliah, dosen, hari, jam mulai–selesai, dan ruang."/><div className="button-row"><button className="btn btn-outline" onClick={parseManual} disabled={isScanning}><FileText size={15}/> Ekstrak teks</button><button className="btn btn-primary" onClick={saveDraft} disabled={!rows.length||isScanning}><FilePlus2 size={15}/> Simpan draft</button></div></div><div className="panel roster-guide"><div className="guide-icon"><Sparkles size={21}/></div><span className="panel-kicker">CARA KERJA</span><h3>AI membantu, Admin memutuskan.</h3><div className="guide-step"><b>01</b><div><strong>Unggah dokumen</strong><span>PDF asli disiapkan untuk diproses.</span></div></div><div className="guide-step"><b>02</b><div><strong>Ekstraksi & pemeriksaan</strong><span>Kolom yang belum jelas diberi tanda.</span></div></div><div className="guide-step"><b>03</b><div><strong>Persetujuan Admin</strong><span>Hanya data yang diperiksa yang masuk ke jadwal demo.</span></div></div><div className="guide-warning"><AlertCircle size={15}/> Parser awal belum memahami semua bentuk tabel PDF. Cocokkan setiap baris dengan dokumen sumber.</div></div></div>
    {rows.length>0&&<div className="panel table-panel roster-preview"><div className="panel-heading"><div><span className="panel-kicker">IMPORT PREVIEW</span><h3>Pratinjau hasil ekstraksi <span className="count-badge">{rows.length}</span></h3></div><span className="role-pill admin">Belum resmi</span></div><div className="table-scroll"><table><thead><tr><th>Mata kuliah</th><th>Dosen</th><th>Hari</th><th>Jam</th><th>Ruang</th><th>Status</th></tr></thead><tbody>{rows.map((r,i)=><tr key={i}><td><input className="table-input" value={r.course} onChange={e=>updateRow(i,'course',e.target.value)}/></td><td><input className="table-input" value={r.lecturer} onChange={e=>updateRow(i,'lecturer',e.target.value)}/></td><td><select className="table-input" value={r.day} onChange={e=>updateRow(i,'day',e.target.value)}>{['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'].map(d=><option key={d}>{d}</option>)}</select></td><td><div className="time-inputs"><input className="table-input" value={r.start} onChange={e=>updateRow(i,'start',e.target.value)}/><span>–</span><input className="table-input" value={r.end} onChange={e=>updateRow(i,'end',e.target.value)}/></div></td><td><input className="table-input" value={r.room} onChange={e=>updateRow(i,'room',e.target.value)}/></td><td><span className={`status-pill ${r.confidence==='Tinggi'?'success':'warning'}`}>{r.confidence}</span></td></tr>)}</tbody></table></div><div className="table-foot"><span>Sumber: {draftName||'Teks manual'}</span><button className="btn btn-primary" onClick={saveDraft} disabled={isScanning}>Simpan sebagai draft</button></div></div>}
    <div className="panel table-panel"><div className="panel-heading"><div><span className="panel-kicker">IMPORT HISTORY</span><h3>Riwayat draft roster</h3></div></div>{data.rosterDrafts.length===0?<EmptyInline text="Belum ada draft roster disimpan."/>:data.rosterDrafts.map(d=><div className="roster-history-row" key={d.id}><div className="roster-file-icon"><FileSpreadsheet size={20}/></div><div className="roster-file-info"><strong>{d.fileName}</strong><span>{new Date(d.createdAt).toLocaleString('id-ID')} · {d.rows.length} baris</span></div><span className={`status-pill ${d.status==='Disetujui'?'success':d.status==='Draft'?'warning':'muted'}`}>{d.status}</span>{d.sourceArchiveId&&<button className="btn btn-small btn-outline" onClick={()=>void downloadArchivedSource(d.sourceArchiveId!).then(ok=>{if(!ok)notify('Arsip file asli tidak ditemukan pada browser ini.')})}><Download size={13}/> Unduh sumber</button>}{d.status==='Draft'&&<button className="btn btn-small btn-primary" onClick={()=>approveDraft(d)}>Setujui</button>}</div>)}</div>
  </div>
}

function AcademicPage({data,admin,updateData,notify}:{data:AppData;admin:boolean;updateData:(p:(d:AppData)=>AppData)=>void;notify:(v:string)=>void}){
  const [showAdd,setShowAdd]=useState(false);const [name,setName]=useState('');const [code,setCode]=useState('');const [lecturer,setLecturer]=useState('');const [day,setDay]=useState('Senin');const [start,setStart]=useState('08:00');const [end,setEnd]=useState('09:40');const [room,setRoom]=useState('');
  function add(e:FormEvent){
    e.preventDefault()
    const activeSemester=data.semesters.find(s=>s.active&&!s.archived)
    if(!activeSemester){notify('Buat semester terlebih dahulu sebelum menambahkan mata kuliah.');return}
    const cleanName=name.trim().replace(/\s+/g,' ')
    const cleanCode=code.trim().toUpperCase()
    if(!cleanName||!cleanCode){notify('Kode dan nama mata kuliah harus diisi.');return}
    if(data.courses.some(c=>c.semesterId===activeSemester.id&&(c.code.toUpperCase()===cleanCode||(c.name.trim().toLocaleLowerCase('id-ID')===cleanName.toLocaleLowerCase('id-ID')&&c.day===day&&c.start===start&&c.end===end)))){notify('Kode atau jadwal mata kuliah yang sama sudah terdaftar pada semester aktif. Periksa data sebelum menambahkan.');return}
    if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(start)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(end)||end<=start){notify('Jam harus valid dalam format HH:mm dan jam selesai harus setelah jam mulai.');return}
    const overlap=data.courses.some(c=>c.semesterId===activeSemester.id&&c.day===day&&start<c.end&&c.start<end&&((room.trim()&&c.room.trim()&&room.trim().toLocaleLowerCase('id-ID')===c.room.trim().toLocaleLowerCase('id-ID'))||(lecturer.trim()&&c.lecturers.some(item=>item.toLocaleLowerCase('id-ID')===lecturer.trim().toLocaleLowerCase('id-ID')))))
    if(overlap){notify('Jadwal bertabrakan dengan ruang atau dosen yang sudah tercatat. Periksa jadwal sebelum menyimpan.');return}
    updateData(p=>({...p,courses:[...p.courses,{id:crypto.randomUUID(),semesterId:activeSemester.id,code:cleanCode,name:cleanName,sks:null,lecturers:lecturer.trim()?[lecturer.trim()]:[],day,start,end,room:room.trim()}]}))
    setShowAdd(false);setName('');setCode('');setLecturer('');notify('Mata kuliah ditambahkan ke semester aktif di data lokal.')
  }
  return <div className="page-content"><div className="content-toolbar"><div className="toolbar-copy"><strong>{data.courses.length} mata kuliah terdaftar</strong><span>Periksa dan lengkapi data hasil roster resmi.</span></div>{admin&&<button className="btn btn-primary" onClick={()=>setShowAdd(!showAdd)}><Plus size={16}/> Tambah mata kuliah</button>}</div>{showAdd&&<form className="panel add-form" onSubmit={add}><div className="panel-heading"><h3>Mata kuliah baru</h3><button type="button" className="icon-button" onClick={()=>setShowAdd(false)}><X size={16}/></button></div><div className="form-grid three"><div><label>Kode mata kuliah</label><input className="field" value={code} onChange={e=>setCode(e.target.value)} placeholder="Kode"/></div><div><label>Nama mata kuliah</label><input className="field" value={name} onChange={e=>setName(e.target.value)} placeholder="Nama mata kuliah"/></div><div><label>Nama dosen</label><input className="field" value={lecturer} onChange={e=>setLecturer(e.target.value)} placeholder="Dosen pengampu"/></div><div><label>Hari</label><select className="field" value={day} onChange={e=>setDay(e.target.value)}>{['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'].map(d=><option key={d}>{d}</option>)}</select></div><div><label>Jam mulai</label><input className="field" type="time" value={start} onChange={e=>setStart(e.target.value)}/></div><div><label>Jam selesai</label><input className="field" type="time" value={end} onChange={e=>setEnd(e.target.value)}/></div><div><label>Ruang</label><input className="field" value={room} onChange={e=>setRoom(e.target.value)} placeholder="Ruang kelas"/></div></div><button className="btn btn-primary">Simpan mata kuliah</button></form>}
  <div className="course-grid">{data.courses.map((c,i)=><motion.div className="course-card" key={c.id} initial={{opacity:0,y:15}} animate={{opacity:1,y:0}} transition={{delay:i*.04}} whileHover={{y:-4}}><div className={`course-color color-${i%4}`}><span>{c.code||'KODE BELUM ADA'}</span><BookOpen size={24}/></div><div className="course-card-content"><div className="course-meta"><span>{c.day}</span><span>{c.start} – {c.end}</span></div><div className="course-meta"><span>{data.semesters.find(s=>s.id===c.semesterId)?.name || 'Semester belum diketahui'}</span></div><h3>{c.name}</h3><div className="course-lecturer"><UserRound size={14}/>{c.lecturers.length?c.lecturers.join(', '):'Dosen belum dikonfirmasi'}</div><div className="course-room"><span><CalendarDays size={13}/>{c.room||'Ruang belum tercantum'}</span><span>{c.sks?`${c.sks} SKS`:'SKS belum diisi'}</span></div>{admin&&<button className="course-delete" onClick={()=>{
      const hasAttendance=data.attendance.some(a=>a.courseId===c.id)
      const hasExam=data.exams.some(item=>item.course===c.name)
      const hasAssignment=data.assignments.some(item=>item.course===c.name)
      if(hasAttendance||hasExam||hasAssignment){notify('Mata kuliah tidak dapat dihapus karena sudah memiliki presensi, ujian, atau tugas. Pertahankan sebagai arsip agar riwayat tidak hilang.');return}
      if(!window.confirm(`Hapus mata kuliah ${c.name}? Tindakan ini hanya untuk data lokal yang belum memiliki riwayat.`))return
      updateData(p=>({...p,courses:p.courses.filter(x=>x.id!==c.id)}));notify('Mata kuliah tanpa riwayat dihapus dari data lokal.')
    }} title="Hapus hanya jika belum memiliki riwayat"><Trash2 size={15}/></button>}</div></motion.div>)}</div><div className="info-banner info-amber"><AlertCircle size={18}/><div><strong>Jadwal yang terlihat masih data contoh atau hasil impor lokal.</strong><span>Masukkan roster resmi dan periksa nama dosen, hari, jam, serta ruang sebelum menggunakan informasi ini.</span></div></div></div>
}

function AttendancePage({data,user,admin,updateData,notify}:{data:AppData;user:AppUser;admin:boolean;updateData:(p:(d:AppData)=>AppData)=>void;notify:(v:string)=>void}){
  const [courseId,setCourseId]=useState(data.courses[0]?.id||'');const [date,setDate]=useState(today);const [meeting,setMeeting]=useState('1');const [lecturer,setLecturer]=useState('');const [search,setSearch]=useState('');
  const course=data.courses.find(c=>c.id===courseId);const rows=data.attendance.filter(a=>a.courseId===courseId&&(admin?(a.date===date&&a.meeting===Number(meeting)):a.nim===user.nim)).filter(a=>{const s=data.students.find(x=>x.nim===a.nim);return !search||`${s?.name} ${a.nim}`.toLowerCase().includes(search.toLowerCase())});
  const courseLecturer=course?.lecturers.length===1?course.lecturers[0]:course?.lecturers.length>1?'Pilih dosen aktual (jangan diasumsikan)':'Dosen belum dikonfirmasi';
  const [ocrText,setOcrText]=useState('');const [ocrProgress,setOcrProgress]=useState('');
  async function scanAttendance(file:File){setOcrProgress('Memulai OCR…');try{const value=await extractAttendanceImage(file,setOcrProgress);setOcrText(value);setOcrProgress('OCR selesai. Cocokkan nama dan tanda secara manual; hasil belum menjadi presensi resmi.')}catch(err){console.error(err);setOcrProgress('OCR tidak berhasil. Coba foto yang lebih jelas atau catat presensi manual.')}}
  function createMeeting(){if(!course){notify('Pilih mata kuliah.');return};const actualLecturer=lecturer.trim()||(course.lecturers.length===1?course.lecturers[0]:'');if(!actualLecturer){notify('Pilih dosen yang benar-benar mengajar pada pertemuan ini. Jangan menggunakan urutan otomatis jika dosen belum dikonfirmasi.');return};if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isInteger(Number(meeting))||Number(meeting)<1){notify('Tanggal atau nomor pertemuan tidak valid.');return};const duplicate=data.attendance.some(a=>a.courseId===courseId&&a.date===date&&a.meeting===Number(meeting));if(duplicate){notify('Catatan untuk pertemuan dan tanggal tersebut sudah tersedia.');return};updateData(p=>({...p,attendance:[...p.attendance,...p.students.filter(s=>s.active).map(s=>({nim:s.nim,courseId,date,meeting:Number(meeting),lecturer:actualLecturer,status:'?' as const}))]}));notify('Daftar presensi dibuat dengan status awal belum dicatat.')}
  function changeStatus(nim:string,status:AttendanceStatus){updateData(p=>({...p,attendance:p.attendance.map(a=>a.nim===nim&&a.courseId===courseId&&a.date===date&&a.meeting===Number(meeting)?{...a,status}:a)}))}
  const counts=useMemo(()=>({H:rows.filter(a=>a.status==='H').length,I:rows.filter(a=>a.status==='I').length,S:rows.filter(a=>a.status==='S').length,A:rows.filter(a=>a.status==='A').length,Q:rows.filter(a=>a.status==='?').length}),[rows])
  return <div className="page-content"><div className="attendance-tools panel"><div className="form-grid three"><div><label>Mata kuliah</label><select className="field" value={courseId} onChange={e=>{setCourseId(e.target.value);setLecturer('')}}>{data.courses.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div><div><label>Tanggal pertemuan</label><input className="field" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div><div><label>Nomor pertemuan</label><input className="field" type="number" min="1" value={meeting} onChange={e=>setMeeting(e.target.value)}/></div>{admin&&<div><label>Dosen aktual</label><input className="field" value={lecturer} onChange={e=>setLecturer(e.target.value)} placeholder={courseLecturer}/></div>}</div>{admin&&<div className="attendance-toolbar-bottom"><div className="form-note"><AlertCircle size={14}/> Buat daftar lebih dulu; status awal seluruh mahasiswa adalah “Belum dicatat”.</div><button className="btn btn-primary" onClick={createMeeting}><Plus size={15}/> Buat daftar presensi</button></div>}</div>
  {admin&&<div className="panel attendance-ocr-panel"><div className="panel-heading"><div><span className="panel-kicker">AI PHOTO READER</span><h3>Baca foto lembar presensi</h3></div><span className="soft-tag">OCR draft</span></div><label className="upload-drop attendance-photo-drop"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{const f=e.target.files?.[0];if(f)void scanAttendance(f)}}/><div className="upload-cloud"><UploadCloud size={23}/></div><strong>Pilih foto lembar kehadiran</strong><span>JPG, PNG, atau WebP</span><small>AI hanya membaca teks; tanda hadir/izin tetap harus diverifikasi Admin.</small></label>{ocrProgress&&<div className="extract-meta"><FileCheck2 size={14}/>{ocrProgress}</div>}{ocrText&&<><label>Hasil OCR — periksa manual</label><textarea className="field textarea" rows={6} value={ocrText} onChange={e=>setOcrText(e.target.value)}/><div className="form-note"><AlertCircle size={14}/> Jangan menerapkan status otomatis berdasarkan tanda yang tidak jelas. Cocokkan satu per satu dengan daftar kelas.</div></>}</div>}
  <div className="attendance-summary">{([['H','Hadir','mint'],['I','Izin','blue'],['S','Sakit','purple'],['A','Alpa','rose'],['?','Belum dicatat','amber']] as const).map(([key,label,tone])=><div className="attendance-count" key={key}><span className={`att-code ${tone}`}>{key}</span><div><strong>{counts[key === '?' ? 'Q' : key]}</strong><small>{label}</small></div></div>)}</div>
  <div className="panel table-panel"><div className="panel-heading"><div><span className="panel-kicker">ATTENDANCE RECORD</span><h3>{admin?'Daftar presensi kelas':'Presensi saya'}</h3></div><div className="search-field compact"><Search size={14}/><input placeholder="Cari mahasiswa…" value={search} onChange={e=>setSearch(e.target.value)} /></div></div><div className="table-scroll"><table><thead><tr>{admin&&<th>Mahasiswa</th>}<th>NIM</th><th>Pertemuan</th><th>Dosen aktual</th><th>Tanggal</th><th>Status</th>{admin&&<th>Ubah status</th>}</tr></thead><tbody>{rows.map((a,i)=>{const s=data.students.find(x=>x.nim===a.nim);return <tr key={`${a.nim}-${a.date}-${i}`}>{admin&&<td><strong>{s?.name||'Tidak ditemukan'}</strong></td>}<td className="mono-cell">{a.nim}</td><td>Pertemuan {a.meeting}</td><td>{a.lecturer}</td><td>{dateLabel(a.date)}</td><td><span className={`attendance-status status-${a.status.replace('?','q')}`}>{a.status} · {statusLabel[a.status]}</span></td>{admin&&<td><select className="table-input status-select" value={a.status} onChange={e=>changeStatus(a.nim,e.target.value as AttendanceStatus)}>{(['H','I','S','A','?'] as AttendanceStatus[]).map(k=><option key={k} value={k}>{k} · {statusLabel[k]}</option>)}</select></td>}</tr>})}</tbody></table></div>{rows.length===0&&<EmptyInline text={admin?'Belum ada daftar untuk filter pertemuan ini. Buat daftar presensi terlebih dahulu.':'Belum ada catatan presensi untuk akunmu.'}/>}<div className="table-foot"><span>Catatan “?” tidak dihitung sebagai Alpa. Pertemuan batal harus dikelola terpisah.</span><span>{rows.length} baris</span></div></div></div>
}

function ExamsPage({data,user,admin,updateData,notify}:{data:AppData;user:AppUser;admin:boolean;updateData:(p:(d:AppData)=>AppData)=>void;notify:(v:string)=>void}){
  const [course,setCourse]=useState('');const [type,setType]=useState<'UTS'|'UAS'>('UTS');const [date,setDate]=useState('');const [deadline,setDeadline]=useState('');
  function add(e:FormEvent){e.preventDefault();if(!course||!date||!deadline){notify('Lengkapi mata kuliah, tanggal ujian, dan batas konfirmasi.');return};if(deadline>date){notify('Batas konfirmasi tidak boleh melewati tanggal ujian.');return};if(data.exams.some(item=>item.course===course&&item.type===type&&item.date===date)){notify('Sesi ujian untuk mata kuliah, jenis, dan tanggal tersebut sudah ada.');return};updateData(p=>({...p,exams:[{id:crypto.randomUUID(),course,type,date,deadline,yes:[],no:[]},...p.exams]}));setCourse('');setDate('');setDeadline('');notify('Sesi ujian ditambahkan.')}
  function confirm(examId:string,yes:boolean){const target=data.exams.find(item=>item.id===examId);if(!target)return;if(today>target.deadline){notify('Batas konfirmasi ujian sudah berakhir. Hubungi Admin bila perlu koreksi.');return};updateData(p=>({...p,exams:p.exams.map(x=>x.id===examId?{...x,yes:x.yes.filter(n=>n!==user.nim).concat(yes?[user.nim]:[]),no:x.no.filter(n=>n!==user.nim).concat(yes?[]:[user.nim])}:x)}));notify('Konfirmasi keikutsertaan berhasil disimpan di mode demo.')}
  return <div className="page-content">{admin&&<form className="panel add-form" onSubmit={add}><div className="panel-heading"><div><span className="panel-kicker">EXAM SCHEDULER</span><h3>Buat sesi ujian</h3></div></div><div className="form-grid four"><div><label>Mata kuliah</label><select className="field" value={course} onChange={e=>setCourse(e.target.value)}><option value="">Pilih mata kuliah</option>{data.courses.map(c=><option key={c.id}>{c.name}</option>)}</select></div><div><label>Jenis ujian</label><select className="field" value={type} onChange={e=>setType(e.target.value as 'UTS'|'UAS')}><option>UTS</option><option>UAS</option></select></div><div><label>Tanggal ujian</label><input className="field" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div><div><label>Batas konfirmasi</label><input className="field" type="date" value={deadline} onChange={e=>setDeadline(e.target.value)}/></div></div><button className="btn btn-primary"><Plus size={15}/> Buat ujian</button></form>}
  <div className="exam-grid">{data.exams.map(exam=>{const activeTotal=data.students.filter(student=>student.active).length;const answered=exam.yes.length+exam.no.length;const mine=exam.yes.includes(user.nim)?'Ya':exam.no.includes(user.nim)?'Tidak':'Belum menjawab';return <div className="panel exam-card" key={exam.id}><div className="exam-card-top"><span className={`exam-type ${exam.type==='UTS'?'uts':'uas'}`}>{exam.type}</span><span className="soft-tag">{admin?`${answered}/${activeTotal} merespons`:mine}</span></div><h3>{exam.course}</h3><div className="exam-detail"><span><CalendarDays size={14}/> {dateLabel(exam.date)}</span><span><Clock3 size={14}/> Batas konfirmasi: {dateLabel(exam.deadline)}</span></div>{admin?<><div className="exam-progress"><div><span style={{width:`${Math.min(100,answered/Math.max(1,activeTotal)*100)}%`}}/></div><small>{exam.yes.length} ikut · {exam.no.length} tidak ikut · {Math.max(0,activeTotal-answered)} belum menjawab</small></div><div className="exam-admin-note"><Users size={14}/> Konfirmasi bukan presensi ujian aktual.</div></>:<div className="exam-confirm"><p>Apakah kamu akan mengikuti ujian ini?</p><button disabled={today>exam.deadline} className={`btn ${mine==='Ya'?'btn-success':'btn-outline'}`} onClick={()=>confirm(exam.id,true)}><Check size={15}/> Ya, ikut</button><button disabled={today>exam.deadline} className={`btn ${mine==='Tidak'?'btn-danger':'btn-outline'}`} onClick={()=>confirm(exam.id,false)}><X size={15}/> Tidak ikut</button></div>}</div>})}</div>{!data.exams.length&&<EmptyState title="Belum ada sesi ujian" text="Sesi UTS/UAS akan muncul setelah Admin membuatnya." icon={<GraduationCap/>}/>}<div className="info-banner info-amber"><AlertCircle size={18}/><div><strong>Konfirmasi berbeda dari presensi aktual.</strong><span>Kehadiran pada hari ujian tetap perlu dicatat sebagai presensi ujian tersendiri.</span></div></div></div>
}

function AssignmentsPage({data,admin,updateData,notify}:{data:AppData;admin:boolean;updateData:(p:(d:AppData)=>AppData)=>void;notify:(v:string)=>void}){
  const [show,setShow]=useState(false);const [title,setTitle]=useState('');const [course,setCourse]=useState('');const [lecturer,setLecturer]=useState('');const [deadline,setDeadline]=useState('');const [detail,setDetail]=useState('');
  function add(e:FormEvent){e.preventDefault();if(!title.trim()||!course||!deadline){notify('Judul, mata kuliah, dan deadline wajib diisi.');return};updateData(p=>({...p,assignments:[{id:crypto.randomUUID(),title:title.trim(),course,lecturer:lecturer.trim(),deadline,detail:detail.trim()},...p.assignments]}));setShow(false);setTitle('');setDetail('');setCourse('');setLecturer('');notify('Tugas ditambahkan.')}
  return <div className="page-content">{admin&&<div className="content-toolbar"><div className="toolbar-copy"><strong>Manajemen tugas kelas</strong><span>Isi instruksi dan tenggat berdasarkan informasi resmi dosen.</span></div><button className="btn btn-primary" onClick={()=>setShow(!show)}><Plus size={16}/> Tambah tugas</button></div>}{show&&<form className="panel add-form" onSubmit={add}><div className="panel-heading"><h3>Tugas baru</h3><button type="button" className="icon-button" onClick={()=>setShow(false)}><X size={16}/></button></div><div className="form-grid two"><div><label>Judul tugas</label><input className="field" value={title} onChange={e=>setTitle(e.target.value)}/></div><div><label>Mata kuliah</label><select className="field" value={course} onChange={e=>setCourse(e.target.value)}><option value="">Pilih mata kuliah</option>{data.courses.map(c=><option key={c.id}>{c.name}</option>)}</select></div><div><label>Dosen</label><input className="field" value={lecturer} onChange={e=>setLecturer(e.target.value)}/></div><div><label>Deadline</label><input className="field" type="date" value={deadline} onChange={e=>setDeadline(e.target.value)}/></div></div><label>Instruksi</label><textarea className="field textarea" rows={3} value={detail} onChange={e=>setDetail(e.target.value)}/><button className="btn btn-primary">Simpan tugas</button></form>}<div className="task-board">{data.assignments.slice().sort((a,b)=>a.deadline.localeCompare(b.deadline)).map((a,i)=><motion.div className="panel task-card" key={a.id} whileHover={{y:-3}}><div className="task-card-head"><span className="task-number">TASK / {String(i+1).padStart(2,'0')}</span><span className="deadline-tag"><Clock3 size={13}/>{dateLabel(a.deadline)}</span></div><h3>{a.title}</h3><div className="task-course">{a.course} <span>·</span> {a.lecturer}</div><p>{a.detail}</p>{admin&&<button className="text-danger" onClick={()=>{updateData(p=>({...p,assignments:p.assignments.filter(x=>x.id!==a.id)}));notify('Tugas dihapus dari data lokal.')}}><Trash2 size={14}/> Hapus tugas demo</button>}</motion.div>)}</div>{!data.assignments.length&&<EmptyState title="Belum ada tugas" text="Informasi tugas akan tampil di halaman ini." icon={<ClipboardList/>}/>}</div>
}

function AnnouncementsPage({data,admin,updateData,notify}:{data:AppData;admin:boolean;updateData:(p:(d:AppData)=>AppData)=>void;notify:(v:string)=>void}){
  const [show,setShow]=useState(false);const [title,setTitle]=useState('');const [body,setBody]=useState('');const [type,setType]=useState('Informasi');
  function add(e:FormEvent){e.preventDefault();if(!title.trim()||!body.trim()){notify('Judul dan isi pengumuman wajib diisi.');return};updateData(p=>({...p,announcements:[{id:crypto.randomUUID(),title,body,date:today,type},...p.announcements]}));setShow(false);setTitle('');setBody('');notify('Pengumuman diterbitkan di mode demo.')}
  return <div className="page-content">{admin&&<div className="content-toolbar"><div className="toolbar-copy"><strong>Pusat informasi kelas</strong><span>Pastikan isi pengumuman sudah diperiksa sebelum diterbitkan.</span></div><button className="btn btn-primary" onClick={()=>setShow(!show)}><Plus size={16}/> Buat pengumuman</button></div>}{show&&<form className="panel add-form" onSubmit={add}><div className="panel-heading"><h3>Pengumuman baru</h3><button type="button" className="icon-button" onClick={()=>setShow(false)}><X size={16}/></button></div><div className="form-grid two"><div><label>Judul</label><input className="field" value={title} onChange={e=>setTitle(e.target.value)}/></div><div><label>Kategori</label><select className="field" value={type} onChange={e=>setType(e.target.value)}><option>Informasi</option><option>Perubahan jadwal</option><option>Tugas</option><option>Ujian</option><option>Penting</option></select></div></div><label>Isi pengumuman</label><textarea className="field textarea" rows={4} value={body} onChange={e=>setBody(e.target.value)}/><button className="btn btn-primary">Terbitkan pengumuman</button></form>}<div className="announcement-board">{data.announcements.slice().sort((a,b)=>b.date.localeCompare(a.date)).map((a,i)=><motion.article className="panel announcement-card" key={a.id} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:i*.03}}><div className="announcement-card-side"><div className={`announcement-symbol symbol-${i%4}`}><Bell size={20}/></div><span>{dateLabel(a.date)}</span></div><div className="announcement-content"><div className="announcement-meta"><span className="soft-tag">{a.type}</span><span className="panel-kicker">SIMK / NOTICE</span></div><h3>{a.title}</h3><p>{a.body}</p></div>{admin&&<button className="icon-button" onClick={()=>{updateData(p=>({...p,announcements:p.announcements.filter(x=>x.id!==a.id)}));notify('Pengumuman dihapus dari data lokal.')}}><Trash2 size={15}/></button>}</motion.article>)}</div>{!data.announcements.length&&<EmptyState title="Belum ada pengumuman" text="Belum ada informasi yang diterbitkan." icon={<Bell/>}/>}</div>
}

function CalendarPage({data}:{data:AppData}){
  const items=[...data.assignments.map(a=>({date:a.deadline,title:a.title,sub:a.course,type:'Tugas'})),...data.exams.map(e=>({date:e.date,title:`${e.type} — ${e.course}`,sub:'Jadwal ujian',type:'Ujian'})),...data.announcements.map(a=>({date:a.date,title:a.title,sub:a.body,type:'Info'}))].sort((a,b)=>a.date.localeCompare(b.date))
  return <div className="page-content"><div className="panel calendar-panel"><div className="panel-heading"><div><span className="panel-kicker">CLASS TIMELINE</span><h3>Agenda kelas</h3></div><span className="soft-tag">Tanggal tersusun otomatis</span></div>{items.length?items.map((it,i)=><div className="timeline-row" key={`${it.title}-${i}`}><div className="timeline-date"><strong>{new Date(`${it.date}T00:00:00`).getDate()}</strong><span>{new Date(`${it.date}T00:00:00`).toLocaleDateString('id-ID',{month:'short'})}</span></div><div className="timeline-line"><i/></div><div className="timeline-content"><span className={`timeline-type type-${it.type.toLowerCase()}`}>{it.type}</span><strong>{it.title}</strong><p>{it.sub}</p></div><span className="timeline-full-date">{dateLabel(it.date)}</span></div>):<EmptyInline text="Belum ada tugas, ujian, atau pengumuman dalam kalender."/>}</div><div className="info-banner"><CalendarDays size={18}/><div><strong>Jadwal rutin mata kuliah</strong><span>Lihat menu Jadwal Kuliah untuk melihat roster mingguan. Agenda ini menggabungkan tugas, ujian, dan pengumuman bertanggal.</span></div></div></div>
}

function LeavesPage({data,user,admin,updateData,notify}:{data:AppData;user:AppUser;admin:boolean;updateData:(p:(d:AppData)=>AppData)=>void;notify:(v:string)=>void}){
  const [course,setCourse]=useState('');const [date,setDate]=useState(today);const [reason,setReason]=useState('');
  function submit(e:FormEvent){e.preventDefault();if(!course||!reason.trim()){notify('Mata kuliah dan alasan wajib diisi.');return};updateData(p=>({...p,leaves:[{id:crypto.randomUUID(),nim:user.nim,course,date,reason,status:'Menunggu'},...p.leaves]}));setReason('');notify('Pengajuan izin dikirim ke Admin.')}
  function decide(id:string,status:LeaveRequest['status']){updateData(p=>({...p,leaves:p.leaves.map(x=>x.id===id?{...x,status}:x)}));notify(`Pengajuan ${status.toLowerCase()}. Presensi tidak diubah otomatis.`)}
  const requests=data.leaves.filter(l=>admin||l.nim===user.nim)
  return <div className="page-content">{!admin&&<form className="panel add-form leave-form" onSubmit={submit}><span className="panel-kicker">STUDENT SERVICE</span><h3>Ajukan izin perkuliahan</h3><div className="form-grid two"><div><label>Mata kuliah</label><select className="field" value={course} onChange={e=>setCourse(e.target.value)}><option value="">Pilih mata kuliah</option>{data.courses.map(c=><option key={c.id}>{c.name}</option>)}</select></div><div><label>Tanggal pertemuan</label><input className="field" type="date" value={date} onChange={e=>setDate(e.target.value)}/></div></div><label>Alasan izin</label><textarea className="field textarea" rows={3} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Tuliskan alasan dengan jelas…"/><button className="btn btn-primary"><Send size={15}/> Kirim pengajuan</button></form>}<div className="panel table-panel"><div className="panel-heading"><div><span className="panel-kicker">LEAVE REQUESTS</span><h3>{admin?'Daftar pengajuan izin':'Riwayat izin saya'}</h3></div><span className="count-badge">{requests.length}</span></div>{requests.length?requests.map(l=>{const s=data.students.find(x=>x.nim===l.nim);return <div className="leave-row" key={l.id}><div className="leave-avatar"><FileClock size={18}/></div><div className="leave-info"><strong>{admin?s?.name:'Pengajuan saya'}</strong><span>{l.course} · {dateLabel(l.date)}</span><p>{l.reason}</p></div><span className={`status-pill ${l.status==='Disetujui'?'success':l.status==='Ditolak'?'danger':'warning'}`}>{l.status}</span>{admin&&l.status==='Menunggu'&&<div className="leave-actions"><button className="icon-button approve" onClick={()=>decide(l.id,'Disetujui')} title="Setujui"><Check size={16}/></button><button className="icon-button reject" onClick={()=>decide(l.id,'Ditolak')} title="Tolak"><X size={16}/></button></div>}</div>}) : <EmptyInline text="Belum ada pengajuan izin."/>}</div><div className="info-banner info-amber"><AlertCircle size={18}/><div><strong>Persetujuan izin tidak otomatis mengubah presensi.</strong><span>Admin harus melakukan pembaruan presensi secara terpisah bila diperlukan, dan alasan perubahan perlu dicatat.</span></div></div></div>
}

function MessagesPage({data,user,updateData,notify}:{data:AppData;user:AppUser;updateData:(p:(d:AppData)=>AppData)=>void;notify:(v:string)=>void}){
  const [text,setText]=useState('');const [selected,setSelected]=useState(user.role==='ADMIN'?(data.students.find(s=>s.nim!==ADMIN_NIM)?.nim||''):user.nim)
  const target=user.role==='ADMIN'?selected:user.nim;const messages=data.messages.filter(m=>m.nim===target)
  function send(e:FormEvent){e.preventDefault();if(!text.trim())return;updateData(p=>({...p,messages:[...p.messages,{id:crypto.randomUUID(),nim:target,sender:user.role==='ADMIN'?'admin':'student',text:text.trim(),time:new Date().toISOString()}]}));setText('');notify('Pesan dikirim di percakapan pribadi demo.')}
  return <div className="page-content"><div className="messages-layout"><div className="panel conversation-list"><div className="panel-heading"><div><span className="panel-kicker">PRIVATE INBOX</span><h3>{user.role==='ADMIN'?'Mahasiswa':'Percakapan'}</h3></div></div>{user.role==='ADMIN'?data.students.filter(s=>s.nim!==ADMIN_NIM).map(s=><button className={`conversation-person ${selected===s.nim?'selected':''}`} key={s.nim} onClick={()=>setSelected(s.nim)}><div className="avatar">{initials(s.name)}</div><div><strong>{s.name}</strong><span>{s.nim}</span></div><ChevronRight size={15}/></button>):<div className="conversation-person selected"><div className="avatar admin-avatar">R</div><div><strong>Raman Dzulfitra</strong><span>Admin · Ketua Tingkat</span></div></div>}</div><div className="panel chat-panel"><div className="chat-header"><div className="avatar">{user.role==='ADMIN'?initials(data.students.find(s=>s.nim===target)?.name||'Mahasiswa'):'R'}</div><div><strong>{user.role==='ADMIN'?data.students.find(s=>s.nim===target)?.name:'Admin · Raman Dzulfitra'}</strong><span>Percakapan pribadi</span></div><span className="status-pill success"><i/> Private</span></div><div className="chat-messages">{messages.length?messages.map(m=><div className={`chat-bubble ${m.sender==='admin'?'from-admin':'from-student'}`} key={m.id}><p>{m.text}</p><small>{new Date(m.time).toLocaleString('id-ID',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'short'})}</small></div>):<div className="chat-empty"><MessageCircle size={25}/><strong>Mulai percakapan</strong><span>Pesan hanya dapat dibaca oleh mahasiswa ini dan Admin.</span></div>}</div><form className="chat-compose" onSubmit={send}><input value={text} onChange={e=>setText(e.target.value)} placeholder="Tulis pesan pribadi…"/><button className="btn btn-primary" disabled={!text.trim()}><Send size={16}/> Kirim</button></form></div></div></div>
}

function AssistantPage({data,user}:{data:AppData;user:AppUser}){
  const [input,setInput]=useState('');const [chat,setChat]=useState<Array<{role:'user'|'ai';text:string}>>([{role:'ai',text:`Halo ${user.name.split(' ')[0]}! Saya asisten SIMK ITP B dalam mode demo. Saya dapat membantu membaca ringkasan data yang tersedia di browser ini. Integrasi model AI sungguhan perlu dipasang melalui backend yang aman.`}])
  function ask(value=input){if(!value.trim())return;const prompt=value.trim().toLowerCase();let answer='Saya belum menemukan jawaban yang cukup pasti dari data demo. Coba tanyakan tentang jumlah mahasiswa, tugas, ujian, presensi, atau pengumuman.';if(prompt.includes('mahasiswa')||prompt.includes('nim'))answer=`Saat ini terdapat ${data.students.length} data mahasiswa yang masuk dari foto daftar nomor 41–78. Daftar nomor 1–40 belum tersedia. Satu akun Admin utama adalah Raman Dzulfitra (${ADMIN_NIM}).`;else if(prompt.includes('tugas'))answer=data.assignments.length?`Ada ${data.assignments.length} tugas pada data demo. ${data.assignments.map(x=>`${x.title} (deadline ${dateLabel(x.deadline)})`).join('; ')}.`:'Belum ada tugas yang tercatat.';else if(prompt.includes('ujian')||prompt.includes('uas')||prompt.includes('uts'))answer=data.exams.length?`Terdapat ${data.exams.length} sesi ujian. ${data.exams.map(x=>`${x.type} ${x.course}: ${x.yes.length} konfirmasi ikut, ${x.no.length} tidak ikut, ${data.students.length-x.yes.length-x.no.length} belum merespons.`).join(' ')}.`:'Belum ada sesi ujian.';else if(prompt.includes('alpa')||prompt.includes('presensi')||prompt.includes('hadir')){const rec=data.attendance.filter(a=>a.status==='A');answer=`Pada catatan demo yang tersedia, ada ${rec.length} baris berstatus Alpa. Periksa filter semester, mata kuliah, tanggal, dan status pertemuan sebelum menggunakan angka ini sebagai laporan resmi.`}else if(prompt.includes('pengumuman'))answer=`Ada ${data.announcements.length} pengumuman pada data demo. ${data.announcements.map(x=>x.title).join('; ')}`;else if(prompt.includes('jadwal')||prompt.includes('mata kuliah'))answer=`Ada ${data.courses.length} mata kuliah pada data demo. Nama atau jam yang berawalan DEMO-/berlabel contoh harus diganti berdasarkan roster resmi.`;setChat(prev=>[...prev,{role:'user',text:value.trim()},{role:'ai',text:answer}]);setInput('')}
  const aiModules=[['Koordinator AI','Menerima permintaan dan mengarahkan ke modul pembantu.',Zap],['Pembaca roster','Membaca PDF dan menyiapkan draft jadwal.',FileInput],['Pemeriksa jadwal','Mendeteksi bentrok waktu dan ruang.',CalendarDays],['OCR presensi','Membaca foto lembar kehadiran untuk diperiksa.',ClipboardCheck],['Analis kehadiran','Merangkum H/I/S/A dan pola kehadiran.',Activity],['Pendamping belajar','Menjelaskan materi dan merangkum bahan belajar.',GraduationCap],['Ujian & tugas','Merangkum tenggat dan status konfirmasi ujian.',ClipboardList],['Penyusun pengumuman','Membantu menulis draf informasi kelas.',MessageSquare],['Pembuat laporan','Menyiapkan ringkasan laporan per dosen.',FileText],['Pemeriksa kualitas','Menandai data kosong dan duplikat.',ShieldCheck]] as const
  return <div className="page-content"><div className="ai-header-panel"><div className="ai-header-glow"/><div className="ai-header-icon"><Sparkles size={24}/></div><div><span className="panel-kicker">SIMK INTELLIGENCE</span><h2>Asisten kelas yang bekerja bersama.</h2><p>Modul AI dirancang untuk pekerjaan spesifik. Untuk saat ini, jawaban chat memakai aturan demo dari data browser, bukan model generatif yang terhubung.</p></div><span className="demo-indicator"><span/> DEMO AI</span></div><div className="ai-workspace"><div className="panel ai-chat-card"><div className="panel-heading"><div><span className="panel-kicker">ASK SIMK</span><h3>Tanya data kelas</h3></div><span className="soft-tag">Rule-based demo</span></div><div className="ai-chat-stream">{chat.map((m,i)=><div className={`ai-message ${m.role}`} key={i}><div className="ai-message-avatar">{m.role==='ai'?<Sparkles size={15}/>:initials(user.name)}</div><div className="ai-message-content"><strong>{m.role==='ai'?'SIMK Assistant':'Kamu'}</strong><p>{m.text}</p></div></div>)}</div><div className="prompt-suggestions"><button onClick={()=>ask('Berapa jumlah mahasiswa?')}>Jumlah mahasiswa</button><button onClick={()=>ask('Ringkas tugas yang ada')}>Ringkas tugas</button><button onClick={()=>ask('Siapa yang belum konfirmasi ujian?')}>Konfirmasi ujian</button><button onClick={()=>ask('Bagaimana rekap presensi?')}>Rekap presensi</button></div><form className="ai-input-row" onSubmit={e=>{e.preventDefault();ask()}}><input value={input} onChange={e=>setInput(e.target.value)} placeholder="Tanyakan sesuatu tentang kelas…"/><button className="btn btn-primary" disabled={!input.trim()}><Send size={16}/></button></form><div className="ai-disclaimer"><ShieldCheck size={14}/> Perubahan data resmi harus melalui persetujuan Admin. Jangan masukkan informasi sensitif ke layanan eksternal.</div></div><div className="ai-modules"><div className="panel-heading"><div><span className="panel-kicker">AI TOOLKIT</span><h3>Modul pembantu</h3></div></div><div className="ai-module-grid">{aiModules.map(([title,desc,Icon],i)=><motion.div className="ai-module" key={title} whileHover={{y:-3}}><div className={`ai-module-icon icon-tone-${i%4}`}><Icon size={18}/></div><strong>{title}</strong><p>{desc}</p><span className="module-status">Rancangan modul</span></motion.div>)}</div></div></div><div className="info-banner info-amber"><AlertCircle size={18}/><div><strong>AI produksi memerlukan backend dan provider model.</strong><span>Jangan menaruh API key di kode browser. Tahap produksi perlu server-side function, pembatasan akses, log, dan persetujuan Admin untuk perubahan data.</span></div></div></div>
}

function ReportsPage({ data }: { data: AppData }) {
  const [courseId, setCourseId] = useState(data.courses[0]?.id || '')
  const selected = data.courses.find((item) => item.id === courseId)
  const lecturerList = selected?.lecturers || []
  const [lecturer, setLecturer] = useState(lecturerList[0] || '')

  useEffect(() => {
    if (!selected) {
      setLecturer('')
      return
    }
    if (!selected.lecturers.includes(lecturer)) setLecturer(selected.lecturers[0] || '')
  }, [selected, lecturer])

  async function shareReport() {
    if (!selected || !lecturer) return
    const generated = buildLecturerReport(data, selected.name, lecturer)
    const file = new File([generated.blob], generated.name, { type: 'application/pdf' })
    try {
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Laporan ${selected.name}`, text: 'Laporan perkuliahan SIMK ITP B' })
      } else {
        const wa = `https://wa.me/?text=${encodeURIComponent(`Laporan perkuliahan ${selected.name} — ${lecturer}. Saya akan melampirkan PDF setelah mengunduhnya.`)}`
        window.open(wa, '_blank', 'noopener,noreferrer')
        const url = URL.createObjectURL(generated.blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = generated.name
        anchor.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className="page-content">
      <div className="report-hero">
        <div className="report-hero-symbol"><FileText size={26} /></div>
        <span className="panel-kicker">ACADEMIC REPORT BUILDER</span>
        <h2>Satu dosen.<br /><em>Satu laporan.</em></h2>
        <p>Buat laporan per dosen dan mata kuliah setelah bagian pengajaran selesai. Periksa isi dan data sebelum laporan digunakan secara resmi.</p>
      </div>
      {data.courses.length === 0 ? (
        <EmptyState title="Belum ada mata kuliah" text="Buat semester aktif dan impor atau masukkan roster resmi sebelum menyusun laporan dosen." icon={<FileText />} />
      ) : (
        <div className="panel report-builder">
          <div className="panel-heading">
            <div><span className="panel-kicker">REPORT CONFIGURATION</span><h3>Atur laporan PDF</h3></div>
            <span className="soft-tag">PDF</span>
          </div>
          <div className="form-grid two">
            <div>
              <label htmlFor="report-course">Mata kuliah</label>
              <select id="report-course" className="field" value={courseId} onChange={(event) => setCourseId(event.target.value)}>
                {data.courses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="report-lecturer">Dosen</label>
              <select id="report-lecturer" className="field" value={lecturer} onChange={(event) => setLecturer(event.target.value)}>
                {lecturerList.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          </div>
          <div className="report-preview">
            <div><span>PREVIEW SNAPSHOT</span><strong>{selected?.name || 'Pilih mata kuliah'}</strong><small>{lecturer || 'Belum ada dosen terdaftar'}</small></div>
            <div className="report-preview-stats">
              <span><b>{data.attendance.filter((item) => item.courseId === selected?.id && item.lecturer === lecturer).length}</b> catatan presensi</span>
              <span><b>{data.assignments.filter((item) => item.course === selected?.name).length}</b> tugas terkait</span>
            </div>
          </div>
          <div className="form-note"><AlertCircle size={14} /> PDF demo dibuat dari data browser saat ini. Snapshot historis harus disimpan di backend produksi.</div>
          <div className="button-row">
            <button className="btn btn-outline" disabled={!selected || !lecturer} onClick={() => void shareReport()}><Send size={15} /> Bagikan</button>
            <button className="btn btn-primary" disabled={!selected || !lecturer} onClick={() => exportLecturerReport(data, selected!.name, lecturer)}><Download size={16} /> Buat &amp; unduh PDF</button>
          </div>
        </div>
      )}
    </div>
  )
}

function SettingsPage({data,updateData,notify}:{data:AppData;updateData:(p:(d:AppData)=>AppData)=>void;notify:(v:string)=>void}){
  return <div className="page-content"><div className="settings-grid"><div className="panel settings-card"><div className="settings-icon"><UserRound size={20}/></div><span className="panel-kicker">CLASS ADMIN</span><h3>Profil pengelola</h3><p>Raman Dzulfitra</p><div className="setting-line"><span>NIM</span><strong>{ADMIN_NIM}</strong></div><div className="setting-line"><span>Jabatan</span><strong>Ketua Tingkat ITP B</strong></div><div className="setting-line"><span>Role</span><strong>ADMIN</strong></div></div><div className="panel settings-card"><div className="settings-icon purple"><Database size={20}/></div><span className="panel-kicker">LOCAL STORAGE</span><h3>Data pada browser</h3><p>Data demo tersimpan di localStorage perangkat ini. Data tidak otomatis tersinkron ke perangkat lain.</p><div className="setting-line"><span>Mahasiswa</span><strong>{data.students.length} data</strong></div><div className="setting-line"><span>Roster draft</span><strong>{data.rosterDrafts.length} draft</strong></div><div className="setting-line"><span>Mode</span><strong>Demo lokal</strong></div><button className="btn btn-outline" onClick={()=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='backup-simk-itp-b-demo.json';a.click();URL.revokeObjectURL(url)}}><Download size={15}/> Unduh backup JSON</button></div><div className="panel settings-card"><div className="settings-icon mint"><ShieldCheck size={20}/></div><span className="panel-kicker">SECURITY CHECKLIST</span><h3>Sebelum dipakai resmi</h3><div className="security-check"><CheckCircle2 size={15}/> Pemisahan tampilan Admin/Mahasiswa</div><div className="security-check pending"><AlertCircle size={15}/> Auth server-side belum diaktifkan</div><div className="security-check pending"><AlertCircle size={15}/> RLS database belum diterapkan</div><div className="security-check pending"><AlertCircle size={15}/> Storage privat belum disambungkan</div></div><div className="panel settings-card reset-card"><div className="settings-icon rose"><AlertCircle size={20}/></div><span className="panel-kicker">DEMO CONTROL</span><h3>Reset data contoh</h3><p>Hapus perubahan yang tersimpan di browser ini dan kembali ke 38 data awal dari foto. Tindakan ini tidak dapat dibatalkan.</p><button className="btn btn-danger" onClick={()=>{if(confirm('Yakin reset seluruh data demo lokal dan arsip dokumen pada browser ini?')){resetDemo();void clearArchivedSources().finally(()=>window.location.reload())}}}><Trash2 size={15}/> Reset demo lokal</button></div></div><div className="info-banner info-amber"><AlertCircle size={18}/><div><strong>Jangan unggah roster asli atau data pribadi untuk operasional.</strong><span>Versi ini adalah prototipe lokal. Produksi memerlukan autentikasi backend, database dengan RLS, storage privat, audit log, dan pengujian keamanan.</span></div></div></div>
}

function EmptyState({title,text,icon}:{title:string;text:string;icon:ReactNode}){return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{text}</p></div>}
function EmptyInline({text}:{text:string}){return <div className="empty-inline"><CircleHelp size={17}/>{text}</div>}

export default App
