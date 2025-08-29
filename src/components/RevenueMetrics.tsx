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
  range: 1 | 7 | 30 | 90;
}

// Function to generate dynamic date range text
const getDateRangeText = (range: 1 | 7 | 30 | 90): string => {
  const today = new Date();
  const startDate = new Date();
  
  switch (range) {
    case 1:
      startDate.setDate(today.getDate() - 1);
      break;
    case 7:
      startDate.setDate(today.getDate() - 7);
      break;
    case 30:
      startDate.setDate(today.getDate() - 30);
      break;
    case 90:
      startDate.setDate(today.getDate() - 90);
      break;
  }
  
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  const formatYear = (date: Date): string => {
    return date.getFullYear().toString();
  };
  
  const startText = formatDate(startDate);
  const endText = formatDate(today);
  const year = formatYear(today);
  
  // If same year, don't repeat year
  if (startDate.getFullYear() === today.getFullYear()) {
    return `Analyzing ${startText} - ${endText}, ${year}`;
  } else {
    return `Analyzing ${startText}, ${startDate.getFullYear()} - ${endText}, ${year}`;
  }
};

const RevenueMetrics = memo(({
  loading,
  todayAverageRevenue,
  clickedRoomType,
  currency,
  sparkData,
  range
}: RevenueMetricsProps) => {
  return (
    <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-4 hover:shadow-2xl transition-all duration-300">
      {/* Header Section - Fixed height */}
      <div className="h-12 flex items-center gap-3 mb-4">
        <div className="p-1.5 bg-arkus-100 rounded-lg">
          <svg className="text-arkus-600 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v22M4 9l8-8 8 8" />
          </svg>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-700">Avg Revenue per Booking</p>
        </div>
      </div>
      
      {/* Content Section - Price and Chart in same row */}
      <div className="flex items-center justify-between h-24">
        <div className="flex-1">
          <p className="text-3xl md:text-4xl font-bold text-gray-900">
            {loading ? "..." : todayAverageRevenue !== null ? currency.format(todayAverageRevenue) : "$0"}
          </p>
        </div>

        {/* Sparkline Chart */}
        <div className="w-24 h-8 ml-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData.length > 0 ? sparkData : [{ day: "1", revenue: 0 }]} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
              <XAxis dataKey="day" hide />
              <YAxis hide domain={["dataMin", "dataMax"]} />
              <Line type="monotone" dataKey="revenue" stroke="#ff0000" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Footer Section - Dates and Room Type Filter */}
      <div className="h-12 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xs text-gray-500">
            {clickedRoomType ? (
              <span className="text-arkus-600 font-medium">📊 Filtered by: {clickedRoomType}</span>
            ) : (
              <span>{getDateRangeText(range)}</span>
            )}
          </p>
        </div>
      </div>
      

    </div>
  );
});

RevenueMetrics.displayName = 'RevenueMetrics';

export default RevenueMetrics;
