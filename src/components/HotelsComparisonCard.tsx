"use client"

import { useEffect, useMemo, useRef, useState } from 'react'

type CompareData = {
  today: string
  myHotelName: string
  myAvg: number | null
  competitors: Array<{ name: string; avg: number; estrellas: number | null }>
  competitorsAvg: number | null
  competitorsCount: number
  position: number | null
  starsFilter?: number | null
}

export default function HotelsComparisonCard() {
  const [data, setData] = useState<CompareData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedStars, setSelectedStars] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const userRowRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/compare/hotels', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stars: selectedStars }),
        })
        const json = await res.json()
        if (!json?.success) throw new Error(json?.error || 'Failed')
        setData(json.data)
      } catch (e: any) {
        setError(e?.message || 'Failed to load')
        setData(null)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [selectedStars])

  const hasCompetitors = (data?.competitorsCount || 0) > 0
  const rows = useMemo(() => {
    if (!data) return [] as Array<{ name: string; avg: number | null; estrellas: number | null; isUser: boolean; rank: number | null }>
    const comp = data.competitors.map((c) => ({ name: c.name, avg: c.avg, estrellas: c.estrellas, isUser: false }))
    const mine = { name: data.myHotelName, avg: data.myAvg, estrellas: null as number | null, isUser: true }
    const all = [...comp, mine]
    all.sort((a, b) => {
      const aVal = a.avg == null ? Number.POSITIVE_INFINITY : a.avg
      const bVal = b.avg == null ? Number.POSITIVE_INFINITY : b.avg
      return aVal - bVal
    })
    return all.map((r, idx) => ({ ...r, rank: r.avg == null ? null : idx + 1 }))
  }, [data])

  // Full list will be scrollable; no windowing needed
  // After data renders, ensure we auto-scroll to the user's row
  useEffect(() => {
    const container = scrollRef.current
    const target = userRowRef.current
    if (!container || !target) return
    // Compute offset of target inside the scroll container
    const containerTop = container.getBoundingClientRect().top
    const targetTop = target.getBoundingClientRect().top
    const delta = targetTop - containerTop
    container.scrollTop = Math.max(0, delta - Math.round(container.clientHeight * 0.3))
  }, [rows])

  const formatMoney = (value: number | null | undefined) => {
    if (value == null || !Number.isFinite(value as number)) return '-'
    return `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value as number)}`
  }

  const Star = ({ filled }: { filled: boolean }) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? '#ef4444' : 'none'} stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9" />
    </svg>
  )

  const StarsRow = ({ count }: { count: number }) => (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} filled={i < count} />
      ))}
    </div>
  )

  const StarsFilter = () => (
    <div className="flex items-center gap-2">
      <button
        aria-label="All stars"
        onClick={() => setSelectedStars(null)}
        className={`px-2 py-1 rounded-md text-sm ring-1 ring-gray-200 ${selectedStars == null ? 'bg-red-600 text-white ring-red-600' : 'bg-white hover:bg-gray-50 text-gray-700'}`}
      >
        ALL
      </button>
      {Array.from({ length: 5 }).map((_, i) => {
        const val = i + 1
        const filled = (selectedStars ?? 0) >= val
        return (
          <button
            key={val}
            aria-label={`${val} star filter`}
            onClick={() => setSelectedStars(selectedStars === val ? null : val)}
            className="p-1 rounded-md hover:bg-gray-50"
          >
            <Star filled={filled} />
          </button>
        )
      })}
    </div>
  )

  return (
    <div className="bg-white rounded-[25px] p-6 shadow-sm h-[700px] flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-3xl font-semibold text-gray-900">Hotels Comparison</h2>
        <StarsFilter />
      </div>
      {loading && <div className="text-sm text-gray-500">Loading…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {!loading && data && (
        <div className="flex-1 flex flex-col min-h-0 space-y-4">
          <div className="grid grid-cols-3 gap-4 text-base font-medium text-gray-600">
            <div className="pl-8">Hotels</div>
            <div className="text-center">Fee</div>
            <div className="text-center">Position</div>
          </div>

          <div ref={scrollRef} className="divide-y divide-gray-100 rounded-2xl overflow-auto border border-gray-100 flex-1 min-h-0">
            {rows.map((r) => {
              const pos = r.rank ?? '-'
              const isUser = r.isUser
              if (isUser) {
                return (
                  <div ref={userRowRef} key={r.name + (r.rank ?? '-') } className="py-3 px-2 bg-white">
                    <div className="flex rounded-2xl overflow-hidden shadow-sm">
                      <div className="flex-1 bg-white border-2 border-red-600 rounded-l-2xl px-4 py-3 flex items-center relative z-10">
                        <div className="flex flex-col space-y-1 flex-1 pl-8">
                          <span className="text-base font-bold text-gray-900">{r.name}</span>
                        </div>
                        <div className="text-base font-bold text-red-600 text-center flex-1">{formatMoney(r.avg != null ? Math.round(r.avg) : null)}</div>
                      </div>
                      <div className="w-1/3 bg-red-600 rounded-r-2xl flex items-center justify-center px-4 py-3 relative -ml-2">
                        <span className="text-lg font-bold text-white">{pos}</span>
                      </div>
                    </div>
                  </div>
                )
              }
              return (
                <div key={r.name + (r.rank ?? '-') } className="grid grid-cols-3 gap-4 items-center py-3 bg-white">
                  <div className="flex flex-col space-y-1 pl-8">
                    <span className="text-base">{r.name}</span>
                    {typeof r.estrellas === 'number' && r.estrellas > 0 && (
                      <div className="mt-0.5"><StarsRow count={Math.min(5, Math.max(1, r.estrellas))} /></div>
                    )}
                  </div>
                  <div className="text-base text-center">{formatMoney(r.avg != null ? Math.round(r.avg) : null)}</div>
                  <div className="text-base text-center text-gray-600">{pos}</div>
                </div>
              )
            })}
          </div>

          {!hasCompetitors && (
            <div className="text-sm text-gray-500">
              no se encuentran competidores por falta de fechas
            </div>
          )}
        </div>
      )}
    </div>
  )
}


