'use client'

import { useState, useEffect, useMemo, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Scatter } from 'recharts'
import { useCurrency } from '@/contexts/CurrencyContext'
import { toPng } from 'html-to-image';
import { mkConfig, generateCsv, download } from 'export-to-csv';

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
  eventsData?: EventData[]
}

interface EventData {
    nombre: string;
    fecha: string;
    lugar: string;
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
const BASE_COMPETITOR_COLOR = '#A0AEC0'; // Medium Gray

const CustomTooltip = ({ active, payload, label, currencyCode, userHotelName }: any) => {
    if (active && payload && payload.length) {
      const formattedLabel = new Date(label + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      
      const userPayload = payload.find((p: any) => p.dataKey === userHotelName);
      const userPrice = userPayload ? userPayload.value : null;

      // Sort payload by price descending
      const sortedPayload = [...payload].sort((a, b) => b.value - a.value);

      return (
        <div className="p-3 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg shadow-xl w-64">
          <p className="font-semibold text-gray-800 mb-2">{formattedLabel}</p>
          <div className="space-y-1.5">
            {sortedPayload.map((pld: any) => {
              const isUserHotel = pld.dataKey === userHotelName;
              const priceDiff = userPrice !== null ? pld.value - userPrice : null;

              return (
              <div key={pld.dataKey} className={`flex items-center justify-between p-1.5 rounded-md ${isUserHotel ? 'bg-red-100' : ''}`}>
                <div className="flex items-center min-w-0 flex-1 mr-2">
                    <span className="w-3 h-3 rounded-full mr-2 flex-shrink-0" style={{ backgroundColor: pld.color }}></span>
                    <span 
                        className={`text-sm font-medium truncate ${isUserHotel ? 'text-red-800' : 'text-gray-600'}`}
                        title={pld.dataKey}
                    >
                        {pld.dataKey}
                    </span>
                </div>
                <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold text-gray-900">
                        {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: currencyCode || 'USD',
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                        }).format(pld.value)}
                    </div>
                    {isUserHotel ? (
                        <div className="text-xs text-gray-500">Baseline</div>
                    ) : (
                        priceDiff !== null && (
                            <div className={`text-xs ${priceDiff > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {priceDiff > 0 ? '+' : ''}{new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode || 'USD', maximumFractionDigits: 2 }).format(priceDiff)} vs. You
                            </div>
                        )
                    )}
                </div>
              </div>
            )})}
          </div>
        </div>
      );
    }
  
    return null;
  };


export default function MultiCompetitorChart({ userHotelData, competitorsData, eventsData }: ChartProps) {
  const { convertPriceToSelectedCurrency, selectedCurrency } = useCurrency()
  const [highlightedLine, setHighlightedLine] = useState<string | null>(null);
  const [activeLines, setActiveLines] = useState<string[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);

  const allHotelNames = useMemo(() => [
    (userHotelData?.[0]?.hotel_name || 'Your Hotel'),
    ...competitorsData.map(c => c.name),
    'marketAverage'
  ], [userHotelData, competitorsData]);

  // Initialize all lines as active by default
  useEffect(() => {
    setActiveLines(allHotelNames);
  }, [allHotelNames]);

  const handleLegendClick = (e: any) => {
    const { dataKey } = e;
    setActiveLines(prev => 
      prev.includes(dataKey)
        ? prev.filter(line => line !== dataKey)
        : [...prev, dataKey]
    );
  };

  const isLineActive = (name: string) => activeLines.includes(name);

  // Export functions
  const exportToPNG = async () => {
    if (chartRef.current) {
      try {
        const dataUrl = await toPng(chartRef.current, {
          quality: 1.0,
          pixelRatio: 2,
          backgroundColor: '#ffffff'
        });
        
        const link = document.createElement('a');
        link.download = `price-comparison-${new Date().toISOString().split('T')[0]}.png`;
        link.href = dataUrl;
        link.click();
      } catch (error) {
        console.error('Error exporting PNG:', error);
      }
    }
  };

  const exportToCSV = () => {
    // Prepare data for CSV export (only active lines)
    const csvData = chartData.map(row => {
      const csvRow: any = { Date: row.date };
      
      // Add user hotel if active
      if (isLineActive(userHotelName) && row[userHotelName] !== null) {
        csvRow[userHotelName] = row[userHotelName];
      }
      
      // Add competitors if active
      competitorsData.forEach(competitor => {
        if (isLineActive(competitor.name) && row[competitor.name] !== null) {
          csvRow[competitor.name] = row[competitor.name];
        }
      });
      
      // Add market average if active
      if (isLineActive('marketAverage') && row['marketAverage'] !== null) {
        csvRow['Market Average'] = row['marketAverage'];
      }
      
      return csvRow;
    });

    const csvConfig = mkConfig({
      filename: `price-comparison-${new Date().toISOString().split('T')[0]}`,
      useKeysAsHeaders: true,
    });

    const csv = generateCsv(csvConfig)(csvData);
    download(csvConfig)(csv);
  };

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
    const dataPoint: { [key: string]: string | number | null } = { date };

    // Add user hotel price
    const userPricePoint = userHotelData.find(d => d.date === date);
    dataPoint[userHotelName] = userPricePoint ? convertPriceToSelectedCurrency(userPricePoint.avgPrice) : null;
    
    // Add competitor prices and calculate daily average
    let competitorPricesForDay: number[] = [];
    competitorsData.forEach(competitor => {
      const competitorPricePoint = competitor.data.find(d => d.date === date);
      if (competitorPricePoint) {
        const convertedPrice = convertPriceToSelectedCurrency(competitorPricePoint.avgPrice);
        dataPoint[competitor.name] = convertedPrice;
        competitorPricesForDay.push(convertedPrice);
      } else {
        dataPoint[competitor.name] = null;
      }
    });

    if (competitorPricesForDay.length > 0) {
        dataPoint['marketAverage'] = competitorPricesForDay.reduce((a, b) => a + b, 0) / competitorPricesForDay.length;
    } else {
        dataPoint['marketAverage'] = null;
    }
    
    // Add a placeholder for event markers
    const eventOnDay = eventsData?.find(e => e.fecha === date);
    if (eventOnDay) {
        dataPoint['eventMarker'] = dataPoint[userHotelName] || dataPoint['marketAverage'] || 150; // Position the marker on a line
    }

    return dataPoint;
  });
  
  // Get all hotel names for lines
  // const allHotelNames = [userHotelName, ...competitorsData.map(c => c.name)];


  return (
    <div className="p-4 bg-white rounded-lg shadow-md" ref={chartRef}>
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold mb-1">Historical Price Comparison</h3>
          <p className="text-sm text-gray-500">{dateRange}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportToPNG}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Export PNG
          </button>
          <button
            onClick={exportToCSV}
            className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={chartData}
          margin={{
            top: 5,
            right: 30,
            left: 0,
            bottom: 5,
          }}
        >
          <XAxis 
            dataKey="date" 
            tick={{ fontSize: 12 }}
            tickFormatter={(dateStr) => dateStr.slice(-2)} // Show only the day
            padding={{ left: 0, right: 10 }}
          />
          <YAxis tick={{ fontSize: 12 }} 
            tickFormatter={(value) => 
              selectedCurrency?.code 
                ? new Intl.NumberFormat('en-US', { 
                    style: 'currency', 
                    currency: selectedCurrency.code, 
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                    useGrouping: true
                  }).format(value as number)
                : new Intl.NumberFormat('en-US', { 
                    style: 'currency', 
                    currency: 'USD', 
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                    useGrouping: true
                  }).format(value as number)
            }
          />
          <Tooltip 
            content={<CustomTooltip currencyCode={selectedCurrency.code} userHotelName={userHotelName} />}
          />
          <Legend 
            onMouseEnter={(e) => setHighlightedLine(e.dataKey)}
            onMouseLeave={() => setHighlightedLine(null)}
            onClick={handleLegendClick}
            wrapperStyle={{
              paddingTop: '20px'
            }}
            formatter={(value: string) => (
              <span style={{ 
                opacity: isLineActive(value) ? 1 : 0.4,
                transition: 'opacity 0.2s ease'
              }}>
                {value}
              </span>
            )}
          />

          {/* Event Scatter Plot */}
          {eventsData && eventsData.length > 0 && (
            <Scatter dataKey="eventMarker" fill="#8B5CF6" shape="circle" name="Events">
                <Tooltip 
                    cursor={false}
                    content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                            const eventDate = payload[0].payload.date;
                            const eventInfo = eventsData.find(e => e.fecha === eventDate);
                            if (eventInfo) {
                                return (
                                    <div className="p-2 bg-purple-700 text-white rounded-md shadow-lg">
                                        <p className="font-bold">{eventInfo.nombre}</p>
                                        <p className="text-xs">{eventInfo.lugar}</p>
                                    </div>
                                );
                            }
                        }
                        return null;
                    }}
                />
            </Scatter>
          )}

          {/* Market Average Line */}
          <Line
            type="linear"
            dataKey="marketAverage"
            stroke="#6B7280"
            strokeWidth={highlightedLine === 'marketAverage' ? 4 : 3}
            strokeOpacity={isLineActive('marketAverage') ? (highlightedLine === 'marketAverage' ? 1 : 0.8) : 0.2}
            strokeDasharray="8 4"
            dot={false}
            connectNulls={false}
            name="Market Average"
          />
          
          {/* User Hotel Line */}
          <Line
            type="linear"
            dataKey={userHotelName}
            stroke="#E53E3E" // Red color for user's hotel
            strokeWidth={highlightedLine === userHotelName ? 5 : 4}
            strokeOpacity={isLineActive(userHotelName) ? (highlightedLine === userHotelName ? 1 : 0.8) : 0.2}
            connectNulls
            dot={false}
            name={userHotelName}
          />

          {/* Competitor Lines */}
          {competitorsData.map((competitor, index) => {
            const isHovered = highlightedLine === competitor.name;

            return (
              <Line
                key={competitor.name}
                type="linear"
                dataKey={competitor.name}
                stroke={COMPETITOR_COLORS[index % COMPETITOR_COLORS.length]}
                strokeWidth={isHovered ? 5 : 3}
                strokeOpacity={isLineActive(competitor.name) ? (isHovered ? 1 : 0.8) : 0.2}
                connectNulls
                dot={false}
                name={competitor.name}
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
