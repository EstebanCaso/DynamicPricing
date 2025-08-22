import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { latitude, longitude, radius = 30, keyword = '' } = await request.json()

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: 'Latitude and longitude are required' },
        { status: 400 }
      )
    }

    // Ejecutar el script de Python de Amadeus
    const pythonProcess = spawn('python', [
      'scripts/amadeus_hotels.py',
      '--lat', latitude.toString(),
      '--lng', longitude.toString(),
      '--radius', radius.toString(),
      '--keyword', keyword
    ], {
      cwd: process.cwd(),
      stdio: ['pipe', 'pipe', 'pipe']
    })

    let output = ''
    let error = ''

    pythonProcess.stdout.on('data', (data) => {
      output += data.toString()
    })

    pythonProcess.stderr.on('data', (data) => {
      error += data.toString()
    })

    return await new Promise<Response>((resolve) => {
      pythonProcess.on('close', (code) => {
        if (code === 0) {
          try {
            const hotels = JSON.parse(output.trim())
            
                         // Transformar los datos de Amadeus al formato esperado por el frontend
             const transformedHotels = hotels.map((hotel: any) => ({
               name: hotel.name || 'Hotel sin nombre',
               hotelId: hotel.hotelId || hotel.id || `hotel-${Date.now()}-${Math.random()}`,
               latitude: hotel.geoCode?.latitude || hotel.latitude || 0,
               longitude: hotel.geoCode?.longitude || hotel.longitude || 0,
               address: {
                 cityName: hotel.address?.cityName || hotel.cityName || 'Ciudad no especificada',
                 countryCode: hotel.address?.countryCode || hotel.countryCode || 'ES',
                 postalCode: hotel.address?.postalCode || hotel.postalCode,
                 street: hotel.address?.street || hotel.street
               },
               distance: typeof hotel.distance === 'number' && !isNaN(hotel.distance) ? hotel.distance : 0
             }))

            resolve(NextResponse.json({
              success: true,
              hotels: transformedHotels
            }))
          } catch (parseError) {
            console.error('Error parsing Python output:', parseError)
            resolve(NextResponse.json({
              success: false,
              error: 'Error parsing hotel data',
              rawOutput: output
            }, { status: 500 }))
          }
        } else {
          console.error('Python script error:', error)
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
