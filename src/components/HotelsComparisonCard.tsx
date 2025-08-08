"use client"

import { useEffect, useState } from 'react'

type CompareData = {
  today: string
  myHotelName: string
  myAvg: number | null
  competitors: Array<{ name: string; avg: number }>
  competitorsAvg: number | null
  competitorsCount: number
  position: number | null
}

export default function HotelsComparisonCard() {
  const [data, setData] = useState<CompareData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/compare/hotels', { method: 'POST' })
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
  }, [])

  const hasCompetitors = (data?.competitorsCount || 0) > 0

  return (
    <div className="bg-white rounded-[25px] p-6 shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Hotels Comparison</h3>
      {loading && <div className="text-sm text-gray-500">Loading…</div>}
      {error && <div className="text-sm text-red-600">{error}</div>}

      {!loading && data && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4 text-base font-medium text-gray-600">
            <div className="pl-8">Hotels</div>
            <div className="text-center">Fee</div>
            <div className="text-center">Position</div>
          </div>

          {data.competitors.slice(0, 3).map((c, idx) => (
            <div key={c.name + idx} className="grid grid-cols-3 gap-4 items-center py-3">
              <div className="flex flex-col space-y-1 pl-8">
                <span className="text-base">{c.name}</span>
              </div>
              <div className="text-base text-center">${Math.round(c.avg)}</div>
              <div className="text-base text-center text-gray-600">-</div>
            </div>
          ))}

          <div className="flex rounded-2xl overflow-hidden shadow-lg">
            <div className="flex-1 bg-white border-2 border-red-600 rounded-l-2xl px-4 py-3 flex items-center relative z-10">
              <div className="flex flex-col space-y-1 flex-1 pl-8">
                <span className="text-base font-bold text-gray-900">{data.myHotelName}</span>
              </div>
              <div className="text-base font-bold text-red-600 text-center flex-1">${data.myAvg != null ? Math.round(data.myAvg) : '-'}</div>
            </div>
            <div className="w-1/3 bg-red-600 rounded-r-2xl flex items-center justify-center px-4 py-3 relative -ml-2">
              <span className="text-lg font-bold text-white">{data.position ?? '-'}</span>
            </div>
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


