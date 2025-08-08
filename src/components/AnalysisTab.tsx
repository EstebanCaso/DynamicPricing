'use client'

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  Brush,
  ReferenceArea,
  ReferenceDot,
} from 'recharts'

type HistoricalPoint = {
  day: string
  price: number
}

type DemandPoint = {
  day: string
  requests: number
}

type RevenuePoint = {
  hotel: string
  revenue: number
}

type GapPoint = {
  day: string
  ours: number
  marketAvg: number
}

const historicalPrices: HistoricalPoint[] = (() => {
  const today = new Date('2024-08-10')
  const out: HistoricalPoint[] = []
  for (let i = 29; i >= 0; i -= 1) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const label = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d)
    // Fake but smooth data
    const base = 100 + Math.sin((i / 30) * Math.PI * 2) * 15
    const noise = (Math.random() - 0.5) * 10
    out.push({ day: label, price: Math.max(60, Math.round(base + noise)) })
  }
  return out
})()

const computeDemand = (price: number) => {
  const base = 1400 - Math.max(0, price - 80) * 6
  const noise = (Math.random() - 0.5) * 60
  return Math.max(400, Math.round(base + noise))
}

const revenuePerformance: RevenuePoint[] = [
  { hotel: 'Hotel A', revenue: 1100 },
  { hotel: 'Ours', revenue: 1150 },
  { hotel: 'Hotel B', revenue: 1080 },
]

const gapSeries: GapPoint[] = [
  { day: 'M', ours: 180, marketAvg: 190 },
  { day: 'T', ours: 186, marketAvg: 200 },
  { day: 'W', ours: 178, marketAvg: 188 },
  { day: 'T', ours: 195, marketAvg: 210 },
  { day: 'F', ours: 200, marketAvg: 215 },
  { day: 'S', ours: 194, marketAvg: 208 },
  { day: 'S', ours: 185, marketAvg: 198 },
]

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function AnalysisTab() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currency = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })

  const numberFmt = new Intl.NumberFormat('en-US')

  const [showOurs, setShowOurs] = useState(true)
  const [showMarket, setShowMarket] = useState(true)
  const [range, setRange] = useState<7 | 30 | 90>(30)
  const [targetMin, setTargetMin] = useState<number>(() => Number(searchParams.get('tmn')) || 95)
  const [targetMax, setTargetMax] = useState<number>(() => Number(searchParams.get('tmx')) || 115)
  const [events, setEvents] = useState<string[]>(() => {
    const raw = searchParams.get('ev')
    if (!raw) return ['Aug 7', 'Aug 9']
    return raw.split(',').map((s) => decodeURIComponent(s.trim())).filter(Boolean)
  })

  const rangedData = useMemo(() => {
    const data = historicalPrices
    if (range >= data.length) return data
    return data.slice(data.length - range)
  }, [range])

  const [brush, setBrush] = useState<{ start: number; end: number } | null>(null)

  useEffect(() => {
    setBrush({ start: 0, end: Math.max(0, rangedData.length - 1) })
  }, [rangedData.length])

  const visibleData = useMemo(() => {
    if (!brush) return rangedData
    const s = Math.max(0, Math.min(brush.start, rangedData.length - 1))
    const e = Math.max(s, Math.min(brush.end, rangedData.length - 1))
    return rangedData.slice(s, e + 1)
  }, [rangedData, brush])

  const averageHistorical = useMemo(() => {
    const total = visibleData.reduce((acc, p) => acc + p.price, 0)
    return total / Math.max(1, visibleData.length)
  }, [visibleData])

  const minVisible = useMemo(() => visibleData.reduce((m, p) => Math.min(m, p.price), Number.POSITIVE_INFINITY), [visibleData])
  const maxVisible = useMemo(() => visibleData.reduce((m, p) => Math.max(m, p.price), 0), [visibleData])

  const last = visibleData[visibleData.length - 1]?.price ?? 0
  const prev = visibleData[visibleData.length - 2]?.price ?? last
  const deltaPct = prev ? ((last - prev) / prev) * 100 : 0

  const demandVisible: DemandPoint[] = useMemo(
    () => visibleData.map((p) => ({ day: p.day, requests: computeDemand(p.price) })),
    [visibleData]
  )

  const dayIndexByLabel = useMemo(() => {
    const map: Record<string, number> = {}
    visibleData.forEach((p, i) => (map[p.day] = i))
    return map
  }, [visibleData])

  // persist target range and events in URL
  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('tmn', String(Math.round(targetMin)))
    url.searchParams.set('tmx', String(Math.round(targetMax)))
    url.searchParams.set('ev', events.map(encodeURIComponent).join(','))
    window.history.replaceState({}, '', url.toString())
  }, [targetMin, targetMax, events])

  // Mini sparkline data
  const sparkData = useMemo(() => visibleData.slice(-14), [visibleData])

  const PriceTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const current = payload[0].value as number
    const idx = dayIndexByLabel[label]
    const prev = idx > 0 ? visibleData[idx - 1].price : undefined
    const delta = prev !== undefined ? current - prev : 0
    const deltaColor = delta > 0 ? '#ef4444' : delta < 0 ? '#10b981' : '#6b7280'
    const deltaSign = delta > 0 ? '+' : ''
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
        <div className="font-medium text-gray-900">{label}</div>
        <div className="text-gray-700">Price: {currency.format(current)}</div>
        {prev !== undefined && (
          <div className="text-gray-600">
            Prev: {currency.format(prev)}
            <span className="ml-2" style={{ color: deltaColor }}>
              {deltaSign}
              {currency.format(Math.abs(delta))}
            </span>
          </div>
        )}
      </div>
    )
  }

  const DemandTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null
    const value = payload[0].value as number
    const mean = demandVisible.reduce((a, b) => a + b.requests, 0) / Math.max(1, demandVisible.length)
    const delta = value - mean
    const color = delta >= 0 ? '#10b981' : '#ef4444'
    const sign = delta > 0 ? '+' : ''
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
        <div className="text-gray-700">Requests: {numberFmt.format(value)}</div>
        <div className="text-gray-600">
          vs avg: {numberFmt.format(Math.round(mean))}
          <span className="ml-2" style={{ color }}>
            {sign}
            {numberFmt.format(Math.abs(Math.round(delta)))}
          </span>
        </div>
      </div>
    )
  }

  const RevenueTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const value = payload[0].value as number
    const others = revenuePerformance.filter((r) => r.hotel !== label)
    const avgOthers = others.reduce((a, b) => a + b.revenue, 0) / Math.max(1, others.length)
    const delta = value - avgOthers
    const color = delta >= 0 ? '#10b981' : '#ef4444'
    const sign = delta > 0 ? '+' : ''
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
        <div className="font-medium text-gray-900">{label}</div>
        <div className="text-gray-700">Revenue: {currency.format(value)}</div>
        <div className="text-gray-600">
          vs peers: {currency.format(Math.round(avgOthers))}
          <span className="ml-2" style={{ color }}>
            {sign}
            {currency.format(Math.abs(Math.round(delta)))}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative space-y-4 md:space-y-6">
      {/* Decorative glows (toned down) */}
      <div className="pointer-events-none absolute -top-24 -left-24 h-80 w-80 rounded-full bg-gradient-to-tr from-rose-400/15 via-amber-300/15 to-emerald-300/15 blur-2xl"></div>
      <div className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-gradient-to-bl from-emerald-300/15 via-amber-300/15 to-rose-400/15 blur-2xl"></div>
      {/* Insight bar - compact, premium */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        {/* Average Revenue (Neutral → Amber) */}
        <div className="relative group">
          <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-rose-400/15 via-amber-300/15 to-emerald-300/15 blur-sm opacity-30 group-hover:opacity-50 transition"></div>
          <div className="relative rounded-2xl p-3 md:p-4 shadow-sm bg-white/80 border border-white/60 backdrop-blur">
          <div className="flex items-center gap-3">
            <svg className="text-amber-600" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22M4 9l8-8 8 8"/></svg>
            <div className="flex-1">
              <p className="text-xs font-medium tracking-wide text-gray-600">Average Revenue</p>
              <p className="text-xl md:text-2xl font-semibold text-gray-900">$1,027</p>
            </div>
            <div className="w-24 h-8">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                  <XAxis dataKey="day" hide />
                  <YAxis hide domain={["dataMin", "dataMax"]} />
                  <Line type="monotone" dataKey="price" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          </div>
        </div>
        {/* Rate Position (Positive → Green) */}
        <div className="relative group">
          <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-rose-400/15 via-amber-300/15 to-emerald-300/15 blur-sm opacity-30 group-hover:opacity-50 transition"></div>
          <div className="relative rounded-2xl p-3 md:p-4 shadow-sm bg-white/80 border border-white/60 backdrop-blur">
          <div className="flex items-center gap-3">
            <svg className="text-emerald-600" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17l9-9M7 7h9v9"/></svg>
            <div className="flex items-baseline gap-2 flex-1">
              <div>
                <p className="text-xs font-medium tracking-wide text-gray-600">Rate Position</p>
                <p className="text-xl md:text-2xl font-semibold text-emerald-600">2°</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">Up</span>
            </div>
            <div className="w-24 h-8">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkData.map((d, i) => ({ day: d.day, v: 3 + Math.sin(i / 4) }))} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                  <XAxis dataKey="day" hide />
                  <YAxis hide domain={[0, 'dataMax']} />
                  <Line type="monotone" dataKey="v" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          </div>
        </div>
        {/* Average Gap (Negative → Red) */}
        <div className="relative group">
          <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-rose-400/15 via-amber-300/15 to-emerald-300/15 blur-sm opacity-30 group-hover:opacity-50 transition"></div>
          <div className="relative rounded-2xl p-3 md:p-4 shadow-sm bg-white/80 border border-white/60 backdrop-blur">
          <div className="flex items-center gap-3">
            <svg className="text-rose-600" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M12 3v18"/></svg>
            <div className="flex-1">
              <p className="text-xs font-medium tracking-wide text-gray-600">Average Gap</p>
              <p className="text-xl md:text-2xl font-semibold text-rose-600">$15</p>
            </div>
            <div className="w-24 h-8">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkData.map((d) => ({ day: d.day, v: Math.abs(d.price - averageHistorical) }))} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                  <XAxis dataKey="day" hide />
                  <YAxis hide domain={[0, 'dataMax']} />
                  <Line type="monotone" dataKey="v" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Historical Prices */}
        <div className="relative group">
          <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-rose-400/10 via-amber-300/10 to-emerald-300/10 blur-sm opacity-25 group-hover:opacity-40 transition"></div>
          <div className="relative bg-white/80 rounded-2xl p-4 md:p-5 shadow-sm border border-white/60 backdrop-blur">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Historical Prices</h3>
            <div className="inline-flex rounded-xl border border-gray-200 bg-white p-0.5 text-sm">
              {[7, 30, 90].map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r as 7 | 30 | 90)}
                  className={`px-2 py-1 rounded-lg transition-colors ${range === r ? 'bg-gray-900 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
                >
                  {r}d
                </button>
              ))}
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={visibleData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.6} />
                <XAxis dataKey="day" stroke="#6b7280" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis stroke="#6b7280" tickLine={false} axisLine={false} tickMargin={8} />
                <Tooltip content={<PriceTooltip />} />
                {/* Target band */}
                <ReferenceArea y1={targetMin} y2={targetMax} fill="#10b981" fillOpacity={0.08} stroke="#10b981" strokeOpacity={0.15} />
                <ReferenceLine
                  y={averageHistorical}
                  stroke="#94a3b8"
                  strokeDasharray="6 6"
                  label={{ value: `Avg ${currency.format(averageHistorical)}`, position: 'right', fill: '#64748b' }}
                />
                {/* Example event markers */}
                {events.filter((d) => visibleData.some((p) => p.day === d)).map((d) => (
                  <ReferenceLine key={d} x={d} stroke="#f59e0b" strokeDasharray="2 2" label={{ position: 'top', value: 'Event', fill: '#f59e0b' }} />
                ))}
                <Area type="monotone" dataKey="price" stroke="#ef4444" fill="url(#priceArea)" strokeWidth={3} />
                <Brush
                  dataKey="day"
                  height={16}
                  stroke="#9ca3af"
                  travellerWidth={8}
                  startIndex={brush ? brush.start : 0}
                  endIndex={brush ? brush.end : Math.max(0, rangedData.length - 1)}
                  onChange={(e: any) => {
                    if (!e) return
                    const start = typeof e.startIndex === 'number' ? e.startIndex : 0
                    const end = typeof e.endIndex === 'number' ? e.endIndex : Math.max(0, rangedData.length - 1)
                    setBrush({ start, end })
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          </div>
        </div>

        {/* Demand */}
        <div className="relative group">
          <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-rose-400/10 via-amber-300/10 to-emerald-300/10 blur-sm opacity-25 group-hover:opacity-40 transition"></div>
          <div className="relative bg-white/80 rounded-2xl p-4 md:p-5 shadow-sm border border-white/60 backdrop-blur">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">Demand</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">Avg {numberFmt.format(Math.round(demandVisible.reduce((a, b) => a + b.requests, 0) / Math.max(1, demandVisible.length)))}</span>
              <span className="text-xs rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">Min {numberFmt.format(Math.min(...demandVisible.map(d => d.requests)))}</span>
              <span className="text-xs rounded-full bg-gray-100 px-2 py-0.5 text-gray-700">Max {numberFmt.format(Math.max(...demandVisible.map(d => d.requests)))}</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={demandVisible} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="demandBar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor="#94a3b8" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#cbd5e1" stopOpacity={0.7} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.6} />
                <XAxis dataKey="day" stroke="#6b7280" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis stroke="#6b7280" tickLine={false} axisLine={false} tickMargin={8} />
                <Tooltip content={<DemandTooltip />} />
                <Bar dataKey="requests" fill="url(#demandBar)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          </div>
        </div>

        {/* Revenue Performance */}
        <div className="relative group">
          <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-rose-400/10 via-amber-300/10 to-emerald-300/10 blur-sm opacity-25 group-hover:opacity-40 transition"></div>
          <div className="relative bg-white/80 rounded-2xl p-4 md:p-5 shadow-sm border border-white/60 backdrop-blur">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Revenue Performance</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenuePerformance} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGray" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor="#e5e7eb" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#cbd5e1" stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient id="revRed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor="#ef4444" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#fca5a5" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="hotel" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip content={<RevenueTooltip />} />
                <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                  {revenuePerformance.map((d) => (
                    <Cell key={d.hotel} fill={d.hotel === 'Ours' ? 'url(#revRed)' : 'url(#revGray)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          </div>
        </div>

        {/* Competitive Gap Analysis */}
        <div className="relative group">
          <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-rose-400/10 via-amber-300/10 to-emerald-300/10 blur-sm opacity-25 group-hover:opacity-40 transition"></div>
          <div className="relative bg-white/80 rounded-2xl p-4 md:p-5 shadow-sm border border-white/60 backdrop-blur">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Competitive Gap Analysis</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={gapSeries} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorOurs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor="#ef4444" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip wrapperClassName="!rounded-lg !border !border-gray-200 !bg-white" formatter={(v: number, name: string) => [currency.format(v), name]} />
                <Legend onClick={(e: any) => {
                  if (e.dataKey === 'ours') setShowOurs((s) => !s)
                  if (e.dataKey === 'marketAvg') setShowMarket((s) => !s)
                }} />
                {showMarket && <Line type="monotone" dataKey="marketAvg" name="marketAvg" stroke="#94a3b8" strokeDasharray="6 6" strokeWidth={2} dot={false} />}
                {showOurs && <Area type="monotone" dataKey="ours" name="ours" stroke="#ef4444" fill="url(#colorOurs)" strokeWidth={3} />}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          </div>
        </div>
      </div>
    </div>
  )
}

