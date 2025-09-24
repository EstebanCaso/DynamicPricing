import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { latitude, longitude, radius = 30, keyword = '' } = await request.json()

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: 'Latitude and longitude are required' },
        { status: 400 }
      )
    }

    const WORKER_URL = process.env.WORKER_URL
    const WORKER_API_KEY = process.env.WORKER_API_KEY
    if (!WORKER_URL || !WORKER_API_KEY) {
      return NextResponse.json({ success: false, error: 'Server not configured (WORKER_URL/WORKER_API_KEY missing)' }, { status: 500 })
    }

    const payload = {
      latitude,
      longitude,
      radius,
      keyword: keyword || '',
      saveToDb: false
    }

    const res = await fetch(`${WORKER_URL}/amadeus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': WORKER_API_KEY
      },
      body: JSON.stringify(payload)
    })

    const text = await res.text()
    let data: unknown
    try { data = JSON.parse(text) } catch { data = { raw: text } }

    // El worker puede devolver { ok, output: 'json' } o directamente un array
    let hotels: any[] = []
    if (data && typeof data === 'object' && 'ok' in data && (data as any).ok === true && typeof (data as any).output === 'string') {
      try { hotels = JSON.parse((data as any).output) } catch { hotels = [] }
    } else if (Array.isArray((data as any))) {
      hotels = data as any[]
    } else if ((data as any)?.data?.ok && typeof (data as any)?.data?.output === 'string') {
      try { hotels = JSON.parse((data as any).data.output) } catch { hotels = [] }
    } else if ((data as any)?.data && Array.isArray((data as any).data)) {
      hotels = (data as any).data
    }

    const transformedHotels = hotels.map((hotel: Record<string, unknown>) => ({
      name: hotel.name || 'Hotel sin nombre',
      hotelId: hotel.hotelId || (hotel as any).id || `hotel-${Date.now()}-${Math.random()}`,
      latitude: ((hotel as any)?.geoCode)?.latitude ?? (hotel as any)?.latitude ?? 0,
      longitude: ((hotel as any)?.geoCode)?.longitude ?? (hotel as any)?.longitude ?? 0,
      address: {
        cityName: ((hotel as any)?.address)?.cityName ?? (hotel as any)?.cityName ?? 'Ciudad no especificada',
        countryCode: ((hotel as any)?.address)?.countryCode ?? (hotel as any)?.countryCode ?? 'ES',
        postalCode: ((hotel as any)?.address)?.postalCode ?? (hotel as any)?.postalCode,
        street: ((hotel as any)?.address)?.street ?? (hotel as any)?.street
      },
      distance: typeof (hotel as any).distance === 'number' && !isNaN((hotel as any).distance) ? (hotel as any).distance : ((hotel as any)?.distance?.value ?? 0)
    }))

    return NextResponse.json({ success: true, hotels: transformedHotels })
  } catch (error) {
    console.error('Error in hotel search API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
