import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { standardizeRoomType, groupRoomsByStandardizedType, standardizeCompetitorRoomTypes, standardizeHotelRoomTypes, type StandardizedRoomType } from '@/lib/roomTypeStandardization'
import { formatCurrencyCard } from '@/lib/currencyFormatting'

// ===== TYPES =====
interface CompetitorPricingData {
  roomType: StandardizedRoomType
  originalRoomType: string
  competitorPrices: number[]
  medianPrice: number
  currentPrice: number
  suggestedPrice: number
  eventMultiplier: number
  finalPrice: number
  minPrice?: number
  maxPrice?: number
  reasoning: string[]
}

interface PricingResult {
  date: string
  roomTypes: CompetitorPricingData[]
  totalAdjustments: number
  summary: string
}

// ===== ROOM TYPE MAPPING =====
const ROOM_TYPE_MAPPING: Record<string, string[]> = {
  'double': ['doble', 'double', 'twin', 'matrimonial'],
  'suite': ['suite', 'junior suite', 'presidential suite'],
  'standard': ['regular', 'standard', 'classic', 'basic'],
  'deluxe': ['deluxe', 'superior', 'premium', 'executive'],
  'single': ['single', 'king', 'queen', 'individual']
}

// ===== PRICE PARSING =====
function parsePriceToNumber(text?: string | number | null): number | null {
  if (text == null) return null
  if (typeof text === 'number') return Number.isFinite(text) ? text : null
  
  // Remove currency symbols and spaces, keep digits, dots and commas
  let cleaned = text.toString().replace(/[^0-9.,-]/g, '')
  
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

// ===== ROOM TYPE SIMILARITY =====
function findSimilarRoomType(targetType: string, availableTypes: string[]): string | null {
  const normalizedTarget = targetType.toLowerCase().trim()
  
  // Direct match
  if (availableTypes.includes(normalizedTarget)) {
    return normalizedTarget
  }
  
  // Check mapping
  for (const [key, variations] of Object.entries(ROOM_TYPE_MAPPING)) {
    if (variations.some(v => v.toLowerCase() === normalizedTarget)) {
      // Find matching variation in available types
      for (const variation of variations) {
        if (availableTypes.includes(variation.toLowerCase())) {
          return variation.toLowerCase()
        }
      }
    }
  }
  
  // Fuzzy matching
  for (const availableType of availableTypes) {
    const normalizedAvailable = availableType.toLowerCase()
    if (normalizedTarget.includes(normalizedAvailable) || normalizedAvailable.includes(normalizedTarget)) {
      return availableType
    }
  }
  
  return null
}

// ===== MAIN API FUNCTION =====
export async function POST(request: NextRequest) {
  try {
    const { targetDate, hotelId } = await request.json()
    
    if (!targetDate || !hotelId) {
      return NextResponse.json(
        { error: 'Missing targetDate or hotelId' },
        { status: 400 }
      )
    }

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookies().get(name)?.value
          },
        },
      }
    )

    console.log(`🤖 Starting competitor-driven pricing analysis for ${targetDate}`)

    // 1. Get hotel's current room types and prices
    const { data: hotelData, error: hotelError } = await supabase
      .from('hotel_usuario')
      .select('room_type, price, hotel_name')
      .eq('user_id', hotelId)
      .eq('checkin_date', targetDate)
      .not('room_type', 'is', null)

    if (hotelError) {
      console.error('Error fetching hotel data:', hotelError)
      return NextResponse.json({ error: 'Failed to fetch hotel data' }, { status: 500 })
    }

    if (!hotelData || hotelData.length === 0) {
      return NextResponse.json({ error: 'No hotel data found for the specified date' }, { status: 404 })
    }

    // Standardize hotel room types
    const standardizedHotelData = standardizeHotelRoomTypes(hotelData)
    console.log(`🏨 Standardized ${hotelData.length} hotel room types`)

    // 2. Get competitor data
    const { data: competitorData, error: compError } = await supabase
      .from('hoteles_parallel')
      .select('nombre, rooms_jsonb, ciudad, estrellas')
      .not('rooms_jsonb', 'is', null)

    if (compError) {
      console.error('Error fetching competitor data:', compError)
      return NextResponse.json({ error: 'Failed to fetch competitor data' }, { status: 500 })
    }

    // Standardize competitor room types
    const standardizedCompetitorData = competitorData?.map(comp => standardizeCompetitorRoomTypes(comp)) || []
    console.log(`🏨 Standardized ${standardizedCompetitorData.length} competitor room types`)

    // 3. Get events for the date (optional)
    const { data: eventsData, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .eq('date', targetDate)
      .limit(10)

    // Also check eventos table
    const { data: eventosData, error: eventosError } = await supabase
      .from('eventos')
      .select('*')
      .eq('fecha', targetDate)
      .limit(10)

    const allEvents = [...(eventsData || []), ...(eventosData || [])]
    console.log(`📅 Found ${allEvents.length} events for ${targetDate}`)

    // 4. Group hotel data by standardized room types
    const groupedHotelData = groupRoomsByStandardizedType(standardizedHotelData)
    const roomTypeResults: CompetitorPricingData[] = []

    // Process each standardized room type
    for (const [standardizedRoomType, hotelRecords] of Object.entries(groupedHotelData)) {
      if (hotelRecords.length === 0) continue

      const roomType = standardizedRoomType as StandardizedRoomType
      const currentPrice = parsePriceToNumber(hotelRecords[0].price)
      const originalRoomType = hotelRecords[0].original_room_type || hotelRecords[0].room_type
      
      if (currentPrice === null) continue

      console.log(`🏨 Processing standardized room type: ${roomType} (original: ${originalRoomType}, current: ${currentPrice} MXN)`)

      // 5. Find competitor prices for this standardized room type
      const competitorPrices: number[] = []
      
      for (const competitor of standardizedCompetitorData) {
        if (!competitor.rooms_jsonb || typeof competitor.rooms_jsonb !== 'object') continue
        
        const dateRooms = competitor.rooms_jsonb[targetDate]
        if (!Array.isArray(dateRooms)) continue
        
        for (const room of dateRooms) {
          if (!room.room_type || !room.price) continue
          
          // Check if competitor room type matches our standardized room type
          if (room.room_type === roomType) {
            const price = parsePriceToNumber(room.price)
            if (price !== null) {
              competitorPrices.push(price)
              console.log(`   📊 Competitor ${competitor.nombre}: ${room.original_room_type || room.room_type} → ${roomType} = ${price} MXN`)
            }
          }
        }
      }

      // 6. Calculate median competitor price
      const medianPrice = competitorPrices.length > 0 
        ? competitorPrices.sort((a, b) => a - b)[Math.floor(competitorPrices.length / 2)]
        : 1928.21 // Market average fallback

      console.log(`   📈 Found ${competitorPrices.length} competitor prices, median: ${medianPrice} MXN`)

      // 7. Apply pricing rules
      let suggestedPrice = medianPrice
      let eventMultiplier = 1.0
      const reasoning: string[] = []

      // Base competitor-based pricing
      if (competitorPrices.length > 0) {
        // Undercut by 3% and round to nearest 10
        suggestedPrice = Math.round((medianPrice * 0.97) / 10) * 10
        reasoning.push(`Competitor median: ${formatCurrencyCard(medianPrice)}, undercut by 3%: ${formatCurrencyCard(suggestedPrice)}`)
      } else {
        suggestedPrice = Math.round((1928.21 * 0.97) / 10) * 10 // Market average fallback
        reasoning.push(`No competitors found, using market average (${formatCurrencyCard(1928.21)}) with 3% undercut: ${formatCurrencyCard(suggestedPrice)}`)
      }

      // Apply event markup if significant events exist
      if (allEvents.length > 0) {
        // Simple event impact calculation
        const eventImpact = Math.min(1.2, 1 + (allEvents.length * 0.05)) // Max 20% increase
        eventMultiplier = eventImpact
        suggestedPrice = Math.round((suggestedPrice * eventMultiplier) / 10) * 10
        reasoning.push(`${allEvents.length} events detected, applying ${((eventMultiplier - 1) * 100).toFixed(1)}% markup: ${formatCurrencyCard(suggestedPrice)}`)
      } else {
        reasoning.push(`No events detected, pricing based on competitor analysis only`)
      }

      // 8. Apply min/max constraints (if room_types table exists)
      let finalPrice = suggestedPrice
      let minPrice: number | undefined
      let maxPrice: number | undefined

      // Try to get min/max prices from room_types table
      try {
        const { data: roomTypeData } = await supabase
          .from('room_types')
          .select('min_price, max_price')
          .eq('nombre', roomType)
          .eq('fecha', targetDate)
          .limit(1)

        if (roomTypeData && roomTypeData.length > 0) {
          minPrice = roomTypeData[0].min_price
          maxPrice = roomTypeData[0].max_price
          
          if (minPrice !== null && finalPrice < minPrice) {
            finalPrice = minPrice
            reasoning.push(`Applied minimum price constraint: ${formatCurrencyCard(finalPrice)}`)
          }
          if (maxPrice !== null && finalPrice > maxPrice) {
            finalPrice = maxPrice
            reasoning.push(`Applied maximum price constraint: ${formatCurrencyCard(finalPrice)}`)
          }
        }
      } catch (error) {
        console.log(`Room_types table not found or error accessing it: ${error}`)
      }

      // Ensure reasonable bounds
      finalPrice = Math.max(500, Math.min(5000, finalPrice))

      roomTypeResults.push({
        roomType,
        originalRoomType,
        competitorPrices,
        medianPrice,
        currentPrice,
        suggestedPrice,
        eventMultiplier,
        finalPrice,
        minPrice,
        maxPrice,
        reasoning
      })

      console.log(`   ✅ Final price for ${roomType}: ${finalPrice} MXN (was ${currentPrice} MXN)`)
    }

    // 9. Update database with final prices
    const updatePromises = roomTypeResults.map(async (result) => {
      try {
        // Update hotel_usuario with final price (use original room type for database update)
        const { error: updateError } = await supabase
          .from('hotel_usuario')
          .update({ 
            price: result.finalPrice.toString(),
            ajuste_aplicado: true 
          })
          .eq('user_id', hotelId)
          .eq('checkin_date', targetDate)
          .eq('room_type', result.originalRoomType)

        if (updateError) {
          console.error(`Error updating hotel_usuario for ${result.roomType}:`, updateError)
        }

        // Try to update room_types table if it exists
        try {
          const { error: roomTypeError } = await supabase
            .from('room_types')
            .upsert({
              nombre: result.originalRoomType,
              standardized_type: result.roomType,
              fecha: targetDate,
              final_price: result.finalPrice,
              min_price: result.minPrice || null,
              max_price: result.maxPrice || null,
              updated_at: new Date().toISOString()
            })

          if (roomTypeError) {
            console.log(`Room_types table update failed (table may not exist): ${roomTypeError}`)
          }
        } catch (error) {
          console.log(`Room_types table not accessible: ${error}`)
        }
      } catch (error) {
        console.error(`Error updating ${result.roomType}:`, error)
      }
    })

    await Promise.all(updatePromises)

    // 10. Generate summary
    const totalAdjustments = roomTypeResults.length
    const summary = `Analyzed ${totalAdjustments} room types for ${targetDate}. ` +
      `Found ${competitorData?.length || 0} competitors and ${allEvents.length} events. ` +
      `Applied competitor-driven pricing with ${allEvents.length > 0 ? 'event markup' : 'no event impact'}.`

    const result: PricingResult = {
      date: targetDate,
      roomTypes: roomTypeResults,
      totalAdjustments,
      summary
    }

    console.log(`✅ Competitor-driven pricing analysis completed: ${summary}`)

    return NextResponse.json({
      success: true,
      data: result
    })

  } catch (error) {
    console.error('Error in competitor pricing analysis:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
