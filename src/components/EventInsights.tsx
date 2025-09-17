'use client'

import { useMemo } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';

interface PriceData {
  date: string;
  avgPrice: number;
}

interface CompetitorData {
  name: string;
  data: PriceData[];
}

interface EventData {
  nombre: string;
  fecha: string;
  lugar: string;
}

interface EventInsightsProps {
  userHotelData: (PriceData & { hotel_name: string })[];
  competitorsData: CompetitorData[];
  eventsData: EventData[];
}

interface EventImpact {
  eventName: string;
  eventDate: string;
  priceChange: number;
  priceChangePercent: number;
  comparisonType: 'vs_previous_day' | 'vs_average';
  marketChange: number;
  marketChangePercent: number;
}

export default function EventInsights({ userHotelData, competitorsData, eventsData }: EventInsightsProps) {
  const { convertPriceToSelectedCurrency, selectedCurrency } = useCurrency();

  const eventAnalysis = useMemo(() => {
    if (!eventsData || !userHotelData || eventsData.length === 0) return [];

    const results: EventImpact[] = [];

    // Calculate overall average price (excluding event days)
    const nonEventDays = userHotelData.filter(day => 
      !eventsData.some(event => event.fecha === day.date)
    );
    const averagePrice = nonEventDays.length > 0 
      ? nonEventDays.reduce((sum, day) => sum + day.avgPrice, 0) / nonEventDays.length 
      : 0;

    // Calculate market average for comparison
    const getMarketAverageForDate = (date: string) => {
      const dayPrices: number[] = [];
      competitorsData.forEach(competitor => {
        const dayData = competitor.data.find(d => d.date === date);
        if (dayData) {
          dayPrices.push(dayData.avgPrice);
        }
      });
      return dayPrices.length > 0 ? dayPrices.reduce((a, b) => a + b, 0) / dayPrices.length : 0;
    };

    eventsData.forEach(event => {
      const eventDayData = userHotelData.find(day => day.date === event.fecha);
      if (!eventDayData) return;

      // Find previous day for comparison
      const eventDate = new Date(event.fecha + 'T00:00:00');
      const previousDate = new Date(eventDate);
      previousDate.setDate(previousDate.getDate() - 1);
      const previousDateStr = previousDate.toISOString().split('T')[0];
      
      const previousDayData = userHotelData.find(day => day.date === previousDateStr);

      // Calculate price changes
      const eventPrice = convertPriceToSelectedCurrency(eventDayData.avgPrice);
      const marketAvgEvent = getMarketAverageForDate(event.fecha);
      const marketAvgPrevious = getMarketAverageForDate(previousDateStr);

      let priceChange = 0;
      let priceChangePercent = 0;
      let marketChange = 0;
      let marketChangePercent = 0;

      if (previousDayData) {
        const previousPrice = convertPriceToSelectedCurrency(previousDayData.avgPrice);
        priceChange = eventPrice - previousPrice;
        priceChangePercent = previousPrice > 0 ? (priceChange / previousPrice) * 100 : 0;
        
        if (marketAvgPrevious > 0) {
          marketChange = marketAvgEvent - marketAvgPrevious;
          marketChangePercent = (marketChange / marketAvgPrevious) * 100;
        }
      } else {
        // Compare vs overall average if no previous day
        const avgConverted = convertPriceToSelectedCurrency(averagePrice);
        priceChange = eventPrice - avgConverted;
        priceChangePercent = avgConverted > 0 ? (priceChange / avgConverted) * 100 : 0;
      }

      // Only include significant changes (>= 2%)
      if (Math.abs(priceChangePercent) >= 2) {
        results.push({
          eventName: event.nombre,
          eventDate: event.fecha,
          priceChange,
          priceChangePercent,
          comparisonType: previousDayData ? 'vs_previous_day' : 'vs_average',
          marketChange,
          marketChangePercent
        });
      }
    });

    // Sort by impact magnitude
    return results.sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent));
  }, [userHotelData, competitorsData, eventsData, convertPriceToSelectedCurrency]);


  const formatDate = (dateStr: string) => {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  if (eventAnalysis.length === 0) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-2">📊 Event Price Analysis</h4>
        <p className="text-sm text-gray-500">No significant price correlations detected with events in this period.</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white rounded-lg border border-gray-200">
      <h4 className="text-sm font-semibold text-gray-800 mb-3">🎪 Events This Week</h4>
      
      {eventAnalysis.length > 0 ? (
        <div className="space-y-2">
          {eventAnalysis.slice(0, 2).map((impact, index) => {
            const isPositive = impact.priceChangePercent > 0;
            
            return (
              <div key={index} className="p-3 bg-gray-50 rounded-md">
                <div className="flex justify-between items-center">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate" title={impact.eventName}>
                      {impact.eventName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatDate(impact.eventDate)}
                    </p>
                  </div>
                  
                  <div className="text-right ml-3">
                    <div className={`text-sm font-bold ${
                      isPositive ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {isPositive ? '📈' : '📉'} {isPositive ? '+' : ''}{impact.priceChangePercent.toFixed(0)}%
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          
          {eventsData.length > eventAnalysis.length && (
            <div className="text-center pt-2">
              <span className="text-xs text-gray-500">
                +{eventsData.length - eventAnalysis.length} more events (no price impact)
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {eventsData.slice(0, 3).map((event, index) => (
            <div key={index} className="p-3 bg-gray-50 rounded-md">
              <div className="flex justify-between items-center">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate" title={event.nombre}>
                    {event.nombre}
                  </p>
                  <p className="text-xs text-gray-500">
                    {formatDate(event.fecha)}
                  </p>
                </div>
                <div className="text-xs text-gray-400">
                  📊 No price impact
                </div>
              </div>
            </div>
          ))}
          
          {eventsData.length > 3 && (
            <div className="text-center pt-2">
              <span className="text-xs text-gray-500">
                +{eventsData.length - 3} more events
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
