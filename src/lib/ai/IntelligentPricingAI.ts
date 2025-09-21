/**
 * Intelligent AI System for Dynamic Pricing
 * Analyzes events, competition, and market to automatically adjust prices
 */

import { supabase } from '@/lib/supabaseClient';

// ===== DATA TYPES =====
export interface EventIntelligence {
  eventId: string;
  eventName: string;
  eventDate: string;
  eventType: 'concert' | 'conference' | 'sports' | 'festival' | 'business' | 'cultural' | 'other';
  expectedAttendance: number;
  targetAudience: string[];
  venueCapacity: number;
  ticketPrices: { min: number; max: number; currency: string };
  socialMediaBuzz: 'low' | 'medium' | 'high' | 'viral';
  historicalSimilarEvents: EventHistory[];
  demandForecast: 'low' | 'medium' | 'high' | 'extreme';
  priceImpactMultiplier: number; // 0.8 - 2.0
  confidence: number; // 0-100
}

export interface CompetitorIntelligence {
  hotelId: string;
  hotelName: string;
  distance: number; // km from event
  currentPrice: number;
  priceTrend: 'increasing' | 'decreasing' | 'stable';
  occupancyRate: number;
  competitiveLevel: 'direct' | 'indirect' | 'distant';
  pricingStrategy: 'premium' | 'competitive' | 'budget' | 'dynamic';
  threatLevel: 'low' | 'medium' | 'high';
  similarityScore: number; // 0-1
  isMainCompetitor: boolean; // NEW: Identifies real main competitors
  marketPosition: 'leader' | 'premium' | 'competitive' | 'budget';
}

export interface MarketIntelligence {
  marketDemand: 'low' | 'medium' | 'high' | 'extreme';
  supplyAvailability: 'abundant' | 'moderate' | 'limited' | 'scarce';
  priceTrends: 'decreasing' | 'stable' | 'increasing' | 'volatile';
  competitorReactions: CompetitorReaction[];
  marketOpportunity: number; // 0-1
}

export interface PricingRecommendation {
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

export interface EventHistory {
  eventName: string;
  date: string;
  attendance: number;
  priceImpact: number;
  revenueImpact: number;
  occupancyImpact: number;
}

export interface CompetitorReaction {
  competitorId: string;
  priceChange: number;
  changePercent: number;
  timing: 'early' | 'same_day' | 'late';
}

// ===== MAIN AI CLASS =====
export class IntelligentPricingAI {
  private apiKeys: {
    openai?: string;
    googleSearch?: string;
    eventbrite?: string;
  };

  constructor(apiKeys: { openai?: string; googleSearch?: string; eventbrite?: string }) {
    this.apiKeys = apiKeys;
  }

  /**
   * Main function: Analyzes and recommends prices for a specific day
   */
  async analyzeAndRecommendPricing(
    targetDate: string,
    hotelId: string
  ): Promise<PricingRecommendation> {
    console.log(`🤖 AI: Starting analysis for ${targetDate}`);

    try {
      // 1. Get events for the day
      const events = await this.getEventsForDate(targetDate);
      console.log(`📅 Events found: ${events.length}`);

      // 2. Analyze each event with AI
      const eventIntelligence = await this.analyzeEventsWithAI(events);
      console.log(`🧠 Event analysis completed`);

      // 3. Identify main competitors (not just all competitors)
      const competitorIntelligence = await this.identifyMainCompetitorsWithAI(events, hotelId);
      console.log(`🏨 Main competitors identified: ${competitorIntelligence.filter(c => c.isMainCompetitor).length}`);

      // 4. Analyze dynamic market
      const marketIntelligence = await this.analyzeMarketDynamics(eventIntelligence, competitorIntelligence);
      console.log(`📊 Market analysis completed`);

      // 5. Generate intelligent recommendation
      const recommendation = await this.generateIntelligentRecommendation(
        eventIntelligence,
        competitorIntelligence,
        marketIntelligence,
        hotelId,
        targetDate
      );

      console.log(`✅ Recommendation generated: $${recommendation.recommendedPrice} MXN`);
      return recommendation;

    } catch (error) {
      console.error('❌ Error in AI analysis:', error);
      throw new Error(`Error in AI analysis: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Obtiene eventos para una fecha específica
   */
  private async getEventsForDate(date: string) {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('fecha', date)
      .order('fecha', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  /**
   * Analiza eventos usando IA para entender su impacto
   */
  private async analyzeEventsWithAI(events: any[]): Promise<EventIntelligence[]> {
    const eventIntelligence: EventIntelligence[] = [];

    for (const event of events) {
      try {
        // Buscar información del evento en internet
        const eventDetails = await this.searchEventOnline(event);
        
        // Analizar tipo de evento y audiencia
        const eventAnalysis = await this.analyzeEventType(eventDetails);
        
        // Calcular impacto en demanda
        const demandForecast = await this.forecastDemand(eventAnalysis);
        
        // Calcular multiplicador de precio
        const priceImpactMultiplier = await this.calculatePriceImpact(eventAnalysis, demandForecast);

        eventIntelligence.push({
          eventId: event.id,
          eventName: event.nombre,
          eventDate: event.fecha,
          eventType: eventAnalysis.type,
          expectedAttendance: eventAnalysis.attendance,
          targetAudience: eventAnalysis.audience,
          venueCapacity: eventAnalysis.capacity,
          ticketPrices: eventAnalysis.ticketPrices,
          socialMediaBuzz: eventAnalysis.buzz,
          historicalSimilarEvents: await this.getHistoricalSimilarEvents(eventAnalysis.type),
          demandForecast,
          priceImpactMultiplier,
          confidence: eventAnalysis.confidence
        });

      } catch (error) {
        console.error(`Error analizando evento ${event.nombre}:`, error);
        // Continuar con el siguiente evento
      }
    }

    return eventIntelligence;
  }

  /**
   * Busca información del evento en internet
   */
  private async searchEventOnline(event: any): Promise<any> {
    // Simular búsqueda web (implementar con APIs reales)
    const searchQuery = `${event.nombre} ${event.lugar} ${event.fecha}`;
    
    // Por ahora, usar análisis básico del nombre del evento
    const eventDetails = await this.analyzeEventName(event.nombre);
    
    return {
      name: event.nombre,
      venue: event.lugar,
      date: event.fecha,
      ...eventDetails
    };
  }

  /**
   * Analiza el tipo de evento basado en el nombre
   */
  private async analyzeEventName(eventName: string): Promise<any> {
    // Patrones para identificar tipos de eventos
    const patterns = {
      concert: ['concierto', 'concert', 'show', 'tour', 'festival', 'música', 'music'],
      conference: ['conferencia', 'conference', 'congreso', 'summit', 'expo', 'exposición'],
      sports: ['deportes', 'sports', 'fútbol', 'football', 'béisbol', 'baseball', 'boxeo', 'boxing'],
      festival: ['festival', 'carnaval', 'carnival', 'feria', 'fair'],
      business: ['negocios', 'business', 'empresarial', 'corporate', 'networking'],
      cultural: ['cultural', 'arte', 'art', 'teatro', 'theater', 'museo', 'museum']
    };

    const eventNameLower = eventName.toLowerCase();
    let eventType = 'other';
    let confidence = 0.5;

    for (const [type, keywords] of Object.entries(patterns)) {
      const matches = keywords.filter(keyword => eventNameLower.includes(keyword));
      if (matches.length > 0) {
        eventType = type;
        confidence = Math.min(0.9, 0.5 + (matches.length * 0.1));
        break;
      }
    }

    // Calcular métricas estimadas basadas en el tipo
    const metrics = this.estimateEventMetrics(eventType, eventName);

    return {
      type: eventType,
      confidence,
      attendance: metrics.attendance,
      audience: metrics.audience,
      capacity: metrics.capacity,
      ticketPrices: metrics.ticketPrices,
      buzz: metrics.buzz
    };
  }

  /**
   * Estima métricas del evento basado en el tipo
   */
  private estimateEventMetrics(eventType: string, eventName: string): any {
    const metrics = {
      concert: {
        attendance: 5000,
        audience: ['jóvenes', 'adultos'],
        capacity: 8000,
        ticketPrices: { min: 50, max: 200, currency: 'USD' },
        buzz: 'high' as const
      },
      conference: {
        attendance: 500,
        audience: ['profesionales', 'empresarios'],
        capacity: 1000,
        ticketPrices: { min: 100, max: 500, currency: 'USD' },
        buzz: 'medium' as const
      },
      sports: {
        attendance: 15000,
        audience: ['familias', 'deportistas'],
        capacity: 20000,
        ticketPrices: { min: 30, max: 150, currency: 'USD' },
        buzz: 'high' as const
      },
      festival: {
        attendance: 10000,
        audience: ['jóvenes', 'familias'],
        capacity: 15000,
        ticketPrices: { min: 25, max: 100, currency: 'USD' },
        buzz: 'high' as const
      },
      business: {
        attendance: 200,
        audience: ['profesionales', 'ejecutivos'],
        capacity: 500,
        ticketPrices: { min: 200, max: 800, currency: 'USD' },
        buzz: 'low' as const
      },
      cultural: {
        attendance: 1000,
        audience: ['adultos', 'familias'],
        capacity: 2000,
        ticketPrices: { min: 20, max: 80, currency: 'USD' },
        buzz: 'medium' as const
      },
      other: {
        attendance: 500,
        audience: ['general'],
        capacity: 1000,
        ticketPrices: { min: 30, max: 100, currency: 'USD' },
        buzz: 'medium' as const
      }
    };

    return metrics[eventType as keyof typeof metrics] || metrics.other;
  }

  /**
   * Identifies main competitors using AI (not just all competitors)
   */
  private async identifyMainCompetitorsWithAI(events: any[], hotelId: string): Promise<CompetitorIntelligence[]> {
    // Get competitor data from database
    const { data: competitors, error } = await supabase
      .from('hoteles_parallel')
      .select('*')
      .limit(50);

    if (error) throw error;

    const competitorIntelligence: CompetitorIntelligence[] = [];

    for (const competitor of competitors || []) {
      try {
        // Analyze if it's a main competitor for the day's events
        const competitorAnalysis = await this.analyzeMainCompetitorRelevance(competitor, events);
        
        competitorIntelligence.push({
          hotelId: competitor.id,
          hotelName: competitor.nombre,
          distance: competitorAnalysis.distance,
          currentPrice: competitorAnalysis.currentPrice,
          priceTrend: competitorAnalysis.priceTrend,
          occupancyRate: competitorAnalysis.occupancyRate,
          competitiveLevel: competitorAnalysis.level,
          pricingStrategy: competitorAnalysis.strategy,
          threatLevel: competitorAnalysis.threat,
          similarityScore: competitorAnalysis.similarity,
          isMainCompetitor: competitorAnalysis.isMainCompetitor,
          marketPosition: competitorAnalysis.marketPosition
        });
      } catch (error) {
        console.error(`Error analyzing competitor ${competitor.nombre}:`, error);
      }
    }

    return competitorIntelligence;
  }

  /**
   * Analyzes main competitor relevance for specific events
   */
  private async analyzeMainCompetitorRelevance(competitor: any, events: any[]): Promise<any> {
    // Calculate distance to events (simplified)
    const distance = Math.random() * 10; // km
    
    // Extract current price
    const currentPrice = this.extractCurrentPrice(competitor);
    
    // Calculate similarity score
    const similarity = this.calculateSimilarityScore(competitor);
    
    // Determine if it's a main competitor based on multiple factors
    const isMainCompetitor = this.determineMainCompetitor(competitor, similarity, distance, currentPrice);
    
    // Determine market position
    const marketPosition = this.determineMarketPosition(currentPrice, similarity);
    
    return {
      distance,
      currentPrice,
      priceTrend: 'stable' as const,
      occupancyRate: 0.75,
      level: isMainCompetitor ? 'direct' as const : 'indirect' as const,
      strategy: this.determinePricingStrategy(currentPrice, similarity),
      threat: this.determineThreatLevel(currentPrice, similarity, isMainCompetitor),
      similarity,
      isMainCompetitor,
      marketPosition
    };
  }

  /**
   * Determines if competitor is a main competitor
   */
  private determineMainCompetitor(competitor: any, similarity: number, distance: number, price: number): boolean {
    // Main competitor criteria:
    // 1. High similarity (>0.7)
    // 2. Close distance (<5km) 
    // 3. Similar price range (500-5000 MXN)
    // 4. Similar star rating
    // 5. Same city/location
    
    const isHighSimilarity = similarity > 0.7;
    const isCloseDistance = distance < 5;
    const hasReasonablePrice = price > 500 && price < 5000;
    const isSameCity = competitor.ciudad && competitor.ciudad.toLowerCase().includes('tijuana');
    const hasSimilarStars = competitor.estrellas && parseInt(competitor.estrellas) >= 3;

    return isHighSimilarity && isCloseDistance && hasReasonablePrice && isSameCity && hasSimilarStars;
  }

  /**
   * Calculates similarity score between competitor and our hotel
   */
  private calculateSimilarityScore(competitor: any): number {
    let similarity = 0.5; // Base similarity

    // Adjust based on stars
    if (competitor.estrellas) {
      const stars = parseInt(competitor.estrellas);
      if (stars >= 4) similarity += 0.2;
      if (stars >= 5) similarity += 0.1;
    }

    // Adjust based on location
    if (competitor.ciudad && competitor.ciudad.toLowerCase().includes('tijuana')) {
      similarity += 0.2;
    }

    // Adjust based on hotel type/name
    if (competitor.nombre) {
      const name = competitor.nombre.toLowerCase();
      if (name.includes('hotel') || name.includes('inn') || name.includes('suites')) {
        similarity += 0.1;
      }
    }

    return Math.min(1, similarity);
  }

  /**
   * Determines market position
   */
  private determineMarketPosition(price: number, similarity: number): 'leader' | 'premium' | 'competitive' | 'budget' {
    if (price > 3000 && similarity > 0.8) return 'leader';
    if (price > 2000 && similarity > 0.6) return 'premium';
    if (price > 1000 && similarity > 0.4) return 'competitive';
    return 'budget';
  }

  /**
   * Determines pricing strategy
   */
  private determinePricingStrategy(price: number, similarity: number): 'premium' | 'competitive' | 'budget' | 'dynamic' {
    if (price > 2500) return 'premium';
    if (price > 1500) return 'competitive';
    if (price < 1000) return 'budget';
    return 'dynamic';
  }

  /**
   * Determines threat level
   */
  private determineThreatLevel(price: number, similarity: number, isMainCompetitor: boolean): 'low' | 'medium' | 'high' {
    if (isMainCompetitor && similarity > 0.8 && price < 1500) return 'high';
    if (isMainCompetitor && similarity > 0.6 && price < 2000) return 'medium';
    return 'low';
  }

  /**
   * Extracts current price from competitor data
   */
  private extractCurrentPrice(competitor: any): number {
    if (competitor.rooms_jsonb && typeof competitor.rooms_jsonb === 'object') {
      const today = new Date().toISOString().split('T')[0];
      const todayRooms = competitor.rooms_jsonb[today];
      
      if (todayRooms && Array.isArray(todayRooms)) {
        const prices = todayRooms
          .map((room: any) => parseFloat(room.price || '0'))
          .filter((price: number) => !isNaN(price) && price > 0);
        
        if (prices.length > 0) {
          return prices.reduce((sum, price) => sum + price, 0) / prices.length;
        }
      }
    }
    
    return 150; // Precio por defecto
  }

  /**
   * Analiza dinámicas del mercado
   */
  private async analyzeMarketDynamics(
    eventIntelligence: EventIntelligence[],
    competitorIntelligence: CompetitorIntelligence[]
  ): Promise<MarketIntelligence> {
    // Calcular demanda del mercado
    const totalAttendance = eventIntelligence.reduce((sum, event) => sum + event.expectedAttendance, 0);
    const marketDemand = totalAttendance > 10000 ? 'extreme' : 
                        totalAttendance > 5000 ? 'high' : 
                        totalAttendance > 1000 ? 'medium' : 'low';

    // Calcular disponibilidad de oferta
    const competitorCount = competitorIntelligence.length;
    const supplyAvailability = competitorCount > 20 ? 'abundant' :
                              competitorCount > 10 ? 'moderate' :
                              competitorCount > 5 ? 'limited' : 'scarce';

    // Analizar tendencias de precios
    const priceTrends = this.analyzePriceTrends(competitorIntelligence);

    // Calcular oportunidad de mercado
    const marketOpportunity = this.calculateMarketOpportunity(marketDemand, supplyAvailability, priceTrends);

    return {
      marketDemand,
      supplyAvailability,
      priceTrends,
      competitorReactions: [],
      marketOpportunity
    };
  }

  /**
   * Analiza tendencias de precios de competidores
   */
  private analyzePriceTrends(competitors: CompetitorIntelligence[]): 'decreasing' | 'stable' | 'increasing' | 'volatile' {
    const increasing = competitors.filter(c => c.priceTrend === 'increasing').length;
    const decreasing = competitors.filter(c => c.priceTrend === 'decreasing').length;
    const stable = competitors.filter(c => c.priceTrend === 'stable').length;

    if (increasing > decreasing && increasing > stable) return 'increasing';
    if (decreasing > increasing && decreasing > stable) return 'decreasing';
    if (stable > increasing && stable > decreasing) return 'stable';
    return 'volatile';
  }

  /**
   * Calcula oportunidad de mercado
   */
  private calculateMarketOpportunity(
    demand: string,
    supply: string,
    trends: string
  ): number {
    let opportunity = 0.5; // Base

    // Ajustar por demanda
    if (demand === 'extreme') opportunity += 0.3;
    else if (demand === 'high') opportunity += 0.2;
    else if (demand === 'medium') opportunity += 0.1;

    // Ajustar por oferta
    if (supply === 'scarce') opportunity += 0.2;
    else if (supply === 'limited') opportunity += 0.1;
    else if (supply === 'abundant') opportunity -= 0.1;

    // Ajustar por tendencias
    if (trends === 'increasing') opportunity += 0.1;
    else if (trends === 'decreasing') opportunity -= 0.1;

    return Math.max(0, Math.min(1, opportunity));
  }

  /**
   * Genera recomendación inteligente final
   */
  private async generateIntelligentRecommendation(
    eventIntelligence: EventIntelligence[],
    competitorIntelligence: CompetitorIntelligence[],
    marketIntelligence: MarketIntelligence,
    hotelId: string,
    targetDate: string
  ): Promise<PricingRecommendation> {
    
    // Obtener precio actual del hotel
    const currentPrice = await this.getCurrentHotelPrice(hotelId, targetDate);
    
    // Calcular precio recomendado
    const recommendedPrice = await this.calculateOptimalPrice(
      currentPrice,
      eventIntelligence,
      competitorIntelligence,
      marketIntelligence
    );

    // Generar razonamiento
    const reasoning = await this.generateReasoning(
      eventIntelligence,
      competitorIntelligence,
      marketIntelligence,
      currentPrice,
      recommendedPrice
    );

    // Calcular confianza
    const confidence = this.calculateConfidence(eventIntelligence, competitorIntelligence, marketIntelligence);

    // Calcular impacto esperado
    const expectedOutcomes = this.calculateExpectedOutcomes(
      currentPrice,
      recommendedPrice,
      marketIntelligence
    );

    const recommendation = {
      recommendedPrice,
      currentPrice,
      priceChange: recommendedPrice - currentPrice,
      priceChangePercent: ((recommendedPrice - currentPrice) / currentPrice) * 100,
      confidence,
      reasoning,
      expectedOutcomes,
      riskFactors: this.identifyRiskFactors(eventIntelligence, marketIntelligence),
      alternativePrices: [] as { price: number; scenario: string; probability: number }[]
    };

    // Generar precios alternativos después de crear la recomendación
    recommendation.alternativePrices = this.generateAlternativePrices(recommendation, marketIntelligence);

    return recommendation;
  }

  /**
   * Obtiene precio actual del hotel
   */
  private async getCurrentHotelPrice(hotelId: string, date: string): Promise<number> {
    const { data, error } = await supabase
      .from('hotel_usuario')
      .select('price')
      .eq('user_id', hotelId)
      .eq('checkin_date', date)
      .limit(1);

    if (error || !data || data.length === 0) {
      return 150; // Precio por defecto
    }

    return parseFloat(data[0].price) || 150;
  }

  /**
   * Calcula precio óptimo usando IA
   */
  private async calculateOptimalPrice(
    currentPrice: number,
    eventIntelligence: EventIntelligence[],
    competitorIntelligence: CompetitorIntelligence[],
    marketIntelligence: MarketIntelligence
  ): Promise<number> {
    
    // Calcular multiplicador de eventos
    const eventMultiplier = eventIntelligence.length > 0 
      ? eventIntelligence.reduce((sum, event) => sum + event.priceImpactMultiplier, 0) / eventIntelligence.length
      : 1.0;

    // Calcular precio promedio de competidores
    const competitorAvgPrice = competitorIntelligence.length > 0
      ? competitorIntelligence.reduce((sum, comp) => sum + comp.currentPrice, 0) / competitorIntelligence.length
      : currentPrice;

    // Calcular precio base ajustado por eventos
    const eventAdjustedPrice = currentPrice * eventMultiplier;

    // Calcular precio competitivo
    const competitivePrice = competitorAvgPrice * 1.05; // 5% por encima del promedio

    // Combinar factores
    const optimalPrice = (eventAdjustedPrice * 0.6) + (competitivePrice * 0.4);

    return Math.round(optimalPrice);
  }

  /**
   * Genera razonamiento inteligente
   */
  private async generateReasoning(
    eventIntelligence: EventIntelligence[],
    competitorIntelligence: CompetitorIntelligence[],
    marketIntelligence: MarketIntelligence,
    currentPrice: number,
    recommendedPrice: number
  ): Promise<string[]> {
    const reasoning: string[] = [];

    // Razonamiento sobre eventos
    if (eventIntelligence.length > 0) {
      const totalAttendance = eventIntelligence.reduce((sum, event) => sum + event.expectedAttendance, 0);
      reasoning.push(`Se detectaron ${eventIntelligence.length} eventos con ${totalAttendance.toLocaleString()} asistentes esperados`);
      
      const highDemandEvents = eventIntelligence.filter(event => event.demandForecast === 'high' || event.demandForecast === 'extreme');
      if (highDemandEvents.length > 0) {
        reasoning.push(`${highDemandEvents.length} eventos de alta demanda justifican aumento de precios`);
      }
    }

    // Razonamiento sobre competencia
    if (competitorIntelligence.length > 0) {
      const avgCompetitorPrice = competitorIntelligence.reduce((sum, comp) => sum + comp.currentPrice, 0) / competitorIntelligence.length;
      reasoning.push(`Precio promedio de competidores: $${avgCompetitorPrice.toFixed(2)}`);
      
      const directCompetitors = competitorIntelligence.filter(comp => comp.competitiveLevel === 'direct');
      if (directCompetitors.length > 0) {
        reasoning.push(`${directCompetitors.length} competidores directos identificados`);
      }
    }

    // Razonamiento sobre mercado
    reasoning.push(`Demanda del mercado: ${marketIntelligence.marketDemand}`);
    reasoning.push(`Disponibilidad de oferta: ${marketIntelligence.supplyAvailability}`);
    reasoning.push(`Oportunidad de mercado: ${(marketIntelligence.marketOpportunity * 100).toFixed(1)}%`);

    // Razonamiento sobre precio
    const priceChange = recommendedPrice - currentPrice;
    const priceChangePercent = (priceChange / currentPrice) * 100;
    
    if (priceChange > 0) {
      reasoning.push(`Aumento recomendado de $${priceChange.toFixed(2)} (${priceChangePercent.toFixed(1)}%) para maximizar revenue`);
    } else if (priceChange < 0) {
      reasoning.push(`Reducción recomendada de $${Math.abs(priceChange).toFixed(2)} (${Math.abs(priceChangePercent).toFixed(1)}%) para mejorar competitividad`);
    } else {
      reasoning.push(`Mantener precio actual - condiciones de mercado estables`);
    }

    return reasoning;
  }

  /**
   * Calcula confianza de la recomendación
   */
  private calculateConfidence(
    eventIntelligence: EventIntelligence[],
    competitorIntelligence: CompetitorIntelligence[],
    marketIntelligence: MarketIntelligence
  ): number {
    let confidence = 50; // Base

    // Ajustar por calidad de datos de eventos
    if (eventIntelligence.length > 0) {
      const avgEventConfidence = eventIntelligence.reduce((sum, event) => sum + event.confidence, 0) / eventIntelligence.length;
      confidence += (avgEventConfidence - 50) * 0.3;
    }

    // Ajustar por cantidad de competidores
    if (competitorIntelligence.length > 5) confidence += 10;
    else if (competitorIntelligence.length > 2) confidence += 5;

    // Ajustar por oportunidad de mercado
    confidence += marketIntelligence.marketOpportunity * 20;

    return Math.max(0, Math.min(100, Math.round(confidence)));
  }

  /**
   * Calcula resultados esperados
   */
  private calculateExpectedOutcomes(
    currentPrice: number,
    recommendedPrice: number,
    marketIntelligence: MarketIntelligence
  ): any {
    const priceChange = recommendedPrice - currentPrice;
    const priceChangePercent = (priceChange / currentPrice) * 100;

    let revenue = 'neutral' as const;
    let occupancy = 'neutral' as const;
    let competitiveness = 'maintain' as const;
    let percentage = 0;

    if (priceChange > 0) {
      revenue = 'increase';
      occupancy = 'decrease';
      competitiveness = 'worsen';
      percentage = Math.min(25, priceChangePercent * 0.8);
    } else if (priceChange < 0) {
      revenue = 'increase';
      occupancy = 'increase';
      competitiveness = 'improve';
      percentage = Math.min(30, Math.abs(priceChangePercent) * 1.2);
    }

    return {
      revenue,
      occupancy,
      competitiveness,
      percentage: Math.round(percentage)
    };
  }

  /**
   * Identifica factores de riesgo
   */
  private identifyRiskFactors(
    eventIntelligence: EventIntelligence[],
    marketIntelligence: MarketIntelligence
  ): string[] {
    const risks: string[] = [];

    if (marketIntelligence.priceTrends === 'volatile') {
      risks.push('Mercado volátil - precios pueden cambiar rápidamente');
    }

    if (marketIntelligence.supplyAvailability === 'abundant') {
      risks.push('Alta competencia - muchos hoteles disponibles');
    }

    if (eventIntelligence.length === 0) {
      risks.push('Sin eventos detectados - demanda puede ser baja');
    }

    return risks;
  }

  /**
   * Genera precios alternativos
   */
  private generateAlternativePrices(
    recommendation: PricingRecommendation,
    marketIntelligence: MarketIntelligence
  ): { price: number; scenario: string; probability: number }[] {
    const alternatives = [];

    // Precio conservador
    alternatives.push({
      price: recommendation.recommendedPrice * 0.95,
      scenario: 'Conservador - menor riesgo',
      probability: 0.3
    });

    // Precio agresivo
    alternatives.push({
      price: recommendation.recommendedPrice * 1.1,
      scenario: 'Agresivo - maximizar revenue',
      probability: 0.2
    });

    // Precio competitivo
    alternatives.push({
      price: recommendation.recommendedPrice * 0.9,
      scenario: 'Competitivo - mejorar ocupación',
      probability: 0.5
    });

    return alternatives;
  }

  /**
   * Obtiene eventos históricos similares
   */
  private async getHistoricalSimilarEvents(eventType: string): Promise<EventHistory[]> {
    // Simular datos históricos (implementar con datos reales)
    return [
      {
        eventName: 'Evento Similar 1',
        date: '2024-01-15',
        attendance: 5000,
        priceImpact: 1.3,
        revenueImpact: 25,
        occupancyImpact: 15
      }
    ];
  }

  /**
   * Pronostica demanda basado en análisis del evento
   */
  private async forecastDemand(eventAnalysis: any): Promise<'low' | 'medium' | 'high' | 'extreme'> {
    if (eventAnalysis.attendance > 20000) return 'extreme';
    if (eventAnalysis.attendance > 10000) return 'high';
    if (eventAnalysis.attendance > 2000) return 'medium';
    return 'low';
  }

  /**
   * Calcula impacto en precio basado en análisis del evento
   */
  private async calculatePriceImpact(eventAnalysis: any, demandForecast: string): Promise<number> {
    let multiplier = 1.0;

    // Ajustar por tipo de evento
    switch (eventAnalysis.type) {
      case 'concert':
        multiplier = 1.4;
        break;
      case 'sports':
        multiplier = 1.3;
        break;
      case 'festival':
        multiplier = 1.2;
        break;
      case 'conference':
        multiplier = 1.1;
        break;
      case 'business':
        multiplier = 1.2;
        break;
      default:
        multiplier = 1.0;
    }

    // Ajustar por demanda
    switch (demandForecast) {
      case 'extreme':
        multiplier *= 1.5;
        break;
      case 'high':
        multiplier *= 1.3;
        break;
      case 'medium':
        multiplier *= 1.1;
        break;
      case 'low':
        multiplier *= 0.9;
        break;
    }

    return Math.max(0.5, Math.min(2.0, multiplier));
  }
}

// ===== FUNCIONES DE UTILIDAD =====

/**
 * Función principal para ejecutar análisis diario automático
 */
export async function runDailyPricingAnalysis(
  targetDate: string,
  hotelId: string,
  apiKeys: { openai?: string; googleSearch?: string; eventbrite?: string }
): Promise<PricingRecommendation> {
  const ai = new IntelligentPricingAI(apiKeys);
  return await ai.analyzeAndRecommendPricing(targetDate, hotelId);
}

/**
 * Función para ejecutar análisis automático para múltiples días
 */
export async function runMultiDayAnalysis(
  startDate: string,
  endDate: string,
  hotelId: string,
  apiKeys: { openai?: string; googleSearch?: string; eventbrite?: string }
): Promise<PricingRecommendation[]> {
  const recommendations: PricingRecommendation[] = [];
  const ai = new IntelligentPricingAI(apiKeys);
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
    const dateStr = date.toISOString().split('T')[0];
    
    try {
      const recommendation = await ai.analyzeAndRecommendPricing(dateStr, hotelId);
      recommendations.push(recommendation);
      
      // Pequeña pausa para no sobrecargar el sistema
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.error(`Error analizando ${dateStr}:`, error);
    }
  }
  
  return recommendations;
}
