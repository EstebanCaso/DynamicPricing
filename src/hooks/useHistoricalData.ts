import { useMemo, useState, useEffect } from 'react';
import { standardizeRoomType, type ProcessedHotelData } from '@/lib/dataUtils';
import { type Currency } from '@/lib/dataUtils';

interface HistoricalDataParams {
  supabaseData: ProcessedHotelData[];
  selectedRoomType: string;
  clickedRoomType: string | null;
  range: number;
  convertPriceToSelectedCurrency: (price: number, originalCurrency?: Currency) => number;
}

interface HistoricalPoint {
  day: string;
  revenue: number;
  price: number;
  date: string;
  count: number;
  roomTypes: string[];
}

export const useHistoricalData = ({
  supabaseData,
  selectedRoomType,
  clickedRoomType,
  range,
  convertPriceToSelectedCurrency
}: HistoricalDataParams) => {
  
  const [historicalPrices, setHistoricalPrices] = useState<HistoricalPoint[]>([]);

  // Process historical revenue data
  const processHistoricalRevenue = useMemo(() => {
    return (data: ProcessedHotelData[]) => {
      if (!data || data.length === 0) {
        setHistoricalPrices([]);
        return;
      }

      try {
        // Group by date and calculate daily revenue
        const dailyData: Record<string, {
          revenue: number;
          prices: number[];
          count: number;
          roomTypes: Set<string>;
        }> = {};

        data.forEach((item) => {
          const checkinDate = item.checkin_date;
          if (!checkinDate) return;

          let dateStr = checkinDate;
          if (checkinDate.includes("T")) {
            dateStr = checkinDate.split("T")[0];
          }

          const price = convertPriceToSelectedCurrency(item.processed_price, item.processed_currency);
          if (price <= 0) return;

          if (!dailyData[dateStr]) {
            dailyData[dateStr] = {
              revenue: 0,
              prices: [],
              count: 0,
              roomTypes: new Set()
            };
          }

          dailyData[dateStr].revenue += price;
          dailyData[dateStr].prices.push(price);
          dailyData[dateStr].count += 1;
          dailyData[dateStr].roomTypes.add(standardizeRoomType(item.room_type));
        });

        // Convert to array and sort by date
        const historicalData = Object.entries(dailyData)
          .map(([date, data]) => ({
            day: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            revenue: Math.round(data.revenue),
            price: Math.round(data.revenue / data.count),
            date: date,
            count: data.count,
            roomTypes: Array.from(data.roomTypes)
          }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        setHistoricalPrices(historicalData);
        
        console.log('📈 Historical Revenue Data:', historicalData);
      } catch (err) {
        console.error("Error processing historical revenue:", err);
        setHistoricalPrices([]);
      }
    };
  }, [convertPriceToSelectedCurrency]);

  // Calculate dynamic revenue
  const calculateDynamicRevenue = useMemo(() => {
    return () => {
      try {
        let filteredData = supabaseData;
        const effectiveRoomType = clickedRoomType || selectedRoomType;

        if (effectiveRoomType !== "all") {
          filteredData = filteredData.filter((item) => standardizeRoomType(item.room_type) === effectiveRoomType);
        }

        if (range && range > 0) {
          const endDate = new Date(); // Use current date instead of hardcoded date
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

        const totalRevenue = filteredData.reduce((sum, item) => {
          const price = convertPriceToSelectedCurrency(item.processed_price, item.processed_currency);
          return sum + price;
        }, 0);

        // Calculate average revenue per room instead of total
        const averageRevenuePerRoom = filteredData.length > 0 ? totalRevenue / filteredData.length : 0;
        
        return averageRevenuePerRoom;
      } catch (err) {
        console.error("Error calculating dynamic revenue:", err);
        return 0;
      }
    };
  }, [supabaseData, selectedRoomType, clickedRoomType, range, convertPriceToSelectedCurrency]);

  // Ranged data for charts
  const rangedData = useMemo(() => {
    const data = historicalPrices;
    if (!data || data.length === 0) return [];
    if (range >= data.length) return data;
    return data.slice(data.length - range);
  }, [range, historicalPrices]);

  // Brush state for chart interactions
  const [brush, setBrush] = useState<{ start: number; end: number } | null>(null);

  useEffect(() => {
    if (rangedData && rangedData.length > 0) {
      setBrush({ start: 0, end: Math.max(0, rangedData.length - 1) });
    } else {
      setBrush(null);
    }
  }, [rangedData]);

  // Visible data based on brush selection
  const visibleData = useMemo(() => {
    if (!rangedData || rangedData.length === 0) return [];
    if (!brush) return rangedData;
    const s = Math.max(0, Math.min(brush.start, rangedData.length - 1));
    const e = Math.max(s, Math.min(brush.end, rangedData.length - 1));
    return rangedData.slice(s, e + 1);
  }, [rangedData, brush]);

  // Average historical revenue
  const averageHistorical = useMemo(() => {
    if (!visibleData || visibleData.length === 0) return 0;
    const total = visibleData.reduce((acc, p) => acc + p.revenue, 0);
    return total / Math.max(1, visibleData.length);
  }, [visibleData]);

  // Sparkline data for revenue trends
  const sparkData = useMemo(() => {
    if (!rangedData || rangedData.length === 0) return [];
    const dataLength = Math.min(rangedData.length, 14);
    return rangedData.slice(-dataLength).map((item, i) => ({
      day: item.day,
      revenue: item.revenue,
    }));
  }, [rangedData, range]);

  return {
    historicalPrices,
    rangedData,
    brush,
    setBrush,
    visibleData,
    averageHistorical,
    sparkData,
    processHistoricalRevenue,
    calculateDynamicRevenue
  };
};

