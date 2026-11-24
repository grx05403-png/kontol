/** Reads both current Supabase key dictionaries and legacy environment variables. */
function getDefaultKey(dictionaryName: string, legacyName: string): string | null {
  const raw = Deno.env.get(dictionaryName)
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      if (typeof parsed.default === 'string' && parsed.default.length > 10) return parsed.default
    } catch {
      // The variable may already contain one key rather than the current JSON dictionary.
      if (raw.length > 10 && !raw.trim().startsWith('{')) return raw
    }
  }
  return Deno.env.get(legacyName) || null
}

export function getPublishableKey(): string | null {
  return getDefaultKey('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY')
}

export function getSecretKey(): string | null {
  return getDefaultKey('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY')
}
