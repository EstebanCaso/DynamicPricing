'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

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
  userHotel: UserHotelData
  competitors: Competitor[]
  marketMetrics: MarketMetrics
  filters: {
    selectedStars: string
    selectedRoomType: string
    selectedDateRange: string
    city: string
    currentDate: string
  }
}

export default function CompetitorsTab() {
  const [competitorData, setCompetitorData] = useState<CompetitorResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStars, setSelectedStars] = useState('All')
  const [selectedRoomType, setSelectedRoomType] = useState('All Types')
  const [selectedDateRange, setSelectedDateRange] = useState('30 Days')
  const [userCity, setUserCity] = useState('New York')

  useEffect(() => {
    fetchCompetitiveData()
  }, [selectedStars, selectedRoomType, selectedDateRange, userCity])

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

      // Check if user has hotel data first
      const { data: userHotelCheck, error: checkError } = await supabase
        .from('hotel_usuario')
        .select('hotel_name')
        .eq('user_id', user.id)
        .limit(1)

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

      // Fetch real competitor data from our new API
      const response = await fetch('/api/competitors/real-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          selectedStars,
          selectedRoomType,
          selectedDateRange,
          city: userCity
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
      
    } catch (err) {
      console.error('Error fetching competitive data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load competitive data')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) {
      return '$0.00'
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
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

  const getCurrentRoomData = () => {
    if (!competitorData) return null
    
    if (selectedRoomType === 'All Types') {
      return competitorData.userHotel.roomTypes[0] || null
    }
    return competitorData.userHotel.roomTypes.find(room => room.roomType === selectedRoomType) || null
  }

  const currentRoomData = getCurrentRoomData()

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
              <label className="text-sm font-medium text-gray-700">City:</label>
              <input
                type="text"
                value={userCity}
                onChange={(e) => setUserCity(e.target.value)}
                placeholder="Enter city name"
                className="px-3 py-2 border border-glass-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-glass-50 backdrop-blur-sm"
              />
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

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Room Type:</label>
              <select
                value={selectedRoomType}
                onChange={(e) => setSelectedRoomType(e.target.value)}
                className="px-3 py-2 border border-glass-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-glass-50 backdrop-blur-sm"
              >
                <option value="All Types">All Types</option>
                {competitorData.userHotel.roomTypes.map((room, index) => (
                  <option key={index} value={room.roomType}>{room.roomType}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Date Range:</label>
              <select
                value={selectedDateRange}
                onChange={(e) => setSelectedDateRange(e.target.value)}
                className="px-3 py-2 border border-glass-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-glass-50 backdrop-blur-sm"
              >
                <option value="7 Days">7 Days</option>
                <option value="30 Days">30 Days</option>
                <option value="90 Days">90 Days</option>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-4 hover:shadow-2xl transition-all duration-300">
          <div className="text-2xl font-bold text-gray-900">{competitorData.marketMetrics.competitorCount}</div>
          <div className="text-sm text-gray-600">Competitors</div>
          <div className="text-xs text-gray-500">Active in {userCity}</div>
        </div>
        
        <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-4 hover:shadow-2xl transition-all duration-300">
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(competitorData.userHotel.avgPrice)}</div>
          <div className="text-sm text-gray-600">Your Avg Price</div>
          <div className="text-xs text-gray-500">{competitorData.userHotel.stars}★ Hotel</div>
        </div>
        
        <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-4 hover:shadow-2xl transition-all duration-300">
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(competitorData.marketMetrics.avgPrice)}</div>
          <div className="text-sm text-gray-600">Market Avg Price</div>
          <div className="text-xs text-gray-500">Competitor average</div>
        </div>
        
        <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-4 hover:shadow-2xl transition-all duration-300">
          <div className={`text-2xl font-bold ${getDifferenceColor(competitorData.marketMetrics.priceDifferencePercent)}`}>
            {formatPercentage(competitorData.marketMetrics.priceDifferencePercent)}
          </div>
          <div className="text-sm text-gray-600">Price Difference</div>
          <div className="text-xs text-gray-500">
            {competitorData.marketMetrics.priceDifference > 0 ? 'Above' : 'Below'} market
          </div>
        </div>
        
        <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-4 hover:shadow-2xl transition-all duration-300">
          <div className="text-2xl font-bold text-gray-900">{formatCurrency(competitorData.userHotel.revpar)}</div>
          <div className="text-sm text-gray-600">Your RevPAR</div>
          <div className="text-xs text-gray-500">vs {formatCurrency(competitorData.marketMetrics.avgRevpar)} market</div>
        </div>
      </div>

      {/* Competitor Table */}
      <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300">
        <div className="p-6 border-b border-glass-200 bg-glass-50">
          <h3 className="text-lg font-semibold text-gray-900">
            {currentRoomData ? currentRoomData.roomType : 'All Rooms'} - Competitive Landscape
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {competitorData.filters.currentDate} • {userCity} • {selectedStars === 'All' ? 'All Ratings' : `${selectedStars}★ Hotels`}
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
                  <div className="text-sm font-semibold text-gray-900">{competitorData.userHotel.hotelName} (You)</div>
                  <div className="text-xs text-gray-500">{competitorData.userHotel.stars}★ • Your Property</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-bold text-gray-900">
                    {formatCurrency(competitorData.userHotel.avgPrice)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-500">Baseline</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                    {competitorData.userHotel.stars}★
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {formatCurrency(competitorData.userHotel.revpar)}
                  </div>
                  <div className="text-xs text-gray-500">85% occupancy</div>
                </td>
              </tr>
              
              {/* Competitor Rows */}
              {competitorData.competitors.length > 0 ? (
                competitorData.competitors.map((competitor, index) => {
                  const difference = competitor.avgPrice - competitorData.userHotel.avgPrice
                  const differencePercent = competitorData.userHotel.avgPrice > 0 ? 
                    (difference / competitorData.userHotel.avgPrice) * 100 : 0
                  
                  return (
                    <tr key={competitor.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{competitor.name}</div>
                        <div className="text-xs text-gray-500">{competitor.city} • {competitor.location}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{formatCurrency(competitor.avgPrice)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className={`text-sm font-medium ${getDifferenceColor(difference)}`}>
                          {difference > 0 ? '+' : ''}{formatCurrency(difference)} ({formatPercentage(differencePercent)})
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 border border-gray-200">
                          {competitor.stars}★
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{formatCurrency(competitor.revpar)}</div>
                        <div className="text-xs text-gray-500">80% occupancy</div>
                      </td>
                    </tr>
                  )
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    No competitor data available for the selected filters
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
              Your hotel ranks #{competitorData.marketMetrics.userRank} out of {competitorData.marketMetrics.totalHotels} hotels in {userCity}.
              {competitorData.marketMetrics.priceDifference > 0 ? 
                ` You are priced ${formatPercentage(competitorData.marketMetrics.priceDifferencePercent)} above market average.` :
                ` You are priced ${formatPercentage(Math.abs(competitorData.marketMetrics.priceDifferencePercent))} below market average.`
              }
            </p>
          </div>
          
          <div className="p-4 backdrop-blur-lg bg-blue-500/20 rounded-xl border border-blue-300/30 hover:bg-blue-500/30 transition-all duration-300">
            <h4 className="font-medium text-blue-900 mb-2">💰 Revenue Performance</h4>
            <p className="text-sm text-blue-800">
              Your RevPAR is {formatCurrency(competitorData.userHotel.revpar)} compared to market average of {formatCurrency(competitorData.marketMetrics.avgRevpar)}.
              {competitorData.userHotel.revpar > competitorData.marketMetrics.avgRevpar ? 
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
