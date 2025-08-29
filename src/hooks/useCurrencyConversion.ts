import { useState, useCallback, useEffect } from 'react';
import { convertCurrency, type Currency } from '@/lib/dataUtils';

export const useCurrencyConversion = (selectedCurrency: Currency) => {
  const [exchangeRate, setExchangeRate] = useState<number>(18.5); // Default fallback
  const [isLoadingRate, setIsLoadingRate] = useState<boolean>(false);
  const [lastRateFetch, setLastRateFetch] = useState<number>(0);

  // Fetch real-time exchange rate with session caching
  const fetchExchangeRate = useCallback(async () => {
    if (selectedCurrency === "MXN") return; // No need to fetch if we're already in MXN
    
    // Check if we have a cached rate from this session (valid for 24 hours)
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
          setLastRateFetch(timestamp);
          console.log('Using cached exchange rate:', rate);
          return;
        }
      } catch (error) {
        console.warn('Failed to parse cached exchange rate');
      }
    }
    
    setIsLoadingRate(true);
    try {
      const response = await fetch(`/api/exchange-rate?from=MXN&to=USD`);
      if (response.ok) {
        const data = await response.json();
        const newRate = data.rate;
        
        // Cache the new rate in session storage
        const cacheData = {
          rate: newRate,
          timestamp: now
        };
        sessionStorage.setItem(sessionCacheKey, JSON.stringify(cacheData));
        
        setExchangeRate(newRate);
        setLastRateFetch(now);
        console.log('Fetched new exchange rate:', newRate);
      } else {
        console.warn('Failed to fetch exchange rate, using fallback');
        setExchangeRate(18.5); // Fallback rate
      }
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
      setExchangeRate(18.5); // Fallback rate
    } finally {
      setIsLoadingRate(false);
    }
  }, [selectedCurrency]);

  // Convert price to selected currency using unified function
  const convertPriceToSelectedCurrency = useCallback((price: number, originalCurrency: Currency = 'MXN'): number => {
    const convertedPrice = convertCurrency(price, originalCurrency, selectedCurrency, exchangeRate);
    
    if (originalCurrency !== selectedCurrency) {
      console.log(`💱 Converting ${price} ${originalCurrency} → ${convertedPrice.toFixed(2)} ${selectedCurrency} (rate: ${exchangeRate})`);
    }
    
    return convertedPrice;
  }, [selectedCurrency, exchangeRate]);

  // Enhanced currency formatter
  const currency = useCallback(() => {
    return new Intl.NumberFormat(selectedCurrency === "USD" ? "en-US" : "es-MX", {
      style: "currency",
      currency: selectedCurrency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }, [selectedCurrency]);

  // Number formatter for non-currency values
  const numberFmt = useCallback(() => {
    return new Intl.NumberFormat(selectedCurrency === "MXN" ? "es-MX" : "en-US");
  }, [selectedCurrency]);

  // Fetch exchange rate when currency changes
  useEffect(() => {
    fetchExchangeRate();
  }, [fetchExchangeRate]);

  return {
    exchangeRate,
    isLoadingRate,
    lastRateFetch,
    convertPriceToSelectedCurrency,
    currency: currency(),
    numberFmt: numberFmt(),
    fetchExchangeRate
  };
};

