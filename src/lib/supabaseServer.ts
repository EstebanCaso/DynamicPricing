import { createServerClient } from '@supabase/ssr'

const supabaseUrl = process.env.SUPABASE_URL as string
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn('Missing SUPABASE_URL or SUPABASE_ANON_KEY in server environment')
}

// Node-only server client without request/response cookie adapters (used in simple server contexts)
export const supabaseServer = createServerClient(supabaseUrl || '', supabaseAnonKey || '', {
  cookies: {
    get: () => undefined,
    set: () => undefined,
    remove: () => undefined,
  },
})


