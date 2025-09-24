import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const { userData } = await request.json()
    const { hotelName, userUuid, days = 90, concurrency = 5, headless = true } = userData || {}

    if (!hotelName || !userUuid) {
      return NextResponse.json(
        { error: 'Missing required parameters: hotelName and userUuid' },
        { status: 400 }
      )
    }

    const WORKER_URL = process.env.WORKER_URL
    const WORKER_API_KEY = process.env.WORKER_API_KEY
    if (!WORKER_URL || !WORKER_API_KEY) {
      return NextResponse.json({ success: false, error: 'Server not configured (WORKER_URL/WORKER_API_KEY missing)' }, { status: 500 })
    }

    const authHeader = request.headers.get('Authorization')
    const userJwt = authHeader ? authHeader.replace(/^Bearer\s+/i, '') : ''

    const payload = { hotelName, userUuid, days, concurrency, headless, userJwt }
    const res = await fetch(`${WORKER_URL}/hotel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': WORKER_API_KEY
      },
      body: JSON.stringify(payload)
    })

    const text = await res.text()
    let json: unknown
    try { json = JSON.parse(text) } catch { json = { raw: text } }
    if (!res.ok) {
      return NextResponse.json({ success: false, status: res.status, data: json }, { status: 500 })
    }
    return NextResponse.json({ success: true, data: json })
  } catch (error) {
    console.error('Error in hotel proxy route:', error)
    return NextResponse.json(
      { success: false, message: 'Internal server error' },
      { status: 500 }
    )
  }
}
