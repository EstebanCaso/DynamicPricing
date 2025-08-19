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
  revenuePerformanceData: any[];
  userHotelName: string;
  performanceDeltaPerc: number | null;
  sparkData: Array<{ day: string; revenue: number }>;
}

const RevenueMetrics = memo(({
  loading,
  todayAverageRevenue,
  clickedRoomType,
  currency,
  revenuePerformanceData,
  userHotelName,
  performanceDeltaPerc,
  sparkData
}: RevenueMetricsProps) => {
  return (
    <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-arkus-100 rounded-xl">
          <svg className="text-arkus-600 w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v22M4 9l8-8 8 8" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium tracking-wide text-gray-600 mb-2">Total Revenue</p>
          <p className="text-xl md:text-2xl font-semibold text-gray-900 mb-3">
            {loading ? "..." : todayAverageRevenue !== null ? currency.format(todayAverageRevenue) : "$0"}
          </p>
          <div className="text-xs text-gray-500">
            {clickedRoomType ? (
              <span className="text-arkus-600 font-medium">📊 Filtered by: {clickedRoomType}</span>
            ) : (
              <span>Analyzing Jul 31 - Oct 30, 2025</span>
            )}
          </div>
        </div>

        {/* Sparkline Chart */}
        <div className="w-24 h-8">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData.length > 0 ? sparkData : [{ day: "1", revenue: 0 }]} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
              <XAxis dataKey="day" hide />
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Line type="monotone" dataKey="revenue" stroke="#ff0000" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
      
      {/* Revenue per Room Metric */}
      {revenuePerformanceData.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-600">Revenue per Room</p>
              <p className="text-lg font-semibold text-arkus-600">
                ${revenuePerformanceData.find(item => 
                  item.hotel === userHotelName || item.hotel === "Our Hotel"
                )?.revenue?.toLocaleString() ?? "N/A"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">vs Market</p>
              <p className="text-sm font-medium text-emerald-600">
                {performanceDeltaPerc === null ? "N/A" : `${performanceDeltaPerc > 0 ? '+' : ''}${performanceDeltaPerc.toFixed(1)}%`}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

RevenueMetrics.displayName = 'RevenueMetrics';

export default RevenueMetrics;
