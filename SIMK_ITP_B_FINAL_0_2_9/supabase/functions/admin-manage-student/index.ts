import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getPublishableKey, getSecretKey } from '../_shared/keys.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
}

type Action = 'ACTIVATE' | 'DEACTIVATE' | 'RESET_PASSWORD_TO_NIM'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method tidak didukung.' }, 405)

  const authorization = request.headers.get('Authorization')
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sesi Admin diperlukan.' }, 401)

  const url = Deno.env.get('SUPABASE_URL')
  const publishableKey = getPublishableKey()
  const secretKey = getSecretKey()
  if (!url || !publishableKey || !secretKey) return json({ error: 'Konfigurasi Supabase belum lengkap.' }, 500)

  const userClient = createClient(url, publishableKey, { global: { headers: { Authorization: authorization } } })
  const { data: authData, error: authError } = await userClient.auth.getUser()
  if (authError || !authData.user) return json({ error: 'Sesi tidak valid.' }, 401)

  const admin = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: actor, error: actorError } = await admin.from('profiles')
    .select('id,nim,role,is_active').eq('id', authData.user.id).single()
  if (actorError || !actor || actor.role !== 'ADMIN' || actor.nim !== 'Q1A126065' || !actor.is_active) {
    return json({ error: 'Hanya Admin utama yang dapat mengelola akun mahasiswa.' }, 403)
  }

  let body: { nim?: string; action?: Action }
  try { body = await request.json() } catch { return json({ error: 'JSON tidak valid.' }, 400) }
  const nim = typeof body.nim === 'string' ? body.nim.trim().toUpperCase() : ''
  const action = body.action
  if (!/^Q1A126\d{3}$/.test(nim) || !['ACTIVATE', 'DEACTIVATE', 'RESET_PASSWORD_TO_NIM'].includes(String(action))) {
    return json({ error: 'NIM atau tindakan tidak valid.' }, 400)
  }
  if (nim === 'Q1A126065') return json({ error: 'Akun Admin utama tidak dapat dikelola melalui fungsi mahasiswa.' }, 400)

  const { data: student, error: studentError } = await admin.from('students')
    .select('id,nim,full_name,is_active,needs_verification').eq('nim', nim).single()
  if (studentError || !student) return json({ error: 'Mahasiswa tidak ditemukan.' }, 404)
  if (student.needs_verification && action !== 'DEACTIVATE') {
    return json({ error: 'Identitas mahasiswa harus diverifikasi sebelum akun diaktifkan atau diatur ulang.' }, 409)
  }

  const { data: profile, error: profileError } = await admin.from('profiles')
    .select('id,role,is_active,must_change_password').eq('student_id', student.id).maybeSingle()
  if (profileError || !profile) return json({ error: 'Akun mahasiswa belum pernah dibuat.' }, 404)
  if (profile.role !== 'STUDENT') return json({ error: 'Tindakan hanya berlaku untuk akun mahasiswa.' }, 409)

  if (action === 'RESET_PASSWORD_TO_NIM') {
    const { error: authUpdateError } = await admin.auth.admin.updateUserById(profile.id, { password: nim })
    if (authUpdateError) return json({ error: 'Password sementara gagal diatur ulang.' }, 500)
    const { error: profileUpdateError } = await admin.from('profiles')
      .update({ must_change_password: true }).eq('id', profile.id)
    if (profileUpdateError) return json({ error: 'Password telah diatur ulang, tetapi tanda wajib ganti password gagal disimpan. Hubungi Admin.' }, 500)
    await admin.from('audit_logs').insert({
      actor_profile_id: actor.id, action: 'STUDENT_PASSWORD_RESET', entity_table: 'profiles',
      entity_id: profile.id, old_values: { must_change_password: profile.must_change_password },
      new_values: { must_change_password: true, reset_method: 'NIM_TEMPORARY' },
    })
    return json({ ok: true, nim, temporary_password: nim, must_change_password: true }, 200)
  }

  const active = action === 'ACTIVATE'
  const { data: result, error: statusError } = await userClient.rpc('admin_set_student_active', {
    p_nim: nim,
    p_active: active,
  })
  if (statusError || !result?.ok) return json({ error: statusError?.message ?? 'Status akun gagal diperbarui.' }, 409)
  return json(result, 200)
})

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
