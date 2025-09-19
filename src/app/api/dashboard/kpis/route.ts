import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

function formatDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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

export async function GET(request: NextRequest) {
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
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const now = new Date()
    const today = formatDate(now)
    
    // Calculate date ranges
    const oneMonthAgo = new Date(now)
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
    const oneMonthAgoStr = formatDate(oneMonthAgo)
    
    const twoMonthsAgo = new Date(now)
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2)
    const twoMonthsAgoStr = formatDate(twoMonthsAgo)
    
    const oneWeekAgo = new Date(now)
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    const oneWeekAgoStr = formatDate(oneWeekAgo)
    
    const twoWeeksAgo = new Date(now)
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    const twoWeeksAgoStr = formatDate(twoWeeksAgo)

    // 1. REVENUE CALCULATION - Sum of all available rooms from user hotel data
    // Try Hotel_usuario first (with date), then fallback to hotel_usuario (with checkin_date)
    let currentMonthData: any = null
    let previousMonthData: any = null

    // Try new schema first
    const [currentHotelData, previousHotelData] = await Promise.all([
      supabase
        .from('Hotel_usuario')
        .select('hotel_name, room_type, price, date')
        .eq('user_id', user.id)
        .gte('date', oneMonthAgoStr)
        .lte('date', today),
      supabase
        .from('Hotel_usuario')
        .select('hotel_name, room_type, price, date')
        .eq('user_id', user.id)
        .gte('date', twoMonthsAgoStr)
        .lt('date', oneMonthAgoStr)
    ])

    // Use new schema if available, otherwise fallback to old schema
    if (!currentHotelData.error && currentHotelData.data && currentHotelData.data.length > 0) {
      currentMonthData = currentHotelData
      previousMonthData = previousHotelData
    } else {
      // Fallback to old schema
      const [currentFallback, previousFallback] = await Promise.all([
        supabase
          .from('hotel_usuario')
          .select('hotel_name, room_type, price, checkin_date')
          .eq('user_id', user.id)
          .gte('checkin_date', oneMonthAgoStr)
          .lte('checkin_date', today),
        supabase
          .from('hotel_usuario')
          .select('hotel_name, room_type, price, checkin_date')
          .eq('user_id', user.id)
          .gte('checkin_date', twoMonthsAgoStr)
          .lt('checkin_date', oneMonthAgoStr)
      ])
      currentMonthData = currentFallback
      previousMonthData = previousFallback
    }

    // Helper function to extract prices from hotel data
    const extractPricesFromRooms = (data: any[]) => {
      const prices: number[] = []
      data.forEach(item => {
        // Check if data has rooms_jsonb structure (from some tables)
        if (item.rooms_jsonb) {
          Object.values(item.rooms_jsonb).forEach((rooms: any) => {
            if (Array.isArray(rooms)) {
              rooms.forEach((room: any) => {
                const price = parsePriceToNumber(room.price)
                if (price && price > 0) {
                  prices.push(price)
                }
              })
            }
          })
        } 
        // Check if data has direct price field (from hotel_usuario/Hotel_usuario tables)
        else if (item.price) {
          const price = parsePriceToNumber(item.price)
          if (price && price > 0) {
            prices.push(price)
          }
        }
      })
      return prices
    }

    // Calculate revenue based on ACTUAL user data
    const currentMonthPrices = extractPricesFromRooms(currentMonthData.data || [])
    const previousMonthPrices = extractPricesFromRooms(previousMonthData.data || [])
    
    let currentMonthRevenue, previousMonthRevenue
    
    if (currentMonthPrices.length > 0) {
      // Use real data - sum of actual room prices scraped
      // This represents the total potential revenue from all available room types
      currentMonthRevenue = currentMonthPrices.reduce((sum, price) => sum + price, 0)
      previousMonthRevenue = previousMonthPrices.length > 0 
        ? previousMonthPrices.reduce((sum, price) => sum + price, 0)
        : currentMonthRevenue * 0.95 // Assume 5% growth if no previous data
    } else {
      // Demo fallback with realistic data for a boutique hotel
      // Generate realistic monthly revenue based on hotel size and market
      const daysInMonth = 30
      const avgRoomsPerDay = 8 // Small boutique hotel with 8-12 rooms
      const occupancyRate = 0.75 // 75% occupancy
      const avgDailyRate = 125 // USD base rate
      
      const dailyRevenue = avgRoomsPerDay * occupancyRate * avgDailyRate
      currentMonthRevenue = dailyRevenue * daysInMonth
      
      // Previous month slightly lower
      previousMonthRevenue = currentMonthRevenue * (0.88 + Math.random() * 0.15) // 88-103% of current
    }

    // Calculate month-over-month growth
    const revenueGrowthPercent = previousMonthRevenue === 0
      ? (currentMonthRevenue > 0 ? 100 : 0)
      : Math.round(((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 1000) / 10

    // 2. MARKET POSITION
    // Call the compare/hotels API to get market position
    const compareResponse = await fetch(`${request.nextUrl.origin}/api/compare/hotels`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('cookie') || ''
      },
      body: JSON.stringify({ stars: null })
    })

    let marketPosition = null
    let totalCompetitors = 0
    let avgPrice = 0

    if (compareResponse.ok) {
      const compareData = await compareResponse.json()
      if (compareData.success) {
        marketPosition = compareData.data.position
        totalCompetitors = compareData.data.competitorsCount + 1 // +1 for our hotel
        avgPrice = compareData.data.myAvg || 0
      }
    }

    // 3. OCCUPANCY CALCULATION
    // TODO: Implement real occupancy calculation when occupancy data is available
    // For now, return null to indicate no data available
    const occupancyRate = null
    const occupancyGrowthPercent = null
    const currentWeekBookings = 0

    // 4. ADR (Average Daily Rate) - Use exact same value as Market Position for consistency
    const adr = avgPrice || 0

    const isRealRevenueData = currentMonthPrices.length > 0
    
    return NextResponse.json({
      success: true,
      data: {
        revenue: {
          current: Math.round(currentMonthRevenue * 100) / 100,
          growth: revenueGrowthPercent,
          currency: 'MXN', // Always return in MXN (hotel's base currency), frontend will convert
          isRealData: isRealRevenueData,
          dataSource: isRealRevenueData ? 'hotel_usuario' : 'demo_calculation',
          methodology: isRealRevenueData ? 
            `Based on ${currentMonthPrices.length} real room prices from your hotel data` :
            'Estimated based on Mexico City hotel market averages'
        },
        marketPosition: {
          rank: marketPosition,
          total: totalCompetitors,
          percentile: marketPosition && totalCompetitors > 0 
            ? Math.round((1 - (marketPosition - 1) / (totalCompetitors - 1)) * 100)
            : null
        },
        occupancy: {
          rate: occupancyRate,
          growth: occupancyGrowthPercent,
          bookings: currentWeekBookings,
          hasData: false
        },
        adr: {
          current: Math.round(adr * 100) / 100,
          currency: 'MXN' // Always return in MXN (hotel's base currency), frontend will convert
        },
        dataFreshness: {
          lastUpdated: today,
          dataPoints: {
            revenueRecords: currentMonthPrices.length,
            competitorData: totalCompetitors > 0,
            occupancyRecords: currentWeekBookings
          }
        }
      }
    })

  } catch (error) {
    console.error('Error calculating KPIs:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to calculate KPIs' 
    }, { status: 500 })
  }
}
