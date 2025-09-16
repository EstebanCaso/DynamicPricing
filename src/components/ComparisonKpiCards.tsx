'use client'

import { useCurrency } from '@/contexts/CurrencyContext'

interface PriceDataPoint {
  date: string
  avgPrice: number
}

interface UserHotelData extends PriceDataPoint {
  hotel_name: string
}

interface CompetitorHistoricalData {
  name: string
  data: PriceDataPoint[]
}

interface ComparisonKpiCardsProps {
  userHotelData: UserHotelData[]
  competitorsData: CompetitorHistoricalData[]
}

const KpiCard = ({ title, value, subValue }: { title: string; value: string; subValue?: string }) => (
  <div className="bg-white p-4 rounded-lg shadow-md text-center">
    <h4 className="text-sm font-semibold text-gray-500 mb-1">{title}</h4>
    <p className="text-2xl font-bold text-gray-800">{value}</p>
    {subValue && <p className="text-xs text-gray-500">{subValue}</p>}
  </div>
)

export default function ComparisonKpiCards({ userHotelData, competitorsData }: ComparisonKpiCardsProps) {
  const { convertPriceToSelectedCurrency, selectedCurrency } = useCurrency()

  if (!userHotelData || !competitorsData || competitorsData.length === 0) {
    return null
  }

  // 1. Get all dates from competitor data
  const competitorDates = new Set<string>()
  competitorsData.forEach(c => c.data.forEach(d => competitorDates.add(d.date)))
  const relevantDates = Array.from(competitorDates)

  // 2. Calculate average price for user's hotel on relevant dates
  const userPricesOnRelevantDates = userHotelData
    .filter(d => relevantDates.includes(d.date))
    .map(d => d.avgPrice)
  
  const userAvgPrice =
    userPricesOnRelevantDates.length > 0
      ? userPricesOnRelevantDates.reduce((a, b) => a + b, 0) / userPricesOnRelevantDates.length
      : 0

  // 3. Calculate average price for all competitors combined
  const allCompetitorPrices = competitorsData.flatMap(c => 
    c.data.filter(d => relevantDates.includes(d.date)).map(d => d.avgPrice)
  );

  const competitorAvgPrice =
    allCompetitorPrices.length > 0
      ? allCompetitorPrices.reduce((a, b) => a + b, 0) / allCompetitorPrices.length
      : 0

  // 4. Calculate price difference
  const priceDiff = userAvgPrice - competitorAvgPrice
  const priceDiffPercent = competitorAvgPrice > 0 ? (priceDiff / competitorAvgPrice) * 100 : 0

  const formatCurrency = (value: number) => {
    return selectedCurrency.code
      ? new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: selectedCurrency.code,
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
          useGrouping: true
        }).format(value)
      : new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
          useGrouping: true
        }).format(value)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
      <KpiCard
        title="Your Avg. Price"
        value={formatCurrency(convertPriceToSelectedCurrency(userAvgPrice))}
        subValue={`For the last ${relevantDates.length} days`}
      />
      <KpiCard
        title="Competitors' Avg. Price"
        value={formatCurrency(convertPriceToSelectedCurrency(competitorAvgPrice))}
        subValue={`${competitorsData.length} selected competitors`}
      />
      <KpiCard
        title="Avg. Price Difference"
        value={`${priceDiffPercent > 0 ? '+' : ''}${priceDiffPercent.toFixed(1)}%`}
        subValue={
          priceDiff > 0
            ? `${formatCurrency(convertPriceToSelectedCurrency(priceDiff))} more expensive`
            : `${formatCurrency(convertPriceToSelectedCurrency(Math.abs(priceDiff)))} less expensive`
        }
      />
    </div>
  )
}

