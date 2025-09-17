'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { 
  TABLES, 
  logDataFlow,
  cleanPrice,
  type ProcessedHotelData 
} from '@/lib/dataUtils'
import { useCurrency } from '@/contexts/CurrencyContext'
import CurrencySelector from './CurrencySelector'
import CompetitorProfile from './CompetitorProfile';
import MultiCompetitorChart from './MultiCompetitorChart'; // Import the new chart component
import ComparisonKpiCards from './ComparisonKpiCards';
import ComparisonInsights from './ComparisonInsights';
import EventInsights from './EventInsights';

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

interface PriceDataPoint {
    date: string;
    avgPrice: number;
}

interface UserHotelData extends PriceDataPoint {
    hotel_name: string;
}

interface CompetitorHistoricalData {
    name: string;
    data: PriceDataPoint[];
}

interface EventData {
    nombre: string;
    fecha: string;
    lugar: string;
}

interface HistoricalComparisonData {
    userHotelData: UserHotelData[];
    competitorsData: CompetitorHistoricalData[];
}

interface RoomTypeData {
  roomType: string
  price: number
  date: string
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
  roomTypes?: string[];
}

export default function CompetitorsTab({ onCompetitorSelect }: { onCompetitorSelect: (competitor: any) => void }) {
  const [competitorData, setCompetitorData] = useState<CompetitorResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [isReloading, setIsReloading] = useState(false);
  const [error, setError] = useState<string | null>(null)
  const [selectedStars, setSelectedStars] = useState('All')
  const [selectedRoomType, setSelectedRoomType] = useState('All');
  const [availableRoomTypes, setAvailableRoomTypes] = useState<string[]>([]);
  const { selectedCurrency, exchangeRate, convertPriceToSelectedCurrency, currency } = useCurrency()
  
  // New state for competitor selection
  const [selectedCompetitors, setSelectedCompetitors] = useState<string[]>([])
  const [showCompetitorSelector, setShowCompetitorSelector] = useState(false)
  
  // New state for multi-competitor comparison
  const [historicalComparisonData, setHistoricalComparisonData] = useState<HistoricalComparisonData | null>(null);
  const [eventsData, setEventsData] = useState<EventData[]>([]);
  const [isComparisonLoading, setIsComparisonLoading] = useState(false);

  // Load selected competitors from localStorage on component mount
  useEffect(() => {
    const saved = localStorage.getItem('selectedCompetitors')
    if (saved) {
      try {
        setSelectedCompetitors(JSON.parse(saved))
      } catch (error) {
        console.error('Error parsing saved competitors:', error)
        setSelectedCompetitors([])
      }
    }
  }, [])

  // Save selected competitors to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('selectedCompetitors', JSON.stringify(selectedCompetitors))
  }, [selectedCompetitors])

  // Toggle competitor selection
  const toggleCompetitorSelection = (competitorName: string) => {
    setSelectedCompetitors(prev => {
      if (prev.includes(competitorName)) {
        return prev.filter(name => name !== competitorName)
      } else {
        return [...prev, competitorName]
      }
    })
  }

  // Clear all selected competitors
  const clearSelectedCompetitors = () => {
    setSelectedCompetitors([])
  }

  // Check if a competitor is selected
  const isCompetitorSelected = (competitorName: string) => selectedCompetitors.includes(competitorName)

  const handleCompareCompetitors = async () => {
    if (selectedCompetitors.length === 0) {
      alert("Please select at least one competitor to compare.");
      return;
    }
    setIsComparisonLoading(true);
    setHistoricalComparisonData(null); // Clear previous data
    setShowCompetitorSelector(false); // Close the selector panel
    try {
      const response = await fetch('/api/competitors/historical', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ competitorNames: selectedCompetitors }),
      });
      const data = await response.json();
      if (data.success) {
        setHistoricalComparisonData(data);
        
        // Now, fetch events for the date range of the competitor data
        if (data.competitorsData && data.competitorsData.length > 0) {
            const allDates = new Set<string>();
            data.competitorsData.forEach((c: CompetitorHistoricalData) => c.data.forEach(d => allDates.add(d.date)));
            const sortedDates = Array.from(allDates).sort();
            if (sortedDates.length > 0) {
                const startDate = sortedDates[0];
                const endDate = sortedDates[sortedDates.length - 1];
                
                try {
                    const eventsResponse = await fetch(`/api/calendar/events?startDate=${startDate}&endDate=${endDate}`);
                    const eventsResult = await eventsResponse.json();
                    if (eventsResult.success) {
                        setEventsData(eventsResult.events);
                    }
                } catch (eventError) {
                    console.error("Failed to fetch events:", eventError);
                    // Non-critical, so we don't show an error to the user
                    setEventsData([]);
                }
            }
        }

      } else {
        setError(data.error || 'Failed to fetch comparison data.');
      }
    } catch (error) {
      setError('An error occurred while fetching comparison data.');
      console.error(error);
    } finally {
      setIsComparisonLoading(false);
    }
  };

  const handleClearComparison = () => {
    setHistoricalComparisonData(null);
    setEventsData([]); // Also clear events data
  };


  useEffect(() => {
    fetchCompetitiveData()
  }, [selectedStars, selectedRoomType])

  const fetchCompetitiveData = async (clearFilters = false) => {
    try {
      if (competitorData) {
        setIsReloading(true);
      } else {
        setLoading(true)
      }
      setError(null)

      // Clear filters if requested (when user explicitly clicks Refresh Data)
      if (clearFilters) {
        setSelectedStars('All')
        setSelectedRoomType('All')
        setSelectedCompetitors([])
        setHistoricalComparisonData(null)
        setEventsData([])
        setShowCompetitorSelector(false)
        // Clear localStorage as well
        localStorage.removeItem('selectedCompetitors')
        console.log('🔄 Filters cleared on refresh')
      }
      
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
          stars: selectedStars === 'All' ? null : parseInt(selectedStars),
          roomType: selectedRoomType
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
      if (result.data.roomTypes) {
        setAvailableRoomTypes(result.data.roomTypes);
      }
      
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
      setIsReloading(false);
    }
  }

  const formatCurrencyValue = (amount: number) => {
    if (typeof amount !== 'number' || isNaN(amount)) {
      return currency.format(0)
    }
    // Apply currency conversion before formatting
    const convertedAmount = convertPriceToSelectedCurrency(amount, 'MXN');
    return currency.format(convertedAmount)
  }

  // Force re-render when currency changes
  useEffect(() => {
    // This will force the component to re-render when currency changes
  }, [selectedCurrency]);

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
            onClick={() => fetchCompetitiveData(false)}
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
              <span>Ensure you&apos;re logged in to the application</span>
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
              onClick={() => fetchCompetitiveData(false)}
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
            <CurrencySelector />
            
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

            {availableRoomTypes.length > 0 && (
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Room Type:</label>
                <select
                  value={selectedRoomType}
                  onChange={(e) => setSelectedRoomType(e.target.value)}
                  className="px-3 py-2 border border-glass-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-glass-50 backdrop-blur-sm"
                >
                  <option value="All">All Rooms</option>
                  {availableRoomTypes.map(room => (
                    <option key={room} value={room}>{room}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Competitor Selection Button */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowCompetitorSelector(!showCompetitorSelector)}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  selectedCompetitors.length > 0
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span>Main Competitors ({selectedCompetitors.length})</span>
                </span>
              </button>
            </div>
          </div>

          <button
            onClick={() => fetchCompetitiveData(true)}
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

        {/* Competitor Selection Panel */}
        {showCompetitorSelector && (
          <div className="mt-4 p-4 bg-glass-50 rounded-xl border border-glass-200">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-700">Select Your Main Competitors</h4>
              {selectedCompetitors.length > 0 && (
                <button
                  onClick={clearSelectedCompetitors}
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  Clear All
                </button>
              )}
            </div>
            
            {competitorData && competitorData.competitors.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {competitorData.competitors.map((competitor, index) => (
                  <label key={index} className="flex items-center space-x-2 cursor-pointer hover:bg-white/50 p-2 rounded-lg transition-colors">
                    <input
                      type="checkbox"
                      checked={isCompetitorSelected(competitor.name)}
                      onChange={() => toggleCompetitorSelection(competitor.name)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 truncate" title={competitor.name}>
                      {competitor.name}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No competitors available to select</p>
            )}
            
            <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-gray-500">
                    Selected competitors will be highlighted in the table below.
                </p>
                <button
                    onClick={handleCompareCompetitors}
                    disabled={selectedCompetitors.length === 0 || isComparisonLoading}
                    className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-75"
                >
                    {isComparisonLoading ? 'Loading...' : `Compare ${selectedCompetitors.length} Competitors`}
                </button>
            </div>
          </div>
        )}
      </div>

      {/* Multi-Competitor Comparison Chart */}
      {isComparisonLoading && (
        <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      )}
      {historicalComparisonData && (
        <div className="mt-6 relative p-4 bg-white rounded-lg shadow-md">
            <button 
              onClick={handleClearComparison}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close comparison"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>
            <MultiCompetitorChart 
                userHotelData={historicalComparisonData.userHotelData}
                competitorsData={historicalComparisonData.competitorsData}
                eventsData={eventsData}
            />
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
              <div>
                <ComparisonKpiCards
                    userHotelData={historicalComparisonData.userHotelData}
                    competitorsData={historicalComparisonData.competitorsData}
                />
              </div>
              <div>
                <EventInsights
                  userHotelData={historicalComparisonData.userHotelData}
                  competitorsData={historicalComparisonData.competitorsData}
                  eventsData={eventsData || []}
                />
              </div>
            </div>
            
            <ComparisonInsights
                userHotelData={historicalComparisonData.userHotelData}
                competitorsData={historicalComparisonData.competitorsData}
            />
        </div>
      )}

      {!historicalComparisonData && competitorData && (
        <div className={`relative transition-opacity duration-300 ${isReloading ? 'opacity-50 pointer-events-none' : ''}`}>
          {isReloading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 -translate-y-1/2">
              <div className="w-12 h-12 border-4 border-gray-200 border-t-red-600 rounded-full animate-spin"></div>
            </div>
          )}
          
          <div className="space-y-8">
            {/* Metrics Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
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
              
              <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-4 hover:shadow-2xl transition-all duration-300">
                <div className="text-2xl font-bold text-gray-900">{selectedCompetitors.length}</div>
                <div className="text-sm text-gray-600">Main Competitors</div>
                <div className="text-xs text-gray-500">Selected for tracking</div>
              </div>
            </div>

            {/* Competitor Table */}
            <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl overflow-hidden hover:shadow-2xl transition-all duration-300">
              <div className="p-6 border-b border-glass-200 bg-glass-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Competitive Landscape
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {competitorData.today} • {competitorData.city} • {selectedStars === 'All' ? 'All Ratings' : `${selectedStars}★ Hotels`}
                    </p>
                  </div>
                  {selectedCompetitors.length > 0 && (
                    <div className="text-right">
                      <div className="text-sm font-medium text-blue-700">
                        {selectedCompetitors.length} Main Competitor{selectedCompetitors.length !== 1 ? 's' : ''} Selected
                      </div>
                      <div className="text-xs text-blue-600">
                        Highlighted in blue
                      </div>
                    </div>
                  )}
                </div>
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
                    
                    {/* Competitor Rows - Filtered by Main Competitors */}
                    {(() => {
                      // Filter competitors based on selection
                      const filteredCompetitors = selectedCompetitors.length > 0 
                        ? competitorData.competitors.filter(competitor => isCompetitorSelected(competitor.name))
                        : competitorData.competitors
                      
                      return filteredCompetitors.length > 0 ? (
                        filteredCompetitors.map((competitor, index) => {
                          const difference = competitor.avg - (competitorData.myAvg || 0)
                          const differencePercent = (competitorData.myAvg || 0) > 0 ? 
                            (difference / (competitorData.myAvg || 0)) * 100 : 0
                          
                          const isSelected = isCompetitorSelected(competitor.name)
                          
                          return (
                            <tr 
                              key={index} 
                              className={`group hover:bg-gray-50 ${isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''}`}
                            >
                              <td 
                                className="px-6 py-4 whitespace-nowrap cursor-pointer"
                                onClick={() => {
                                  const competitorInfo = { ...competitor, checkinDate: competitorData.today };
                                  onCompetitorSelect(competitorInfo);
                                }}
                              >
                                <div className="flex items-center space-x-2">
                                  <div className="text-sm font-medium text-gray-900 group-hover:text-red-600">{competitor.name}</div>
                                  {isSelected && (
                                    <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                                      Main Competitor
                                    </span>
                                  )}
                                </div>
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
                                {selectedCompetitors.length > 0 ? 'No main competitors found' : 'No competitors found'}
                              </div>
                              <div className="text-sm text-gray-500 mb-4">
                                {selectedCompetitors.length > 0 
                                  ? 'None of your selected main competitors match the current filters.' 
                                  : competitorData.city 
                                    ? `No competitors found in ${competitorData.city}` 
                                    : 'No city information available for filtering'
                                }
                              </div>
                              <div className="text-xs text-gray-400">
                                {selectedCompetitors.length > 0 
                                  ? 'Try changing the star rating filter or select different main competitors.' 
                                  : 'Try changing the star rating filter or ensure competitor data is available in the database.'
                                }
                              </div>
                            </div>
                          </td>
                        </tr>
                                   )
                 })()}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Key Insights & Analysis Sections */}
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

            {/* Main Competitors Analysis */}
            {selectedCompetitors.length > 0 && (
              <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Main Competitors Analysis</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 backdrop-blur-lg bg-purple-500/20 rounded-xl border border-purple-300/30 hover:bg-purple-500/30 transition-all duration-300">
                    <h4 className="font-medium text-purple-900 mb-2">🎯 Focused Tracking</h4>
                    <p className="text-sm text-purple-800">
                      You&apos;re tracking {selectedCompetitors.length} main competitors: {selectedCompetitors.slice(0, 3).join(', ')}
                      {selectedCompetitors.length > 3 && ` and ${selectedCompetitors.length - 3} more`}.
                      {(() => {
                        const selectedCompetitorData = competitorData.competitors.filter(c => selectedCompetitors.includes(c.name))
                        if (selectedCompetitorData.length === 0) return ''
                        
                        const avgSelectedPrice = selectedCompetitorData.reduce((sum, c) => sum + c.avg, 0) / selectedCompetitorData.length
                        const priceDiff = avgSelectedPrice - (competitorData.myAvg || 0)
                        const priceDiffPercent = (competitorData.myAvg || 0) > 0 ? (priceDiff / (competitorData.myAvg || 0)) * 100 : 0
                        
                        return ` Their average price is ${formatCurrencyValue(avgSelectedPrice)} (${formatPercentage(priceDiffPercent)} vs yours).`
                      })()}
                    </p>
                  </div>
                  
                  <div className="p-4 backdrop-blur-lg bg-orange-500/20 rounded-xl border border-orange-300/30 hover:bg-orange-500/30 transition-all duration-300">
                    <h4 className="font-medium text-orange-900 mb-2">📈 Strategic Insights</h4>
                    <p className="text-sm text-orange-800">
                      {(() => {
                        const selectedCompetitorData = competitorData.competitors.filter(c => selectedCompetitors.includes(c.name))
                        if (selectedCompetitorData.length === 0) return 'No selected competitors to analyze.'
                        
                        const aboveYou = selectedCompetitorData.filter(c => c.avg > (competitorData.myAvg || 0)).length
                        const belowYou = selectedCompetitorData.filter(c => c.avg < (competitorData.myAvg || 0)).length
                        
                        if (aboveYou > belowYou) {
                          return `Most of your main competitors (${aboveYou} out of ${selectedCompetitorData.length}) are priced above you, suggesting potential for price optimization.`
                        } else if (belowYou > aboveYou) {
                          return `Most of your main competitors (${belowYou} out of ${selectedCompetitorData.length}) are priced below you, indicating you may be in a premium position.`
                        } else {
                          return `Your main competitors are evenly split between higher and lower pricing, showing balanced market positioning.`
                        }
                      })()}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* This component is now rendered by the parent page */}
      {/* {selectedCompetitor && (
        <CompetitorProfile 
          competitor={selectedCompetitor} 
          onClose={() => setSelectedCompetitor(null)} 
        />
      )} */}
    </div>
  )
}
