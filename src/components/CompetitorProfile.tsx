'use client';

import { useEffect, useState } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface CompetitorProfileProps {
  competitor: any;
  onClose: () => void;
}

const parsePrice = (price: string | number): number => {
  if (typeof price === 'number') return price;
  return parseFloat(price.replace(/[^0-9.-]+/g, ''));
};

export default function CompetitorProfile({ competitor, onClose }: CompetitorProfileProps) {
  const [historicalData, setHistoricalData] = useState<any[] | null>(null);
  const [userHotelName, setUserHotelName] = useState('Your Hotel');
  const [loading, setLoading] = useState(false);
  const { currency, convertPriceToSelectedCurrency } = useCurrency();

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
            competitorName: competitor.name,
            checkinDate: competitor.checkinDate 
          }),
        });
        const data = await response.json();
        console.log('API Response:', data); // <-- AÑADIR ESTO PARA DEPURAR

        if (data.success) {
            const userHotelName = data.userHotelData?.length > 0 ? data.userHotelData[0].hotel_name : 'Your Hotel';
            setUserHotelName(userHotelName);

            // The API now returns processed historical prices, so we can use it more directly.
            const processedCompetitorData = data.competitorData.map((item: any) => ({
                date: item.fecha_scrape,
                avgPrice: item.avgPrice,
            }));
            
            // The user data also needs to be mapped correctly, using scrape_date as the key.
            const processedUserData = data.userHotelData.map((item: any) => ({
                date: item.scrape_date,
                avgPrice: parsePrice(item.price),
            })).filter((item: any) => item.date); // Filter out entries without a scrape_date
            
            const competitorDataMap = new Map(processedCompetitorData.map((item: any) => [item.date, item.avgPrice]));
            const userDataMap = new Map(processedUserData.map((item: any) => [item.date, item.avgPrice]));
            
            const finalChartData = [];
            let lastKnownUserPrice: number | null = null;

            if (processedUserData.length > 0) {
                lastKnownUserPrice = processedUserData[0].avgPrice;
            }

            const uniqueCompetitorDates = [...competitorDataMap.keys()].sort();

            uniqueCompetitorDates.forEach(dateStr => {
                const competitorPrice = competitorDataMap.get(dateStr);

                const userPriceOnThisDate = userDataMap.get(dateStr);
                if (userPriceOnThisDate !== undefined) {
                    lastKnownUserPrice = userPriceOnThisDate;
                }
                
                finalChartData.push({
                    date: dateStr,
                    [competitor.name]: competitorPrice,
                    [userHotelName]: lastKnownUserPrice,
                });
            });

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
        <div className="flex justify-between items-center mb-6 pb-4 border-b">
            <h2 className="text-2xl font-bold text-gray-800">{competitor.name}</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-3xl leading-none p-2">&times;</button>
        </div>
        
        {loading ? (
          <div className="text-center p-8">
            <div className="w-16 h-16 border-4 border-gray-200 border-t-red-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading historical data...</p>
          </div>
        ) : !historicalData || historicalData.length === 0 ? (
          <div className="text-center p-8 bg-gray-50 rounded-lg">
            <p className="font-semibold text-gray-700">No historical data available</p>
            <p className="text-sm text-gray-500 mt-1">No price history was found for this competitor for a check-in on {competitor.checkinDate}.</p>
          </div>
        ) : historicalData.length < 2 ? (
          <div className="text-center p-8 bg-blue-50 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-800 mb-2">Insufficient Data for Evolution Chart</h3>
              <p className="text-sm text-blue-700">
                  Only one historical data point was found for {competitor.name}.
              </p>
              <div className="mt-4 text-left bg-white p-4 rounded-md shadow-sm">
                <p className="text-sm text-gray-600">Check-in Date: <span className="font-medium text-gray-800">{competitor.checkinDate}</span></p>
                <p className="text-sm text-gray-600">Scrape Date: <span className="font-medium text-gray-800">{historicalData[0].date}</span></p>
                <p className="text-sm text-gray-600">Competitor Price: <span className="font-medium text-gray-800">{currency.format(convertPriceToSelectedCurrency(historicalData[0][competitor.name], 'MXN'))}</span></p>
                {historicalData[0][userHotelName] && (
                   <p className="text-sm text-gray-600">Your Price: <span className="font-medium text-gray-800">{currency.format(convertPriceToSelectedCurrency(historicalData[0][userHotelName], 'MXN'))}</span></p>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-4">A price evolution chart requires at least two data points from different dates.</p>
          </div>
        ) : (
          <div>
            <h3 className="text-lg font-semibold mb-2">Price Evolution for Check-in on {competitor.checkinDate}</h3>
            <ResponsiveContainer width="100%" height={300}>
                <LineChart data={historicalData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis tickFormatter={(value) => currency.format(convertPriceToSelectedCurrency(value, 'MXN'))} />
                    <Tooltip formatter={(value: number, name: string) => [currency.format(convertPriceToSelectedCurrency(value, 'MXN')), name]} />
                    <Legend />
                    <Line type="monotone" dataKey={competitor.name} stroke="#8884d8" activeDot={{ r: 8 }} />
                    <Line type="monotone" dataKey={userHotelName} stroke="#82ca9d" />
                </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
