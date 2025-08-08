import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

type HotelParallelRow = {
  nombre?: string | null
  ciudad?: string | null
  rooms_jsonb?: Record<string, Array<{ room_type?: string; price?: string }>> | null
  rooms_jsnob?: Record<string, Array<{ room_type?: string; price?: string }>> | null
}

function parsePriceToNumber(text?: string | null): number | null {
  if (!text) return null
  // Remove currency symbols and spaces, keep digits, dots and commas
  let cleaned = text.replace(/[^0-9.,-]/g, '')
  // If both comma and dot exist, assume comma is thousands sep → remove commas
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned = cleaned.replace(/,/g, '')
  } else if (cleaned.includes(',')) {
    // Only comma present → treat as decimal separator
    cleaned = cleaned.replace(/\./g, '') // remove dots as thousands
    cleaned = cleaned.replace(/,/g, '.')
  } else {
    cleaned = cleaned.replace(/,/g, '')
  }
  const n = Number.parseFloat(cleaned)
  return Number.isFinite(n) ? n : null
}

function getDateCandidates(): string[] {
  const now = new Date()
  const iso = now.toISOString().slice(0, 10)
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10)
  let mx = ''
  try {
    mx = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(now)
  } catch {}
  return Array.from(new Set([iso, local, mx].filter(Boolean)))
}

function pickRoomsForDate(
  dict: Record<string, Array<{ room_type?: string; price?: string }>> | null | undefined,
  candidates: string[]
) {
  if (!dict) return undefined
  for (const c of candidates) {
    if (Object.prototype.hasOwnProperty.call(dict, c)) return (dict as any)[c]
  }
  const entries = Object.keys(dict).map((k) => [k.trim(), (dict as any)[k]] as const)
  for (const c of candidates) {
    const hit = entries.find(([k]) => k === c || new Date(k).toISOString().slice(0, 10) === c)
    if (hit) return hit[1]
  }
  return undefined
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
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const userId = user.id
    const cityMeta = (user.user_metadata?.city || user.user_metadata?.ciudad || '').toString()
    const city = cityMeta
    const dateCandidates = getDateCandidates()

    // 1) My hotel prices today from hotel_usuario
    const { data: myRows, error: myErr } = await supabase
      .from('hotel_usuario')
      .select('hotel_name, price, checkin_date')
      .eq('user_id', userId)
      .in('checkin_date', dateCandidates)
      .limit(500)
    if (myErr) throw myErr

    const myHotelName = myRows?.[0]?.hotel_name || user.user_metadata?.hotel_name || 'Mi hotel'
    const myPrices = (myRows || [])
      .map((r) => parsePriceToNumber(r.price))
      .filter((n): n is number => n != null)
    const myAvg = myPrices.length ? myPrices.reduce((a, b) => a + b, 0) / myPrices.length : null

    // 2) Competitors from hotels_parallel/hoteles_parallel filtered by city
    let competitorRows: HotelParallelRow[] = []
    const { data: tryHotels, error: tryErr } = await supabase
      .from('hotels_parallel')
      .select('*')
      .ilike('ciudad', `%${city}%`)
      .limit(2000)
    if (!tryErr && tryHotels) {
      competitorRows = tryHotels as unknown as HotelParallelRow[]
    } else {
      const { data: tryAlt, error: tryAltErr } = await supabase
        .from('hoteles_parallel')
        .select('*')
        .ilike('ciudad', `%${city}%`)
        .limit(2000)
      if (tryAltErr) throw tryAltErr
      competitorRows = (tryAlt || []) as unknown as HotelParallelRow[]
    }

    const competitors = competitorRows
      .map((row) => {
        const rooms =
          pickRoomsForDate((row as any).rooms_jsonb as any, dateCandidates) ||
          pickRoomsForDate((row as any).rooms_jsnob as any, dateCandidates)
        if (!rooms || rooms.length === 0) return null
        const nums = rooms
          .map((r) => parsePriceToNumber(r?.price))
          .filter((n): n is number => n != null)
        if (!nums.length) return null
        const avg = nums.reduce((a, b) => a + b, 0) / nums.length
        return { name: row.nombre || 'Hotel', avg }
      })
      .filter(Boolean) as Array<{ name: string; avg: number }>

    const competitorsCount = competitors.length
    const competitorsAvg = competitorsCount
      ? Math.round((competitors.reduce((a, b) => a + b.avg, 0) / competitorsCount) * 100) / 100
      : null

    // Ranking
    const allForRanking: Array<{ name: string; avg: number; isUser: boolean }> = []
    if (myAvg != null) allForRanking.push({ name: myHotelName, avg: myAvg, isUser: true })
    for (const c of competitors) allForRanking.push({ ...c, isUser: false })
    allForRanking.sort((a, b) => a.avg - b.avg)
    const position = myAvg != null
      ? allForRanking.findIndex((h) => h.isUser) + 1
      : null

    return NextResponse.json({
      success: true,
      data: {
        today,
        userId,
        city,
        myHotelName,
        myAvg,
        competitors,
        competitorsAvg,
        competitorsCount,
        position,
      },
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('compare/hotels error', error)
    return NextResponse.json({ success: false, error: 'Failed to compare' }, { status: 500 })
  }
}


