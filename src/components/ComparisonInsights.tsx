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

interface ComparisonInsightsProps {
  userHotelData: UserHotelData[]
  competitorsData: CompetitorHistoricalData[]
}

const InsightCard = ({ title, content }: { title: string; content: React.ReactNode }) => (
  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
    <h4 className="font-semibold text-gray-700 mb-2 text-sm">{title}</h4>
    <div className="text-sm text-gray-600">{content}</div>
  </div>
)

export default function ComparisonInsights({ userHotelData, competitorsData }: ComparisonInsightsProps) {
  const { convertPriceToSelectedCurrency, selectedCurrency } = useCurrency()

  if (!userHotelData || !competitorsData || competitorsData.length === 0) {
    return null
  }
  
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: selectedCurrency.code || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(convertPriceToSelectedCurrency(value))
  }

  // --- INSIGHT CALCULATIONS ---

  // 1. Most & Least Expensive Competitor on average
  const competitorAverages = competitorsData.map(c => {
    const avg = c.data.reduce((sum, d) => sum + d.avgPrice, 0) / c.data.length
    return { name: c.name, avgPrice: avg }
  })

  const mostExpensive = competitorAverages.reduce((max, c) => c.avgPrice > max.avgPrice ? c : max, competitorAverages[0])
  const leastExpensive = competitorAverages.reduce((min, c) => c.avgPrice < min.avgPrice ? c : min, competitorAverages[0])

  // 2. Biggest Price Gap
  let biggestGap = { date: '', diff: 0, competitorName: '' }
  competitorsData.forEach(c => {
    c.data.forEach(d => {
      const userPricePoint = userHotelData.find(ud => ud.date === d.date)
      if (userPricePoint) {
        const diff = Math.abs(userPricePoint.avgPrice - d.avgPrice)
        if (diff > biggestGap.diff) {
          biggestGap = { date: d.date, diff, competitorName: c.name }
        }
      }
    })
  })

  // 3. Most Volatile Competitor
  const competitorVolatility = competitorsData.map(c => {
    let changes = 0
    for (let i = 1; i < c.data.length; i++) {
      if (c.data[i].avgPrice !== c.data[i-1].avgPrice) {
        changes++
      }
    }
    return { name: c.name, changes }
  })

  const mostVolatile = competitorVolatility.reduce((max, c) => c.changes > max.changes ? c : max, competitorVolatility[0])

  return (
    <div className="mt-4 p-4 bg-white rounded-lg shadow-md border border-gray-200">
       <h3 className="text-lg font-semibold text-gray-800 mb-3">Automated Insights</h3>
       <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <InsightCard 
            title="💰 Price Extremes"
            content={
                <p>
                    <strong>{mostExpensive.name}</strong> was the most expensive competitor on average ({formatCurrency(mostExpensive.avgPrice)}), 
                    while <strong>{leastExpensive.name}</strong> was the cheapest ({formatCurrency(leastExpensive.avgPrice)}).
                </p>
            }
        />
        <InsightCard 
            title="↔️ Biggest Price Gap"
            content={
                <p>
                    The largest price difference was <strong>{formatCurrency(biggestGap.diff)}</strong>, which occurred on <strong>{biggestGap.date}</strong> with <strong>{biggestGap.competitorName}</strong>.
                </p>
            }
        />
        <InsightCard 
            title="📈 Most Volatile"
            content={
                <p>
                    <strong>{mostVolatile.name}</strong> was the most active, changing its price <strong>{mostVolatile.changes}</strong> times during this period.
                </p>
            }
        />
       </div>
    </div>
  )
}

