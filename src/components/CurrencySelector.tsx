import { useCurrency } from '@/contexts/CurrencyContext';
import { useState } from 'react';

interface CurrencySelectorProps {
  className?: string;
  showLabel?: boolean;
}

export default function CurrencySelector({ className = '', showLabel = true }: CurrencySelectorProps) {
  const { selectedCurrency, setSelectedCurrency } = useCurrency();
  const [isChanging, setIsChanging] = useState(false);

  const handleCurrencyChange = (newCurrency: 'MXN' | 'USD') => {
    if (newCurrency !== selectedCurrency) {
      setIsChanging(true);
      setSelectedCurrency(newCurrency);
      
      // Reset the changing state after animation
      setTimeout(() => setIsChanging(false), 500);
    }
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {showLabel && (
        <label className="text-sm font-medium text-gray-700">Currency:</label>
      )}
      <div className="relative">
        <select
          value={selectedCurrency}
          onChange={(e) => handleCurrencyChange(e.target.value as 'MXN' | 'USD')}
          className={`px-3 py-2 border border-glass-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-glass-50 backdrop-blur-sm transition-all duration-300 ${
            isChanging ? 'scale-105 ring-2 ring-blue-400' : ''
          }`}
        >
          <option value="MXN">MXN (Pesos)</option>
          <option value="USD">USD (Dollars)</option>
        </select>
        
        {/* Currency change indicator */}
        {isChanging && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full animate-ping"></div>
        )}
        
        {/* Success indicator */}
        {!isChanging && selectedCurrency === 'USD' && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
        )}
      </div>
    </div>
  );
}
