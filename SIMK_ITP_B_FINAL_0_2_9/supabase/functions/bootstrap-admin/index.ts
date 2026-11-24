import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getPublishableKey, getSecretKey } from '../_shared/keys.ts'

const ADMIN_NIM = 'Q1A126065'
const ADMIN_NAME = 'RAMAN DZULFITRA'
const encoder = new TextEncoder()
const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bootstrap-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method tidak didukung.' }, 405)

  const expectedSecret = Deno.env.get('BOOTSTRAP_ADMIN_SECRET')
  const suppliedSecret = request.headers.get('x-bootstrap-secret') ?? ''
  if (!expectedSecret || !constantTimeEqual(expectedSecret, suppliedSecret)) {
    return json({ error: 'Rahasia bootstrap tidak valid.' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = getSecretKey()
  if (!supabaseUrl || !serviceKey) return json({ error: 'Secret Supabase belum dikonfigurasi.' }, 500)

  let body: { password?: string }
  try { body = await request.json() } catch { return json({ error: 'JSON tidak valid.' }, 400) }
  const password = typeof body.password === 'string' ? body.password : ''
  if (password.length < 12) return json({ error: 'Password Admin minimal 12 karakter.' }, 400)

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: admins, error: adminQueryError } = await admin.from('profiles').select('id').eq('role', 'ADMIN').limit(1)
  if (adminQueryError) return json({ error: 'Gagal memeriksa status Admin.' }, 500)
  if (admins?.length) return json({ error: 'Admin utama sudah pernah dibuat. Bootstrap tidak dapat diulang.' }, 409)

  const { data: student, error: studentError } = await admin.from('students')
    .select('id,nim,full_name,is_active,needs_verification').eq('nim', ADMIN_NIM).single()
  if (studentError || !student || student.full_name !== ADMIN_NAME || !student.is_active || student.needs_verification) {
    return json({ error: 'Data mahasiswa Admin belum cocok atau belum diverifikasi.' }, 409)
  }

  const emailAlias = `${ADMIN_NIM.toLowerCase()}@login.simk-itpb.invalid`
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: emailAlias,
    password,
    email_confirm: true,
    user_metadata: { nim: ADMIN_NIM, full_name: ADMIN_NAME },
    app_metadata: { role: 'ADMIN' },
  })
  if (createError || !created.user) return json({ error: createError?.message ?? 'Akun Admin gagal dibuat.' }, 409)

  const { error: profileError } = await admin.from('profiles').insert({
    id: created.user.id,
    student_id: student.id,
    nim: ADMIN_NIM,
    full_name: ADMIN_NAME,
    role: 'ADMIN',
    is_active: true,
    must_change_password: false,
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(created.user.id)
    return json({ error: 'Profil Admin gagal dibuat; akun Auth yang baru dibuat telah dibatalkan.' }, 500)
  }

  return json({ ok: true, message: 'Admin utama berhasil dibuat. Simpan password yang kamu pilih secara aman.', nim: ADMIN_NIM }, 201)
})

function constantTimeEqual(left: string, right: string) {
  const a = encoder.encode(left)
  const b = encoder.encode(right)
  if (a.length !== b.length) return false
  let result = 0
  for (let i = 0; i < a.length; i += 1) result |= a[i] ^ b[i]
  return result === 0
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
