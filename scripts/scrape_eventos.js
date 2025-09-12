import 'dotenv/config'
import fetch from 'node-fetch'
import { scrapeSongkick } from './scrape_songkick.js'
import { EventsFetcher, getHotelCoordinates as getHotelCoordsPy } from './scrapeo_geo.js'

function isFloat(val) {
	return !isNaN(val) && isFinite(val)
}

function withTimeout(promise, ms, label = 'operation') {
	return Promise.race([
		promise,
		new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms))
	])
}

async function subirASupabase(eventos, hotelName, supabaseUrl, supabaseKey, pais, userUuid) {
	if (!Array.isArray(eventos) || eventos.length === 0) return { ok: true, inserted: 0 }
	const userJwt = process.env.USER_JWT
	const headers = {
		"apikey": supabaseKey,
		"Authorization": `Bearer ${userJwt || supabaseKey}`,
		"Content-Type": "application/json",
		"Prefer": "resolution=merge-duplicates,return=representation"
	}

	// Normalize and filter invalid rows
	const mapped = eventos.map((event) => (pais === 'MX' ? {
		nombre: event.nombre,
		fecha: event.fecha,
		lugar: event.lugar,
		enlace: event.enlace,
		hotel_referencia: hotelName,
		created_by: userUuid,
		distancia: typeof event.distance_km === 'number' ? event.distance_km : null
	} : {
		nombre: event.nombre || event.name,
		fecha: event.fecha || event.date,
		lugar: event.lugar || event.venue,
		enlace: event.enlace || event.url,
		hotel_referencia: hotelName,
		created_by: userUuid,
		distancia: typeof event.distance_km === 'number' ? event.distance_km : null
	})).filter(e => e && e.nombre && e.fecha)

	if (mapped.length === 0) return { ok: true, inserted: 0 }

	const url = `${supabaseUrl}/rest/v1/events?on_conflict=nombre,fecha,created_by`

	let inserted = 0
	const chunkSize = 100
	for (let i = 0; i < mapped.length; i += chunkSize) {
		const batch = mapped.slice(i, i + chunkSize)
		try {
			const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(batch) })
			if (res.ok) {
				const json = await res.json().catch(() => [])
				inserted += Array.isArray(json) ? json.length : batch.length
			} else {
				const errText = await res.text().catch(() => '')
				if (String(process.env.DEBUG || '').toLowerCase() === 'true') {
					console.error('[scrape_eventos] Supabase batch insert failed:', res.status, errText)
				}
			}
		} catch (e) {
			if (String(process.env.DEBUG || '').toLowerCase() === 'true') {
				console.error('[scrape_eventos] Supabase insert error:', e?.message || e)
			}
		}
	}
	return { ok: true, inserted }
}

export async function scrapeEventos({ lat, lon, radiusKm, userUuid, hotelName }) {
	const API_KEY = process.env.TICKETMASTER_API_KEY
	const SUPABASE_URL = process.env.SUPABASE_URL
	const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY

	const DIAS = 90
	const LIMITE = 40
	const TIMEOUT_MS = 120_000

	const fetcher = new EventsFetcher(API_KEY)

	const skipUS = String(process.env.SKIP_US || '').toLowerCase() === 'true'
	const skipMX = String(process.env.SKIP_SONGKICK || process.env.SKIP_MX || '').toLowerCase() === 'true'

	const tasks = []
	if (!skipUS) {
		tasks.push(withTimeout(
			fetcher.getEvents({ daysAhead: DIAS, limit: LIMITE, latitude: lat, longitude: lon, radius: radiusKm, countryCode: 'US' }),
			TIMEOUT_MS,
			'Ticketmaster US fetch'
		))
	}
	if (!skipMX) {
		tasks.push(withTimeout(
			scrapeSongkick(lat, lon, radiusKm),
			TIMEOUT_MS,
			'Songkick MX scrape'
		))
	}

	const results = await Promise.allSettled(tasks)
	let usRes = { status: 'fulfilled', value: [] }
	let mxRes = { status: 'fulfilled', value: [] }
	let idx = 0
	if (!skipUS) { usRes = results[idx++] }
	if (!skipMX) { mxRes = results[idx++] }

	let eventosUS = []
	if (usRes.status === 'fulfilled' && Array.isArray(usRes.value)) {
		eventosUS = usRes.value
	} else {
		if (process.env.DEBUG?.toLowerCase() === 'true') {
			console.error('[scrape_eventos] US fetch failed:', usRes.status === 'rejected' ? usRes.reason : 'unknown')
		}
	}

	let eventosMX = []
	if (mxRes.status === 'fulfilled' && Array.isArray(mxRes.value)) {
		eventosMX = mxRes.value
	} else {
		if (process.env.DEBUG?.toLowerCase() === 'true') {
			console.error('[scrape_eventos] MX scrape failed:', mxRes.status === 'rejected' ? mxRes.reason : 'unknown')
		}
	}

	// Guardado en Supabase
	if (SUPABASE_URL && SUPABASE_ANON_KEY && userUuid) {
		try {
			await fetch(`${SUPABASE_URL}/rest/v1/events?created_by=eq.${userUuid}`, {
				method: 'DELETE',
				headers: {
					"apikey": SUPABASE_ANON_KEY,
					"Authorization": `Bearer ${process.env.USER_JWT || SUPABASE_ANON_KEY}`,
					"Content-Type": "application/json"
				}
			})
		} catch (e) {
			if (process.env.DEBUG?.toLowerCase() === 'true') {
				console.error('[scrape_eventos] Failed to clear existing Supabase events:', e)
			}
		}
		const mxResIns = await subirASupabase(eventosMX, hotelName, SUPABASE_URL, SUPABASE_ANON_KEY, 'MX', userUuid)
		const usResIns = await subirASupabase(eventosUS, hotelName, SUPABASE_URL, SUPABASE_ANON_KEY, 'US', userUuid)
		if (process.env.DEBUG?.toLowerCase() === 'true') {
			console.error('[scrape_eventos] Inserted rows -> MX:', mxResIns.inserted, 'US:', usResIns.inserted)
		}
	}

	return { mx: eventosMX, us: eventosUS }
}

// CLI compatibility with Python usage:
// Usage A: node scripts/scrape_eventos.js <lat> <lon> <radiusKm> <userUuid>
// Usage B: node scripts/scrape_eventos.js <hotelName> <radiusKm> <userUuid>
if (import.meta.url === `file://${process.argv[1]}`) {
	(async () => {
		try {
			let lat, lon, radiusKm, userUuid, hotelName
			const args = process.argv.slice(2)
			const debug = args.includes('--debug')
			if (debug) process.env.DEBUG = 'true'

			const filtered = args.filter((a) => a !== '--debug')
			if (filtered.length === 4 && isFloat(filtered[0]) && isFloat(filtered[1])) {
				lat = parseFloat(filtered[0])
				lon = parseFloat(filtered[1])
				radiusKm = parseInt(filtered[2], 10)
				userUuid = filtered[3]
				hotelName = 'Hotel'
			} else if (filtered.length === 3) {
				hotelName = filtered[0]
				radiusKm = parseInt(filtered[1], 10)
				userUuid = filtered[2]
				const coords = getHotelCoordsPy(hotelName)
				lat = coords[0]; lon = coords[1]
			} else {
				console.error('Usage A: node scripts/scrape_eventos.js <lat> <lon> <radiusKm> <userUuid>')
				console.error('Usage B: node scripts/scrape_eventos.js <hotelName> <radiusKm> <userUuid>')
				console.log(JSON.stringify({ mx: [], us: [] }))
				process.exit(1)
			}

			if (process.env.DEBUG?.toLowerCase() === 'true') {
				console.error('[scrape_eventos] Starting with:', { lat, lon, radiusKm, userUuid, hotelName })
			}
			const result = await scrapeEventos({ lat, lon, radiusKm, userUuid, hotelName })
			if (process.env.DEBUG?.toLowerCase() === 'true') {
				console.error('[scrape_eventos] Completed. MX:', result.mx?.length || 0, 'US:', result.us?.length || 0)
			}
			process.stdout.write(JSON.stringify(result))
			process.exit(0)
		} catch (e) {
			console.error('[scrape_eventos] CLI execution failed:', e?.message || e)
			console.log(JSON.stringify({ mx: [], us: [] }))
			process.exit(1)
		}
	})()
}


