'use client'

import {
  ResponsiveContainer,
  Rectangle,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  Brush,
  ReferenceArea,
  ReferenceDot,
} from 'recharts';

type HistoricalPoint = {
  day: string;
  revenue: number;
}

type DemandPoint = {
  day: string
  requests: number
}

type RevenuePoint = {
  hotel: string
  revenue: number
}

type GapPoint = {
  day: string
  ours: number
  marketAvg: number
}

// Historical prices will be populated from Supabase data

const computeDemand = (price: number) => {
  const base = 1400 - Math.max(0, price - 80) * 6
  const noise = (Math.random() - 0.5) * 60
  return Math.max(400, Math.round(base + noise))
}

const revenuePerformance: RevenuePoint[] = [
  { hotel: 'Hotel A', revenue: 1100 },
  { hotel: 'Ours', revenue: 1150 },
  { hotel: 'Hotel B', revenue: 1080 },
]

const gapSeries: GapPoint[] = [
  { day: 'M', ours: 180, marketAvg: 190 },
  { day: 'T', ours: 186, marketAvg: 200 },
  { day: 'W', ours: 178, marketAvg: 188 },
  { day: 'T', ours: 195, marketAvg: 210 },
  { day: 'F', ours: 200, marketAvg: 215 },
  { day: 'S', ours: 194, marketAvg: 208 },
  { day: 'S', ours: 185, marketAvg: 198 },
]

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

export default function AnalysisTab() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currency = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  })

  const numberFmt = new Intl.NumberFormat('en-US')

  const [showOurs, setShowOurs] = useState(true)
  const [showMarket, setShowMarket] = useState(true)
  const [range, setRange] = useState<7 | 30 | 90>(30)
  
  // Supabase data states
  const [supabaseData, setSupabaseData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [userHotelName, setUserHotelName] = useState<string>('')
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null)
  const [todayAverageRevenue, setTodayAverageRevenue] = useState<number | null>(null)
  const [historicalPrices, setHistoricalPrices] = useState<HistoricalPoint[]>([])
  
  // Filter states for dynamic revenue analysis
  const [selectedRoomType, setSelectedRoomType] = useState<string>('all')
  const [selectedDate, setSelectedDate] = useState<string>('')
  const [viewMode, setViewMode] = useState<'total' | 'by-room' | 'by-date' | 'specific'>('total')
  
  const [targetMin, setTargetMin] = useState<number>(() => Number(searchParams.get('tmn')) || 95)
  const [targetMax, setTargetMax] = useState<number>(() => Number(searchParams.get('tmx')) || 115)
  const [events, setEvents] = useState<string[]>(() => {
    const raw = searchParams.get('ev')
    if (!raw) return ['Aug 7', 'Aug 9']
    return raw.split(',').map((s) => decodeURIComponent(s.trim())).filter(Boolean)
  })

  // Function to standardize room types
  const standardizeRoomType = (roomType: string): string => {
    if (!roomType) return 'Standard'
    
    const normalized = roomType.toLowerCase().trim()
    
    if (normalized.includes('business')) return 'Business'
    if (normalized.includes('double') && normalized.includes('bed')) return 'Double Bed'
    if (normalized.includes('queen')) return 'Queen'
    if (normalized.includes('suite')) return 'Suite'
    if (normalized.includes('superior')) return 'Superior'
    
    return 'Standard'
  }

  // Function to clean price data
  const cleanPrice = (priceString: string | number): number => {
    if (typeof priceString === 'number') return priceString
    if (!priceString) return 0
    
    // Remove MXN, $, commas, and trim whitespace
    const cleanedPrice = priceString
      .toString()
      .replace(/MXN/gi, '')
      .replace(/\$/g, '')
      .replace(/,/g, '')
      .trim()
    
    const price = parseFloat(cleanedPrice)
    return isNaN(price) ? 0 : price
  }

  // Function to get current user
  const getCurrentUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) {
        console.error('Error getting user:', error)
        return null
      }
      setCurrentUser(user)
      return user
    } catch (err) {
      console.error('Error in getCurrentUser:', err)
      return null
    }
  }

  // Function to process Supabase data into historical revenue format
  const processHistoricalRevenue = (data: any[]) => {
    try {
      if (!data || data.length === 0) {
        console.log('📭 No data available for historical revenue processing')
        setHistoricalPrices([])
        return
      }

      // Apply room type filter if selected
      let filteredData = data
      if (selectedRoomType !== 'all') {
        filteredData = data.filter(item => 
          standardizeRoomType(item.room_type) === selectedRoomType
        )
        console.log(`🔍 Historical Revenue filtered by room type ${selectedRoomType}:`, filteredData.length, 'records')
      }

      // Group data by checkin_date and calculate total revenue per day
      const dailyRevenue: Record<string, number> = {}
      
      filteredData.forEach((item: any) => {
        const checkinDate = item.checkin_date || item.Checkin_date
        if (!checkinDate) return
        
        // Extract date part from the record (handle both date-only and datetime formats)
        let dateStr = checkinDate
        if (checkinDate.includes('T')) {
          dateStr = checkinDate.split('T')[0]
        }
        
        const price = item.price || 0
        if (price > 0) {
          if (!dailyRevenue[dateStr]) {
            dailyRevenue[dateStr] = 0
          }
          dailyRevenue[dateStr] += price
        }
      })

      // Convert to HistoricalPoint format and sort by date
      const historicalData: HistoricalPoint[] = Object.entries(dailyRevenue)
        .map(([date, revenue]) => {
          const dateObj = new Date(date)
          const label = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(dateObj)
          
          return {
            day: label,
            revenue: Math.round(revenue)
          }
        })
        .sort((a, b) => {
          // Sort by actual date, not by formatted label
          const dateA = new Date(Object.keys(dailyRevenue).find(key => 
            new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(key)) === a.day
          ) || '')
          const dateB = new Date(Object.keys(dailyRevenue).find(key => 
            new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(key)) === b.day
          ) || '')
          return dateA.getTime() - dateB.getTime()
        })

      console.log('📊 Processed historical revenue:', historicalData)
      setHistoricalPrices(historicalData)
      
    } catch (err) {
      console.error('💥 Error processing historical revenue:', err)
      setHistoricalPrices([])
    }
  }

  // Function to calculate dynamic revenue based on filters and range
  const calculateDynamicRevenue = () => {
    try {
      if (supabaseData.length === 0) {
        console.log('📭 No data available for dynamic revenue calculation')
        setTodayAverageRevenue(null)
        return
      }

      let filteredData = supabaseData

      // Apply room type filter
      if (selectedRoomType !== 'all') {
        filteredData = filteredData.filter(item => 
          standardizeRoomType(item.room_type) === selectedRoomType
        )
        console.log(`🔍 Filtered by room type ${selectedRoomType}:`, filteredData.length, 'records')
      }

      // Apply date filter
      if (selectedDate) {
        filteredData = filteredData.filter(item => {
          const checkinDate = item.checkin_date || item.Checkin_date
          if (!checkinDate) return false
          
          let dateStr = checkinDate
          if (checkinDate.includes('T')) {
            dateStr = checkinDate.split('T')[0]
          }
          
          return dateStr === selectedDate
        })
        console.log(`🔍 Filtered by date ${selectedDate}:`, filteredData.length, 'records')
      }

      // Apply range filter (7d, 30d, 90d) - this affects the KPI 1
      if (range && range > 0) {
        // Use the specific date range: 2025-07-31 to 2025-10-30
        const endDate = new Date('2025-10-30')
        const rangeStart = new Date(endDate)
        rangeStart.setDate(endDate.getDate() - range)
        
        filteredData = filteredData.filter(item => {
          const checkinDate = item.checkin_date || item.Checkin_date
          if (!checkinDate) return false
          
          let dateStr = checkinDate
          if (checkinDate.includes('T')) {
            dateStr = checkinDate.split('T')[0]
          }
          
          const itemDate = new Date(dateStr)
          return itemDate >= rangeStart && itemDate <= endDate
        })
        console.log(`🔍 Filtered by range ${range}d from ${rangeStart.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}:`, filteredData.length, 'records')
      }

      // Calculate total revenue from filtered data
      const totalRevenue = filteredData.reduce((sum, item) => {
        const price = cleanPrice(item.price)
        return sum + price
      }, 0)

      setTodayAverageRevenue(totalRevenue)
      
      console.log('📊 Dynamic Revenue Calculation:')
      console.log('📊 Room Type Filter:', selectedRoomType)
      console.log('📊 Date Filter:', selectedDate || 'None')
      console.log('📊 Range Filter:', `${range}d`)
      console.log('📊 Filtered Records:', filteredData.length)
      console.log('📊 Total Revenue:', totalRevenue)
      console.log('📊 Formatted Revenue:', currency.format(totalRevenue))
      
    } catch (err) {
      console.error('💥 Error calculating dynamic revenue:', err)
      setTodayAverageRevenue(null)
    }
  }

  // Function to calculate today's total revenue from existing supabaseData
  const calculateTodayTotalRevenue = () => {
    try {
      // Test with specific date: 2025-08-02
      const today = '2025-08-02'
      
      console.log('📅 Calculating total revenue for test date:', today)
      console.log('📊 Total supabaseData records:', supabaseData.length)
      
      if (supabaseData.length === 0) {
        console.log('📭 No data available for calculation')
        setTodayAverageRevenue(null)
        return
      }
      
      // First, let's see what the data structure looks like
      console.log('🔍 Sample data record structure:', supabaseData[0])
      
      // Filter data for today only using checkin_date field
      const todayData = supabaseData.filter(item => {
        // Use the correct field name: checkin_date
        const recordDate = item.checkin_date || item.Checkin_date
        console.log('🔍 Checking record:', {
          hotel: item.hotel_name || item.nombre_hotel,
          price: item.price,
          checkin_date: item.checkin_date,
          Checkin_date: item.Checkin_date,
          recordDate: recordDate
        })
        
        if (!recordDate) {
          console.log('⚠️ Record without checkin_date found:', item)
          return false
        }
        
        // Extract date part from the record (handle both date-only and datetime formats)
        let recordDateStr = recordDate
        if (recordDate.includes('T')) {
          recordDateStr = recordDate.split('T')[0]
        }
        
        console.log('🔍 Comparing dates:', recordDateStr, 'vs', today)
        const matches = recordDateStr === today
        if (matches) {
          console.log('✅ Found matching date record for 2025-08-01:', {
            hotel: item.hotel_name || item.nombre_hotel,
            price: item.price,
            checkin_date: recordDate
          })
        }
        return matches
      })
      
      console.log('📅 Test date (2025-08-02) filtered data records:', todayData.length)
      console.log('📊 All matching records for 2025-08-02:', todayData.map(item => ({
        hotel: item.hotel_name || item.nombre_hotel,
        price: item.price,
        room_type: item.room_type,
        checkin_date: item.checkin_date || item.Checkin_date
      })))
      
      if (todayData.length === 0) {
        console.log('📭 No data found for 2025-08-02, calculating from all available data')
        // If no data for today, calculate from all available data as fallback
        const totalRevenue = supabaseData.reduce((sum, item) => {
          const price = item.price || 0
          return sum + price
        }, 0)
        
        setTodayAverageRevenue(totalRevenue)
        
        console.log('📊 Fallback: All data total revenue:', totalRevenue)
        console.log('📊 Fallback: All data record count:', supabaseData.length)
        return
      }
      
      // Calculate total revenue for today
      const totalRevenue = todayData.reduce((sum, item) => {
        const price = item.price || 0
        console.log(`💰 Adding price: ${price} from hotel: ${item.hotel_name || item.nombre_hotel}, room: ${item.room_type}`)
        return sum + price
      }, 0)
      
      setTodayAverageRevenue(totalRevenue)
      
      console.log('📊 2025-08-02 CALCULATION SUMMARY:')
      console.log('📊 Total revenue:', totalRevenue)
      console.log('📊 Number of records:', todayData.length)
      console.log('📊 Formatted total revenue:', currency.format(totalRevenue))
      
    } catch (err) {
      console.error('💥 Error calculating today average revenue:', err)
      setTodayAverageRevenue(null)
    }
  }

  // Function to fetch and process hotel_usuario data
  const fetchHotelUsuarioData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      console.log('🔍 Starting Supabase data fetch...')
      console.log('🔗 Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Configured' : 'NOT configured')
      console.log('🔑 Supabase Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Configured' : 'NOT configured')
      
      // Get current user
      const user = await getCurrentUser()
      console.log('👤 Current user:', user?.id || 'Not authenticated')
      
      let query = supabase
        .from('hotel_usuario')
        .select('*')
      
      // If user is authenticated, filter by user_id
      if (user?.id) {
        query = query.eq('user_id', user.id)
        console.log('🔒 Filtering data for user:', user.id)
      } else {
        console.warn('⚠️ User not authenticated - showing example data')
      }
      
      const { data, error } = await query
      
      console.log('📊 Supabase response:', { data, error })
      console.log('📈 Number of records obtained:', data?.length || 0)
      
      if (error) {
        console.error('❌ Supabase error:', error)
        throw error
      }
      
      if (!data || data.length === 0) {
        console.warn('⚠️ No data found in hotel_usuario table for this user')
        setSupabaseData([])
        return
      }
      
      // Extract hotel name from the first record
      if (data.length > 0 && data[0].hotel_name) {
        setUserHotelName(data[0].hotel_name)
      }
      
      // Process and clean the data
      const processedData = data.map((item: any) => ({
        ...item,
        room_type: standardizeRoomType(item.room_type),
        price: cleanPrice(item.price),
        // Keep original values for reference if needed
        original_room_type: item.room_type,
        original_price: item.price
      }))
      
      setSupabaseData(processedData)
      console.log('✅ Data processed successfully:', processedData)
      console.log('🏨 User hotel:', userHotelName)
      
      // Note: calculateTodayAverageRevenue will be called by useEffect when supabaseData changes
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('💥 Complete error:', err)
      console.error('📝 Error message:', errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Helper functions for hover handling
  const handleBarMouseEnter = (data: any, index: number) => {
    console.log('Mouse enter bar:', index, data)
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
      setHoverTimeout(null)
    }
    setHoveredIndex(index)
  }

  const handleBarMouseLeave = () => {
    console.log('Mouse leave bar')
    const timeout = setTimeout(() => {
      setHoveredIndex(null)
    }, 100) // Reduced delay for better responsiveness
    setHoveredIndex(null)
  }

  // Function to calculate category index from mouse position
  const getCategoryIndexFromMouse = (e: any, dataLength: number) => {
    console.log('getCategoryIndexFromMouse called with:', { e, dataLength })
    
    if (!e) {
      console.log('No event object')
      return null
    }
    
    if (e.chartX === undefined) {
      console.log('No chartX in event:', e)
      return null
    }
    
    const chartWidth = e.currentTarget?.clientWidth || 600
    const categoryWidth = chartWidth / dataLength
    const mouseX = e.chartX
    const categoryIndex = Math.floor(mouseX / categoryWidth)
    
    console.log('Calculated values:', { chartWidth, categoryWidth, mouseX, categoryIndex })
    
    if (categoryIndex >= 0 && categoryIndex < dataLength) {
      console.log('Valid category index:', categoryIndex)
      return categoryIndex
    }
    
    console.log('Invalid category index:', categoryIndex)
    return null
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout)
      }
    }
  }, [hoverTimeout])

  // Fetch hotel_usuario data on component mount
  useEffect(() => {
    fetchHotelUsuarioData()
  }, [])

  // Calculate dynamic revenue and process historical revenue whenever supabaseData, filters, or range change
  useEffect(() => {
    if (supabaseData.length > 0) {
      calculateDynamicRevenue()
      processHistoricalRevenue(supabaseData)
    }
  }, [supabaseData, selectedRoomType, selectedDate, range])

  const rangedData = useMemo(() => {
    const data = historicalPrices
    if (!data || data.length === 0) return []
    if (range >= data.length) return data
    return data.slice(data.length - range)
  }, [range, historicalPrices])

  const [brush, setBrush] = useState<{ start: number; end: number } | null>(null)

  useEffect(() => {
    if (rangedData && rangedData.length > 0) {
      setBrush({ start: 0, end: Math.max(0, rangedData.length - 1) })
    } else {
      setBrush(null)
    }
  }, [rangedData])

  const visibleData = useMemo(() => {
    if (!rangedData || rangedData.length === 0) return []
    if (!brush) return rangedData
    const s = Math.max(0, Math.min(brush.start, rangedData.length - 1))
    const e = Math.max(s, Math.min(brush.end, rangedData.length - 1))
    return rangedData.slice(s, e + 1)
  }, [rangedData, brush])

  const averageHistorical = useMemo(() => {
    if (!visibleData || visibleData.length === 0) return 0
    const total = visibleData.reduce((acc, p) => acc + p.revenue, 0)
    return total / Math.max(1, visibleData.length)
  }, [visibleData])

  const minVisible = useMemo(() => {
    if (!visibleData || visibleData.length === 0) return 0
    return visibleData.reduce((m, p) => Math.min(m, p.revenue), Number.POSITIVE_INFINITY)
  }, [visibleData])
  const maxVisible = useMemo(() => {
    if (!visibleData || visibleData.length === 0) return 0
    return visibleData.reduce((m, p) => Math.max(m, p.revenue), 0)
  }, [visibleData])

  const last = visibleData && visibleData.length > 0 ? visibleData[visibleData.length - 1]?.revenue ?? 0 : 0
  const prev = visibleData && visibleData.length > 1 ? visibleData[visibleData.length - 2]?.revenue ?? last : last
  const deltaPct = prev ? ((last - prev) / prev) * 100 : 0

  const demandVisible: DemandPoint[] = useMemo(
    () => visibleData && visibleData.length > 0 ? visibleData.map((p) => ({ day: p.day, requests: computeDemand(p.revenue) })) : [],
    [visibleData]
  )

  const dayIndexByLabel = useMemo(() => {
    const map: Record<string, number> = {}
    if (visibleData && visibleData.length > 0) {
      visibleData.forEach((p, i) => (map[p.day] = i))
    }
    return map
  }, [visibleData])

  // Get unique room types for filter dropdown
  const uniqueRoomTypes = useMemo(() => {
    if (!supabaseData || supabaseData.length === 0) return []
    
    const types = new Set<string>()
    supabaseData.forEach(item => {
      const roomType = standardizeRoomType(item.room_type)
      types.add(roomType)
    })
    
    return Array.from(types).sort()
  }, [supabaseData])

  // persist target range and events in URL
  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('tmn', String(Math.round(targetMin)))
    url.searchParams.set('tmx', String(Math.round(targetMax)))
    url.searchParams.set('ev', events.map(encodeURIComponent).join(','))
    window.history.replaceState({}, '', url.toString())
  }, [targetMin, targetMax, events])

  // Mini sparkline data for Total Revenue - shows revenue trend
  const sparkData = useMemo(() => {
    if (!rangedData || rangedData.length === 0) return []
    
    // Show last 14 days of revenue data
    const dataLength = Math.min(rangedData.length, 14)
    return rangedData.slice(-dataLength).map((item, i) => ({
      day: item.day,
      revenue: item.revenue
    }))
  }, [rangedData, range])

  // Mini sparkline data for Rate Position - shows trend data
  const rateSparkData = useMemo(() => {
    if (!rangedData || rangedData.length === 0) return []
    
    // Create trend data based on the selected range
    const dataLength = Math.min(rangedData.length, 14)
    return Array.from({ length: dataLength }, (_, i) => ({
      day: i.toString(),
      v: 3 + Math.sin((i / dataLength) * Math.PI * 2) * 0.5
    }))
  }, [rangedData, range])

  // Mini sparkline data for Average Gap - shows gap variation
  const gapSparkData = useMemo(() => {
    if (!rangedData || rangedData.length === 0) return []
    
    // Calculate gap data based on the selected range
    const dataLength = Math.min(rangedData.length, 14)
    const avgRevenue = rangedData.reduce((sum, item) => sum + item.revenue, 0) / rangedData.length
    
    return rangedData.slice(-dataLength).map((item, i) => ({
      day: i.toString(),
      v: Math.abs(item.revenue - avgRevenue) / 1000 // Scale down for better visualization
    }))
  }, [rangedData, range])

    const HistoricalRevenueTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length || !visibleData || visibleData.length === 0) return null
    const current = payload[0].value as number
    const idx = dayIndexByLabel[label]
    const prev = idx > 0 && visibleData[idx - 1] ? visibleData[idx - 1].revenue : undefined
    const delta = prev !== undefined ? current - prev : 0
    const deltaColor = delta > 0 ? '#ef4444' : delta < 0 ? '#10b981' : '#6b7280'
    const deltaSign = delta > 0 ? '+' : ''
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
        <div className="font-medium text-gray-900">{label}</div>
        <div className="text-gray-700">Revenue: {currency.format(current)}</div>
        {prev !== undefined && (
          <div className="text-gray-600">
            Prev: {currency.format(prev)}
            <span className="ml-2" style={{ color: deltaColor }}>
              {deltaSign}
              {currency.format(Math.abs(delta))}
            </span>
          </div>
        )}
      </div>
    )
  }

  const DemandTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length || !demandVisible || demandVisible.length === 0) return null
    const value = payload[0].value as number
    const mean = demandVisible.reduce((a, b) => a + b.requests, 0) / Math.max(1, demandVisible.length)
    const delta = value - mean
    const color = delta >= 0 ? '#10b981' : '#ef4444'
    const sign = delta > 0 ? '+' : ''
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
        <div className="text-gray-700">Requests: {numberFmt.format(value)}</div>
        <div className="text-gray-600">
          vs avg: {numberFmt.format(Math.round(mean))}
          <span className="ml-2" style={{ color }}>
            {sign}
            {numberFmt.format(Math.abs(Math.round(delta)))}
          </span>
        </div>
      </div>
    )
  }

  const RevenuePerformanceTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    const value = payload[0].value as number
    const others = revenuePerformance.filter((r) => r.hotel !== label)
    const avgOthers = others.reduce((a, b) => a + b.revenue, 0) / Math.max(1, others.length)
    const delta = value - avgOthers
    const color = delta >= 0 ? '#10b981' : '#ef4444'
    const sign = delta > 0 ? '+' : ''
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm">
        <div className="font-medium text-gray-900">{label}</div>
        <div className="text-gray-700">Revenue: {currency.format(value)}</div>
        <div className="text-gray-600">
          vs peers: {currency.format(Math.round(avgOthers))}
          <span className="ml-2" style={{ color }}>
            {sign}
            {currency.format(Math.abs(Math.round(delta)))}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Insight bar - compact, premium */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Dynamic Revenue Analysis */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3">
            <svg className="text-amber-600" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1v22M4 9l8-8 8 8"/></svg>
            <div className="flex-1">
              <p className="text-xs font-medium tracking-wide text-gray-600 mb-2">Total Revenue</p>
              
              {/* Revenue Value */}
              <p className="text-xl md:text-2xl font-semibold text-gray-900 mb-3">
                {loading ? '...' : todayAverageRevenue !== null ? currency.format(todayAverageRevenue) : '$0'}
              </p>
              
              {/* Smart Filters */}
              <div className="flex flex-wrap gap-2 mb-3">
                {/* Room Type Filter */}
                <select
                  value={selectedRoomType}
                  onChange={(e) => setSelectedRoomType(e.target.value)}
                  className="text-xs px-2 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="all">All Room Types</option>
                  {uniqueRoomTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                
                {/* HR Range Filter - Historical Revenue Range */}
                <div className="inline-flex rounded-md border border-gray-300 bg-white p-0.5 text-xs">
                  {[7, 30, 90].map((r) => (
                    <button
                      key={r}
                      onClick={() => setRange(r as 7 | 30 | 90)}
                      className={`px-2 py-1 rounded transition-colors ${
                        range === r ? 'bg-amber-600 text-white' : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {r}d
                    </button>
                  ))}
                </div>
                
                {/* Clear Filters Button */}
                {selectedRoomType !== 'all' && (
                  <button
                    onClick={() => {
                      setSelectedRoomType('all')
                    }}
                    className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
              
              {/* Context Indicator */}
              <div className="text-xs text-gray-500">
                {selectedRoomType !== 'all' && selectedDate ? (
                  <span>Revenue for {selectedRoomType} rooms on {selectedDate} (Jul 31 - Oct 30)</span>
                ) : selectedRoomType !== 'all' ? (
                  <span>Total revenue for {selectedRoomType} rooms (Jul 31 - Oct 30)</span>
                ) : selectedDate ? (
                  <span>Total revenue on {selectedDate} (Jul 31 - Oct 30)</span>
                ) : (
                  <span>Analyzing Jul 31 - Oct 30, 2025</span>
                )}
              </div>
            </div>
            
            {/* Sparkline Chart */}
            <div className="w-24 h-8">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={sparkData.length > 0 ? sparkData : [{ day: '1', revenue: 0 }]} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                  <XAxis dataKey="day" hide />
                  <YAxis hide domain={["dataMin", "dataMax"]} />
                  <Line type="monotone" dataKey="revenue" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        {/* Rate Position (Positive → Green) */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3">
            <svg className="text-emerald-600" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17l9-9M7 7h9v9"/></svg>
            <div className="flex items-baseline gap-2 flex-1">
              <div>
                <p className="text-xs font-medium tracking-wide text-gray-600">Rate Position</p>
                <p className="text-xl md:text-2xl font-semibold text-emerald-600">2°</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">Up</span>
            </div>
            <div className="w-24 h-8">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rateSparkData.length > 0 ? rateSparkData : [{ day: '1', v: 0 }]} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                  <XAxis dataKey="day" hide />
                  <YAxis hide domain={[0, 'dataMax']} />
                  <Line type="monotone" dataKey="v" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        {/* Average Gap (Negative → Red) */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3">
            <svg className="text-rose-600" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M12 3v18"/></svg>
            <div className="flex-1">
              <p className="text-xs font-medium tracking-wide text-gray-600">Average Gap</p>
              <p className="text-xl md:text-2xl font-semibold text-rose-600">$15</p>
            </div>
            <div className="w-24 h-8">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={gapSparkData.length > 0 ? gapSparkData : [{ day: '1', v: 0 }]} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                  <XAxis dataKey="day" hide />
                  <YAxis hide domain={[0, 'dataMax']} />
                  <Line type="monotone" dataKey="v" stroke="#ef4444" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Historical Prices */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {userHotelName ? `${userHotelName} - Historical Revenue` : 'Historical Revenue'}
                {loading && <span className="text-sm text-gray-500 ml-2">(Loading...)</span>}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {error && (
                <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                  {error}
                </span>
              )}
              {!loading && !error && historicalPrices.length === 0 && (
                <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                  No data
                </span>
              )}
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={(() => {
                // If no data from Supabase, show mock data for specific date range: 2025-07-31 to 2025-10-30
                if (historicalPrices.length === 0) {
                  const startDate = new Date('2025-07-31')
                  const endDate = new Date('2025-10-30')
                  const mockData: HistoricalPoint[] = []
                  
                  // Generate data for each day in the range
                  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                    const dayIndex = Math.floor((d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
                    const label = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d)
                    
                    // Create realistic revenue patterns with seasonal variations
                    const baseRevenue = 1200 // Base revenue
                    const seasonalFactor = 1 + 0.3 * Math.sin((dayIndex / 90) * Math.PI * 2) // Seasonal variation
                    const weeklyFactor = 1 + 0.2 * Math.sin((dayIndex / 7) * Math.PI * 2) // Weekly patterns
                    const noise = (Math.random() - 0.5) * 0.1 // Small random variation
                    
                    const revenue = Math.round(baseRevenue * seasonalFactor * weeklyFactor * (1 + noise))
                    mockData.push({ day: label, revenue: Math.max(800, revenue) })
                  }
                  
                  return mockData
                }
                return visibleData
              })()} margin={{ top: 8, right: 80, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.6} />
                <XAxis dataKey="day" stroke="#6b7280" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis stroke="#6b7280" tickLine={false} axisLine={false} tickMargin={8} />
                <Tooltip content={<HistoricalRevenueTooltip />} />
                {/* Target band */}
                <ReferenceArea y1={targetMin} y2={targetMax} fill="#10b981" fillOpacity={0.08} stroke="#10b981" strokeOpacity={0.15} />
                <ReferenceLine
                  y={averageHistorical}
                  stroke="#94a3b8"
                  strokeDasharray="6 6"
                  label={{ 
                    value: `Avg ${currency.format(averageHistorical)}`, 
                    position: 'right', 
                    fill: '#64748b', 
                    fontSize: 10
                  }}
                />

                <Area type="monotone" dataKey="revenue" stroke="#ef4444" fill="url(#priceArea)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hotel Data - Room Types by Price */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {userHotelName ? `${userHotelName} - Revenue by Room Type` : 'Revenue by Room Type'}
                {loading && <span className="text-sm text-gray-500 ml-2">(Loading...)</span>}
              </h3>

            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchHotelUsuarioData}
                disabled={loading}
                className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
              {error && (
                <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                  {error}
                </span>
              )}
              {!loading && (
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                  {(() => {
                    // Calculate filtered records count
                    let filteredData = supabaseData
                    
                    if (selectedRoomType !== 'all') {
                      filteredData = filteredData.filter(item => 
                        standardizeRoomType(item.room_type) === selectedRoomType
                      )
                    }
                    
                    if (range && range > 0) {
                      const endDate = new Date('2025-10-30')
                      const rangeStart = new Date(endDate)
                      rangeStart.setDate(endDate.getDate() - range)
                      
                      filteredData = filteredData.filter(item => {
                        const checkinDate = item.checkin_date || item.Checkin_date
                        if (!checkinDate) return false
                        
                        let dateStr = checkinDate
                        if (checkinDate.includes('T')) {
                          dateStr = checkinDate.split('T')[0]
                        }
                        
                        const itemDate = new Date(dateStr)
                        return itemDate >= rangeStart && itemDate <= endDate
                      })
                    }
                    
                    return `${filteredData.length} filtered / ${supabaseData.length} total`
                  })()}
                </span>
              )}
              {!loading && !error && supabaseData.length === 0 && (
                <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded">
                  No data
                </span>
              )}
            </div>
          </div>
          

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart 
                data={(() => {
                  // If no data from Supabase, show mock data to test the chart (sorted by revenue)
                  if (supabaseData.length === 0) {
                    return [
                      { room_type: 'Suite', total_revenue: 3237422, avg_price: 2200, count: 2 },
                      { room_type: 'Queen', total_revenue: 1530836, avg_price: 1500, count: 3 },
                      { room_type: 'Standard', total_revenue: 497153, avg_price: 1200, count: 5 },
                      { room_type: 'Business', total_revenue: 329344, avg_price: 1800, count: 4 },
                    ]
                  }
                  
                  // Apply filters to the data
                  let filteredData = supabaseData
                  
                  // Apply room type filter
                  if (selectedRoomType !== 'all') {
                    filteredData = filteredData.filter(item => 
                      standardizeRoomType(item.room_type) === selectedRoomType
                    )
                  }
                  
                  // Apply range filter (7d, 30d, 90d)
                  if (range && range > 0) {
                    const endDate = new Date('2025-10-30')
                    const rangeStart = new Date(endDate)
                    rangeStart.setDate(endDate.getDate() - range)
                    
                    filteredData = filteredData.filter(item => {
                      const checkinDate = item.checkin_date || item.Checkin_date
                      if (!checkinDate) return false
                      
                      let dateStr = checkinDate
                      if (checkinDate.includes('T')) {
                        dateStr = checkinDate.split('T')[0]
                      }
                      
                      const itemDate = new Date(dateStr)
                      return itemDate >= rangeStart && itemDate <= endDate
                    })
                  }
                  
                  // Aggregate filtered data by room type with total revenue
                  const roomTypeData = filteredData.reduce((acc: any, item: any) => {
                    const roomType = standardizeRoomType(item.room_type) || 'Standard'
                    if (!acc[roomType]) {
                      acc[roomType] = { room_type: roomType, total_revenue: 0, count: 0 }
                    }
                    acc[roomType].total_revenue += item.price || 0
                    acc[roomType].count += 1
                    return acc
                  }, {})
                  
                  const aggregatedData = Object.values(roomTypeData).map((item: any) => ({
                    room_type: item.room_type,
                    total_revenue: item.total_revenue,
                    avg_price: Math.round(item.total_revenue / item.count),
                    count: item.count
                  }))
                  
                  // Sort by total_revenue from highest to lowest
                  const sortedData = aggregatedData.sort((a: any, b: any) => b.total_revenue - a.total_revenue)
                  
                  // Log the aggregated data for debugging
                  console.log('Sorted chart data (highest to lowest):', sortedData)
                  
                  return sortedData
                })()} 
                margin={{ top: 20, right: 12, left: 4, bottom: 8 }}
                barCategoryGap="15%"
                maxBarSize={100}

                onMouseLeave={() => {
                  console.log('Mouse left chart area - resetting hoveredIndex')
                  setHoveredIndex(null)
                }}

              >
                <defs>
                  <linearGradient id="hotelBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor="#3b82f6" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#93c5fd" stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient id="grayBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor="#9ca3af" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#d1d5db" stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient id="hoverBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor="#3b82f6" stopOpacity={1} />
                    <stop offset="100%" stopColor="#93c5fd" stopOpacity={0.9} />
                  </linearGradient>
                  {/* Shadow filter for bars */}
                  <filter id="barShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="4" stdDeviation="6" floodOpacity="0.1" floodColor="#000000"/>
                  </filter>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.6} />
                <XAxis 
                  dataKey="room_type"
                  stroke="#6b7280" 
                  tickLine={false} 
                  axisLine={false} 
                  tickMargin={8}
                />
                <YAxis 
                  stroke="#6b7280" 
                  tickLine={false} 
                  axisLine={false} 
                  tickMargin={8}
                  tickFormatter={(value) => {
                    // Format large numbers as K, M for better readability
                    if (value >= 1000000) {
                      return `$${(value / 1000000).toFixed(1)}M`
                    } else if (value >= 1000) {
                      return `$${(value / 1000).toFixed(0)}K`
                    } else {
                      return `$${value}`
                    }
                  }}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => [
                    name === 'total_revenue' ? currency.format(value) : (name === 'avg_price' ? currency.format(value) : value),
                    name === 'total_revenue' ? 'Total Revenue' : (name === 'avg_price' ? 'Average Price' : 'Count')
                  ]}
                  labelFormatter={(label: string) => `Room Type: ${label}`}
                  cursor={false}
                />
                <Bar 
                  dataKey="total_revenue"
                  radius={[8, 8, 0, 0]}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={(data: any, index: number) => {
                    console.log('Bar mouse enter:', index, data)
                    setHoveredIndex(index)
                  }}
                  onMouseLeave={() => {
                    console.log('Bar mouse leave')
                    setHoveredIndex(null)
                  }}
                >
                  {(() => {
                    const chartData = supabaseData.length === 0 ? [
                      { room_type: 'Suite', total_revenue: 3237422, avg_price: 2200, count: 2 },
                      { room_type: 'Queen', total_revenue: 1530836, avg_price: 1500, count: 3 },
                      { room_type: 'Standard', total_revenue: 497153, avg_price: 1200, count: 5 },
                      { room_type: 'Business', total_revenue: 329344, avg_price: 1800, count: 4 },
                    ] : Object.values(supabaseData.reduce((acc: any, item: any) => {
                      const roomType = item.room_type || 'Standard'
                      if (!acc[roomType]) {
                        acc[roomType] = { room_type: roomType, total_revenue: 0, count: 0 }
                      }
                      acc[roomType].total_revenue += item.price || 0
                      acc[roomType].count += 1
                      return acc
                    }, {})).map((item: any) => ({
                      room_type: item.room_type,
                      total_revenue: item.total_revenue,
                      avg_price: Math.round(item.total_revenue / item.count),
                      count: item.count
                    })).sort((a: any, b: any) => b.total_revenue - a.total_revenue)
                    
                    const maxRevenue = Math.max(...chartData.map((item: any) => item.total_revenue))
                    
                    return chartData.map((entry: any, index: number) => {
                      let fillColor
                      
                      console.log(`Rendering bar ${index} (${entry.room_type}) - hoveredIndex: ${hoveredIndex}`)
                      
                      if (hoveredIndex !== null) {
                        if (index === hoveredIndex) {
                          // Hovered bar gets bright color
                          fillColor = 'url(#hoverBarGradient)'
                          console.log(`Bar ${index} (${entry.room_type}) is hovered - using hover color`)
                        } else {
                          // Other bars get gray
                          fillColor = 'url(#grayBarGradient)'
                          console.log(`Bar ${index} (${entry.room_type}) is not hovered - using gray color`)
                        }
                      } else {
                        // When not hovering, only the highest bar gets color
                        fillColor = entry.total_revenue === maxRevenue ? 'url(#hotelBarGradient)' : 'url(#grayBarGradient)'
                        console.log(`Bar ${index} (${entry.room_type}) - no hover, using ${entry.total_revenue === maxRevenue ? 'blue' : 'gray'} color`)
                      }
                      
                      return (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={fillColor}
                          filter="url(#barShadow)"
                        />
                      )
                    })
                  })()}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue Performance */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Revenue Performance</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenuePerformance} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGray" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor="#e5e7eb" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#cbd5e1" stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient id="revRed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor="#ef4444" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#fca5a5" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="hotel" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip content={<RevenuePerformanceTooltip />} />
                <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                  {revenuePerformance.map((d) => (
                    <Cell key={d.hotel} fill={d.hotel === 'Ours' ? 'url(#revRed)' : 'url(#revGray)'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Competitive Gap Analysis */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Competitive Gap Analysis</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={gapSeries} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorOurs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor="#ef4444" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip wrapperClassName="!rounded-lg !border !border-gray-200 !bg-white" formatter={(v: number, name: string) => [currency.format(v), name]} />
                <Legend onClick={(e: any) => {
                  if (e.dataKey === 'ours') setShowOurs((s) => !s)
                  if (e.dataKey === 'marketAvg') setShowMarket((s) => !s)
                }} />
                {showMarket && <Line type="monotone" dataKey="marketAvg" name="marketAvg" stroke="#94a3b8" strokeDasharray="6 6" strokeWidth={2} dot={false} />}
                {showOurs && <Area type="monotone" dataKey="ours" name="ours" stroke="#ef4444" fill="url(#colorOurs)" strokeWidth={3} />}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  )
}



