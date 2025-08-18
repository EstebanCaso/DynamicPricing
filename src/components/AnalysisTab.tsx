"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ReferenceLine,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  Brush,
  ReferenceArea,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type HistoricalPoint = {
  day: string;
  revenue: number;
};

type DemandPoint = {
  day: string;
  requests: number;
};

type RevenuePoint = {
  hotel: string;
  revenue: number;
  avgPrice?: number;
};

type GapPoint = {
  day: string;
  ours: number;
  marketAvg: number;
};

const computeDemand = (price: number) => {
  const base = 1400 - Math.max(0, price - 80) * 6;
  const noise = (Math.random() - 0.5) * 60;
  return Math.max(400, Math.round(base + noise));
};

const revenuePerformance: RevenuePoint[] = [
  { hotel: "Hotel A", revenue: 1100 },
  { hotel: "Ours", revenue: 1150 },
  { hotel: "Hotel B", revenue: 1080 },
];

const gapSeries: GapPoint[] = [
  { day: "M", ours: 180, marketAvg: 190 },
  { day: "T", ours: 186, marketAvg: 200 },
  { day: "W", ours: 178, marketAvg: 188 },
  { day: "T", ours: 195, marketAvg: 210 },
  { day: "F", ours: 200, marketAvg: 215 },
  { day: "S", ours: 194, marketAvg: 208 },
  { day: "S", ours: 185, marketAvg: 198 },
];

export default function AnalysisTab() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedCurrency, setSelectedCurrency] = useState<"MXN" | "USD">("MXN");
  
  const currency = new Intl.NumberFormat(selectedCurrency === "MXN" ? "es-MX" : "en-US", {
    style: "currency",
    currency: selectedCurrency,
    maximumFractionDigits: 0,
  });

  const numberFmt = new Intl.NumberFormat(selectedCurrency === "MXN" ? "es-MX" : "en-US");

  const [showOurs, setShowOurs] = useState(true);
  const [showMarket, setShowMarket] = useState(true);
  const [range, setRange] = useState<7 | 30 | 90>(30);

  // Supabase data states
  const [supabaseData, setSupabaseData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true); // Changed to true initially
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userHotelName, setUserHotelName] = useState<string>("");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const [todayAverageRevenue, setTodayAverageRevenue] = useState<number | null>(null);
  const [historicalPrices, setHistoricalPrices] = useState<HistoricalPoint[]>([]);
  const [revenuePerformanceData, setRevenuePerformanceData] = useState<RevenuePoint[]>([]);
  const [competitorData, setCompetitorData] = useState<any[]>([]);

  // Filter states for dynamic revenue analysis
  const [selectedRoomType, setSelectedRoomType] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [viewMode, setViewMode] = useState<"total" | "by-room" | "by-date" | "specific">("total");
  const [clickedRoomType, setClickedRoomType] = useState<string | null>(null);

  const [targetMin, setTargetMin] = useState<number>(() => Number(searchParams.get("tmn")) || 95);
  const [targetMax, setTargetMax] = useState<number>(() => Number(searchParams.get("tmx")) || 115);
  const [events, setEvents] = useState<string[]>(() => {
    const raw = searchParams.get("ev");
    if (!raw) return ["Aug 7", "Aug 9"];
    return raw.split(",").map((s) => decodeURIComponent(s.trim())).filter(Boolean);
  });

  // Function to standardize room types
  const standardizeRoomType = (roomType: string): string => {
    if (!roomType) return "Standard";
    const normalized = roomType.toLowerCase().trim();
    
    // First, check for Standard patterns (highest priority)
    if (normalized.includes("estándar")) return "Standard";
    if (normalized.includes("standard")) return "Standard";
    if (normalized.includes("habitación")) return "Standard";
    if (normalized.includes("cuarto")) return "Standard";
    if (normalized.includes("dormitorio")) return "Standard";
    
    // Then check for specific premium types
    if (normalized.includes("suite")) return "Suite";
    if (normalized.includes("queen")) return "Queen";
    if (normalized.includes("king")) return "King";
    if (normalized.includes("double") && normalized.includes("bed")) return "Double Bed";
    if (normalized.includes("twin")) return "Twin";
    if (normalized.includes("single")) return "Single";
    if (normalized.includes("business")) return "Business";
    if (normalized.includes("superior")) return "Superior";
    if (normalized.includes("deluxe")) return "Deluxe";
    if (normalized.includes("executive")) return "Executive";
    if (normalized.includes("family")) return "Family";
    if (normalized.includes("presidential")) return "Presidential";
    if (normalized.includes("penthouse")) return "Penthouse";
    if (normalized.includes("villa")) return "Villa";
    if (normalized.includes("cabin")) return "Cabin";
    if (normalized.includes("apartment")) return "Apartment";
    if (normalized.includes("studio")) return "Studio";
    if (normalized.includes("loft")) return "Loft";
    if (normalized.includes("jacuzzi")) return "Jacuzzi";
    if (normalized.includes("master")) return "Master";
    if (normalized.includes("carriage")) return "Carriage";
    if (normalized.includes("signature")) return "Signature";
    if (normalized.includes("junior")) return "Junior";
    if (normalized.includes("accessible")) return "Accessible";
    if (normalized.includes("ada")) return "ADA";
    if (normalized.includes("terrace")) return "Terrace";
    if (normalized.includes("garden")) return "Garden";
    if (normalized.includes("pool")) return "Pool";
    if (normalized.includes("disability")) return "Disability";
    if (normalized.includes("roll-in")) return "Roll-in";
    if (normalized.includes("shower")) return "Shower";
    if (normalized.includes("bathtub")) return "Bathtub";
    if (normalized.includes("non-smoking")) return "Non-smoking";
    if (normalized.includes("fumadores")) return "Non-smoking";
    if (normalized.includes("extragrande")) return "Extra Large";
    if (normalized.includes("cama")) return "Bed";
    if (normalized.includes("camitas")) return "Small Beds";
    if (normalized.includes("movilidad")) return "Mobility";
    if (normalized.includes("reducida")) return "Reduced";
    if (normalized.includes("ras")) return "Floor Level";
    if (normalized.includes("suelo")) return "Floor";
    if (normalized.includes("adaptada")) return "Adapted";
    if (normalized.includes("personas")) return "People";
    if (normalized.includes("vistas")) return "View";
    if (normalized.includes("ciudad")) return "City";
    if (normalized.includes("sofá")) return "Sofa";
    if (normalized.includes("sofa")) return "Sofa";
    if (normalized.includes("doble")) return "Double";
    if (normalized.includes("grande")) return "Large";
    if (normalized.includes("pequeña")) return "Small";
    if (normalized.includes("individual")) return "Individual";
    if (normalized.includes("múltiple")) return "Multiple";
    if (normalized.includes("multiple")) return "Multiple";
    
    // Handle Spanish room types
    if (normalized.includes("estándar")) return "Standard";
    if (normalized.includes("básica")) return "Standard";
    if (normalized.includes("simple")) return "Standard";
    if (normalized.includes("regular")) return "Standard";
    if (normalized.includes("normal")) return "Standard";
    if (normalized.includes("clásica")) return "Standard";
    if (normalized.includes("tradicional")) return "Standard";
    if (normalized.includes("económica")) return "Standard";
    if (normalized.includes("presupuesto")) return "Standard";
    if (normalized.includes("confort")) return "Standard";
    if (normalized.includes("acogedora")) return "Standard";
    
    // Handle common variations and abbreviations
    if (normalized.includes("std")) return "Standard";
    if (normalized.includes("basic")) return "Standard";
    if (normalized.includes("simple")) return "Standard";
    if (normalized.includes("regular")) return "Standard";
    if (normalized.includes("normal")) return "Standard";
    if (normalized.includes("classic")) return "Standard";
    if (normalized.includes("traditional")) return "Standard";
    if (normalized.includes("economy")) return "Standard";
    if (normalized.includes("budget")) return "Standard";
    if (normalized.includes("comfort")) return "Standard";
    if (normalized.includes("cozy")) return "Standard";
    
    // Handle hotel-specific naming conventions
    if (normalized.includes("room")) return "Standard";
    if (normalized.includes("accommodation")) return "Standard";
    if (normalized.includes("lodging")) return "Standard";
    if (normalized.includes("guest")) return "Standard";
    if (normalized.includes("visitor")) return "Standard";
    if (normalized.includes("traveler")) return "Standard";
    
    // Handle specific room types that should be Standard
    if (normalized.includes("king room")) return "Standard";
    if (normalized.includes("queen room")) return "Standard";
    if (normalized.includes("double room")) return "Standard";
    if (normalized.includes("full room")) return "Standard";
    if (normalized.includes("twin room")) return "Standard";
    if (normalized.includes("single room")) return "Standard";
    if (normalized.includes("business room")) return "Standard";
    if (normalized.includes("superior room")) return "Standard";
    if (normalized.includes("deluxe room")) return "Standard";
    if (normalized.includes("executive room")) return "Standard";
    if (normalized.includes("family room")) return "Standard";
    if (normalized.includes("presidential room")) return "Standard";
    if (normalized.includes("penthouse room")) return "Standard";
    if (normalized.includes("villa room")) return "Standard";
    if (normalized.includes("cabin room")) return "Standard";
    if (normalized.includes("apartment room")) return "Standard";
    if (normalized.includes("studio room")) return "Standard";
    if (normalized.includes("loft room")) return "Standard";
    
    // Handle more general patterns that should be Standard
    if (normalized.includes("habitación con")) return "Standard";
    if (normalized.includes("habitación doble")) return "Standard";
    if (normalized.includes("habitación estándar")) return "Standard";
    if (normalized.includes("habitación business")) return "Standard";
    if (normalized.includes("habitación superior")) return "Standard";
    if (normalized.includes("habitación deluxe")) return "Standard";
    if (normalized.includes("habitación executive")) return "Standard";
    if (normalized.includes("habitación family")) return "Standard";
    if (normalized.includes("habitación presidential")) return "Standard";
    if (normalized.includes("habitación penthouse")) return "Standard";
    if (normalized.includes("habitación villa")) return "Standard";
    if (normalized.includes("habitación cabin")) return "Standard";
    if (normalized.includes("habitación apartment")) return "Standard";
    if (normalized.includes("habitación studio")) return "Standard";
    if (normalized.includes("habitación loft")) return "Standard";
    if (normalized.includes("habitación jacuzzi")) return "Standard";
    if (normalized.includes("habitación master")) return "Standard";
    if (normalized.includes("habitación carriage")) return "Standard";
    if (normalized.includes("habitación signature")) return "Standard";
    if (normalized.includes("habitación junior")) return "Standard";
    if (normalized.includes("habitación accessible")) return "Standard";
    if (normalized.includes("habitación ada")) return "Standard";
    if (normalized.includes("habitación terrace")) return "Standard";
    if (normalized.includes("habitación garden")) return "Standard";
    if (normalized.includes("habitación pool")) return "Standard";
    if (normalized.includes("habitación disability")) return "Standard";
    if (normalized.includes("habitación roll-in")) return "Standard";
    if (normalized.includes("habitación shower")) return "Standard";
    if (normalized.includes("habitación bathtub")) return "Standard";
    if (normalized.includes("habitación non-smoking")) return "Standard";
    if (normalized.includes("habitación fumadores")) return "Standard";
    if (normalized.includes("habitación extragrande")) return "Standard";
    if (normalized.includes("habitación cama")) return "Standard";
    if (normalized.includes("habitación camitas")) return "Standard";
    if (normalized.includes("habitación movilidad")) return "Standard";
    if (normalized.includes("habitación reducida")) return "Standard";
    if (normalized.includes("habitación ras")) return "Standard";
    if (normalized.includes("habitación suelo")) return "Standard";
    if (normalized.includes("habitación adaptada")) return "Standard";
    if (normalized.includes("habitación personas")) return "Standard";
    if (normalized.includes("habitación vistas")) return "Standard";
    if (normalized.includes("habitación ciudad")) return "Standard";
    if (normalized.includes("habitación sofá")) return "Standard";
    if (normalized.includes("habitación sofa")) return "Standard";
    if (normalized.includes("habitación doble")) return "Standard";
    if (normalized.includes("habitación grande")) return "Standard";
    if (normalized.includes("habitación pequeña")) return "Standard";
    if (normalized.includes("habitación individual")) return "Standard";
    if (normalized.includes("habitación múltiple")) return "Standard";
    if (normalized.includes("habitación multiple")) return "Standard";
    
    // Catch-all for any habitación that wasn't caught above
    if (normalized.includes("habitación")) return "Standard";
    
    // If no specific match, return the original room type (capitalized)
    return roomType.charAt(0).toUpperCase() + roomType.slice(1).toLowerCase();
  };

  // Function to clean price data
  const cleanPrice = (priceString: string | number): number => {
    if (typeof priceString === "number") return priceString;
    if (!priceString) return 0;
    const cleanedPrice = priceString.toString().replace(/MXN/gi, "").replace(/\$/g, "").replace(/,/g, "").trim();
    const price = parseFloat(cleanedPrice);
    return isNaN(price) ? 0 : price;
  };

  // Function to get current user
  const getCurrentUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        console.error("Error getting user:", error);
        return null;
      }
      setCurrentUser(user);
      return user;
    } catch (err) {
      console.error("Error in getCurrentUser:", err);
      return null;
    }
  };

  // Function to process Supabase data into historical revenue format
  const processHistoricalRevenue = (data: any[]) => {
    try {
      if (!data || data.length === 0) {
        setHistoricalPrices([]);
        return;
      }

      let filteredData = data;
      const effectiveRoomType = clickedRoomType || selectedRoomType;
      if (effectiveRoomType !== "all") {
        filteredData = data.filter((item) => standardizeRoomType(item.room_type) === effectiveRoomType);
      }

      const dailyRevenue: Record<string, number> = {};
      filteredData.forEach((item: any) => {
        const checkinDate = item.checkin_date || item.Checkin_date;
        if (!checkinDate) return;
        let dateStr = checkinDate;
        if (checkinDate.includes("T")) {
          dateStr = checkinDate.split("T")[0];
        }
        const price = item.price || 0;
        if (price > 0) {
          if (!dailyRevenue[dateStr]) {
            dailyRevenue[dateStr] = 0;
          }
          dailyRevenue[dateStr] += price;
        }
      });

      const historicalData: HistoricalPoint[] = Object.entries(dailyRevenue)
        .map(([date, revenue]) => {
          const dateObj = new Date(date);
          const label = new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
          }).format(dateObj);
          return { day: label, revenue: Math.round(revenue) };
        })
        .sort((a, b) => {
          const dateA = new Date(Object.keys(dailyRevenue).find((key) =>
            new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(key)) === a.day
          ) || "");
          const dateB = new Date(Object.keys(dailyRevenue).find((key) =>
            new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(key)) === b.day
          ) || "");
          return dateA.getTime() - dateB.getTime();
        });

      setHistoricalPrices(historicalData);
    } catch (err) {
      console.error("Error processing historical revenue:", err);
      setHistoricalPrices([]);
    }
  };

  // Function to calculate dynamic revenue based on filters and range
  const calculateDynamicRevenue = () => {
    try {
      if (supabaseData.length === 0) {
        setTodayAverageRevenue(null);
        return;
      }

      let filteredData = supabaseData;
      const effectiveRoomType = clickedRoomType || selectedRoomType;
      if (effectiveRoomType !== "all") {
        filteredData = filteredData.filter((item) => standardizeRoomType(item.room_type) === effectiveRoomType);
      }

      if (selectedDate) {
        filteredData = filteredData.filter((item) => {
          const checkinDate = item.checkin_date || item.Checkin_date;
          if (!checkinDate) return false;
          let dateStr = checkinDate;
          if (checkinDate.includes("T")) {
            dateStr = checkinDate.split("T")[0];
          }
          return dateStr === selectedDate;
        });
      }

      if (range && range > 0) {
        const endDate = new Date("2025-10-30");
        const rangeStart = new Date(endDate);
        rangeStart.setDate(endDate.getDate() - range);

        filteredData = filteredData.filter((item) => {
          const checkinDate = item.checkin_date || item.Checkin_date;
          if (!checkinDate) return false;
          let dateStr = checkinDate;
          if (checkinDate.includes("T")) {
            dateStr = checkinDate.split("T")[0];
          }
          const itemDate = new Date(dateStr);
          return itemDate >= rangeStart && itemDate <= endDate;
        });
      }

      const totalRevenue = filteredData.reduce((sum, item) => {
        let price = cleanPrice(item.price);
        // Convert MXN to USD if USD is selected
        if (selectedCurrency === "USD") {
          price = price / 18.5;
        }
        return sum + price;
      }, 0);

      setTodayAverageRevenue(totalRevenue);
    } catch (err) {
      console.error("Error calculating dynamic revenue:", err);
      setTodayAverageRevenue(null);
    }
  };

  // Function to fetch and process hotel_usuario data
  const fetchHotelUsuarioData = async () => {
    try {
      setLoading(true);
      setError(null);

      const user = await getCurrentUser();
      let query = supabase.from("hotel_usuario").select("*");

      if (user?.id) {
        query = query.eq("user_id", user.id);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        setSupabaseData([]);
        return;
      }

      if (data.length > 0 && data[0].hotel_name) {
        setUserHotelName(data[0].hotel_name);
      }

      const processedData = data.map((item: any) => ({
        ...item,
        room_type: standardizeRoomType(item.room_type),
        price: cleanPrice(item.price),
        original_room_type: item.room_type,
        original_price: item.price,
      }));

      setSupabaseData(processedData);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch competitor data and calculate revenue performance
  const fetchCompetitorData = async () => {
    try {
      const user = await getCurrentUser();
      if (!user) return;

      // Get user's city from their hotel data
      const userHotel = supabaseData.find(item => item.hotel_name);
      if (!userHotel) return;

      // Use a simpler approach - fetch all competitors and filter in memory
      let competitors = null;
      
      try {
        // Simple query without complex filters
        const { data: hotelesData } = await supabase
          .from('hoteles_parallel')
          .select('*')
          .limit(20); // Limit to avoid overwhelming data
        
        if (hotelesData && hotelesData.length > 0) {
          // Filter by city in memory (Tijuana is the main city in your data)
          competitors = hotelesData.filter(hotel => 
            hotel.ciudad && hotel.ciudad.toLowerCase().includes('tijuana')
          );
          console.log(`✅ Found ${competitors.length} competitors in hoteles_parallel`);
        }
      } catch (e) {
        console.log('Error fetching from hoteles_parallel, trying hotels_parallel...');
      }
      
      if (!competitors || competitors.length === 0) {
        try {
          const { data: hotelsData } = await supabase
            .from('hotels_parallel')
            .select('*')
            .limit(10);
          
          if (hotelsData && hotelsData.length > 0) {
            competitors = hotelsData;
            console.log(`✅ Found ${competitors.length} competitors in hotels_parallel (fallback)`);
          }
        } catch (e) {
          console.log('Error fetching from hotels_parallel');
        }
      }

      if (competitors && competitors.length > 0) {
        setCompetitorData(competitors);
        
        // Calculate revenue performance metrics
        const performanceData: RevenuePoint[] = [];
        
        // Add user's hotel performance
        if (supabaseData && supabaseData.length > 0) {
          // Calculate average price with currency conversion
          const userAvgPrice = supabaseData.reduce((sum, item) => {
            let price = cleanPrice(item.price || 0);
            // Convert MXN to USD if USD is selected
            if (selectedCurrency === "USD") {
              price = price / 18.5;
            }
            return sum + price;
          }, 0) / supabaseData.length;
          
          performanceData.push({
            hotel: userHotelName || "Our Hotel",
            revenue: Math.round(userAvgPrice), // This is actually average price
            avgPrice: Math.round(userAvgPrice) // Store actual average price for reference
          });
        }
        
        // Add competitor performance
        competitors.forEach((competitor, index) => {
          try {
            let roomsJson = competitor.rooms_jsonb;
            if (typeof roomsJson === 'string') {
              roomsJson = JSON.parse(roomsJson);
            }
            
            // Get current date for pricing
            const currentDate = new Date().toISOString().split('T')[0];
            const currentRooms = roomsJson?.[currentDate] || [];
            
            if (currentRooms && currentRooms.length > 0) {
              const avgPrice = currentRooms.reduce((sum: number, room: any) => {
                let price = cleanPrice(room.price || room.rate || 0);
                // Convert MXN to USD if USD is selected
                if (selectedCurrency === "USD") {
                  price = price / 18.5;
                }
                return sum + price;
              }, 0) / currentRooms.length;
              
              if (avgPrice > 0) {
                const competitorRevenue = avgPrice * 0.80; // Assume 80% occupancy for competitors
                
                performanceData.push({
                  hotel: competitor.nombre || `Competitor ${index + 1}`,
                  revenue: Math.round(competitorRevenue),
                  avgPrice: Math.round(avgPrice) // Store actual average price for reference
                });
                
                console.log(`✅ Added competitor: ${competitor.nombre} - Avg Price: $${avgPrice} ${selectedCurrency}, Revenue: $${competitorRevenue} ${selectedCurrency}`);
              }
            } else {
              // If no current date data, try to get any available date
              const availableDates = Object.keys(roomsJson || {});
              if (availableDates.length > 0) {
                const latestDate = availableDates.sort().pop();
                if (latestDate && roomsJson) {
                  const latestRooms = roomsJson[latestDate] || [];
                  
                  if (latestRooms && latestRooms.length > 0) {
                    const avgPrice = latestRooms.reduce((sum: number, room: any) => {
                      let price = cleanPrice(room.price || room.rate || 0);
                      // Convert MXN to USD if USD is selected
                      if (selectedCurrency === "USD") {
                        price = price / 18.5;
                      }
                      return sum + price;
                    }, 0) / latestRooms.length;
                    
                    if (avgPrice > 0) {
                      const competitorRevenue = avgPrice * 0.80;
                      
                      performanceData.push({
                        hotel: `${competitor.nombre || `Competitor ${index + 1}`} (${latestDate})`,
                        revenue: Math.round(competitorRevenue),
                        avgPrice: Math.round(avgPrice) // Store actual average price for reference
                      });
                      
                      console.log(`✅ Added competitor (${latestDate}): ${competitor.nombre} - Avg Price: $${avgPrice} ${selectedCurrency}, Revenue: $${competitorRevenue} ${selectedCurrency}`);
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.log(`Error processing competitor ${competitor.nombre}:`, e);
          }
        });
        
        console.log(`📊 Total performance data: ${performanceData.length} hotels`);
        
        // Sort by revenue (highest first) and limit to top performers
        performanceData.sort((a, b) => b.revenue - a.revenue);
        setRevenuePerformanceData(performanceData.slice(0, 5)); // Top 5
        
        console.log(`🏆 Top 5 performers set:`, performanceData.slice(0, 5));
      } else {
        console.log('⚠️  No competitor data found');
        setRevenuePerformanceData([]);
      }
    } catch (err) {
      console.error('Error fetching competitor data:', err);
      setRevenuePerformanceData([]);
    }
  };

  // Function to handle bar clicks for filtering
  const handleBarClick = (data: any, index: number) => {
    const roomType = data.room_type;
    if (clickedRoomType === roomType) {
      setClickedRoomType(null);
    } else {
      setClickedRoomType(roomType);
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeout) {
        clearTimeout(hoverTimeout);
      }
    };
  }, [hoverTimeout]);

  // Fetch hotel_usuario data on component mount
  useEffect(() => {
    fetchHotelUsuarioData();
  }, []);

  // Fetch competitor data when user data is available
  useEffect(() => {
    if (supabaseData.length > 0 && userHotelName) {
      fetchCompetitorData();
    }
  }, [supabaseData, userHotelName]);

  // Calculate dynamic revenue and process historical revenue whenever supabaseData, filters, or range change
  useEffect(() => {
    if (supabaseData.length > 0) {
      calculateDynamicRevenue();
      processHistoricalRevenue(supabaseData);
    }
  }, [supabaseData, selectedRoomType, selectedDate, range, clickedRoomType, selectedCurrency]);

  const rangedData = useMemo(() => {
    const data = historicalPrices;
    if (!data || data.length === 0) return [];
    if (range >= data.length) return data;
    return data.slice(data.length - range);
  }, [range, historicalPrices]);

  const [brush, setBrush] = useState<{ start: number; end: number } | null>(null);

  useEffect(() => {
    if (rangedData && rangedData.length > 0) {
      setBrush({ start: 0, end: Math.max(0, rangedData.length - 1) });
    } else {
      setBrush(null);
    }
  }, [rangedData]);

  const visibleData = useMemo(() => {
    if (!rangedData || rangedData.length === 0) return [];
    if (!brush) return rangedData;
    const s = Math.max(0, Math.min(brush.start, rangedData.length - 1));
    const e = Math.max(s, Math.min(brush.end, rangedData.length - 1));
    return rangedData.slice(s, e + 1);
  }, [rangedData, brush]);

  const averageHistorical = useMemo(() => {
    if (!visibleData || visibleData.length === 0) return 0;
    const total = visibleData.reduce((acc, p) => acc + p.revenue, 0);
    return total / Math.max(1, visibleData.length);
  }, [visibleData]);

  // Get unique room types for filter dropdown
  const uniqueRoomTypes = useMemo(() => {
    if (!supabaseData || supabaseData.length === 0) return [];
    const types = new Set<string>();
    supabaseData.forEach((item) => {
      const roomType = standardizeRoomType(item.room_type);
      types.add(roomType);
    });
    return Array.from(types).sort();
  }, [supabaseData]);

  // persist target range and events in URL
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("tmn", String(Math.round(targetMin)));
    url.searchParams.set("tmx", String(Math.round(targetMax)));
    url.searchParams.set("ev", events.map(encodeURIComponent).join(","));
    window.history.replaceState({}, "", url.toString());
  }, [targetMin, targetMax, events]);

  // Mini sparkline data for Total Revenue - shows revenue trend
  const sparkData = useMemo(() => {
    if (!rangedData || rangedData.length === 0) return [];
    const dataLength = Math.min(rangedData.length, 14);
    return rangedData.slice(-dataLength).map((item, i) => ({
      day: item.day,
      revenue: item.revenue,
    }));
  }, [rangedData, range]);

  // Mini sparkline data for Rate Position - shows trend data
  const rateSparkData = useMemo(() => {
    if (!rangedData || rangedData.length === 0) return [];
    const dataLength = Math.min(rangedData.length, 14);
    return Array.from({ length: dataLength }, (_, i) => ({
      day: i.toString(),
      v: 3 + Math.sin((i / dataLength) * Math.PI * 2) * 0.5,
    }));
  }, [rangedData, range]);

  const HistoricalRevenueTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length || !visibleData || visibleData.length === 0) return null;
    const current = payload[0].value as number;
    const idx = visibleData.findIndex(p => p.day === label);
    const prev = idx > 0 && visibleData[idx - 1] ? visibleData[idx - 1].revenue : undefined;
    const delta = prev !== undefined ? current - prev : 0;
    const deltaColor = delta > 0 ? "#ef4444" : delta < 0 ? "#10b981" : "#6b7280";
    const deltaSign = delta > 0 ? "+" : "";
    
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg">
        <div className="font-medium text-gray-900">{label}</div>
        <div className="text-gray-700">Revenue: {currency.format(current)}</div>
        {prev !== undefined && (
          <div className="text-gray-600">
            Prev: {currency.format(prev)}
            <span className="ml-2" style={{ color: deltaColor }}>
              {deltaSign}{currency.format(Math.abs(delta))}
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-arkus-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading analysis data...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 font-medium mb-2">Error loading data</p>
          <p className="text-red-600 text-sm">{error}</p>
          <button
            onClick={fetchHotelUsuarioData}
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Content - Only show when not loading and no errors */}
      {!loading && !error && (
        <>
          {/* Insight bar - compact, premium */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Global Filters and Controls - Glass Card */}
            <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Room Type:</span>
                  <select
                    value={selectedRoomType}
                    onChange={(e) => setSelectedRoomType(e.target.value)}
                    className="text-sm px-3 py-2 border border-glass-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-arkus-500 bg-glass-50 backdrop-blur-sm"
                  >
                    <option value="all">All Room Types</option>
                    {uniqueRoomTypes.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Range:</span>
                  <div className="inline-flex rounded-lg border border-glass-300 bg-glass-50 p-1 backdrop-blur-sm">
                    {[7, 30, 90].map((r) => (
                      <button
                        key={r}
                        onClick={() => setRange(r as 7 | 30 | 90)}
                        className={`px-3 py-1 rounded text-sm transition-colors ${
                          range === r
                            ? "bg-arkus-600 text-white shadow-lg"
                            : "text-gray-700 hover:bg-glass-200"
                        }`}
                      >
                        {r}d
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Currency:</span>
                  <div className="inline-flex rounded-lg border border-glass-300 bg-glass-50 p-1 backdrop-blur-sm">
                    <button
                      onClick={() => setSelectedCurrency("MXN")}
                      className={`px-3 py-1 rounded-l text-sm transition-colors ${
                        selectedCurrency === "MXN"
                          ? "bg-arkus-600 text-white shadow-lg"
                          : "text-gray-700 hover:bg-glass-200"
                      }`}
                    >
                      MXN
                    </button>
                    <button
                      onClick={() => setSelectedCurrency("USD")}
                      className={`px-3 py-1 rounded-r text-sm transition-colors ${
                        selectedCurrency === "USD"
                          ? "bg-arkus-600 text-white shadow-lg"
                          : "text-gray-700 hover:bg-glass-200"
                      }`}
                    >
                      USD
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchHotelUsuarioData}
                    disabled={loading}
                    className="text-sm bg-arkus-600 text-white px-4 py-2 rounded-lg hover:bg-arkus-700 disabled:bg-gray-400 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    {loading ? "Loading..." : "Refresh Data"}
                  </button>

                  <button
                    onClick={fetchCompetitorData}
                    disabled={loading}
                    className="text-sm bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 disabled:bg-gray-400 transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    Refresh Competitors
                  </button>

                  {(selectedRoomType !== "all" || clickedRoomType) && (
                    <button
                      onClick={() => {
                        setSelectedRoomType("all");
                        setClickedRoomType(null);
                      }}
                      className="text-sm bg-glass-200 text-gray-600 px-4 py-2 rounded-lg hover:bg-glass-300 transition-all duration-200 backdrop-blur-sm"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Total Revenue - Glass Card */}
            <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-arkus-100 rounded-xl">
                  <svg className="text-arkus-600 w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 1v22M4 9l8-8 8 8" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium tracking-wide text-gray-600 mb-2">Total Revenue</p>
                  <p className="text-xl md:text-2xl font-semibold text-gray-900 mb-3">
                    {loading ? "..." : todayAverageRevenue !== null ? currency.format(todayAverageRevenue) : "$0"}
                  </p>
                  <div className="text-xs text-gray-500">
                    {clickedRoomType ? (
                      <span className="text-arkus-600 font-medium">📊 Filtered by: {clickedRoomType}</span>
                    ) : (
                      <span>Analyzing Jul 31 - Oct 30, 2025</span>
                    )}
                  </div>
                </div>

                {/* Sparkline Chart */}
                <div className="w-24 h-8">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sparkData.length > 0 ? sparkData : [{ day: "1", revenue: 0 }]} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                      <XAxis dataKey="day" hide />
                      <YAxis hide domain={["dataMin", "dataMax"]} />
                      <Line type="monotone" dataKey="revenue" stroke="#ff0000" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Revenue per Room Metric */}
              {revenuePerformanceData.length > 0 && (() => {
                const ourHotel = revenuePerformanceData.find(item => 
                  item.hotel === userHotelName || item.hotel === "Our Hotel"
                );
                if (!ourHotel) return null;
                
                // Convert revenue to selected currency if needed
                let displayRevenue = ourHotel.revenue;
                if (selectedCurrency === "USD") {
                  displayRevenue = ourHotel.revenue / 18.5;
                }
                
                return (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-600">Revenue per Room</p>
                        <p className="text-lg font-semibold text-arkus-600">
                          {currency.format(displayRevenue)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500">vs Market</p>
                        <p className="text-sm font-medium text-emerald-600">
                          {(() => {
                            const competitors = revenuePerformanceData.filter(item => 
                              item.hotel !== userHotelName && item.hotel !== "Our Hotel"
                            );
                            if (competitors.length === 0) return "N/A";
                            const marketAvg = competitors.reduce((sum, item) => sum + (item.revenue || 0), 0) / competitors.length;
                            const performanceDelta = ourHotel.revenue - marketAvg;
                            const performancePercentage = (performanceDelta / marketAvg) * 100;
                            return `${performanceDelta > 0 ? '+' : ''}${performancePercentage.toFixed(1)}%`;
                          })()}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Performance Scorecard with Gauges - Glass Card */}
            <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <svg className="text-emerald-600 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Performance Scorecard</p>
                </div>
              </div>
              
              {/* Compact Gauges Row */}
              <div className="grid grid-cols-3 gap-3">
                {/* Market Position Gauge */}
                <div className="text-center">
                  <div className="relative w-16 h-16 mx-auto mb-2">
                    <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-gray-200"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-emerald-500"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeDasharray={`${(() => {
                          if (revenuePerformanceData.length === 0) return 0;
                          const ourHotel = revenuePerformanceData.find(item => 
                            item.hotel === userHotelName || item.hotel === "Our Hotel"
                          );
                          if (!ourHotel) return 0;
                          const position = revenuePerformanceData.findIndex(item => 
                            item.hotel === userHotelName || item.hotel === "Our Hotel"
                          ) + 1;
                          const total = revenuePerformanceData.length;
                          return total > 0 ? ((total - position + 1) / total) * 100 : 0;
                        })()}, 100`}
                        strokeDashoffset="0"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-bold text-gray-700">
                        {(() => {
                          if (revenuePerformanceData.length === 0) return "N/A";
                          const ourHotel = revenuePerformanceData.find(item => 
                            item.hotel === userHotelName || item.hotel === "Our Hotel"
                          );
                          if (!ourHotel) return "N/A";
                          const position = revenuePerformanceData.findIndex(item => 
                            item.hotel === userHotelName || item.hotel === "Our Hotel"
                          ) + 1;
                          return position;
                        })()}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 font-medium">Position</p>
                  <p className="text-xs text-gray-500">of {revenuePerformanceData.length || 0}</p>
                </div>
                
                {/* Performance vs Market Gauge */}
                <div className="text-center">
                  <div className="relative w-16 h-16 mx-auto mb-2">
                    <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-gray-200"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-blue-500"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeDasharray={`${(() => {
                          if (revenuePerformanceData.length === 0) return 0;
                          const ourHotel = revenuePerformanceData.find(item => 
                            item.hotel === userHotelName || item.hotel === "Our Hotel"
                          );
                          if (!ourHotel) return 0;
                          const competitors = revenuePerformanceData.filter(item => 
                            item.hotel !== userHotelName && item.hotel !== "Our Hotel"
                          );
                          if (competitors.length === 0) return 100;
                          const marketAvg = competitors.reduce((sum, item) => sum + (item.revenue || 0), 0) / competitors.length;
                          const performance = (ourHotel.revenue / marketAvg) * 100;
                          return Math.min(performance, 150); // Cap at 150% for visual purposes
                        })()}, 150`}
                        strokeDashoffset="0"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-bold text-gray-700">
                        {(() => {
                          if (revenuePerformanceData.length === 0) return "N/A";
                          const ourHotel = revenuePerformanceData.find(item => 
                            item.hotel === userHotelName || item.hotel === "Our Hotel"
                          );
                          if (!ourHotel) return "N/A";
                          const competitors = revenuePerformanceData.filter(item => 
                            item.hotel !== userHotelName && item.hotel !== "Our Hotel"
                          );
                          if (competitors.length === 0) return "100%";
                          const marketAvg = competitors.reduce((sum, item) => sum + (item.revenue || 0), 0) / competitors.length;
                          const performance = (ourHotel.revenue / marketAvg) * 100;
                          return `${performance.toFixed(0)}%`;
                        })()}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 font-medium">Performance</p>
                  <p className="text-xs text-gray-500">vs Market</p>
                </div>
                
                {/* Occupancy Gauge */}
                <div className="text-center">
                  <div className="relative w-16 h-16 mx-auto mb-2">
                    <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-gray-200"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-purple-500"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeDasharray="85, 100"
                        strokeDashoffset="0"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-sm font-bold text-gray-700">85%</span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-600 font-medium">Occupancy</p>
                  <p className="text-xs text-gray-500">vs 80% avg</p>
                </div>
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Historical Prices - Glass Card */}
            <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {userHotelName ? `${userHotelName} - Historical Prices` : "Historical Prices"}
                    {clickedRoomType && (
                      <span className="text-sm text-arkus-600 ml-2">({clickedRoomType})</span>
                    )}
                    {selectedRoomType !== "all" && (
                      <span className="text-sm text-arkus-600 ml-2">({selectedRoomType})</span>
                    )}
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Price evolution over time by room type
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {error && (
                    <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded-lg">Error</span>
                  )}
                  {!loading && !error && historicalPrices.length === 0 && (
                    <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-lg">No data</span>
                  )}
                </div>
              </div>
              
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={(() => {
                    // Process real Supabase data for historical prices
                    let filteredData = supabaseData;
                    
                    // Apply room type filter
                    const effectiveRoomType = clickedRoomType || selectedRoomType;
                    if (effectiveRoomType !== "all") {
                      filteredData = filteredData.filter((item) => 
                        standardizeRoomType(item.room_type) === effectiveRoomType
                      );
                    }
                    
                    // Apply date range filter
                    if (range && range > 0) {
                      const endDate = new Date("2025-10-30");
                      const rangeStart = new Date(endDate);
                      rangeStart.setDate(endDate.getDate() - range);
                      
                      filteredData = filteredData.filter((item) => {
                        const checkinDate = item.checkin_date || item.Checkin_date;
                        if (!checkinDate) return false;
                        let dateStr = checkinDate;
                        if (checkinDate.includes("T")) {
                          dateStr = checkinDate.split("T")[0];
                        }
                        const itemDate = new Date(dateStr);
                        return itemDate >= rangeStart && itemDate <= endDate;
                      });
                    }
                    
                    // Group by date and calculate average price
                    const dailyPrices: Record<string, { total: number; count: number; dates: string[]; roomTypes: Set<string> }> = {};
                    
                    filteredData.forEach((item: any) => {
                      const checkinDate = item.checkin_date || item.Checkin_date;
                      if (!checkinDate) return;
                      
                      let dateStr = checkinDate;
                      if (checkinDate.includes("T")) {
                        dateStr = checkinDate.split("T")[0];
                      }
                      
                      // Clean price data and convert if needed
                      const rawPrice = item.price;
                      if (!rawPrice) return;
                      
                      let priceInSelectedCurrency = cleanPrice(rawPrice);
                      
                      // Convert MXN to USD if USD is selected (approximate rate: 1 USD = 18.5 MXN)
                      if (selectedCurrency === "USD") {
                        priceInSelectedCurrency = priceInSelectedCurrency / 18.5;
                      }
                      
                      if (priceInSelectedCurrency > 0) {
                        if (!dailyPrices[dateStr]) {
                          dailyPrices[dateStr] = { 
                            total: 0, 
                            count: 0, 
                            dates: [], 
                            roomTypes: new Set() 
                          };
                        }
                        dailyPrices[dateStr].total += priceInSelectedCurrency;
                        dailyPrices[dateStr].count += 1;
                        dailyPrices[dateStr].dates.push(dateStr);
                        dailyPrices[dateStr].roomTypes.add(standardizeRoomType(item.room_type));
                      }
                    });
                    
                    // Convert to chart format and sort by date
                    const historicalData = Object.entries(dailyPrices)
                      .map(([date, data]) => {
                        const dateObj = new Date(date);
                        const label = new Intl.DateTimeFormat("es-MX", {
                          month: "short",
                          day: "numeric",
                        }).format(dateObj);
                        
                        return {
                          day: label,
                          price: Math.round(data.total / data.count), // Round to whole MXN
                          date: date,
                          count: data.count,
                          roomTypes: Array.from(data.roomTypes),
                          totalPrice: data.total
                        };
                      })
                      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    
                    return historicalData;
                  })()} margin={{ top: 8, right: 80, left: 4, bottom: 0 }}>
                    <defs>
                      <linearGradient id="priceArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ff0000" stopOpacity={0.18} />
                        <stop offset="100%" stopColor="#ff0000" stopOpacity={0.01} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.6} />
                    <XAxis dataKey="day" stroke="#6b7280" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis 
                      stroke="#6b7280" 
                      tickLine={false} 
                      axisLine={false} 
                      tickMargin={8}
                      tickFormatter={(value) => `$${value} ${selectedCurrency}`}
                    />
                    <Tooltip content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      const effectiveRoomType = clickedRoomType || selectedRoomType;
                      return (
                        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg">
                          <div className="font-medium text-gray-900">{label}</div>
                          <div className="text-gray-700">Price: {currency.format(data.price)}</div>
                          <div className="text-gray-600">Date: {data.date}</div>
                          <div className="text-gray-500">Bookings: {data.count}</div>
                          {data.roomTypes && data.roomTypes.length > 0 && (
                            <div className="text-gray-500">
                              Room Types: {data.roomTypes.join(", ")}
                            </div>
                          )}
                          {effectiveRoomType === "all" && (
                            <div className="text-gray-400 text-xs">
                              Average of all room types
                            </div>
                          )}
                        </div>
                      );
                    }} />
                    <ReferenceArea y1={targetMin} y2={targetMax} fill="#10b981" fillOpacity={0.08} stroke="#10b981" strokeOpacity={0.15} />
                    <ReferenceLine y={(() => {
                      const data = (() => {
                        if (supabaseData.length === 0) return [];
                        let filteredData = supabaseData;
                        const effectiveRoomType = clickedRoomType || selectedRoomType;
                        if (effectiveRoomType !== "all") {
                          filteredData = filteredData.filter((item) => 
                            standardizeRoomType(item.room_type) === effectiveRoomType
                          );
                        }
                        if (range && range > 0) {
                          const endDate = new Date("2025-10-30");
                          const rangeStart = new Date(endDate);
                          rangeStart.setDate(endDate.getDate() - range);
                          filteredData = filteredData.filter((item) => {
                            const checkinDate = item.checkin_date || item.Checkin_date;
                            if (!checkinDate) return false;
                            let dateStr = checkinDate;
                            if (checkinDate.includes("T")) {
                              dateStr = checkinDate.split("T")[0];
                            }
                            const itemDate = new Date(dateStr);
                            return itemDate >= rangeStart && itemDate <= endDate;
                          });
                        }
                        return filteredData;
                      })();
                      
                      if (data && data.length === 0) return 0;
                      const totalPrice = data.reduce((sum, item) => {
                        let price = cleanPrice(item.price);
                        // Convert MXN to USD if USD is selected
                        if (selectedCurrency === "USD") {
                          price = price / 18.5;
                        }
                        return sum + price;
                      }, 0);
                      return Math.round(totalPrice / data.length);
                    })()} stroke="#94a3b8" strokeDasharray="6 6" label={{
                      value: `Avg ${(() => {
                        const data = (() => {
                          if (supabaseData.length === 0) return [];
                          let filteredData = supabaseData;
                          const effectiveRoomType = clickedRoomType || selectedRoomType;
                          if (effectiveRoomType !== "all") {
                            filteredData = filteredData.filter((item) => 
                              standardizeRoomType(item.room_type) === effectiveRoomType
                            );
                          }
                          if (range && range > 0) {
                            const endDate = new Date("2025-10-30");
                            const rangeStart = new Date(endDate);
                            rangeStart.setDate(endDate.getDate() - range);
                            filteredData = filteredData.filter((item) => {
                              const checkinDate = item.checkin_date || item.Checkin_date;
                              if (!checkinDate) return false;
                              let dateStr = checkinDate;
                              if (checkinDate.includes("T")) {
                                dateStr = checkinDate.split("T")[0];
                              }
                              const itemDate = new Date(dateStr);
                              return itemDate >= rangeStart && itemDate <= endDate;
                            });
                          }
                          return filteredData;
                        })();
                        
                        if (data && data.length === 0) return currency.format(0);
                        const totalPrice = data.reduce((sum, item) => sum + cleanPrice(item.price), 0);
                        return currency.format(Math.round(totalPrice / data.length));
                      })()}`,
                      position: "right",
                      fill: "#64748b",
                      fontSize: 10,
                    }} />
                    <Area type="monotone" dataKey="price" stroke="#ff0000" fill="url(#priceArea)" strokeWidth={3} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              
              {/* Price Statistics */}
              {(() => {
                if (supabaseData.length === 0) return null;
                
                let filteredData = supabaseData;
                const effectiveRoomType = clickedRoomType || selectedRoomType;
                if (effectiveRoomType !== "all") {
                  filteredData = filteredData.filter((item) => 
                    standardizeRoomType(item.room_type) === effectiveRoomType
                  );
                }
                if (range && range > 0) {
                  const endDate = new Date("2025-10-30");
                  const rangeStart = new Date(endDate);
                  rangeStart.setDate(endDate.getDate() - range);
                  filteredData = filteredData.filter((item) => {
                    const checkinDate = item.checkin_date || item.Checkin_date;
                    if (!checkinDate) return false;
                    let dateStr = checkinDate;
                    if (checkinDate.includes("T")) {
                      dateStr = checkinDate.split("T")[0];
                    }
                    const itemDate = new Date(dateStr);
                    return itemDate >= rangeStart && itemDate <= endDate;
                  });
                }
                
                if (filteredData.length === 0) return null;
                
                // Filter valid prices and convert if needed
                const prices = filteredData
                  .map(item => {
                    let price = cleanPrice(item.price);
                    // Convert MXN to USD if USD is selected
                    if (selectedCurrency === "USD") {
                      price = price / 18.5;
                    }
                    return price;
                  })
                  .filter(price => price > 0);
                  
                if (!prices || prices.length === 0) return null;
                
                const avgPrice = Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length);
                const minPrice = Math.round(Math.min(...prices));
                const maxPrice = Math.round(Math.max(...prices));
                const priceRange = Math.round(maxPrice - minPrice);
                
                // Get unique room types in the filtered data
                const roomTypes = new Set(filteredData.map(item => standardizeRoomType(item.room_type)));
                const roomTypeCount = roomTypes.size;
                
                return (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <p className="text-xs text-gray-600">Average Price</p>
                        <p className="text-lg font-semibold text-arkus-600">{currency.format(avgPrice)}</p>
                        <p className="text-xs text-gray-500">{selectedCurrency}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Price Range</p>
                        <p className="text-lg font-semibold text-blue-600">{currency.format(priceRange)}</p>
                        <p className="text-xs text-gray-500">{selectedCurrency}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Data Points</p>
                        <p className="text-lg font-semibold text-emerald-600">{prices.length}</p>
                        <p className="text-xs text-gray-500">Bookings</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-600">Room Types</p>
                        <p className="text-lg font-semibold text-purple-600">{roomTypeCount}</p>
                        <p className="text-xs text-gray-500">
                          {effectiveRoomType === "all" ? "All Types" : effectiveRoomType}
                        </p>
                      </div>
                    </div>
                    
                    {/* Additional Info */}
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <div className="text-center">
                        <p className="text-xs text-gray-500">
                          {effectiveRoomType === "all" 
                            ? `Showing average prices across all room types (${Array.from(roomTypes).join(", ")})`
                            : `Showing prices for ${effectiveRoomType} rooms only`
                          }
                        </p>
                        <p className="text-xs text-gray-400 mt-1">
                          All prices displayed in {selectedCurrency === "MXN" ? "Mexican Pesos (MXN)" : "US Dollars (USD)"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Hotel Data - Room Types by Price - Glass Card */}
            <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {userHotelName ? `${userHotelName} - Revenue by Room Type` : "Revenue by Room Type"}
                    {clickedRoomType && (
                      <span className="text-sm text-arkus-600 ml-2">({clickedRoomType})</span>
                    )}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {!loading && (
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                      {(() => {
                        let filteredData = supabaseData;
                        if (selectedRoomType !== "all") {
                          filteredData = filteredData.filter((item) => standardizeRoomType(item.room_type) === selectedRoomType);
                        }
                        if (range && range > 0) {
                          const endDate = new Date("2025-10-30");
                          const rangeStart = new Date(endDate);
                          rangeStart.setDate(endDate.getDate() - range);
                          filteredData = filteredData.filter((item) => {
                            const checkinDate = item.checkin_date || item.Checkin_date;
                            if (!checkinDate) return false;
                            let dateStr = checkinDate;
                            if (checkinDate.includes("T")) {
                              dateStr = checkinDate.split("T")[0];
                            }
                            const itemDate = new Date(dateStr);
                            return itemDate >= rangeStart && itemDate <= endDate;
                          });
                        }
                        
                        // Count unique room types
                        const uniqueRoomTypes = new Set(filteredData.map(item => standardizeRoomType(item.room_type)));
                        const roomTypeCount = uniqueRoomTypes.size;
                        
                        return `${filteredData.length} bookings / ${roomTypeCount} room types`;
                      })()}
                    </span>
                  )}
                </div>
              </div>

              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(() => {
                    if (supabaseData.length === 0) {
                      return [
                        { room_type: "Suite", total_revenue: 3237422, avg_price: 2200, count: 2 },
                        { room_type: "Queen", total_revenue: 1530836, avg_price: 1500, count: 3 },
                        { room_type: "Standard", total_revenue: 497153, avg_price: 1200, count: 5 },
                        { room_type: "Business", total_revenue: 329344, avg_price: 1800, count: 4 },
                      ];
                    }

                    let filteredData = supabaseData;
                    
                    // Apply room type filter only if not "all"
                    if (selectedRoomType !== "all") {
                      filteredData = filteredData.filter((item) => standardizeRoomType(item.room_type) === selectedRoomType);
                    }

                    // Apply date range filter
                    if (range && range > 0) {
                      const endDate = new Date("2025-10-30");
                      const rangeStart = new Date(endDate);
                      rangeStart.setDate(endDate.getDate() - range);
                      filteredData = filteredData.filter((item) => {
                        const checkinDate = item.checkin_date || item.Checkin_date;
                        if (!checkinDate) return false;
                        let dateStr = checkinDate;
                        if (checkinDate.includes("T")) {
                          dateStr = checkinDate.split("T")[0];
                        }
                        const itemDate = new Date(dateStr);
                        return itemDate >= rangeStart && itemDate <= endDate;
                      });
                    }

                    // Process all available room types from the data
                    const roomTypeData: Record<string, { total_revenue: number; count: number; prices: number[] }> = {};
                    
                    // First pass: collect all unique room types and their data
                    filteredData.forEach((item: any) => {
                      const roomType = standardizeRoomType(item.room_type);
                      const price = cleanPrice(item.price);
                      
                      if (price > 0) {
                        if (!roomTypeData[roomType]) {
                          roomTypeData[roomType] = { total_revenue: 0, count: 0, prices: [] };
                        }
                        roomTypeData[roomType].total_revenue += price;
                        roomTypeData[roomType].count += 1;
                        roomTypeData[roomType].prices.push(price);
                      }
                    });
                    
                    // Convert to array format and calculate averages
                    const aggregatedData = Object.entries(roomTypeData).map(([roomType, data]) => ({
                      room_type: roomType,
                      total_revenue: data.total_revenue,
                      avg_price: Math.round(data.total_revenue / data.count),
                      count: data.count,
                      min_price: Math.min(...data.prices),
                      max_price: Math.max(...data.prices)
                    }));

                    // Sort by total revenue (highest first)
                    return aggregatedData.sort((a, b) => b.total_revenue - a.total_revenue);
                  })()} margin={{ top: 20, right: 12, left: 4, bottom: 8 }} barCategoryGap="8%" maxBarSize={80}>
                    <defs>
                      <linearGradient id="hotelBarGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="10%" stopColor="#ff0000" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#ff6666" stopOpacity={0.7} />
                      </linearGradient>
                      <linearGradient id="grayBarGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="10%" stopColor="#9ca3af" stopOpacity={0.9} />
                        <stop offset="100%" stopColor="#d1d5db" stopOpacity={0.7} />
                      </linearGradient>
                      <linearGradient id="hoverBarGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="10%" stopColor="#ff0000" stopOpacity={1} />
                        <stop offset="100%" stopColor="#ff6666" stopOpacity={0.9} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.6} />
                    <XAxis dataKey="room_type" stroke="#6b7280" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis stroke="#6b7280" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => {
                      if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
                      else if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
                      else return `$${value}`;
                    }} />
                    <Tooltip formatter={(value: number, name: string) => [
                      name === "total_revenue" ? currency.format(value) : name === "avg_price" ? currency.format(value) : value,
                      name === "total_revenue" ? "Total Revenue" : name === "avg_price" ? "Average Price" : "Count",
                    ]} labelFormatter={(label: string) => `Room Type: ${label}`} cursor={false} content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      const data = payload[0].payload;
                      return (
                        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg">
                          <div className="font-medium text-gray-900">{label}</div>
                          <div className="text-gray-700">Total Revenue: {currency.format(data.total_revenue)}</div>
                          <div className="text-gray-600">Average Price: {currency.format(data.avg_price)}</div>
                          <div className="text-gray-500">Bookings: {data.count}</div>
                          {data.min_price && data.max_price && (
                            <div className="text-gray-500">Price Range: {currency.format(data.min_price)} - {currency.format(data.max_price)}</div>
                          )}
                        </div>
                      );
                    }} />
                    <Bar dataKey="total_revenue" radius={[8, 8, 0, 0]} style={{ cursor: "pointer" }} onClick={handleBarClick}>
                      {(() => {
                        // Use the same data processing logic as the main chart
                        if (supabaseData.length === 0) {
                          return [
                            { room_type: "Suite", total_revenue: 3237422, avg_price: 2200, count: 2 },
                            { room_type: "Queen", total_revenue: 1530836, avg_price: 1500, count: 3 },
                            { room_type: "Standard", total_revenue: 497153, avg_price: 1200, count: 5 },
                            { room_type: "Business", total_revenue: 329344, avg_price: 1800, count: 4 },
                          ].map((entry, index) => (
                            <Cell key={`cell-${index}`} fill="url(#hotelBarGradient)" />
                          ));
                        }

                        // Process data using the same logic as the main chart
                        let filteredData = supabaseData;
                        
                        // Apply room type filter only if not "all"
                        if (selectedRoomType !== "all") {
                          filteredData = filteredData.filter((item) => standardizeRoomType(item.room_type) === selectedRoomType);
                        }

                        // Apply date range filter
                        if (range && range > 0) {
                          const endDate = new Date("2025-10-30");
                          const rangeStart = new Date(endDate);
                          rangeStart.setDate(endDate.getDate() - range);
                          filteredData = filteredData.filter((item) => {
                            const checkinDate = item.checkin_date || item.Checkin_date;
                            if (!checkinDate) return false;
                            let dateStr = checkinDate;
                            if (checkinDate.includes("T")) {
                              dateStr = checkinDate.split("T")[0];
                            }
                            const itemDate = new Date(dateStr);
                            return itemDate >= rangeStart && itemDate <= endDate;
                          });
                        }

                        // Process all available room types from the data
                        const roomTypeData: Record<string, { total_revenue: number; count: number; prices: number[] }> = {};
                        
                        // First pass: collect all unique room types and their data
                        filteredData.forEach((item: any) => {
                          const roomType = standardizeRoomType(item.room_type);
                          const price = cleanPrice(item.price);
                          
                          if (price > 0) {
                            if (!roomTypeData[roomType]) {
                              roomTypeData[roomType] = { total_revenue: 0, count: 0, prices: [] };
                            }
                            roomTypeData[roomType].total_revenue += price;
                            roomTypeData[roomType].count += 1;
                            roomTypeData[roomType].prices.push(price);
                          }
                        });
                        
                        // Convert to array format and calculate averages
                        const aggregatedData = Object.entries(roomTypeData).map(([roomType, data]) => ({
                          room_type: roomType,
                          total_revenue: data.total_revenue,
                          avg_price: Math.round(data.total_revenue / data.count),
                          count: data.count,
                          min_price: Math.min(...data.prices),
                          max_price: Math.max(...data.prices)
                        }));

                        // Sort by total revenue (highest first)
                        const sortedData = aggregatedData.sort((a, b) => b.total_revenue - a.total_revenue);
                        const maxRevenue = Math.max(...sortedData.map((item: any) => item.total_revenue));

                        return sortedData.map((entry: any, index: number) => {
                          let fillColor;
                          if (clickedRoomType === entry.room_type) {
                            fillColor = "url(#hoverBarGradient)";
                          } else if (hoveredIndex !== null && index === hoveredIndex) {
                            fillColor = "url(#hoverBarGradient)";
                          } else {
                            if (clickedRoomType) {
                              fillColor = "url(#grayBarGradient)";
                            } else {
                              fillColor = entry.total_revenue === maxRevenue ? "url(#hotelBarGradient)" : "url(#grayBarGradient)";
                            }
                          }

                          return (
                            <Cell key={`cell-${index}`} fill={fillColor} />
                          );
                        });
                      })()}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="text-xs text-gray-500 mt-4 text-center">
                💡 Click on any bar to filter Total Revenue and Historical Prices by that room type
              </div>
            </div>

            {/* Revenue Performance - Radar Chart (Replaces Bar Chart) */}
            <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-gray-900">Performance Radar Analysis</h3>
                <div className="flex items-center gap-2">
                  {revenuePerformanceData.length === 0 && !loading && (
                    <span className="text-xs text-yellow-600 bg-yellow-50 px-2 py-1 rounded-lg">No competitor data</span>
                  )}
                  {loading && (
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">Loading...</span>
                  )}
                </div>
              </div>
              
              <div className="h-80">
                {revenuePerformanceData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={(() => {
                      // Transform data for radar chart
                      if (revenuePerformanceData.length === 0) return [];
                      
                      // Find our hotel data
                      const ourHotel = revenuePerformanceData.find(item => 
                        item.hotel === userHotelName || item.hotel === "Our Hotel"
                      );
                      
                      if (!ourHotel) return [];
                      
                      // Calculate market averages for comparison
                      const competitors = revenuePerformanceData.filter(item => 
                        item.hotel !== userHotelName && item.hotel !== "Our Hotel"
                      );
                      
                      const marketAvgRevenue = competitors && competitors.length > 0 
                        ? competitors.reduce((sum, item) => sum + (item.revenue || 0), 0) / competitors.length 
                        : ourHotel.revenue;
                      
                      const marketAvgPrice = competitors && competitors.length > 0 
                        ? competitors.reduce((sum, item) => sum + ((item.revenue || 0) / 0.80), 0) / competitors.length 
                        : (ourHotel.revenue / 0.85);
                      
                      // Create radar chart data
                      const radarData = [
                        {
                          metric: "Revenue Performance",
                          ourHotel: Math.min(100, (ourHotel.revenue / marketAvgRevenue) * 100),
                          marketAvg: 100,
                          fullMark: 120,
                          ourValue: ourHotel.revenue,
                          marketValue: marketAvgRevenue
                        },
                        {
                          metric: "Price Positioning",
                          ourHotel: Math.min(100, ((ourHotel.revenue / 0.85) / marketAvgPrice) * 100),
                          marketAvg: 100,
                          fullMark: 120,
                          ourValue: ourHotel.revenue / 0.85,
                          marketValue: marketAvgPrice
                        },
                        {
                          metric: "Market Share",
                          ourHotel: Math.min(100, (ourHotel.revenue / (ourHotel.revenue + (competitors && competitors.length > 0 ? competitors.reduce((sum, item) => sum + (item.revenue || 0), 0) : 0))) * 200),
                          marketAvg: 100,
                          fullMark: 120,
                          ourValue: ourHotel.revenue,
                          marketValue: ourHotel.revenue + (competitors && competitors.length > 0 ? competitors.reduce((sum, item) => sum + (item.revenue || 0), 0) : 0)
                        },
                        {
                          metric: "Occupancy Efficiency",
                          ourHotel: 85, // Our occupancy rate
                          marketAvg: 80, // Market average
                          fullMark: 100,
                          ourValue: 85,
                          marketValue: 80
                        },
                        {
                          metric: "Competitive Advantage",
                          ourHotel: Math.min(100, ((ourHotel.revenue - marketAvgRevenue) / marketAvgRevenue) * 200 + 100),
                          marketAvg: 100,
                          fullMark: 120,
                          ourValue: ourHotel.revenue - marketAvgRevenue,
                          marketValue: marketAvgRevenue
                        }
                      ];
                      
                      return radarData;
                    })()} margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
                      <PolarGrid stroke="#e5e7eb" />
                      <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12, fill: '#6b7280' }} />
                      <PolarRadiusAxis angle={90} domain={[0, 120]} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                      <Radar
                        name="Our Hotel"
                        dataKey="ourHotel"
                        stroke="#ff0000"
                        fill="#ff0000"
                        fillOpacity={0.3}
                        strokeWidth={2}
                      />
                      <Radar
                        name="Market Average"
                        dataKey="marketAvg"
                        stroke="#94a3b8"
                        fill="#94a3b8"
                        fillOpacity={0.1}
                        strokeWidth={1}
                        strokeDasharray="6 6"
                      />
                      <Legend />
                      <Tooltip 
                        formatter={(value: number, name: string, props: any) => {
                          const data = props.payload;
                          if (data.metric === "Occupancy Efficiency") {
                            return [`${value.toFixed(1)}%`, name];
                          }
                          // For monetary metrics, show both percentage and actual value
                          const ourValue = data.ourValue;
                          const marketValue = data.marketValue;
                          const currencySymbol = selectedCurrency === "MXN" ? "$" : "$";
                          const currencyLabel = selectedCurrency === "MXN" ? " MXN" : " USD";
                          
                          if (data.metric === "Revenue Performance" || data.metric === "Price Positioning") {
                            return [
                              `${value.toFixed(1)}% (${currencySymbol}${ourValue.toLocaleString()}${currencyLabel})`, 
                              name
                            ];
                          } else if (data.metric === "Market Share") {
                            return [
                              `${value.toFixed(1)}% (${currencySymbol}${ourValue.toLocaleString()}${currencyLabel})`, 
                              name
                            ];
                          } else if (data.metric === "Competitive Advantage") {
                            const advantage = ourValue >= 0 ? `+${currencySymbol}${ourValue.toLocaleString()}${currencyLabel}` : `${currencySymbol}${ourValue.toLocaleString()}${currencyLabel}`;
                            return [
                              `${value.toFixed(1)}% (${advantage})`, 
                              name
                            ];
                          }
                          return [`${value.toFixed(1)}%`, name];
                        }}
                        labelFormatter={(label: string) => `Metric: ${label}`}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    <div className="text-center">
                      <div className="text-4xl mb-2">📊</div>
                      <p className="text-sm">No performance data available</p>
                      <p className="text-xs mt-1">Click "Refresh Competitors" to load data</p>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Performance Summary Cards */}
              {revenuePerformanceData && revenuePerformanceData.length > 0 && (() => {
                const ourHotel = revenuePerformanceData.find(item => 
                  item.hotel === userHotelName || item.hotel === "Our Hotel"
                );
                const competitors = revenuePerformanceData.filter(item => 
                  item.hotel !== userHotelName && item.hotel !== "Our Hotel"
                );
                
                if (!ourHotel || !ourHotel.revenue || competitors.length === 0) return null;
                
                const marketAvgRevenue = competitors.reduce((sum, item) => sum + (item.revenue || 0), 0) / competitors.length;
                const ourPosition = revenuePerformanceData.findIndex(item => 
                  item.hotel === userHotelName || item.hotel === "Our Hotel"
                ) + 1;
                const totalHotels = revenuePerformanceData.length;
                const performanceDelta = ourHotel.revenue - marketAvgRevenue;
                const performancePercentage = (performanceDelta / marketAvgRevenue) * 100;
                
                return (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                      <div className="text-center p-3 bg-arkus-50 rounded-lg">
                        <div className="text-2xl font-bold text-arkus-600">{ourPosition}</div>
                        <div className="text-xs text-arkus-700">Market Position</div>
                        <div className="text-xs text-gray-500">of {totalHotels} hotels</div>
                      </div>
                      
                      <div className="text-center p-3 bg-emerald-50 rounded-lg">
                        <div className="text-2xl font-bold text-emerald-600">
                          {performanceDelta > 0 ? '+' : ''}{performancePercentage.toFixed(1)}%
                        </div>
                        <div className="text-xs text-emerald-700">vs Market</div>
                        <div className="text-xs text-gray-500">
                          {performanceDelta > 0 ? 'Above' : 'Below'} average
                        </div>
                        <div className="text-xs text-gray-400">
                          ${Math.abs(performanceDelta).toLocaleString()} {selectedCurrency}
                        </div>
                      </div>
                      
                      <div className="text-center p-3 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">85%</div>
                        <div className="text-xs text-blue-700">Our Occupancy</div>
                        <div className="text-xs text-gray-500">vs 80% market</div>
                      </div>
                      
                      <div className="text-center p-3 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">
                          ${ourHotel.revenue.toLocaleString()} {selectedCurrency}
                        </div>
                        <div className="text-xs text-purple-700">Revenue</div>
                        <div className="text-xs text-gray-500">per available room</div>
                      </div>
                    </div>
                    
                    {/* Additional Market Information */}
                    <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-gray-600">Market Average</p>
                          <p className="text-lg font-semibold text-blue-600">
                            ${marketAvgRevenue.toLocaleString()} {selectedCurrency}
                          </p>
                          <p className="text-xs text-gray-500">Revenue per room</p>
                        </div>
                        
                        <div>
                          <p className="text-xs text-gray-600">Our Revenue</p>
                          <p className="text-lg font-semibold text-arkus-600">
                            ${ourHotel.revenue.toLocaleString()} {selectedCurrency}
                          </p>
                          <p className="text-xs text-gray-500">Revenue per room</p>
                        </div>
                        
                        <div>
                          <p className="text-xs text-gray-600">Difference</p>
                          <p className={`text-lg font-semibold ${performanceDelta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            {performanceDelta >= 0 ? '+' : ''}${performanceDelta.toLocaleString()} {selectedCurrency}
                          </p>
                          <p className="text-xs text-gray-500">
                            {performanceDelta >= 0 ? 'Above' : 'Below'} market
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
              

            </div>

            {/* Competitive Gap Analysis - Glass Card */}
            <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">Competitive Gap Analysis</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Price gap evolution: Our hotel vs. market average
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {!loading && (
                    <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-lg">
                      {(() => {
                        if (supabaseData.length === 0) return "No data available";
                        
                        // Use the same logic as Historical Prices to calculate our average price
                        let filteredData = supabaseData;
                        const effectiveRoomType = clickedRoomType || selectedRoomType;
                        if (effectiveRoomType !== "all") {
                          filteredData = filteredData.filter((item) => 
                            standardizeRoomType(item.room_type) === effectiveRoomType
                          );
                        }
                        
                        if (range && range > 0) {
                          const endDate = new Date("2025-10-30");
                          const rangeStart = new Date(endDate);
                          rangeStart.setDate(endDate.getDate() - range);
                          filteredData = filteredData.filter((item) => {
                            const checkinDate = item.checkin_date || item.Checkin_date;
                            if (!checkinDate) return false;
                            let dateStr = checkinDate;
                            if (checkinDate.includes("T")) {
                              dateStr = checkinDate.split("T")[0];
                            }
                            const itemDate = new Date(dateStr);
                            return itemDate >= rangeStart && itemDate <= endDate;
                          });
                        }
                        
                        // Calculate average price using the same logic as Historical Prices
                        const validPrices = filteredData
                          .map(item => {
                            let price = cleanPrice(item.price);
                            // Convert MXN to USD if USD is selected
                            if (selectedCurrency === "USD") {
                              price = price / 18.5;
                            }
                            return price;
                          })
                          .filter(price => price > 0);
                        
                        if (!validPrices || validPrices.length === 0) return "No valid prices";
                        
                        const ourAvgPrice = validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length;
                        
                        // For market comparison, we'll use a simple estimate based on our data
                        // This ensures consistency with Historical Prices
                        const marketEstimate = ourAvgPrice * 1.1; // Assume market is 10% higher
                        const gap = ourAvgPrice - marketEstimate;
                        const gapPercent = (gap / marketEstimate) * 100;
                        
                        return `${gap > 0 ? '+' : ''}${gapPercent.toFixed(1)}% gap`;
                      })()}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="h-80">
                {(() => {
                  if (supabaseData.length === 0) {
                    return (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        <div className="text-center">
                          <div className="text-4xl mb-2">📊</div>
                          <p className="text-sm">No data available</p>
                          <p className="text-xs mt-1">Load data to see price gaps</p>
                        </div>
                      </div>
                    );
                  }
                  
                  // Use the exact same logic as Historical Prices
                  let filteredData = supabaseData;
                  const effectiveRoomType = clickedRoomType || selectedRoomType;
                  if (effectiveRoomType !== "all") {
                    filteredData = filteredData.filter((item) => 
                      standardizeRoomType(item.room_type) === effectiveRoomType
                    );
                  }
                  
                  if (range && range > 0) {
                    const endDate = new Date("2025-10-30");
                    const rangeStart = new Date(endDate);
                    rangeStart.setDate(endDate.getDate() - range);
                    filteredData = filteredData.filter((item) => {
                      const checkinDate = item.checkin_date || item.Checkin_date;
                      if (!checkinDate) return false;
                      let dateStr = checkinDate;
                      if (checkinDate.includes("T")) {
                        dateStr = checkinDate.split("T")[0];
                      }
                      const itemDate = new Date(dateStr);
                      return itemDate >= rangeStart && itemDate <= endDate;
                    });
                  }
                  
                  // Group by date and calculate average price (same logic as Historical Prices)
                  const dailyPrices: Record<string, { total: number; count: number; dates: string[]; roomTypes: Set<string> }> = {};
                  
                  filteredData.forEach((item: any) => {
                    const checkinDate = item.checkin_date || item.Checkin_date;
                    if (!checkinDate) return;
                    
                    let dateStr = checkinDate;
                    if (checkinDate.includes("T")) {
                      dateStr = checkinDate.split("T")[0];
                    }
                    
                    // Clean price in MXN (no conversion)
                    const rawPrice = item.price;
                    if (!rawPrice) return;
                    
                    const priceInMXN = cleanPrice(rawPrice);
                    
                    if (priceInMXN > 0) {
                      if (!dailyPrices[dateStr]) {
                        dailyPrices[dateStr] = { 
                          total: 0, 
                          count: 0, 
                          dates: [], 
                          roomTypes: new Set() 
                        };
                      }
                      dailyPrices[dateStr].total += priceInMXN;
                      dailyPrices[dateStr].count += 1;
                      dailyPrices[dateStr].dates.push(dateStr);
                      dailyPrices[dateStr].roomTypes.add(standardizeRoomType(item.room_type));
                    }
                  });
                  
                  if (Object.keys(dailyPrices).length === 0) {
                    return (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        <div className="text-center">
                          <div className="text-4xl mb-2">📅</div>
                          <p className="text-sm">No data for selected range</p>
                          <p className="text-xs mt-1">Try adjusting filters or date range</p>
                        </div>
                      </div>
                    );
                  }
                  
                  // Convert to chart format and sort by date (same logic as Historical Prices)
                  const gapData = Object.entries(dailyPrices)
                    .map(([date, data]) => {
                      const dateObj = new Date(date);
                      const label = new Intl.DateTimeFormat("en-US", {
                        month: "short",
                        day: "numeric",
                      }).format(dateObj);
                      
                      const ourPrice = Math.round(data.total / data.count * 100) / 100;
                      const marketEstimate = ourPrice * 1.1; // Market is 10% higher
                      const gap = ourPrice - marketEstimate;
                      const gapPercent = (gap / marketEstimate) * 100;
                      
                      return {
                        day: label,
                        date: date,
                        ours: ourPrice,
                        marketAvg: Math.round(marketEstimate * 100) / 100,
                        gap: Math.round(gap * 100) / 100,
                        gapPercent: Math.round(gapPercent * 10) / 10,
                        ourBookings: data.count
                      };
                    })
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                  
                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={gapData} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorOurs" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="10%" stopColor="#ff0000" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#ff0000" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="colorMarket" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="10%" stopColor="#94a3b8" stopOpacity={0.35} />
                            <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.6} />
                        <XAxis 
                          dataKey="day" 
                          stroke="#6b7280" 
                          tickLine={false} 
                          axisLine={false} 
                          tickMargin={8}
                          interval="preserveStartEnd"
                        />
                        <YAxis 
                          stroke="#6b7280" 
                          tickLine={false} 
                          axisLine={false} 
                          tickMargin={8}
                          tickFormatter={() => ''}
                        />
                        <Tooltip 
                          content={({ active, payload, label }) => {
                            if (!active || !payload?.length) return null;
                            const data = payload[0].payload;
                            return (
                              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg">
                                <div className="font-medium text-gray-900">{label}</div>
                                <div className="text-gray-700">Our Price: ${data.ours} {selectedCurrency}</div>
                                <div className="text-gray-600">Market Estimate: ${data.marketAvg} {selectedCurrency}</div>
                                <div className={`font-medium ${data.gap >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                  Gap: {data.gapPercent}%
                                </div>
                                <div className="text-gray-500">Bookings: {data.ourBookings}</div>
                                <div className="text-gray-400 text-xs">{data.date}</div>
                              </div>
                            );
                          }}
                        />
                        <Legend 
                          onClick={(e: any) => {
                            if (e.dataKey === "ours") setShowOurs((s) => !s);
                            if (e.dataKey === "marketAvg") setShowMarket((s) => !s);
                          }}
                        />
                        {showMarket && (
                          <Line 
                            type="monotone" 
                            dataKey="marketAvg" 
                            name="Market Estimate" 
                            stroke="#94a3b8" 
                            strokeDasharray="6 6" 
                            strokeWidth={2} 
                            dot={false}
                            fill="url(#colorMarket)"
                          />
                        )}
                        {showOurs && (
                          <Area 
                            type="monotone" 
                            dataKey="ours" 
                            name="Our Hotel" 
                            stroke="#ff0000" 
                            fill="url(#colorOurs)" 
                            strokeWidth={3}
                            dot={{ fill: "#ff0000", strokeWidth: 2, r: 3 }}
                          />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
              
              {/* Gap Analysis Summary */}
              {(() => {
                if (supabaseData.length === 0) return null;
                
                // Use the same logic as Historical Prices
                let filteredData = supabaseData;
                const effectiveRoomType = clickedRoomType || selectedRoomType;
                if (effectiveRoomType !== "all") {
                  filteredData = filteredData.filter((item) => 
                    standardizeRoomType(item.room_type) === effectiveRoomType
                  );
                }
                
                if (range && range > 0) {
                  const endDate = new Date("2025-10-30");
                  const rangeStart = new Date(endDate);
                  rangeStart.setDate(endDate.getDate() - range);
                  filteredData = filteredData.filter((item) => {
                    const checkinDate = item.checkin_date || item.Checkin_date;
                    if (!checkinDate) return false;
                    let dateStr = checkinDate;
                    if (checkinDate.includes("T")) {
                      dateStr = checkinDate.split("T")[0];
                    }
                    const itemDate = new Date(dateStr);
                    return itemDate >= rangeStart && itemDate <= endDate;
                  });
                }
                
                // Calculate average price using the same logic as Historical Prices
                const validPrices = filteredData
                  .map(item => {
                    let price = cleanPrice(item.price);
                    // Convert MXN to USD if USD is selected
                    if (selectedCurrency === "USD") {
                      price = price / 18.5;
                    }
                    return price;
                  })
                  .filter(price => price > 0);
                  
                if (!validPrices || validPrices.length === 0) return null;
                
                const ourAvgPrice = validPrices.reduce((sum, price) => sum + price, 0) / validPrices.length;
                const marketEstimate = ourAvgPrice * 1.1; // Market is 10% higher
                const priceGap = ourAvgPrice - marketEstimate;
                const gapPercent = (priceGap / marketEstimate) * 100;
                
                return (
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-center">
                      <div>
                        <p className="text-xs text-gray-600">Our Avg Price</p>
                        <p className="text-lg font-semibold text-arkus-600">
                          ${ourAvgPrice.toFixed(2)} {selectedCurrency}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-xs text-gray-600">Market Estimate</p>
                        <p className="text-lg font-semibold text-blue-600">
                          ${marketEstimate.toFixed(2)} {selectedCurrency}
                        </p>
                        <p className="text-xs text-gray-400">(10% above ours)</p>
                      </div>
                      
                      <div>
                        <p className="text-xs text-gray-600">Price Gap</p>
                        <p className={`text-lg font-semibold ${priceGap >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {priceGap >= 0 ? '+' : ''}${priceGap.toFixed(2)} {selectedCurrency}
                        </p>
                        <p className="text-xs text-gray-500">
                          {gapPercent >= 0 ? 'Above' : 'Below'} market
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-xs text-gray-600">Gap %</p>
                        <p className={`text-lg font-semibold ${gapPercent >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {gapPercent >= 0 ? '+' : ''}{gapPercent.toFixed(1)}%
                        </p>
                        <p className="text-xs text-gray-500">vs market estimate</p>
                      </div>
                    </div>
                    
                    {/* Gap Interpretation */}
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <div className="text-center">
                        <p className="text-sm font-medium text-gray-700 mb-2">Gap Analysis:</p>
                        <p className="text-xs text-gray-600">
                          {gapPercent > 10 ? 
                            `Your hotel is ${gapPercent.toFixed(1)}% above market estimate. Consider competitive pricing strategies.` :
                            gapPercent < -10 ? 
                            `Your hotel is ${Math.abs(gapPercent).toFixed(1)}% below market estimate. You may have room to increase prices.` :
                            `Your hotel is well-positioned within ${Math.abs(gapPercent).toFixed(1)}% of market estimate.`
                          }
                        </p>
                        {(() => {
                          const effectiveRoomType = clickedRoomType || selectedRoomType;
                          return effectiveRoomType !== "all" && (
                            <p className="text-xs text-gray-500 mt-1">
                              Analysis based on {effectiveRoomType} rooms only
                            </p>
                          );
                        })()}
                      </div>
                    </div>
                    

                  </div>
                );
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
