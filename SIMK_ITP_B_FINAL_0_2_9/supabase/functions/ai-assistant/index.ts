import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getPublishableKey, getSecretKey } from '../_shared/keys.ts'

type ModuleKey =
  | 'coordinator' | 'roster_reader' | 'schedule_checker' | 'attendance_reader'
  | 'attendance_analyst' | 'learning_assistant' | 'exam_assignment'
  | 'announcement_writer' | 'report_writer' | 'data_quality'

const moduleNames: Record<ModuleKey, string> = {
  coordinator: 'AI Koordinator',
  roster_reader: 'AI Pembaca Roster dan Dokumen',
  schedule_checker: 'AI Pemeriksa Jadwal',
  attendance_reader: 'AI Pembaca Presensi',
  attendance_analyst: 'AI Analis Kehadiran',
  learning_assistant: 'AI Pendamping Belajar',
  exam_assignment: 'AI Pembantu UTS/UAS dan Tugas',
  announcement_writer: 'AI Penyusun Pengumuman',
  report_writer: 'AI Pembuat Laporan',
  data_quality: 'AI Pemeriksa Kualitas Data',
}

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method tidak didukung.' }, 405)

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sesi login diperlukan.' }, 401)

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = getPublishableKey()
  const secretKey = getSecretKey()
  const apiKey = Deno.env.get('AI_PROVIDER_API_KEY')
  const model = Deno.env.get('AI_MODEL')
  const endpoint = Deno.env.get('AI_API_BASE_URL')
  if (!url || !anonKey || !secretKey) return json({ error: 'Konfigurasi Supabase belum lengkap.' }, 500)
  if (!apiKey || !model || !endpoint) return json({ error: 'Provider AI belum disiapkan. Fitur manual tetap dapat digunakan.' }, 503)

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json({ error: 'Sesi tidak valid.' }, 401)

  const adminClient = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: profile, error: profileError } = await adminClient.from('profiles')
    .select('id,nim,student_id,full_name,role,is_active,must_change_password')
    .eq('id', authData.user.id).single()
  if (profileError || !profile?.is_active) return json({ error: 'Akun tidak aktif atau profil belum tersedia.' }, 403)
  if (profile.must_change_password) return json({ error: 'Ganti kata sandi awal sebelum memakai asisten AI.' }, 403)

  let body: { message?: string; module_key?: ModuleKey }
  try { body = await request.json() } catch { return json({ error: 'Format permintaan tidak valid.' }, 400) }
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const moduleKey: ModuleKey = typeof body.module_key === 'string' && Object.hasOwn(moduleNames, body.module_key) ? body.module_key as ModuleKey : 'coordinator'
  if (!message || message.length > 1800) return json({ error: 'Pesan wajib diisi dan maksimal 1.800 karakter.' }, 400)

  const adminOnlyModules: ModuleKey[] = ['roster_reader','schedule_checker','attendance_reader','attendance_analyst','announcement_writer','report_writer','data_quality']
  if (profile.role !== 'ADMIN' && adminOnlyModules.includes(moduleKey)) {
    return json({ error: 'Modul ini hanya dapat digunakan Admin.' }, 403)
  }

  const context = await buildContext(userClient, profile, moduleKey)
  const system = [
    `Kamu adalah ${moduleNames[moduleKey]} di SIMK ITP B, Universitas Halu Oleo.`,
    `Pengguna: ${profile.full_name}; role: ${profile.role}. Jawab dalam Bahasa Indonesia.`,
    'Gunakan hanya konteks data yang diberikan. Jangan mengarang jadwal, dosen, presensi, tugas, atau nama mahasiswa.',
    'Jangan menyebut bahwa database telah diubah. Kamu tidak boleh mengubah database secara langsung.',
    'Semua usulan perubahan resmi harus dikembalikan sebagai draft untuk disetujui Admin.',
    'Mahasiswa hanya boleh melihat data dirinya sendiri dan informasi umum kelas. Jangan mengungkap data mahasiswa lain.',
    'Jangan meminta kata sandi, token, service key, atau data autentikasi.',
    'Jika konteks tidak cukup, jelaskan data yang belum tersedia. Jika ada ketidakpastian, tandai untuk pemeriksaan manual.',
    'Kembalikan satu objek JSON valid dengan bentuk: {"answer":"...","proposal":null}.',
    'Jika Admin secara eksplisit meminta draf perubahan yang termasuk tindakan yang diizinkan, isi proposal dengan {"action_type":"CREATE_ANNOUNCEMENT|UPDATE_ATTENDANCE|CREATE_ASSIGNMENT","payload":{...}}. Jangan gunakan jenis tindakan lain.',
  ].join('\n')

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `KONTEKS DATA YANG DIIZINKAN:\n${JSON.stringify(context)}\n\nPERMINTAAN:\n${message}` },
        ],
        temperature: 0.2,
        max_tokens: 1000,
      }),
    })
    if (!response.ok) return json({ error: `Provider AI mengembalikan status ${response.status}.` }, 502)
    const result = await response.json()
    const content = result?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) return json({ error: 'Provider AI tidak mengembalikan jawaban.' }, 502)

    let answer = content.trim()
    let draftId: string | null = null
    try {
      const parsed = JSON.parse(answer)
      if (typeof parsed?.answer === 'string') answer = parsed.answer
      const proposal = parsed?.proposal
      if (proposal && profile.role === 'ADMIN' && isAllowedProposal(proposal)) {
        const { data: draft, error: draftError } = await adminClient.from('ai_drafts').insert({
          module_key: moduleKey,
          action_type: proposal.action_type,
          proposed_payload: proposal.payload,
          requested_by: authData.user.id,
          status: 'PENDING',
        }).select('id').single()
        if (!draftError && draft) draftId = draft.id
      }
    } catch {
      // Provider returned plain text rather than the requested JSON; preserve its answer.
    }

    return json({ answer, module_key: moduleKey, module_name: moduleNames[moduleKey], draft_id: draftId, draft_requires_admin_approval: Boolean(draftId) })
  } catch {
    return json({ error: 'Tidak dapat menghubungi provider AI. Gunakan proses manual atau coba lagi.' }, 502)
  }
})

async function buildContext(client: any, profile: Record<string, any>, moduleKey: ModuleKey) {
  const isAdmin = profile.role === 'ADMIN'
  const context: Record<string, unknown> = {
    semester_notice: 'Semester dan catatan historis harus tetap terpisah. Jangan menafsirkan data kosong sebagai tidak hadir.',
    user: { name: profile.full_name, role: profile.role, nim: isAdmin ? profile.nim : undefined },
  }

  if (moduleKey === 'learning_assistant') return context

  if (moduleKey === 'coordinator' || moduleKey === 'data_quality') {
    const [{ count: studentsCount }, { count: courseCount }, { count: pendingLeaves }, { count: pendingAi }] = await Promise.all([
      client.from('students').select('id', { count: 'exact', head: true }).eq('is_active', true),
      client.from('course_offerings').select('id', { count: 'exact', head: true }).eq('is_active', true),
      client.from('leave_requests').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
      client.from('ai_drafts').select('id', { count: 'exact', head: true }).eq('status', 'PENDING'),
    ])
    context.summary = { active_students: isAdmin ? studentsCount : undefined, active_course_offerings: courseCount, pending_leave_requests: isAdmin ? pendingLeaves : undefined, pending_ai_drafts: isAdmin ? pendingAi : undefined }
  }

  if (moduleKey === 'schedule_checker' || moduleKey === 'roster_reader') {
    const { data } = await client.from('course_offerings')
      .select('id,course_code,course_name,semester_id,timetables(day_of_week,starts_at,ends_at,room),course_lecturers(sequence_no,assignment_mode,is_current,lecturers(full_name))')
      .eq('is_active', true).limit(80)
    context.course_schedules = data ?? []
  }

  if (moduleKey === 'attendance_reader' || moduleKey === 'attendance_analyst' || moduleKey === 'coordinator') {
    let query = client.from('attendance_records').select('status,meeting_id,student_id,updated_at,meetings(course_offering_id,lecturer_id,meeting_date,status)').limit(500)
    if (!isAdmin) query = query.eq('student_id', profile.student_id)
    const { data } = await query
    context.attendance_records = data ?? []
    if (isAdmin && moduleKey === 'attendance_analyst') {
      const { data: studentRows } = await client.from('students').select('id,nim,full_name').eq('is_active', true).limit(120)
      context.student_directory = studentRows ?? []
    }
  }

  if (moduleKey === 'exam_assignment' || moduleKey === 'coordinator') {
    const { data: exams } = await client.from('exams').select('id,exam_type,exam_date,confirmation_deadline,course_offering_id').order('exam_date').limit(40)
    context.exams = exams ?? []
    const { data: assignments } = await client.from('assignments').select('title,instructions,deadline,course_offering_id').order('deadline').limit(60)
    context.assignments = assignments ?? []
    if (!isAdmin) {
      const { data: ownConfirmations } = await client.from('exam_confirmations')
        .select('exam_id,response,responded_at').eq('student_id', profile.student_id)
      context.own_exam_confirmations = ownConfirmations ?? []
    } else {
      const { data: confirmations } = await client.from('exam_confirmations').select('exam_id,response,student_id').limit(500)
      context.exam_confirmation_records = confirmations ?? []
    }
  }

  if (moduleKey === 'announcement_writer' || moduleKey === 'coordinator') {
    const { data } = await client.from('announcements').select('title,body,category,published_at').order('published_at', { ascending: false }).limit(30)
    context.announcements = data ?? []
  }

  if (moduleKey === 'report_writer') {
    const { data } = await client.from('meetings')
      .select('meeting_number,meeting_date,starts_at,ends_at,topic,status,delivery_mode,room,lecturer_id,course_offering_id')
      .order('meeting_date').limit(200)
    context.meetings = data ?? []
    const { data: records } = await client.from('attendance_records').select('meeting_id,status,student_id').limit(1000)
    context.attendance_records = records ?? []
  }

  if (moduleKey === 'roster_reader' || moduleKey === 'attendance_reader') {
    context.review_rule = 'Gunakan hasil ekstraksi sebagai draft. Baris/kolom ambigu wajib diperiksa Admin; jangan menebak.'
  }
  return context
}

function isAllowedProposal(value: any): value is { action_type: string; payload: Record<string, unknown> } {
  if (!value || typeof value !== 'object' || !value.payload || typeof value.payload !== 'object') return false
  if (!['CREATE_ANNOUNCEMENT', 'UPDATE_ATTENDANCE', 'CREATE_ASSIGNMENT'].includes(value.action_type)) return false
  const payload = value.payload as Record<string, unknown>
  if (value.action_type === 'CREATE_ANNOUNCEMENT') return typeof payload.title === 'string' && payload.title.length <= 180 && typeof payload.body === 'string' && payload.body.length <= 8000
  if (value.action_type === 'UPDATE_ATTENDANCE') return typeof payload.attendance_record_id === 'string' && ['H','I','S','A','?'].includes(String(payload.status))
  return typeof payload.course_offering_id === 'string' && typeof payload.title === 'string' && payload.title.length <= 180
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
