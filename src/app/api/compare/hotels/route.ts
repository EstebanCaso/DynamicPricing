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

function standardizeRoomType(roomType?: string | null): string {
  if (!roomType) return 'Other';
  const lowerRoomType = roomType.toLowerCase();
  
  // Spanish keywords
  if (lowerRoomType.includes('doble') || lowerRoomType.includes('2 camas')) return 'Double Room';
  if (lowerRoomType.includes('sencilla') || lowerRoomType.includes('individual')) return 'Single Room';
  if (lowerRoomType.includes('king')) return 'King Room';
  if (lowerRoomType.includes('queen')) return 'Queen Room';
  if (lowerRoomType.includes('suite')) return 'Suite';
  if (lowerRoomType.includes('estudio')) return 'Studio';
  
  // English keywords
  if (lowerRoomType.includes('double') || lowerRoomType.includes('two beds')) return 'Double Room';
  if (lowerRoomType.includes('single')) return 'Single Room';

  return 'Other';
}

function parseStarsToNumber(stars: unknown): number | null {
  if (stars === null || stars === undefined) return null;
  if (typeof stars === 'number' && Number.isFinite(stars)) return Math.round(stars);
  if (typeof stars === 'string') {
    const match = stars.match(/\d/);
    if (match) {
      return parseInt(match[0], 10);
    }
  }
  return null;
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
      const maybeStars = Number(body?.stars)
      if (Number.isFinite(maybeStars) && maybeStars >= 1 && maybeStars <= 5) selectedStars = Math.trunc(maybeStars)
      if (typeof body?.roomType === 'string' && body.roomType !== 'All') {
        selectedRoomType = body.roomType
      }
    } catch {}
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })

    const userId = user.id
    // Resolve city from nested user metadata
    const md: Record<string, unknown> = user.user_metadata || {}
    const cityMetaRaw =
      (md as any)?.hotel_info?.address?.cityName ||
      (md as any)?.hotel_metadata?.address?.cityName ||
      (md as any)?.address?.cityName ||
      (md as any)?.cityName ||
      (md as any)?.ciudad ||
      (md as any)?.raw_user_meta_data?.hotel_info?.address?.cityName ||
      (md as any)?.raw_user_meta_data?.hotel_metadata?.address?.cityName ||
      (md as any)?.raw_user_meta_data?.cityName ||
      ''
    const city = cityMetaRaw ? String(cityMetaRaw).trim() : ''
    const dateCandidates = getDateCandidates()
    const canonicalToday = getCanonicalToday()
    // Debug context
    // eslint-disable-next-line no-console
    console.log('[compare/hotels] inputs', { userId, city, dateCandidates, selectedRoomType })
    // eslint-disable-next-line no-console
    console.log('[compare/hotels] user metadata', { 
      hotel_metadata: md?.hotel_metadata, 
      address: md?.address, 
      cityName: md?.cityName, 
      ciudad: md?.ciudad,
      raw_user_meta_data: md?.raw_user_meta_data 
    })

    // 1) My hotel prices (only rows for canonical "today"): try Hotel_usuario(date, price) then fall back to hotel_usuario(checkin_date, price)
    let myRows: unknown[] | null = null
    let myErr: unknown = null
    {
      const attempt = await supabase
        .from('Hotel_usuario')
        .select('hotel_name, price, date, room_type')
        .eq('user_id', userId)
        .in('date', dateCandidates)
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
        .select('hotel_name, price, checkin_date, room_type')
        .eq('user_id', userId)
        .in('checkin_date', dateCandidates)
        .limit(500)
      if (!fallback.error && fallback.data) {
        myRows = fallback.data as unknown[]
      } else {
        myErr = myErr || fallback.error
      }
    }
    if (!myRows) throw myErr || new Error('Failed to fetch user hotel prices')

    const allRoomTypes = new Set<string>();
    myRows.forEach((r: unknown) => {
      const row = r as Record<string, unknown>;
      if(row.room_type) {
        const standardized = standardizeRoomType(row.room_type as string);
        if (standardized !== 'Other') {
          allRoomTypes.add(standardized);
        }
      }
    });

    const myHotelName = (myRows?.[0] as Record<string, unknown>)?.hotel_name || user.user_metadata?.hotel_name || 'Mi hotel'
    
    const myFilteredRows = selectedRoomType 
      ? myRows.filter((r: unknown) => {
          const row = r as Record<string, unknown>;
          return standardizeRoomType(row.room_type as string) === selectedRoomType;
        })
      : myRows;

    const myPrices = (myFilteredRows || [])
      .map((r: unknown) => parsePriceToNumber((r as Record<string, unknown>)?.price as string))
      .filter((n: number | null): n is number => n != null)
    const myAvg = myPrices.length ? myPrices.reduce((a: number, b: number) => a + b, 0) / myPrices.length : null

    // 2) Competitors from hotels_parallel/hoteles_parallel filtered by city
    let competitorRows: HotelParallelRow[] = []
    
    // Filter competitors by city - only show hotels from the same city as the user
    if (!city) {
      console.log('[compare/hotels] No city found in user metadata, cannot filter competitors')
      competitorRows = []
    } else {
      // Use exact city match instead of ILIKE with wildcards for more precise filtering
      const cityFilter = city.trim().toUpperCase()
      
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
      
      // If no results with exact city match, try partial match as fallback
      if (competitorRows.length === 0) {
        console.log('[compare/hotels] No competitors found with exact city match, trying partial match...')
        const partialCityFilter = `%${cityFilter}%`
        
        const { data: partialHotels } = await supabase
          .from('hotels_parallel')
          .select('*')
          .ilike('ciudad', partialCityFilter)
          .limit(1000)
        if (partialHotels && partialHotels.length > 0) {
          competitorRows = partialHotels as unknown as HotelParallelRow[]
        } else {
          const { data: partialAlt } = await supabase
            .from('hoteles_parallel')
            .select('*')
            .ilike('ciudad', partialCityFilter)
            .limit(1000)
          competitorRows = (partialAlt || []) as unknown as HotelParallelRow[]
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log('[compare/hotels] competitors fetched', { 
      count: competitorRows.length,
      city: city,
      cityFilter: city ? city.trim().toUpperCase() : 'N/A'
    })
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
          const s = (row as Record<string, unknown>)?.estrellas
          const n = parseStarsToNumber(s);
          return Number.isFinite(n) && n === selectedStars
        })
      : competitorRows

    const competitors = filteredByStars
      .map((row) => {
        // Some rows store JSON as string
        let container: unknown = (row as Record<string, unknown>).rooms_jsonb ?? (row as Record<string, unknown>).rooms_jsnob
        if (typeof container === 'string') {
          try {
            container = JSON.parse(container)
          } catch {
            container = undefined
          }
        }
        // Try to get rooms for date candidates, but if none found, try any available date
        const rooms = pickRoomsForDate(container as Record<string, Array<{ room_type?: string; price?: string }>> | null | undefined, dateCandidates) as Array<RoomPrice> | undefined
        
        if (!rooms || rooms.length === 0) return null

        rooms.forEach(r => {
            if(r.room_type) {
              const standardized = standardizeRoomType(r.room_type);
              if (standardized !== 'Other') {
                allRoomTypes.add(standardized);
              }
            }
        });

        const filteredRooms = selectedRoomType
            ? rooms.filter(r => standardizeRoomType(r.room_type) === selectedRoomType)
            : rooms;

        if (!filteredRooms || filteredRooms.length === 0) return null;

        const nums = filteredRooms
          .map((r: RoomPrice) => parsePriceToNumber(r?.price))
          .filter((n: number | null): n is number => n != null)
        if (!nums.length) return null
        const avg = nums.reduce((a: number, b: number) => a + b, 0) / nums.length
        const s = (row as Record<string, unknown>)?.estrellas
        
        console.log(`[DIAGNOSTIC] Raw 'estrellas' value for hotel ${row.nombre}:`, s, `(type: ${typeof s})`);

        const estrellas = parseStarsToNumber(s);
        return { name: row.nombre || 'Hotel', avg, estrellas }
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
        roomTypes: Array.from(allRoomTypes).sort(),
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


