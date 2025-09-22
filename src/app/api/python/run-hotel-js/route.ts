import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

// Ensure Node.js runtime for child_process
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const { userData } = await request.json()
    const { hotelName, userUuid, days = 90, concurrency = 5, headless = true } = userData

    if (!hotelName || !userUuid) {
      return NextResponse.json(
        { error: 'Missing required parameters: hotelName and userUuid' },
        { status: 400 }
      )
    }

    console.log('Executing hotel_propio.js with parameters:', {
      hotelName,
      userUuid,
      days,
      concurrency,
      headless
    })

    // Construir el comando para ejecutar el script
    const scriptPath = path.join(process.cwd(), 'scripts', 'hotel_propio.js')
    const args = [
      userUuid,
      hotelName,
      `--days=${days}`,
      `--concurrency=${concurrency}`,
      headless ? '--headless' : ''
    ].filter(Boolean) // Remover argumentos vacíos

    console.log('Executing command:', `node ${scriptPath} ${args.join(' ')}`)

    return new Promise<Response>((resolve) => {
      const child = spawn('node', [scriptPath, ...args], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          USER_JWT: request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || ''
        }
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data) => {
        const output = data.toString()
        stdout += output
        console.log('hotel_propio.js stdout:', output)
      })

      child.stderr.on('data', (data) => {
        const output = data.toString()
        stderr += output
        console.log('hotel_propio.js stderr:', output)
      })

      child.on('close', (code) => {
        console.log(`hotel_propio.js process exited with code ${code}`)
        
        if (code === 0) {
          resolve(NextResponse.json({
            success: true,
            message: 'Hotel scraping completed successfully',
            output: stdout,
            errors: stderr
          }))
        } else {
          resolve(NextResponse.json({
            success: false,
            message: 'Hotel scraping failed',
            output: stdout,
            errors: stderr,
            exitCode: code
          }, { status: 500 }))
        }
      })

      child.on('error', (error) => {
        console.error('Error spawning hotel_propio.js process:', error)
        resolve(NextResponse.json({
          success: false,
          message: 'Failed to start hotel scraping process',
          error: error.message
        }, { status: 500 }))
      })
    })

  } catch (error) {
    console.error('Error in hotel JS scraping endpoint:', error)
    return NextResponse.json(
      { 
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
