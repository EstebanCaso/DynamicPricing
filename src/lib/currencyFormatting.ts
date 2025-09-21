/**
 * Currency Formatting Utilities
 * Provides consistent monetary value formatting with commas and two decimals
 */

export type Currency = 'MXN' | 'USD';

/**
 * Formats a monetary value with commas and two decimal places
 * @param value - The numeric value to format
 * @param currency - The currency code (MXN or USD)
 * @param showCurrency - Whether to show the currency symbol
 * @returns Formatted currency string
 */
export function formatCurrency(
  value: number | string | null | undefined,
  currency: Currency = 'MXN',
  showCurrency: boolean = true
): string {
  if (value === null || value === undefined || value === '') {
    return showCurrency ? `$0.00 ${currency}` : '0.00';
  }

  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numericValue) || !isFinite(numericValue)) {
    return showCurrency ? `$0.00 ${currency}` : '0.00';
  }

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  }).format(numericValue);

  if (showCurrency) {
    return `$${formatted} ${currency}`;
  }

  return formatted;
}

/**
 * Formats a monetary value for MXN currency
 * @param value - The numeric value to format
 * @param showCurrency - Whether to show the currency symbol
 * @returns Formatted MXN string
 */
export function formatMXN(value: number | string | null | undefined, showCurrency: boolean = true): string {
  return formatCurrency(value, 'MXN', showCurrency);
}

/**
 * Formats a monetary value for USD currency
 * @param value - The numeric value to format
 * @param showCurrency - Whether to show the currency symbol
 * @returns Formatted USD string
 */
export function formatUSD(value: number | string | null | undefined, showCurrency: boolean = true): string {
  return formatCurrency(value, 'USD', showCurrency);
}

/**
 * Formats a monetary value with percentage change
 * @param value - The numeric value to format
 * @param currency - The currency code
 * @param showCurrency - Whether to show the currency symbol
 * @returns Formatted currency string with percentage
 */
export function formatCurrencyWithChange(
  value: number | string | null | undefined,
  change: number | string | null | undefined,
  currency: Currency = 'MXN',
  showCurrency: boolean = true
): string {
  const formattedValue = formatCurrency(value, currency, showCurrency);
  
  if (change === null || change === undefined || change === '') {
    return formattedValue;
  }

  const numericChange = typeof change === 'string' ? parseFloat(change) : change;
  
  if (isNaN(numericChange) || !isFinite(numericChange)) {
    return formattedValue;
  }

  const changeSign = numericChange >= 0 ? '+' : '';
  const changeFormatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  }).format(Math.abs(numericChange));

  return `${formattedValue} (${changeSign}$${changeFormatted})`;
}

/**
 * Formats a range of monetary values
 * @param minValue - The minimum value
 * @param maxValue - The maximum value
 * @param currency - The currency code
 * @param showCurrency - Whether to show the currency symbol
 * @returns Formatted range string
 */
export function formatCurrencyRange(
  minValue: number | string | null | undefined,
  maxValue: number | string | null | undefined,
  currency: Currency = 'MXN',
  showCurrency: boolean = true
): string {
  const formattedMin = formatCurrency(minValue, currency, showCurrency);
  const formattedMax = formatCurrency(maxValue, currency, showCurrency);
  
  return `${formattedMin} - ${formattedMax}`;
}

/**
 * Formats a monetary value for display in tables (compact format)
 * @param value - The numeric value to format
 * @param currency - The currency code
 * @returns Compact formatted currency string
 */
export function formatCurrencyCompact(
  value: number | string | null | undefined,
  currency: Currency = 'MXN'
): string {
  if (value === null || value === undefined || value === '') {
    return '$0.00';
  }

  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numericValue) || !isFinite(numericValue)) {
    return '$0.00';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  }).format(numericValue);
}

/**
 * Formats a monetary value for display in cards (with currency symbol)
 * @param value - The numeric value to format
 * @param currency - The currency code
 * @returns Card-formatted currency string
 */
export function formatCurrencyCard(
  value: number | string | null | undefined,
  currency: Currency = 'MXN'
): string {
  if (value === null || value === undefined || value === '') {
    return `$0.00 ${currency}`;
  }

  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numericValue) || !isFinite(numericValue)) {
    return `$0.00 ${currency}`;
  }

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  }).format(numericValue);

  return `$${formatted} ${currency}`;
}

/**
 * Formats a monetary value for display in tooltips (detailed format)
 * @param value - The numeric value to format
 * @param currency - The currency code
 * @returns Detailed formatted currency string
 */
export function formatCurrencyTooltip(
  value: number | string | null | undefined,
  currency: Currency = 'MXN'
): string {
  if (value === null || value === undefined || value === '') {
    return `0.00 ${currency}`;
  }

  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numericValue) || !isFinite(numericValue)) {
    return `0.00 ${currency}`;
  }

  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  }).format(numericValue);

  return `${formatted} ${currency}`;
}
