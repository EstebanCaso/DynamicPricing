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
  const [expandedRoomTypes, setExpandedRoomTypes] = useState<Set<number>>(new Set());
  const { updatePrice, refreshPrices } = usePriceContext();

  const toggleRoomTypeExpansion = (index: number) => {
    const newExpanded = new Set(expandedRoomTypes);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedRoomTypes(newExpanded);
  };

  const getPriceChangeIcon = (currentPrice: number, finalPrice: number) => {
    if (finalPrice > currentPrice) {
      return <span className="text-green-500">↗</span>;
    } else if (finalPrice < currentPrice) {
      return <span className="text-red-500">↘</span>;
    } else {
      return <span className="text-gray-500">→</span>;
    }
  };

  const getPriceChangeColor = (currentPrice: number, finalPrice: number) => {
    if (finalPrice > currentPrice) {
      return 'text-green-600';
    } else if (finalPrice < currentPrice) {
      return 'text-red-600';
    } else {
      return 'text-gray-600';
    }
  };

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
    <div className={`bg-white/80 backdrop-blur-md rounded-2xl shadow-xl border border-white/20 ${className}`}>
      {/* Compact Header */}
      <div className="p-4 border-b border-white/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-xl flex items-center justify-center backdrop-blur-sm border border-white/30">
              <span className="text-xl">🤖</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">AI Pricing Analysis</h3>
              <p className="text-sm text-gray-600">{targetDate}</p>
            </div>
          </div>
          {analysisResult && (
            <div className="text-right">
              <div className="text-xs text-gray-500">Total Adjustments</div>
              <div className="font-semibold text-green-600">{analysisResult.totalAdjustments}</div>
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {!analysisResult ? (
          <div className="text-center py-6">
            <div className="mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/30">
                <span className="text-3xl">🏨</span>
              </div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">
                Competitor-Driven Analysis
              </h4>
              <p className="text-gray-600 text-sm max-w-md mx-auto">
                Analyze competitor prices, apply intelligent adjustments, and optimize pricing per room type
              </p>
            </div>

            <button
              onClick={runCompetitorAnalysis}
              disabled={isAnalyzing}
              className="px-6 py-3 bg-gradient-to-r from-blue-600/90 to-purple-600/90 text-white rounded-xl hover:from-blue-700/90 hover:to-purple-700/90 transition-all duration-200 font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm border border-white/20 shadow-lg"
            >
              {isAnalyzing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Analyzing...
                </>
              ) : (
                <>
                  <span className="text-lg">🚀</span>
                  Start Analysis
                </>
              )}
            </button>

            {error && (
              <div className="mt-4 p-3 bg-red-50/80 backdrop-blur-sm border border-red-200/50 rounded-xl">
                <div className="text-red-800 text-sm">
                  <strong>Error:</strong> {error}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Success Badge */}
            <div className="bg-green-50/80 backdrop-blur-sm border border-green-200/50 rounded-xl p-3">
              <div className="flex items-center gap-2">
                <span className="text-green-600">✅</span>
                <span className="text-sm font-medium text-green-800">Analysis Complete</span>
              </div>
              <p className="text-xs text-green-700 mt-1">{analysisResult.summary}</p>
            </div>

            {/* Compact Room Type Results */}
            <div className="space-y-3">
              {analysisResult.roomTypes.map((roomTypeData, index) => {
                const isExpanded = expandedRoomTypes.has(index);
                const priceChange = roomTypeData.finalPrice - roomTypeData.currentPrice;
                const priceChangePercent = (priceChange / roomTypeData.currentPrice) * 100;
                
                return (
                  <div key={index} className="bg-white/60 backdrop-blur-sm border border-white/30 rounded-xl p-4 hover:bg-white/70 transition-all duration-200">
                    {/* Compact Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg flex items-center justify-center backdrop-blur-sm border border-white/30">
                          <span className="text-sm">🏨</span>
                        </div>
                        <div>
                          <h5 className="font-semibold text-gray-900 text-sm">{roomTypeData.roomType}</h5>
                          {roomTypeData.originalRoomType !== roomTypeData.roomType && (
                            <p className="text-xs text-gray-500">Original: {roomTypeData.originalRoomType}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getPriceChangeIcon(roomTypeData.currentPrice, roomTypeData.finalPrice)}
                        <div className="text-right">
                          <div className={`text-sm font-semibold ${getPriceChangeColor(roomTypeData.currentPrice, roomTypeData.finalPrice)}`}>
                            {priceChange > 0 ? '+' : ''}{formatCurrencyCard(Math.abs(priceChange))}
                          </div>
                          <div className="text-xs text-gray-500">
                            {priceChangePercent > 0 ? '+' : ''}{priceChangePercent.toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Key Metrics Grid */}
                    <div className="grid grid-cols-4 gap-3 mb-3">
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">Current</div>
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrencyCard(roomTypeData.currentPrice)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">Competitor</div>
                        <div className="text-sm font-medium text-blue-600">
                          {formatCurrencyCard(roomTypeData.medianPrice)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">Suggested</div>
                        <div className="text-sm font-medium text-purple-600">
                          {formatCurrencyCard(roomTypeData.suggestedPrice)}
                        </div>
                      </div>
                      <div className="text-center">
                        <div className="text-xs text-gray-500 mb-1">Final</div>
                        <div className="text-sm font-bold text-green-600">
                          {formatCurrencyCard(roomTypeData.finalPrice)}
                        </div>
                      </div>
                    </div>

                    {/* Expandable Details */}
                    <div className="border-t border-white/20 pt-3">
                      <button
                        onClick={() => toggleRoomTypeExpansion(index)}
                        className="w-full flex items-center justify-between text-xs text-gray-600 hover:text-gray-800 transition-colors"
                      >
                        <span>View Details</span>
                        <span className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                          ▼
                        </span>
                      </button>
                      
                      {isExpanded && (
                        <div className="mt-3 space-y-3 animate-fadeIn">
                          {/* Competitor Evidence */}
                          <div className="bg-blue-50/60 backdrop-blur-sm border border-blue-200/50 rounded-lg p-3">
                            <div className="text-xs font-medium text-blue-800 mb-2">Competitor Evidence</div>
                            <div className="text-xs text-blue-700">
                              Found {roomTypeData.competitorPrices.length} competitor prices: 
                              {roomTypeData.competitorPrices.slice(0, 5).map((price, i) => (
                                <span key={i} className="ml-1 font-mono">
                                  {formatCurrencyCompact(price)}
                                  {i < Math.min(roomTypeData.competitorPrices.length - 1, 4) ? ',' : ''}
                                </span>
                              ))}
                              {roomTypeData.competitorPrices.length > 5 && '...'}
                            </div>
                          </div>

                          {/* AI Reasoning */}
                          <div className="bg-purple-50/60 backdrop-blur-sm border border-purple-200/50 rounded-lg p-3">
                            <div className="text-xs font-medium text-purple-800 mb-2">AI Reasoning</div>
                            <ul className="text-xs text-purple-700 space-y-1">
                              {roomTypeData.reasoning.map((reason, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-purple-500 mt-0.5">•</span>
                                  <span>{reason}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Compact Action Buttons */}
            <div className="flex gap-3 pt-4 border-t border-white/20">
              <button
                onClick={applyPricing}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-green-600/90 to-emerald-600/90 text-white rounded-xl hover:from-green-700/90 hover:to-emerald-700/90 transition-all duration-200 font-medium backdrop-blur-sm border border-white/20 shadow-lg"
              >
                ✅ Apply All Changes
              </button>
              <button
                onClick={() => setAnalysisResult(null)}
                className="px-4 py-2 bg-white/60 backdrop-blur-sm text-gray-700 rounded-xl hover:bg-white/80 transition-all duration-200 font-medium border border-white/30"
              >
                New Analysis
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CompetitorPricingCard;
