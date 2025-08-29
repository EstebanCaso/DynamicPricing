import { useCurrency } from '@/contexts/CurrencyContext';

interface CurrencySelectorProps {
  className?: string;
  showLabel?: boolean;
}

export default function CurrencySelector({ className = '', showLabel = true }: CurrencySelectorProps) {
  const { selectedCurrency, setSelectedCurrency } = useCurrency();

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {showLabel && (
        <label className="text-sm font-medium text-gray-700">Currency:</label>
      )}
      <select
        value={selectedCurrency}
        onChange={(e) => setSelectedCurrency(e.target.value as 'MXN' | 'USD')}
        className="px-3 py-2 border border-glass-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-glass-50 backdrop-blur-sm transition-all duration-200"
      >
        <option value="MXN">MXN (Pesos)</option>
        <option value="USD">USD (Dollars)</option>
      </select>
    </div>
  );
}
