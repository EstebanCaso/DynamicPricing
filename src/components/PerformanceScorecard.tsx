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
  // Calculate real metrics from the data
  const calculateMetrics = () => {
    if (!revenuePerformanceData || revenuePerformanceData.length === 0) {
      return {
        position: null,
        performance: null,
        occupancy: null,
        marketPosition: null,
        competitiveAdvantage: null
      };
    }

    // Find our hotel data
    const ourHotel = revenuePerformanceData.find(item => 
      item.hotel === userHotelName || item.hotel === "Our Hotel"
    );

    if (!ourHotel) {
      return {
        position: null,
        performance: null,
        occupancy: null,
        marketPosition: null,
        competitiveAdvantage: null
      };
    }

    // Calculate market averages
    const competitors = revenuePerformanceData.filter(item => 
      item.hotel !== userHotelName && item.hotel !== "Our Hotel"
    );

    const marketAvgRevenue = competitors && competitors.length > 0 
      ? competitors.reduce((sum, item) => sum + (item.revenue || 0), 0) / competitors.length 
      : ourHotel.revenue;

    const marketAvgPrice = competitors && competitors.length > 0 
      ? competitors.reduce((sum, item) => sum + ((item.revenue || 0) / 0.80), 0) / competitors.length 
      : (ourHotel.revenue / 0.85);

    // Calculate metrics
    const revenuePerformance = Math.min(100, (ourHotel.revenue / marketAvgRevenue) * 100);
    const pricePositioning = Math.min(100, ((ourHotel.revenue / 0.85) / marketAvgPrice) * 100);
    const marketShare = Math.min(100, (ourHotel.revenue / (ourHotel.revenue + (competitors && competitors.length > 0 ? competitors.reduce((sum, item) => sum + (item.revenue || 0), 0) : 0))) * 200);
    const occupancyEfficiency = 85; // Our occupancy rate
    const competitiveAdvantage = Math.min(100, revenuePerformance + 15);

    return {
      position: positionIndex,
      performance: performancePercentage,
      occupancy: occupancyEfficiency,
      marketPosition: Math.round(revenuePerformance),
      competitiveAdvantage: Math.round(competitiveAdvantage)
    };
  };

  const metrics = calculateMetrics();

  return (
    <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300 h-full">
      {/* Header Section - Fixed height */}
      <div className="h-16 flex items-center gap-3 mb-6">
        <div className="p-2 bg-emerald-100 rounded-lg">
          <svg className="text-emerald-600 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700">Performance Scorecard</p>
        </div>
      </div>
      
      {/* Content Section - Fixed height with grid */}
      <div className="h-32 grid grid-cols-3 gap-3">
        {/* Market Position Gauge */}
        <div className="text-center flex flex-col justify-center">
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
                strokeDasharray={`${metrics.position && revenuePerformanceData.length > 0 ? ((revenuePerformanceData.length - metrics.position + 1) / revenuePerformanceData.length) * 100 : 0}, 100`}
                strokeDashoffset="0"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-gray-700">{metrics.position ?? "N/A"}</span>
            </div>
          </div>
          <p className="text-xs text-gray-600 font-medium">Position</p>
          <p className="text-xs text-gray-500">of {revenuePerformanceData.length || 0}</p>
        </div>
        
        {/* Revenue Performance Gauge */}
        <div className="text-center flex flex-col justify-center">
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
                strokeDasharray={`${metrics.marketPosition || 0}, 100`}
                strokeDashoffset="0"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-gray-700">{metrics.marketPosition ?? "N/A"}</span>
            </div>
          </div>
          <p className="text-xs text-gray-600 font-medium">Revenue</p>
          <p className="text-xs text-gray-500">Performance</p>
        </div>
        
        {/* Competitive Advantage Gauge */}
        <div className="text-center flex flex-col justify-center">
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
                strokeDasharray={`${metrics.competitiveAdvantage || 0}, 100`}
                strokeDashoffset="0"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-gray-700">{metrics.competitiveAdvantage ?? "N/A"}</span>
            </div>
          </div>
          <p className="text-xs text-gray-600 font-medium">Competitive</p>
          <p className="text-xs text-gray-500">Advantage</p>
        </div>
      </div>

      {/* Bottom Section - Fixed height */}
      <div className="h-16 flex items-center justify-center">
        <div className="text-center">
          <p className="text-xs text-gray-500">
            {revenuePerformanceData.length > 0 ? `${revenuePerformanceData.length} hotels analyzed` : 'No data available'}
          </p>
        </div>
      </div>
    </div>
  );
});

PerformanceScorecard.displayName = 'PerformanceScorecard';

export default PerformanceScorecard;
