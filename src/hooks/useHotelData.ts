import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  cleanPrice, 
  convertCurrency, 
  standardizeRoomType,
  fetchUserHotelData,
  fetchCompetitorData as fetchCompetitorDataFromUtils,
  logDataFlow,
  type Currency,
  type ProcessedHotelData 
} from '@/lib/dataUtils';

export interface UseHotelDataReturn {
  // Data states
  supabaseData: ProcessedHotelData[];
  competitorData: any[];
  userHotelName: string;
  currentUser: any;
  
  // Loading and error states
  loading: boolean;
  error: string | null;
  
  // Filtered data
  filteredData: ProcessedHotelData[];
  
  // Calculated metrics
  totalRevenue: number;
  todayAverageRevenue: number | null;
  historicalPriceSeries: any[];
  revenueByRoomTypeData: any[];
  performanceRadarData: any[];
  gapAnalysisData: any[];
  
  // Filter states
  selectedRoomType: string;
  setSelectedRoomType: (type: string) => void;
  clickedRoomType: string | null;
  setClickedRoomType: (type: string | null) => void;
  range: 7 | 30 | 90;
  setRange: (range: 7 | 30 | 90) => void;
  
  // Actions
  refreshData: () => Promise<void>;
  refreshCompetitors: () => Promise<void>;
}

export function useHotelData(
  selectedCurrency: Currency,
  exchangeRate: number
): UseHotelDataReturn {
  // Core data states
  const [supabaseData, setSupabaseData] = useState<ProcessedHotelData[]>([]);
  const [competitorData, setCompetitorData] = useState<any[]>([]);
  const [userHotelName, setUserHotelName] = useState<string>("");
  const [currentUser, setCurrentUser] = useState<any>(null);
  
  // Loading and error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter states
  const [selectedRoomType, setSelectedRoomType] = useState<string>("all");
  const [clickedRoomType, setClickedRoomType] = useState<string | null>(null);
  const [range, setRange] = useState<7 | 30 | 90>(30);
  
  // Calculated metrics
  const [todayAverageRevenue, setTodayAverageRevenue] = useState<number | null>(null);

  // Get current user
  const getCurrentUser = useCallback(async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      setCurrentUser(user);
      return user;
    } catch (err) {
      console.error("Error getting user:", err);
      return null;
    }
  }, []);

  // Fetch hotel data from Supabase
  const fetchHotelData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const user = await getCurrentUser();
      if (!user?.id) {
        throw new Error('User not authenticated');
      }

      logDataFlow('useHotelData', { userId: user.id }, 'Fetching user hotel data');

      const processedData = await fetchUserHotelData(user.id);

      if (processedData.length === 0) {
        setSupabaseData([]);
        return;
      }

      if (processedData.length > 0 && processedData[0].hotel_name) {
        setUserHotelName(processedData[0].hotel_name);
      }

      logDataFlow('useHotelData', { 
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
  }, [getCurrentUser]);

  // Fetch competitor data
  const fetchCompetitorData = useCallback(async () => {
    try {
      const competitors = await fetchCompetitorDataFromUtils();
      setCompetitorData(competitors || []);
    } catch (err) {
      console.error('Error fetching competitor data:', err);
      setCompetitorData([]);
    }
  }, []);

  // Refresh all data
  const refreshData = useCallback(async () => {
    await Promise.all([fetchHotelData(), fetchCompetitorData()]);
  }, [fetchHotelData, fetchCompetitorData]);

  // Refresh only competitor data
  const refreshCompetitors = useCallback(async () => {
    await fetchCompetitorData();
  }, [fetchCompetitorData]);

  // Filter data based on current filters
  const filteredData = useMemo(() => {
    if (!supabaseData.length) return [];

    let filtered = supabaseData;

    // Apply room type filter
    if (selectedRoomType !== "all") {
      filtered = filtered.filter(item => 
        standardizeRoomType(item.room_type) === selectedRoomType
      );
    }

    // Apply clicked room type filter
    if (clickedRoomType) {
      filtered = filtered.filter(item => 
        standardizeRoomType(item.room_type) === clickedRoomType
      );
    }

    // Apply date range filter
    if (range && range > 0) {
      const endDate = new Date("2025-10-30");
      const rangeStart = new Date(endDate);
      rangeStart.setDate(endDate.getDate() - range);

      filtered = filtered.filter(item => {
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

    return filtered;
  }, [supabaseData, selectedRoomType, clickedRoomType, range]);

  // Calculate total revenue
  const totalRevenue = useMemo(() => {
    return filteredData.reduce((sum, item) => {
      const price = convertCurrency(
        item.processed_price, 
        item.processed_currency || 'MXN', 
        selectedCurrency, 
        exchangeRate
      );
      return sum + price;
    }, 0);
  }, [filteredData, selectedCurrency, exchangeRate]);

  // Calculate average revenue per room
  const averageRevenuePerRoom = useMemo(() => {
    if (filteredData.length === 0) return 0;
    return totalRevenue / filteredData.length;
  }, [totalRevenue, filteredData.length]);

  // Update today's average revenue when filters change
  useEffect(() => {
    setTodayAverageRevenue(averageRevenuePerRoom);
  }, [averageRevenuePerRoom]);

  // Historical price series data
  const historicalPriceSeries = useMemo(() => {
    if (!filteredData.length) return [];

    const dailyPrices: Record<string, { total: number; count: number; dates: string[]; roomTypes: Set<string> }> = {};
    
    filteredData.forEach(item => {
      const checkinDate = item.checkin_date;
      if (!checkinDate) return;
      
      let dateStr = checkinDate;
      if (checkinDate.includes("T")) {
        dateStr = checkinDate.split("T")[0];
      }
      
      const price = convertCurrency(
        item.processed_price, 
        item.processed_currency || 'MXN', 
        selectedCurrency, 
        exchangeRate
      );
      
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

    return Object.entries(dailyPrices)
      .map(([date, data]) => {
        const dateObj = new Date(date);
        const label = new Intl.DateTimeFormat(selectedCurrency === "MXN" ? "es-MX" : "en-US", {
          month: "short",
          day: "numeric",
        }).format(dateObj);
        
        return {
          day: label,
          price: Math.round(data.total / data.count),
          date: date,
          count: data.count,
          roomTypes: Array.from(data.roomTypes),
          totalPrice: data.total
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredData, selectedCurrency, exchangeRate]);

  // Revenue by room type data
  const revenueByRoomTypeData = useMemo(() => {
    if (!filteredData.length) return [];

    const roomTypeData: Record<string, { totalRevenue: number; count: number; prices: number[] }> = {};
    
    filteredData.forEach(item => {
      const roomType = standardizeRoomType(item.room_type);
      const price = convertCurrency(
        item.processed_price, 
        item.processed_currency || 'MXN', 
        selectedCurrency, 
        exchangeRate
      );
      
      if (price > 0) {
        if (!roomTypeData[roomType]) {
          roomTypeData[roomType] = { totalRevenue: 0, count: 0, prices: [] };
        }
        roomTypeData[roomType].totalRevenue += price;
        roomTypeData[roomType].count += 1;
        roomTypeData[roomType].prices.push(price);
      }
    });

    return Object.entries(roomTypeData)
      .map(([roomType, data]) => ({
        roomType,
        totalRevenue: data.totalRevenue,
        avgPrice: Math.round(data.totalRevenue / data.count),
        bookings: data.count
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue);
  }, [filteredData, selectedCurrency, exchangeRate]);

  // Performance radar data
  const performanceRadarData = useMemo(() => {
    if (!filteredData.length || !competitorData.length) return [];

    const ourAvgPrice = filteredData.reduce((sum, item) => {
      const price = convertCurrency(
        item.processed_price, 
        item.processed_currency || 'MXN', 
        selectedCurrency, 
        exchangeRate
      );
      return sum + price;
    }, 0) / filteredData.length;

    const marketAvgPrice = ourAvgPrice * 1.15; // Estimate market average

    return [
      {
        metric: "Revenue Performance",
        ourHotel: Math.min(100, (ourAvgPrice / marketAvgPrice) * 100),
        marketAvg: 100,
        fullMark: 120
      },
      {
        metric: "Competitive Advantage",
        ourHotel: Math.min(100, ((ourAvgPrice - marketAvgPrice) / marketAvgPrice) * 200 + 100),
        marketAvg: 100,
        fullMark: 120
      },
      {
        metric: "Price Positioning",
        ourHotel: Math.min(100, (ourAvgPrice / marketAvgPrice) * 100),
        marketAvg: 100,
        fullMark: 120
      },
      {
        metric: "Occupancy Efficiency",
        ourHotel: 85,
        marketAvg: 80,
        fullMark: 100
      },
      {
        metric: "Market Share",
        ourHotel: Math.min(100, (filteredData.length / (filteredData.length + competitorData.length)) * 200),
        marketAvg: 100,
        fullMark: 120
      }
    ];
  }, [filteredData, competitorData, selectedCurrency, exchangeRate]);

  // Gap analysis data
  const gapAnalysisData = useMemo(() => {
    if (!filteredData.length) return [];

    const dailyPrices: Record<string, { total: number; count: number }> = {};
    
    filteredData.forEach(item => {
      const checkinDate = item.checkin_date;
      if (!checkinDate) return;
      
      let dateStr = checkinDate;
      if (checkinDate.includes("T")) {
        dateStr = checkinDate.split("T")[0];
      }
      
      const price = convertCurrency(
        item.processed_price, 
        item.processed_currency || 'MXN', 
        selectedCurrency, 
        exchangeRate
      );
      
      if (price > 0) {
        if (!dailyPrices[dateStr]) {
          dailyPrices[dateStr] = { total: 0, count: 0 };
        }
        dailyPrices[dateStr].total += price;
        dailyPrices[dateStr].count += 1;
      }
    });

    return Object.entries(dailyPrices)
      .map(([date, data]) => {
        const ourPrice = data.total / data.count;
        const marketEstimate = ourPrice * 1.1; // Market is 10% higher
        const gap = ourPrice - marketEstimate;
        
        return {
          date: new Date(date).toLocaleDateString(selectedCurrency === "MXN" ? "es-MX" : "en-US", { 
            month: "short", 
            day: "numeric" 
          }),
          ourPrice: Math.round(ourPrice),
          marketAvg: Math.round(marketEstimate),
          gap: Math.round(gap)
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [filteredData, selectedCurrency, exchangeRate]);

  // Fetch data on mount
  useEffect(() => {
    refreshData();
  }, []);

  return {
    // Data states
    supabaseData,
    competitorData,
    userHotelName,
    currentUser,
    
    // Loading and error states
    loading,
    error,
    
    // Filtered data
    filteredData,
    
    // Calculated metrics
    totalRevenue,
    todayAverageRevenue,
    historicalPriceSeries,
    revenueByRoomTypeData,
    performanceRadarData,
    gapAnalysisData,
    
    // Filter states
    selectedRoomType,
    setSelectedRoomType,
    clickedRoomType,
    setClickedRoomType,
    range,
    setRange,
    
    // Actions
    refreshData,
    refreshCompetitors,
  };
}
