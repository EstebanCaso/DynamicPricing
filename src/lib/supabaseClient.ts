import { createBrowserClient, type CookieOptionsWithName } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  // We keep runtime guard to avoid silent failures in dev
  // eslint-disable-next-line no-console
  console.warn('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

function getCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined
  const match = document.cookie.match(new RegExp('(^|; )' + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, '\\$1') + '=([^;]*)'))
  return match ? decodeURIComponent(match[2]) : undefined
}

function setCookie(name: string, value: string, options?: CookieOptionsWithName) {
  if (typeof document === 'undefined') return
  let cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax`
  if (options?.maxAge) cookie += `; Max-Age=${options.maxAge}`
  if (options?.domain) cookie += `; Domain=${options.domain}`
  if (options?.expires) cookie += `; Expires=${(options.expires as Date).toUTCString?.() || ''}`
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') cookie += `; Secure`
  document.cookie = cookie
}

function removeCookie(name: string, options?: CookieOptionsWithName) {
  setCookie(name, '', { ...options, maxAge: 0 })
}

export const supabase = createBrowserClient(supabaseUrl || '', supabaseAnonKey || '', {
  cookies: {
    get: getCookie,
    set: setCookie,
    remove: removeCookie,
  },
})


