'use client';

import { useEffect, useState } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useMemo } from 'react';

interface CompetitorProfileProps {
  competitor: Record<string, unknown>;
  onClose: () => void;
}

const parsePrice = (price: string | number): number => {
  if (typeof price === 'number') return price;
  return parseFloat(price.replace(/[^0-9.-]+/g, ''));
};

const CustomizedDot = (props: { cx?: number; cy?: number; stroke?: string; value?: number; min?: number; max?: number }) => {
  const { cx, cy, stroke, value, min, max } = props;

  if (
    typeof cx !== 'number' ||
    typeof cy !== 'number' ||
    typeof value !== 'number' ||
    typeof min !== 'number' ||
    typeof max !== 'number'
  ) {
    return null;
  }

  if (value === min || value === max) {
    return <circle cx={cx} cy={cy} r={5} stroke={stroke} strokeWidth={2} fill="#fff" />;
  }

  return null;
};

// Helper component to render stars
const StarRating = ({ rating }: { rating: number | null }) => {
  if (!rating || rating <= 0) {
    return <div className="text-sm text-gray-500 mt-1">No rating available</div>;
  }

  return (
    <div className="flex items-center mt-1">
      {Array.from({ length: 5 }, (_, index) => (
        <svg
          key={index}
          className={`w-5 h-5 ${index < rating ? 'text-yellow-400' : 'text-gray-300'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-2 text-sm text-gray-600">{rating} star{rating > 1 ? 's' : ''}</span>
    </div>
  );
};

export default function CompetitorProfile({ competitor, onClose }: CompetitorProfileProps) {
  const [historicalData, setHistoricalData] = useState<Record<string, unknown>[] | null>(null);
  const [userHotelName, setUserHotelName] = useState('Your Hotel');
  const [loading, setLoading] = useState(false);
  const { currency, convertPriceToSelectedCurrency } = useCurrency();
  const compName = String((competitor as Record<string, unknown>)?.name ?? '');
  const checkinDate = String((competitor as Record<string, unknown>)?.checkinDate ?? '');

  const priceBounds = useMemo(() => {
    if (!historicalData) return { min: 0, max: 0 };
    const competitorPrices = historicalData
      .map((d) => (d as Record<string, unknown>)[compName])
      .filter((p): p is number => typeof p === 'number');
    const userPrices = historicalData
      .map((d) => (d as Record<string, unknown>)[userHotelName])
      .filter((p): p is number => typeof p === 'number');
    
    const allPrices = [...competitorPrices, ...userPrices];
    if (allPrices.length === 0) return { min: 0, max: 0 };
    
    return {
      min: Math.min(...allPrices),
      max: Math.max(...allPrices),
    };
  }, [historicalData, compName, userHotelName]);

  const strategicSummary = useMemo(() => {
    if (!historicalData || historicalData.length === 0) {
      return null;
    }

    const competitorPrices = historicalData
      .map((d) => (d as Record<string, unknown>)[compName])
      .filter((p): p is number => typeof p === 'number' && p > 0);
    if (competitorPrices.length === 0) return null;
    
    const avgPrice = competitorPrices.reduce((a, b) => a + b, 0) / competitorPrices.length;
    const minPrice = Math.min(...competitorPrices);
    const maxPrice = Math.max(...competitorPrices);

    let cheaperDays = 0;
    let comparableDays = 0;
    historicalData.forEach((d) => {
      const competitorPrice = (d as Record<string, unknown>)[compName];
      const userPrice = (d as Record<string, unknown>)[userHotelName];
      if (typeof competitorPrice === 'number' && typeof userPrice === 'number') {
        comparableDays++;
        if (competitorPrice < userPrice) {
          cheaperDays++;
        }
      }
    });

    const cheaperPercentage = comparableDays > 0 ? (cheaperDays / comparableDays) * 100 : 0;

    return { avgPrice, minPrice, maxPrice, cheaperPercentage };
  }, [historicalData, compName, userHotelName]);


  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    const fetchHistoricalData = async () => {
      if (!competitor) return;
      console.log('CompetitorProfile received this data:', competitor); 
      setLoading(true);
      try {
        const response = await fetch('/api/competitors/historical', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            competitorName: compName
          }),
        });
        const data = await response.json();
        console.log('API Response:', data); // <-- AÑADIR ESTO PARA DEPURAR

        if (data.success) {
            const userHotelName = data.userHotelData?.length > 0 ? data.userHotelData[0].hotel_name : 'Your Hotel';
            setUserHotelName(userHotelName);

            const competitorDates = data.competitorData.map((item: Record<string, unknown>) => item.date).sort((a: string, b: string) => new Date(a).getTime() - new Date(b).getTime());
            const competitorDataMap = new Map(data.competitorData.map((item: Record<string, unknown>) => [item.date, item.avgPrice]));
            const userDataMap = new Map(data.userHotelData.map((item: Record<string, unknown>) => [item.date, item.avgPrice]));
            
            const finalChartData = competitorDates.map((date: string) => ({
              date,
              [compName]: competitorDataMap.get(date) || null,
              [userHotelName]: userDataMap.get(date) || null,
            }));

            setHistoricalData(finalChartData);
        }
      } catch (error) {
        console.error('Failed to fetch historical data', error);
      } finally {
        setLoading(false);
      }
    };
    fetchHistoricalData();
  }, [competitor, userHotelName]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl bg-white shadow-2xl p-6 animate-slide-in-from-right overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-6 pb-4 border-b">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{compName}</h2>
              <StarRating rating={typeof (competitor as Record<string, unknown>)?.estrellas === 'number' ? (competitor as Record<string, unknown>)?.estrellas as number : null} />
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl leading-none p-2 -mt-2">&times;</button>
        </div>
        
        {/* Strategic Summary */}
        {strategicSummary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 text-center">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-500">Avg. Price</div>
              <div className="text-xl font-bold text-gray-800">{currency.format(convertPriceToSelectedCurrency(strategicSummary.avgPrice, 'MXN'))}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-500">Price Range</div>
              <div className="text-xl font-bold text-gray-800">
                {currency.format(convertPriceToSelectedCurrency(strategicSummary.minPrice, 'MXN'))} - {currency.format(convertPriceToSelectedCurrency(strategicSummary.maxPrice, 'MXN'))}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-500">Cheaper Than You</div>
              <div className="text-xl font-bold text-gray-800">{strategicSummary.cheaperPercentage.toFixed(0)}%</div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center p-8">
            <div className="w-16 h-16 border-4 border-gray-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading historical data...</p>
          </div>
        ) : !historicalData || historicalData.length === 0 ? (
          <div className="text-center p-8 bg-gray-50 rounded-lg">
            <p className="font-semibold text-gray-700">No historical data available</p>
            <p className="text-sm text-gray-500 mt-1">No price history was found for this competitor for a check-in on {checkinDate}.</p>
          </div>
        ) : historicalData.length < 2 ? (
          <div className="text-center p-8 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-800 mb-2">Insufficient Data for Evolution Chart</h3>
              <p className="text-sm text-blue-700">
                  Not enough historical data points were found to generate a chart.
              </p>
              <div className="mt-4 text-left bg-white p-4 rounded-md shadow-sm">
                <p className="text-sm text-gray-600">Check-in Date: <span className="font-medium text-gray-800">{checkinDate}</span></p>
                <p className="text-sm text-gray-600">Scrape Date: <span className="font-medium text-gray-800">{String((historicalData[0] as Record<string, unknown>)?.date ?? '')}</span></p>
                <p className="text-sm text-gray-600">Competitor Price: <span className="font-medium text-gray-800">{currency.format(convertPriceToSelectedCurrency((historicalData[0] as Record<string, unknown>)[compName] as number, 'MXN'))}</span></p>
                {typeof (historicalData[0] as Record<string, unknown>)[userHotelName] === 'number' && (
                   <p className="text-sm text-gray-600">Your Price: <span className="font-medium text-gray-800">{currency.format(convertPriceToSelectedCurrency((historicalData[0] as Record<string, unknown>)[userHotelName] as number, 'MXN'))}</span></p>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-4">A price evolution chart requires at least two data points from different dates.</p>
          </div>
        ) : (
          <div>
            <h3 className="text-lg font-semibold mb-2">Daily Price Evolution</h3>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={historicalData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <XAxis dataKey="date" axisLine={false} tickLine={false} />
                    <YAxis 
                      tickFormatter={(value) => currency.format(convertPriceToSelectedCurrency(value, 'MXN'))} 
                      axisLine={false} 
                      tickLine={false}
                    />
                    <Tooltip formatter={(value: number, name: string) => [currency.format(convertPriceToSelectedCurrency(value, 'MXN')), name]} />
                    <Legend />
                    <Line 
                      type="linear" 
                      dataKey={compName} 
                      stroke="#9CA3AF" 
                      strokeWidth={3} 
                      dot={<CustomizedDot min={priceBounds.min} max={priceBounds.max} />}
                      activeDot={{ r: 8 }} 
                    />
                    <Line 
                      type="linear" 
                      dataKey={userHotelName} 
                      stroke="#DC2626" 
                      strokeWidth={3}
                      dot={<CustomizedDot min={priceBounds.min} max={priceBounds.max} />}
                    />
                </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
