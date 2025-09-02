import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine, ReferenceArea } from "recharts";
import type { IntlNumberFormat } from "@/lib/dataUtils";

interface HistoricalPriceData {
  day: string;
  price: number;
  date: string;
  count: number;
  roomTypes: string[];
  totalPrice: number;
}

interface HistoricalPricesChartProps {
  data: HistoricalPriceData[];
  loading: boolean;
  error: string | null;
  currency: IntlNumberFormat;
  userHotelName: string;
  clickedRoomType: string | null;
  selectedRoomType: string;
  targetMin: number;
  targetMax: number;
}

export default function HistoricalPricesChart({
  data,
  loading,
  error,
  currency,
  userHotelName,
  clickedRoomType,
  selectedRoomType,
  targetMin,
  targetMax
}: HistoricalPricesChartProps) {
  // Calculate average price for reference line
  const avgPrice = data.length > 0 
    ? data.reduce((sum, item) => sum + item.price, 0) / data.length 
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-arkus-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading historical prices...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-500">
        <div className="text-center">
          <div className="text-4xl mb-2">⚠️</div>
          <p className="text-sm">Error loading data</p>
          <p className="text-xs mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">📈</div>
          <p className="text-sm">No historical data available</p>
          <p className="text-xs mt-1">Load data to see price evolution</p>
        </div>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-900">
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
          <span className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-lg">
            {data.length} data points
          </span>
        </div>
      </div>
      
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 80, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="priceArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ff0000" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#ff0000" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.6} />
            <XAxis 
              dataKey="day" 
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
              tickFormatter={(value) => currency.format(value)}
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
            <ReferenceLine 
              y={avgPrice} 
              stroke="#94a3b8" 
              strokeDasharray="6 6" 
              label={{
                value: `Avg ${currency.format(avgPrice)}`,
                position: "right",
                fill: "#64748b",
                fontSize: 10,
              }} 
            />
            <Area 
              type="monotone" 
              dataKey="price" 
              stroke="#ff0000" 
              fill="url(#priceArea)" 
              strokeWidth={3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      {/* Price Statistics */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-600">Average Price</p>
            <p className="text-lg font-semibold text-arkus-600">
              {currency.format(avgPrice)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Price Range</p>
            <p className="text-lg font-semibold text-blue-600">
              {currency.format(
                Math.max(...data.map(item => item.price)) - Math.min(...data.map(item => item.price))
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Data Points</p>
            <p className="text-lg font-semibold text-emerald-600">{data.length}</p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Room Types</p>
            <p className="text-lg font-semibold text-purple-600">
              {new Set(data.flatMap(item => item.roomTypes)).size}
            </p>
          </div>
        </div>
        
        {/* Additional Info */}
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-center">
            <p className="text-xs text-gray-500">
              {selectedRoomType === "all" 
                ? `Showing average prices across all room types`
                : `Showing prices for ${selectedRoomType} rooms only`
              }
            </p>
            <p className="text-xs text-gray-400 mt-1">
              All prices displayed in {currency.resolvedOptions().currency}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
