'use client'

import { useEffect, useState } from 'react'
import { useCurrency } from '@/contexts/CurrencyContext'
import CurrencySelector from './CurrencySelector'
import ScrapingCard from './ScrapingCard'
import PricingCard from './PricingCard'
import ReportsCard from './ReportsCard'
import AnalyticsCard from './AnalyticsCard'

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [stats, setStats] = useState<{ totalEvents: number; growthPercent: number; eventsToday: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const { selectedCurrency, convertPriceToSelectedCurrency, currency } = useCurrency()

  useEffect(() => {
    const loadStats = async () => {
      try {
        setLoading(true)
        const res = await fetch('/api/stats/overview', { cache: 'no-store' })
        const json = await res.json()
        if (json?.success) {
          setStats(json.data)
        } else {
          setStats(null)
        }
      } catch (e) {
        setStats(null)
      } finally {
        setLoading(false)
      }
    }
    loadStats()
  }, [])

  return (
    <div className="space-y-6">
      {/* Welcome Section with Currency Selector */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Welcome to Arkus Dynamic Pricing
            </h1>
            <p className="text-gray-600">
              Monitor your pricing strategies and run Python scraping scripts to gather market data.
            </p>
          </div>
          <CurrencySelector />
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-lg p-4 hover:shadow-2xl hover:scale-105 hover:bg-glass-50 transition-all duration-300 group cursor-pointer">
          <div className="flex items-center">
            <div className="p-1.5 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl text-white group-hover:from-blue-600 group-hover:to-blue-700 transition-all duration-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600 group-hover:text-gray-700 transition-colors duration-300">Total Revenue</p>
              <p className="text-xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors duration-300">
                {currency.format(convertPriceToSelectedCurrency(1250000, 'MXN'))}
              </p>
            </div>
          </div>
        </div>

        <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-lg p-4 hover:shadow-2xl hover:scale-105 hover:bg-glass-50 transition-all duration-300 group cursor-pointer">
          <div className="flex items-center">
            <div className="p-1.5 bg-gradient-to-br from-green-500 to-green-600 rounded-xl text-white group-hover:from-green-600 group-hover:to-green-700 transition-all duration-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600 group-hover:text-gray-700 transition-colors duration-300">Bookings</p>
              <p className="text-xl font-bold text-gray-900 group-hover:text-green-600 transition-colors duration-300">1,247</p>
            </div>
          </div>
        </div>

        <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-lg p-4 hover:shadow-2xl hover:scale-105 hover:bg-glass-50 transition-all duration-300 group cursor-pointer">
          <div className="flex items-center">
            <div className="p-1.5 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl text-white group-hover:from-purple-600 group-hover:to-purple-700 transition-all duration-300">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-xs font-medium text-gray-600 group-hover:text-gray-700 transition-colors duration-300">Growth</p>
              <p className="text-xl font-bold text-gray-900 group-hover:text-purple-600 transition-colors duration-300">+23.5%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ScrapingCard />
        <PricingCard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReportsCard />
        <AnalyticsCard />
      </div>
    </div>
  )
}
