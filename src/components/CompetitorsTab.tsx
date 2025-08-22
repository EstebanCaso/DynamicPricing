'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { 
  TABLES, 
  formatCurrency, 
  logDataFlow,
  cleanPrice,
  convertCurrency,
  type Currency,
  type ProcessedHotelData 
} from '@/lib/dataUtils'

interface Competitor {
  id: string
  name: string
  stars: number
  city: string
  location: string
  roomTypes: RoomTypeData[]
  avgPrice: number
  revpar: number
}

interface RoomTypeData {
  roomType: string
  price: number
  date: string
}

interface UserHotelData {
  hotelName: string
  roomTypes: RoomTypeData[]
  avgPrice: number
  stars: number
  revpar: number
}

interface MarketMetrics {
  avgPrice: number
  avgRevpar: number
  competitorCount: number
  priceDifference: number
  priceDifferencePercent: number
  userRank: number
  totalHotels: number
}

interface CompetitorResponse {
  today: string
  userId: string
  city: string
  myHotelName: string
  myAvg: number | null
  competitors: Array<{ name: string; avg: number; estrellas: number | null }>
  competitorsAvg: number | null
  competitorsCount: number
  position: number | null
  starsFilter: number | null
  debug?: any
}

export default function CompetitorsTab() {
  const [competitorData, setCompetitorData] = useState<CompetitorResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStars, setSelectedStars] = useState('All')
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('MXN')
  const [exchangeRate, setExchangeRate] = useState<number>(18.5) // Default fallback

  // Fetch exchange rate when currency changes
  useEffect(() => {
    const fetchExchangeRate = async () => {
      if (selectedCurrency === 'MXN') {
        setExchangeRate(1); // No conversion needed for MXN
        return;
      }
      
      try {
        const response = await fetch('/api/exchange-rate');
        const data = await response.json();
        if (data.success && data.rate) {
          setExchangeRate(data.rate);
          console.log(`💱 Exchange rate updated: 1 USD = ${data.rate} MXN`);
        }
      } catch (error) {
        console.error('Failed to fetch exchange rate:', error);
        // Keep default fallback rate
      }
    };

    fetchExchangeRate();
  }, [selectedCurrency]);

  useEffect(() => {
    fetchCompetitiveData()
  }, [selectedStars, selectedCurrency])

  const fetchCompetitiveData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Get current user
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        setError('Authentication required. Please log in to view competitor data.')
        setLoading(false)
        return
      }

      // Check if user has hotel data first using unified table name
      const { data: userHotelCheck, error: checkError } = await supabase
        .from(TABLES.USER_HOTEL)
        .select('hotel_name')
        .eq('user_id', user.id)
        .limit(1)
      
      logDataFlow('CompetitorsTab', { userId: user.id }, 'Checking user hotel data');

      if (checkError) {
        console.error('Error checking user hotel data:', checkError)
        setError('Failed to verify hotel data. Please try again.')
        setLoading(false)
        return
      }

      if (!userHotelCheck || userHotelCheck.length === 0) {
        setError('No hotel data found. Please run the hotel scraping script first to collect your hotel pricing data.')
        setLoading(false)
        return
      }

      // Fetch real competitor data from our working API
      const response = await fetch('/api/compare/hotels', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          stars: selectedStars === 'All' ? null : parseInt(selectedStars)
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch competitor data')
      }

      setCompetitorData(result.data)
      
      // Log debug information for troubleshooting
      if (result.data.debug) {
        console.log('🔧 Competitors Debug Info:', result.data.debug)
      }
      
      if (result.data.competitorsCount === 0) {
        console.log('⚠️ No competitors found. Debug info:', {
          city: result.data.city,
          myHotel: result.data.myHotelName,
          debug: result.data.debug
        })
      }
      
    } catch (err) {
      console.error('Error fetching competitive data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load competitive data')
    } finally {
      setLoading(false)
    }
  }

  // Currency conversion helper
  const convertPriceToSelectedCurrency = (price: number, originalCurrency: Currency = 'MXN'): number => {
    const convertedPrice = convertCurrency(price, originalCurrency, selectedCurrency, exchangeRate);
    if (originalCurrency !== selectedCurrency) {
      console.log(`💱 Converting ${price} ${originalCurrency} → ${convertedPrice.toFixed(2)} ${selectedCurrency} (rate: ${exchangeRate})`);
    }
    return convertedPrice;
  };

  const formatCurrencyValue = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) {
      return formatCurrency(0, selectedCurrency)
    }
    // Apply currency conversion before formatting
    const convertedAmount = convertPriceToSelectedCurrency(amount, 'MXN');
    return formatCurrency(convertedAmount, selectedCurrency)
  }

  const formatPercentage = (value: number) => {
    if (typeof value !== 'number' || isNaN(value)) {
      return '+0.0%'
    }
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  const getDifferenceColor = (difference: number) => {
    if (typeof difference !== 'number' || isNaN(difference)) {
      return 'text-gray-600'
    }
    return difference > 0 ? 'text-red-600' : 'text-green-600'
  }



  // Show loading state
  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        {/* Controls Bar Skeleton */}
        <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <div className="h-4 w-16 bg-gray-300 rounded animate-pulse"></div>
                <div className="h-9 w-32 bg-gray-300 rounded-lg animate-pulse"></div>
              </div>
              
              <div className="flex items-center space-x-2">
                <div className="h-4 w-20 bg-gray-300 rounded animate-pulse"></div>
                <div className="h-9 w-28 bg-gray-300 rounded-lg animate-pulse"></div>
              </div>

              <div className="flex items-center space-x-2">
                <div className="h-4 w-24 bg-gray-300 rounded animate-pulse"></div>
                <div className="h-9 w-24 bg-gray-300 rounded-lg animate-pulse"></div>
              </div>
            </div>

            <div className="h-10 w-32 bg-gray-300 rounded-lg animate-pulse"></div>
          </div>
        </div>

        {/* Metrics Row Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {[...Array(5)].map((_, index) => (
            <div key={index} className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
              <div className="space-y-3">
                <div className="h-8 w-20 bg-gray-300 rounded animate-pulse"></div>
                <div className="h-12 w-24 bg-gray-400 rounded animate-pulse"></div>
                <div className="h-4 w-32 bg-gray-300 rounded animate-pulse"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Loading Message */}
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-8 shadow-2xl border border-gray-200">
            <div className="text-center">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-gray-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
                <div className="absolute inset-0 w-16 h-16 border-4 border-transparent border-t-red-400 rounded-full animate-spin mx-auto" style={{ animationDelay: '-0.5s' }}></div>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Loading Competitive Intelligence</h3>
              <p className="text-gray-600 text-sm">Analyzing real market data from Supabase...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="text-center backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300">
          <div className="text-red-500 text-6xl mb-4 animate-bounce">⚠️</div>
          <h3 className="text-xl font-semibold text-red-700 mb-2">Data Loading Error</h3>
          <p className="text-red-600 text-lg mb-6">{error}</p>
          <button 
            onClick={fetchCompetitiveData}
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
          >
            <span className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.001 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Try Again</span>
            </span>
          </button>
        </div>
      </div>
    )
  }

  // Show no data state
  if (!competitorData) {
    return (
      <div className="min-h-[600px] flex items-center justify-center">
        <div className="text-center backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-8 hover:shadow-2xl transition-all duration-300">
          <div className="text-gray-500 text-6xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Data Available</h3>
          <p className="text-gray-600 text-lg mb-6">
            No competitor data found for your location. To get started:
          </p>
          <div className="text-left text-sm text-gray-600 mb-6 space-y-2">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              <span>Ensure you're logged in to the application</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              <span>Run the hotel scraping script to collect your hotel data</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              <span>Run the competitor scraping script for your city</span>
            </div>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-red-500 rounded-full"></span>
              <span>Verify your city name matches the competitor data</span>
            </div>
          </div>
          <div className="space-y-3">
            <button 
              onClick={fetchCompetitiveData}
              className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105"
            >
              <span className="flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.001 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh Data</span>
              </span>
            </button>
            <div className="text-xs text-gray-500">
              Need help? Check the README for setup instructions.
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 slide-in-from-bottom-4">
      {/* Controls Bar */}
      <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Currency:</label>
              <select
                value={selectedCurrency}
                onChange={(e) => setSelectedCurrency(e.target.value as Currency)}
                className="px-3 py-2 border border-glass-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-glass-50 backdrop-blur-sm"
              >
                <option value="MXN">MXN (Pesos)</option>
                <option value="USD">USD (Dollars)</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Star Rating:</label>
              <select
                value={selectedStars}
                onChange={(e) => setSelectedStars(e.target.value)}
                className="px-3 py-2 border border-glass-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-glass-50 backdrop-blur-sm"
              >
                <option value="All">All Ratings</option>
                <option value="3">3 Stars</option>
                <option value="4">4 Stars</option>
                <option value="5">5 Stars</option>
              </select>
            </div>
          </div>

          <button
            onClick={fetchCompetitiveData}
            disabled={loading}
            className={`px-4 py-2 rounded-lg text-white transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed ${
              loading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-red-600 hover:bg-red-700 active:scale-95'
            }`}
          >
            {loading ? (
              <span className="flex items-center space-x-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Refreshing...</span>
              </span>
            ) : (
              <span className="flex items-center space-x-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.001 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh Data</span>
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-4 hover:shadow-2xl transition-all duration-300">
          <div className="text-2xl font-bold text-gray-900">{competitorData.competitorsCount}</div>
          <div className="text-sm text-gray-600">Competitors</div>
          <div className="text-xs text-gray-500">Active in {competitorData.city}</div>
        </div>
        
        <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-4 hover:shadow-2xl transition-all duration-300">
          <div className="text-2xl font-bold text-gray-900">{formatCurrencyValue(competitorData.myAvg || 0)}</div>
          <div className="text-sm text-gray-600">Your Avg Price</div>
          <div className="text-xs text-gray-500">{competitorData.myHotelName}</div>
        </div>
        
        <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-4 hover:shadow-2xl transition-all duration-300">
          <div className="text-2xl font-bold text-gray-900">{formatCurrencyValue(competitorData.competitorsAvg || 0)}</div>
          <div className="text-sm text-gray-600">Market Avg Price</div>
          <div className="text-xs text-gray-500">Competitor average</div>
        </div>
        
        <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-4 hover:shadow-2xl transition-all duration-300">
          <div className="text-2xl font-bold text-gray-900">#{competitorData.position || 'N/A'}</div>
          <div className="text-sm text-gray-600">Your Position</div>
          <div className="text-xs text-gray-500">Out of {competitorData.competitorsCount + 1} hotels</div>
        </div>
      </div>

      {/* Competitor Table */}
      <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300">
        <div className="p-6 border-b border-glass-200 bg-glass-50">
          <h3 className="text-lg font-semibold text-gray-900">
            Competitive Landscape
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {competitorData.today} • {competitorData.city} • {selectedStars === 'All' ? 'All Ratings' : `${selectedStars}★ Hotels`}
          </p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-glass-200">
            <thead className="bg-glass-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Hotel
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Difference From You
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rating
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  RevPAR
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-glass-200">
              {/* Your Hotel Row - Highlighted */}
              <tr className="bg-yellow-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-semibold text-gray-900">{competitorData.myHotelName} (You)</div>
                  <div className="text-xs text-gray-500">Your Property</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-bold text-gray-900">
                    {formatCurrencyValue(competitorData.myAvg || 0)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">Baseline</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                    Position #{competitorData.position || 'N/A'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {formatCurrencyValue((competitorData.myAvg || 0) * 0.85)}
                  </div>
                  <div className="text-xs text-gray-500">85% occupancy</div>
                </td>
              </tr>
              
              {/* Competitor Rows */}
              {competitorData.competitors.length > 0 ? (
                competitorData.competitors.map((competitor, index) => {
                  const difference = competitor.avg - (competitorData.myAvg || 0)
                  const differencePercent = (competitorData.myAvg || 0) > 0 ? 
                    (difference / (competitorData.myAvg || 0)) * 100 : 0
                  
                  return (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{competitor.name}</div>
                        <div className="text-xs text-gray-500">{competitorData.city}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{formatCurrencyValue(competitor.avg)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-medium ${getDifferenceColor(difference)}`}>
                          {difference > 0 ? '+' : ''}{formatCurrencyValue(difference)} ({formatPercentage(differencePercent)})
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 border border-gray-200">
                          {competitor.estrellas || 'N/A'}★
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{formatCurrencyValue(competitor.avg * 0.80)}</div>
                        <div className="text-xs text-gray-500">80% occupancy</div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    <div className="py-8">
                      <div className="text-lg font-medium text-gray-600 mb-2">
                        No competitors found
                      </div>
                      <div className="text-sm text-gray-500 mb-4">
                        {competitorData.city 
                          ? `No competitors found in ${competitorData.city}` 
                          : 'No city information available for filtering'}
                      </div>
                      <div className="text-xs text-gray-400">
                        Try changing the star rating filter or ensure competitor data is available in the database.
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Summary Insights */}
      <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Key Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 backdrop-blur-lg bg-green-500/20 rounded-xl border border-green-300/30 hover:bg-green-500/30 transition-all duration-300">
            <h4 className="font-medium text-green-900 mb-2">📊 Market Position</h4>
            <p className="text-sm text-green-800">
              Your hotel ranks #{competitorData.position || 'N/A'} out of {competitorData.competitorsCount + 1} hotels in {competitorData.city}.
              {competitorData.myAvg && competitorData.competitorsAvg ? 
                (competitorData.myAvg > competitorData.competitorsAvg ? 
                  ` You are priced ${formatPercentage(((competitorData.myAvg - competitorData.competitorsAvg) / competitorData.competitorsAvg) * 100)} above market average.` :
                  ` You are priced ${formatPercentage(((competitorData.competitorsAvg - competitorData.myAvg) / competitorData.competitorsAvg) * 100)} below market average.`
                ) : ' Price comparison not available.'
              }
            </p>
          </div>
          
          <div className="p-4 backdrop-blur-lg bg-blue-500/20 rounded-xl border border-blue-300/30 hover:bg-blue-500/30 transition-all duration-300">
            <h4 className="font-medium text-blue-900 mb-2">💰 Revenue Performance</h4>
            <p className="text-sm text-blue-800">
              Your RevPAR is {formatCurrencyValue((competitorData.myAvg || 0) * 0.85)} compared to market average of {formatCurrencyValue((competitorData.competitorsAvg || 0) * 0.80)}.
              {(competitorData.myAvg || 0) * 0.85 > (competitorData.competitorsAvg || 0) * 0.80 ? 
                ' You are outperforming the market!' : 
                ' Consider optimizing your pricing strategy.'
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
