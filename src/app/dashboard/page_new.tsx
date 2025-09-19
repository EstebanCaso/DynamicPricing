"use client"

import { useEffect, useMemo, useRef, useState, Suspense } from 'react'
import { useSearchParams, usePathname } from 'next/navigation'
import Image from 'next/image'
import HotelsComparisonCard from '@/components/HotelsComparisonCard'
import AnalysisTab from '@/components/AnalysisTab'
import CalendarTab from '@/components/CalendarTab'
import PriceRulesView from '@/components/PriceRulesView'
import CompetitorsTab from '@/components/CompetitorsTab'
import CompetitorProfile from '@/components/CompetitorProfile'

type EventItem = { fecha?: string | null }
type AnalyticsRow = Record<string, unknown>

function DashboardContent() {
  const [activeTab, setActiveTab] = useState('summary')
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<Record<string, unknown> | null>(null)
  const [eventRows, setEventRows] = useState<AnalyticsRow[]>([])
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const [events, setEvents] = useState<EventItem[]>([])
  const [selectedCompetitor, setSelectedCompetitor] = useState<Record<string, unknown> | null>(null);
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

        if (statsRes.ok) {
          const statsData = await statsRes.json()
          if (statsData.success) {
            setStats(statsData.data)
          }
        }

        if (analyticsRes.ok) {
          const analyticsData = await analyticsRes.json()
          if (analyticsData.success && Array.isArray(analyticsData.data)) {
            setEventRows(analyticsData.data)
          }
        }

        const eventsRes = await fetch('/api/calendar/events', { cache: 'no-store' })
        if (eventsRes.ok) {
          const eventsData = await eventsRes.json()
          if (eventsData.success && Array.isArray(eventsData.data)) {
            setEvents(eventsData.data)
          }
        }
      } catch (error) {
        console.error('Error loading dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    const tab = searchParams.get('tab')
    if (tab && ['summary', 'calendar', 'competitors', 'analysis'].includes(tab)) {
      setActiveTab(tab)
    }
  }, [searchParams])

  const handleTabClick = (tabId: string) => {
    setActiveTab(tabId)
    const currentParams = new URLSearchParams(searchParams.toString())
    currentParams.set('tab', tabId)
    if (tabId !== 'calendar') {
      currentParams.delete('view')
    }
    const newUrl = `${pathname}?${currentParams.toString()}`
    window.history.pushState({ path: newUrl }, '', newUrl)
  }

  const handleCalendarViewChange = (view: string) => {
    setActiveTab('calendar')
    const currentParams = new URLSearchParams(searchParams.toString())
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
    { id: 'analysis', name: 'Analytics' }
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
      
      {/* Main Content */}
      <div className="relative z-10">
        {/* Header */}
        <div className="backdrop-blur-xl bg-glass-100 border-b border-glass-200 shadow-xl">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center">
                <Image 
                  src="/assets/logos/logo.png" 
                  alt="Dynamic Pricing Logo" 
                  width={40} 
                  height={40} 
                  className="rounded-lg shadow-lg"
                />
                <span className="ml-3 text-xl font-bold text-gray-900">Dynamic Pricing</span>
              </div>
              <div className="text-sm text-gray-600">{new Date().toLocaleDateString()}</div>
            </div>
          </div>
        </div>
        
        {/* Navigation */}
        <div className="backdrop-blur-xl bg-glass-100 border-b border-glass-200 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <nav className="flex space-x-1 py-4">
              {tabs.map((tab) => {
                if (tab.id === 'calendar') {
                  return (
                    <div key={tab.id} ref={calendarMenuRef} className="relative">
                      <button
                        aria-expanded={showCalendarMenu}
                        onClick={() => setShowCalendarMenu((v) => !v)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                          activeTab === tab.id
                            ? 'bg-arkus-600 text-white shadow-lg'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                        }`}
                      >
                        {tab.name}
                        <svg className={`ml-2 h-4 w-4 inline transition-transform ${showCalendarMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {showCalendarMenu && (
                        <div className="absolute left-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-xl z-50">
                          <button 
                            onClick={() => handleCalendarViewChange('calendar')}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-t-lg"
                          >
                            📅 Calendar View
                          </button>
                          <button 
                            onClick={() => handleCalendarViewChange('rules')}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-b-lg"
                          >
                            ⚙️ Pricing Rules
                          </button>
                        </div>
                      )}
                    </div>
                  )
                } else {
                  return (
                    <button
                      key={tab.id}
                      onClick={() => handleTabClick(tab.id)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        activeTab === tab.id
                          ? 'bg-arkus-600 text-white shadow-lg'
                          : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
                      }`}
                    >
                      {tab.name}
                    </button>
                  )
                }
              })}
            </nav>
          </div>
        </div>
        
        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'analysis' ? (
            <AnalysisTab />
          ) : activeTab === 'calendar' ? (
            (searchParams.get('view') === 'rules' ? <PriceRulesView /> : <CalendarTab />)
          ) : activeTab === 'competitors' ? (
            <CompetitorsTab onCompetitorSelect={setSelectedCompetitor} />
          ) : (
            <div className="max-w-7xl mx-auto space-y-8">
              {/* Header Section */}
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Executive Summary</h1>
                  <p className="text-gray-600 mt-2">Real-time performance metrics and market intelligence</p>
                </div>
                <div className="text-sm text-gray-500">
                  Last updated: {new Date().toLocaleDateString('en-US', { 
                    month: 'short', 
                    day: 'numeric', 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>

              {/* KPI Grid */}
              <div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    
                    {/* Revenue */}
                    <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                      </div>
                      <div className="text-2xl font-bold text-gray-900 mb-1">$125,450</div>
                      <div className="text-xs text-green-600 font-medium">
                        <span className="inline-flex items-center">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                          +12.3% MoM
                        </span>
                      </div>
                    </div>

                    {/* Market Position */}
                    <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Market Rank</span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                      </div>
                      <div className="text-2xl font-bold text-gray-900 mb-1">#3</div>
                      <div className="text-xs text-gray-600">of 12 properties</div>
                    </div>

                    {/* Occupancy */}
                    <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Occupancy</span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                      </div>
                      <div className="text-2xl font-bold text-gray-900 mb-1">87.2%</div>
                      <div className="text-xs text-green-600 font-medium">
                        <span className="inline-flex items-center">
                          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                          +5.1% WoW
                        </span>
                      </div>
                    </div>

                    {/* ADR */}
                    <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">ADR</span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                        </svg>
                      </div>
                      <div className="text-2xl font-bold text-gray-900 mb-1">$148</div>
                      <div className="text-xs text-gray-600">avg daily rate</div>
                    </div>
                  </div>

                  {/* Action Items & Navigation */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* Quick Actions */}
                    <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Quick Actions</h3>
                      <div className="space-y-3">
                        <button 
                          onClick={() => handleTabClick('competitors')}
                          className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors group"
                        >
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3 group-hover:bg-blue-200 transition-colors">
                              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-medium text-gray-900">Competitive Analysis</div>
                              <div className="text-xs text-gray-500">Review market positioning</div>
                            </div>
                          </div>
                          <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>

                        <button 
                          onClick={() => handleTabClick('calendar')}
                          className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors group"
                        >
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center mr-3 group-hover:bg-green-200 transition-colors">
                              <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-medium text-gray-900">Events Calendar</div>
                              <div className="text-xs text-gray-500">Upcoming demand drivers</div>
                            </div>
                          </div>
                          <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>

                        <button 
                          onClick={() => handleTabClick('analysis')}
                          className="w-full flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors group"
                        >
                          <div className="flex items-center">
                            <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center mr-3 group-hover:bg-purple-200 transition-colors">
                              <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                            </div>
                            <div className="text-left">
                              <div className="text-sm font-medium text-gray-900">Advanced Analytics</div>
                              <div className="text-xs text-gray-500">Deep performance insights</div>
                            </div>
                          </div>
                          <svg className="w-4 h-4 text-gray-400 group-hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Market Alerts */}
                    <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300">
                      <h3 className="text-sm font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">Market Alerts</h3>
                      <div className="space-y-3">
                        
                        {/* High Priority Alert */}
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                          <div className="flex items-start">
                            <div className="flex-shrink-0">
                              <svg className="w-5 h-5 text-amber-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                              </svg>
                            </div>
                            <div className="ml-3 flex-1">
                              <div className="text-sm font-medium text-amber-900">Major Event Alert</div>
                              <div className="text-sm text-amber-700 mt-1">
                                Concert at Auditorio Nacional in 2 days. Consider rate adjustment.
                              </div>
                              <button 
                                onClick={() => handleTabClick('calendar')}
                                className="mt-2 text-xs font-medium text-amber-800 hover:text-amber-900 underline"
                              >
                                View Details →
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Standard Alert */}
                        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-start">
                            <div className="flex-shrink-0">
                              <svg className="w-5 h-5 text-blue-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            </div>
                            <div className="ml-3 flex-1">
                              <div className="text-sm font-medium text-blue-900">Pricing Optimization</div>
                              <div className="text-sm text-blue-700 mt-1">
                                Weekend rates could be optimized by +$150 MXN based on demand patterns.
                              </div>
                              <button 
                                onClick={() => handleCalendarViewChange('rules')}
                                className="mt-2 text-xs font-medium text-blue-800 hover:text-blue-900 underline"
                              >
                                Configure Rules →
                              </button>
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  </div>
                </div>

              {/* Chart Section */}
              <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all duration-300">
                <div className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Market Position Overview</h3>
                  <p className="text-sm text-gray-600 mt-1">Competitive landscape and pricing trends</p>
                </div>
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
