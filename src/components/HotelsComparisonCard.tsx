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
  const [selectedStars, setSelectedStars] = useState<number | null>(5)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const userRowRef = useRef<HTMLTableRowElement | null>(null)

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
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? '#ff0000' : 'none'} stroke="#ff0000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    <div className="flex items-center gap-3" aria-label="Filter by stars">
      <button
        aria-label="All stars"
        onClick={() => setSelectedStars(null)}
        className={`px-2 py-1 rounded-md text-sm ring-1 transition-all duration-200 ${
          selectedStars == null
            ? 'bg-red-600 text-white ring-red-600 shadow-lg'
            : 'bg-white/60 text-gray-800 hover:bg-white ring-white/70'
        }`}
      >
        ALL
      </button>
      <div className="flex items-center gap-1" role="group" aria-label="Star options">
        {Array.from({ length: 5 }).map((_, i) => {
          const count = i + 1
          const active = selectedStars === count
          return (
            <button
              key={count}
              aria-label={`${count} stars`}
              onClick={() => setSelectedStars(count)}
              className={`p-1 rounded-md transition ${active ? 'bg-red-50' : 'hover:bg-white/60'}`}
            >
              <Star filled={selectedStars != null ? i < (selectedStars as number) : false} />
            </button>
          )
        })}
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-glass-300 rounded w-1/4"></div>
          <div className="h-4 bg-glass-300 rounded w-1/2"></div>
          <div className="h-4 bg-glass-300 rounded w-3/4"></div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300">
        <div className="text-center">
          <div className="text-red-600 text-lg font-semibold mb-2">Error loading data</div>
          <div className="text-gray-600">{error}</div>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300">
        <div className="text-center text-gray-600">No data available</div>
      </div>
    )
  }

  return (
    <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Hotels Comparison</h2>
          <p className="text-gray-600">Today: {data.today}</p>
        </div>
        <StarsFilter />
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="backdrop-blur-sm bg-glass-200 border border-glass-300 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-arkus-600">{formatMoney(data.myAvg)}</div>
          <div className="text-sm text-gray-600">My Hotel Average</div>
        </div>
        <div className="backdrop-blur-sm bg-glass-200 border border-glass-300 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-gray-700">{formatMoney(data.competitorsAvg)}</div>
          <div className="text-sm text-gray-600">Competitors Average</div>
        </div>
        <div className="backdrop-blur-sm bg-glass-200 border border-glass-300 rounded-xl p-4 text-center">
          <div className="text-2xl font-bold text-emerald-600">{data.position || '-'}</div>
          <div className="text-sm text-gray-600">Position</div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-glass-300">
        <div className="overflow-x-auto">
          <div ref={scrollRef} className="max-h-[410px] overflow-y-auto">
            <table className="w-full">
            <thead>
              <tr className="bg-glass-200 border-b border-glass-300">
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Rank</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Hotel Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Stars</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Average Price</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr
                  key={index}
                  ref={row.isUser ? userRowRef : null}
                  className={`border-b border-glass-200 transition-all duration-200 ${
                    row.isUser 
                      ? 'bg-arkus-50 border-l-4 border-arkus-500' 
                      : 'hover:bg-glass-50'
                  }`}
                >
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {row.rank ? `#${row.rank}` : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {row.name}
                    {row.isUser && (
                      <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-arkus-100 text-arkus-800">
                        YOU
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {row.estrellas ? <StarsRow count={row.estrellas} /> : '-'}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">
                    {formatMoney(row.avg)}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="mt-4 text-sm text-gray-600 text-center">
        {hasCompetitors ? (
          <span>Showing {data.competitorsCount} competitors</span>
        ) : (
          <span>No competitors found for the selected criteria</span>
        )}
      </div>
    </div>
  )
}


