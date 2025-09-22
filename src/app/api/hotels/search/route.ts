import { NextRequest, NextResponse } from 'next/server'

const WORKER_URL = process.env.WORKER_URL || ''
const WORKER_API_KEY = process.env.WORKER_API_KEY || ''

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { latitude, longitude, radius = 30, keyword = '' } = await request.json()

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: 'Latitude and longitude are required' },
        { status: 400 }
      )
    }

    if (!WORKER_URL || !WORKER_API_KEY) {
      return NextResponse.json({ success: false, error: 'Worker not configured' }, { status: 500 })
    }

    const resp = await fetch(`${WORKER_URL}/amadeus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': WORKER_API_KEY,
      },
      body: JSON.stringify({ latitude, longitude, radius, keyword, saveToDb: false })
    })

    const body = await resp.json().catch(() => ({} as any))
    if (!resp.ok) {
      return NextResponse.json({ success: false, error: body?.error || 'Worker error', output: body?.output }, { status: 500 })
    }

    let hotels: any[] = []
    try { hotels = JSON.parse((body?.output as string) || '[]') } catch {}

    const transformedHotels = hotels.map((hotel: Record<string, any>) => ({
      name: hotel.name || 'Hotel sin nombre',
      hotelId: hotel.hotelId || hotel.id || `hotel-${Date.now()}-${Math.random()}`,
      latitude: hotel?.geoCode?.latitude ?? hotel?.latitude ?? 0,
      longitude: hotel?.geoCode?.longitude ?? hotel?.longitude ?? 0,
      address: {
        cityName: hotel?.address?.cityName ?? hotel?.cityName ?? 'Ciudad no especificada',
        countryCode: hotel?.address?.countryCode ?? hotel?.countryCode ?? 'ES',
        postalCode: hotel?.address?.postalCode ?? hotel?.postalCode,
        street: hotel?.address?.lines?.[0] ?? hotel?.address?.street
      },
      distance: typeof hotel?.distance === 'number' && !Number.isNaN(hotel.distance) ? hotel.distance : 0
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
