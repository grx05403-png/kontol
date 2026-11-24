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
  if (!authorization?.startsWith('Bearer ')) return json({ error: 'Sesi login diperlukan.' }, 401)

  let body: { new_password?: string }
  try { body = await request.json() } catch { return json({ error: 'Format permintaan tidak valid.' }, 400) }
  const newPassword = typeof body.new_password === 'string' ? body.new_password : ''
  if (newPassword.length < 8 || newPassword.length > 256) return json({ error: 'Kata sandi baru harus berisi 8–256 karakter.' }, 400)

  const url = Deno.env.get('SUPABASE_URL')
  const key = getPublishableKey()
  const secretKey = getSecretKey()
  if (!url || !key || !secretKey) return json({ error: 'Konfigurasi Supabase belum lengkap.' }, 500)
  const client = createClient(url, key, { global: { headers: { Authorization: authorization } } })
  const { data: userData, error: userError } = await client.auth.getUser()
  if (userError || !userData.user) return json({ error: 'Sesi tidak valid.' }, 401)

  const { error: updateError } = await client.auth.updateUser({ password: newPassword })
  if (updateError) return json({ error: 'Kata sandi tidak dapat diperbarui. Coba lagi.' }, 400)
  // Update the profile flag server-side only after Auth confirms the new password.
  // The browser cannot call a public RPC to bypass the first-login password-change requirement.
  const admin = createClient(url, secretKey, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error: flagError } = await admin.from('profiles').update({ must_change_password: false }).eq('id', userData.user.id)
  if (flagError) return json({ error: 'Kata sandi berhasil diubah, tetapi status profil belum tersimpan. Hubungi Admin.' }, 500)

  return json({ ok: true, message: 'Kata sandi berhasil diperbarui.' })
})

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
