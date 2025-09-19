"use client";

import { useMemo } from "react";

interface MarketPositionCardProps {
  revenuePerformanceData: any[];
  ourHotelEntry: any;
  positionIndex: number | null;
  performanceDeltaPerc: number | null;
  marketAvg: number;
  userHotelName: string;
  currency: Intl.NumberFormat;
  loading: boolean;
}

export default function MarketPositionCard({
  revenuePerformanceData,
  ourHotelEntry,
  positionIndex,
  performanceDeltaPerc,
  marketAvg,
  userHotelName,
  currency,
  loading
}: MarketPositionCardProps) {
  const marketPositionData = useMemo(() => {
    if (!ourHotelEntry || !revenuePerformanceData.length) {
      return {
        position: null,
        totalHotels: 0,
        priceVsMarket: null,
        yourPrice: 0,
        marketAverage: 0,
        trend: 'neutral' as 'up' | 'down' | 'neutral'
      };
    }

    // Calculate trend based on performance vs market
    let trend: 'up' | 'down' | 'neutral' = 'neutral';
    if (performanceDeltaPerc !== null) {
      if (performanceDeltaPerc > 5) trend = 'up';
      else if (performanceDeltaPerc < -5) trend = 'down';
    }

    return {
      position: positionIndex,
      totalHotels: revenuePerformanceData.length,
      priceVsMarket: performanceDeltaPerc,
      yourPrice: ourHotelEntry.revenue || 0,
      marketAverage: marketAvg,
      trend
    };
  }, [ourHotelEntry, revenuePerformanceData, positionIndex, performanceDeltaPerc, marketAvg]);

  const getPositionColor = (position: number | null, total: number) => {
    if (!position) return 'text-gray-500';
    const percentage = position / total;
    if (percentage <= 0.33) return 'text-green-600'; // Top third
    if (percentage <= 0.66) return 'text-yellow-600'; // Middle third
    return 'text-red-600'; // Bottom third
  };

  const getTrendIcon = (trend: 'up' | 'down' | 'neutral') => {
    switch (trend) {
      case 'up': return '📈';
      case 'down': return '📉';
      default: return '➡️';
    }
  };

  if (loading) {
    return (
      <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded mb-4"></div>
          <div className="space-y-3">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-6 bg-gray-200 rounded"></div>
            <div className="h-6 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Market Position</h3>
        <div className="text-2xl">{getTrendIcon(marketPositionData.trend)}</div>
      </div>

      {marketPositionData.totalHotels === 0 ? (
        <div className="flex items-center justify-center h-40 text-gray-500">
          <div className="text-center">
            <div className="text-4xl mb-2">🏪</div>
            <p className="text-sm">No market data</p>
            <p className="text-xs mt-1">Load competitor data to see position</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Market Rank */}
          <div className="flex items-center justify-between p-4 bg-white/50 rounded-xl">
            <div className="flex items-center gap-3">
              <div>
                <p className="text-sm font-medium text-gray-700">Market Rank</p>
                <p className="text-xs text-gray-500">
                  of {marketPositionData.totalHotels} hotels analyzed
                </p>
              </div>
            </div>
            <div className={`text-xl font-bold ${getPositionColor(marketPositionData.position, marketPositionData.totalHotels)}`}>
              #{marketPositionData.position || '-'}
            </div>
          </div>

          {/* Price vs Market */}
          <div className="flex items-center justify-between p-3 bg-white/50 rounded-xl">
            <div>
              <p className="text-sm font-medium text-gray-700">vs Market Average</p>
              <p className="text-xs text-gray-500">Price difference</p>
            </div>
            <div className="text-right">
              <div className={`text-lg font-bold ${
                marketPositionData.priceVsMarket === null ? 'text-gray-500' :
                marketPositionData.priceVsMarket > 0 ? 'text-red-600' : 'text-green-600'
              }`}>
                {marketPositionData.priceVsMarket === null 
                  ? 'N/A' 
                  : `${marketPositionData.priceVsMarket > 0 ? '+' : ''}${marketPositionData.priceVsMarket.toFixed(1)}%`
                }
              </div>
            </div>
          </div>

          {/* Your Price */}
          <div className="flex items-center justify-between p-3 bg-white/50 rounded-xl">
            <div>
              <p className="text-sm font-medium text-gray-700">Your Average Price</p>
              <p className="text-xs text-gray-500">Current period</p>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-arkus-600">
                {currency.format(marketPositionData.yourPrice)}
              </div>
            </div>
          </div>

          {/* Market Average */}
          <div className="flex items-center justify-between p-3 bg-white/50 rounded-xl">
            <div>
              <p className="text-sm font-medium text-gray-700">Market Average</p>
              <p className="text-xs text-gray-500">Competitor average</p>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-gray-600">
                {currency.format(marketPositionData.marketAverage)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
