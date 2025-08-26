import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Tooltip, Legend } from "recharts";
import type { IntlNumberFormat } from "@/lib/dataUtils";

interface PerformanceRadarChartProps {
  data: Array<{
    metric: string;
    ourHotel: number;
    marketAvg: number;
    fullMark: number;
    ourValue: number;
    marketValue: number;
  }>;
  loading: boolean;
  currency: IntlNumberFormat;
  userHotelName: string;
  revenuePerformanceData: any[];
}

export default function PerformanceRadarChart({ 
  data, 
  loading, 
  currency,
  userHotelName,
  revenuePerformanceData
}: PerformanceRadarChartProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-arkus-600 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Loading performance data...</p>
        </div>
      </div>
    );
  }

  if (data.length === 0 || !revenuePerformanceData || revenuePerformanceData.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-2">📊</div>
          <p className="text-sm">No performance data available</p>
          <p className="text-xs mt-1">Load competitor data to see performance analysis</p>
        </div>
      </div>
    );
  }

  // Calculate summary metrics that match the PerformanceScorecard
  const calculateSummaryMetrics = () => {
    if (!revenuePerformanceData || revenuePerformanceData.length === 0) {
      return { revenuePerformance: "N/A", competitiveAdvantage: "N/A" };
    }

    const ourHotel = revenuePerformanceData.find(item => 
      item.hotel === userHotelName || item.hotel === "Our Hotel"
    );

    if (!ourHotel) {
      return { revenuePerformance: "N/A", competitiveAdvantage: "N/A" };
    }

    const competitors = revenuePerformanceData.filter(item => 
      item.hotel !== userHotelName && item.hotel !== "Our Hotel"
    );

    const marketAvgRevenue = competitors && competitors.length > 0 
      ? competitors.reduce((sum, item) => sum + (item.revenue || 0), 0) / competitors.length 
      : ourHotel.revenue;

    const revenuePerformance = Math.min(100, (ourHotel.revenue / marketAvgRevenue) * 100);
    const competitiveAdvantage = Math.min(100, revenuePerformance + 15);

    return {
      revenuePerformance: Math.round(revenuePerformance),
      competitiveAdvantage: Math.round(competitiveAdvantage)
    };
  };

  const summaryMetrics = calculateSummaryMetrics();

  return (
    <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Performance Radar Analysis</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-green-600 bg-green-50 px-3 py-1 rounded-lg">
            {revenuePerformanceData.length} hotels analyzed
          </span>
        </div>
      </div>
      
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={data} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12, fill: '#6b7280' }} />
            <PolarRadiusAxis angle={90} domain={[0, 120]} tick={{ fontSize: 10, fill: '#9ca3af' }} />
            <Radar
              name={`${userHotelName || "Our Hotel"}`}
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
              fill="#94a3b8"
              fillOpacity={0.1}
              strokeWidth={1}
              strokeDasharray="6 6"
            />
            <Legend />
            <Tooltip 
              formatter={(value: number) => [`${value.toFixed(1)}%`, "Score"]}
              labelFormatter={(label: string) => `Metric: ${label}`}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      
      {/* Performance Summary - Matching PerformanceScorecard metrics */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div className="p-3 bg-arkus-50 rounded-lg">
            <div className="text-2xl font-bold text-arkus-600">
              {summaryMetrics.revenuePerformance}
            </div>
            <div className="text-xs text-arkus-700">Revenue Performance</div>
          </div>
          <div className="p-3 bg-emerald-50 rounded-lg">
            <div className="text-2xl font-bold text-emerald-600">
              {summaryMetrics.competitiveAdvantage}
            </div>
            <div className="text-xs text-emerald-700">Competitive Advantage</div>
          </div>
        </div>
      </div>
    </div>
  );
}
