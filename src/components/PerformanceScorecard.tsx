import { memo } from 'react';

interface PerformanceScorecardProps {
  revenuePerformanceData: any[];
  userHotelName: string;
  positionIndex: number | null;
  performancePercentage: number | null;
}

const PerformanceScorecard = memo(({
  revenuePerformanceData,
  userHotelName,
  positionIndex,
  performancePercentage
}: PerformanceScorecardProps) => {
  return (
    <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-emerald-100 rounded-lg">
          <svg className="text-emerald-600 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700">Performance Scorecard</p>
        </div>
      </div>
      
      {/* Compact Gauges Row */}
      <div className="grid grid-cols-3 gap-3">
        {/* Market Position Gauge */}
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-2">
            <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-gray-200"
                stroke="currentColor"
                strokeWidth="2.5"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-emerald-500"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeDasharray={`${(positionIndex && revenuePerformanceData.length > 0) ? ((revenuePerformanceData.length - positionIndex + 1) / revenuePerformanceData.length) * 100 : 0}, 100`}
                strokeDashoffset="0"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-gray-700">{positionIndex ?? "N/A"}</span>
            </div>
          </div>
          <p className="text-xs text-gray-600 font-medium">Position</p>
          <p className="text-xs text-gray-500">of {revenuePerformanceData.length || 0}</p>
        </div>
        
        {/* Performance vs Market Gauge */}
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-2">
            <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-gray-200"
                stroke="currentColor"
                strokeWidth="2.5"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-blue-500"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeDasharray={`${performancePercentage ? Math.min(performancePercentage, 150) : 0}, 150`}
                strokeDashoffset="0"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-gray-700">{performancePercentage === null ? "N/A" : `${performancePercentage.toFixed(0)}%`}</span>
            </div>
          </div>
          <p className="text-xs text-gray-600 font-medium">Performance</p>
          <p className="text-xs text-gray-500">vs Market</p>
        </div>
        
        {/* Occupancy Gauge */}
        <div className="text-center">
          <div className="relative w-16 h-16 mx-auto mb-2">
            <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-gray-200"
                stroke="currentColor"
                strokeWidth="2.5"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-purple-500"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeDasharray="85, 100"
                strokeDashoffset="0"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-gray-700">85%</span>
            </div>
          </div>
          <p className="text-xs text-gray-600 font-medium">Occupancy</p>
          <p className="text-xs text-gray-500">vs 80% avg</p>
        </div>
      </div>
    </div>
  );
});

PerformanceScorecard.displayName = 'PerformanceScorecard';

export default PerformanceScorecard;
