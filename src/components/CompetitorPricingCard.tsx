import React, { useState } from 'react';
import { usePriceContext } from '@/contexts/PriceContext';
import { formatCurrencyCard, formatCurrencyCompact } from '@/lib/currencyFormatting';

interface CompetitorPricingResult {
  date: string;
  roomTypes: {
    roomType: string;
    originalRoomType: string;
    competitorPrices: number[];
    medianPrice: number;
    currentPrice: number;
    suggestedPrice: number;
    eventMultiplier: number;
    finalPrice: number;
    minPrice?: number;
    maxPrice?: number;
    reasoning: string[];
  }[];
  totalAdjustments: number;
  summary: string;
}

interface CompetitorPricingCardProps {
  targetDate: string;
  hotelId: string;
  onPricingApplied?: (result: CompetitorPricingResult) => void;
  className?: string;
}

const CompetitorPricingCard: React.FC<CompetitorPricingCardProps> = ({
  targetDate,
  hotelId,
  onPricingApplied,
  className = ''
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<CompetitorPricingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { updatePrice, refreshPrices } = usePriceContext();

  const runCompetitorAnalysis = async () => {
    if (!targetDate || !hotelId) {
      setError('Missing target date or hotel ID');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const response = await fetch('/api/ai/competitor-pricing', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetDate,
          hotelId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Analysis failed');
      }

      if (result.success && result.data) {
        setAnalysisResult(result.data);
        
        // Update prices in global context
        for (const roomTypeData of result.data.roomTypes) {
          await updatePrice(
            roomTypeData.roomType, 
            roomTypeData.finalPrice, 
            'Competitor-Driven AI Analysis'
          );
        }

        // Refresh all prices
        await refreshPrices();

        // Notify parent component
        if (onPricingApplied) {
          onPricingApplied(result.data);
        }

        console.log('✅ Competitor pricing analysis completed:', result.data.summary);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Analysis failed';
      setError(errorMessage);
      console.error('❌ Error in competitor pricing analysis:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyPricing = async () => {
    if (!analysisResult) return;

    try {
      // Prices are already applied in runCompetitorAnalysis
      alert(`✅ Pricing applied successfully!\n\n${analysisResult.summary}`);
    } catch (error) {
      console.error('Error applying pricing:', error);
      alert('❌ Error applying pricing. Please try again.');
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              🏨 Competitor-Driven Pricing Analysis
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Analyze competitor prices and apply intelligent pricing adjustments
            </p>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Analysis Date</div>
            <div className="font-medium text-gray-900">{targetDate}</div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {!analysisResult ? (
          <div className="text-center">
            <div className="mb-4">
              <div className="text-4xl mb-2">🤖</div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                Competitor-Driven Pricing Analysis
              </h4>
              <p className="text-gray-600 mb-4">
                This analysis will:
              </p>
              <ul className="text-left text-sm text-gray-600 space-y-1 mb-6">
                <li>• Analyze competitor prices from hotel_usuario and hoteles_parallel tables</li>
                <li>• Map room types using similarity rules (double ↔ doble, suite ↔ suite)</li>
                <li>• Calculate median competitor prices per room type</li>
                <li>• Apply competitor-based pricing rules (3% undercut, rounded to nearest 10)</li>
                <li>• Apply event markup if significant events are found</li>
                <li>• Respect min/max price constraints</li>
                <li>• Update final_price and ajuste_aplicado fields</li>
              </ul>
            </div>

            <button
              onClick={runCompetitorAnalysis}
              disabled={isAnalyzing}
              className="w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Analyzing Competitors...
                </>
              ) : (
                <>
                  <span className="text-xl">🏨</span>
                  Start Competitor Analysis
                </>
              )}
            </button>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-red-800 text-sm">
                  <strong>Error:</strong> {error}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="text-lg font-semibold text-green-800 flex items-center gap-2 mb-2">
                ✅ Analysis Complete
              </h4>
              <p className="text-green-700 text-sm">{analysisResult.summary}</p>
            </div>

            {/* Room Type Results */}
            <div className="space-y-4">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                📊 Room Type Analysis Results
              </h4>
              
              {analysisResult.roomTypes.map((roomTypeData, index) => (
                <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h5 className="font-semibold text-gray-900">{roomTypeData.roomType}</h5>
                      {roomTypeData.originalRoomType !== roomTypeData.roomType && (
                        <p className="text-xs text-gray-500">Original: {roomTypeData.originalRoomType}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-500">Price Change</div>
                      <div className={`font-semibold ${
                        roomTypeData.finalPrice > roomTypeData.currentPrice ? 'text-green-600' : 
                        roomTypeData.finalPrice < roomTypeData.currentPrice ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {roomTypeData.currentPrice > roomTypeData.finalPrice ? '-' : '+'}
                        {formatCurrencyCard(Math.abs(roomTypeData.finalPrice - roomTypeData.currentPrice))}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div className="text-center">
                      <div className="text-xs text-gray-500">Current Price</div>
                      <div className="font-medium text-gray-900">
                        {formatCurrencyCard(roomTypeData.currentPrice)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500">Competitor Median</div>
                      <div className="font-medium text-blue-600">
                        {formatCurrencyCard(roomTypeData.medianPrice)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500">Suggested Price</div>
                      <div className="font-medium text-purple-600">
                        {formatCurrencyCard(roomTypeData.suggestedPrice)}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500">Final Price</div>
                      <div className="font-semibold text-green-600">
                        {formatCurrencyCard(roomTypeData.finalPrice)}
                      </div>
                    </div>
                  </div>

                  <div className="mb-3">
                    <div className="text-xs text-gray-500 mb-1">Competitor Evidence</div>
                    <div className="text-sm text-gray-700">
                      Found {roomTypeData.competitorPrices.length} competitor prices: 
                      {roomTypeData.competitorPrices.slice(0, 5).map((price, i) => (
                        <span key={i} className="ml-1">
                          {formatCurrencyCompact(price)}
                          {i < Math.min(roomTypeData.competitorPrices.length - 1, 4) ? ',' : ''}
                        </span>
                      ))}
                      {roomTypeData.competitorPrices.length > 5 && '...'}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 mb-1">AI Reasoning</div>
                    <ul className="text-sm text-gray-700 space-y-1">
                      {roomTypeData.reasoning.map((reason, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-blue-500 mt-0.5">•</span>
                          <span>{reason}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              <button
                onClick={applyPricing}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
              >
                ✅ Apply All Pricing Changes
              </button>
              <button
                onClick={() => setAnalysisResult(null)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                Run New Analysis
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompetitorPricingCard;
