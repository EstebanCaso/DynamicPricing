"use client";

import {
  ResponsiveContainer,
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
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { 
  standardizeRoomType,
  fetchUserHotelData,
  fetchCompetitorData,
  logDataFlow,
  cleanPrice,
  type Currency,
  type ProcessedHotelData 
} from "@/lib/dataUtils";
import { useCurrencyConversion } from "@/hooks/useCurrencyConversion";
import { useRevenueAnalysis } from "@/hooks/useRevenueAnalysis";
import { useHistoricalData } from "@/hooks/useHistoricalData";
import RevenueMetrics from "./RevenueMetrics";
import PerformanceScorecard from "./PerformanceScorecard";
import HistoricalPricesChart from "./HistoricalPricesChart";
import PriceStats from "./PriceStats";
import RevenueByRoomTypeChart from "./RevenueByRoomTypeChart";
import AnalysisControls from "./AnalysisControls";

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

      const user = await getCurrentUser();

      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      logDataFlow('AnalysisTab', { userId: user.id }, 'Fetching user hotel data');

      // Use unified data fetching function
      const processedData = await fetchUserHotelData(user.id);

      if (processedData.length === 0) {
        setSupabaseData([]);
        return;
      }

      // Set user hotel name from the first hotel
      if (processedData.length > 0 && processedData[0].hotel_name) {
        setUserHotelName(processedData[0].hotel_name);
      }

      logDataFlow('AnalysisTab', { 
        count: processedData.length, 
        hotelName: processedData[0]?.hotel_name,
        samplePrice: processedData[0]?.processed_price 
      }, 'Processed user hotel data');

      setSupabaseData(processedData);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
      console.error('❌ Error fetching hotel data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch competitor data and calculate revenue performance
  const fetchCompetitorData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      // Get user's city from their hotel data - note: ciudad is not in ProcessedHotelData
      // We'll need to get this from user metadata instead
      const userHotel = supabaseData[0]; // Just use first hotel for now
      if (!userHotel) return;

      // Query the correct table: hoteles_parallel
      let competitors = null;
      
      try {
        const { data: hotelesData, error } = await supabase
          .from('hoteles_parallel')
          .select('*')
          .limit(50); // Increased limit to get more data
        
        if (error) throw error;
        
        if (hotelesData && hotelesData.length > 0) {
          // Filter by city in memory (Tijuana is the main city in your data)
          competitors = hotelesData.filter(hotel => 
            hotel.ciudad && hotel.ciudad.toLowerCase().includes('tijuana')
          );
          console.log(`✅ Found ${competitors.length} competitors in hoteles_parallel`);
        }
      } catch (e) {
        console.error('Error fetching from hoteles_parallel:', e);
        return;
      }
      
      if (!competitors || competitors.length === 0) {
        console.log('No competitors found in hoteles_parallel');
        return;
      }

        setCompetitorData(competitors);
        
      // Calculate average price performance metrics from rooms_jsonb data
        const performanceData: RevenuePoint[] = [];
        
        // Add user's hotel performance
      if (userHotel) {
        const userHotelAvgPrice = calculateHotelRevenue([userHotel]); // This actually calculates avg price
          performanceData.push({
          hotel: userHotel.hotel_name || "Our Hotel",
          revenue: userHotelAvgPrice, // Using revenue field for avg price to maintain compatibility
          color: "#ff0000"
          });
        }
        
        // Add competitor performance
      competitors.forEach((competitor: any) => {
        if (competitor.rooms_jsonb && typeof competitor.rooms_jsonb === 'object') {
          const competitorAvgPrice = calculateHotelRevenueFromJsonb(competitor.rooms_jsonb);
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
      
    } catch (err) {
      console.error('Error fetching competitor data:', err);
    }
  };

  // Helper function to calculate average hotel revenue per room from rooms_jsonb data
  const calculateHotelRevenueFromJsonb = (roomsJsonb: any): number => {
    let totalRevenue = 0;
    let roomCount = 0;
    
    if (roomsJsonb && typeof roomsJsonb === 'object') {
      Object.entries(roomsJsonb).forEach(([date, rooms]: [string, any]) => {
        if (Array.isArray(rooms)) {
          rooms.forEach((room: any) => {
            if (room.price) {
              const price = getPriceValue(room.price);
              if (price > 0) {
                totalRevenue += price;
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

  // Function to handle bar clicks for filtering
  const handleBarClick = (data: any, index: number) => {
    const roomType = data.room_type;
    if (clickedRoomType === roomType) {
      setClickedRoomType(null);
    } else {
      setClickedRoomType(roomType);
    }
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

  // Fetch competitor data when user data or currency is available/changes
  useEffect(() => {
    if (supabaseData.length > 0 && userHotelName) {
      fetchCompetitorData();
    }
  }, [supabaseData, userHotelName, selectedCurrency]);



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
    if (supabaseData.length === 0) return [];

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
                  if (!checkinDate) return;
                  
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
    
    return result;
  }, [supabaseData, clickedRoomType, selectedRoomType, range, cleanPrice, standardizeRoomType, convertPriceToSelectedCurrency, selectedCurrency]);

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
        <div className="text-gray-700">Revenue: {currency.format(current)}</div>
        {prev !== undefined && (
          <div className="text-gray-600">
            Prev: {currency.format(prev)}
            <span className="ml-2" style={{ color: deltaColor }}>
              {deltaSign}{currency.format(Math.abs(delta))}
            </span>
                      </div>
        )}
                      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center p-8">
                      <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-arkus-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading analysis data...</p>
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Global Filters and Controls - Glass Card */}
            <AnalysisControls
              selectedCurrency={selectedCurrency}
              setSelectedCurrency={setSelectedCurrency}
              selectedRoomType={selectedRoomType}
              setSelectedRoomType={setSelectedRoomType}
              uniqueRoomTypes={uniqueRoomTypes}
              range={range}
              setRange={setRange}
              targetMin={targetMin}
              setTargetMin={setTargetMin}
              targetMax={targetMax}
              setTargetMax={setTargetMax}
              events={events}
              setEvents={setEvents}
              clickedRoomType={clickedRoomType}
              setClickedRoomType={setClickedRoomType}
            />



            <RevenueMetrics
              loading={loading}
              todayAverageRevenue={todayAverageRevenue}
              clickedRoomType={clickedRoomType}
              currency={currency}
              sparkData={sparkData}
            />

            <PerformanceScorecard
              revenuePerformanceData={revenuePerformanceData}
              userHotelName={userHotelName}
              positionIndex={positionIndex}
              performancePercentage={performancePercentage}
            />
        </div>

          {/* Charts Grid - Perfectly aligned with consistent heights */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Left: Performance Radar Analysis */}
            <div className="lg:col-span-1 h-[600px]">
              <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300 h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900">Performance Radar Analysis</h3>
            <div className="flex items-center gap-2">
              {loading && (
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">Loading...</span>
              )}
                    {!loading && revenuePerformanceData.length === 0 && (
                      <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-lg">No competitor data</span>
                    )}
                    {!loading && revenuePerformanceData.length > 0 && (
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded-lg">
                        {revenuePerformanceData.length} hotels analyzed
                      </span>
                  )}
            </div>
          </div>
          
                <div className="flex-1 min-h-0">
                  {revenuePerformanceData.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <div className="text-center">
                        <div className="text-4xl mb-2">📊</div>
                        <p className="text-sm">No competitor data available</p>
                        <p className="text-xs mt-1">Load competitor data to see performance analysis</p>
                      </div>
                    </div>
                  ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={(() => {
                  // Transform data for radar chart
                  if (revenuePerformanceData.length === 0) return [];
                  
                  // Find our hotel data
                  const ourHotel = revenuePerformanceData.find(item => 
                    item.hotel === userHotelName || item.hotel === "Our Hotel"
                  );
                  
                  if (!ourHotel) return [];
                  
                  // Calculate market averages for comparison
                  const competitors = revenuePerformanceData.filter(item => 
                    item.hotel !== userHotelName && item.hotel !== "Our Hotel"
                  );
                  
                      const marketAvgRevenue = competitors && competitors.length > 0 
                        ? competitors.reduce((sum, item) => sum + (item.revenue || 0), 0) / competitors.length 
                    : ourHotel.revenue;
                  
                      const marketAvgPrice = competitors && competitors.length > 0 
                        ? competitors.reduce((sum, item) => sum + ((item.revenue || 0) / 0.80), 0) / competitors.length 
                    : (ourHotel.revenue / 0.85);
                  
                  // Create radar chart data
                  const radarData = [
                    {
                      metric: "Revenue Performance",
                      ourHotel: Math.min(100, (ourHotel.revenue / marketAvgRevenue) * 100),
                      marketAvg: 100,
                          fullMark: 120,
                          ourValue: ourHotel.revenue,
                          marketValue: marketAvgRevenue
                    },
                    {
                      metric: "Price Positioning",
                      ourHotel: Math.min(100, ((ourHotel.revenue / 0.85) / marketAvgPrice) * 100),
                      marketAvg: 100,
                          fullMark: 120,
                          ourValue: ourHotel.revenue / 0.85,
                          marketValue: marketAvgPrice
                    },
                    {
                      metric: "Market Share",
                          ourHotel: Math.min(100, (ourHotel.revenue / (ourHotel.revenue + (competitors && competitors.length > 0 ? competitors.reduce((sum, item) => sum + (item.revenue || 0), 0) : 0))) * 200),
                      marketAvg: 100,
                          fullMark: 120,
                          ourValue: ourHotel.revenue,
                          marketValue: ourHotel.revenue + (competitors && competitors.length > 0 ? competitors.reduce((sum, item) => sum + (item.revenue || 0), 0) : 0)
                    },
                    {
                      metric: "Occupancy Efficiency",
                      ourHotel: 85, // Our occupancy rate
                      marketAvg: 80, // Market average
                            fullMark: 120,
                          ourValue: 85,
                          marketValue: 80
                    },
                    {
                      metric: "Competitive Advantage",
                            ourHotel: Math.min(100, ((ourHotel.revenue / marketAvgRevenue) * 100) + 15), // Bonus for being above market
                      marketAvg: 100,
                          fullMark: 120,
                            ourValue: ourHotel.revenue,
                          marketValue: marketAvgRevenue
                    }
                  ];
                  
                  return radarData;
                      })()}>
                  <PolarGrid stroke="#e5e7eb" />
                        <PolarAngleAxis dataKey="metric" tick={{ fill: "#6b7280", fontSize: 10 }} />
                        <PolarRadiusAxis tick={{ fill: "#9ca3af", fontSize: 8 }} />
                  <Radar
                    name="Our Hotel"
                    dataKey="ourHotel"
                    stroke="#ff0000"
                    fill="#ff0000"
                    fillOpacity={0.3}
                    strokeWidth={2}
                  />
                  <Radar
                    name="Market Average"
                    dataKey="marketAvg"
                    stroke="#94a3b8"
                          fill="none"
                    strokeDasharray="6 6"
                          strokeWidth={2}
                  />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
          
                {/* Key Metrics Below Chart */}
                {revenuePerformanceData.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-4 text-center">
                      <div>
                        <p className="text-xs text-gray-600">Market Position</p>
                        <p className="text-lg font-semibold text-emerald-600">1</p>
                </div>
                        <div>
                        <p className="text-xs text-gray-600">Performance vs Market</p>
                        <p className="text-lg font-semibold text-blue-600">+217.7%</p>
                  </div>
                        <div>
                        <p className="text-xs text-gray-600">Occupancy Rate</p>
                        <p className="text-lg font-semibold text-purple-600">85%</p>
                  </div>
                        <div>
                        <p className="text-xs text-gray-600">Revenue per Room</p>
                        <p className="text-lg font-semibold text-arkus-600">
                          {todayAverageRevenue !== null 
                            ? currency.format(todayAverageRevenue) 
                            : "$0"
                          }
                        </p>
                </div>
                </div>
                  </div>
                )}
                </div>
              </div>

            {/* Top Right: Competitive Gap Analysis */}
            <div className="lg:col-span-1 h-[600px]">
              <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300 h-full flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <div>
                    <h3 className="text-lg font-semibold text-gray-900">Competitive Gap Analysis</h3>
              <p className="text-sm text-gray-600 mt-1">
                Price gap evolution: Our hotel vs. market average
              </p>
            </div>
            <div className="flex items-center gap-2">
                    {loading && (
                      <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">Loading...</span>
                    )}
                    {!loading && supabaseData.length === 0 && (
                      <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-lg">No data</span>
                    )}
                    {!loading && supabaseData.length > 0 && (
                <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                  {(() => {
                    // Use the same logic as Historical Prices to calculate our average price
                    let filteredData = supabaseData;
                    const effectiveRoomType = clickedRoomType || selectedRoomType;
                    if (effectiveRoomType !== "all") {
                      filteredData = filteredData.filter((item) => 
                        standardizeRoomType(item.room_type) === effectiveRoomType
                      );
                    }
                    
                    if (range && range > 0) {
                      const endDate = new Date("2025-10-30");
                      const rangeStart = new Date(endDate);
                      rangeStart.setDate(endDate.getDate() - range);
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
                    
                    // Calculate average price using the same logic as Historical Prices
                    const validPrices = filteredData
                            .map(item => convertPriceToSelectedCurrency(item.processed_price, item.processed_currency))
                      .filter(price => price > 0);
                    
                        if (!validPrices || validPrices.length === 0) return "No valid prices";
                    
                    const ourAvgPrice = validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length;
                    
                    // For market comparison, we'll use a simple estimate based on our data
                    // This ensures consistency with Historical Prices
                    const marketEstimate = ourAvgPrice * 1.1; // Assume market is 10% higher
                    const gap = ourAvgPrice - marketEstimate;
                    const gapPercent = (gap / marketEstimate) * 100;
                    
                    return `${gap > 0 ? '+' : ''}${gapPercent.toFixed(1)}% gap`;
                  })()}
                </span>
              )}
            </div>
          </div>
          
                <div className="flex-1 min-h-0">
            {(() => {
              if (supabaseData.length === 0) {
                return (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📊</div>
                      <p className="text-sm">No data available</p>
                      <p className="text-xs mt-1">Load data to see price gaps</p>
                    </div>
                  </div>
                );
              }
              
              // Use the exact same logic as Historical Prices
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
              
              // Group by date and calculate average price (same logic as Historical Prices)
              const dailyPrices: Record<string, { total: number; count: number; dates: string[]; roomTypes: Set<string> }> = {};
              
              filteredData.forEach((item: any) => {
                    const checkinDate = item.checkin_date;
                if (!checkinDate) return;
                
                let dateStr = checkinDate;
                if (checkinDate.includes("T")) {
                  dateStr = checkinDate.split("T")[0];
                }
                
                    // Clean price in MXN (no conversion)
                const rawPrice = item.price;
                if (!rawPrice) return;
                
                    const priceInMXN = getPriceValue(rawPrice);
                
                    if (priceInMXN > 0) {
                  if (!dailyPrices[dateStr]) {
                    dailyPrices[dateStr] = { 
                      total: 0, 
                      count: 0, 
                      dates: [], 
                      roomTypes: new Set() 
                    };
                  }
                      dailyPrices[dateStr].total += priceInMXN;
                  dailyPrices[dateStr].count += 1;
                  dailyPrices[dateStr].dates.push(dateStr);
                  dailyPrices[dateStr].roomTypes.add(standardizeRoomType(item.room_type));
                }
              });
              
              if (Object.keys(dailyPrices).length === 0) {
                return (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📅</div>
                      <p className="text-sm">No data for selected range</p>
                      <p className="text-xs mt-1">Try adjusting filters or date range</p>
                    </div>
                  </div>
                );
              }
              
              // Convert to chart format and sort by date (same logic as Historical Prices)
              const gapData = Object.entries(dailyPrices)
                .map(([date, data]) => {
                  const dateObj = new Date(date);
                  const label = new Intl.DateTimeFormat("en-US", {
                    month: "short",
                    day: "numeric",
                  }).format(dateObj);
                  
                      let ourPrice = Math.round(data.total / data.count * 100) / 100;
                      // Convert to selected currency if needed
                      if (selectedCurrency === "USD") {
                        ourPrice = ourPrice / exchangeRate;
                      }
                  const marketEstimate = ourPrice * 1.1; // Market is 10% higher
                  const gap = ourPrice - marketEstimate;
                  const gapPercent = (gap / marketEstimate) * 100;
                  
                  return {
                    day: label,
                    date: date,
                    ours: ourPrice,
                    marketAvg: Math.round(marketEstimate * 100) / 100,
                    gap: Math.round(gap * 100) / 100,
                    gapPercent: Math.round(gapPercent * 10) / 10,
                    ourBookings: data.count
                  };
                })
                .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
              
              return (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={gapData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorOurs" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="10%" stopColor="#ff0000" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#ff0000" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="colorMarket" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="10%" stopColor="#94a3b8" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.6} />
                    <XAxis 
                      dataKey="day" 
                      stroke="#6b7280" 
                      tickLine={false} 
                      axisLine={false} 
                      tickMargin={8}
                      interval="preserveStartEnd"
                    />
                    <YAxis 
                      stroke="#6b7280" 
                      tickLine={false} 
                      axisLine={false} 
                      tickMargin={8}
                          tickFormatter={(value) => {
                            if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                            else if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
                            else return `$${value.toLocaleString()}`;
                          }}
                    />
                        <Tooltip 
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            const data = payload[0].payload;
                            return (
                              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg">
                                <div className="font-medium text-gray-900">{label}</div>
                                    <div className="text-gray-700">Our Price: {currency.format(data.ours)}</div>
                                    <div className="text-gray-600">Market Estimate: {currency.format(data.marketAvg)}</div>
                                <div className={`font-medium ${data.gap >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                      Gap: {data.gapPercent.toFixed(1)}%
                                </div>
                                <div className="text-gray-500">Bookings: {data.ourBookings.toLocaleString()}</div>
                                <div className="text-gray-400 text-xs">{data.date}</div>
                              </div>
                            );
                          }}
                        />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="marketAvg" 
                      name="Market Estimate" 
                      stroke="#94a3b8" 
                      strokeDasharray="6 6" 
                      strokeWidth={2} 
                      dot={false}
                      fill="url(#colorMarket)"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="ours" 
                      name="Our Hotel" 
                      stroke="#ff0000" 
                      fill="url(#colorOurs)" 
                      strokeWidth={3}
                      dot={{ fill: "#ff0000", strokeWidth: 2, r: 3 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              );
            })()}
          </div>
          
          {/* Gap Analysis Summary */}
          {(() => {
            if (supabaseData.length === 0) return null;
            
            // Use the same logic as Historical Prices
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
            
            // Calculate average price using the same logic as Historical Prices
            const validPrices = filteredData
                  .map(item => {
                    return convertPriceToSelectedCurrency(item.processed_price, item.processed_currency);
                  })
              .filter(price => price > 0);
              
                if (!validPrices || validPrices.length === 0) return null;
            
            const ourAvgPrice = validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length;
            const marketEstimate = ourAvgPrice * 1.1; // Market is 10% higher
            const priceGap = ourAvgPrice - marketEstimate;
            const gapPercent = (priceGap / marketEstimate) * 100;
            
            return (
              <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-xs text-gray-600">Our Avg Price</p>
                    <p className="text-lg font-semibold text-arkus-600">
                          {currency.format(ourAvgPrice)} {selectedCurrency}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-600">Market Estimate</p>
                    <p className="text-lg font-semibold text-blue-600">
                          {currency.format(marketEstimate)} {selectedCurrency}
                    </p>
                    <p className="text-xs text-gray-400">(10% above ours)</p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-600">Price Gap</p>
                    <p className={`text-lg font-semibold ${priceGap >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {priceGap >= 0 ? '+' : ''}{currency.format(priceGap)} {selectedCurrency}
                    </p>
                    <p className="text-xs text-gray-500">
                            {priceGap >= 0 ? 'Above' : 'Below'} market
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-xs text-gray-600">Gap %</p>
                    <p className={`text-lg font-semibold ${gapPercent >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {gapPercent >= 0 ? '+' : ''}{gapPercent.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500">vs market estimate</p>
                  </div>
                </div>
                
                {/* Gap Interpretation */}
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700 mb-2">Gap Analysis:</p>
                    <p className="text-xs text-gray-600">
                      {gapPercent > 10 ? 
                        `Your hotel is ${gapPercent.toFixed(1)}% above market estimate. Consider competitive pricing strategies.` :
                        gapPercent < -10 ? 
                        `Your hotel is ${Math.abs(gapPercent).toFixed(1)}% below market estimate. You may have room to increase prices.` :
                        `Your hotel is well-positioned within ${Math.abs(gapPercent).toFixed(1)}% of market estimate.`
                      }
                    </p>
                    {(() => {
                      const effectiveRoomType = clickedRoomType || selectedRoomType;
                      return effectiveRoomType !== "all" && (
                        <p className="text-xs text-gray-500 mt-1">
                          Analysis based on {effectiveRoomType} rooms only
                        </p>
                      );
                    })()}
                  </div>
                </div>
                
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Bottom Left: Revenue by Room Type Chart */}
            <div className="lg:col-span-1 h-[600px]">
              <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300 h-full flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {userHotelName ? `${userHotelName} - Revenue by Room Type` : "Revenue by Room Type"}
                      {clickedRoomType && (
                        <span className="text-sm text-arkus-600 ml-2">({clickedRoomType})</span>
                      )}
                    </h3>
                  </div>
                  <div className="flex items-center gap-2">
                    {loading && (
                      <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">Loading...</span>
                    )}
                    {!loading && filteredSupabaseData.length === 0 && (
                      <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-lg">No data</span>
                    )}
                    {!loading && filteredSupabaseData.length > 0 && (
                      <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                        {`${filteredSupabaseData.length} bookings / ${new Set(filteredSupabaseData.map(item => standardizeRoomType(item.room_type))).size} room types`}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-1 min-h-0">
                  {revenueByRoomTypeData.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <div className="text-center">
                        <div className="text-4xl mb-2">📊</div>
                        <p className="text-sm">No data available</p>
                        <p className="text-xs mt-1">Load data to see revenue by room type</p>
                      </div>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={revenueByRoomTypeData} margin={{ top: 20, right: 12, left: 4, bottom: 8 }} barCategoryGap="8%" maxBarSize={80}>
                        <defs>
                          <linearGradient id="hotelBarGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="10%" stopColor="#ff0000" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#ff6666" stopOpacity={0.7} />
                          </linearGradient>
                          <linearGradient id="grayBarGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="10%" stopColor="#9ca3af" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#d1d5db" stopOpacity={0.7} />
                          </linearGradient>
                          <linearGradient id="hoverBarGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="10%" stopColor="#ff0000" stopOpacity={1} />
                            <stop offset="100%" stopColor="#ff6666" stopOpacity={0.9} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.6} />
                        <XAxis dataKey="room_type" stroke="#6b7280" tickLine={false} axisLine={false} tickMargin={8} />
                        <YAxis stroke="#6b7280" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => {
                          if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M ${selectedCurrency}`;
                          else if (value >= 1000) return `$${(value / 1000).toFixed(0)}K ${selectedCurrency}`;
                          else return `$${value} ${selectedCurrency}`;
                        }} />
                        <Tooltip formatter={(value: number, name: string) => [
                          name === "total_revenue" ? currency.format(value) : name === "avg_price" ? currency.format(value) : value,
                          name === "total_revenue" ? "Total Revenue" : name === "avg_price" ? "Average Price" : "Count",
                        ]} labelFormatter={(label: string) => `Room Type: ${label}`} cursor={false} content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const data = payload[0].payload;
                          return (
                            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg">
                              <div className="font-medium text-gray-900">{label}</div>
                              <div className="text-gray-700">Total Revenue: {currency.format(data.total_revenue)}</div>
                              <div className="text-gray-600">Average Price: {currency.format(data.avg_price)}</div>
                              <div className="text-gray-500">Bookings: {data.count}</div>
                              {data.min_price && data.max_price && (
                                <div className="text-gray-500">Price Range: {currency.format(data.min_price)} - {currency.format(data.max_price)}</div>
                              )}
              </div>
            );
                        }} />
                        <Bar dataKey="total_revenue" radius={[8, 8, 0, 0]} style={{ cursor: "pointer" }} onClick={handleBarClick}>
                          {(() => {
                            if (filteredSupabaseData.length === 0) {
                              return [
                                { room_type: "Suite", total_revenue: 3237422, avg_price: 2200, count: 2 },
                                { room_type: "Queen", total_revenue: 1530836, avg_price: 1500, count: 3 },
                                { room_type: "Standard", total_revenue: 497153, avg_price: 1200, count: 5 },
                                { room_type: "Business", total_revenue: 329344, avg_price: 1800, count: 4 },
                              ].map((entry, index) => (
                                <Cell key={`cell-${index}`} fill="url(#hotelBarGradient)" />
                              ));
                            }

                            const roomTypeData: Record<string, number> = {};
                            filteredSupabaseData.forEach((item: any) => {
                              const roomType = standardizeRoomType(item.room_type);
                              const price = getPriceValue(item.price);
                              roomTypeData[roomType] = (roomTypeData[roomType] || 0) + price;
                            });
                            const entries = Object.entries(roomTypeData).map(([room_type, total_revenue]) => ({ room_type, total_revenue }));
                            const sorted = entries.sort((a, b) => b.total_revenue - a.total_revenue);
                            const maxRevenue = Math.max(...sorted.map((item: any) => item.total_revenue));

                            return sorted.map((entry: any, index: number) => {
                              let fillColor;
                              if (clickedRoomType === entry.room_type) {
                                fillColor = "url(#hoverBarGradient)";
                              } else if (hoveredIndex !== null && index === hoveredIndex) {
                                fillColor = "url(#hoverBarGradient)";
                              } else {
                                if (clickedRoomType) {
                                  fillColor = "url(#grayBarGradient)";
                                } else {
                                  fillColor = entry.total_revenue === maxRevenue ? "url(#hotelBarGradient)" : "url(#grayBarGradient)";
                                }
                              }

                              return (
                                <Cell key={`cell-${index}`} fill={fillColor} />
                              );
                            });
          })()}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
        </div>

                <div className="text-xs text-gray-500 mt-4 text-center">
                  💡 Click on any bar to filter Total Revenue and Historical Prices by that room type
      </div>
              </div>
            </div>

            {/* Bottom Right: Historical Prices Chart */}
            <div className="lg:col-span-1 h-[600px]">
              <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300 h-full flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {userHotelName ? `${userHotelName} - Historical Prices` : "Historical Prices"}
                      {clickedRoomType && (
                        <span className="text-sm text-arkus-600 ml-2">({clickedRoomType})</span>
                      )}
                      {selectedRoomType !== "all" && (
                        <span className="text-sm text-arkus-600 ml-2">({selectedRoomType})</span>
                      )}
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Price evolution over time by room type
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {error && (
                      <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-lg">Error</span>
                    )}
                    {!loading && !error && historicalPriceSeries.length === 0 && (
                      <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-lg">No data</span>
                    )}
                  </div>
                </div>
                
                <div className="flex-1 min-h-0">
                  {historicalPriceSeries.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                      <div className="text-center">
                        <div className="text-4xl mb-2">📈</div>
                        <p className="text-sm">No data available</p>
                        <p className="text-xs mt-1">Load data to see historical prices</p>
                      </div>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={historicalPriceSeries} margin={{ top: 8, right: 80, left: 4, bottom: 0 }}>
                        <defs>
                          <linearGradient id="priceArea" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ff0000" stopOpacity={0.18} />
                            <stop offset="100%" stopColor="#ff0000" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.6} />
                        <XAxis dataKey="day" stroke="#6b7280" tickLine={false} axisLine={false} tickMargin={8} />
                        <YAxis 
                          stroke="#6b7280" 
                          tickLine={false} 
                          axisLine={false} 
                          tickMargin={8}
                          tickFormatter={(value) => {
                            if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                            else if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
                            else return `$${value}`;
                          }}
                        />
                        <Tooltip content={({ active, payload, label }) => {
                          if (!active || !payload?.length) return null;
                          const data = payload[0].payload;
                          const effectiveRoomType = clickedRoomType || selectedRoomType;
                          return (
                            <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg">
                              <div className="font-medium text-gray-900">{label}</div>
                              <div className="text-gray-700">Price: {currency.format(data.price)}</div>
                              <div className="text-gray-600">Date: {data.date}</div>
                              <div className="text-gray-500">Bookings: {data.count}</div>
                              {data.roomTypes && data.roomTypes.length > 0 && (
                                <div className="text-gray-500">
                                  Room Types: {data.roomTypes.join(", ")}
                                </div>
                              )}
                              {effectiveRoomType === "all" && (
                                <div className="text-gray-400 text-xs">
                                  Average of all room types
                                </div>
                              )}
                            </div>
                          );
                        }} />
                        <ReferenceArea y1={targetMin} y2={targetMax} fill="#10b981" fillOpacity={0.08} stroke="#10b981" strokeOpacity={0.15} />
                        <ReferenceLine y={avgFilteredPrice} stroke="#94a3b8" strokeDasharray="6 6" label={{
                          value: `Avg ${currency.format(avgFilteredPrice)}`,
                          position: "right",
                          fill: "#64748b",
                          fontSize: 10,
                        }} />
                        <Area type="monotone" dataKey="price" stroke="#ff0000" fill="url(#priceArea)" strokeWidth={3} />
                      </AreaChart>
                    </ResponsiveContainer>
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
