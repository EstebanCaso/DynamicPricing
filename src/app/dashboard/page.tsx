"use client"

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import AnalysisTab from '../../components/AnalysisTab'

type OverviewStats = {
  totalEvents: number
  growthPercent: number
  eventsToday: number
}

type AnalyticsRow = { fecha?: string | null }

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('summary')
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

  const impactLabel = useMemo(() => {
    const n = stats?.eventsToday ?? 0
    if (n > 10) return 'High'
    if (n > 3) return 'Medium'
    if (n > 0) return 'Low'
    return 'None'
  }, [stats])

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
          <div className="bg-white rounded-[25px] p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Calendar View</h2>
            <div className="text-gray-600">
              Calendar functionality with event tracking and price impact analysis will be implemented here.
            </div>
          </div>
        ) : activeTab === 'competence' ? (
          <div className="bg-white rounded-[25px] p-8 shadow-sm">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Competence Analysis</h2>
            <div className="text-gray-600">
              Competitor analysis and market positioning tools will be implemented here.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-8">
            {/* Left Column - KPIs and Calendar */}
            <div className="space-y-8">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 gap-6">
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

              {/* Impact of Events */}
              <div className="bg-white rounded-[25px] p-6 border-l-4 border-green-500 shadow-sm">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Impact of events</h3>
                <p className="text-3xl font-bold text-green-500">{loading ? '…' : impactLabel}</p>
              </div>

              {/* Price Position */}
              <div className="bg-white rounded-[25px] p-6 border-l-4 border-green-500 shadow-sm">
                <h3 className="text-sm font-medium text-gray-600 mb-2">Price position</h3>
                <p className="text-3xl font-bold text-green-500">-</p>
              </div>
            </div>

            {/* Dynamic Calendar */}
            <div className="bg-white rounded-[25px] p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">{monthName}</h3>
              <div className="grid grid-cols-7 gap-1">
                <div className="text-center text-sm font-medium text-gray-500 py-2">S</div>
                <div className="text-center text-sm font-medium text-gray-500 py-2">M</div>
                <div className="text-center text-sm font-medium text-gray-500 py-2">T</div>
                <div className="text-center text-sm font-medium text-gray-500 py-2">W</div>
                <div className="text-center text-sm font-medium text-gray-500 py-2">T</div>
                <div className="text-center text-sm font-medium text-gray-500 py-2">F</div>
                <div className="text-center text-sm font-medium text-gray-500 py-2">S</div>

                {Array.from({ length: daysInMonth }, (_, i) => {
                  const day = i + 1
                  const count = eventsByDay.get(day) || 0
                  return (
                    <div key={day} className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-sm relative">
                      {day}
                      {count > 0 && (
                        <div title={`${count} events`} className="absolute bottom-1 w-1 h-1 bg-red-500 rounded-full"></div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Right Column - Hotels Table (placeholder, no mock data) */}
          <div>
            <div className="bg-white rounded-[25px] p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Hotels Comparison</h3>
              <div className="text-gray-500 text-sm">Integration pending. No mock data displayed.</div>
            </div>
          </div>
        </div>
        )}
      </div>
    </div>
  )
}
