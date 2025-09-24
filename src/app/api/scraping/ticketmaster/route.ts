import { NextRequest, NextResponse } from 'next/server'

// Ensure this route runs on the Node.js runtime
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

class EventsFetcher {
    private apiKey: string
    private baseUrl: string
	constructor(apiKey: string) {
		this.apiKey = apiKey
		this.baseUrl = 'https://app.ticketmaster.com/discovery/v2/events.json'
	}

	async getEvents({
		city = 'San Diego',
		daysAhead = 30,
		limit = 15,
		latitude = null,
		longitude = null,
		radius = 50,
		countryCode = null
	}: {
		city?: string
		daysAhead?: number
		limit?: number
		latitude?: number | null
		longitude?: number | null
		radius?: number
		countryCode?: string | null
	} = {}) {
		const now = new Date()
		const end = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)

		const params = new URLSearchParams()
		params.set('apikey', this.apiKey)
		params.set('startDateTime', now.toISOString().split('.')[0] + 'Z')
		params.set('endDateTime', end.toISOString().split('.')[0] + 'Z')
		params.set('sort', 'date,asc')
		params.set('size', String(limit))

		if (countryCode) params.set('countryCode', countryCode)
		if (latitude != null && longitude != null) {
			params.set('latlong', `${latitude},${longitude}`)
			params.set('radius', String(radius))
			params.set('unit', 'km')
		} else if (city) {
			params.set('city', city)
		}

		const url = `${this.baseUrl}?${params.toString()}`
        const res = await fetch(url)
        const data = (await res.json()) as { _embedded?: { events?: any[] } } | Record<string, unknown>

        const events: any[] = []
        const embedded = (data as { _embedded?: { events?: any[] } })._embedded
        if (embedded?.events) {
            for (const event of embedded.events) {
				events.push({
					name: event?.name || '',
					url: event?.url || '',
					date: event?.dates?.start?.localDate || '',
					time: event?.dates?.start?.localTime || '',
					venue: event?._embedded?.venues?.[0]?.name || '',
					genre: event?.classifications?.[0]?.genre?.name || '',
					price_range: event?.priceRanges?.[0]
						? `${event.priceRanges[0].min} - ${event.priceRanges[0].max} ${event.priceRanges[0].currency}`
						: 'N/A'
				})
			}
		}
		return events
	}

	async getAllEvents({
		city = 'San Diego',
		daysAhead = 30,
		latitude = null,
		longitude = null,
		radius = 50,
		countryCode = null
	}: {
		city?: string
		daysAhead?: number
		latitude?: number | null
		longitude?: number | null
		radius?: number
		countryCode?: string | null
	} = {}) {
		const allEvents: any[] = []
		let page = 0
		const pageSize = 200 // Maximum page size for Ticketmaster API
		
		while (true) {
			const events = await this.getEvents({
				city,
				daysAhead,
				limit: pageSize,
				latitude,
				longitude,
				radius,
				countryCode
			})
			
			if (events.length === 0) {
				break // No more events
			}
			
			allEvents.push(...events)
			
			// If we got less than pageSize, we've reached the end
			if (events.length < pageSize) {
				break
			}
			
			page++
			
			// Safety limit to prevent infinite loops
			if (page > 50) {
				break
			}
		}
		
		return allEvents
	}
}

function getHotelCoordinates(hotelName: string) {
	const hotels: { [key: string]: [number, number] } = {
		"Grand Hotel Tijuana": [32.5149, -117.0382],
		"Hotel Real del Río": [32.5283, -117.0187],
		"Hotel Pueblo Amigo": [32.5208, -117.0278],
		"Hotel Ticuan": [32.5234, -117.0312],
		"Hotel Lucerna": [32.5267, -117.0256],
		"Hotel Fiesta Inn": [32.5212, -117.0298],
		"Hotel Marriott": [32.5245, -117.0334],
		"Hotel Holiday Inn": [32.5198, -117.0267],
		"Hotel Best Western": [32.5221, -117.0289],
		"Hotel Comfort Inn": [32.5256, -117.0321]
	}
	return hotels[hotelName] || [32.5149, -117.0382]
}

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
        console.error('Error in ticketmaster-api:', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
