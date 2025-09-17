import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

interface CompetitorData {
  id: string
  name: string
  stars: number
  city: string
  location: string
  roomTypes: RoomTypeData[]
  avgPrice: number
  revpar: number
}

interface RoomTypeData {
  roomType: string
  price: number
  date: string
}

interface UserHotelData {
  hotelName: string
  roomTypes: RoomTypeData[]
  avgPrice: number
  stars: number
  revpar: number
}

export async function POST(request: NextRequest) {
  const response = NextResponse.next()
  
  try {
    // Log the request for debugging
    console.log('Competitors API called with headers:', Object.fromEntries(request.headers.entries()))
    
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '',
      {
        cookies: {
          get: (name: string) => {
            const cookie = request.cookies.get(name)?.value
            console.log(`Cookie ${name}:`, cookie ? 'present' : 'missing')
            return cookie
          },
          set: (name: string, value: string, options: Record<string, unknown>) => {
            response.cookies.set({ name, value, ...options })
          },
          remove: (name: string, options: Record<string, unknown>) => {
            response.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )

    // Get authenticated user
    console.log('Attempting to get user...')
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError) {
      console.error('User authentication error:', userError)
      return NextResponse.json({ 
        success: false, 
        error: `Authentication error: ${userError.message}` 
      }, { status: 401 })
    }
    
    if (!user) {
      console.log('No user found in request')
      return NextResponse.json({ 
        success: false, 
        error: 'No authenticated user found. Please log in.' 
      }, { status: 401 })
    }

    console.log('User authenticated:', user.id)

    // Parse request body for filters
    const body = await request.json()
    const { 
      selectedStars, 
      selectedRoomType, 
      selectedDateRange,
      city 
    } = body

    console.log('Request filters:', { selectedStars, selectedRoomType, selectedDateRange, city })

    // Get user's city from metadata or request
    const userMetadata = user.user_metadata || {}
    const rawUserMetadata = userMetadata.raw_user_meta_data || {}
    
    // Try multiple paths to get the city from user metadata
    const userCity = city || 
      rawUserMetadata.hotel_metadata?.address?.cityName ||
      userMetadata.hotel_metadata?.address?.cityName ||
      userMetadata.address?.cityName ||
      userMetadata.cityName ||
      userMetadata.ciudad ||
      'Tijuana'
    
    console.log('User metadata:', userMetadata)
    console.log('Raw user metadata:', rawUserMetadata)
    console.log('Using city:', userCity)
    
    // Get current date for analysis
    const currentDate = new Date().toISOString().split('T')[0]
    console.log('Analysis date:', currentDate)
    
    // 1. Fetch user's hotel data
    console.log('Fetching user hotel data...')
    const { data: userHotelData, error: userHotelError } = await supabase
      .from('hotel_usuario')
      .select('*')
      .eq('user_id', user.id)
      .eq('checkin_date', currentDate)

    if (userHotelError) {
      console.error('Error fetching user hotel data:', userHotelError)
      return NextResponse.json({ 
        success: false, 
        error: `Failed to fetch user hotel data: ${userHotelError.message}` 
      }, { status: 500 })
    }

    console.log('User hotel data found:', userHotelData?.length || 0, 'records')

    // Process user hotel data
    const userHotel: UserHotelData = {
      hotelName: userHotelData?.[0]?.hotel_name || 'Your Hotel',
      roomTypes: userHotelData?.map(room => ({
        roomType: room.room_type,
        price: parseFloat(room.price),
        date: room.checkin_date
      })) || [],
      avgPrice: userHotelData?.length ? 
        userHotelData.reduce((sum, room) => sum + parseFloat(room.price), 0) / userHotelData.length : 0,
      stars: userHotelData?.[0]?.estrellas || 4,
      revpar: 0 // Will be calculated below
    }

    // Calculate RevPAR for user hotel (assume 85% occupancy for now)
    const occupancyRate = 0.85
    userHotel.revpar = userHotel.avgPrice * occupancyRate

    console.log('User hotel processed:', userHotel)

    // 2. Fetch competitor data
    console.log('Fetching competitor data...')
    
    // Try hoteles_parallel first (your main competitor data), then fallback to hotels_parallel
    let competitorData = null
    let competitorError = null
    
    // First attempt: hoteles_parallel (your main data)
    try {
      let competitorQuery = supabase
        .from('hoteles_parallel')
        .select('*')

      // Try to filter by city, but if ciudad column is empty, get all hotels
      // We'll filter by city name in the hotel name or other fields later
      if (userCity && userCity !== 'Tijuana') {
        competitorQuery = competitorQuery.or(`ciudad.ilike.%${userCity}%,nombre.ilike.%${userCity}%`)
      }

      // Apply star rating filter if specified
      if (selectedStars && selectedStars !== 'All') {
        competitorQuery = competitorQuery.eq('estrellas', parseInt(selectedStars))
      }

      const result = await competitorQuery
      competitorData = result.data
      competitorError = result.error
      
      if (competitorData && competitorData.length > 0) {
        console.log(`✅ Found ${competitorData.length} competitors in hoteles_parallel`)
      } else {
        console.log('⚠️  No competitors found in hoteles_parallel, trying hotels_parallel...')
      }
    } catch {
      console.log('⚠️  Error with hoteles_parallel, trying hotels_parallel...')
    }
    
    // Fallback: hotels_parallel if hoteles_parallel failed or has no data
    if (!competitorData || competitorData.length === 0) {
      try {
        let competitorQuery = supabase
          .from('hotels_parallel')
          .select('*')

        // Try to filter by city, but if ciudad column is empty, get all hotels
        if (userCity && userCity !== 'Tijuana') {
          competitorQuery = competitorQuery.or(`ciudad.ilike.%${userCity}%,nombre.ilike.%${userCity}%`)
        }

        // Apply star rating filter if specified
        if (selectedStars && selectedStars !== 'All') {
          competitorQuery = competitorQuery.eq('estrellas', parseInt(selectedStars))
        }

        const result = await competitorQuery
        competitorData = result.data
        competitorError = result.error
        
        if (competitorData && competitorData.length > 0) {
          console.log(`✅ Found ${competitorData.length} competitors in hotels_parallel (fallback)`)
        }
      } catch {
        console.log('⚠️  Error with hotels_parallel fallback')
      }
    }

    if (competitorError) {
      console.error('Error fetching competitor data:', competitorError)
      return NextResponse.json({ 
        success: false, 
        error: `Failed to fetch competitor data: ${competitorError.message}` 
      }, { status: 500 })
    }

    if (!competitorData || competitorData.length === 0) {
      console.log('⚠️  No competitor data found in either table')
      // Return empty competitors array instead of error
      competitorData = []
    }

    console.log('Competitor data found:', competitorData.length, 'hotels')

    // Process competitor data
    const competitors: CompetitorData[] = (competitorData || [])
      .map(hotel => {
        try {
          // Handle different table structures
          const hotelName = hotel.nombre || hotel.name || 'Unknown Hotel'
          let hotelCity = hotel.ciudad || hotel.city || 'Unknown City'
          const hotelStars = hotel.estrellas || hotel.stars || 3
          let hotelLocation = hotel.ubicacion || hotel.location || ''
          
          // If ciudad is empty or "EMPTY", try to extract city from hotel name
          if (!hotelCity || hotelCity === 'EMPTY' || hotelCity === 'Unknown City') {
            // Try to extract city from hotel name (e.g., "Homewood Suites By Hilton Chula Vista E" -> "Chula Vista")
            const possibleCities = ['Tijuana', 'Chula Vista', 'San Diego', 'Ensenada', 'Mexicali']
            for (const city of possibleCities) {
              if (hotelName.toLowerCase().includes(city.toLowerCase())) {
                hotelCity = city
                break
              }
            }
            // If still no city, use the user's city
            if (!hotelCity || hotelCity === 'EMPTY' || hotelCity === 'Unknown City') {
              hotelCity = userCity
            }
          }
          
          // If ubicacion is empty, use the city as location
          if (!hotelLocation || hotelLocation === 'EMPTY') {
            hotelLocation = hotelCity
          }
          
          // Parse rooms_jsonb to get room types and prices
          let roomsJson = hotel.rooms_jsonb
          if (typeof roomsJson === 'string') {
            try {
              roomsJson = JSON.parse(roomsJson)
            } catch {
              roomsJson = {}
            }
          }

          // Get room data for current date
          const currentDateRooms = roomsJson?.[currentDate] || []
          
          // Handle different room data structures
          const roomTypes: RoomTypeData[] = currentDateRooms.map((room: Record<string, unknown>) => {
            // Handle both room structures
            const roomType = room.room_type || room.type || room.roomType || 'Standard'
            const price = room.price || room.rate || 0
            
            return {
              roomType: roomType,
              price: parseFloat(price as string) || 0,
              date: currentDate
            }
          })

          // Filter by room type if specified
          const filteredRoomTypes = selectedRoomType && selectedRoomType !== 'All Types' ?
            roomTypes.filter(room => room.roomType === selectedRoomType) :
            roomTypes

          if (filteredRoomTypes.length === 0) {
            console.log(`⚠️  No room data for ${hotelName} on ${currentDate}`)
            return null
          }

          const avgPrice = filteredRoomTypes.reduce((sum, room) => sum + room.price, 0) / filteredRoomTypes.length
          
          // Only include hotels with valid prices
          if (avgPrice <= 0 || isNaN(avgPrice)) {
            console.log(`⚠️  Invalid price for ${hotelName}: ${avgPrice}`)
            return null
          }
          
          // Calculate RevPAR (assume 80% occupancy for competitors)
          const competitorOccupancy = 0.80
          const revpar = avgPrice * competitorOccupancy

          return {
            id: hotel.id,
            name: hotelName,
            stars: hotelStars,
            city: hotelCity,
            location: hotelLocation,
            roomTypes: filteredRoomTypes,
            avgPrice,
            revpar
          }
        } catch (error) {
          console.error(`Error processing hotel ${hotel.nombre || hotel.name}:`, error)
          return null
        }
      })
      .filter(Boolean) as CompetitorData[]

    console.log('Processed competitors:', competitors.length)

    // 3. Calculate market averages
    const marketAvgPrice = competitors.length ? 
      competitors.reduce((sum, comp) => sum + comp.avgPrice, 0) / competitors.length : 0
    
    const marketAvgRevpar = competitors.length ? 
      competitors.reduce((sum, comp) => sum + comp.revpar, 0) / competitors.length : 0

    // 4. Calculate price difference and ranking
    const priceDifference = userHotel.avgPrice - marketAvgPrice
    const priceDifferencePercent = marketAvgPrice > 0 ? (priceDifference / marketAvgPrice) * 100 : 0

    // Rank hotels by price
    const allHotels = [
      { name: userHotel.hotelName, avgPrice: userHotel.avgPrice, isUser: true },
      ...competitors.map(comp => ({ name: comp.name, avgPrice: comp.avgPrice, isUser: false }))
    ].sort((a, b) => a.avgPrice - b.avgPrice)

    const userRank = allHotels.findIndex(hotel => hotel.isUser) + 1

    // 5. Prepare response data
    const responseData = {
      userHotel,
      competitors,
      marketMetrics: {
        avgPrice: marketAvgPrice,
        avgRevpar: marketAvgRevpar,
        competitorCount: competitors.length,
        priceDifference,
        priceDifferencePercent,
        userRank,
        totalHotels: allHotels.length
      },
      filters: {
        selectedStars,
        selectedRoomType,
        selectedDateRange,
        city: userCity,
        currentDate
      }
    }

    console.log('Response data prepared successfully')
    return NextResponse.json({
      success: true,
      data: responseData
    })

  } catch (error) {
    console.error('Competitors API error:', error)
    return NextResponse.json({ 
      success: false, 
      error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}` 
    }, { status: 500 })
  }
}
