import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

type EventRow = {
  id?: string
  nombre?: string | null
  fecha?: string | null
  lugar?: string | null
  enlace?: string | null
  created_by?: string | null
}

function formatISODate(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
    {
      cookies: {
        get: (name: string) => request.cookies.get(name)?.value,
        set: (name: string, value: string, options: any) => {
          response.cookies.set({ name, value, ...options })
        },
        remove: (name: string, options: any) => {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  try {
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const today = formatISODate(new Date())
    const endDate = formatISODate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000))

    const { data, error } = await supabase
      .from('events')
      .select('id,nombre,fecha,lugar,enlace,created_by')
      .eq('created_by', user.id)
      .gte('fecha', today)
      .lte('fecha', endDate)
      .order('fecha', { ascending: true })
      .limit(1000)

    if (error) throw error

    const events = (data || []) as EventRow[]
    return NextResponse.json({ success: true, data: { events } })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('calendar/events error', error)
    return NextResponse.json({ success: false, error: 'Failed to load events' }, { status: 500 })
  }
}


