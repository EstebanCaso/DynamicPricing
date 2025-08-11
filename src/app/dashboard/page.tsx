"use client"

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import HotelsComparisonCard from '@/components/HotelsComparisonCard'
import AnalysisTab from '@/components/AnalysisTab'
import CalendarTab from '@/components/CalendarTab'

type OverviewStats = {
  totalEvents: number
  growthPercent: number
  eventsToday: number
}

type AnalyticsRow = { fecha?: string | null }

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('summary')
  const searchParams = useSearchParams()
  const [stats, setStats] = useState<OverviewStats | null>(null)
  const [eventRows, setEventRows] = useState<AnalyticsRow[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        const [statsRes, analyticsRes] = await Promise.all([
          fetch('/api/stats/overview', { cache: 'no-store' }),
          fetch('/api/analytics/view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ metric: 'price-trends' }),
          }),
        ])
        const statsJson = await statsRes.json()
        if (statsJson?.success) setStats(statsJson.data)
        const analyticsJson = await analyticsRes.json()
        const rows: AnalyticsRow[] = Array.isArray(analyticsJson?.data?.rows)
          ? analyticsJson.data.rows
          : []
        setEventRows(rows)
      } catch {
        setStats(null)
        setEventRows([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  // Sync active tab with query param for deep-links like ?tab=calendar&date=YYYY-MM-DD
  useEffect(() => {
    const fromQuery = searchParams.get('tab')
    if (fromQuery && ['summary', 'calendar', 'competence', 'analysis'].includes(fromQuery)) {
      setActiveTab(fromQuery)
    }
  }, [searchParams])

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-based
  const monthName = now.toLocaleString('en-US', { month: 'long' })
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const eventsByDay = useMemo(() => {
    const map = new Map<number, number>()
    for (const row of eventRows) {
      if (!row?.fecha) continue
      const d = new Date(row.fecha)
      if (d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate()
        map.set(day, (map.get(day) || 0) + 1)
      }
    }
    return map
  }, [eventRows, year, month])

  // Impact KPI removed from summary

  const tabs = [
    { id: 'summary', name: 'Summary' },
    { id: 'calendar', name: 'Calendar' },
    { id: 'competence', name: 'Competence' },
    { id: 'analysis', name: 'Analysis' },
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#d9d9d9' }}>
      {/* Top Navigation Bar - Floating */}
      <div className="container mx-auto px-6 py-4">
        <div className="bg-white rounded-[25px] shadow-lg border border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center">
              <div className="w-8 h-8">
                <Image
                  src="/assets/logos/logo.png"
                  alt="Arkus Dynamic Pricing Logo"
                  width={32}
                  height={32}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>

            {/* Navigation Tabs - Centered */}
            <div className="flex space-x-9">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </div>

            {/* User Icon */}
            <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        {activeTab === 'analysis' ? (
          <AnalysisTab />
        ) : activeTab === 'calendar' ? (
          <CalendarTab />
        ) : activeTab === 'competence' ? (
          <div className="bg-white rounded-[25px] p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Competence Analysis</h2>
            <div className="text-gray-600">
              Competitor analysis and market positioning tools will be implemented here.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-8">
            {/* Left Column - KPIs and Calendar */}
            <div className="col-span-1 space-y-8">
            {/* KPI Cards (stacked) */}
            <div className="grid grid-cols-1 gap-6">
              {/* Performance Index */}
              <div className="bg-white rounded-[25px] p-6 border-l-4 border-orange-500 shadow-sm">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Performance index</h3>
                <p className="text-3xl font-bold text-orange-500">
                  {loading ? '…' : stats?.growthPercent != null ? `${stats.growthPercent}%` : '-'}
                </p>
              </div>

              {/* Average Rate */}
              <div className="bg-white rounded-[25px] p-6 border-l-4 border-red-500 shadow-sm">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Average rate</h3>
                <p className="text-3xl font-bold text-gray-900">-</p>
              </div>
            </div>

            {/* Monthly Calendar (clickable) */}
            <div className="bg-white rounded-[25px] p-6 shadow-sm h-[419px] flex flex-col">
              <h3 className="text-2xl font-semibold text-gray-900 mb-4">{monthName}</h3>
              <div className="grid grid-cols-7 gap-1">
                {['S','M','T','W','T','F','S'].map((d) => (
                  <div key={d} className="text-center text-sm font-medium text-gray-500 py-2">{d}</div>
                ))}

                {Array.from({ length: new Date(year, month, 1).getDay() }).map((_, i) => (
                  <div key={`blank-${i}`} className="w-10 h-10" />
                ))}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1
                  const dateISO = new Date(year, month, day)
                  const iso = new Date(dateISO.getTime() - dateISO.getTimezoneOffset() * 60000)
                    .toISOString()
                    .slice(0, 10)
                  const count = eventsByDay.get(day) || 0
                  return (
                    <a
                      key={day}
                      href={`/dashboard?tab=calendar&date=${iso}`}
                      className="w-10 h-10 rounded flex items-center justify-center text-base relative border bg-gray-100 text-gray-900 border-transparent hover:ring-1 hover:ring-red-300"
                      aria-label={`Day ${day}`}
                    >
                      {day}
                      {count > 0 && (
                        <span
                          title={`${count} events`}
                          className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full"
                        />
                      )}
                    </a>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right Column - Hotels Comparison (real data) */}
          <div className="col-span-2">
            <HotelsComparisonCard />
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
