import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";
import type { IntlNumberFormat } from "@/lib/dataUtils";

interface GapAnalysisData {
  date: string;
  ourPrice: number;
  marketAvg: number;
  gap: number;
}

interface CompetitiveGapChartProps {
  data: GapAnalysisData[];
  loading: boolean;
  currency: IntlNumberFormat;
  userHotelName: string;
}

export default function CompetitiveGapChart({ 
  data, 
  loading, 
  currency,
  userHotelName 
}: CompetitiveGapChartProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-arkus-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading gap analysis...</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">📈</div>
          <p className="text-sm">No gap analysis data available</p>
          <p className="text-xs mt-1">Load data to see price gaps</p>
        </div>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Competitive Gap Analysis</h3>
          <p className="text-sm text-gray-600 mt-1">
            Price gap evolution: Our hotel vs. market average
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
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
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
              dataKey="date" 
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
            <Tooltip 
              formatter={(value: number, name: string) => [
                currency.format(value),
                name === "ourPrice" ? "Our Price" : "Market Average"
              ]}
              labelFormatter={(label: string) => `Date: ${label}`}
            />
            <Legend />
            <Area 
              type="monotone" 
              dataKey="marketAvg" 
              name="Market Average" 
              stroke="#94a3b8" 
              fill="url(#colorMarket)" 
              strokeWidth={2}
              strokeDasharray="6 6"
            />
            <Area 
              type="monotone" 
              dataKey="ourPrice" 
              name={`${userHotelName || "Our Hotel"}`} 
              stroke="#ff0000" 
              fill="url(#colorOurs)" 
              strokeWidth={3}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      
      {/* Gap Analysis Summary */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-gray-600">Our Avg Price</p>
            <p className="text-lg font-semibold text-arkus-600">
              {currency.format(
                data.reduce((sum, item) => sum + item.ourPrice, 0) / data.length
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Market Avg</p>
            <p className="text-lg font-semibold text-blue-600">
              {currency.format(
                data.reduce((sum, item) => sum + item.marketAvg, 0) / data.length
              )}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Avg Gap</p>
            <p className="text-lg font-semibold text-emerald-600">
              {currency.format(
                data.reduce((sum, item) => sum + item.gap, 0) / data.length
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
