import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

type PriceRow = {
  hotel_name?: string | null
  room_type?: string | null
  price?: string | number | null
}

function formatISODate(d: Date): string {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

function parsePriceToNumber(text?: string | number | null): number | null {
  if (text == null) return null
  if (typeof text === 'number') return Number.isFinite(text) ? text : null
  let cleaned = text.replace(/[^0-9.,-]/g, '')
  const hasComma = cleaned.includes(',')
  const hasDot = cleaned.includes('.')
  if (hasComma && hasDot) {
    cleaned = cleaned.replace(/,/g, '')
  } else if (hasComma && !hasDot) {
    const onlyDigitsAndCommas = /^[0-9,]+$/.test(cleaned)
    const looksLikeThousands = onlyDigitsAndCommas && /^(?:\d{1,3})(?:,\d{3})+$/.test(cleaned)
    if (looksLikeThousands) {
      cleaned = cleaned.replace(/,/g, '')
    } else {
      cleaned = cleaned.replace(/\./g, '').replace(/,/g, '.')
    }
  } else {
    const onlyDigitsAndDots = /^[0-9.]+$/.test(cleaned)
    const looksLikeDotThousands = onlyDigitsAndDots && /^(?:\d{1,3})(?:\.\d{3})+$/.test(cleaned)
    if (looksLikeDotThousands) cleaned = cleaned.replace(/\./g, '')
    cleaned = cleaned.replace(/,/g, '')
  }
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
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
    const { date } = await request.json()
    const target = typeof date === 'string' && date.length >= 10 ? date.slice(0, 10) : formatISODate(new Date())

    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    // Try new schema first (Hotel_usuario with date)
    let rows: PriceRow[] | null = null
    {
      const { data, error } = await supabase
        .from('Hotel_usuario')
        .select('hotel_name, room_type, price, date')
        .eq('user_id', user.id)
        .eq('date', target)
        .limit(500)
      if (!error && data) rows = data as unknown as PriceRow[]
    }
    if (!rows || rows.length === 0) {
      const { data, error } = await supabase
        .from('hotel_usuario')
        .select('hotel_name, room_type, price, checkin_date')
        .eq('user_id', user.id)
        .eq('checkin_date', target)
        .limit(500)
      if (!error && data) rows = data as unknown as PriceRow[]
    }

    const hotelName = (rows?.[0]?.hotel_name as string) || user.user_metadata?.hotel_name || 'Mi hotel'
    const prices = (rows || [])
      .map((r) => ({ room_type: r.room_type || 'Room', price: parsePriceToNumber(r.price) }))
      .filter((r) => r.price != null)

    return NextResponse.json({ success: true, data: { hotelName, date: target, prices } })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('calendar/hotel-prices error', error)
    return NextResponse.json({ success: false, error: 'Failed to load prices' }, { status: 500 })
  }
}


