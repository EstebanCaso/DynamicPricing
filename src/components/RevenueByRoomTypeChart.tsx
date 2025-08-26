import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Cell } from "recharts";
import type { IntlNumberFormat } from "@/lib/dataUtils";

interface RevenueByRoomTypeData {
  roomType: string;
  totalRevenue: number;
  avgPrice: number;
  bookings: number;
}

interface RevenueByRoomTypeChartProps {
  data: RevenueByRoomTypeData[];
  loading: boolean;
  currency: Intl.NumberFormat;
  userHotelName: string;
  clickedRoomType: string | null;
  onBarClick: (roomType: string) => void;
}

export default function RevenueByRoomTypeChart({
  data,
  loading,
  currency,
  userHotelName,
  clickedRoomType,
  onBarClick
}: RevenueByRoomTypeChartProps) {
  const handleBarClick = (chartData: any) => {
    // Find the data point that was clicked
    const clickedData = data.find(item => item.totalRevenue === chartData.totalRevenue);
    if (clickedData) {
      onBarClick(clickedData.roomType);
    }
  };
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-arkus-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading revenue data...</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <p className="text-sm">No revenue data available</p>
          <p className="text-xs mt-1">Load data to see revenue breakdown</p>
        </div>
      </div>
    );
  }

  const totalBookings = data.reduce((sum, item) => sum + item.bookings, 0);
  const maxRevenue = Math.max(...data.map(item => item.totalRevenue));

  return (
    <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">
            {userHotelName ? `${userHotelName} - Revenue by Room Type` : "Revenue by Room Type"}
            {clickedRoomType && (
              <span className="text-sm text-arkus-600 ml-2">({clickedRoomType})</span>
            )}
          </h3>
          <p className="text-sm text-gray-600 mt-1">Total revenue breakdown by room type</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
            {totalBookings} bookings
          </span>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 20, right: 12, left: 4, bottom: 8 }}>
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
            <XAxis 
              dataKey="roomType" 
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
                if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                else if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                else return `${value}`;
              }}
            />
            <Tooltip 
              formatter={(value: number, name: string) => [
                currency.format(value),
                name === "totalRevenue" ? "Total Revenue" : "Average Price"
              ]}
              labelFormatter={(label: string) => `Room Type: ${label}`}
            />
            <Bar 
              dataKey="totalRevenue" 
              radius={[4, 4, 0, 0]}
              style={{ cursor: "pointer" }}
              onClick={handleBarClick}
            >
              {data.map((entry, index) => {
                let fillColor;
                if (clickedRoomType === entry.roomType) {
                  fillColor = "url(#hoverBarGradient)";
                } else {
                  fillColor = entry.totalRevenue === maxRevenue ? "url(#hotelBarGradient)" : "url(#grayBarGradient)";
                }

                return (
                  <Cell key={`cell-${index}`} fill={fillColor} />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Room Type Summary */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="text-center">
          <p className="text-xs text-gray-500">
            {clickedRoomType 
              ? `Showing revenue for ${clickedRoomType} rooms only`
              : `Showing revenue across ${data.length} room types`
            }
          </p>
          <p className="text-xs text-gray-400 mt-1">
            💡 Click on any bar to filter data by that room type
          </p>
        </div>
      </div>
    </div>
  );
}
