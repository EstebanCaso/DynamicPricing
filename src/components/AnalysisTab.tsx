"use client";

import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  Cell,
  PieChart,
  Pie,
  PieLabelRenderProps,
} from "recharts";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { 
  standardizeRoomType,
  fetchUserHotelData,
  logDataFlow,
  cleanPrice,
  type Currency,
  type ProcessedHotelData 
} from "@/lib/dataUtils";
import { useCurrencyConversion } from "@/hooks/useCurrencyConversion";
import { useRevenueAnalysis } from "@/hooks/useRevenueAnalysis";
import { useHistoricalData } from "@/hooks/useHistoricalData";
import { runCompleteTestSuite, type AnalyticsTestSuite } from "@/lib/analyticsTestSuite";

import AnalysisControls from "./AnalysisControls";
import MarketPositionCard from "./MarketPositionCard";

interface CustomPieLabelProps extends PieLabelRenderProps {
  payload?: {
    room_type: string;
  };
}

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = (props: CustomPieLabelProps) => {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent, index, payload } = props;

  if (midAngle === undefined || innerRadius === undefined || outerRadius === undefined || percent === undefined || !payload) {
    return null;
  }

  // Type guard for cx and cy to ensure they are numbers
  if (typeof cx !== 'number' || typeof cy !== 'number') {
    return null;
  }
  
  const sin = Math.sin(-midAngle * RADIAN);
  const cos = Math.cos(-midAngle * RADIAN);
  const sx = Number(cx) + (Number(outerRadius) + 10) * cos;
  const sy = Number(cy) + (Number(outerRadius) + 10) * sin;
  const mx = Number(cx) + (Number(outerRadius) + 30) * cos;
  const my = Number(cy) + (Number(outerRadius) + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke="#999" fill="none" />
      <circle cx={ex} cy={ey} r={2} fill="#999" stroke="none" />
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#333" className="text-sm font-medium">
        {payload.room_type}
      </text>
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={16} textAnchor={textAnchor} fill="#666" className="text-xs">
        {`(${(percent * 100).toFixed(0)}%)`}
      </text>
    </g>
  );
};

type HistoricalPoint = {
  day: string;
  revenue: number;
};

type RevenuePoint = {
  hotel: string;
  revenue: number;
  avgPrice?: number;
  color?: string;
};



export default function AnalysisTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>("MXN");
  
  // Use custom hooks for better organization
  const {
    exchangeRate,
    isLoadingRate,
    lastRateFetch,
    convertPriceToSelectedCurrency,
    currency,
    numberFmt,
    fetchExchangeRate
  } = useCurrencyConversion(selectedCurrency);

  // Helper function to get just the numeric value using dataUtils
  const getPriceValue = useCallback((priceString: string | number): number => {
    return cleanPrice(priceString).value;
  }, []);

  const [range, setRange] = useState<1 | 7 | 30 | 90>(30);
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().split('T')[0]);

  // Supabase data states
  const [supabaseData, setSupabaseData] = useState<ProcessedHotelData[]>([]);
  const [loading, setLoading] = useState(true); // Changed to true initially
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userHotelName, setUserHotelName] = useState<string>("");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const [todayAverageRevenue, setTodayAverageRevenue] = useState<number | null>(null);
  const [revenuePerformanceData, setRevenuePerformanceData] = useState<RevenuePoint[]>([]);
  const [competitorData, setCompetitorData] = useState<any[]>([]);
  const [testResults, setTestResults] = useState<AnalyticsTestSuite | null>(null);
  
  // Zoom state for charts
  const [chartZoom, setChartZoom] = useState<{ x: number; y: number; scale: number }>({ x: 0, y: 0, scale: 1 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  
  // Animation states
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [lastFilterChange, setLastFilterChange] = useState<number>(Date.now());

  // Filter states for dynamic revenue analysis
  const [selectedRoomType, setSelectedRoomType] = useState<string>("all");
  const [clickedRoomType, setClickedRoomType] = useState<string | null>(null);

  const [targetMin, setTargetMin] = useState<number>(() => Number(searchParams.get("tmn")) || 95);
  const [targetMax, setTargetMax] = useState<number>(() => Number(searchParams.get("tmx")) || 115);
  const [events, setEvents] = useState<string[]>(() => {
    const raw = searchParams.get("ev");
    if (!raw) return ["Aug 7", "Aug 9"];
    return raw.split(",").map((s) => decodeURIComponent(s.trim())).filter(Boolean);
  });

  // Use custom hooks for better organization
  const {
    filteredSupabaseData,
    avgFilteredPrice,
    priceStats,
    revenueByRoomTypeData,
    uniqueRoomTypes
  } = useRevenueAnalysis({
    supabaseData,
    selectedRoomType,
    clickedRoomType,
    range,
    selectedCurrency,
    convertPriceToSelectedCurrency
  });

  const {
    historicalPrices,
    rangedData,
    brush,
    setBrush,
    visibleData,
    averageHistorical,
    sparkData,
    processHistoricalRevenue,
    calculateDynamicRevenue
  } = useHistoricalData({
    supabaseData,
    selectedRoomType,
    clickedRoomType,
    range,
    convertPriceToSelectedCurrency
  });

  // Using unified standardizeRoomType function from dataUtils

  // Function to get current user
  const getCurrentUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Error getting user:", error);
        return null;
      }
      setCurrentUser(user);
      return user;
    } catch (err) {
      console.error("Error in getCurrentUser:", err);
      return null;
    }
  };

  // Function to fetch and process hotel_usuario data using unified functions
  const fetchHotelUsuarioData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🚀 Starting data validation process...');

      const user = await getCurrentUser();

      if (!user?.id) {
        console.error('❌ Data Validation Failed: No authenticated user');
        throw new Error('User not authenticated');
      }

      console.log(`✅ User authenticated: ${user.id}`);
      logDataFlow('AnalysisTab', { userId: user.id }, 'Fetching user hotel data');

      // Use unified data fetching function
      const processedData = await fetchUserHotelData(user.id);

      console.log(`📊 Data Validation Results:`);
      console.log(`   - Records found: ${processedData.length}`);

      if (processedData.length === 0) {
        console.log('ℹ️ No hotel data found for user');
        console.log('💡 Suggestion: Check if user has data in hotel_usuario table');
        setSupabaseData([]);
        return;
      }

      // Validate data quality
      const validRecords = processedData.filter(item => 
        item.hotel_name && 
        item.checkin_date && 
        item.processed_price > 0
      );

      console.log(`   - Valid records: ${validRecords.length}/${processedData.length}`);
      console.log(`   - Hotel name: ${processedData[0]?.hotel_name || 'Not set'}`);
      console.log(`   - Date range: ${processedData[0]?.checkin_date} to ${processedData[processedData.length - 1]?.checkin_date}`);
      console.log(`   - Price range: $${Math.min(...processedData.map(p => p.processed_price))} - $${Math.max(...processedData.map(p => p.processed_price))}`);

      if (validRecords.length !== processedData.length) {
        console.log(`ℹ️ Data Quality Note: ${processedData.length - validRecords.length} records have missing/invalid data`);
      }

      // Set user hotel name from the first hotel
      if (processedData.length > 0 && processedData[0].hotel_name) {
        setUserHotelName(processedData[0].hotel_name);
        console.log(`✅ Hotel name set: ${processedData[0].hotel_name}`);
      }

      logDataFlow('AnalysisTab', { 
        count: processedData.length, 
        validCount: validRecords.length,
        hotelName: processedData[0]?.hotel_name,
        samplePrice: processedData[0]?.processed_price 
      }, 'Processed user hotel data');

      setSupabaseData(processedData);
      console.log('✅ User hotel data loaded successfully');
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      console.error('❌ Data Validation Failed:', err);
      console.log('🔧 Troubleshooting suggestions:');
      console.log('   1. Check if user is authenticated');
      console.log('   2. Verify hotel_usuario table has data for this user');
      console.log('   3. Check database connection');
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch competitor data and calculate revenue performance
  const fetchCompetitorData = async () => {
    try {
      console.log('🏨 Starting competitor data validation...');
      
      const user = await getCurrentUser();
      if (!user) {
        console.log('ℹ️ Cannot fetch competitor data: No authenticated user');
        return;
      }

      // Get user's city from their hotel data - note: ciudad is not in ProcessedHotelData
      // We'll need to get this from user metadata instead
      const userHotel = supabaseData[0]; // Just use first hotel for now
      if (!userHotel) {
        console.log('ℹ️ Cannot fetch competitor data: No user hotel data available');
        return;
      }

      console.log(`🔍 Looking for competitors for hotel: ${userHotel.hotel_name}`);

      // Query the correct table: hoteles_parallel
      let competitors = null;
      
      try {
        const { data: hotelesData, error } = await supabase
          .from('hoteles_parallel')
          .select('*')
          .limit(50); // Increased limit to get more data
        
        if (error) throw error;
        
        console.log(`📊 Competitor Data Validation:`);
        console.log(`   - Total records in hoteles_parallel: ${hotelesData?.length || 0}`);
        
        if (hotelesData && hotelesData.length > 0) {
          // Filter by city in memory (Tijuana is the main city in your data)
          competitors = hotelesData.filter(hotel => 
            hotel.ciudad && hotel.ciudad.toLowerCase().includes('tijuana')
          );
          
          console.log(`   - Competitors in Tijuana: ${competitors.length}`);
          console.log(`   - Sample competitor: ${competitors[0]?.nombre || 'None'}`);
          
          // Validate competitor data quality
          const competitorsWithRooms = competitors.filter(comp => 
            comp.rooms_jsonb && typeof comp.rooms_jsonb === 'object'
          );
          console.log(`   - Competitors with room data: ${competitorsWithRooms.length}/${competitors.length}`);
          
          if (competitorsWithRooms.length === 0) {
            console.log('ℹ️ Data Quality Note: No competitors have room pricing data');
          }
        } else {
          console.log('ℹ️ No competitor data found in hoteles_parallel table');
        }
      } catch (e) {
        console.error('❌ Error fetching competitor data:', e);
        console.log('🔧 Troubleshooting suggestions:');
        console.log('   1. Check if hoteles_parallel table exists');
        console.log('   2. Verify table has data for Tijuana');
        console.log('   3. Check database permissions');
        return;
      }
      
      if (!competitors || competitors.length === 0) {
        console.log('No competitors found in hoteles_parallel');
        return;
      }

        setCompetitorData(competitors);
        
      // Calculate average price performance metrics from rooms_jsonb data
        const performanceData: RevenuePoint[] = [];
        
        // Build current date range (normalized to 00:00)
        const today = new Date();
        const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const rangeStart = new Date(endDate);
        rangeStart.setDate(endDate.getDate() - (range - 1));

        // Add user's hotel performance using filteredSupabaseData (respects filters)
        if (filteredSupabaseData && filteredSupabaseData.length > 0) {
          const converted = filteredSupabaseData
            .map((item: any) => convertPriceToSelectedCurrency(item.processed_price, item.processed_currency))
            .filter((v: number) => v > 0);
          const userHotelAvgPrice = converted.length > 0 ? (converted.reduce((a: number, b: number) => a + b, 0) / converted.length) : 0;
          performanceData.push({
            hotel: userHotel.hotel_name || "Our Hotel",
            revenue: userHotelAvgPrice, // Using revenue field for avg price to maintain compatibility
            color: "#ff0000"
          });
        }
        
        // Add competitor performance
      competitors.forEach((competitor: any) => {
        if (competitor.rooms_jsonb && typeof competitor.rooms_jsonb === 'object') {
          const competitorAvgPrice = calculateHotelRevenueFromJsonb(competitor.rooms_jsonb, rangeStart, endDate);
          if (competitorAvgPrice > 0) {
                performanceData.push({
              hotel: competitor.nombre || "Unknown Hotel",
              revenue: competitorAvgPrice, // Using revenue field for avg price to maintain compatibility
              color: "#94a3b8"
            });
          }
        }
      });

      // Sort by average price ascending (lowest price first) to match Summary Tab logic
      performanceData.sort((a, b) => a.revenue - b.revenue);
      
      setRevenuePerformanceData(performanceData);
      console.log(`✅ Calculated average price performance for ${performanceData.length} hotels`);
      
      // Final validation summary
      console.log('🎯 Competitor Data Validation Summary:');
      console.log(`   - Competitors loaded: ${competitors.length}`);
      console.log(`   - Performance data points: ${performanceData.length}`);
      console.log(`   - User hotel included: ${performanceData.some(p => p.hotel.includes(userHotel.hotel_name))}`);
      
    } catch (err) {
      console.error('❌ Competitor data validation failed:', err);
      console.log('🔧 This will affect Market Position and radar charts');
    }
  };

  // Helper function to calculate average price from rooms_jsonb data with optional date filtering
  const calculateHotelRevenueFromJsonb = (roomsJsonb: any, rangeStart?: Date, endDate?: Date): number => {
    let totalRevenue = 0;
    let roomCount = 0;
    
    if (roomsJsonb && typeof roomsJsonb === 'object') {
      Object.entries(roomsJsonb).forEach(([date, rooms]: [string, any]) => {
        // Apply date filter if provided
        if (rangeStart && endDate) {
          const d = new Date(date);
          if (d < rangeStart || d > endDate) return;
        }
        if (Array.isArray(rooms)) {
          rooms.forEach((room: any) => {
            if (room.price) {
              const price = getPriceValue(room.price);
              if (price > 0) {
                totalRevenue += convertPriceToSelectedCurrency(price, 'MXN');
                roomCount++;
              }
            }
          });
        }
      });
    }
    
    // Return average revenue per room instead of total
    return roomCount > 0 ? totalRevenue / roomCount : 0;
  };

  // Helper function to calculate average hotel revenue per room from processed data array
  const calculateHotelRevenue = (hotelData: any[]): number => {
    const totalRevenue = hotelData.reduce((sum, item) => {
      const price = getPriceValue(item.price);
      return sum + (price > 0 ? price : 0);
    }, 0);
    
    // Return average revenue per room instead of total
    return hotelData.length > 0 ? totalRevenue / hotelData.length : 0;
  };

  // Function to handle bar clicks for filtering with enhanced feedback
  const handleBarClick = (data: any, index: number) => {
    const roomType = data.room_type;
            console.log(`🎯 Drill-down: Clicked on ${roomType} (Revenue: ${currency ? currency().format(data.total_revenue) : `$${data.total_revenue}`})`);
    
    // Start transition animation
    setIsTransitioning(true);
    setLastFilterChange(Date.now());
    
    if (clickedRoomType === roomType) {
      setClickedRoomType(null);
      console.log('🔄 Reset filter - showing all room types');
    } else {
      setClickedRoomType(roomType);
      console.log(`📊 Filtered to ${roomType} - updating all charts`);
    }
    
    // Add visual feedback with a subtle animation
    const pieChart = document.querySelector('.recharts-pie');
    if (pieChart) {
      pieChart.classList.add('animate-pulse');
      setTimeout(() => pieChart.classList.remove('animate-pulse'), 600);
    }
    
    // End transition after animation completes
    setTimeout(() => setIsTransitioning(false), 800);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
    };
  }, [hoverTimeout]);

  // Fetch hotel_usuario data on component mount
  useEffect(() => {
    fetchHotelUsuarioData();
  }, []);

  // Fetch competitor data when user data, filters, or currency change
  useEffect(() => {
    if (supabaseData.length > 0 && userHotelName) {
      fetchCompetitorData();
    }
  }, [supabaseData, userHotelName, selectedCurrency, selectedRoomType, clickedRoomType, range]);



  // Calculate dynamic revenue and process historical revenue whenever supabaseData, filters, currency, or range change
  useEffect(() => {
    if (supabaseData.length > 0) {
      const avgRevenue = calculateDynamicRevenue();
      setTodayAverageRevenue(avgRevenue);
      processHistoricalRevenue(supabaseData);
    }
  }, [supabaseData, selectedRoomType, range, clickedRoomType, selectedCurrency, calculateDynamicRevenue, processHistoricalRevenue]);







  // persist target range and events in URL
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tmn", String(Math.round(targetMin)));
    url.searchParams.set("tmx", String(Math.round(targetMax)));
    url.searchParams.set("ev", events.map(encodeURIComponent).join(","));
    window.history.replaceState({}, "", url.toString());
  }, [targetMin, targetMax, events]);



  // Mini sparkline data for Rate Position - shows trend data
  const rateSparkData = useMemo(() => {
    if (!rangedData || rangedData.length === 0) return [];
    const dataLength = Math.min(rangedData.length, 14);
    return Array.from({ length: dataLength }, (_, i) => ({
      day: i.toString(),
      v: 3 + Math.sin((i / dataLength) * Math.PI * 2) * 0.5,
    }));
  }, [rangedData, range]);

  // Derived selections and memoized computations to avoid repeated work in render
  const effectiveRoomType = useMemo(() => (clickedRoomType || selectedRoomType), [clickedRoomType, selectedRoomType]);

  const dateRange = useMemo(() => {
    if (!range || range <= 0) return null as null | { rangeStart: Date; endDate: Date };
    const today = new Date();
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const rangeStart = new Date(endDate);
    rangeStart.setDate(endDate.getDate() - (range - 1));
    return { rangeStart, endDate };
  }, [range]);







  // Calculate historical price series with currency conversion
  const historicalPriceSeries = useMemo(() => {
    console.log(`🔄 Recalculating Historical Prices in ${selectedCurrency}...`);
    console.log(`📈 Historical Data Validation:`);
    console.log(`   - Raw data points: ${supabaseData.length}`);
    
    if (supabaseData.length === 0) {
      console.log('ℹ️ No historical data available for chart');
      return [];
    }

                    let filteredData = supabaseData;
                const effectiveRoomType = clickedRoomType || selectedRoomType;
    
                if (effectiveRoomType !== "all") {
                  filteredData = filteredData.filter((item) => 
                    standardizeRoomType(item.room_type) === effectiveRoomType
                  );
                }
                
                if (range && range > 0) {
                  const today = new Date();
                  const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                  const rangeStart = new Date(endDate);
                  rangeStart.setDate(endDate.getDate() - (range - 1));
                  filteredData = filteredData.filter((item) => {
                        const checkinDate = item.checkin_date;
                    if (!checkinDate) return false;
                    let dateStr = checkinDate;
                    if (checkinDate.includes("T")) {
                      dateStr = checkinDate.split("T")[0];
                    }
                    const itemDate = new Date(dateStr);
                    return itemDate >= rangeStart && itemDate <= endDate;
                  });
                }
                
    // Group by date and calculate average price in selected currency
                const dailyPrices: Record<string, { total: number; count: number; dates: string[]; roomTypes: Set<string> }> = {};
                
                          filteredData.forEach((item) => {
        const checkinDate = item.checkin_date;
      if (!checkinDate) {
        console.log('ℹ️ Item with no checkin_date:', item);
        return;
      }
                  
                  let dateStr = checkinDate;
                  if (checkinDate.includes("T")) {
                    dateStr = checkinDate.split("T")[0];
                  }
                  
        // Always convert in real-time based on current currency selection
        const price = convertPriceToSelectedCurrency(item.processed_price, item.processed_currency);
                  
                      if (price > 0) {
                    if (!dailyPrices[dateStr]) {
                      dailyPrices[dateStr] = { 
                        total: 0, 
                        count: 0, 
                        dates: [], 
                        roomTypes: new Set() 
                      };
                    }
                        dailyPrices[dateStr].total += price;
                    dailyPrices[dateStr].count += 1;
                    dailyPrices[dateStr].dates.push(dateStr);
                    dailyPrices[dateStr].roomTypes.add(standardizeRoomType(item.room_type));
                  }
                });

    if (Object.keys(dailyPrices).length === 0) return [];
                
                // Convert to chart format and sort by date
    const result = Object.entries(dailyPrices)
                  .map(([date, data]) => {
                    const dateObj = new Date(date);
                    const label = new Intl.DateTimeFormat("en-US", {
                      month: "short",
                      day: "numeric",
                    }).format(dateObj);
        
        const avgPrice = Math.round(data.total / data.count * 100) / 100;
                    
                    return {
                      day: label,
                      date: date,
                          price: avgPrice, // Already converted to selected currency
          marketEstimate: Math.round(avgPrice * 1.1 * 100) / 100, // Market estimate
                      count: data.count,
                      roomTypes: Array.from(data.roomTypes),
                      totalPrice: data.total
                    };
                  })
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                
    console.log(`📈 Historical Prices (${selectedCurrency}):`, result.slice(0, 3).map(item => ({
      day: item.day,
      price: item.price,
      count: item.count
    })));
    console.log(`📈 Total result length:`, result.length);
    console.log(`📈 Daily prices keys:`, Object.keys(dailyPrices));
    
    // Final historical data validation
    console.log(`✅ Historical Data Summary:`);
    console.log(`   - Filtered data points: ${filteredData.length}`);
    console.log(`   - Date groups created: ${Object.keys(dailyPrices).length}`);
    console.log(`   - Chart data points: ${result.length}`);
    console.log(`   - Room type filter: ${effectiveRoomType}`);
    console.log(`   - Date range: ${range} days`);
    
    if (result.length === 0) {
      console.log('ℹ️ No chart data generated - check filters and date range');
    }
    
    return result;
  }, [supabaseData, clickedRoomType, selectedRoomType, range, convertPriceToSelectedCurrency, selectedCurrency]);

  // Update selectedMonth when historicalPriceSeries changes
  useEffect(() => {
    if (historicalPriceSeries && historicalPriceSeries.length > 0) {
      const uniqueDates = Array.from(new Set(historicalPriceSeries.map(item => {
        // Handle both date formats
        let dateStr = item.date;
        if (dateStr.includes('T')) {
          dateStr = dateStr.split('T')[0];
        }
        return dateStr;
      }))).sort();
      
      if (uniqueDates.length > 0) {
        console.log(`📅 Setting selectedMonth from data. Available dates:`, uniqueDates.slice(0, 5));
        const firstDate = new Date(uniqueDates[0]);
        const newSelectedMonth = `${firstDate.getFullYear()}-${(firstDate.getMonth() + 1).toString().padStart(2, '0')}-01`;
        console.log(`📅 Setting selectedMonth to:`, newSelectedMonth);
        setSelectedMonth(newSelectedMonth);
      }
    }
  }, [historicalPriceSeries]);

  // Debug log for Price Evolution Chart
  useEffect(() => {
    console.log('🎯 Price Evolution Chart Debug:');
    console.log('   - Data points:', historicalPriceSeries.length);
    console.log('   - Sample data:', historicalPriceSeries.slice(0, 3));
    console.log('   - Loading state:', loading);
  }, [historicalPriceSeries, loading]);

  const ourHotelEntry = useMemo(() => {
    return revenuePerformanceData.find((item) => item.hotel === userHotelName || item.hotel === "Our Hotel");
  }, [revenuePerformanceData, userHotelName]);

  const competitorsOnly = useMemo(() => {
    return revenuePerformanceData.filter((item) => item.hotel !== userHotelName && item.hotel !== "Our Hotel");
  }, [revenuePerformanceData, userHotelName]);



  const marketAvg = useMemo(() => {
    if (!competitorsOnly || competitorsOnly.length === 0) return 0;
    return competitorsOnly.reduce((sum, item) => sum + (item.revenue || 0), 0) / competitorsOnly.length;
  }, [competitorsOnly]);

  const performanceDeltaPerc = useMemo(() => {
    if (!ourHotelEntry || !marketAvg) return null as number | null;
    const delta = ourHotelEntry.revenue - marketAvg;
    return (delta / marketAvg) * 100;
  }, [ourHotelEntry, marketAvg]);

  const monthlyStats = useMemo(() => {
    if (!historicalPriceSeries || historicalPriceSeries.length === 0) return null;

    const [year, monthNum] = selectedMonth.split('-').map(Number);
    const monthIndex = monthNum - 1;

    const monthData = historicalPriceSeries.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate.getFullYear() === year && itemDate.getMonth() === monthIndex;
    });

    if (monthData.length === 0) return null;

    const prices = monthData.map(d => d.price);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    
    const mostExpensive = monthData.reduce((max, item) => item.price > max.price ? item : max, monthData[0]);
    const leastExpensive = monthData.reduce((min, item) => item.price < min.price ? item : min, monthData[0]);
    const priceRange = mostExpensive.price - leastExpensive.price;

    const weekdays = monthData.filter(item => {
        const day = new Date(item.date).getDay();
        return day > 0 && day < 6;
    });
    const weekends = monthData.filter(item => {
        const day = new Date(item.date).getDay();
        return day === 0 || day === 6;
    });

    const weekdayAvg = weekdays.length > 0 ? weekdays.reduce((sum, item) => sum + item.price, 0) / weekdays.length : 0;
    const weekendAvg = weekends.length > 0 ? weekends.reduce((sum, item) => sum + item.price, 0) / weekends.length : 0;
    
    let weekendVsWeekdayDiff = 0;
    if (weekdayAvg > 0 && weekendAvg > 0) {
        weekendVsWeekdayDiff = ((weekendAvg - weekdayAvg) / weekdayAvg) * 100;
    }

    return {
        avgPrice,
        mostExpensive,
        leastExpensive,
        priceRange,
        weekendVsWeekdayDiff
    };
  }, [historicalPriceSeries, selectedMonth]);

  const positionIndex = useMemo(() => {
    if (!ourHotelEntry || !revenuePerformanceData || revenuePerformanceData.length === 0) return null as number | null;
    
    // Sort hotels by average price in ascending order (lowest price first) to match Summary Tab logic
    // This ensures position 1 = lowest average price (best competitive position)
    // Position 1 = Best competitive pricing, Position N = Highest pricing
    const sortedHotels = [...revenuePerformanceData].sort((a, b) => {
      const avgPriceA = typeof a.revenue === 'number' ? a.revenue : 0; // revenue field contains avg price
      const avgPriceB = typeof b.revenue === 'number' ? b.revenue : 0; // revenue field contains avg price
      return avgPriceA - avgPriceB; // Lowest price first
    });
    
    // Find our hotel's position in the sorted list
    const ourHotelIndex = sortedHotels.findIndex((item) => 
      item.hotel === userHotelName || item.hotel === "OurHotel"
    );
    
    return ourHotelIndex >= 0 ? ourHotelIndex + 1 : null;
  }, [revenuePerformanceData, ourHotelEntry, userHotelName]);

  const performancePercentage = useMemo(() => {
    if (!ourHotelEntry) return null as number | null;
    if (!marketAvg) return 100;
    return (ourHotelEntry.revenue / marketAvg) * 100;
  }, [ourHotelEntry, marketAvg]);

  // Performance vs Market Comparison Data
  const performanceComparisonData = useMemo(() => {
    console.log('🔄 Calculating Performance vs Market Comparison...');
    
    if (!supabaseData || supabaseData.length === 0) {
      console.log('ℹ️ No user data for market comparison');
      return [];
    }

    // Calculate current performance metrics from real data
    const totalRevenue = supabaseData.reduce((sum, item) => 
      sum + convertPriceToSelectedCurrency(item.processed_price, item.processed_currency), 0
    );
    
    const avgPrice = totalRevenue / Math.max(supabaseData.length, 1);
    
    // Use the same ADR calculation as Market Position for consistency
    const consistentADR = ourHotelEntry?.revenue || avgPrice;
    
    // Calculate realistic occupancy based on data patterns
    const daysWithData = new Set(supabaseData.map(item => item.checkin_date?.split('T')[0])).size;
    const totalDaysInRange = range || 30;
    const dataIntensity = Math.min(daysWithData / totalDaysInRange, 1);
    const occupancyRate = Math.round((60 + dataIntensity * 25) * 10) / 10;
    
    // Calculate market position percentage
    const marketPosition = ourHotelEntry && marketAvg ? 
      Math.round(((ourHotelEntry.revenue / marketAvg - 1) * 100) * 10) / 10 : 0;

    // Define comparison metrics: Your Hotel vs Market Average
    const metrics = [
      {
        id: 'adr',
        name: 'Average Daily Rate',
        icon: '💵',
        yourValue: consistentADR,
        marketValue: marketAvg || consistentADR,
        unit: 'currency',
        color: '#3b82f6',
        betterWhen: 'higher'
      },
      {
        id: 'occupancy',
        name: 'Occupancy Rate',
        icon: '🏨',
        yourValue: null,
        marketValue: null,
        unit: 'percentage',
        color: '#f59e0b',
        betterWhen: 'higher'
      },
      {
        id: 'revenue_per_room',
        name: 'Revenue per Available Room',
        icon: '💰',
        yourValue: null,
        marketValue: null,
        unit: 'currency',
        color: '#10b981',
        betterWhen: 'higher'
      },
      {
        id: 'market_position',
        name: 'Market Position Index',
        icon: '📊',
        yourValue: 100 + marketPosition,
        marketValue: 100, // Market average baseline
        unit: 'index',
        color: '#8b5cf6',
        betterWhen: 'higher'
      }
    ];

    // Calculate performance indicators for each metric
    const metricsWithComparison = metrics.map(metric => {
      // Handle null values
      if (metric.yourValue === null || metric.marketValue === null) {
        return {
          ...metric,
          difference: 0,
          percentageDiff: 0,
          performance: 'neutral',
          performanceColor: '#6b7280',
          isAboveMarket: false
        };
      }
      
      const difference = metric.yourValue - metric.marketValue;
      const percentageDiff = metric.marketValue > 0 ? 
        Math.round((difference / metric.marketValue) * 100 * 10) / 10 : 0;
      
      let performance = 'neutral';
      let performanceColor = '#6b7280';
      
      if (metric.betterWhen === 'higher') {
        if (percentageDiff > 10) {
          performance = 'excellent';
          performanceColor = '#059669';
        } else if (percentageDiff > 0) {
          performance = 'good';
          performanceColor = '#10b981';
        } else if (percentageDiff > -10) {
          performance = 'fair';
          performanceColor = '#f59e0b';
        } else {
          performance = 'poor';
          performanceColor = '#dc2626';
        }
      }

      return {
        ...metric,
        difference,
        percentageDiff,
        performance,
        performanceColor,
        isAboveMarket: percentageDiff > 0
      };
    });

    console.log(`✅ Performance Comparison Data:`, metricsWithComparison);
    return metricsWithComparison;
  }, [supabaseData, marketAvg, ourHotelEntry, convertPriceToSelectedCurrency, range]);

  const HistoricalRevenueTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length || !visibleData || visibleData.length === 0) return null;
    const current = payload[0].value as number;
    const idx = visibleData.findIndex(p => p.day === label);
    const prev = idx > 0 && visibleData[idx - 1] ? visibleData[idx - 1].revenue : undefined;
    const delta = prev !== undefined ? current - prev : 0;
    const deltaColor = delta > 0 ? "#ef4444" : delta < 0 ? "#10b981" : "#6b7280";
    const deltaSign = delta > 0 ? "+" : "";

                      return (
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg">
        <div className="font-medium text-gray-900">{label}</div>
                        <div className="text-gray-700">Revenue: {currency ? currency().format(current) : `$${current}`}</div>
        {prev !== undefined && (
          <div className="text-gray-600">
                          Prev: {currency ? currency().format(prev) : `$${prev}`}
            <span className="ml-2" style={{ color: deltaColor }}>
                              {deltaSign}{currency ? currency().format(Math.abs(delta)) : `$${Math.abs(delta)}`}
            </span>
                      </div>
        )}
                      </div>
    );
  };

  // Chart interaction handlers
  const handleChartWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setChartZoom(prev => ({
      ...prev,
      scale: Math.max(0.5, Math.min(3, prev.scale + delta))
    }));
  };

  const handleChartMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  const handleChartMouseMove = (e: React.MouseEvent) => {
    if (isDragging && dragStart) {
      const deltaX = e.clientX - dragStart.x;
      const deltaY = e.clientY - dragStart.y;
      setChartZoom(prev => ({
        ...prev,
        x: prev.x + deltaX * 0.01,
        y: prev.y + deltaY * 0.01
      }));
      setDragStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleChartMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
  };

  // Run comprehensive testing when data is loaded (reduced frequency)
  useEffect(() => {
    if (!loading && supabaseData.length > 0 && !testResults) {
      const startTime = Date.now();
      
      setTimeout(() => {
        const renderTime = Date.now() - startTime;
        
        const exportData = {
          userHotelName,
          dateRange: `${range} days`,
          currency: selectedCurrency,
          totalDataPoints: supabaseData.length,
          competitorCount: competitorData.length,
          marketPosition: ourHotelEntry && positionIndex && performanceDeltaPerc !== null ? {
            rank: positionIndex,
            totalHotels: revenuePerformanceData.length,
            priceVsMarket: performanceDeltaPerc,
            yourPrice: ourHotelEntry.revenue,
            marketAverage: marketAvg
          } : undefined,
          historicalData: historicalPriceSeries.map(item => ({
            date: item.date,
            price: item.price,
            count: item.count
          })),
          filters: {
            roomType: selectedRoomType,
            range
          }
        };

        const results = runCompleteTestSuite({
          supabaseData,
          competitorData,
          historicalPriceSeries,
          revenuePerformanceData,
          filters: {
            selectedCurrency,
            selectedRoomType,
            range
          },
          exportData,
          renderTime
        });

        setTestResults(results);
        
        // Log test results (only if there are failures)
        if (results.summary.failed > 0) {
          console.log('🧪 Analytics Test Suite Results:');
          console.log(`📊 Overall Score: ${results.summary.score}% (${results.summary.passed}/${results.summary.totalTests} tests passed)`);
          console.log(`⚠️ ${results.summary.failed} test(s) failed:`);
          [...results.dataValidation, ...results.functionalityTests, ...results.edgeCases, ...results.performanceTests]
            .filter(test => !test.passed)
            .forEach(test => console.log(`  - ${test.testName}: ${test.message}`));
        } else {
          console.log('✅ Analytics Test Suite: All tests passed!');
        }
      }, 100); // Small delay to ensure all data is processed
    }
  }, [
    loading, 
    supabaseData.length > 0, // Only trigger when we have data
    testResults === null // Only run once
  ]);

  return (
    <div className="space-y-8">
      {/* Development Test Results - Only show in development with poor scores */}
      {process.env.NODE_ENV === 'development' && testResults && testResults.summary.score < 80 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-orange-900">🧪 Test Suite Results</h4>
            <span className={`text-sm font-bold ${
              testResults.summary.score >= 90 ? 'text-green-600' :
              testResults.summary.score >= 70 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {testResults.summary.score}% ({testResults.summary.passed}/{testResults.summary.totalTests})
            </span>
          </div>
          {testResults.summary.failed > 0 && (
            <div className="text-sm text-orange-800">
              <strong>Failed tests:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                {[...testResults.dataValidation, ...testResults.functionalityTests, ...testResults.edgeCases, ...testResults.performanceTests]
                  .filter(test => !test.passed)
                  .map((test, index) => (
                    <li key={index}>{test.testName}: {test.message}</li>
                  ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center p-8">
                      <div className="text-center">
            <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-arkus-600 mx-auto mb-4"></div>
              <div className="absolute inset-0 rounded-full border-2 border-gray-200 opacity-20"></div>
            </div>
            <p className="text-gray-600 animate-pulse">Loading analysis data...</p>
            <div className="mt-4 flex justify-center space-x-1">
              <div className="w-2 h-2 bg-arkus-600 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-arkus-600 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
              <div className="w-2 h-2 bg-arkus-600 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
            </div>
          </div>
                    </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 font-medium mb-2">Error loading data</p>
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={fetchHotelUsuarioData}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
          </div>
      )}

      {/* Content - Only show when not loading and no errors */}
      {!loading && !error && (
        <>
          {/* Insight bar - compact, premium */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
            {/* Global Filters and Controls - Glass Card */}
            <AnalysisControls
              selectedCurrency={selectedCurrency}
              setSelectedCurrency={setSelectedCurrency}
              selectedRoomType={selectedRoomType}
              setSelectedRoomType={setSelectedRoomType}
              uniqueRoomTypes={uniqueRoomTypes}
              range={range}
              setRange={setRange}
              clickedRoomType={clickedRoomType}
              setClickedRoomType={setClickedRoomType}
              totalDataPoints={supabaseData.length}
              competitorCount={competitorData.length}
              dateRange={(() => {
                const today = new Date();
                const startDate = new Date();
                startDate.setDate(today.getDate() - range);
                return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
              })()}
              lastUpdate="2 hours ago"
              loading={loading}
              userHotelName={userHotelName}
              marketPosition={ourHotelEntry && positionIndex && performanceDeltaPerc !== null ? {
                rank: positionIndex,
                totalHotels: revenuePerformanceData.length,
                priceVsMarket: performanceDeltaPerc,
                yourPrice: ourHotelEntry.revenue,
                marketAverage: marketAvg
              } : undefined}
              historicalData={historicalPriceSeries.map(item => ({
                date: item.date,
                price: item.price,
                count: item.count
              }))}
            />



            <MarketPositionCard
              revenuePerformanceData={revenuePerformanceData}
              ourHotelEntry={ourHotelEntry}
              positionIndex={positionIndex}
              performanceDeltaPerc={performanceDeltaPerc}
              marketAvg={marketAvg}
              userHotelName={userHotelName}
              currency={currency()}
              loading={loading}
            />

        </div>

          {/* Charts Grid - Perfectly aligned with consistent heights */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mt-6">
            {/* Top Left: Performance vs Goals */}
            <div className="lg:col-span-1 h-[600px] animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <div className={`backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300 h-full flex flex-col group ${
                isTransitioning ? 'animate-pulse' : ''
              }`}>
          <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Performance vs Market</h3>
                    <p className="text-sm text-gray-600">Compare your metrics against market average</p>
                  </div>
            <div className="flex items-center gap-2">
              {loading && (
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">Loading...</span>
              )}
                    {!loading && performanceComparisonData.length === 0 && (
                      <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-lg">No comparison data</span>
                    )}
                    {!loading && performanceComparisonData.length > 0 && (
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                        {performanceComparisonData.filter(m => m.isAboveMarket).length} above market
                      </span>
                  )}
            </div>
          </div>
          
                <div className="flex-1 min-h-0">
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-arkus-600 mx-auto mb-2"></div>
                        <p className="text-xs text-gray-600">Loading goals data...</p>
                      </div>
                    </div>
                  ) : performanceComparisonData.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <div className="text-center">
                        <div className="text-4xl mb-2">📊</div>
                        <p className="text-sm">No comparison data available</p>
                        <p className="text-xs mt-1">Load data to see market comparison</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col overflow-hidden">
                      {/* Market Comparison List - Side by Side Layout */}
                      <div className="space-y-3 flex-1 overflow-y-auto pr-2">
                        {performanceComparisonData.map((metric, index) => (
                          <div
                            key={metric.id}
                            className="group relative backdrop-blur-sm bg-white/5 border border-white/10 rounded-lg p-3 hover:bg-white/10 transition-all duration-300"
                          >
                            {/* Metric Header */}
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                <div className="text-lg">{metric.icon}</div>
                                <div>
                                  <h4 className="font-semibold text-gray-900 text-sm">{metric.name}</h4>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm font-bold flex items-center gap-1" style={{ color: metric.performanceColor }}>
                                  {metric.isAboveMarket ? '↗' : '↘'}
                                  {metric.percentageDiff > 0 ? '+' : ''}{metric.percentageDiff}%
                                </div>
                              </div>
                            </div>

                            {/* Side by Side Comparison */}
                            <div className="grid grid-cols-2 gap-3">
                              {/* Your Hotel - Left Side */}
                              <div className="bg-arkus-50/50 rounded-lg p-2">
                                <div className="text-xs text-gray-600 mb-1">Your Hotel</div>
                                <div className="text-lg font-bold text-arkus-700">
                                  {metric.yourValue === null 
                                    ? 'N/A'
                                    : metric.unit === 'currency' 
                                    ? (currency ? currency().format(metric.yourValue) : `$${Math.round(metric.yourValue)}`)
                                    : metric.unit === 'percentage' 
                                    ? `${Math.round(metric.yourValue)}%`
                                    : metric.unit === 'index'
                                    ? `${Math.round(metric.yourValue)}`
                                    : Math.round(metric.yourValue)
                                  }
                                </div>
                              </div>

                              {/* Market Average - Right Side */}
                              <div className="bg-gray-50/50 rounded-lg p-2">
                                <div className="text-xs text-gray-600 mb-1">Market Average</div>
                                <div className="text-lg font-bold text-gray-700">
                                  {metric.marketValue === null 
                                    ? 'N/A'
                                    : metric.unit === 'currency' 
                                    ? (currency ? currency().format(metric.marketValue) : `$${Math.round(metric.marketValue)}`)
                                    : metric.unit === 'percentage' 
                                    ? `${Math.round(metric.marketValue)}%`
                                    : metric.unit === 'index'
                                    ? `${Math.round(metric.marketValue)}`
                                    : Math.round(metric.marketValue)
                                  }
                                </div>
                              </div>
                            </div>

                            {/* Performance Indicator Bar */}
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                                <span className="capitalize" style={{ color: metric.performanceColor }}>
                                  {metric.performance}
                                </span>
                                <span>
                                  Difference: {metric.yourValue === null || metric.marketValue === null
                                    ? 'N/A'
                                    : metric.unit === 'currency' 
                                    ? (currency ? currency().format(Math.abs(metric.difference)) : `$${Math.round(Math.abs(metric.difference))}`)
                                    : `${Math.abs(Math.round(metric.difference))}${metric.unit === 'percentage' ? '%' : ''}`
                                  }
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden relative">
                                <div className="absolute inset-0 flex">
                                  {/* Below market section */}
                                  <div className="w-1/2 bg-red-200"></div>
                                  {/* Above market section */}
                                  <div className="w-1/2 bg-green-200"></div>
                                </div>
                                {/* Performance indicator */}
                                <div 
                                  className="absolute top-0 h-2 w-1 transition-all duration-500"
                                  style={{ 
                                    left: `${50 + Math.max(-50, Math.min(50, metric.percentageDiff / 2))}%`,
                                    backgroundColor: metric.performanceColor 
                                  }}
                                >
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Summary - Performance Overview */}
                      <div className="mt-2 pt-2 border-t border-gray-200/20">
                        <div className="text-center">
                          <div className="text-xs text-gray-600 mb-1">Overall Performance</div>
                          <div className="flex justify-center gap-3 text-xs">
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                              <span className="text-gray-600">{performanceComparisonData.filter(m => m.performance === 'excellent' || m.performance === 'good').length} Above Market</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-yellow-600 rounded-full"></div>
                              <span className="text-gray-600">{performanceComparisonData.filter(m => m.performance === 'fair').length} At Market</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                              <span className="text-gray-600">{performanceComparisonData.filter(m => m.performance === 'poor').length} Below Market</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
            )}
          </div>
          

                </div>
              </div>

            {/* Top Right: Historical Prices & Market Comparison */}
            <div className="lg:col-span-1 h-[600px] animate-fade-in-up" style={{ animationDelay: '0.2s' }}>
              <div className={`backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-500 h-full flex flex-col ${
                isTransitioning ? 'animate-pulse' : ''
              }`}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {userHotelName ? `${userHotelName} - Price Evolution` : "Price Evolution"}
                      {clickedRoomType && (
                        <span className="text-sm text-arkus-600 ml-2">({clickedRoomType})</span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Historical prices with market comparison
                      <span className="text-xs text-gray-500 ml-2">• Scroll to zoom • Drag to pan</span>
                      {clickedRoomType && (
                        <span className="text-xs text-blue-600 ml-2">• Filtered: {clickedRoomType}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {loading && (
                      <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">Loading...</span>
                    )}
                    {!loading && historicalPriceSeries.length === 0 && (
                      <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-lg">No data</span>
                    )}
                    {!loading && historicalPriceSeries.length > 0 && (
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                        {historicalPriceSeries.length} data points
                      </span>
                    )}
                  </div>
          </div>
          
                <div className="flex-1 min-h-0">
                  {/* Price Evolution Chart with Real Data */}
                  <div className="w-full h-full">
                    {loading ? (
                      <div className="flex items-center justify-center h-full">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                          <p className="text-sm text-gray-600">Loading price data...</p>
                        </div>
                      </div>
                    ) : historicalPriceSeries.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <div className="text-center">
                        <div className="text-4xl mb-2">📈</div>
                          <p className="text-sm">No price data available</p>
                        <p className="text-xs mt-1">Load data to see price evolution</p>
                      </div>
                    </div>
                  ) : (
                      <ResponsiveContainer width="100%" height={400}>
                          <AreaChart
                          data={historicalPriceSeries}
                          margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis 
                            dataKey="date" 
                          tickFormatter={(value) => {
                              const date = new Date(value);
                              return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                            }}
                          />
                          <YAxis 
                            tickFormatter={(value) => currency ? currency().format(value) : `$${value}`}
                          />
                          <Tooltip 
                            formatter={(value: any, name: string) => [
                              currency ? currency().format(value) : `$${value}`,
                              name === 'price' ? 'Your Price' : 'Market Estimate'
                            ]}
                            labelFormatter={(label) => {
                              const date = new Date(label);
                              return date.toLocaleDateString('en-US', { 
                                weekday: 'short', 
                                year: 'numeric', 
                                month: 'short', 
                                day: 'numeric' 
                              });
                            }}
                          />
                          <Legend />
                        <Area 
                          type="monotone" 
                          dataKey="price" 
                            stackId="1"
                            stroke="#ef4444"
                            fill="#ef4444"
                            fillOpacity={0.6}
                            name="Your Price"
                          />
                          <Area
                          type="monotone" 
                            dataKey="marketEstimate"
                            stackId="2"
                          stroke="#94a3b8" 
                            fill="#94a3b8"
                            fillOpacity={0.4}
                            name="Market Estimate"
                          />
                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                  </div>
                </div>
          

              </div>
            </div>

            {/* Bottom Left: Revenue Distribution by Room Type */}
            <div className="lg:col-span-1 h-[600px] animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
              <div className={`backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300 h-full flex flex-col ${
                isTransitioning ? 'animate-pulse' : ''
              }`}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {userHotelName ? `${userHotelName} - Revenue Distribution` : "Revenue Distribution"}
                      {clickedRoomType && (
                        <span className="text-sm text-arkus-600 ml-2">({clickedRoomType})</span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Revenue breakdown by room type
                      {clickedRoomType && (
                        <span className="text-xs text-blue-600 ml-2">• Filtered: {clickedRoomType}</span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {loading && (
                      <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">Loading...</span>
                    )}
                    {!loading && revenueByRoomTypeData.length === 0 && (
                      <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-lg">No data</span>
                    )}
                    {!loading && revenueByRoomTypeData.length > 0 && (
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                        {revenueByRoomTypeData.length} room types
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-h-0 flex items-center justify-center">
                  {revenueByRoomTypeData.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <div className="text-center">
                        <div className="text-4xl mb-2">📊</div>
                        <p className="text-sm">No data available</p>
                        <p className="text-xs mt-1">Load data to see revenue distribution</p>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart margin={{ top: 20, right: 60, bottom: 20, left: 60 }}>
                          <Pie
                            data={revenueByRoomTypeData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={120}
                            paddingAngle={5}
                            dataKey="total_revenue"
                            onClick={handleBarClick}
                            style={{ cursor: "pointer" }}
                            labelLine={false}
                            label={renderCustomizedLabel}
                          >
                            {revenueByRoomTypeData.map((entry, index) => {
                              const colors = ['#ff0000', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
                              const isSelected = clickedRoomType === entry.room_type;
                              const hasSelection = clickedRoomType !== null;
                              const color = colors[index % colors.length];
                              
                              return (
                                <Cell 
                                  key={`cell-${index}`} 
                                  fill={color}
                                  opacity={hasSelection ? (isSelected ? 1 : 0.3) : 1}
                                  stroke={isSelected ? "#ffffff" : "#ffffff"}
                                  strokeWidth={isSelected ? 3 : 1}
                                />
                              );
                            })}
                          </Pie>
                          <Tooltip 
                            content={({ active, payload }) => {
                              if (!active || !payload?.length) return null;
                              const data = payload[0].payload;
                              const totalRevenue = revenueByRoomTypeData.reduce((sum, item) => sum + item.total_revenue, 0);
                              const percentage = ((data.total_revenue / totalRevenue) * 100).toFixed(1);
                              
                              return (
                                <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg">
                                  <div className="font-medium text-gray-900">{data.room_type}</div>
                                  <div className="text-gray-700">Revenue: {currency ? currency().format(data.total_revenue) : `$${data.total_revenue}`}</div>
                                  <div className="text-gray-600">Share: {percentage}%</div>
                                                                      <div className="text-gray-500">Avg Price: {currency ? currency().format(data.avg_price) : `$${data.avg_price}`}</div>
                                  <div className="text-gray-500">Bookings: {data.count}</div>
                                </div>
                              );
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Legend and Summary */}
                {revenueByRoomTypeData.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <p className="text-xs text-gray-600">Total Revenue</p>
                        <p className="text-lg font-semibold text-gray-800">
                                                      {currency ? currency().format(revenueByRoomTypeData.reduce((sum, item) => sum + item.total_revenue, 0)) : `$${revenueByRoomTypeData.reduce((sum, item) => sum + item.total_revenue, 0)}`}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Top Room Type</p>
                        <p className="text-lg font-semibold text-arkus-600">
                          {revenueByRoomTypeData[0]?.room_type || 'N/A'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-3 text-xs text-gray-500 text-center">
                      💡 Click on any segment to filter by room type
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Right: Price Heatmap by Day of Week */}
            <div className="lg:col-span-1 h-[600px] animate-fade-in-up" style={{ animationDelay: '0.4s' }}>
              <div className={`backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-500 h-full flex flex-col ${
                isTransitioning ? 'animate-pulse' : ''
              }`}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {userHotelName ? `${userHotelName} - Price Patterns` : "Price Patterns"}
                      {clickedRoomType && (
                        <span className="text-sm text-arkus-600 ml-2">({clickedRoomType})</span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Average prices by day of the week
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {loading && (
                      <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">Loading...</span>
                    )}
                    {!loading && historicalPriceSeries.length === 0 && (
                      <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-lg">No data</span>
                    )}
                    {!loading && historicalPriceSeries.length > 0 && (
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                        {historicalPriceSeries.length} days analyzed
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-h-0">
                  {loading ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-arkus-600 mx-auto mb-2"></div>
                        <p className="text-xs text-gray-600">Loading calendar...</p>
                      </div>
                    </div>
                  ) : historicalPriceSeries.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <div className="text-center">
                        <div className="text-4xl mb-2">📅</div>
                        <p className="text-sm">No data available</p>
                        <p className="text-xs mt-1">Load data to see price patterns</p>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full flex flex-col">
                      {/* Calendar View */}
                      <div className="flex-1 p-4">
                        <div className="max-w-md mx-auto">
                          {/* Calendar Header with Navigation */}
                          <div className="flex items-center justify-between mb-4">
                            <button 
                              onClick={() => {
                                const [currentYear, currentMonthNum, currentDay] = selectedMonth.split('-').map(Number);
                                const currentMonth = new Date(currentYear, currentMonthNum - 1, currentDay);
                                const prevMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
                                const newMonthStr = prevMonth.toISOString().split('T')[0];
                                console.log(`📅 Navigating to previous month: ${newMonthStr}`);
                                setSelectedMonth(newMonthStr);
                              }}
                              className="p-2 rounded-lg hover:bg-gray-100 hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                              disabled={(() => {
                                const uniqueDates = Array.from(new Set(historicalPriceSeries.map(item => item.date))).sort();
                                if (uniqueDates.length === 0) return true;
                                
                                // Parse the first date properly
                                let firstDateStr = uniqueDates[0];
                                if (firstDateStr.includes('T')) {
                                  firstDateStr = firstDateStr.split('T')[0];
                                }
                                const [firstYear, firstMonth, firstDay] = firstDateStr.split('-').map(Number);
                                const firstDate = new Date(firstYear, firstMonth - 1, firstDay);
                                
                                // Get the first day of the current month
                                const [currentYear, currentMonthNum, currentDay] = selectedMonth.split('-').map(Number);
                                const currentMonth = new Date(currentYear, currentMonthNum - 1, currentDay);
                                const firstDayOfCurrentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
                                
                                return firstDayOfCurrentMonth.getTime() <= firstDate.getTime();
                              })()}
                            >
                              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                              </svg>
                            </button>
                            
                            <h4 className="text-lg font-semibold text-gray-800">
                              {(() => {
                                const [currentYear, currentMonthNum, currentDay] = selectedMonth.split('-').map(Number);
                                const currentMonth = new Date(currentYear, currentMonthNum - 1, currentDay);
                                return currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                              })()}
                            </h4>
                            
                            <button 
                              onClick={() => {
                                const [currentYear, currentMonthNum, currentDay] = selectedMonth.split('-').map(Number);
                                const currentMonth = new Date(currentYear, currentMonthNum - 1, currentDay);
                                const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
                                const newMonthStr = nextMonth.toISOString().split('T')[0];
                                console.log(`📅 Navigating to next month: ${newMonthStr}`);
                                setSelectedMonth(newMonthStr);
                              }}
                              className="p-2 rounded-lg hover:bg-gray-100 hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                              disabled={(() => {
                                const uniqueDates = Array.from(new Set(historicalPriceSeries.map(item => item.date))).sort();
                                if (uniqueDates.length === 0) return true;
                                
                                // Parse the last date properly
                                let lastDateStr = uniqueDates[uniqueDates.length - 1];
                                if (lastDateStr.includes('T')) {
                                  lastDateStr = lastDateStr.split('T')[0];
                                }
                                const [lastYear, lastMonth, lastDay] = lastDateStr.split('-').map(Number);
                                const lastDate = new Date(lastYear, lastMonth - 1, lastDay);
                                
                                // Get the first day of the next month
                                const [currentYear, currentMonthNum, currentDay] = selectedMonth.split('-').map(Number);
                                const currentMonth = new Date(currentYear, currentMonthNum - 1, currentDay);
                                const nextMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1);
                                
                                return nextMonth.getTime() > lastDate.getTime();
                              })()}
                            >
                              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                          
                          {/* Days of Week Header */}
                          <div className="grid grid-cols-7 gap-1 mb-2">
                            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
                              <div key={`day-header-${index}`} className="text-center">
                                <span className="text-xs font-medium text-gray-600">{day}</span>
                              </div>
                            ))}
                          </div>
                          
                          {/* Calendar Grid */}
                          <div className="grid grid-cols-7 gap-1">
                            {(() => {
                              // Use actual data dates instead of hardcoded September
                              const uniqueDates = Array.from(new Set(historicalPriceSeries.map(item => item?.date).filter(Boolean))).sort();
                              
                              if (uniqueDates.length === 0) {
                                return (
                                  <div className="col-span-7 text-center py-8 text-gray-500">
                                    <div className="text-4xl mb-2">📅</div>
                                    <p className="text-sm">No historical data available</p>
                                    <p className="text-xs mt-1">Check if you have hotel data loaded</p>
                                  </div>
                                );
                              }
                              
                              // Get the month and year from selected month
                              const [selectedYear, selectedMonthNum, selectedDay] = selectedMonth.split('-').map(Number);
                              const selectedDate = new Date(selectedYear, selectedMonthNum - 1, selectedDay);
                              const monthYear = selectedDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                              
                              // Calculate calendar layout based on selected month
                              const firstDayOfWeek = selectedDate.getDay(); // 0 = Sunday
                              const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
                              
                              const calendarDays = [];
                              
                              // Add empty cells for days before the first data day
                              for (let i = 0; i < firstDayOfWeek; i++) {
                                calendarDays.push({ day: '', price: 0, bookings: 0, isEmpty: true });
                              }
                              
                              // Get all available dates for the selected month
                              const monthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
                              const monthEnd = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0);
                              
                              // Filter data for the selected month
                              const monthData = historicalPriceSeries.filter(item => {
                                // Parse the date string properly - handle both YYYY-MM-DD and YYYY-MM-DDTHH:mm:ss formats
                                let dateStr = item.date;
                                if (dateStr.includes('T')) {
                                  dateStr = dateStr.split('T')[0]; // Remove time portion
                                }
                                const [year, month, day] = dateStr.split('-').map(Number);
                                const itemDate = new Date(year, month - 1, day); // month is 0-indexed
                                
                                // Check if the item date is within the selected month
                                const itemMonth = itemDate.getMonth();
                                const itemYear = itemDate.getFullYear();
                                const selectedMonthNum = selectedDate.getMonth();
                                const selectedYear = selectedDate.getFullYear();
                                
                                return itemMonth === selectedMonthNum && itemYear === selectedYear;
                              });
                              
                              console.log(`📅 Calendar Debug - Selected Month: ${selectedDate.toLocaleDateString()}`);
                              console.log(`📅 Total data points: ${historicalPriceSeries.length}`);
                              console.log(`📅 Month data points: ${monthData.length}`);
                              console.log(`📅 Sample dates:`, monthData.slice(0, 3).map(item => item.date));
                              console.log(`📅 Month range: ${monthStart.toLocaleDateString()} to ${monthEnd.toLocaleDateString()}`);
                              
                              // Group by day
                              const dailyData: Record<number, { prices: number[], count: number }> = {};
                              monthData.forEach(item => {
                                // Parse the date string properly - handle both formats
                                let dateStr = item.date;
                                if (dateStr.includes('T')) {
                                  dateStr = dateStr.split('T')[0]; // Remove time portion
                                }
                                const [year, month, day] = dateStr.split('-').map(Number);
                                if (!dailyData[day]) {
                                  dailyData[day] = { prices: [], count: 0 };
                                }
                                dailyData[day].prices.push(item.price);
                                dailyData[day].count += item.count || 1;
                              });
                              
                              console.log(`📅 Daily data summary:`, Object.keys(dailyData).map(day => ({ 
                                day: parseInt(day), 
                                priceCount: dailyData[parseInt(day)].prices.length,
                                avgPrice: dailyData[parseInt(day)].prices.length > 0 ? 
                                  dailyData[parseInt(day)].prices.reduce((a, b) => a + b, 0) / dailyData[parseInt(day)].prices.length : 0
                              })));
                              
                              // Add all days of the month
                              for (let day = 1; day <= daysInMonth; day++) {
                                const dayData = dailyData[day];
                                const hasData = !!dayData;
                                
                                const avgPrice = hasData 
                                  ? dayData.prices.reduce((sum, price) => sum + price, 0) / dayData.prices.length 
                                  : 0;
                                
                                const prices = historicalPriceSeries.map(item => item?.price).filter(price => typeof price === 'number' && !isNaN(price));
                                const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
                                const maxPrice = prices.length > 0 ? Math.max(...prices) : 0;
                                const priceRange = maxPrice - minPrice;
                                const intensity = priceRange > 0 ? (avgPrice - minPrice) / priceRange : 0;
                                
                                calendarDays.push({
                                  day,
                                  price: avgPrice || 0,
                                  bookings: hasData ? dayData.count : 0,
                                  intensity: Math.min(1, Math.max(0, intensity || 0)),
                                  hasData: hasData,
                                  isEmpty: false
                                });
                              }
                              
                                                             return calendarDays.map((data, index) => {
                                 if (data.isEmpty) {
                                   return (
                                     <div key={`empty-${index}`} className="h-8"></div>
                                   );
                                 }
                                 
                                 const isToday = data.day === new Date().getDate(); // Highlight current day
                                 const hasData = Boolean(data.hasData);
                                 const intensity = Number(data.intensity) || 0;
                                 
                                 // Better color calculation with more visible colors
                                 let bgColor = 'transparent';
                                 let textColor = 'text-gray-400';
                                 
                                 if (hasData) {
                                   if (intensity < 0.33) {
                                     bgColor = 'bg-green-100 border border-green-200';
                                     textColor = 'text-green-800';
                                   } else if (intensity < 0.66) {
                                     bgColor = 'bg-yellow-100 border border-yellow-200';
                                     textColor = 'text-yellow-800';
                                   } else {
                                     bgColor = 'bg-red-200 border border-red-300';
                                     textColor = 'text-red-900';
                                   }
                                 } else {
                                   bgColor = 'bg-gray-50 border border-gray-200';
                                   textColor = 'text-gray-400';
                                 }
                                 
                                 const tooltipText = hasData 
                                   ? `Day ${data.day}: ${currency ? currency().format(data.price || 0) : '$0'}\n${data.bookings || 0} bookings\nIntensity: ${intensity.toFixed(2)}`
                                   : `Day ${data.day}: No data available`;
                                 
                                 return (
                                   <div 
                                     key={`day-${data.day}`}
                                     data-day={data.day}
                                     data-has-data={hasData}
                                     data-price={data.price}
                                     data-bookings={data.bookings}
                                     className={`h-8 flex items-center justify-center rounded text-xs font-medium cursor-pointer transition-all duration-200 hover:shadow-lg relative group ${
                                       isToday ? 'ring-2 ring-red-500' : ''
                                     } ${bgColor}`}
                                     onClick={() => {
                                     if (hasData && data.price && currency) {
                                       console.log(`📅 Day ${data.day} Drill-down:`);
                                       console.log(`   💰 Price: ${currency ? currency().format(data.price) : `$${data.price}`}`);
                                       console.log(`   📊 Bookings: ${data.bookings || 0}`);
                                       console.log(`   📈 Intensity: ${intensity.toFixed(2)}`);
                                       
                                       // Show detailed tooltip for a longer duration
                                       const tooltip = document.querySelector(`[data-day="${data.day}"] .tooltip-content`);
                                       if (tooltip) {
                                         tooltip.classList.add('opacity-100');
                                         setTimeout(() => tooltip.classList.remove('opacity-100'), 3000);
                                       }
                                       
                                       // Add visual feedback
                                       const dayElement = document.querySelector(`[data-day="${data.day}"]`);
                                       if (dayElement) {
                                         dayElement.classList.add('ring-4', 'ring-red-400', 'ring-opacity-50');
                                         setTimeout(() => {
                                           dayElement.classList.remove('ring-4', 'ring-red-400', 'ring-opacity-50');
                                         }, 1000);
                                       }
                                       }
                                     }}
                                   >
                                     <div className="relative">
                                       <span className={textColor}>
                                         {data.day}
                                       </span>
                                       {hasData && (
                                         <div className="absolute -bottom-1 -right-1 w-1.5 h-1.5 bg-red-600 rounded-full border border-white"></div>
                                       )}
                                     </div>
                                     
                                     {/* Enhanced Tooltip */}
                                     <div className="tooltip-content absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none whitespace-pre-line z-10 max-w-xs">
                                       <div className="font-medium mb-1">Day {data.day}</div>
                                       {hasData ? (
                                         <div className="space-y-1">
                                           <div className="flex justify-between">
                                             <span>Price:</span>
                                             <span className="font-medium">{currency ? currency().format(data.price) : `$${data.price}`}</span>
                                           </div>
                                           <div className="flex justify-between">
                                             <span>Bookings:</span>
                                             <span>{data.bookings || 0}</span>
                                           </div>
                                           <div className="flex justify-between">
                                             <span>Intensity:</span>
                                             <span>{intensity.toFixed(2)}</span>
                                           </div>
                                           <div className="text-gray-300 text-xs mt-2 pt-1 border-t border-gray-700">
                                             💡 Click for details
                                           </div>
                                         </div>
                                       ) : (
                                         <div className="text-gray-300">No data available</div>
                                       )}
                                       <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                     </div>
                                   </div>
                                 );
                               });
                            })()}
                          </div>
                        </div>
                      </div>
                      

                    </div>
                  )}
                </div>

              </div>
            </div>

          </div>
        </>
      )}
    </div>
  );
}
