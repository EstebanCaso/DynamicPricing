'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { convertCurrency, type Currency } from '@/lib/dataUtils';

interface CurrencyContextType {
  selectedCurrency: Currency;
  setSelectedCurrency: (currency: Currency) => void;
  exchangeRate: number;
  convertPriceToSelectedCurrency: (price: number, originalCurrency?: Currency) => number;
  currency: Intl.NumberFormat;
  numberFmt: Intl.NumberFormat;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedCurrency, setSelectedCurrency] = useState<Currency>('MXN');
  const [exchangeRate, setExchangeRate] = useState<number>(18.5);

  // Fetch exchange rate when currency changes
  const fetchExchangeRate = useCallback(async () => {
    if (selectedCurrency === 'MXN') {
      setExchangeRate(1);
      return;
    }
    
    // Check if we have a cached rate from this session
    const now = Date.now();
    const sessionCacheKey = 'exchangeRateCache';
    const cachedData = sessionStorage.getItem(sessionCacheKey);
    
    if (cachedData) {
      try {
        const { rate, timestamp } = JSON.parse(cachedData);
        const cacheAge = now - timestamp;
        const cacheValid = cacheAge < 24 * 60 * 60 * 1000; // 24 hours
        
        if (cacheValid) {
          setExchangeRate(rate);
          return;
        }
      } catch (error) {
        console.warn('Failed to parse cached exchange rate');
      }
    }
    
    try {
      const response = await fetch('/api/exchange-rate');
      const data = await response.json();
      if (data.success && data.rate) {
        // Cache the new rate in session storage
        const cacheData = {
          rate: data.rate,
          timestamp: now
        };
        sessionStorage.setItem(sessionCacheKey, JSON.stringify(cacheData));
        
        setExchangeRate(data.rate);
      }
    } catch (error) {
      console.error('Failed to fetch exchange rate:', error);
      // Keep default fallback rate
    }
  }, [selectedCurrency]);

  // Currency conversion helper
  const convertPriceToSelectedCurrency = useCallback((price: number, originalCurrency: Currency = 'MXN'): number => {
    return convertCurrency(price, originalCurrency, selectedCurrency, exchangeRate);
  }, [selectedCurrency, exchangeRate]);

  // Currency formatters
  const currency = useCallback(() => {
    return new Intl.NumberFormat(selectedCurrency === 'USD' ? 'en-US' : 'es-MX', {
      style: 'currency',
      currency: selectedCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }, [selectedCurrency]);

  const numberFmt = useCallback(() => {
    return new Intl.NumberFormat(selectedCurrency === 'MXN' ? 'es-MX' : 'en-US');
  }, [selectedCurrency]);

  // Load currency preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('selectedCurrency');
    if (saved && (saved === 'MXN' || saved === 'USD')) {
      setSelectedCurrency(saved as Currency);
    }
  }, []);

  // Save currency preference to localStorage
  useEffect(() => {
    localStorage.setItem('selectedCurrency', selectedCurrency);
  }, [selectedCurrency]);

  // Fetch exchange rate when currency changes
  useEffect(() => {
    fetchExchangeRate();
  }, [fetchExchangeRate]);

  const value: CurrencyContextType = {
    selectedCurrency,
    setSelectedCurrency,
    exchangeRate,
    convertPriceToSelectedCurrency,
    currency: currency(),
    numberFmt: numberFmt(),
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
};
