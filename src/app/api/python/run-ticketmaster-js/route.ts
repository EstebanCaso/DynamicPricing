import { NextRequest, NextResponse } from 'next/server'
import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import fetch from 'node-fetch'

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

		// Use the Ticketmaster scraper script
		const scriptPath = path.join(process.cwd(), 'scripts', 'scrapeo_geo.js')
		if (!fs.existsSync(scriptPath)) {
			console.error('[run-ticketmaster-js] Script not found at path:', scriptPath)
			return NextResponse.json({ success: false, error: 'Script file not found' }, { status: 500 })
		}

		const args = [latitude.toString(), longitude.toString(), radius.toString()]
		console.log('[run-ticketmaster-js] Spawning process:', 'node', [scriptPath, ...args].join(' '))

		return await new Promise<Response>((resolve) => {
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
				const out = data.toString()
				stdout += out
				console.log('[run-ticketmaster-js][stdout]', out)
			})

			child.stderr.on('data', (data) => {
				const err = data.toString()
				stderr += err
				console.error('[run-ticketmaster-js][stderr]', err)
			})

			child.on('close', async (code) => {
				console.log('[run-ticketmaster-js] Process exited with code:', code)
				if (code === 0) {
					try {
						const parsed = JSON.parse(stdout || '[]')
						const events: Record<string, unknown>[] = Array.isArray(parsed) ? parsed : []

						// Save to Supabase: clear user events then insert
						const SUPABASE_URL = process.env.SUPABASE_URL
						const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
						let inserted = 0
						console.log('[run-ticketmaster-js] Events to save:', events.length, 'User:', userUuid, 'Hotel:', hotelName)
						if (SUPABASE_URL && SUPABASE_ANON_KEY && userUuid) {
							// Don't clear existing events - just insert new ones with conflict resolution

							// Map events to DB schema and deduplicate
								const mapped = events.map((ev: Record<string, unknown>) => ({
								nombre: ev.nombre || ev.name || '',
                                                          fecha: ((ev.fecha || ev.date || '') as string).slice(0, 10),
								lugar: ev.lugar || ev.venue || '',
								enlace: ev.enlace || ev.url || '',
								hotel_referencia: hotelName || '',
								created_by: userUuid,
								distancia: typeof ev.distance_km === 'number' ? ev.distance_km : null
							})).filter((e) => e.nombre && e.fecha)
							
							// Deduplicate by nombre + fecha + created_by (the conflict constraint)
							const uniqueEvents = mapped.reduce((acc, event) => {
								const key = `${event.nombre}|${event.fecha}|${event.created_by}`
								if (!acc.has(key)) {
									acc.set(key, event)
								}
								return acc
							}, new Map())
							
							const deduplicatedEvents = Array.from(uniqueEvents.values())
							console.log('[run-ticketmaster-js] Mapped events:', mapped.length, 'Deduplicated:', deduplicatedEvents.length, 'Sample:', deduplicatedEvents[0])

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
										const json = (await res.json().catch(() => [])) as Record<string, unknown>[]
										inserted += Array.isArray(json) ? json.length : batch.length
										console.log('[run-ticketmaster-js] Batch inserted:', Array.isArray(json) ? json.length : batch.length)
									} else {
										const errorText = await res.text().catch(() => '')
										console.error('[run-ticketmaster-js] Supabase insert failed:', res.status, errorText)
									}
								} catch (e) {
									console.error('[run-ticketmaster-js] Supabase insert error:', (e as Error)?.message)
								}
							}
						}

						console.log('[run-ticketmaster-js] Final result - inserted:', inserted, 'total events:', events.length)
						resolve(NextResponse.json({ success: true, inserted, count: Array.isArray(events) ? events.length : 0 }))
					} catch (err) {
						console.error('[run-ticketmaster-js] Failed to parse stdout or save:', (err as Error)?.message)
						resolve(NextResponse.json({ success: true, output: stdout, errors: stderr }))
					}
				} else {
					resolve(NextResponse.json({ success: false, output: stdout, errors: stderr, exitCode: code }, { status: 500 }))
				}
			})

			child.on('error', (err) => {
				console.error('[run-ticketmaster-js] Failed to spawn process:', err)
				resolve(NextResponse.json({ success: false, error: 'Failed to start process', details: err.message }, { status: 500 }))
			})
		})
	} catch (error) {
		console.error('Error in run-ticketmaster-js:', error)
		return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
	}
}
