import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

type HotelParallelRow = {
  nombre?: string | null
  ciudad?: string | null
  rooms_jsonb?: Record<string, Array<{ room_type?: string; price?: string }>> | null
  rooms_jsnob?: Record<string, Array<{ room_type?: string; price?: string }>> | null
  estrellas?: number | string | null
}

type RoomPrice = { room_type?: string; price?: string }

function parsePriceToNumber(text?: string | number | null): number | null {
  if (text == null) return null
  if (typeof text === 'number') return Number.isFinite(text) ? text : null
  // Remove currency symbols and spaces, keep digits, dots and commas
  let cleaned = text.replace(/[^0-9.,-]/g, '')

  const hasComma = cleaned.includes(',')
  const hasDot = cleaned.includes('.')

  if (hasComma && hasDot) {
    // Likely thousands (comma) and decimals (dot): "$1,234.56" → "1234.56"
    cleaned = cleaned.replace(/,/g, '')
  } else if (hasComma && !hasDot) {
    // Only commas present. Decide if commas are thousands or decimal separator.
    const onlyDigitsAndCommas = /^[0-9,]+$/.test(cleaned)
    const looksLikeThousands = onlyDigitsAndCommas && /^(?:\d{1,3})(?:,\d{3})+$/.test(cleaned)
    if (looksLikeThousands) {
      // "1,234" or "12,345,678" → thousands
      cleaned = cleaned.replace(/,/g, '')
    } else {
      // Treat comma as decimal separator: "123,45" → "123.45"
      cleaned = cleaned.replace(/\./g, '')
      cleaned = cleaned.replace(/,/g, '.')
    }
  } else {
    // No commas
    const onlyDigitsAndDots = /^[0-9.]+$/.test(cleaned)
    const looksLikeDotThousands = onlyDigitsAndDots && /^(?:\d{1,3})(?:\.\d{3})+$/.test(cleaned)
    if (looksLikeDotThousands) {
      // "1.234" or "12.345.678" → treat dots as thousands
      cleaned = cleaned.replace(/\./g, '')
    } else {
      // Assume dot is decimal separator; just ensure commas removed
      cleaned = cleaned.replace(/,/g, '')
    }
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

function getCanonicalToday(): string {
  const now = new Date()
  try {
    // Prefer Mexico City calendar date as canonical for the business domain
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(now)
  } catch {
    // Fallback: local date
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  }
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
    // Parse optional body for filters
    let selectedStars: number | null = null
    try {
      const body = await request.json()
      const maybe = Number(body?.stars)
      if (Number.isFinite(maybe) && maybe >= 1 && maybe <= 5) selectedStars = Math.trunc(maybe)
    } catch {}
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const userId = user.id
    // Resolve city from nested user metadata
    const md: any = user.user_metadata || {}
    const cityMetaRaw =
      md?.hotel_metadata?.address?.cityName ||
      md?.address?.cityName ||
      md?.cityName ||
      md?.ciudad ||
      md?.raw_user_meta_data?.hotel_metadata?.address?.cityName ||
      md?.raw_user_meta_data?.cityName ||
      ''
    const city = cityMetaRaw ? String(cityMetaRaw).trim() : ''
    const dateCandidates = getDateCandidates()
    const canonicalToday = getCanonicalToday()
    // Debug context
    // eslint-disable-next-line no-console
    console.log('[compare/hotels] inputs', { userId, city, dateCandidates })
    // eslint-disable-next-line no-console
    console.log('[compare/hotels] user metadata', { 
      hotel_metadata: md?.hotel_metadata, 
      address: md?.address, 
      cityName: md?.cityName, 
      ciudad: md?.ciudad,
      raw_user_meta_data: md?.raw_user_meta_data 
    })

    // 1) My hotel prices (only rows for canonical "today"): try Hotel_usuario(date, price) then fall back to hotel_usuario(checkin_date, price)
    let myRows: any[] | null = null
    let myErr: any = null
    {
      const attempt = await supabase
        .from('Hotel_usuario')
        .select('hotel_name, price, date')
        .eq('user_id', userId)
        .in('date', dateCandidates)
        .limit(500)
      if (!attempt.error && attempt.data && attempt.data.length >= 0) {
        myRows = attempt.data as any[]
      } else {
        myErr = attempt.error
      }
    }
    if (!myRows) {
      const fallback = await supabase
        .from('hotel_usuario')
        .select('hotel_name, price, checkin_date')
        .eq('user_id', userId)
        .in('checkin_date', dateCandidates)
        .limit(500)
      if (!fallback.error && fallback.data) {
        myRows = fallback.data as any[]
      } else {
        myErr = myErr || fallback.error
      }
    }
    if (!myRows) throw myErr || new Error('Failed to fetch user hotel prices')

    const myHotelName = myRows?.[0]?.hotel_name || user.user_metadata?.hotel_name || 'Mi hotel'
    const myPrices = (myRows || [])
      .map((r: any) => parsePriceToNumber(r?.price))
      .filter((n: number | null): n is number => n != null)
    const myAvg = myPrices.length ? myPrices.reduce((a: number, b: number) => a + b, 0) / myPrices.length : null

    // 2) Competitors from hotels_parallel/hoteles_parallel filtered by city
    let competitorRows: HotelParallelRow[] = []
    
    // If city is empty, get all competitors (fallback)
    const cityFilter = city ? `%${city}%` : '%'
    
    const { data: tryHotels, error: tryErr } = await supabase
      .from('hotels_parallel')
      .select('*')
      .ilike('ciudad', cityFilter)
      .limit(2000)
    if (!tryErr && tryHotels) {
      competitorRows = tryHotels as unknown as HotelParallelRow[]
    } else {
      const { data: tryAlt, error: tryAltErr } = await supabase
        .from('hoteles_parallel')
        .select('*')
        .ilike('ciudad', cityFilter)
        .limit(2000)
      if (tryAltErr) throw tryAltErr
      competitorRows = (tryAlt || []) as unknown as HotelParallelRow[]
    }
    
    // If still no results and we had a specific city, try without city filter as last resort
    if (competitorRows.length === 0 && city) {
      console.log('[compare/hotels] No competitors found for city, trying without city filter...')
      const { data: fallbackHotels } = await supabase
        .from('hotels_parallel')
        .select('*')
        .limit(100) // Smaller limit for fallback
      if (fallbackHotels && fallbackHotels.length > 0) {
        competitorRows = fallbackHotels as unknown as HotelParallelRow[]
      } else {
        const { data: fallbackAlt } = await supabase
          .from('hoteles_parallel')
          .select('*')
          .limit(100)
        competitorRows = (fallbackAlt || []) as unknown as HotelParallelRow[]
      }
    }
    // eslint-disable-next-line no-console
    console.log('[compare/hotels] competitors fetched', { count: competitorRows.length })
    // eslint-disable-next-line no-console
    console.log('[compare/hotels] sample competitor data', competitorRows.slice(0, 3).map(row => ({
      nombre: row.nombre,
      ciudad: row.ciudad,
      hasRoomsJsonb: !!row.rooms_jsonb,
      hasRoomsJsnob: !!row.rooms_jsnob,
      estrellas: row.estrellas
    })))

    // Optional filter by star rating before processing
    const filteredByStars = selectedStars != null
      ? competitorRows.filter((row) => {
          const s = (row as any)?.estrellas
          const n = typeof s === 'string' ? Number.parseInt(s, 10) : (s as number | null | undefined)
          return Number.isFinite(n) && n === selectedStars
        })
      : competitorRows

    const competitors = filteredByStars
      .map((row) => {
        // Some rows store JSON as string
        let container: any = (row as any).rooms_jsonb ?? (row as any).rooms_jsnob
        if (typeof container === 'string') {
          try {
            container = JSON.parse(container)
          } catch {
            container = undefined
          }
        }
        // Try to get rooms for date candidates, but if none found, try any available date
        let rooms = pickRoomsForDate(container as any, dateCandidates) as Array<RoomPrice> | undefined
        
        // If no rooms found for today's candidates, try any available date as fallback
        if (!rooms || rooms.length === 0) {
          if (container && typeof container === 'object') {
            const allDates = Object.keys(container)
            if (allDates.length > 0) {
              // Take the most recent date available
              const mostRecentDate = allDates.sort().reverse()[0]
              rooms = container[mostRecentDate] as Array<RoomPrice> | undefined
            }
          }
        }
        
        if (!rooms || rooms.length === 0) return null
        const nums = rooms
          .map((r: RoomPrice) => parsePriceToNumber(r?.price))
          .filter((n: number | null): n is number => n != null)
        if (!nums.length) return null
        const avg = nums.reduce((a: number, b: number) => a + b, 0) / nums.length
        const s = (row as any)?.estrellas
        const estrellas = typeof s === 'string' ? Number.parseInt(s, 10) : (s as number | null | undefined)
        return { name: row.nombre || 'Hotel', avg, estrellas: Number.isFinite(estrellas as number) ? (estrellas as number) : null }
      })
      .filter(Boolean) as Array<{ name: string; avg: number; estrellas: number | null }>

    // eslint-disable-next-line no-console
    console.log('[compare/hotels] processed competitors', { 
      filteredByStarsCount: filteredByStars.length,
      processedCount: competitors.length,
      dateCandidates,
      sampleProcessed: competitors.slice(0, 3)
    })

    const competitorsCount = competitors.length
    const competitorsAvg = competitorsCount
      ? Math.round((competitors.reduce((a, b) => a + b.avg, 0) / competitorsCount) * 100) / 100
      : null

    // Ranking
    const allForRanking: Array<{ name: string; avg: number; isUser: boolean }> = []
    if (myAvg != null) allForRanking.push({ name: myHotelName, avg: myAvg, isUser: true })
    for (const c of competitors) allForRanking.push({ name: c.name, avg: c.avg, isUser: false })
    allForRanking.sort((a, b) => a.avg - b.avg)
    const position = myAvg != null
      ? allForRanking.findIndex((h) => h.isUser) + 1
      : null

    const today = canonicalToday

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
        starsFilter: selectedStars,
        debug: { 
          dateCandidates, 
          canonicalToday, 
          city,
          totalCompetitorRows: competitorRows.length,
          filteredByStarsCount: filteredByStars.length,
          processedCompetitorsCount: competitors.length,
          cityMetaRaw,
          userMetadata: md
        },
      },
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('compare/hotels error', error)
    return NextResponse.json({ success: false, error: 'Failed to compare' }, { status: 500 })
  }
}


