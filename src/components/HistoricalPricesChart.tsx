import { memo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
} from "recharts";

interface HistoricalPricesChartProps {
  historicalPriceSeries: Array<{
    day: string;
    price: number;
    date: string;
    count: number;
    roomTypes: string[];
    totalPrice: number;
  }>;
  userHotelName: string;
  clickedRoomType: string | null;
  selectedRoomType: string;
  error: string | null;
  loading: boolean;
  historicalPrices: any[];
  currency: Intl.NumberFormat;
  targetMin: number;
  targetMax: number;
  avgFilteredPrice: number;
  selectedCurrency: string;
}

const HistoricalPricesChart = memo(({
  historicalPriceSeries,
  userHotelName,
  clickedRoomType,
  selectedRoomType,
  error,
  loading,
  historicalPrices,
  currency,
  targetMin,
  targetMax,
  avgFilteredPrice,
  selectedCurrency
}: HistoricalPricesChartProps) => {
  const HistoricalRevenueTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length || !historicalPriceSeries || historicalPriceSeries.length === 0) return null;
    const current = payload[0].value as number;
    const idx = historicalPriceSeries.findIndex(p => p.day === label);
    const prev = idx > 0 && historicalPriceSeries[idx - 1] ? historicalPriceSeries[idx - 1].price : undefined;
    const delta = prev !== undefined ? current - prev : 0;
    const deltaColor = delta > 0 ? "#ef4444" : delta < 0 ? "#10b981" : "#6b7280";
    const deltaSign = delta > 0 ? "+" : "";
    
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg">
        <div className="font-medium text-gray-900">{label}</div>
        <div className="text-gray-700">Price: {currency.format(current)}</div>
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
    <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
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
          {error && (
            <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-lg">Error</span>
          )}
          {!loading && !error && historicalPrices.length === 0 && (
            <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-lg">No data</span>
          )}
        </div>
      </div>
      
      <div className="h-80">
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
              tickFormatter={(value) => `$${value} ${selectedCurrency}`}
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
      </div>
    </div>
  );
});

HistoricalPricesChart.displayName = 'HistoricalPricesChart';

export default HistoricalPricesChart;
