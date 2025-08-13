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

  const clearSelection = () => {
    setSelectedDate(null)
    setPrices(null)
    setError(null)
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Calendar & Events</h2>
            <p className="text-gray-600">View upcoming events and hotel pricing</p>
          </div>
          {selectedDate && (
            <button
              onClick={clearSelection}
              className="px-4 py-2 bg-glass-200 text-gray-700 rounded-lg hover:bg-glass-300 transition-all duration-200"
            >
              Clear Selection
            </button>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {months.map((monthStart) => {
          const monthEnd = endOfMonth(monthStart)
          const daysInMonth = monthEnd.getDate()
          const firstDayOfWeek = monthStart.getDay()
          
          return (
            <div key={monthStart.toISOString()} className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">{formatMonth(monthStart)}</h3>
              <div className="grid grid-cols-7 gap-1">
                {['S','M','T','W','T','F','S'].map((d) => (
                  <div key={d} className="text-center text-sm font-medium text-gray-500 py-2">{d}</div>
                ))}

                {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                  <div key={`blank-${i}`} className="w-10 h-10" />
                ))}
                
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1
                  const dateISO = isoDate(new Date(monthStart.getFullYear(), monthStart.getMonth(), day))
                  const dayEvents = eventsByDate.get(dateISO) || []
                  const isSelected = selectedDate === dateISO
                  const isToday = dateISO === isoDate(today)
                  
                  return (
                    <button
                      key={day}
                      onClick={() => handleSelectDate(dateISO)}
                      className={`w-10 h-10 rounded flex items-center justify-center text-base relative border transition-all duration-200 ${
                        isSelected
                          ? 'bg-arkus-600 text-white border-arkus-600 ring-2 ring-arkus-300'
                          : isToday
                          ? 'bg-arkus-100 text-arkus-800 border-arkus-300 hover:bg-arkus-200'
                          : 'bg-glass-200 text-gray-900 border-glass-300 hover:bg-glass-300 hover:ring-1 hover:ring-arkus-300'
                      }`}
                    >
                      {day}
                      {dayEvents.length > 0 && (
                        <span
                          title={`${dayEvents.length} events`}
                          className="absolute top-0.5 right-0.5 w-2 h-2 bg-arkus-500 rounded-full"
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Selected Date Details */}
      {selectedDate && (
        <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
          <h3 className="text-xl font-semibold text-gray-900 mb-4">
            {formatNiceDate(selectedDate)}
          </h3>
          
          {/* Events */}
          <div className="mb-6">
            <h4 className="text-lg font-medium text-gray-800 mb-3">Events</h4>
            {loadingEvents ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-glass-300 rounded w-3/4"></div>
                <div className="h-4 bg-glass-300 rounded w-1/2"></div>
              </div>
            ) : eventsByDate.get(selectedDate)?.length ? (
              <div className="space-y-2">
                {eventsByDate.get(selectedDate)?.map((event, index) => (
                  <div key={index} className="backdrop-blur-sm bg-glass-200 border border-glass-300 rounded-lg p-3">
                    <div className="font-medium text-gray-900">{event.nombre || 'Unnamed Event'}</div>
                    {event.lugar && <div className="text-sm text-gray-600">📍 {event.lugar}</div>}
                    {event.enlace && (
                      <a
                        href={event.enlace}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-arkus-600 hover:text-arkus-700 underline"
                      >
                        View Details
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-500">No events scheduled for this date</div>
            )}
          </div>

          {/* Hotel Prices */}
          <div>
            <h4 className="text-lg font-medium text-gray-800 mb-3">Hotel Prices</h4>
            {loadingPrices ? (
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-glass-300 rounded w-1/2"></div>
                <div className="h-4 bg-glass-300 rounded w-3/4"></div>
              </div>
            ) : prices ? (
              <div className="space-y-2">
                <div className="text-sm text-gray-600 mb-2">
                  {prices.hotelName} - {prices.date}
                </div>
                {prices.items.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {prices.items.map((item, index) => (
                      <div key={index} className="backdrop-blur-sm bg-glass-200 border border-glass-300 rounded-lg p-3">
                        <div className="font-medium text-gray-900">{item.room_type}</div>
                        <div className="text-lg font-semibold text-arkus-600">{formatMoney(item.price)}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500">No pricing data available for this date</div>
                )}
              </div>
            ) : (
              <div className="text-gray-500">Select a date to view hotel pricing</div>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="backdrop-blur-xl bg-red-50 border border-red-200 rounded-2xl shadow-xl p-6">
          <div className="text-red-800">
            <div className="font-medium mb-2">Error</div>
            <div>{error}</div>
          </div>
        </div>
      )}
    </div>
  )
}


