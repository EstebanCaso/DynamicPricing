import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

interface PriceUpdateContextType {
  lastPriceUpdate: {
    date: string;
    price: number;
    timestamp: number;
  } | null;
  triggerPriceUpdate: (date: string, price: number) => void;
  subscribeToPriceUpdates: (callback: (update: { date: string; price: number; timestamp: number }) => void) => () => void;
}

const PriceUpdateContext = createContext<PriceUpdateContextType | undefined>(undefined);

interface PriceUpdateProviderProps {
  children: ReactNode;
}

export function PriceUpdateProvider({ children }: PriceUpdateProviderProps) {
  const [lastPriceUpdate, setLastPriceUpdate] = useState<{
    date: string;
    price: number;
    timestamp: number;
  } | null>(null);

  const subscribers = useState<Set<(update: { date: string; price: number; timestamp: number }) => void>>(new Set())[0];

  const triggerPriceUpdate = useCallback((date: string, price: number) => {
    const update = {
      date,
      price,
      timestamp: Date.now()
    };
    
    setLastPriceUpdate(update);
    
    // Notify all subscribers
    subscribers.forEach(callback => {
      try {
        callback(update);
      } catch (error) {
        console.error('Error notifying price update subscriber:', error);
      }
    });
    
    console.log(`🔄 Price update triggered: ${date} = $${price} MXN`);
  }, [subscribers]);

  const subscribeToPriceUpdates = useCallback((callback: (update: { date: string; price: number; timestamp: number }) => void) => {
    subscribers.add(callback);
    
    // Return unsubscribe function
    return () => {
      subscribers.delete(callback);
    };
  }, [subscribers]);

  return (
    <PriceUpdateContext.Provider value={{
      lastPriceUpdate,
      triggerPriceUpdate,
      subscribeToPriceUpdates
    }}>
      {children}
    </PriceUpdateContext.Provider>
  );
}

export function usePriceUpdates() {
  const context = useContext(PriceUpdateContext);
  if (context === undefined) {
    throw new Error('usePriceUpdates must be used within a PriceUpdateProvider');
  }
  return context;
}

// Hook for components that need to react to price updates
export function usePriceUpdateSubscription(callback: (update: { date: string; price: number; timestamp: number }) => void) {
  const { subscribeToPriceUpdates } = usePriceUpdates();
  
  useEffect(() => {
    const unsubscribe = subscribeToPriceUpdates(callback);
    return unsubscribe;
  }, [subscribeToPriceUpdates, callback]);
}
