import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getPublishableKey, getSecretKey } from '../_shared/keys.ts'

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
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sesi login Admin diperlukan.' }, 401)

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = getPublishableKey()
  const serviceKey = getSecretKey()
  if (!url || !anonKey || !serviceKey) return json({ error: 'Konfigurasi Supabase belum lengkap.' }, 500)

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json({ error: 'Sesi tidak valid.' }, 401)

  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: actor, error: actorError } = await admin.from('profiles')
    .select('id,role,is_active,nim').eq('id', authData.user.id).single()
  if (actorError || !actor || actor.role !== 'ADMIN' || !actor.is_active || actor.nim !== 'Q1A126065') {
    return json({ error: 'Hanya Admin utama yang boleh membuat akun mahasiswa.' }, 403)
  }

  let body: { nim?: string; full_name?: string }
  try { body = await request.json() } catch { return json({ error: 'JSON tidak valid.' }, 400) }
  const nim = typeof body.nim === 'string' ? body.nim.trim().toUpperCase() : ''
  const fullName = typeof body.full_name === 'string' ? body.full_name.trim().replace(/\s+/g, ' ') : ''
  if (!/^Q1A126\d{3}$/.test(nim) || !fullName || fullName.length > 120) return json({ error: 'NIM atau nama tidak valid.' }, 400)
  if (nim === 'Q1A126065') return json({ error: 'Akun Admin utama tidak dibuat melalui fungsi mahasiswa.' }, 400)

  const { data: student, error: studentError } = await admin.from('students')
    .select('id,nim,full_name,is_active,needs_verification').eq('nim', nim).single()
  if (studentError || !student || !student.is_active) return json({ error: 'Mahasiswa tidak ditemukan atau tidak aktif di daftar resmi.' }, 404)
  if (student.needs_verification) return json({ error: 'Nama mahasiswa harus diverifikasi Admin sebelum membuat akun.' }, 409)
  if (student.full_name.toLocaleUpperCase('id-ID') !== fullName.toLocaleUpperCase('id-ID')) {
    return json({ error: 'Nama tidak sama dengan daftar mahasiswa yang telah disetujui.' }, 409)
  }

  const { data: existingProfile } = await admin.from('profiles').select('id').eq('nim', nim).maybeSingle()
  if (existingProfile) return json({ error: 'Akun mahasiswa sudah pernah dibuat.' }, 409)

  const emailAlias = `${nim.toLowerCase()}@login.simk-itpb.invalid`
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: emailAlias,
    password: nim,
    email_confirm: true,
    user_metadata: { nim, full_name: student.full_name },
    app_metadata: { role: 'STUDENT' },
  })
  if (createError || !created.user) return json({ error: createError?.message ?? 'Akun mahasiswa gagal dibuat.' }, 409)

  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id,
    student_id: student.id,
    nim,
    full_name: student.full_name,
    role: 'STUDENT',
    is_active: true,
    must_change_password: true,
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return json({ error: 'Pembuatan profil gagal; akun Auth dibatalkan.' }, 500)
  }

  // The initial NIM password is disclosed only in the authenticated Admin response.
  return json({ ok: true, nim, full_name: student.full_name, initial_password: nim, must_change_password: true }, 201)
})

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
