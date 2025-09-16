"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import CalendarTab from '@/components/CalendarTab'
import PriceRulesView from '@/components/PriceRulesView'
import CompetitorsTab from '@/components/CompetitorsTab'
import CurrencySelector from '@/components/CurrencySelector'
import { useCurrency } from '@/contexts/CurrencyContext'

type CompareData = {
  today: string
  myHotelName: string
  myAvg: number | null
  competitors: Array<{ name: string; avg: number }>
  competitorsAvg: number | null
  competitorsCount: number
  position: number | null
}

export function HotelsComparisonCard() {
  const [data, setData] = useState<CompareData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { selectedCurrency, currency, convertPriceToSelectedCurrency, exchangeRate } = useCurrency()

  // Force re-render when currency changes
  useEffect(() => {
    // This will force the component to re-render when currency changes
  }, [selectedCurrency]);

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

          {/* Competitors list (top 3 by price) */}
          {data.competitors.slice(0, 3).map((c, idx) => (
            <div key={c.name + idx} className="grid grid-cols-3 gap-4 items-center py-3">
              <div className="flex flex-col space-y-1 pl-8">
                <span className="text-base">{c.name}</span>
              </div>
                                  <div className="text-base text-center">{currency.format(convertPriceToSelectedCurrency(Math.round(c.avg), 'MXN'))}</div>
              <div className="text-base text-center text-gray-600">-</div>
            </div>
          ))}

          {/* Our hotel highlighted */}
          <div className="flex rounded-2xl overflow-hidden shadow-lg">
            <div className="flex-1 bg-white border-2 border-red-600 rounded-l-2xl px-4 py-3 flex items-center relative z-10">
              <div className="flex flex-col space-y-1 flex-1 pl-8">
                <span className="text-base font-bold text-gray-900">{data.myHotelName}</span>
              </div>
              <div className="text-base font-bold text-red-600 text-center flex-1">{data.myAvg != null ? currency.format(convertPriceToSelectedCurrency(Math.round(data.myAvg), 'MXN')) : '-'}</div>
            </div>
            <div className="w-1/3 bg-red-600 rounded-r-2xl flex items-center justify-center px-4 py-3 relative -ml-2">
              <span className="text-lg font-bold text-white">{data.position ?? '-'}</span>
            </div>
          </div>

          {/* Fallback when no competitors */}
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


const AnalysisTab = dynamic(() => import('@/components/AnalysisTab'), {
  ssr: false,
  loading: () => (
    <div className="bg-white rounded-[18px] p-6 border border-gray-200 text-gray-600">Loading charts...</div>
  ),
})

export default function DashboardClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { selectedCurrency, currency, convertPriceToSelectedCurrency, exchangeRate } = useCurrency()
  
  // Force re-render when currency changes
  useEffect(() => {
    // This will force the component to re-render when currency changes
  }, [selectedCurrency]);

  const tabs = useMemo(
    () => [
      { id: 'summary', name: 'Summary' },
      { id: 'calendar', name: 'Calendar' },
              { id: 'competitors', name: 'Competitors' },
              { id: 'analysis', name: 'Analytics' },
    ],
    []
  )
  const [activeTab, setActiveTab] = useState<string>('summary')
  const [showCalendarMenu, setShowCalendarMenu] = useState<boolean>(false)
  const calendarMenuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const fromQuery = searchParams.get('tab')
    if (fromQuery && tabs.some((t) => t.id === fromQuery)) {
      setActiveTab(fromQuery)
    }
  }, [searchParams, tabs])

  const handleTabChange = (nextTab: string) => {
    setActiveTab(nextTab)
    const url = `/dashboard?tab=${encodeURIComponent(nextTab)}`
    router.push(url)
  }

  const handleCalendarViewChange = (view: 'calendar' | 'rules') => {
    setActiveTab('calendar')
    const url = `/dashboard?tab=calendar&view=${view}`
    router.push(url)
    setShowCalendarMenu(false)
  }

  // Close dropdown on outside click
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

  return (
    <div className="min-h-screen">
      {/* Top Navigation Bar - Floating */}
      <div className="container mx-auto px-6 py-4 relative z-[10000]">
        {/* soft background glow */}
        <div className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 h-24 w-11/12 rounded-full bg-gradient-to-r from-rose-300/25 via-amber-300/25 to-emerald-300/25 blur-2xl"></div>
        <div className="relative group">
          <div className="absolute -inset-[1px] rounded-[25px] bg-gradient-to-r from-rose-400/30 via-amber-300/30 to-emerald-300/30 blur-md opacity-60 group-hover:opacity-80 transition"></div>
          <div className="relative rounded-[25px] shadow-md border border-white/50 bg-white/70 backdrop-blur px-6 py-4 z-[10000]">
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
            <div className="flex items-center space-x-4">
              <div className="flex space-x-3 md:space-x-4">
                {tabs.map((tab) => {
                  if (tab.id !== 'calendar') {
                    return (
                      <button
                        key={tab.id}
                        onClick={() => handleTabChange(tab.id)}
                        className={`px-4 py-2 rounded-2xl font-medium transition-all ring-1 ring-black/5 ${
                          activeTab === tab.id
                            ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-sm'
                            : 'bg-white/60 text-gray-700 hover:bg-white'
                        }`}
                      >
                        {tab.name}
                      </button>
                    )
                  }
                  const calendarActive = activeTab === 'calendar'
                  return (
                    <div
                      key={tab.id}
                      ref={calendarMenuRef}
                      className="relative"
                   >
                      <button
                        aria-expanded={showCalendarMenu}
                        onClick={() => setShowCalendarMenu((v) => !v)}
                        className={`px-4 py-2 rounded-2xl font-medium transition-all ring-1 ring-black/5 ${
                          calendarActive ? 'bg-gradient-to-r from-rose-500 to-amber-500 text-white shadow-sm' : 'bg-white/60 text-gray-700 hover:bg-white'
                        }`}
                      >
                        {tab.name}
                      </button>
                      {showCalendarMenu && (
                        <div
                          className="absolute left-0 top-full mt-2 w-56 rounded-xl border border-black/10 bg-white shadow-lg z-[9999]"
                        >
                          <button
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded-t-xl"
                            onClick={() => handleCalendarViewChange('calendar')}
                          >
                            Calendario
                          </button>
                          <button
                            className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded-b-xl"
                            onClick={() => handleCalendarViewChange('rules')}
                          >
                            Reglas de Precios
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              
              {/* Currency Selector */}
              <CurrencySelector showLabel={false} />
            </div>

            {/* User Icon */}
            <div className="w-8 h-8 bg-white/60 ring-1 ring-black/5 rounded-full"></div>
          </div>
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
          <CompetitorsTab onCompetitorSelect={() => {}} />
        ) : (
          <div className="grid grid-cols-3 gap-8">
            {/* Left Column - KPIs and Calendar */}
            <div className="col-span-1 space-y-8">
              {/* KPI Cards */}
              <div className="grid grid-cols-1 gap-6">
                {/* Performance Index */}
                <div className="bg-white rounded-[25px] p-6 border-l-4 border-orange-500 shadow-sm">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Performance index</h3>
                  <p className="text-3xl font-bold text-orange-500">60%</p>
                </div>

                {/* Average Rate */}
                <div className="bg-white rounded-[25px] p-6 border-l-4 border-red-500 shadow-sm">
                  <h3 className="text-sm font-medium text-gray-600 mb-2">Average rate</h3>
                  <p className="text-3xl font-bold text-gray-900">
                    {currency.format(convertPriceToSelectedCurrency(126, 'MXN'))}
                  </p>
                </div>
              </div>

              {/* Monthly Calendar (clickable) */}
              <div className="bg-white rounded-[25px] p-6 shadow-sm">
                <h3 className="text-3xl font-bold text-gray-900 mb-4">{new Date().toLocaleString('en-US', { month: 'long' })}</h3>
                <div className="grid grid-cols-7 gap-1 mx-auto">
                  {['S','M','T','W','T','F','S'].map((d) => (
                    <div key={d} className="text-center text-base font-medium text-gray-500 py-2">{d}</div>
                  ))}
                  {Array.from({ length: new Date(new Date().getFullYear(), new Date().getMonth(), 1).getDay() }).map((_, i) => (
                    <div key={`blank-${i}`} className="w-10 h-10" />
                  ))}
                  {Array.from({ length: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() }, (_, i) => {
                    const now = new Date()
                    const day = i + 1
                    const dateISO = new Date(now.getFullYear(), now.getMonth(), day)
                    const iso = new Date(dateISO.getTime() - dateISO.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
                    return (
                      <a key={day} href={`/dashboard?tab=calendar&date=${iso}`} className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center text-lg relative hover:ring-1 hover:ring-red-300">
                        {day}
                      </a>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Right Column - Hotels Table */}
            <div className="col-span-2">
              <div className="bg-white rounded-[25px] p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Hotels Comparison</h3>
                <div className="space-y-4">
                  {/* Header */}
                  <div className="grid grid-cols-3 gap-4 text-base font-medium text-gray-600">
                    <div className="pl-8">Hotels</div>
                    <div className="text-center">Fee</div>
                    <div className="text-center">Diference</div>
                  </div>

                  {/* Hotels A */}
                  <div className="grid grid-cols-3 gap-4 items-center py-3">
                    <div className="flex flex-col space-y-1 pl-8">
                      <span className="text-base">Hotels A</span>
                      <div className="flex space-x-1">
                        {Array.from({ length: 5 }, (_, i) => (
                          <svg key={i} className={`w-4 h-4 ${i < 4 ? 'text-red-500' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2L15.09 8.26L22 9L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9L8.91 8.26L12 2Z" />
                          </svg>
                        ))}
                      </div>
                    </div>
                    <div className="text-base text-center">{currency.format(convertPriceToSelectedCurrency(123, 'MXN'))}</div>
                    <div className="text-base text-green-600 text-center">+{currency.format(convertPriceToSelectedCurrency(23, 'MXN'))}</div>
                  </div>

                  {/* Hotels B */}
                  <div className="grid grid-cols-3 gap-4 items-center py-3">
                    <div className="flex flex-col space-y-1 pl-8">
                      <span className="text-base">Hotels B</span>
                      <div className="flex space-x-1">
                        {Array.from({ length: 5 }, (_, i) => (
                          <svg key={i} className={`w-4 h-4 ${i < 3 ? 'text-red-500' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2L15.09 8.26L22 9L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9L8.91 8.26L12 2Z" />
                          </svg>
                        ))}
                      </div>
                    </div>
                    <div className="text-base text-center">{currency.format(convertPriceToSelectedCurrency(97, 'MXN'))}</div>
                    <div className="text-base text-red-600 text-center">-{currency.format(convertPriceToSelectedCurrency(3, 'MXN'))}</div>
                  </div>

                  {/* Hotels (ours) - Highlighted */}
                  <div className="flex rounded-2xl overflow-hidden shadow-lg">
                    {/* Left section - White background (2/3) */}
                    <div className="flex-1 bg-white border-2 border-red-600 rounded-l-2xl px-4 py-3 flex items-center relative z-10">
                      <div className="flex flex-col space-y-1 flex-1 pl-8">
                        <span className="text-base font-bold text-gray-900">Hotels (ours)</span>
                        <div className="flex space-x-1">
                          {Array.from({ length: 5 }, (_, i) => (
                            <svg key={i} className={`w-4 h-4 ${i < 4 ? 'text-red-500' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 24 24">
                              <path d="M12 2L15.09 8.26L22 9L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9L8.91 8.26L12 2Z" />
                            </svg>
                          ))}
                        </div>
                      </div>
                      <div className="text-base font-bold text-red-600 text-center flex-1">{currency.format(convertPriceToSelectedCurrency(100, 'MXN'))}</div>
                    </div>

                    {/* Right section - Red background (1/3) */}
                    <div className="w-1/3 bg-red-600 rounded-r-2xl flex items-center justify-center px-4 py-3 relative -ml-2">
                      <span className="text-lg font-bold text-white">3rd</span>
                    </div>
                  </div>

                  {/* Repeat Hotels B */}
                  <div className="grid grid-cols-3 gap-4 items-center py-3">
                    <div className="flex flex-col space-y-1 pl-8">
                      <span className="text-base">Hotels B</span>
                      <div className="flex space-x-1">
                        {Array.from({ length: 5 }, (_, i) => (
                          <svg key={i} className={`w-4 h-4 ${i < 3 ? 'text-red-500' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2L15.09 8.26L22 9L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9L8.91 8.26L12 2Z" />
                          </svg>
                        ))}
                      </div>
                    </div>
                    <div className="text-base text-center">{currency.format(convertPriceToSelectedCurrency(97, 'MXN'))}</div>
                    <div className="text-base text-red-600 text-center">-{currency.format(convertPriceToSelectedCurrency(3, 'MXN'))}</div>
                  </div>

                  {/* Repeat Hotels A */}
                  <div className="grid grid-cols-3 gap-4 items-center py-3">
                    <div className="flex flex-col space-y-1 pl-8">
                      <span className="text-base">Hotels A</span>
                      <div className="flex space-x-1">
                        {Array.from({ length: 5 }, (_, i) => (
                          <svg key={i} className={`w-4 h-4 ${i < 4 ? 'text-red-500' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2L15.09 8.26L22 9L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9L8.91 8.26L12 2Z" />
                          </svg>
                        ))}
                      </div>
                    </div>
                    <div className="text-base text-center">{currency.format(convertPriceToSelectedCurrency(123, 'MXN'))}</div>
                    <div className="text-base text-center">+{currency.format(convertPriceToSelectedCurrency(23, 'MXN'))}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

