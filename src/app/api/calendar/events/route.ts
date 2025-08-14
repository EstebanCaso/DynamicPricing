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
  try {
    // Validate environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase environment variables')
      return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 })
    }

    const response = NextResponse.next()
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get: (name: string) => {
          try {
            return request.cookies.get(name)?.value
          } catch (error) {
            console.warn('Error getting cookie:', name, error)
            return undefined
          }
        },
        set: (name: string, value: string, options: any) => {
          try {
            response.cookies.set({ name, value, ...options })
          } catch (error) {
            console.warn('Error setting cookie:', name, error)
          }
        },
        remove: (name: string, options: any) => {
          try {
            response.cookies.set({ name, value: '', ...options })
          } catch (error) {
            console.warn('Error removing cookie:', name, error)
          }
        },
      },
    })

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser()
      
      if (userError) {
        console.error('Supabase auth error:', userError)
        return NextResponse.json({ success: false, error: 'Authentication error' }, { status: 500 })
      }
      
      const user = userData?.user
      if (!user) {
        console.log('No authenticated user')
        return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
      }

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

      if (error) {
        console.error('Database query error:', error)
        return NextResponse.json({ success: false, error: 'Database error' }, { status: 500 })
      }

      const events = (data || []) as EventRow[]
      return NextResponse.json({ success: true, data: { events } })
    } catch (error) {
      console.error('Unexpected error in calendar/events:', error)
      return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 })
    }
  } catch (error) {
    console.error('Error creating Supabase client:', error)
    return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 })
  }
}
