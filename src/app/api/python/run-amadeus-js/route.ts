import { NextRequest, NextResponse } from 'next/server'

// Ensure this route runs on Node.js runtime (child_process unsupported on Edge)
export const runtime = 'nodejs'
// Force dynamic to avoid static optimization attempts
export const dynamic = 'force-dynamic'
// Allow longer execution window for external API calls
export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const { userData } = await request.json()
    const { latitude, longitude, userUuid, radius = 30, keyword = null, saveToDb = true } = userData

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: 'Missing required parameters: latitude and longitude' },
        { status: 400 }
      )
    }
    const WORKER_URL = process.env.WORKER_URL
    const WORKER_API_KEY = process.env.WORKER_API_KEY
    if (!WORKER_URL || !WORKER_API_KEY) {
      return NextResponse.json({ success: false, error: 'Server not configured (WORKER_URL/WORKER_API_KEY missing)' }, { status: 500 })
    }

    const body = {
      latitude,
      longitude,
      radius,
      keyword: keyword || '',
      saveToDb: Boolean(saveToDb),
      userUuid: userUuid || null
    }

    const res = await fetch(`${WORKER_URL}/amadeus`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': WORKER_API_KEY
      },
      body: JSON.stringify(body)
    })

    const text = await res.text()
    let json: unknown
    try { json = JSON.parse(text) } catch { json = { raw: text } }
    if (!res.ok) {
      return NextResponse.json({ success: false, status: res.status, data: json }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: json })

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
