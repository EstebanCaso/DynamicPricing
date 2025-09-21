/**
 * Global Price State Management System
 * Manages hotel prices across all tabs with automatic updates
 */

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabaseClient';

// ===== TYPES =====
export interface HotelPrice {
  roomType: string;
  currentPrice: number;
  recommendedPrice: number;
  lastUpdated: string;
  currency: 'MXN';
}

export interface CompetitorAnalysis {
  mainCompetitors: Competitor[];
  marketAverage: number;
  competitorAverage: number;
  priceGap: number;
  opportunity: number;
  lastAnalyzed: string;
}

export interface Competitor {
  id: string;
  name: string;
  price: number;
  distance: number;
  similarity: number;
  threatLevel: 'low' | 'medium' | 'high';
  isMainCompetitor: boolean;
}

export interface PriceUpdate {
  roomType: string;
  oldPrice: number;
  newPrice: number;
  reason: string;
  timestamp: string;
}

interface PriceContextType {
  // Current prices
  currentPrices: HotelPrice[];
  competitorAnalysis: CompetitorAnalysis | null;
  
  // Actions
  updatePrice: (roomType: string, newPrice: number, reason: string) => Promise<void>;
  refreshPrices: () => Promise<void>;
  analyzeCompetitors: () => Promise<void>;
  
  // State
  isLoading: boolean;
  error: string | null;
  lastUpdate: string | null;
  
  // Price history
  priceHistory: PriceUpdate[];
}

// ===== CONTEXT =====
const PriceContext = createContext<PriceContextType | undefined>(undefined);

// ===== PROVIDER =====
interface PriceProviderProps {
  children: ReactNode;
  hotelId: string;
}

export function PriceProvider({ children, hotelId }: PriceProviderProps) {
  const [currentPrices, setCurrentPrices] = useState<HotelPrice[]>([]);
  const [competitorAnalysis, setCompetitorAnalysis] = useState<CompetitorAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceUpdate[]>([]);

  // Load initial prices
  useEffect(() => {
    if (hotelId) {
      refreshPrices();
      analyzeCompetitors();
    }
  }, [hotelId]);

  // Refresh prices from database
  const refreshPrices = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get current prices for today
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error: fetchError } = await supabase
        .from('hotel_usuario')
        .select('room_type, price, checkin_date')
        .eq('user_id', hotelId)
        .eq('checkin_date', today);

      if (fetchError) throw fetchError;

      if (data && data.length > 0) {
        const prices: HotelPrice[] = data.map(item => ({
          roomType: item.room_type,
          currentPrice: parseFloat(item.price) || 0,
          recommendedPrice: parseFloat(item.price) || 0,
          lastUpdated: new Date().toISOString(),
          currency: 'MXN'
        }));

        setCurrentPrices(prices);
        setLastUpdate(new Date().toISOString());
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh prices');
      console.error('Error refreshing prices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Analyze competitors to identify main competitors
  const analyzeCompetitors = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get competitor data
      const { data: competitors, error: compError } = await supabase
        .from('hoteles_parallel')
        .select('*')
        .limit(100);

      if (compError) throw compError;

      if (!competitors || competitors.length === 0) {
        setCompetitorAnalysis(null);
        return;
      }

      // Analyze competitors to find main competitors
      const analyzedCompetitors = await analyzeCompetitorData(competitors);
      
      // Calculate market metrics
      const marketAverage = analyzedCompetitors.reduce((sum, comp) => sum + comp.price, 0) / analyzedCompetitors.length;
      const mainCompetitors = analyzedCompetitors.filter(comp => comp.isMainCompetitor);
      const competitorAverage = mainCompetitors.length > 0 
        ? mainCompetitors.reduce((sum, comp) => sum + comp.price, 0) / mainCompetitors.length
        : marketAverage;

      const analysis: CompetitorAnalysis = {
        mainCompetitors,
        marketAverage,
        competitorAverage,
        priceGap: competitorAverage - marketAverage,
        opportunity: calculateOpportunity(mainCompetitors, marketAverage),
        lastAnalyzed: new Date().toISOString()
      };

      setCompetitorAnalysis(analysis);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze competitors');
      console.error('Error analyzing competitors:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Analyze competitor data to identify main competitors
  const analyzeCompetitorData = async (competitors: any[]): Promise<Competitor[]> => {
    const analyzed: Competitor[] = [];

    for (const comp of competitors) {
      try {
        // Extract current price
        const currentPrice = extractCurrentPrice(comp);
        
        // Calculate similarity score (based on location, stars, etc.)
        const similarity = calculateSimilarity(comp);
        
        // Calculate distance (simplified)
        const distance = Math.random() * 10; // km
        
        // Determine if it's a main competitor
        const isMainCompetitor = determineMainCompetitor(comp, similarity, distance);
        
        // Determine threat level
        const threatLevel = determineThreatLevel(comp, currentPrice, similarity);

        analyzed.push({
          id: comp.id,
          name: comp.nombre,
          price: currentPrice,
          distance,
          similarity,
          threatLevel,
          isMainCompetitor
        });

      } catch (err) {
        console.error(`Error analyzing competitor ${comp.nombre}:`, err);
      }
    }

    return analyzed;
  };

  // Extract current price from competitor data
  const extractCurrentPrice = (competitor: any): number => {
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
    
    return 1500; // Default price in MXN
  };

  // Calculate similarity score
  const calculateSimilarity = (competitor: any): number => {
    let similarity = 0.5; // Base similarity

    // Adjust based on stars (if available)
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
  };

  // Determine if competitor is main competitor
  const determineMainCompetitor = (competitor: any, similarity: number, distance: number): boolean => {
    // Main competitors criteria:
    // 1. High similarity (>0.7)
    // 2. Close distance (<5km)
    // 3. Similar price range
    
    const isHighSimilarity = similarity > 0.7;
    const isCloseDistance = distance < 5;
    const hasReasonablePrice = competitor.price > 500 && competitor.price < 5000; // MXN range

    return isHighSimilarity && isCloseDistance && hasReasonablePrice;
  };

  // Determine threat level
  const determineThreatLevel = (competitor: any, price: number, similarity: number): 'low' | 'medium' | 'high' => {
    if (similarity > 0.8 && price < 1500) return 'high';
    if (similarity > 0.6 && price < 2000) return 'medium';
    return 'low';
  };

  // Calculate market opportunity
  const calculateOpportunity = (mainCompetitors: Competitor[], marketAverage: number): number => {
    if (mainCompetitors.length === 0) return 0.5;

    const avgMainCompetitorPrice = mainCompetitors.reduce((sum, comp) => sum + comp.price, 0) / mainCompetitors.length;
    const gap = marketAverage - avgMainCompetitorPrice;
    
    // Opportunity is higher when main competitors are priced below market average
    return Math.max(0, Math.min(1, gap / marketAverage + 0.5));
  };

  // Update price and sync across all tabs
  const updatePrice = async (roomType: string, newPrice: number, reason: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // Update in database
      const today = new Date().toISOString().split('T')[0];
      
      const { error: updateError } = await supabase
        .from('hotel_usuario')
        .update({
          price: newPrice.toString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', hotelId)
        .eq('room_type', roomType)
        .eq('checkin_date', today);

      if (updateError) throw updateError;

      // Update local state
      setCurrentPrices(prev => prev.map(price => 
        price.roomType === roomType 
          ? { ...price, currentPrice: newPrice, lastUpdated: new Date().toISOString() }
          : price
      ));

      // Add to price history
      const priceUpdate: PriceUpdate = {
        roomType,
        oldPrice: currentPrices.find(p => p.roomType === roomType)?.currentPrice || 0,
        newPrice,
        reason,
        timestamp: new Date().toISOString()
      };

      setPriceHistory(prev => [priceUpdate, ...prev.slice(0, 49)]); // Keep last 50 updates
      setLastUpdate(new Date().toISOString());

      // Trigger competitor analysis after price update
      setTimeout(() => {
        analyzeCompetitors();
      }, 1000);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update price');
      console.error('Error updating price:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const value: PriceContextType = {
    currentPrices,
    competitorAnalysis,
    updatePrice,
    refreshPrices,
    analyzeCompetitors,
    isLoading,
    error,
    lastUpdate,
    priceHistory
  };

  return (
    <PriceContext.Provider value={value}>
      {children}
    </PriceContext.Provider>
  );
}

// ===== HOOK =====
export function usePriceContext() {
  const context = useContext(PriceContext);
  if (context === undefined) {
    throw new Error('usePriceContext must be used within a PriceProvider');
  }
  return context;
}

// ===== UTILITY FUNCTIONS =====
export function formatPrice(price: number, currency: 'MXN' = 'MXN'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(price);
}

export function calculatePriceChange(oldPrice: number, newPrice: number): {
  amount: number;
  percentage: number;
} {
  const amount = newPrice - oldPrice;
  const percentage = oldPrice > 0 ? (amount / oldPrice) * 100 : 0;
  
  return { amount, percentage };
}
