import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getPublishableKey } from '../_shared/keys.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Vary': 'Origin',
}
const genericAuthError = 'Nama lengkap, NIM, atau kata sandi tidak sesuai. Periksa kembali atau hubungi Admin.'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return json({ error: 'Method tidak didukung.' }, 405)

  let body: { nim?: string; full_name?: string; password?: string }
  try { body = await request.json() } catch { return json({ error: 'Format permintaan tidak valid.' }, 400) }

  const nim = typeof body.nim === 'string' ? body.nim.trim().toUpperCase() : ''
  const fullName = typeof body.full_name === 'string' ? body.full_name.trim().replace(/\s+/g, ' ').toLocaleUpperCase('id-ID') : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!/^Q1A126\d{3}$/.test(nim) || !fullName || password.length < 1 || password.length > 256) {
    return json({ error: genericAuthError }, 401)
  }

  const url = Deno.env.get('SUPABASE_URL')
  const publishableKey = getPublishableKey()
  if (!url || !publishableKey) return json({ error: 'Konfigurasi autentikasi belum lengkap.' }, 500)

  // Verify the password first through Supabase Auth. This ensures password checks use
  // Supabase Auth's configured throttling rather than querying the student directory first.
  const emailAlias = `${nim.toLowerCase()}@login.simk-itpb.invalid`
  const authClient = createClient(url, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({ email: emailAlias, password })
  if (authError || !authData.session || !authData.user) return json({ error: genericAuthError }, 401)

  // Read only the signed-in user's profile/student rows under normal RLS.
  const signedInClient = createClient(url, publishableKey, {
    global: { headers: { Authorization: `Bearer ${authData.session.access_token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { data: profile, error: profileError } = await signedInClient.from('profiles')
    .select('id,student_id,nim,full_name,role,is_active,must_change_password')
    .eq('id', authData.user.id).maybeSingle()

  if (profileError || !profile || profile.nim !== nim || !profile.is_active) {
    await authClient.auth.signOut()
    return json({ error: genericAuthError }, 401)
  }

  const { data: student, error: studentError } = await signedInClient.from('students')
    .select('id,nim,full_name,is_active,needs_verification')
    .eq('id', profile.student_id).maybeSingle()

  if (
    studentError || !student || !student.is_active || student.needs_verification ||
    student.nim !== nim || student.full_name.toLocaleUpperCase('id-ID') !== fullName ||
    profile.full_name.toLocaleUpperCase('id-ID') !== fullName
  ) {
    await authClient.auth.signOut()
    return json({ error: genericAuthError }, 401)
  }

  return json({
    session: authData.session,
    user: { nim: student.nim, full_name: student.full_name, role: profile.role },
    must_change_password: profile.must_change_password,
  })
})

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
