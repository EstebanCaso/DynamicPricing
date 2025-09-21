"use client";

import { useState, useEffect } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';
import { usePriceUpdates } from '@/contexts/PriceUpdateContext';

interface AIRecommendation {
  recommendedPrice: number;
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  confidence: number;
  reasoning: string[];
  expectedOutcomes: {
    revenue: 'increase' | 'decrease' | 'neutral';
    occupancy: 'increase' | 'decrease' | 'neutral';
    competitiveness: 'improve' | 'worsen' | 'maintain';
    percentage: number;
  };
  riskFactors: string[];
  alternativePrices: { price: number; scenario: string; probability: number }[];
}

interface AIAnalysisResult {
  success: boolean;
  data?: {
    mode: string;
    targetDate: string;
    endDate?: string;
    hotelId: string;
    recommendations: AIRecommendation[];
    timestamp: string;
    aiVersion: string;
  };
  error?: string;
}

interface IntelligentPricingCardProps {
  targetDate: string;
  hotelId: string;
  onRecommendationApplied?: (recommendation: AIRecommendation) => void;
  className?: string;
}

export default function IntelligentPricingCard({
  targetDate,
  hotelId,
  onRecommendationApplied,
  className = ""
}: IntelligentPricingCardProps) {
  const { currency, convertPriceToSelectedCurrency } = useCurrency();
  const { triggerPriceUpdate } = usePriceUpdates();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedRecommendation, setSelectedRecommendation] = useState<AIRecommendation | null>(null);

  // Ejecutar análisis automáticamente cuando cambie la fecha
  useEffect(() => {
    if (targetDate && hotelId) {
      runAnalysis();
    }
  }, [targetDate, hotelId]);

  const runAnalysis = async () => {
    try {
      setIsAnalyzing(true);
      setError(null);
      setAnalysisResult(null);

      console.log(`🤖 Ejecutando análisis de IA para ${targetDate}`);

      const response = await fetch('/api/ai/pricing-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetDate,
          hotelId,
          mode: 'single'
        }),
      });

      const result: AIAnalysisResult = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Error en análisis de IA');
      }

      setAnalysisResult(result);
      
      // Seleccionar la primera recomendación por defecto
      if (result.data?.recommendations.length > 0) {
        setSelectedRecommendation(result.data.recommendations[0]);
      }

      console.log(`✅ Análisis completado:`, result);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('❌ Error en análisis:', err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const applyRecommendation = async (recommendation: AIRecommendation) => {
    try {
      console.log('🚀 Applying recommendation:', recommendation);
      
      // Update price in database
      const response = await fetch('/api/calendar/apply-prices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          date: targetDate,
          prices: [{
            room_type: 'Standard', // Default room type
            new_price: recommendation.recommendedPrice
          }]
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to apply price');
      }

      // Trigger global price update
      triggerPriceUpdate(targetDate, recommendation.recommendedPrice);
      
      // Notify parent component
      if (onRecommendationApplied) {
        onRecommendationApplied(recommendation);
      }

      // Show confirmation
      alert(`✅ Price applied: ${currency.format(recommendation.recommendedPrice)} MXN`);

    } catch (err) {
      console.error('❌ Error applying recommendation:', err);
      alert('❌ Error applying recommendation');
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-100';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getOutcomeIcon = (outcome: string) => {
    switch (outcome) {
      case 'increase': return '↗️';
      case 'decrease': return '↘️';
      case 'improve': return '📈';
      case 'worsen': return '📉';
      default: return '➡️';
    }
  };

  const getOutcomeColor = (outcome: string) => {
    switch (outcome) {
      case 'increase':
      case 'improve': return 'text-green-600';
      case 'decrease':
      case 'worsen': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              🤖 Intelligent Pricing Analysis
            </h3>
            <p className="text-sm text-gray-600">
              AI analyzes events, competition and market for {targetDate}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {isAnalyzing && (
              <div className="flex items-center gap-2 text-sm text-blue-600">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                Analyzing...
              </div>
            )}
            
            <button
              onClick={runAnalysis}
              disabled={isAnalyzing}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              🔄 Re-analyze
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {isAnalyzing && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">AI is analyzing events, competition and market...</p>
            <p className="text-sm text-gray-500 mt-2">This may take a few seconds</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <span className="text-xl">❌</span>
              <span className="font-medium">Analysis Error</span>
            </div>
            <p className="text-red-700 mt-2">{error}</p>
            <button
              onClick={runAnalysis}
              className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
            >
              🔄 Try Again
            </button>
          </div>
        )}

        {analysisResult?.data && selectedRecommendation && (
          <div className="space-y-6">
            {/* Resumen de análisis */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-blue-800 mb-2">
                <span className="text-xl">📊</span>
                <span className="font-medium">Analysis Summary</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-blue-600 font-medium">Date</div>
                  <div className="text-blue-800">{targetDate}</div>
                </div>
                <div>
                  <div className="text-blue-600 font-medium">AI Version</div>
                  <div className="text-blue-800">{analysisResult.data.aiVersion}</div>
                </div>
                <div>
                  <div className="text-blue-600 font-medium">Analysis</div>
                  <div className="text-blue-800">{analysisResult.data.timestamp}</div>
                </div>
                <div>
                  <div className="text-blue-600 font-medium">Confidence</div>
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(selectedRecommendation.confidence)}`}>
                    {selectedRecommendation.confidence}%
                  </div>
                </div>
              </div>
            </div>

            {/* Recomendación principal */}
            <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  💡 Recomendación Principal
                </h4>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${getConfidenceColor(selectedRecommendation.confidence)}`}>
                  {selectedRecommendation.confidence}% confianza
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Precio actual vs recomendado */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Precio Actual:</span>
                    <span className="font-semibold text-gray-900">
                      {currency.format(selectedRecommendation.currentPrice)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Precio Recomendado:</span>
                    <span className="font-semibold text-green-600 text-lg">
                      {currency.format(selectedRecommendation.recommendedPrice)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600">Cambio:</span>
                    <span className={`font-semibold ${
                      selectedRecommendation.priceChange >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {selectedRecommendation.priceChange >= 0 ? '+' : ''}
                      {currency.format(selectedRecommendation.priceChange)} 
                      ({selectedRecommendation.priceChangePercent >= 0 ? '+' : ''}
                      {selectedRecommendation.priceChangePercent.toFixed(1)}%)
                    </span>
                  </div>
                </div>

                {/* Impacto esperado */}
                <div className="space-y-3">
                  <div className="text-gray-600 font-medium mb-2">Impacto Esperado:</div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Revenue:</span>
                      <span className={`text-sm font-medium ${getOutcomeColor(selectedRecommendation.expectedOutcomes.revenue)}`}>
                        {getOutcomeIcon(selectedRecommendation.expectedOutcomes.revenue)} 
                        {selectedRecommendation.expectedOutcomes.revenue}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Ocupación:</span>
                      <span className={`text-sm font-medium ${getOutcomeColor(selectedRecommendation.expectedOutcomes.occupancy)}`}>
                        {getOutcomeIcon(selectedRecommendation.expectedOutcomes.occupancy)} 
                        {selectedRecommendation.expectedOutcomes.occupancy}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Competitividad:</span>
                      <span className={`text-sm font-medium ${getOutcomeColor(selectedRecommendation.expectedOutcomes.competitiveness)}`}>
                        {getOutcomeIcon(selectedRecommendation.expectedOutcomes.competitiveness)} 
                        {selectedRecommendation.expectedOutcomes.competitiveness}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Acción */}
                <div className="flex flex-col justify-center">
                  <button
                    onClick={() => applyRecommendation(selectedRecommendation)}
                    className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium"
                  >
                    🚀 Aplicar Recomendación
                  </button>
                  <p className="text-xs text-gray-500 mt-2 text-center">
                    Impacto esperado: +{selectedRecommendation.expectedOutcomes.percentage}%
                  </p>
                </div>
              </div>
            </div>

            {/* Razonamiento de la IA */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                🧠 Razonamiento de la IA
              </h4>
              <div className="space-y-3">
                {selectedRecommendation.reasoning.map((reason, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <span className="text-blue-500 mt-1">•</span>
                    <span className="text-gray-700">{reason}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Factores de riesgo */}
            {selectedRecommendation.riskFactors.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                  ⚠️ Factores de Riesgo
                </h4>
                <div className="space-y-2">
                  {selectedRecommendation.riskFactors.map((risk, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <span className="text-yellow-600 mt-1">⚠️</span>
                      <span className="text-gray-700">{risk}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Precios alternativos */}
            {selectedRecommendation.alternativePrices.length > 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
                  🔄 Precios Alternativos
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {selectedRecommendation.alternativePrices.map((alt, index) => (
                    <div key={index} className="bg-white border border-purple-200 rounded-lg p-4">
                      <div className="text-center">
                        <div className="text-lg font-semibold text-purple-600">
                          {currency.format(alt.price)}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {alt.scenario}
                        </div>
                        <div className="text-xs text-purple-500 mt-2">
                          {alt.probability * 100}% probabilidad
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {analysisResult?.data && analysisResult.data.recommendations.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">🤖</div>
            <p className="text-sm">No se encontraron eventos para esta fecha</p>
            <p className="text-xs mt-1">La IA no detectó factores que justifiquen ajustes de precio</p>
          </div>
        )}
      </div>
    </div>
  );
}
