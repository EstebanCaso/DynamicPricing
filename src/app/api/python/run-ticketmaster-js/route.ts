import { NextRequest, NextResponse } from 'next/server'

// Ensure this route runs on the Node.js runtime (child_process unsupported on Edge)
export const runtime = 'nodejs'
// Disable caching/dynamic to ensure fresh execution
export const dynamic = 'force-dynamic'
// Allow long-running script (useful on platforms like Vercel)
export const maxDuration = 300

export async function POST(request: NextRequest) {
	try {
		const { userData } = await request.json()
		const { latitude, longitude, radius = 10, userUuid, hotelName } = userData || {}

		if (!latitude || !longitude) {
			return NextResponse.json({ error: 'Missing latitude/longitude' }, { status: 400 })
		}
		if (!userUuid) {
			return NextResponse.json({ error: 'Missing userUuid' }, { status: 400 })
		}

		const WORKER_URL = process.env.WORKER_URL
		const WORKER_API_KEY = process.env.WORKER_API_KEY
		if (!WORKER_URL || !WORKER_API_KEY) {
			return NextResponse.json({ success: false, error: 'Server not configured (WORKER_URL/WORKER_API_KEY missing)' }, { status: 500 })
		}

		const payload = { latitude, longitude, radius, userUuid, hotelName }
		const res = await fetch(`${WORKER_URL}/ticketmaster`, {
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
		console.error('Error in run-ticketmaster-js:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
