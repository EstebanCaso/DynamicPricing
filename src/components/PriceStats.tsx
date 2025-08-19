import { memo } from 'react';

interface PriceStatsProps {
  priceStats: {
    avgPrice: number;
    priceRange: number;
    count: number;
    roomTypeCount: number;
    roomTypes: string[];
    effectiveRoomType: string | null;
  } | null;
  currency: Intl.NumberFormat;
  selectedCurrency: string;
}

const PriceStats = memo(({ priceStats, currency, selectedCurrency }: PriceStatsProps) => {
  if (!priceStats) return null;

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <div className="grid grid-cols-4 gap-4 text-center">
        <div>
          <p className="text-xs text-gray-600">Average Price</p>
          <p className="text-lg font-semibold text-arkus-600">{currency.format(priceStats.avgPrice)}</p>
          <p className="text-xs text-gray-500">{selectedCurrency}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Price Range</p>
          <p className="text-lg font-semibold text-blue-600">{currency.format(priceStats.priceRange)}</p>
          <p className="text-xs text-gray-500">{selectedCurrency}</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Data Points</p>
          <p className="text-lg font-semibold text-emerald-600">{priceStats.count}</p>
          <p className="text-xs text-gray-500">Bookings</p>
        </div>
        <div>
          <p className="text-xs text-gray-600">Room Types</p>
          <p className="text-lg font-semibold text-purple-600">{priceStats.roomTypeCount}</p>
          <p className="text-xs text-gray-500">
            {priceStats.effectiveRoomType === "all" ? "All Types" : priceStats.effectiveRoomType}
          </p>
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-gray-100">
        <div className="text-center">
          <p className="text-xs text-gray-500">
            {priceStats.effectiveRoomType === "all"
              ? `Showing average prices across all room types (${priceStats.roomTypes.join(", ")})`
              : `Showing prices for ${priceStats.effectiveRoomType} rooms only`}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            All prices displayed in {selectedCurrency === "MXN" ? "Mexican Pesos (MXN)" : "US Dollars (USD)"}
          </p>
        </div>
      </div>
    </div>
  );
});

PriceStats.displayName = 'PriceStats';

export default PriceStats;
