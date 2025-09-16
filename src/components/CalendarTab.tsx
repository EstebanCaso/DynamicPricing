"use client"

import { useEffect, useMemo, useState } from 'react'
import { 
  logDataFlow
} from '@/lib/dataUtils'
import { useCurrency } from '@/contexts/CurrencyContext'
import { supabase } from '@/lib/supabaseClient'
import CurrencySelector from './CurrencySelector'

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


export default function CalendarTab() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [loadingEvents, setLoadingEvents] = useState(false)
  const [loadingPrices, setLoadingPrices] = useState(false)
  const [prices, setPrices] = useState<{ hotelName: string; date: string; items: PriceItem[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedMap, setSelectedMap] = useState<Record<string, boolean>>({})
  const [selectAll, setSelectAll] = useState<boolean>(true)
  const [isApplying, setIsApplying] = useState<boolean>(false)
  const [bulkMode, setBulkMode] = useState<boolean>(false)
  const [manualPercent, setManualPercent] = useState<number>(0)
  const { selectedCurrency, currency, convertPriceToSelectedCurrency } = useCurrency()

  // Force re-render when currency changes
  useEffect(() => {
    // This will force the component to re-render when currency changes
  }, [selectedCurrency]);

  // Format money function with currency conversion
  const formatMoney = (value?: number | null, originalCurrency: 'MXN' | 'USD' = 'MXN'): string => {
    if (value == null || !Number.isFinite(value)) return '-'
    const convertedValue = convertPriceToSelectedCurrency(value, originalCurrency)
    return currency.format(convertedValue)
  }

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

  // Load active price rules to highlight dates
  const [activeRuleDates, setActiveRuleDates] = useState<Set<string>>(new Set())
  const [activeRules, setActiveRules] = useState<Array<{ rule_type: 'competition' | 'weekend' | 'high_season' | 'low_season' | 'holiday'; start_date: string | null; end_date: string | null; holiday_date: string | null; adjustment: number; adjustment_type: 'percent' | 'fixed'; }>>([])
  useEffect(() => {
    const loadActiveRules = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser()
        const userId = userData.user?.id
        if (!userId) return
        const { data, error: qErr } = await supabase
          .from('price_rules')
          .select('rule_type,start_date,end_date,holiday_date,adjustment,adjustment_type')
          .eq('created_by', userId)
          .eq('active', true)
        if (qErr) throw qErr
        const dates = new Set<string>()
        const addDate = (d?: string | null) => { if (d) dates.add(d) }
        const withinNextMonths = (d: Date) => {
          const start = startOfMonth(today)
          const end = endOfMonth(new Date(today.getFullYear(), today.getMonth() + 2, 1))
          return d >= start && d <= end
        }
        const rules = (data as any[]) || []
        for (const r of rules) {
          if (r.rule_type === 'holiday') {
            const d = parseYMDToLocalDate(r.holiday_date)
            if (d && withinNextMonths(d)) addDate(isoDate(d))
          } else if (r.rule_type === 'high_season' || r.rule_type === 'low_season') {
            const s = parseYMDToLocalDate(r.start_date)
            const e = parseYMDToLocalDate(r.end_date)
            if (s && e) {
              const cur = new Date(s.getFullYear(), s.getMonth(), s.getDate())
              while (cur <= e) {
                if (withinNextMonths(cur)) addDate(isoDate(cur))
                cur.setDate(cur.getDate() + 1)
              }
            }
          } else if (r.rule_type === 'weekend') {
            // Mark upcoming weekends in the 3-month window
            const start = startOfMonth(today)
            const end = endOfMonth(new Date(today.getFullYear(), today.getMonth() + 2, 1))
            const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate())
            while (cur <= end) {
              const dow = cur.getDay()
              if (dow === 5 || dow === 6) addDate(isoDate(cur))
              cur.setDate(cur.getDate() + 1)
            }
          } else if (r.rule_type === 'competition') {
            // No specific dates; skip highlighting per-day
          }
        }
        setActiveRuleDates(dates)
        setActiveRules(rules)
      } catch {
        setActiveRuleDates(new Set())
        setActiveRules([])
      }
    }
    void loadActiveRules()
  }, [])

  function getIncreasePercentForDate(ymd?: string | null): number {
    const d = parseYMDToLocalDate(ymd)
    if (!d) return 0
    const dow = d.getDay() // 0=Sun ... 6=Sat
    if (dow === 0) return 0.20
    if (dow === 1 || dow === 2) return 0.07
    if (dow === 3) return 0.10
    if (dow === 4) return 0.15
    if (dow === 5 || dow === 6) return 0.20
    return 0
  }

  const dayHasEvents = useMemo(() => {
    if (!selectedDate) return false
    return (eventsByDate.get(selectedDate)?.length || 0) > 0
  }, [selectedDate, eventsByDate])

  function getRuleAdjustmentForDate(ymd?: string | null): { pct: number; fixed: number } {
    const date = parseYMDToLocalDate(ymd)
    if (!date) return { pct: 0, fixed: 0 }
    let pct = 0
    let fixed = 0
    for (const r of activeRules) {
      let applies = false
      if (r.rule_type === 'competition') applies = true
      else if (r.rule_type === 'weekend') {
        const dow = date.getDay(); applies = dow === 5 || dow === 6
      } else if (r.rule_type === 'holiday') {
        const d = parseYMDToLocalDate(r.holiday_date); applies = !!d && isoDate(d) === isoDate(date)
      } else {
        const s = parseYMDToLocalDate(r.start_date); const e = parseYMDToLocalDate(r.end_date)
        applies = !!s && !!e && date >= s && date <= e
      }
      if (!applies) continue
      if (r.adjustment_type === 'percent') pct += Number(r.adjustment || 0)
      else fixed += Number(r.adjustment || 0)
    }
    return { pct, fixed }
  }

  const recommended = useMemo(() => {
    if (!prices) return [] as Array<{ room_type: string; base: number; next: number }>
    const items = (prices.items || []).filter((x): x is { room_type: string; price: number } => x.price != null)
    const adj = getRuleAdjustmentForDate(prices.date)
    const hasRules = adj.pct !== 0 || adj.fixed !== 0
    const extraPct = !hasRules && !dayHasEvents ? Math.max(0, (manualPercent || 0) / 100) : 0
    return items.map((x) => {
      const base = x.price as number
      const afterRules = Math.round((base * (1 + adj.pct / 100)) + adj.fixed)
      const next = hasRules ? afterRules : Math.round(base * (1 + extraPct))
      return { room_type: x.room_type, base, next }
    })
  }, [prices, activeRules, manualPercent, dayHasEvents])

  useEffect(() => {
    // Reset selection map whenever new prices load
    const init: Record<string, boolean> = {}
    for (const r of recommended) init[r.room_type] = true
    setSelectedMap(init)
    setSelectAll(true)
    setBulkMode(false)
  }, [recommended])

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

  const toggleSelectAll = () => {
    const nextValue = !selectAll
    setSelectAll(nextValue)
    const next: Record<string, boolean> = {}
    for (const r of recommended) next[r.room_type] = nextValue
    setSelectedMap(next)
    if (!nextValue) {
      // Exiting bulk mode when nothing is selected
      setBulkMode(false)
    }
  }

  const toggleOne = (roomType: string) => {
    setSelectedMap((prev) => {
      const next = { ...prev, [roomType]: !prev[roomType] }
      const allOn = recommended.length > 0 && recommended.every((r) => next[r.room_type])
      setSelectAll(allOn)
      const noneOn = recommended.length > 0 && recommended.every((r) => !next[r.room_type])
      if (noneOn) {
        setSelectAll(false)
        setBulkMode(false)
      }
      return next
    })
  }

  async function applyUpdates(items: Array<{ room_type: string; new_price: number }>) {
    try {
      setIsApplying(true)
      const res = await fetch('/api/calendar/apply-prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: selectedDate, items }),
      })
      const json = await res.json()
      if (!json?.success) throw new Error(json?.error || 'Failed to apply updates')
      // Refresh prices to reflect new applied values
      if (selectedDate) await handleSelectDate(selectedDate)
    } catch (e: any) {
      setError(e?.message || 'Failed to apply updates')
    } finally {
      setIsApplying(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Controls */}
      <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-4 hover:shadow-2xl transition-all duration-300">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Calendar & Pricing</h2>
            <p className="text-gray-600 text-sm">Manage your hotel pricing by date</p>
          </div>
          <CurrencySelector showLabel={true} />
        </div>
      </div>
      
      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Left: Months (33%) */}
        <div className="lg:w-1/3 space-y-8">
          {months.map((monthStart) => {
            const monthEnd = endOfMonth(monthStart)
            const daysInMonth = monthEnd.getDate()
            const firstDayOfWeek = monthStart.getDay()
            return (
              <div key={monthStart.toISOString()} className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">{formatMonth(monthStart)}</h3>
                <div className="grid grid-cols-7 gap-1">
                  {['S','M','T','W','T','F','S'].map((d, i) => (
                    <div key={`${d}-${i}`} className="text-center text-sm font-medium text-gray-500 py-2">{d}</div>
                  ))}
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`blank-${i}`} className="w-10 h-10" />
                  ))}
                  {Array.from({ length: daysInMonth }, (_, i) => {
                    const day = i + 1
                    const dateISO = isoDate(new Date(monthStart.getFullYear(), monthStart.getMonth(), day))
                    const dayEvents = eventsByDate.get(dateISO) || []
                    const hasRule = activeRuleDates.has(dateISO)
                    const isSelected = selectedDate === dateISO
                    const isToday = dateISO === isoDate(today)
                    return (
                      <button
                        key={day}
                        onClick={() => handleSelectDate(dateISO)}
                        className={`w-10 h-10 rounded flex items-center justify-center text-base relative border transition-all duration-200 ${
                          isSelected
                            ? 'bg-red-600 text-white border-red-600 ring-2 ring-red-300'
                            : isToday
                            ? 'bg-white/60 text-gray-900 border-white/70 hover:bg-white'
                            : 'bg-glass-200 text-gray-900 border-glass-300 hover:bg-glass-300 hover:ring-1 hover:ring-red-300'
                        }`}
                      >
                        {day}
                        {dayEvents.length > 0 && (
                          <span title={`${dayEvents.length} events`} className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-600 rounded-full" />
                        )}
                        {hasRule && (
                          <span title="Regla activa" className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-amber-500 rounded-full" />
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Right: Details (66%) - sticky */}
        <div className="lg:w-2/3 sticky top-8 self-start">
          
            {!selectedDate ? (
              <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-bold text-gray-900">Upcoming events</h3>
                  <span className="text-sm text-gray-600">{events.length} events</span>
                </div>
                {loadingEvents ? (
                  <div className="space-y-2 animate-pulse">
                    <div className="h-4 bg-glass-300 rounded w-3/4"></div>
                    <div className="h-4 bg-glass-300 rounded w-2/3"></div>
                    <div className="h-4 bg-glass-300 rounded w-1/2"></div>
                  </div>
                ) : events.length ? (
                  <div className="space-y-2 max-h-[60vh] overflow-auto">
                    {events.map((event, idx) => {
                      const ymd = (event.fecha || '').slice(0, 10)
                      const d = parseYMDToLocalDate(ymd)
                      const mon = d ? d.toLocaleString('en-US', { month: 'short' }).toUpperCase() : ''
                      const dayStr = d ? String(d.getDate()).padStart(2, '0') : ''
                      return (
                        <button
                          key={idx}
                          onClick={() => ymd && handleSelectDate(ymd)}
                          className="w-full text-left backdrop-blur-sm bg-glass-200 border border-glass-300 rounded-xl p-4 flex items-center gap-4 hover:bg-glass-300 transition"
                        >
                          <div className="w-16 h-20 rounded-xl border border-gray-300 bg-white/70 flex flex-col items-center justify-center">
                            <div className="text-red-600 font-bold text-lg leading-none">{mon}</div>
                            <div className="text-2xl font-bold text-gray-900 leading-none mt-1">{dayStr}</div>
                          </div>
                          <div className="flex-1">
                            <div className="text-2xl font-semibold text-gray-900 leading-snug">{event.nombre || 'Evento'}</div>
                            {event.lugar ? (
                              <div className="text-base text-gray-700 mt-1">{event.lugar}</div>
                            ) : null}
                            {event.enlace && (
                              <a
                                href={event.enlace}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-block text-base text-red-600 hover:text-red-700 underline mt-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Visit site 🔗
                              </a>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-gray-500">No upcoming events</div>
                )}
              </div>
            ) : (
              <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-baseline gap-3">
                    <h3 className="text-2xl font-bold text-gray-900">{prices ? prices.hotelName : ''}</h3>
                    <div className="text-xl text-gray-700">{formatNiceDate(selectedDate)}</div>
                  </div>
                </div>
                {/* Eventos del día con altura máxima y truncamiento */}
                {eventsByDate.get(selectedDate)?.length ? (
                  <div className="mb-4">
                    <div className="max-h-[200px] overflow-y-auto pr-2">
                      <div className="space-y-3">
                        {eventsByDate.get(selectedDate)!.map((event, i) => (
                          <div key={i} className="flex items-center justify-between">
                            <div 
                              className="text-2xl font-semibold text-gray-900 truncate max-w-[400px]"
                              title={event.nombre || 'Event'}
                            >
                              {event.nombre || 'Event'}
                            </div>
                            {event.enlace && (
                              <a href={event.enlace} target="_blank" rel="noopener noreferrer" className="text-base text-red-600 hover:text-red-700 underline flex-shrink-0 ml-2">
                                Visit site 🔗
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
                {loadingPrices ? (
                  <div className="space-y-2 animate-pulse">
                    <div className="h-4 bg-glass-300 rounded w-1/2"></div>
                    <div className="h-4 bg-glass-300 rounded w-3/4"></div>
                  </div>
                ) : recommended.length ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => {
                            if (bulkMode) {
                              // turn off bulk mode and clear selections
                              setBulkMode(false)
                              setSelectAll(false)
                              const cleared: Record<string, boolean> = {}
                              for (const r of recommended) cleared[r.room_type] = false
                              setSelectedMap(cleared)
                              return
                            }
                            // enable bulk mode with all selected by default
                            const init: Record<string, boolean> = {}
                            for (const r of recommended) init[r.room_type] = true
                            setSelectedMap(init)
                            setSelectAll(true)
                            setBulkMode(true)
                          }}
                          className={`${bulkMode ? 'bg-red-600 text-white hover:bg-red-700 border border-red-600' : 'bg-white/20 text-gray-900 hover:bg-white border border-red/20'} px-3 py-2 rounded-lg`}
                        >
                          {bulkMode ? 'Cancel' : 'Select to apply'}
                        </button>
                      </div>
                      {dayHasEvents ? (
                        <div className="text-base text-gray-700">
                          Recommendation: <span className="font-semibold text-red-600">{Math.round(getIncreasePercentForDate(prices?.date) * 100)}%</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 text-base text-gray-700">
                          <span>Custom increase</span>
                          <input
                            aria-label="Custom increase percent"
                            type="range"
                            min={0}
                            max={100}
                            value={Number.isFinite(manualPercent) ? manualPercent : 0}
                            onChange={(e) => setManualPercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                            className="w-40 accent-red-600"
                          />
                          <input
                            aria-label="Custom increase percent input"
                            type="number"
                            min={0}
                            max={100}
                            value={Number.isFinite(manualPercent) ? manualPercent : 0}
                            onChange={(e) => setManualPercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                            className="w-16 px-2 py-1 rounded border border-glass-300 bg-white/70 text-gray-900"
                          />
                          <span className="font-semibold text-red-600">%</span>
                        </div>
                      )}
                    </div>
                    <div className="rounded-xl overflow-hidden border border-glass-200">
                      <div className="divide-y divide-glass-300 max-h-[700px] overflow-y-auto">
                        {recommended.map((r) => (
                          <div key={r.room_type} className="backdrop-blur-sm bg-glass-100/70 px-5 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {bulkMode ? (
                                <input
                                  type="checkbox"
                                  className="accent-red-600"
                                  checked={!!selectedMap[r.room_type]}
                                  onChange={() => toggleOne(r.room_type)}
                                />
                              ) : null}
                              <div>
                                <div className="font-semibold text-gray-900 text-lg md:text-xl">{r.room_type}</div>
                                <div className="text-base text-gray-700">Current {formatMoney(r.base, 'MXN')}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-right">
                                <div className="text-sm text-gray-600">New</div>
                                <div className="font-bold text-red-600 text-xl">{formatMoney(r.next, 'MXN')}</div>
                              </div>
                              <button
                                disabled={isApplying}
                                onClick={() => applyUpdates([{ room_type: r.room_type, new_price: r.next }])}
                                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-base"
                              >
                                Accept
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {bulkMode ? (
                      <div className="mt-4 flex items-center justify-between">
                        <div className="text-base text-gray-700">
                          Selected {recommended.filter((r) => selectedMap[r.room_type]).length} / {recommended.length}
                        </div>
                        <button
                          disabled={isApplying || recommended.every((r) => !selectedMap[r.room_type])}
                          onClick={() => applyUpdates(recommended.filter((r) => selectedMap[r.room_type]).map((r) => ({ room_type: r.room_type, new_price: r.next })))}
                          className="px-5 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-base"
                        >
                          Apply all
                        </button>
                      </div>
                    ) : null}
                    <div className="mt-4">
                      <button
                        onClick={clearSelection}
                        className="px-4 py-2 rounded-lg bg-white/60 text-gray-800 hover:bg-white transition-all duration-200 border border-white/70"
                      >
                        Clear Selection
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-gray-500">No pricing data available for this date</div>
                )}
              </div>
            )}

            {error && (
              <div className="backdrop-blur-xl bg-red-50 border border-red-200 rounded-2xl shadow-xl p-6">
                <div className="text-red-800">
                  <div className="font-medium mb-2">Error</div>
                  <div>{error}</div>
                </div>
              </div>
            )}
          
        </div>
      </div>
    </div>
  )
}


