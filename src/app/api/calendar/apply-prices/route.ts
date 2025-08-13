import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

type ApplyItem = { room_type: string; new_price: number }

function toISODate(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export async function POST(request: NextRequest) {
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
    const { date, items } = await request.json()
    const target: string = typeof date === 'string' && date.length >= 10 ? date.slice(0, 10) : toISODate(new Date())
    const updates: ApplyItem[] = Array.isArray(items) ? items : []
    if (updates.length === 0) return NextResponse.json({ success: true, data: { updated: 0 } })

    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    // Try to update new schema first (Hotel_usuario with explicit date)
    let totalUpdated = 0
    for (const item of updates) {
      // 1) Hotel_usuario
      const upd1 = await supabase
        .from('Hotel_usuario')
        .update({ price: item.new_price })
        .eq('user_id', user.id)
        .eq('date', target)
        .eq('room_type', item.room_type)
      if (!upd1.error && (upd1.count || 0) > 0) {
        totalUpdated += upd1.count || 0
        continue
      }

      // 2) hotel_usuario (legacy)
      const upd2 = await supabase
        .from('hotel_usuario')
        .update({ price: item.new_price })
        .eq('user_id', user.id)
        .eq('checkin_date', target)
        .eq('room_type', item.room_type)
      if (!upd2.error) totalUpdated += upd2.count || 0
    }

    return NextResponse.json({ success: true, data: { updated: totalUpdated } })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('apply-prices error', error)
    return NextResponse.json({ success: false, error: 'Failed to apply price updates' }, { status: 500 })
  }
}


