"use client"

import { useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import Image from 'next/image'
import HotelsComparisonCard from '@/components/HotelsComparisonCard'
import AnalysisTab from '@/components/AnalysisTab'
import CalendarTab from '@/components/CalendarTab'
import PriceRulesView from '@/components/PriceRulesView'
import CompetitorsTab from '@/components/CompetitorsTab'
import CompetitorProfile from '@/components/CompetitorProfile'

type OverviewStats = {
  totalEvents: number
  growthPercent: number
  eventsToday: number
}

type AnalyticsRow = { fecha?: string | null }
type EventItem = { fecha?: string | null }

function DashboardContent() {
  const [activeTab, setActiveTab] = useState('summary')
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [stats, setStats] = useState<OverviewStats | null>(null)
  const [eventRows, setEventRows] = useState<AnalyticsRow[]>([])
  const [events, setEvents] = useState<EventItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCompetitor, setSelectedCompetitor] = useState<any | null>(null);
  const [showCalendarMenu, setShowCalendarMenu] = useState<boolean>(false)
  const calendarMenuRef = useRef<HTMLDivElement | null>(null)

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

  // Load real events for the calendar dots
  useEffect(() => {
    const run = async () => {
      try {
        const now = new Date()
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1)
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0)
        const toIso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
        const res = await fetch(`/api/calendar/events?startDate=${toIso(startDate)}&endDate=${toIso(endDate)}`, { cache: 'no-store' })
        const json = await res.json()
        if (!json?.success) throw new Error(json?.error || 'Failed events')
        const incoming = Array.isArray(json?.events) ? json.events : json?.data?.events
        setEvents(Array.isArray(incoming) ? incoming : [])
      } catch {
        setEvents([])
      }
    }
    run()
  }, [])

  // Sync active tab with query param after initial load and on navigation
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab');
    const tabFromStorage = localStorage.getItem('activeDashboardTab');
    const targetTab = tabFromUrl || tabFromStorage;

    if (targetTab && ['summary', 'calendar', 'competitors', 'analysis'].includes(targetTab)) {
        setActiveTab(targetTab);
    }
  }, [searchParams]);

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId);
    const currentParams = new URLSearchParams(window.location.search);
    currentParams.set('tab', tabId);
    const newUrl = `${pathname}?${currentParams.toString()}`;
    window.history.pushState({ path: newUrl }, '', newUrl);
    localStorage.setItem('activeDashboardTab', tabId);
  };

  const handleCalendarViewChange = (view: 'calendar' | 'rules') => {
    setActiveTab('calendar')
    const currentParams = new URLSearchParams(window.location.search)
    currentParams.set('tab', 'calendar')
    currentParams.set('view', view)
    const newUrl = `${pathname}?${currentParams.toString()}`
    window.history.pushState({ path: newUrl }, '', newUrl)
    setShowCalendarMenu(false)
  }

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!showCalendarMenu) return
      const target = e.target as Node
      if (calendarMenuRef.current && !calendarMenuRef.current.contains(target)) {
        setShowCalendarMenu(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [showCalendarMenu])

  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-based
  const monthName = now.toLocaleString('en-US', { month: 'long' })
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)

  // Parse YYYY-MM-DD as a local Date (avoid UTC shift from new Date('YYYY-MM-DD'))
  function parseYMDToLocalDate(ymd?: string | null): Date | null {
    if (!ymd) return null
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
    if (!m) return null
    const y = Number(m[1])
    const mo = Number(m[2]) - 1
    const d = Number(m[3])
    return new Date(y, mo, d)
  }

  const eventsByDay = useMemo(() => {
    const map = new Map<number, number>()
    for (const ev of events) {
      const iso = (ev?.fecha || '').slice(0, 10)
      const d = parseYMDToLocalDate(iso)
      if (d && Number.isFinite(d.getTime()) && d.getFullYear() === year && d.getMonth() === month) {
        const day = d.getDate()
        map.set(day, (map.get(day) || 0) + 1)
      }
    }
    return map
  }, [events, year, month])

  // Impact KPI removed from summary

  const tabs = [
    { id: 'summary', name: 'Summary' },
    { id: 'calendar', name: 'Calendar' },
    { id: 'competitors', name: 'Competitors' },
    { id: 'analysis', name: 'Analytics' },
  ]

  return (
    <div className="min-h-screen relative">
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
      <div className="relative z-[10000]">
        {/* Top Navigation Bar - Glassmorphism */}
        <div className="container mx-auto px-6 py-4 relative z-[10000]">
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
                {tabs.map((tab) => {
                  if (tab.id !== 'calendar') {
                    return (
                      <button
                        key={tab.id}
                        onClick={() => handleTabClick(tab.id)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                          activeTab === tab.id
                            ? 'bg-arkus-600 text-white shadow-lg'
                            : 'bg-glass-200 text-gray-700 hover:bg-glass-300 hover:shadow-md'
                        }`}
                      >
                        {tab.name}
                      </button>
                    )
                  }
                  const calendarActive = activeTab === 'calendar'
                  return (
                    <div key={tab.id} ref={calendarMenuRef} className="relative">
                      <button
                        aria-expanded={showCalendarMenu}
                        onClick={() => setShowCalendarMenu((v) => !v)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                          calendarActive ? 'bg-arkus-600 text-white shadow-lg' : 'bg-glass-200 text-gray-700 hover:bg-glass-300 hover:shadow-md'
                        }`}
                      >
                        {tab.name}
                      </button>
                      {showCalendarMenu && (
                        <div className="absolute left-0 top-full mt-2 w-56 rounded-xl border border-black/10 bg-white shadow-lg z-[9999]">
                          <button className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded-t-xl" onClick={() => handleCalendarViewChange('calendar')}>Calendario</button>
                          <button className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded-b-xl" onClick={() => handleCalendarViewChange('rules')}>Reglas de Precios</button>
                        </div>
                      )}
                    </div>
                  )
                })}
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
            (searchParams.get('view') === 'rules' ? <PriceRulesView /> : <CalendarTab />)
          ) : activeTab === 'competitors' ? (
            <CompetitorsTab onCompetitorSelect={setSelectedCompetitor} />
          ) : (
            <div className="grid grid-cols-3 gap-8">
              {/* Left Column - KPIs and Calendar */}
              <div className="col-span-1 space-y-8">
                {/* KPI Cards (stacked) */}
                <div className="grid grid-cols-1 gap-6">
                  {/* Performance Index */}
                  {/* <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300">
                    <div className="border-l-4 border-orange-500 pl-4">
                      <h3 className="text-sm font-medium text-gray-600 mb-2">Performance index</h3>
                      <p className="text-3xl font-bold text-orange-500">
                        {loading ? '…' : stats?.growthPercent != null ? `${stats.growthPercent}%` : '-'}
                      </p>
                    </div>
                  </div> */}

                  {/* Average Rate */}
                  {/* <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300">
                    <div className="border-l-4 border-arkus-500 pl-4">
                      <h3 className="text-sm font-medium text-gray-600 mb-2">Average rate</h3>
                      <p className="text-3xl font-bold text-gray-900">-</p>
                    </div>
                  </div> */}
                </div>

                {/* Monthly Calendar (clickable) */}
                <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl p-6 shadow-xl hover:shadow-2xl transition-all duration-300 h-[419px] flex flex-col">
                  <h3 className="text-2xl font-semibold text-gray-900 mb-4">{monthName}</h3>
                  <div className="grid grid-cols-7 gap-1">
                    {['S','M','T','W','T','F','S'].map((d, i) => (
                      <div key={`${d}-${i}`} className="text-center text-sm font-medium text-gray-500 py-2">{d}</div>
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
                      const isToday = iso === todayIso
                      return (
                        <a
                          key={day}
                          href={`/dashboard?tab=calendar&date=${iso}`}
                          className={`w-10 h-10 rounded flex items-center justify-center text-base relative border transition-all duration-200 ${
                            isToday
                              ? 'bg-white/60 text-gray-900 border-white/70 hover:bg-white'
                              : 'bg-glass-200 text-gray-900 border-glass-300 hover:bg-glass-300 hover:ring-1 hover:ring-red-300'
                          }`}
                          aria-label={`Day ${day}`}
                        >
                          {day}
                          {count > 0 && (
                            <span
                              title={`${count} events`}
                              className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-600 rounded-full"
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
      
      {selectedCompetitor && (
        <CompetitorProfile 
          competitor={selectedCompetitor} 
          onClose={() => setSelectedCompetitor(null)} 
        />
      )}
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
