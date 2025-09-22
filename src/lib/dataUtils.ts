/**
 * Unified data processing utilities for the entire application
 * This ensures consistency across all components and APIs
 */

import { supabase } from './supabaseClient';

// Type definitions for data utilities
export type IntlNumberFormat = Intl.NumberFormat;

// ===== UNIFIED TABLE NAMES =====
export const TABLES = {
  USER_HOTEL: 'hotel_usuario',     // Standardize on lowercase
  COMPETITORS: 'hoteles_parallel', // Standardize on Spanish name
  EVENTS: 'events'
} as const;

// ===== UNIFIED COLUMN NAMES =====
export const COLUMNS = {
  DATE: 'checkin_date',  // Standardize on checkin_date
  PRICE: 'price',
  ROOM_TYPE: 'room_type',
  HOTEL_NAME: 'hotel_name',
  USER_ID: 'user_id'
} as const;

// ===== UNIFIED CURRENCY TYPES =====
export type Currency = 'MXN' | 'USD';

export interface CleanedPrice {
  value: number;
  currency: Currency;
}

export interface ProcessedHotelData {
  id?: string;
  hotel_name: string;
  checkin_date: string;
  room_type: string;
  price: string | number;
  processed_price: number;
  processed_currency: Currency;
  user_id?: string;
}

// ===== UNIFIED PRICE CLEANING =====
export function cleanPrice(priceString: string | number): CleanedPrice {
  if (typeof priceString === 'number') {
    return { value: priceString, currency: 'MXN' };
  }
  
  if (typeof priceString === 'string') {
    const trimmed = priceString.trim();
    
    // Detect currency
    let currency: Currency = 'MXN'; // Default
    if (trimmed.includes('USD') || (trimmed.includes('$') && !trimmed.includes('MXN'))) {
      currency = 'USD';
    } else if (trimmed.includes('MXN') || trimmed.includes('$')) {
      currency = 'MXN';
    }
    
    // Remove currency symbols and parse
    const cleaned = trimmed
      .replace(/MXN|USD|\$/gi, '')
      .replace(/,/g, '')
      .trim();
    
    const value = parseFloat(cleaned);
    
    if (isNaN(value)) {
      return { value: 0, currency };
    }
    
    return { value, currency };
  }
  
  return { value: 0, currency: 'MXN' };
}

// ===== UNIFIED CURRENCY CONVERSION =====
export function convertCurrency(
  amount: number, 
  fromCurrency: Currency, 
  toCurrency: Currency, 
  exchangeRate: number = 18.5
): number {
  if (fromCurrency === toCurrency) {
    return amount;
  }
  
  if (fromCurrency === 'MXN' && toCurrency === 'USD') {
    return amount / exchangeRate;
  }
  
  if (fromCurrency === 'USD' && toCurrency === 'MXN') {
    return amount * exchangeRate;
  }
  
  return amount;
}

// ===== UNIFIED ROOM TYPE STANDARDIZATION =====
export function standardizeRoomType(roomType: string): string {
  if (!roomType) return "Standard";
  const normalized = roomType.toLowerCase().trim();
  
  // **IMPORTANT**: The goal is to map most hotel rooms to "Standard" 
  // unless they are truly special/premium room types
  
  // Standard patterns - these should map to "Standard"
  if (normalized.includes("estándar") || normalized.includes("standard") || 
      normalized.includes("habitación") || normalized.includes("básica") ||
      normalized.includes("std") || normalized.includes("basic") ||
      normalized.includes("regular") || normalized.includes("normal") ||
      normalized.includes("clásica") || normalized.includes("simple") ||
      normalized.includes("económica") || normalized.includes("budget")) {
    return "Standard";
  }
  
  // Common room names that should be treated as "Standard"
  // Many hotels use "King", "Queen", "Double" to describe bed type, not premium level
  if (normalized.includes("king room") || normalized.includes("queen room") ||
      normalized.includes("double room") || normalized.includes("twin room") ||
      normalized.includes("single room") || normalized.includes("full room")) {
    return "Standard";
  }
  
  // Spanish variations that should be "Standard"
  if (normalized.includes("doble") || normalized.includes("individual") ||
      normalized.includes("matrimonial") || normalized.includes("sencilla") ||
      normalized.includes("cama")) {
    return "Standard";
  }
  
  // Only these should be considered premium/special room types
  if (normalized.includes("suite")) return "Suite";
  if (normalized.includes("business")) return "Business";
  if (normalized.includes("superior")) return "Superior";
  if (normalized.includes("deluxe")) return "Deluxe";
  if (normalized.includes("executive")) return "Executive";
  if (normalized.includes("presidential")) return "Presidential";
  if (normalized.includes("penthouse")) return "Penthouse";
  if (normalized.includes("villa")) return "Villa";
  if (normalized.includes("master")) return "Master";
  if (normalized.includes("junior")) return "Junior";
  
  // For bed type descriptors without "room", still treat as Standard
  if (normalized === "king" || normalized === "queen" || 
      normalized === "double" || normalized === "twin" || 
      normalized === "single" || normalized === "full") {
    return "Standard";
  }
  
  // If we can't determine, default to Standard rather than preserving original
  // This prevents many different variations from appearing as separate categories
  return "Standard";
}

// ===== UNIFIED DATE HANDLING =====
export function getDateCandidates(): string[] {
  const now = new Date();
  const iso = now.toISOString().slice(0, 10);
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
  
  let mx = '';
  try {
    mx = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(now);
  } catch {}
  
  return Array.from(new Set([iso, local, mx].filter(Boolean)));
}

export function getCanonicalToday(): string {
  const now = new Date();
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(now);
  } catch {
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }
}

// ===== UNIFIED DATA FETCHING =====
export async function fetchUserHotelData(userId: string): Promise<ProcessedHotelData[]> {
  console.log('🔄 Fetching user hotel data with unified function...');
  
  const { data, error } = await supabase
    .from(TABLES.USER_HOTEL)
    .select('*')
    .eq(COLUMNS.USER_ID, userId);

  if (error) {
    console.error('❌ Error fetching user hotel data:', error);
    throw error;
  }

  if (!data || data.length === 0) {
    console.warn('⚠️ No user hotel data found');
    return [];
  }

  type UserHotelRow = {
    id?: string;
    hotel_name: string;
    checkin_date: string;
    room_type: string;
    price: string | number;
    user_id?: string;
    [key: string]: unknown;
  };

  const processed = (data as UserHotelRow[]).map((item) => {
    const cleanedPrice = cleanPrice(item.price);
    return {
      id: item.id,
      hotel_name: item.hotel_name,
      checkin_date: item.checkin_date,
      room_type: item.room_type,
      price: item.price,
      processed_price: cleanedPrice.value,
      processed_currency: cleanedPrice.currency,
      user_id: item.user_id,
    };
  });

  console.log(`✅ Processed ${processed.length} user hotel records`);
  return processed;
}

export type CompetitorRow = { ciudad?: string } & Record<string, unknown>;

export async function fetchCompetitorData(city?: string): Promise<CompetitorRow[]> {
  console.log('🔄 Fetching competitor data with unified function...');
  
  let query = supabase.from(TABLES.COMPETITORS).select('*');
  
  if (city) {
    query = query.ilike('ciudad', `%${city}%`);
  }
  
  const { data, error } = await query.limit(100);

  if (error) {
    console.error('❌ Error fetching competitor data:', error);
    throw error;
  }

  console.log(`✅ Fetched ${data?.length || 0} competitor records`);
  return (data as CompetitorRow[]) || [];
}

// ===== UNIFIED CURRENCY FORMATTING =====
export function formatCurrency(amount: number, currency: Currency): string {
  const locale = currency === 'USD' ? 'en-US' : 'es-MX';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

// ===== UNIFIED LOGGING =====
export function logDataFlow(component: string, data: unknown, message?: string) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`📊 [${component}] ${message || 'Data flow'}:`, data);
  }
}
