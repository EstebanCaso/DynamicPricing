"use client"

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import HotelsComparisonCard from '@/components/HotelsComparisonCard'
import AnalysisTab from '@/components/AnalysisTab'
import CalendarTab from '@/components/CalendarTab'
import CompetitorsTab from '@/components/CompetitorsTab'

type OverviewStats = {
  totalEvents: number
  growthPercent: number
  eventsToday: number
}

type AnalyticsRow = { fecha?: string | null }

function DashboardContent() {
  const [activeTab, setActiveTab] = useState('summary')
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
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
    // Try to get tab from search params first
    const fromQuery = searchParams.get('tab')
    
    // Fallback: parse from URL if searchParams doesn't work
    let tabFromUrl = fromQuery
    if (!tabFromUrl && typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search)
      tabFromUrl = urlParams.get('tab')
    }
    
    if (tabFromUrl && ['summary', 'calendar', 'competitors', 'analysis'].includes(tabFromUrl)) {
      setActiveTab(tabFromUrl)
    }
  }, [searchParams, pathname])

  // Additional effect to handle URL changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleUrlChange = () => {
        const urlParams = new URLSearchParams(window.location.search)
        const tab = urlParams.get('tab')
        if (tab && ['summary', 'calendar', 'competitors', 'analysis'].includes(tab)) {
          setActiveTab(tab)
        }
      }
      
      // Check on mount with a small delay to ensure client-side execution
      setTimeout(handleUrlChange, 100)
      
      // Listen for popstate events (browser back/forward)
      window.addEventListener('popstate', handleUrlChange)
      
      return () => window.removeEventListener('popstate', handleUrlChange)
    }
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

  // Impact KPI removed from summary

  const tabs = [
    { id: 'summary', name: 'Summary' },
    { id: 'calendar', name: 'Calendar' },
    { id: 'competitors', name: 'Competitors' },
    { id: 'analysis', name: 'Analytics' },
  ]

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Glassmorphism Background with Arkus Red Gradient - Full Page */}
      <div className="absolute inset-0 bg-gradient-to-br from-arkus-50 via-white to-arkus-100">
        {/* Animated background elements */}
        <div className="absolute top-20 left-20 w-72 h-72 bg-arkus-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-arkus-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float" style={{animationDelay: '2s'}}></div>
        <div className="absolute bottom-20 left-1/2 w-80 h-80 bg-arkus-400 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float" style={{animationDelay: '4s'}}></div>
        <div className="absolute top-1/2 left-10 w-64 h-64 bg-arkus-100 rounded-full mix-blend-multiply filter blur-xl opacity-15 animate-float" style={{animationDelay: '1s'}}></div>
        <div className="absolute bottom-1/3 right-10 w-56 h-56 bg-arkus-300 rounded-full mix-blend-multiply filter blur-xl opacity-15 animate-float" style={{animationDelay: '3s'}}></div>
      </div>
      
      {/* Main Content with Glassmorphism */}
      <div className="relative z-10">
        {/* Top Navigation Bar - Glassmorphism */}
        <div className="container mx-auto px-6 py-4">
          <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-[25px] shadow-xl px-6 py-4 hover:shadow-2xl transition-all duration-300">
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
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'bg-arkus-600 text-white shadow-lg'
                        : 'bg-glass-200 text-gray-700 hover:bg-glass-300 hover:shadow-md'
                    }`}
                  >
                    {tab.name}
                  </button>
                ))}
              </div>

              {/* User Icon */}
              <div className="w-8 h-8 bg-glass-300 rounded-full border border-glass-400"></div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-6 py-8">
          {activeTab === 'analysis' ? (
            <AnalysisTab />
          ) : activeTab === 'calendar' ? (
            <CalendarTab />
          ) : activeTab === 'competitors' ? (
            <CompetitorsTab />
          ) : (
            <div className="grid grid-cols-3 gap-8">
              {/* Left Column - KPIs and Calendar */}
              <div className="col-span-1 space-y-8">
                {/* KPI Cards (stacked) */}
                <div className="grid grid-cols-1 gap-6">
                  {/* Performance Index */}
                  <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300">
                    <div className="border-l-4 border-orange-500 pl-4">
                      <h3 className="text-sm font-medium text-gray-600 mb-2">Performance index</h3>
                      <p className="text-3xl font-bold text-orange-500">
                        {loading ? '…' : stats?.growthPercent != null ? `${stats.growthPercent}%` : '-'}
                      </p>
                    </div>
                  </div>

                  {/* Average Rate */}
                  <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300">
                    <div className="border-l-4 border-arkus-500 pl-4">
                      <h3 className="text-sm font-medium text-gray-600 mb-2">Average rate</h3>
                      <p className="text-3xl font-bold text-gray-900">-</p>
                    </div>
                  </div>
                </div>

                {/* Monthly Calendar (clickable) */}
                <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 h-[419px] flex flex-col">
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
                          className="w-10 h-10 rounded flex items-center justify-center text-base relative border bg-glass-200 text-gray-900 border-glass-300 hover:ring-2 hover:ring-arkus-300 hover:bg-glass-300 transition-all duration-200"
                          aria-label={`Day ${day}`}
                        >
                          {day}
                          {count > 0 && (
                            <span
                              title={`${count} events`}
                              className="absolute top-0.5 right-0.5 w-2 h-2 bg-arkus-500 rounded-full"
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
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-arkus-50 via-white to-arkus-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-arkus-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
