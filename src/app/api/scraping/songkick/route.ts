import { NextRequest, NextResponse } from 'next/server'
import { chromium, type Page } from 'playwright'
import fetch from 'node-fetch'

// Ensure this route runs on the Node.js runtime
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function resolveSongkickUrl(lat: number, lon: number, radiusKm: number) {
	if (lat && lon) {
		if (lat > 19.0 && lat < 33.0 && lon > -118.0 && lon < -86.0) {
			if (lat > 32.0) return 'https://www.songkick.com/metro-areas/31097-mexico-tijuana/calendar'
			if (lat > 25.0) return 'https://www.songkick.com/metro-areas/31098-mexico-monterrey/calendar'
			if (lat > 20.0) return 'https://www.songkick.com/metro-areas/31099-mexico-guadalajara/calendar'
			return 'https://www.songkick.com/metro-areas/31100-mexico-mexico-city/calendar'
		}
		return `https://www.songkick.com/search?query=&location=${lat},${lon}&radius=${radiusKm}`
	}
	return 'https://www.songkick.com/metro-areas/31097-mexico-tijuana/calendar'
}

type EventRecord = {
  nombre?: string
  fecha?: string
  lugar?: string
  enlace?: string
  name?: string
  date?: string
  venue?: string
  url?: string
  latitude?: number | null
  longitude?: number | null
  distance_km?: number
}

async function scrapeSongkick(lat: number, lon: number, radiusKm: number) {
	const BASE_URL = 'https://www.songkick.com'
	const URL = resolveSongkickUrl(lat, lon, radiusKm)
	const DEBUG = (process.env.DEBUG || '').toLowerCase() === 'true'

	let browser
	try {
		if (DEBUG) console.error('[songkick] Launching browser…')
		browser = await chromium.launch({ 
			headless: !DEBUG ? true : false, 
			timeout: 90000, 
			slowMo: DEBUG ? 100 : 0, 
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--disable-blink-features=AutomationControlled',
				'--disable-web-security',
				'--disable-dev-shm-usage'
			] 
		})
		const context = await browser.newContext({
			userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
			bypassCSP: true,
			viewport: { width: 1366, height: 768 },
			extraHTTPHeaders: {
				'accept-language': 'es-ES,es;q=0.9,en;q=0.8'
			}
		})
		const page = await context.newPage()
		
		// Block third-party noise (ads/trackers) to stabilize DOM
		await context.route('**/*', (route) => {
			try {
				const url = route.request().url()
				const u = new globalThis.URL(url)
				const host = u.hostname
				const allow = host.endsWith('songkick.com')
				if (allow) return route.continue()
				return route.abort()
			} catch { return route.continue() }
		})
		
		if (DEBUG) {
			page.on('console', (msg) => console.error('[songkick][page]', msg.type(), msg.text()))
			page.on('pageerror', (err) => console.error('[songkick][pageerror]', err?.message || err))
		}
		
		if (DEBUG) console.error('[songkick] Navigating to', URL)
		await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 })
		
		// Handle cookie banner if present
        const acceptCookies = async (p: Page) => {
			let clicked = false
            const tryClick = async (locator: string) => {
				if (clicked) return
				try {
					const el = await p.$(locator)
					if (el) {
						if (DEBUG) console.error('[songkick] Clicking cookie button:', locator)
						await el.click({ timeout: 1500 }).catch(()=>{})
						clicked = true
					}
				} catch {}
			}

			const selectors = [
				'button#onetrust-accept-btn-handler',
				'button[aria-label="Accept all"]',
				'button:has-text("Accept all")',
				'button:has-text("Accept")',
				'button:has-text("Agree")',
				'button:has-text("Aceptar")',
				'button:has-text("Aceptar todo")',
				'button:has-text("Estoy de acuerdo")',
				'button:has-text("Consent")',
				'button:has-text("I agree")'
			]
			for (const s of selectors) { await tryClick(s); if (clicked) break }

			// Try common cookie iframes
            try {
                for (const frame of p.frames()) {
					if (clicked) break
					for (const s of selectors) {
						await tryClick(`${s}`)
						if (clicked) break
						try {
                            const el = await frame.$(s)
							if (el) {
								if (DEBUG) console.error('[songkick] Clicking cookie in frame:', s)
								await el.click({ timeout: 1500 }).catch(()=>{})
								clicked = true
								break
							}
						} catch {}
					}
				}
			} catch {}

			// Set a consent flag to avoid re-prompts within this context
			try { await p.addInitScript(() => { try { localStorage.setItem('cookie_consent', 'true') } catch {} }) } catch {}
			return clicked
		}
		
		try { await acceptCookies(page) } catch {}
		await page.waitForTimeout(2000)
		
		// Try to ensure content populated
		try { await page.waitForLoadState('networkidle', { timeout: 20_000 }) } catch {}
		
		// Progressive scroll to trigger lazy loading
		const maxScrolls = 12
		for (let i = 0; i < maxScrolls; i++) {
			await page.evaluate(() => { window.scrollBy(0, window.innerHeight) })
			await page.waitForTimeout(1200)
		}
		
		// Ensure event anchors present if possible
		try { await page.waitForSelector('a.event-link, li.event-listings-element', { timeout: 15_000 }) } catch {}

		// Try multiple selectors
		const selectors = [
			'li.event-listings-element',
			'.event-listings li',
			'.event-listings .event',
			"[data-testid='event-item']",
			'.event-item',
			'ul.event-listings > li',
			'li.component.events-listings-element'
		]
		let hasAny = false
		for (const sel of selectors) {
			try {
				if (DEBUG) console.error('[songkick] Waiting for selector:', sel)
				await page.waitForSelector(sel, { timeout: 10_000 })
				hasAny = true
				break
			} catch (e) {
				if (DEBUG) console.error('[songkick] Selector not found yet:', sel)
			}
		}

		const html = await page.content()
		if (!html || html.length < 1000) {
			if (DEBUG) console.error('[songkick] Page content too short, returning empty set')
			await browser.close()
			return []
		}

		// Extract with page.evaluate to avoid server libs
		if (DEBUG) console.error('[songkick] Extracting events…')
		const events: EventRecord[] = await page.evaluate(({ lat, lon, radiusKm, BASE_URL }) => {
            function text(el: Element | null | undefined) { return ((el && 'textContent' in el ? el.textContent : '') || '').toString().trim() }
            function toKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
				// Approx calc (not exact geodesic):
				const R = 6371
				const dLat = (b.lat - a.lat) * Math.PI / 180
				const dLon = (b.lon - a.lon) * Math.PI / 180
				const sindLat = Math.sin(dLat/2)
				const sindLon = Math.sin(dLon/2)
				const va = sindLat*sindLat + Math.cos(a.lat*Math.PI/180) * Math.cos(b.lat*Math.PI/180) * sindLon*sindLon
				const c = 2 * Math.atan2(Math.sqrt(va), Math.sqrt(1-va))
				return R * c
			}

			// Fallback: parse JSON-LD event data if present (AMP pages etc.)
            try {
                const ldScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]')) as HTMLScriptElement[]
                const ld = ldScripts
                  .map((s) => { try { return JSON.parse(s.textContent || 'null') as unknown } catch { return null } })
                  .filter(Boolean) as unknown[]
                const ldEvents: EventRecord[] = []
				for (const item of ld) {
                    const arr = Array.isArray(item) ? item : [item]
                    for (const objAny of arr) {
                        const obj = objAny as Record<string, unknown>
                        const type = obj['@type'] as string | undefined
                        const graph = obj['@graph'] as Array<Record<string, unknown>> | undefined
                        const isEvent = type === 'Event' || (Array.isArray(graph) && graph.some((x) => x['@type'] === 'Event'))
                        if (isEvent) {
                            const eventsIn = (Array.isArray(graph) ? graph.filter((x) => x['@type'] === 'Event') : [obj]) as Array<Record<string, unknown>>
                            for (const ev of eventsIn) {
                                const name = (ev['name'] as string) || ''
                                const date = ((ev['startDate'] as string) || '').slice(0,10)
                                const location = ev['location'] as Record<string, unknown> | undefined
                                const venueName = (location?.['name'] as string) || ''
                                const url = (ev['url'] as string) || ''
                                const geo = (location?.['geo'] as Record<string, unknown>) || {}
                                const evLat = (geo['latitude'] as number | null | undefined) ?? null
                                const evLon = (geo['longitude'] as number | null | undefined) ?? null
								if (evLat != null && evLon != null) {
									const distance = toKm({ lat, lon }, { lat: evLat, lon: evLon })
									if (distance <= radiusKm) {
										ldEvents.push({ nombre: name, fecha: date, lugar: venueName, enlace: url.startsWith('http') ? url : (BASE_URL + url), latitude: evLat, longitude: evLon, distance_km: Math.round(distance * 100) / 100 })
									}
								} else {
									// No geo; still include for metro area pages
									ldEvents.push({ nombre: name, fecha: date, lugar: venueName, enlace: url.startsWith('http') ? url : (BASE_URL + url) })
								}
							}
						}
					}
				}
				if (ldEvents.length) return ldEvents
			} catch {}

			// Primary path: iterate explicit event anchors
            const anchors = Array.from(document.querySelectorAll('a.event-link[href^="/concerts/"]')) as HTMLAnchorElement[]
            const out: EventRecord[] = []
			for (const a of anchors) {
				try {
					const root = a.closest('li.event-listings-element, .event-listings li, .event, .event-item, article') || a.parentElement || a

					// Date from datetime attribute near the anchor
					const time = root.querySelector('time[datetime], [itemprop="startDate"][content], time')
					let fecha = time?.getAttribute('datetime') || time?.getAttribute('content') || ''
					if (!fecha) {
						const tText = text(time)
						const m = (tText || '').match(/\d{4}-\d{2}-\d{2}|\b(?:\d{1,2} [A-Za-z]{3,9} \d{4})\b/)
						fecha = m ? (m[0].length === 10 ? m[0] : '') : ''
					}
					if (fecha.length > 10) fecha = fecha.slice(0, 10)

					// Title/artist from the anchor strong
					const strong = a.querySelector('span > strong') || root.querySelector('strong, h2, h3, [itemprop="name"]')
					const nombre = text(strong)

					// Venue anchor near the anchor
					const venueEl = root.querySelector('a.venue-link, a[href*="/venues/"]') || root.querySelector('.venue, .location, [itemprop="location"], [data-qa="event-venue"]')
					const venue = text(venueEl)

					// Link from the event anchor
                    const href = a.getAttribute('href')
					const enlace = href ? (href.startsWith('http') ? href : `${BASE_URL}${href}`) : ''

					// Geo
                    let evLat: number | null = null, evLon: number | null = null
					const microformat = root.querySelector('div.microformat script[type="application/ld+json"]')
					if (microformat?.textContent) {
						try {
                            const data = JSON.parse(microformat.textContent) as unknown
                            const obj = (Array.isArray(data) ? data[0] : data) as Record<string, unknown>
                            const location = obj['location'] as Record<string, unknown> | undefined
                            const geo = (location?.['geo'] as Record<string, unknown>) || {}
                            evLat = (geo['latitude'] as number | null | undefined) ?? null
                            evLon = (geo['longitude'] as number | null | undefined) ?? null
						} catch {}
					}

					if (evLat != null && evLon != null) {
						const distance = toKm({ lat, lon }, { lat: evLat, lon: evLon })
						if (distance > radiusKm) continue
						out.push({ nombre, fecha, lugar: venue, enlace, latitude: evLat, longitude: evLon, distance_km: Math.round(distance * 100) / 100 })
					} else {
						out.push({ nombre, fecha, lugar: venue, enlace })
					}
				} catch {}
			}
			return out
		}, { lat, lon, radiusKm, BASE_URL })

		// Enrich missing fields by visiting event pages (limit concurrency)
        const needEnrichment = Array.isArray(events) ? events
            .filter((ev) => (!ev.fecha || !ev.lugar || !ev.enlace) && !!ev.enlace)
			.slice(0, 15) : []
		const concurrency = 5
        const chunkArray = <T,>(arr: T[], size: number) => {
            const res: T[][] = []
			for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size))
			return res
		}
        for (const batch of chunkArray(needEnrichment, concurrency)) {
            await Promise.all(batch.map(async (ev) => {
				try {
                    if (!ev.enlace) return
                    const p2 = await context.newPage()
                    await p2.goto(ev.enlace, { waitUntil: 'domcontentloaded', timeout: 45_000 })
					try { await p2.waitForLoadState('networkidle', { timeout: 5_000 }) } catch {}
                    const detail = await p2.evaluate(() => {
                        function text(el: Element | null | undefined) { return ((el && 'textContent' in el ? el.textContent : '') || '').toString().trim() }
                        const out: { fecha: string; lugar: string; enlace: string } = { fecha: '', lugar: '', enlace: '' }
						try {
                            const ldScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]')) as HTMLScriptElement[]
                            const ld = ldScripts
                              .map((s) => { try { return JSON.parse(s.textContent || 'null') as unknown } catch { return null } })
                              .filter(Boolean) as unknown[]
                            for (const item of ld) {
                                const arr = Array.isArray(item) ? item : [item]
                                for (const objAny of arr) {
                                    const obj = objAny as Record<string, unknown>
                                    if (obj['@type'] === 'Event') {
                                        out.fecha = ((obj['startDate'] as string) || '').slice(0,10) || out.fecha
                                        const location = obj['location'] as Record<string, unknown> | undefined
                                        out.lugar = (location?.['name'] as string) || out.lugar
                                        out.enlace = (obj['url'] as string) || out.enlace
                                    }
                                }
                            }
						} catch {}
						// Fallbacks
						if (!out.fecha) {
							const t = document.querySelector('time, [itemprop="startDate"]')
							out.fecha = (t?.getAttribute('datetime') || t?.getAttribute('content') || '').slice(0,10)
						}
						if (!out.lugar) {
							out.lugar = text(document.querySelector('a.venue-link, .venue, .location, [itemprop="location"]'))
						}
						if (!out.enlace) {
							out.enlace = location.href
						}
						return out
					})
					await p2.close()
					ev.fecha = ev.fecha || detail.fecha
					ev.lugar = ev.lugar || detail.lugar
					ev.enlace = ev.enlace || detail.enlace
				} catch {}
			}))
		}

		const count = Array.isArray(events) ? events.length : 0
		if (DEBUG) console.error('[songkick] Extracted events:', count)
		await browser.close()
		return events
	} catch (e) {
		if (DEBUG) console.error('[songkick] Error:', (e as Error)?.message || e)
		if (browser) try { await browser.close() } catch {}
		return []
	}
}

export async function POST(request: NextRequest) {
	try {
		const { userData } = await request.json()
		const { latitude, longitude, radius = 50, userUuid, hotelName } = userData || {}

		if ((!latitude || !longitude) && !hotelName) {
			return NextResponse.json({ error: 'Missing latitude/longitude or hotelName' }, { status: 400 })
		}
		if (!userUuid) {
			return NextResponse.json({ error: 'Missing userUuid' }, { status: 400 })
		}

		console.log('[songkick-api] Starting scraping with params:', { latitude, longitude, radius, userUuid, hotelName })

		const events = await scrapeSongkick(latitude || 32.5149, longitude || -117.0382, radius)
		
		console.log('[songkick-api] Scraped events:', events.length)

		// Save to Supabase
		const SUPABASE_URL = process.env.SUPABASE_URL
		const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
		let inserted = 0
		
		if (SUPABASE_URL && SUPABASE_ANON_KEY && userUuid) {
			// Map events to DB schema and deduplicate
			const mapped = events.map((ev: EventRecord) => ({
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
			console.log('[songkick-api] Mapped events:', mapped.length, 'Deduplicated:', deduplicatedEvents.length)

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
						const json = (await res.json().catch(() => [])) as unknown[]
						inserted += Array.isArray(json) ? json.length : batch.length
						console.log('[songkick-api] Batch inserted:', Array.isArray(json) ? json.length : batch.length)
					} else {
						const errorText = await res.text().catch(() => '')
						console.error('[songkick-api] Supabase insert failed:', res.status, errorText)
					}
				} catch (e) {
					console.error('[songkick-api] Supabase insert error:', (e as Error)?.message)
				}
			}
		}

		console.log('[songkick-api] Final result - inserted:', inserted, 'total events:', events.length)
		return NextResponse.json({ success: true, inserted, count: Array.isArray(events) ? events.length : 0 })
	} catch (error) {
		console.error('Error in songkick-api:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
