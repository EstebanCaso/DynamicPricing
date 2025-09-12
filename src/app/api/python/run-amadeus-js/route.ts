import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'

export async function POST(request: NextRequest) {
  try {
    const { userData } = await request.json()
    const { latitude, longitude, userUuid, radius = 30, keyword = null, saveToDb = true } = userData

    if (!latitude || !longitude || !userUuid) {
      return NextResponse.json(
        { error: 'Missing required parameters: latitude, longitude, and userUuid' },
        { status: 400 }
      )
    }

    console.log('Executing amadeus_hotels.js with parameters:', {
      latitude,
      longitude,
      userUuid,
      radius,
      keyword,
      saveToDb
    })

    // Construir el comando para ejecutar el script
    const scriptPath = path.join(process.cwd(), 'scripts', 'amadeus_hotels.js')
    const args = [
      latitude.toString(),
      longitude.toString(),
      `--radius=${radius}`,
      keyword ? `--keyword=${keyword}` : '',
      saveToDb ? `--user-id=${userUuid}` : '',
      saveToDb ? '--save' : ''
    ].filter(Boolean) // Remover argumentos vacíos

    console.log('Executing command:', `node ${scriptPath} ${args.join(' ')}`)

    return new Promise((resolve) => {
      const child = spawn('node', [scriptPath, ...args], {
        cwd: process.cwd(),
        stdio: ['pipe', 'pipe', 'pipe']
      })

      let stdout = ''
      let stderr = ''

      child.stdout.on('data', (data) => {
        const output = data.toString()
        stdout += output
        console.log('amadeus_hotels.js stdout:', output)
      })

      child.stderr.on('data', (data) => {
        const output = data.toString()
        stderr += output
        console.log('amadeus_hotels.js stderr:', output)
      })

      child.on('close', (code) => {
        console.log(`amadeus_hotels.js process exited with code ${code}`)
        
        if (code === 0) {
          resolve(NextResponse.json({
            success: true,
            message: 'Amadeus hotels search completed successfully',
            output: stdout,
            errors: stderr
          }))
        } else {
          resolve(NextResponse.json({
            success: false,
            message: 'Amadeus hotels search failed',
            output: stdout,
            errors: stderr,
            exitCode: code
          }, { status: 500 }))
        }
      })

      child.on('error', (error) => {
        console.error('Error spawning amadeus_hotels.js process:', error)
        resolve(NextResponse.json({
          success: false,
          message: 'Failed to start Amadeus hotels search process',
          error: error.message
        }, { status: 500 }))
      })
    })

  } catch (error) {
    console.error('Error in Amadeus hotels JS endpoint:', error)
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
