import { useMemo } from 'react';
import { standardizeRoomType, type ProcessedHotelData } from '@/lib/dataUtils';
import { type Currency } from '@/lib/dataUtils';

interface RevenueAnalysisParams {
  supabaseData: ProcessedHotelData[];
  selectedRoomType: string;
  clickedRoomType: string | null;
  range: number;
  selectedCurrency: Currency;
  convertPriceToSelectedCurrency: (price: number, originalCurrency?: Currency) => number;
}

export const useRevenueAnalysis = ({
  supabaseData,
  selectedRoomType,
  clickedRoomType,
  range,
  selectedCurrency,
  convertPriceToSelectedCurrency
}: RevenueAnalysisParams) => {
  
  // Filter data based on room type and date range
  const filteredSupabaseData = useMemo(() => {
    if (!supabaseData || supabaseData.length === 0) return [];
    
    let filtered = supabaseData;
    const effectiveRoomType = clickedRoomType || selectedRoomType;
    
    if (effectiveRoomType !== "all") {
      filtered = filtered.filter((item) => standardizeRoomType(item.room_type) === effectiveRoomType);
    }

    if (range && range > 0) {
      const endDate = new Date("2025-10-30");
      const rangeStart = new Date(endDate);
      rangeStart.setDate(endDate.getDate() - range);
      
      filtered = filtered.filter((item) => {
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

  // Calculate average filtered price
  const avgFilteredPrice = useMemo(() => {
    if (!filteredSupabaseData || filteredSupabaseData.length === 0) return 0;
    
    const total = filteredSupabaseData.reduce((sum, item) => {
      const price = convertPriceToSelectedCurrency(item.processed_price, item.processed_currency);
      return sum + price;
    }, 0);
    
    return Math.round(total / filteredSupabaseData.length);
  }, [filteredSupabaseData, convertPriceToSelectedCurrency]);

  // Calculate price statistics
  const priceStats = useMemo(() => {
    if (supabaseData.length === 0) return null;

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

    // Calculate prices with real-time currency conversion
    const validPrices = filteredData
      .map(item => convertPriceToSelectedCurrency(item.processed_price, item.processed_currency))
      .filter(price => price > 0);

    if (validPrices.length === 0) return null;

    // Calculate statistics in selected currency
    const avgPrice = validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length;
    const minPrice = Math.min(...validPrices);
    const maxPrice = Math.max(...validPrices);
    const priceRange = maxPrice - minPrice;

    const roomTypes = Array.from(new Set(filteredData.map(item => standardizeRoomType(item.room_type))));

    return {
      avgPrice: Math.round(avgPrice * 100) / 100,
      priceRange: Math.round(priceRange * 100) / 100,
      count: validPrices.length,
      minPrice: Math.round(minPrice * 100) / 100,
      maxPrice: Math.round(maxPrice * 100) / 100,
      roomTypes,
      totalRevenue: validPrices.reduce((sum, price) => sum + price, 0)
    };
  }, [supabaseData, selectedRoomType, clickedRoomType, range, convertPriceToSelectedCurrency]);

  // Calculate revenue by room type
  const revenueByRoomTypeData = useMemo(() => {
    if (!filteredSupabaseData || filteredSupabaseData.length === 0) return [];

    const roomTypeData: Record<string, {
      total_revenue: number;
      avg_price: number;
      count: number;
      min_price?: number;
      max_price?: number;
    }> = {};

    filteredSupabaseData.forEach((item) => {
      const roomType = standardizeRoomType(item.room_type);
      const price = convertPriceToSelectedCurrency(item.processed_price, item.processed_currency);
      
      if (price > 0) {
        if (!roomTypeData[roomType]) {
          roomTypeData[roomType] = {
            total_revenue: 0,
            avg_price: 0,
            count: 0,
            min_price: price,
            max_price: price
          };
        }
        
        roomTypeData[roomType].total_revenue += price;
        roomTypeData[roomType].count += 1;
        roomTypeData[roomType].min_price = Math.min(roomTypeData[roomType].min_price!, price);
        roomTypeData[roomType].max_price = Math.max(roomTypeData[roomType].max_price!, price);
      }
    });

    // Calculate average prices
    Object.keys(roomTypeData).forEach(roomType => {
      const data = roomTypeData[roomType];
      data.avg_price = data.total_revenue / data.count;
    });

    // Convert to array and sort by total revenue
    const aggregatedData = Object.entries(roomTypeData).map(([room_type, data]) => ({
      room_type,
      ...data
    }));

    // Sort by total revenue in descending order
    const result = aggregatedData.sort((a, b) => b.total_revenue - a.total_revenue);
    
    console.log(`📊 Revenue by Room Type (${selectedCurrency}):`, result.map(item => ({
      room_type: item.room_type,
      total_revenue: item.total_revenue,
      avg_price: item.avg_price
    })));
    
    return result;
  }, [filteredSupabaseData, convertPriceToSelectedCurrency, selectedCurrency]);

  // Get unique room types for filter dropdown
  const uniqueRoomTypes = useMemo(() => {
    if (!supabaseData || supabaseData.length === 0) return [];
    
    const types = new Set<string>();
    const rawRoomTypes = new Set<string>();
    
    supabaseData.forEach((item) => {
      rawRoomTypes.add(item.room_type);
      const roomType = standardizeRoomType(item.room_type);
      types.add(roomType);
    });
    
    console.log('🏠 Raw room types from data:', Array.from(rawRoomTypes).sort());
    console.log('🏷️ Standardized room types:', Array.from(types).sort());
    
    return Array.from(types).sort();
  }, [supabaseData]);

  return {
    filteredSupabaseData,
    avgFilteredPrice,
    priceStats,
    revenueByRoomTypeData,
    uniqueRoomTypes
  };
};

