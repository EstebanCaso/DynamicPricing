"use client";

import { useState, useMemo } from 'react';
import { useCurrency } from '@/contexts/CurrencyContext';

interface PricingRecommendation {
  id: string;
  type: 'warning' | 'opportunity' | 'neutral' | 'critical';
  category: 'competitiveness' | 'market_position' | 'revenue_optimization' | 'demand_elasticity';
  title: string;
  description: string;
  currentValue: number;
  suggestedValue: number;
  impact: {
    revenue: 'increase' | 'decrease' | 'neutral';
    occupancy: 'increase' | 'decrease' | 'neutral';
    competitiveness: 'improve' | 'worsen' | 'maintain';
    percentage: number;
  };
  confidence: number; // 0-100
  priority: 'high' | 'medium' | 'low';
  reasoning: string[];
}

interface PricingIntelligenceProps {
  yourADR: number;
  marketADR: number;
  yourRevenue: number;
  marketRevenue: number;
  occupancyRate: number;
  className?: string;
}

export default function PricingIntelligence({
  yourADR,
  marketADR,
  yourRevenue,
  marketRevenue,
  occupancyRate,
  className = ""
}: PricingIntelligenceProps) {
  const { currency } = useCurrency();
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  // 🤖 IA: Análisis inteligente de pricing
  const recommendations = useMemo<PricingRecommendation[]>(() => {
    const recs: PricingRecommendation[] = [];
    
    // Calcular diferencia porcentual con el mercado
    const priceDiffPercent = ((yourADR - marketADR) / marketADR) * 100;
    const revenueDiffPercent = ((yourRevenue - marketRevenue) / marketRevenue) * 100;
    
    // 🚨 REGLA 1: Precio extremadamente alto vs mercado
    if (priceDiffPercent > 25) {
      const suggestedReduction = yourADR * 0.15; // Reducir 15%
      const newPrice = yourADR - suggestedReduction;
      
      recs.push({
        id: 'overpriced_critical',
        type: 'critical',
        category: 'competitiveness',
        title: 'Precio Muy Alto vs Competencia',
        description: `Tu ADR está ${Math.round(priceDiffPercent)}% por encima del mercado`,
        currentValue: yourADR,
        suggestedValue: newPrice,
        impact: {
          revenue: 'increase',
          occupancy: 'increase',
          competitiveness: 'improve',
          percentage: 20 // Estimación de aumento en ocupación
        },
        confidence: 85,
        priority: 'high',
        reasoning: [
          `Precio ${Math.round(priceDiffPercent)}% por encima del mercado puede limitar demanda`,
          'Reducción del 15% podría aumentar ocupación en 20%',
          'Mayor ocupación compensaría la reducción de precio',
          'Mejora significativa en competitividad'
        ]
      });
    }
    
    // ⚠️ REGLA 2: Precio alto pero con buen revenue
    else if (priceDiffPercent > 10 && priceDiffPercent <= 25) {
      if (revenueDiffPercent > 0) {
        // Precio alto pero funciona - optimizar marginalmente
        recs.push({
          id: 'premium_pricing_working',
          type: 'opportunity',
          category: 'revenue_optimization',
          title: 'Estrategia Premium Exitosa',
          description: `Precio alto (${Math.round(priceDiffPercent)}%) pero revenue superior`,
          currentValue: yourADR,
          suggestedValue: yourADR * 0.97, // Reducir solo 3%
          impact: {
            revenue: 'increase',
            occupancy: 'increase',
            competitiveness: 'improve',
            percentage: 8
          },
          confidence: 70,
          priority: 'medium',
          reasoning: [
            'Tu estrategia premium está generando buen revenue',
            'Reducción mínima (3%) podría capturar más demanda',
            'Mantén el posicionamiento premium',
            'Monitorea elasticidad de demanda'
          ]
        });
      } else {
        // Precio alto pero revenue bajo - problema serio
        recs.push({
          id: 'high_price_low_revenue',
          type: 'warning',
          category: 'competitiveness',
          title: 'Precio Alto, Revenue Bajo',
          description: `Precio ${Math.round(priceDiffPercent)}% alto pero revenue menor al mercado`,
          currentValue: yourADR,
          suggestedValue: marketADR * 1.05, // Cerca del mercado
          impact: {
            revenue: 'increase',
            occupancy: 'increase',
            competitiveness: 'improve',
            percentage: 25
          },
          confidence: 80,
          priority: 'high',
          reasoning: [
            'Precio alto no está traduciendo en revenue superior',
            'Posible resistencia del mercado a tu pricing',
            'Alinearse más cerca del mercado',
            'Focus en value proposition vs precio'
          ]
        });
      }
    }
    
    // 📈 REGLA 3: Precio competitivo - oportunidad de aumento
    else if (priceDiffPercent >= -5 && priceDiffPercent <= 10) {
      if (occupancyRate > 80) {
        recs.push({
          id: 'increase_opportunity',
          type: 'opportunity',
          category: 'revenue_optimization',
          title: 'Oportunidad de Incremento',
          description: `Alta ocupación (${occupancyRate}%) permite subir precios`,
          currentValue: yourADR,
          suggestedValue: yourADR * 1.08, // Aumentar 8%
          impact: {
            revenue: 'increase',
            occupancy: 'decrease',
            competitiveness: 'maintain',
            percentage: 12
          },
          confidence: 75,
          priority: 'medium',
          reasoning: [
            `Ocupación de ${occupancyRate}% indica demanda fuerte`,
            'Mercado puede soportar precio ligeramente mayor',
            'Incremento gradual del 8% para testing',
            'Monitorear impacto en reservas'
          ]
        });
      }
    }
    
    // 💎 REGLA 4: Precio bajo - oportunidad perdida
    else if (priceDiffPercent < -10) {
      recs.push({
        id: 'underpriced',
        type: 'opportunity',
        category: 'revenue_optimization',
        title: 'Precios Por Debajo del Mercado',
        description: `Tu ADR está ${Math.abs(Math.round(priceDiffPercent))}% por debajo del mercado`,
        currentValue: yourADR,
        suggestedValue: marketADR * 0.95, // 95% del mercado
        impact: {
          revenue: 'increase',
          occupancy: 'neutral',
          competitiveness: 'maintain',
          percentage: Math.abs(priceDiffPercent) * 0.8
        },
        confidence: 85,
        priority: 'high',
        reasoning: [
          'Estás perdiendo revenue potencial',
          'El mercado puede pagar más',
          'Incremento gradual hacia precio de mercado',
          'Mantén ventaja competitiva con 5% descuento'
        ]
      });
    }
    
    // 🎯 REGLA 5: Análisis de elasticidad específico por ocupación
    if (occupancyRate < 60) {
      recs.push({
        id: 'low_occupancy_strategy',
        type: 'warning',
        category: 'demand_elasticity',
        title: 'Baja Ocupación - Revisar Estrategia',
        description: `Ocupación de ${occupancyRate}% sugiere resistencia al precio`,
        currentValue: yourADR,
        suggestedValue: yourADR * 0.9, // Reducir 10%
        impact: {
          revenue: 'increase',
          occupancy: 'increase',
          competitiveness: 'improve',
          percentage: 25
        },
        confidence: 70,
        priority: 'high',
        reasoning: [
          'Baja ocupación indica precio puede ser factor limitante',
          'Reducción del 10% para estimular demanda',
          'Focus en llenar habitaciones vs maximizar ADR',
          'Evaluar estrategias de marketing paralelas'
        ]
      });
    }

    return recs.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }, [yourADR, marketADR, yourRevenue, marketRevenue, occupancyRate]);

  const getTypeIcon = (type: PricingRecommendation['type']) => {
    switch (type) {
      case 'critical': return '🚨';
      case 'warning': return '⚠️';
      case 'opportunity': return '💎';
      case 'neutral': return 'ℹ️';
    }
  };

  const getTypeColor = (type: PricingRecommendation['type']) => {
    switch (type) {
      case 'critical': return 'border-red-200 bg-red-50';
      case 'warning': return 'border-yellow-200 bg-yellow-50';
      case 'opportunity': return 'border-green-200 bg-green-50';
      case 'neutral': return 'border-blue-200 bg-blue-50';
    }
  };

  const getPriorityColor = (priority: PricingRecommendation['priority']) => {
    switch (priority) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-blue-600 bg-blue-100';
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            🤖 Análisis Inteligente de Pricing
          </h3>
          <p className="text-sm text-gray-600">
            Recomendaciones basadas en IA y análisis de mercado
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Confianza promedio</div>
          <div className="text-lg font-bold text-arkus-600">
            {Math.round(recommendations.reduce((sum, r) => sum + r.confidence, 0) / Math.max(recommendations.length, 1))}%
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="space-y-3">
        {recommendations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-sm">Tu estrategia de pricing está bien balanceada</p>
            <p className="text-xs mt-1">No hay recomendaciones críticas en este momento</p>
          </div>
        ) : (
          recommendations.map((rec) => (
            <div
              key={rec.id}
              className={`border rounded-lg transition-all duration-300 ${getTypeColor(rec.type)} ${
                expandedCard === rec.id ? 'shadow-lg' : 'hover:shadow-md'
              }`}
            >
              {/* Recommendation Header */}
              <div
                className="p-4 cursor-pointer"
                onClick={() => setExpandedCard(expandedCard === rec.id ? null : rec.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xl">{getTypeIcon(rec.type)}</span>
                      <div>
                        <h4 className="font-semibold text-gray-900">{rec.title}</h4>
                        <p className="text-sm text-gray-600">{rec.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Actual:</span>
                        <span className="font-semibold">{currency.format(rec.currentValue)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Sugerido:</span>
                        <span className="font-semibold text-arkus-600">{currency.format(rec.suggestedValue)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Impacto:</span>
                        <span className="font-semibold text-green-600">+{rec.impact.percentage}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-2">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPriorityColor(rec.priority)}`}>
                      {rec.priority.toUpperCase()}
                    </span>
                    <div className="text-xs text-gray-500">
                      {rec.confidence}% confianza
                    </div>
                    <div className="text-lg text-gray-400">
                      {expandedCard === rec.id ? '↑' : '↓'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Expanded Details */}
              {expandedCard === rec.id && (
                <div className="border-t border-gray-200 bg-white/50 p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Reasoning */}
                    <div>
                      <h5 className="font-semibold text-gray-900 mb-2">🧠 Razonamiento:</h5>
                      <ul className="space-y-1 text-sm text-gray-600">
                        {rec.reasoning.map((reason, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-arkus-500 mt-1">•</span>
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    {/* Impact Analysis */}
                    <div>
                      <h5 className="font-semibold text-gray-900 mb-2">📊 Impacto Esperado:</h5>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Revenue:</span>
                          <span className={`font-semibold ${
                            rec.impact.revenue === 'increase' ? 'text-green-600' : 
                            rec.impact.revenue === 'decrease' ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {rec.impact.revenue === 'increase' ? '↗ Aumento' : 
                             rec.impact.revenue === 'decrease' ? '↘ Disminución' : '→ Neutral'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Ocupación:</span>
                          <span className={`font-semibold ${
                            rec.impact.occupancy === 'increase' ? 'text-green-600' : 
                            rec.impact.occupancy === 'decrease' ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {rec.impact.occupancy === 'increase' ? '↗ Aumento' : 
                             rec.impact.occupancy === 'decrease' ? '↘ Disminución' : '→ Neutral'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Competitividad:</span>
                          <span className={`font-semibold ${
                            rec.impact.competitiveness === 'improve' ? 'text-green-600' : 
                            rec.impact.competitiveness === 'worsen' ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {rec.impact.competitiveness === 'improve' ? '↗ Mejora' : 
                             rec.impact.competitiveness === 'worsen' ? '↘ Empeora' : '→ Mantiene'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Action Button */}
                  <div className="mt-4 pt-3 border-t border-gray-200">
                    <button className="w-full bg-arkus-600 text-white py-2 px-4 rounded-lg hover:bg-arkus-700 transition-colors text-sm font-medium">
                      🚀 Aplicar Recomendación
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Quick Stats */}
      {recommendations.length > 0 && (
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
          <div className="text-center">
            <div className="text-lg font-bold text-red-600">
              {recommendations.filter(r => r.type === 'critical').length}
            </div>
            <div className="text-xs text-gray-600">Críticas</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-yellow-600">
              {recommendations.filter(r => r.type === 'warning').length}
            </div>
            <div className="text-xs text-gray-600">Advertencias</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-green-600">
              {recommendations.filter(r => r.type === 'opportunity').length}
            </div>
            <div className="text-xs text-gray-600">Oportunidades</div>
          </div>
        </div>
      )}
    </div>
  );
}
