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
    <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-4 hover:shadow-2xl transition-all duration-300 group">
      {/* Header Section */}
      <div className="h-12 flex items-center gap-3 mb-4">
        <div className="p-1.5 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 text-white group-hover:from-emerald-600 group-hover:to-emerald-700 transition-all duration-300">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
          </svg>
        </div>
        <h3 className="text-xs font-medium text-gray-700 group-hover:text-gray-800 transition-colors duration-300">Current Performance</h3>
      </div>

      {/* Content Section */}
      <div className="h-24 flex items-center justify-center">
        <div className="text-3xl md:text-4xl font-bold text-gray-900 group-hover:text-emerald-600 transition-all duration-500 ease-in-out">
          {currency.format(todayAverageRevenue || 0)}
        </div>
      </div>

      {/* Footer Section */}
      <div className="h-12 flex items-center justify-center">
        <span className="text-xs text-gray-500 group-hover:text-gray-600 transition-colors duration-300">
          {clickedRoomType ? (
            <span className="text-arkus-600 font-medium">📊 Filtered by: {clickedRoomType}</span>
          ) : (
            getDateRangeText(range)
          )}
        </span>
      </div>
    </div>
  );
});

RevenueMetrics.displayName = 'RevenueMetrics';

export default RevenueMetrics;
