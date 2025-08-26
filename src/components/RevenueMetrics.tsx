import { memo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
} from "recharts";

interface RevenueMetricsProps {
  loading: boolean;
  todayAverageRevenue: number | null;
  clickedRoomType: string | null;
  currency: Intl.NumberFormat;
  sparkData: Array<{ day: string; revenue: number }>;
}

const RevenueMetrics = memo(({
  loading,
  todayAverageRevenue,
  clickedRoomType,
  currency,
  sparkData
}: RevenueMetricsProps) => {
  return (
    <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300 h-full">
      {/* Header Section - Fixed height */}
      <div className="h-16 flex items-center gap-3 mb-6">
        <div className="p-3 bg-arkus-100 rounded-xl">
          <svg className="text-arkus-600 w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v22M4 9l8-8 8 8" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700">Avg Revenue/Booking</p>
        </div>
      </div>

      {/* Content Section - Fixed height with grid */}
      <div className="h-32 grid grid-cols-1 gap-3">
        {/* Main Revenue Display */}
        <div className="text-center">
          <p className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            {loading ? "..." : todayAverageRevenue !== null ? currency.format(todayAverageRevenue) : "$0"}
          </p>
          <p className="text-xs text-gray-500">
            {clickedRoomType ? (
              <span className="text-arkus-600 font-medium">📊 Filtered by: {clickedRoomType}</span>
            ) : (
              <span>Analyzing Jul 31 - Oct 30, 2025</span>
            )}
          </p>
        </div>
      </div>

      {/* Bottom Section - Fixed height */}
      <div className="h-16 flex items-center justify-center">
        {/* Sparkline Chart */}
        <div className="w-full h-12">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData.length > 0 ? sparkData : [{ day: "1", revenue: 0 }]} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
              <XAxis dataKey="day" hide />
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Line type="monotone" dataKey="revenue" stroke="#ff0000" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
});

RevenueMetrics.displayName = 'RevenueMetrics';

export default RevenueMetrics;
