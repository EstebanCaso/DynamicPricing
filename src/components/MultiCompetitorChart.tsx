'use client'

import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { useCurrency } from '@/contexts/CurrencyContext'

interface PriceData {
  date: string
  avgPrice: number
}

interface CompetitorData {
  name: string
  data: PriceData[]
}

interface ChartProps {
  userHotelData: (PriceData & { hotel_name: string })[]
  competitorsData: CompetitorData[]
}

// Function to generate a color from a string
const stringToColor = (str: string) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  let color = '#'
  for (let i = 0; i < 3; i++) {
    const value = (hash >> (i * 8)) & 0xff
    color += ('00' + value.toString(16)).substr(-2)
  }
  return color
}

const COMPETITOR_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#6366F1"];

const CustomTooltip = ({ active, payload, label, currencyCode, convertPrice }: any) => {
    if (active && payload && payload.length) {
      const formattedLabel = new Date(label + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return (
        <div className="p-3 bg-white/80 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-700">{formattedLabel}</p>
          <div className="mt-2 space-y-1">
            {payload.map((pld: any) => (
              <div key={pld.dataKey} className="flex items-center justify-between space-x-4">
                <div className="flex items-center">
                    <span className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: pld.color }}></span>
                    <span className="text-sm text-gray-600">{pld.dataKey}:</span>
                </div>
                <span className="text-sm font-bold text-gray-800">
                    {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: currencyCode || 'USD',
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    }).format(pld.value)}
                </span>
              </div>
            ))}
          </div>
        </div>
      );
    }
  
    return null;
  };


export default function MultiCompetitorChart({ userHotelData, competitorsData }: ChartProps) {
  const { convertPriceToSelectedCurrency, selectedCurrency } = useCurrency()
  const [highlightedLine, setHighlightedLine] = useState<string | null>(null);

  if (!userHotelData || !competitorsData) {
    return <div>Loading chart data...</div>;
  }
  
  const userHotelName = userHotelData?.[0]?.hotel_name || 'Your Hotel';

  // 1. Combine all dates from competitors only
  const competitorDates = new Set<string>()
  competitorsData.forEach(c => c.data.forEach(d => competitorDates.add(d.date)))

  const sortedDates = Array.from(competitorDates).sort()

  const formatDate = (dateStr: string) => new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const dateRange = sortedDates.length > 1 
    ? `${formatDate(sortedDates[0])} - ${formatDate(sortedDates[sortedDates.length - 1])}`
    : formatDate(sortedDates[0]);


  // 2. Create a map for each date
  const chartData = sortedDates.map(date => {
    const dataPoint: { [key: string]: string | number } = { date };

    // Add user hotel price
    const userPricePoint = userHotelData.find(d => d.date === date);
    dataPoint[userHotelName] = userPricePoint ? convertPriceToSelectedCurrency(userPricePoint.avgPrice) : null;
    
    // Add competitor prices
    competitorsData.forEach(competitor => {
      const competitorPricePoint = competitor.data.find(d => d.date === date);
      dataPoint[competitor.name] = competitorPricePoint ? convertPriceToSelectedCurrency(competitorPricePoint.avgPrice) : null;
    });

    return dataPoint;
  });
  
  // Get all hotel names for lines
  const allHotelNames = [userHotelName, ...competitorsData.map(c => c.name)];


  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
       <h3 className="text-lg font-semibold mb-1">Historical Price Comparison</h3>
       <p className="text-sm text-gray-500 mb-4">{dateRange}</p>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={chartData}
          margin={{
            top: 5,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            tickFormatter={(dateStr) => dateStr.slice(-2)} // Show only the day
            padding={{ left: 10, right: 10 }}
          />
          <YAxis tick={{ fontSize: 12 }} 
            tickFormatter={(value) => 
              selectedCurrency?.code 
                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: selectedCurrency.code, minimumFractionDigits: 0 }).format(value as number)
                : value
            }
          />
          <Tooltip 
            content={<CustomTooltip currencyCode={selectedCurrency.code} />}
          />
          <Legend 
            onMouseEnter={(e) => setHighlightedLine(e.dataKey)}
            onMouseLeave={() => setHighlightedLine(null)}
          />
          
          {/* User Hotel Line */}
          <Line
            type="linear"
            dataKey={userHotelName}
            stroke="#E53E3E" // Red color for user's hotel
            strokeWidth={highlightedLine === userHotelName ? 5 : 4}
            strokeOpacity={highlightedLine && highlightedLine !== userHotelName ? 0.3 : 1}
            connectNulls
            dot={false}
          />

          {/* Competitor Lines */}
          {competitorsData.map((competitor, index) => (
            <Line
              key={competitor.name}
              type="linear"
              dataKey={competitor.name}
              stroke={COMPETITOR_COLORS[index % COMPETITOR_COLORS.length]} // Distinct colors for competitors
              strokeWidth={highlightedLine === competitor.name ? 5 : 3}
              strokeOpacity={highlightedLine && highlightedLine !== competitor.name ? 0.3 : 1}
              connectNulls
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
