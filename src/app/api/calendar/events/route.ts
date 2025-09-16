import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function GET(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')

    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'startDate and endDate are required' }, { status: 400 })
    }

    const { data: events, error } = await supabase
      .from('events')
      .select('nombre, fecha, lugar')
      .eq('created_by', user.id)
      .gte('fecha', startDate)
      .lte('fecha', endDate)
      .order('fecha', { ascending: true })

    if (error) {
      console.error('Error fetching events:', error)
      throw error
    }

    return NextResponse.json({ success: true, events })

  } catch (error) {
    console.error('Error in events API route:', error)
    return NextResponse.json({ success: false, error: 'Failed to fetch events' }, { status: 500 })
  }
}
