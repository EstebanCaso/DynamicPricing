import { NextRequest, NextResponse } from 'next/server'
import fetch from 'node-fetch'

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

		console.log('[ticketmaster-api] Starting scraping with params:', { latitude, longitude, radius, userUuid, hotelName })

		const apikey = process.env.TICKETMASTER_API_KEY
		if (!apikey) {
			console.log('[ticketmaster-api] No API key found, returning empty results')
			return NextResponse.json({ success: true, inserted: 0, count: 0 })
		}

		const fetcher = new EventsFetcher(apikey)
        const events = await fetcher.getAllEvents({
            city: undefined,
			daysAhead: 90, // 90 days ahead
			latitude: latitude,
			longitude: longitude,
			radius: radius
		})

		// Convert to the expected format for Supabase
		const formattedEvents = events.map(event => ({
			nombre: event.name,
			fecha: event.date,
			lugar: event.venue,
			enlace: event.url,
			// Note: Ticketmaster doesn't provide distance_km, so we'll leave it null
		}))

		console.log('[ticketmaster-api] Scraped events:', formattedEvents.length)

		// Save to Supabase
		const SUPABASE_URL = process.env.SUPABASE_URL
		const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
		let inserted = 0
		
		if (SUPABASE_URL && SUPABASE_ANON_KEY && userUuid) {
			// Map events to DB schema and deduplicate
			const mapped = formattedEvents.map((ev: any) => ({
				nombre: ev.nombre || ev.name || '',
				fecha: ((ev.fecha || ev.date || '') as string).slice(0, 10),
				lugar: ev.lugar || ev.venue || '',
				enlace: ev.enlace || ev.url || '',
				hotel_referencia: hotelName || '',
				created_by: userUuid,
				distancia: typeof ev.distance_km === 'number' ? ev.distance_km : null
			})).filter((e) => e.nombre && e.fecha)
			
			// Deduplicate by nombre + fecha + created_by
			const uniqueEvents = mapped.reduce((acc, event) => {
				const key = `${event.nombre}|${event.fecha}|${event.created_by}`
				if (!acc.has(key)) {
					acc.set(key, event)
				}
				return acc
			}, new Map())
			
			const deduplicatedEvents = Array.from(uniqueEvents.values())
			console.log('[ticketmaster-api] Mapped events:', mapped.length, 'Deduplicated:', deduplicatedEvents.length)

			const chunkSize = 100
			for (let i = 0; i < deduplicatedEvents.length; i += chunkSize) {
				const batch = deduplicatedEvents.slice(i, i + chunkSize)
				try {
					const res = await fetch(`${SUPABASE_URL}/rest/v1/events?on_conflict=nombre,fecha,created_by`, {
						method: 'POST',
						headers: {
							apikey: SUPABASE_ANON_KEY,
							Authorization: `Bearer ${process.env.USER_JWT || SUPABASE_ANON_KEY}`,
							'Content-Type': 'application/json',
							Prefer: 'resolution=merge-duplicates,return=representation'
						},
						body: JSON.stringify(batch)
					})
					if (res.ok) {
						const json = (await res.json().catch(() => [])) as any[]
						inserted += Array.isArray(json) ? json.length : batch.length
						console.log('[ticketmaster-api] Batch inserted:', Array.isArray(json) ? json.length : batch.length)
					} else {
						const errorText = await res.text().catch(() => '')
						console.error('[ticketmaster-api] Supabase insert failed:', res.status, errorText)
					}
				} catch (e) {
					console.error('[ticketmaster-api] Supabase insert error:', (e as Error)?.message)
				}
			}
		}

		console.log('[ticketmaster-api] Final result - inserted:', inserted, 'total events:', formattedEvents.length)
		return NextResponse.json({ success: true, inserted, count: formattedEvents.length })
	} catch (error) {
		console.error('Error in ticketmaster-api:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
