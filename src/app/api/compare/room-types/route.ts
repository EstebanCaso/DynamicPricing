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
    if (Object.prototype.hasOwnProperty.call(dict, c)) return (dict as Record<string, Array<{ room_type?: string; price?: string }>>)[c]
  }
  const entries = Object.keys(dict).map((k) => [k.trim(), (dict as Record<string, Array<{ room_type?: string; price?: string }>>)[k]] as const)
  for (const c of candidates) {
    const hit = entries.find(([k]) => k === c || new Date(k).toISOString().slice(0, 10) === c)
    if (hit) return hit[1]
  }
  return undefined
}

function standardizeRoomType(roomType: string): string {
  if (!roomType) return 'Standard'
  const normalized = roomType.toLowerCase().trim()
  if (normalized.includes('business')) return 'Business'
  if (normalized.includes('double') && normalized.includes('bed')) return 'Double Bed'
  if (normalized.includes('queen')) return 'Queen'
  if (normalized.includes('suite')) return 'Suite'
  if (normalized.includes('superior')) return 'Superior'
  if (normalized.includes('king')) return 'King'
  if (normalized.includes('single')) return 'Single'
  if (normalized.includes('twin')) return 'Twin'
  return 'Standard'
}

export async function POST(request: NextRequest) {
  const response = NextResponse.next()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
    {
      cookies: {
        get: (name: string) => request.cookies.get(name)?.value,
        set: (name: string, value: string, options: Record<string, unknown>) => {
          response.cookies.set({ name, value, ...options })
        },
        remove: (name: string, options: Record<string, unknown>) => {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  try {
    // Parse optional body for filters
    let selectedStars: number | null = null
    let selectedRoomType: string | null = null
    try {
      const body = await request.json()
      const maybe = Number(body?.stars)
      if (Number.isFinite(maybe) && maybe >= 1 && maybe <= 5) selectedStars = Math.trunc(maybe)
      if (body?.roomType && typeof body.roomType === 'string') selectedRoomType = body.roomType
    } catch {}
    
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const userId = user.id
    const cityMeta = (user.user_metadata?.city || user.user_metadata?.ciudad || '').toString()
    const city = cityMeta
    const dateCandidates = getDateCandidates()
    const canonicalToday = getCanonicalToday()

    // 1) My hotel prices by room type
    let myRows: unknown[] | null = null
    let myErr: unknown = null
    {
      const attempt = await supabase
        .from('Hotel_usuario')
        .select('hotel_name, room_type, price, date')
        .eq('user_id', userId)
        .eq('date', canonicalToday)
        .limit(500)
      if (!attempt.error && attempt.data && attempt.data.length >= 0) {
        myRows = attempt.data as unknown[]
      } else {
        myErr = attempt.error
      }
    }
    if (!myRows) {
      const fallback = await supabase
        .from('hotel_usuario')
        .select('hotel_name, room_type, price, checkin_date')
        .eq('user_id', userId)
        .eq('checkin_date', canonicalToday)
        .limit(500)
      if (!fallback.error && fallback.data) {
        myRows = fallback.data as unknown[]
      } else {
        myErr = myErr || fallback.error
      }
    }
    if (!myRows) throw myErr || new Error('Failed to fetch user hotel prices')

    const myHotelName = (myRows?.[0] as Record<string, unknown>)?.hotel_name || user.user_metadata?.hotel_name || 'Mi hotel'
    
    // Group my prices by room type
    const myPricesByType = new Map<string, number[]>()
    myRows.forEach((row: unknown) => {
      const roomType = standardizeRoomType((row as Record<string, unknown>)?.room_type as string)
      const price = parsePriceToNumber((row as Record<string, unknown>)?.price as string)
      if (price != null) {
        if (!myPricesByType.has(roomType)) {
          myPricesByType.set(roomType, [])
        }
        myPricesByType.get(roomType)!.push(price)
      }
    })

    // Calculate averages by room type
    const myRoomTypeAverages = new Map<string, number>()
    myPricesByType.forEach((prices, roomType) => {
      if (prices.length > 0) {
        const avg = prices.reduce((a, b) => a + b, 0) / prices.length
        myRoomTypeAverages.set(roomType, avg)
      }
    })

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

    // Optional filter by star rating before processing
    const filteredByStars = selectedStars != null
      ? competitorRows.filter((row) => {
          const s = (row as Record<string, unknown>)?.estrellas
          const n = typeof s === 'string' ? Number.parseInt(s, 10) : (s as number | null | undefined)
          return Number.isFinite(n) && n === selectedStars
        })
      : competitorRows

    // Process competitors by room type
    const competitorsByRoomType = new Map<string, Array<{ name: string; price: number; estrellas: number | null }>>()
    
    filteredByStars.forEach((row) => {
      let container: unknown = (row as Record<string, unknown>).rooms_jsonb ?? (row as Record<string, unknown>).rooms_jsnob
      if (typeof container === 'string') {
        try {
          container = JSON.parse(container)
        } catch {
          container = undefined
        }
      }
      
      const rooms = pickRoomsForDate(container as Record<string, Array<{ room_type?: string; price?: string }>> | null | undefined, [canonicalToday]) as Array<RoomPrice> | undefined
      if (!rooms || rooms.length === 0) return
      
      const s = (row as Record<string, unknown>)?.estrellas
      const estrellas = typeof s === 'string' ? Number.parseInt(s, 10) : (s as number | null | undefined)
      
             rooms.forEach((room) => {
         const price = parsePriceToNumber(room?.price)
         if (price != null) {
           const roomType = standardizeRoomType(room?.room_type || 'Standard')
           if (!competitorsByRoomType.has(roomType)) {
             competitorsByRoomType.set(roomType, [])
           }
           competitorsByRoomType.get(roomType)!.push({
             name: row.nombre || 'Hotel',
             price,
             estrellas: Number.isFinite(estrellas as number) ? (estrellas as number) : null
           })
         }
       })
    })

    // Calculate competitor averages by room type
    const competitorAveragesByType = new Map<string, number>()
    competitorsByRoomType.forEach((competitors, roomType) => {
      if (competitors.length > 0) {
        const avg = competitors.reduce((sum, comp) => sum + comp.price, 0) / competitors.length
        competitorAveragesByType.set(roomType, avg)
      }
    })

         // Get all available room types
     const allRoomTypes = new Set([
       ...Array.from(myRoomTypeAverages.keys()),
       ...Array.from(competitorAveragesByType.keys())
     ])

    // Filter by selected room type if specified
    const roomTypesToShow = selectedRoomType 
      ? [selectedRoomType].filter(type => allRoomTypes.has(type))
      : Array.from(allRoomTypes)

    // Prepare comparison data by room type
    const roomTypeComparison = roomTypesToShow.map(roomType => {
      const myPrice = myRoomTypeAverages.get(roomType) || null
      const competitorPrice = competitorAveragesByType.get(roomType) || null
      const competitors = competitorsByRoomType.get(roomType) || []
      
      // Calculate position for this room type
      let position = null
      if (myPrice != null) {
        const allPrices = [...competitors.map(c => c.price), myPrice].sort((a, b) => a - b)
        position = allPrices.indexOf(myPrice) + 1
      }

      return {
        roomType,
        myPrice,
        competitorPrice,
        competitorsCount: competitors.length,
        position,
        priceDifference: myPrice != null && competitorPrice != null ? myPrice - competitorPrice : null,
        percentageDifference: myPrice != null && competitorPrice != null 
          ? ((myPrice - competitorPrice) / competitorPrice) * 100 
          : null
      }
    })

    const today = canonicalToday

    return NextResponse.json({
      success: true,
      data: {
        today,
        userId,
        city,
        myHotelName,
        roomTypeComparison,
        totalRoomTypes: roomTypesToShow.length,
        starsFilter: selectedStars,
        roomTypeFilter: selectedRoomType,
        debug: process.env.NODE_ENV !== 'production' ? { dateCandidates, canonicalToday } : undefined,
      },
    })
  } catch (error) {
    console.error('compare/room-types error', error)
    return NextResponse.json({ success: false, error: 'Failed to compare room types' }, { status: 500 })
  }
}
