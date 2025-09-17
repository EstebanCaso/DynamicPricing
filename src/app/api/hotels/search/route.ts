import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { latitude, longitude, radius = 30, keyword = '' } = await request.json()

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: 'Latitude and longitude are required' },
        { status: 400 }
      )
    }

    // Ejecutar el script de JavaScript de Amadeus
    const nodeProcess = spawn('node', [
      'scripts/amadeus_hotels.js',
      latitude.toString(),
      longitude.toString(),
      '--radius', radius.toString(),
      keyword ? `--keyword=${keyword}` : ''
    ].filter(Boolean), {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let output = ''
    let error = ''

    nodeProcess.stdout.on('data', (data) => {
      output += data.toString()
    })

    nodeProcess.stderr.on('data', (data) => {
      error += data.toString()
    })

    return await new Promise<Response>((resolve) => {
      nodeProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const hotels = JSON.parse(output.trim())
            
                         // Transformar los datos de Amadeus al formato esperado por el frontend
             const transformedHotels = hotels.map((hotel: Record<string, unknown>) => ({
               name: hotel.name || 'Hotel sin nombre',
               hotelId: hotel.hotelId || hotel.id || `hotel-${Date.now()}-${Math.random()}`,
                latitude: ((hotel as Record<string, unknown>)?.geoCode as Record<string, unknown>)?.latitude || (hotel as Record<string, unknown>)?.latitude || 0,
                longitude: ((hotel as Record<string, unknown>)?.geoCode as Record<string, unknown>)?.longitude || (hotel as Record<string, unknown>)?.longitude || 0,
               address: {
                 cityName: ((hotel as Record<string, unknown>)?.address as Record<string, unknown>)?.cityName || (hotel as Record<string, unknown>)?.cityName || 'Ciudad no especificada',
                 countryCode: ((hotel as Record<string, unknown>)?.address as Record<string, unknown>)?.countryCode || (hotel as Record<string, unknown>)?.countryCode || 'ES',
                 postalCode: ((hotel as Record<string, unknown>)?.address as Record<string, unknown>)?.postalCode || (hotel as Record<string, unknown>)?.postalCode,
                 street: ((hotel as Record<string, unknown>)?.address as Record<string, unknown>)?.street || (hotel as Record<string, unknown>)?.street
               },
               distance: typeof hotel.distance === 'number' && !isNaN(hotel.distance) ? hotel.distance : 0
             }))

            resolve(NextResponse.json({
              success: true,
              hotels: transformedHotels
            }))
          } catch (parseError) {
            console.error('Error parsing JavaScript output:', parseError)
            resolve(NextResponse.json({
              success: false,
              error: 'Error parsing hotel data',
              rawOutput: output
            }, { status: 500 }))
          }
        } else {
          console.error('JavaScript script error:', error)
          resolve(NextResponse.json({
            success: false,
            error: error || 'Script execution failed',
            code
          }, { status: 500 }))
        }
      })
    })

  } catch (error) {
    console.error('Error in hotel search API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
