import { memo } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";

interface RevenueByRoomTypeChartProps {
  filteredSupabaseData: any[];
  userHotelName: string;
  clickedRoomType: string | null;
  selectedRoomType: string;
  loading: boolean;
  currency: Intl.NumberFormat;
  selectedCurrency: string;
  hoveredIndex: number | null;
  handleBarClick: (data: any, index: number) => void;
  standardizeRoomType: (roomType: string) => string;
  cleanPrice: (priceString: string | number) => number;
}

const RevenueByRoomTypeChart = memo(({
  filteredSupabaseData,
  userHotelName,
  clickedRoomType,
  selectedRoomType,
  loading,
  currency,
  selectedCurrency,
  hoveredIndex,
  handleBarClick,
  standardizeRoomType,
  cleanPrice
}: RevenueByRoomTypeChartProps) => {
  const chartData = (() => {
    if (filteredSupabaseData.length === 0) {
      return [
        { room_type: "Suite", total_revenue: 3237422, avg_price: 2200, count: 2 },
        { room_type: "Queen", total_revenue: 1530836, avg_price: 1500, count: 3 },
        { room_type: "Standard", total_revenue: 497153, avg_price: 1200, count: 5 },
        { room_type: "Business", total_revenue: 329344, avg_price: 1800, count: 4 },
      ];
    }

    const roomTypeData: Record<string, { total_revenue: number; count: number; prices: number[] }> = {};
    filteredSupabaseData.forEach((item: any) => {
      const roomType = standardizeRoomType(item.room_type);
      const price = cleanPrice(item.price);
      
      if (price > 0) {
        if (!roomTypeData[roomType]) {
          roomTypeData[roomType] = { total_revenue: 0, count: 0, prices: [] };
        }
        roomTypeData[roomType].total_revenue += price;
        roomTypeData[roomType].count += 1;
        roomTypeData[roomType].prices.push(price);
      }
    });

    const aggregatedData = Object.entries(roomTypeData).map(([roomType, data]) => ({
      room_type: roomType,
      total_revenue: data.total_revenue,
      avg_price: Math.round(data.total_revenue / data.count),
      count: data.count,
      min_price: Math.min(...data.prices),
      max_price: Math.max(...data.prices)
    }));

    return aggregatedData.sort((a, b) => b.total_revenue - a.total_revenue);
  })();

  return (
    <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">
            {userHotelName ? `${userHotelName} - Revenue by Room Type` : "Revenue by Room Type"}
            {clickedRoomType && (
              <span className="text-sm text-arkus-600 ml-2">({clickedRoomType})</span>
            )}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {!loading && (
            <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
              {`${filteredSupabaseData.length} bookings / ${new Set(filteredSupabaseData.map(item => standardizeRoomType(item.room_type))).size} room types`}
            </span>
          )}
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 12, left: 4, bottom: 8 }} barCategoryGap="8%" maxBarSize={80}>
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
              if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
              else if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
              else return `$${value}`;
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
                  const price = cleanPrice(item.price);
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
      </div>

      <div className="text-xs text-gray-500 mt-4 text-center">
        💡 Click on any bar to filter Total Revenue and Historical Prices by that room type
      </div>
    </div>
  );
});

RevenueByRoomTypeChart.displayName = 'RevenueByRoomTypeChart';

export default RevenueByRoomTypeChart;
