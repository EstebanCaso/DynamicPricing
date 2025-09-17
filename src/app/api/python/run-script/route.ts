import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const { script, userData } = await request.json()

    // Map script IDs to actual Python script paths
    const scriptMap: { [key: string]: string } = {
      'songkick-scraper': 'scripts/scrape_songkick.py',
      'eventos-scraper': 'scripts/scrape_eventos.py',
      'hotel-scraper': 'scripts/hotel_propio.py',
      'hotels-parallel': 'scripts/scrape_hotels_parallel.py',
      'geo-scraper': 'scripts/scrapeo_geo.py',
      'amadeus-hotels': 'scripts/amadeus_hotels.py',
    }

    const scriptPath = scriptMap[script]
    if (!scriptPath) {
      return NextResponse.json(
        { error: 'Script not found' },
        { status: 404 }
      )
    }

    // Prepare arguments based on script and user data
    let scriptArgs: string[] = []
    
    if (script === 'eventos-scraper' && userData) {
      // Para scrape_eventos.py: lat lon radio user_uuid
      const { latitude, longitude, radius = 50, userUuid } = userData
      scriptArgs = [latitude.toString(), longitude.toString(), radius.toString(), userUuid]
    } else if (script === 'hotel-scraper' && userData) {
      // Para hotel_propio.py: hotel_name user_uuid
      const { hotelName, userUuid } = userData
      scriptArgs = [hotelName, userUuid]
    }

    // Execute Python script with arguments
    const pythonProcess = spawn('python', [scriptPath, ...scriptArgs], {
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
          resolve(NextResponse.json({
            success: true,
            output: output.trim(),
            script: script
          }))
        } else {
          resolve(NextResponse.json({
            success: false,
            error: error || 'Script execution failed',
            script: script
          }, { status: 500 }))
        }
      })
    })

  } catch (error) {
    console.error('Error executing Python script:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
