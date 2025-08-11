"use client"

import { useEffect, useMemo, useState } from 'react'

type EventItem = { id?: string; nombre?: string | null; fecha?: string | null; lugar?: string | null; enlace?: string | null }
type PriceItem = { room_type: string; price: number | null }

function formatMonth(date: Date) {
  return date.toLocaleString('en-US', { month: 'long' })
}

function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1) }
function endOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth() + 1, 0) }
function isoDate(d: Date): string { return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }
function parseYMDToLocalDate(ymd?: string | null): Date | null {
  if (!ymd) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2]) - 1
  const d = Number(m[3])
  return new Date(y, mo, d)
}
function formatNiceDate(ymd?: string | null): string {
  const d = parseYMDToLocalDate(ymd)
  return d ? d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'long', day: '2-digit' }) : ''
}
function formatMoney(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)}`
}

export default function CalendarTab() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [loadingPrices, setLoadingPrices] = useState(false)
  const [prices, setPrices] = useState<{ hotelName: string; date: string; items: PriceItem[] } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Load events upcoming 90 days
  useEffect(() => {
    const run = async () => {
      try {
        setLoadingEvents(true)
        const res = await fetch('/api/calendar/events', { cache: 'no-store' })
        const json = await res.json()
        if (!json?.success) throw new Error(json?.error || 'Failed to load events')
        setEvents(json.data.events || [])
      } catch (e: any) {
        setError(e?.message || 'Failed to load events')
        setEvents([])
      } finally {
        setLoadingEvents(false)
      }
    }
    run()
  }, [])

  // Open with selected date from URL if present
  useEffect(() => {
    const url = new URL(window.location.href)
    const from = url.searchParams.get('date')
    if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) {
      // Delay to ensure eventsByDate is ready is not necessary; prices fetch independent
      handleSelectDate(from)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Build a map date -> events
  const eventsByDate = useMemo(() => {
    const map = new Map<string, EventItem[]>()
    for (const ev of events) {
      const key = (ev.fecha || '').slice(0, 10)
      if (!key) continue
      const arr = map.get(key) || []
      arr.push(ev)
      map.set(key, arr)
    }
    return map
  }, [events])

  const today = new Date()
  const months = [0, 1, 2].map((i) => new Date(today.getFullYear(), today.getMonth() + i, 1))

  const handleSelectDate = async (dateISO: string) => {
    setSelectedDate(dateISO)
    setPrices(null)
    try {
      setLoadingPrices(true)
      const res = await fetch('/api/calendar/hotel-prices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: dateISO }) })
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || 'Failed to load prices')
      setPrices({ hotelName: json.data.hotelName, date: json.data.date, items: json.data.prices || [] })
    } catch (e: any) {
      setError(e?.message || 'Failed to load prices')
      setPrices(null)
    } finally {
      setLoadingPrices(false)
    }
  }

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Left: 3 months (33%) */}
      <div className="col-span-1 space-y-6">
        {months.map((m) => {
          const end = endOfMonth(m).getDate()
          const label = formatMonth(m)
          const year = m.getFullYear()
          const monthIndex = m.getMonth()
          return (
            <div key={`${year}-${monthIndex}`} className="bg-white rounded-[25px] p-6 shadow-sm">
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">{label}</h3>
              <div className="grid grid-cols-7 gap-1">
                {['S','M','T','W','T','F','S'].map((d) => (
                  <div key={d} className="text-center text-sm font-medium text-gray-500 py-2">{d}</div>
                ))}
                {/* Leading blanks to align first weekday */}
                {Array.from({ length: startOfMonth(m).getDay() }, (_, i) => (
                  <div key={`blank-${i}`} className="w-10 h-10" />
                ))}
                {Array.from({ length: end }, (_, i) => {
                  const day = i + 1
                  const dateISO = isoDate(new Date(year, monthIndex, day))
                  const has = eventsByDate.has(dateISO)
                  const selected = selectedDate === dateISO
                  return (
                    <button
                      key={day}
                      onClick={() => (has ? handleSelectDate(dateISO) : setSelectedDate(dateISO))}
                      className={`w-10 h-10 rounded flex items-center justify-center text-base relative border ${selected ? 'bg-red-500 text-white border-red-500' : 'bg-gray-100 text-gray-900 border-transparent'} hover:ring-1 hover:ring-red-300`}
                      aria-label={`Day ${day}`}
                    >
                      {day}
                      {has && !selected && <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

             {/* Right: either Events list (default) or Selected date prices */}
       <div className="col-span-2 space-y-6 sticky top-8 self-start">
        {!selectedDate ? (
          <div className="bg-white rounded-[25px] p-6 shadow-sm h-[750px] flex flex-col">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Events Incoming</h2>
            {loadingEvents ? (
              <div className="text-gray-600">Loading…</div>
            ) : (
              <div className="space-y-4 flex-1 min-h-0 overflow-auto pr-2 pb-2">
                {events.length === 0 && <div className="text-gray-600 text-sm">No events found.</div>}
                {events.map((ev) => {
                  const d = parseYMDToLocalDate(ev.fecha)
                  const month = d ? d.toLocaleString('en-US', { month: 'short' }).toUpperCase() : ''
                  const day = d ? d.getDate() : ''
                  return (
                    <div key={(ev.id || ev.enlace || ev.nombre || '') + (ev.fecha || '')} className="flex items-start gap-4">
                      <div className="flex flex-col items-center justify-center w-20 h-16 rounded-xl border border-gray-300">
                        <div className="text-red-500 font-semibold text-sm">{month}</div>
                        <div className="text-2xl font-bold">{day}</div>
                      </div>
                      <div className="flex-1">
                        <button
                          className="text-xl font-semibold text-gray-900 text-left hover:underline"
                          onClick={() => ev.fecha && handleSelectDate(ev.fecha.slice(0,10))}
                        >
                          {ev.nombre || 'Event'}
                        </button>
                        <div className="text-gray-600 text-sm">{ev.lugar || ''}</div>
                        {ev.enlace && (
                          <a className="text-red-600 text-sm hover:underline" href={ev.enlace} target="_blank" rel="noreferrer">Visit site 🔗</a>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-[25px] p-6 shadow-sm h-[750px] flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-3xl font-semibold text-gray-900">{prices?.hotelName || 'Mi hotel'}</h2>
              <div className="text-red-600 text-lg">{formatNiceDate(selectedDate)}</div>
            </div>
            {/* Highlight primary event for selected date */}
            {(() => {
              const selectedEvents = eventsByDate.get(selectedDate) || []
              const ev = selectedEvents[0]
              if (!ev) return null
              return (
                <div className="mb-4">
                  <div className="text-2xl font-semibold text-gray-900">{ev.nombre}</div>
                  <div className="text-base">
                    {ev.enlace && (
                      <a className="text-red-600 hover:underline" href={ev.enlace} target="_blank" rel="noreferrer">Visit site 🔗</a>
                    )}
                  </div>
                  <div className="text-base text-gray-600">{formatNiceDate(ev.fecha)}{ev.lugar ? ` · ${ev.lugar}` : ''}</div>
                </div>
              )
            })()}
            {loadingPrices ? (
              <div className="text-gray-600">Loading prices…</div>
            ) : prices?.items && prices.items.length > 0 ? (
              <div className="flex-1 overflow-x-auto overflow-y-auto min-h-0">
                <table className="min-w-full text-left">
                  <thead>
                    <tr className="text-red-600">
                      <th className="py-3 pr-6 font-semibold text-lg">Room type</th>
                      <th className="py-3 pr-6 font-semibold text-lg">Base Price</th>
                      <th className="py-3 pr-6 font-semibold text-lg">Recommendation</th>
                      <th className="py-3 pr-6 font-semibold text-lg">Accept Final Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prices.items.map((p, i) => (
                      <tr key={i} className="border-t">
                        <td className="py-3 pr-6 text-lg">{p.room_type}</td>
                        <td className="py-3 pr-6 text-lg">{formatMoney(p.price as number)}</td>
                        <td className="py-3 pr-6 text-lg text-red-600">+20% ({p.price != null ? formatMoney(Math.round((p.price as number) * 1.2)) : '-'})</td>
                        <td className="py-3 pr-6"><button className="px-5 py-2 rounded-full bg-red-600 text-white text-base">Accept</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-gray-600 text-sm">No prices for the selected date.</div>
            )}
            <div className="mt-4">
              <button className="text-sm text-gray-600 hover:underline" onClick={() => { setSelectedDate(null); setPrices(null) }}>Back to events</button>
            </div>
          </div>
        )}
        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>
    </div>
  )
}


