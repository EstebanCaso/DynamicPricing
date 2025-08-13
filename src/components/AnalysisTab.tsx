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
  const currency = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  const numberFmt = new Intl.NumberFormat("en-US");

  const [showOurs, setShowOurs] = useState(true);
  const [showMarket, setShowMarket] = useState(true);
  const [range, setRange] = useState<7 | 30 | 90>(30);

  // Supabase data states
  const [supabaseData, setSupabaseData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [userHotelName, setUserHotelName] = useState<string>("");
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoverTimeout, setHoverTimeout] = useState<NodeJS.Timeout | null>(null);
  const [todayAverageRevenue, setTodayAverageRevenue] = useState<number | null>(null);
  const [historicalPrices, setHistoricalPrices] = useState<HistoricalPoint[]>([]);

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
    if (normalized.includes("business")) return "Business";
    if (normalized.includes("double") && normalized.includes("bed")) return "Double Bed";
    if (normalized.includes("queen")) return "Queen";
    if (normalized.includes("suite")) return "Suite";
    if (normalized.includes("superior")) return "Superior";
    return "Standard";
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
        const price = cleanPrice(item.price);
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

  // Calculate dynamic revenue and process historical revenue whenever supabaseData, filters, or range change
  useEffect(() => {
    if (supabaseData.length > 0) {
      calculateDynamicRevenue();
      processHistoricalRevenue(supabaseData);
    }
  }, [supabaseData, selectedRoomType, selectedDate, range, clickedRoomType]);

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

  const RevenuePerformanceTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    const value = payload[0].value as number;
    const others = revenuePerformance.filter((r) => r.hotel !== label);
    const avgOthers = others.reduce((a, b) => a + b.revenue, 0) / Math.max(1, others.length);
    const delta = value - avgOthers;
    const color = delta >= 0 ? "#10b981" : "#ef4444";
    const sign = delta > 0 ? "+" : "";
    
    return (
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-lg">
        <div className="font-medium text-gray-900">{label}</div>
        <div className="text-gray-700">Revenue: {currency.format(value)}</div>
        <div className="text-gray-600">
          vs peers: {currency.format(Math.round(avgOthers))}
          <span className="ml-2" style={{ color }}>
            {sign}{currency.format(Math.abs(Math.round(delta)))}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8">
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
              <button
                onClick={fetchHotelUsuarioData}
                disabled={loading}
                className="text-sm bg-arkus-600 text-white px-4 py-2 rounded-lg hover:bg-arkus-700 disabled:bg-gray-400 transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                {loading ? "Loading..." : "Refresh Data"}
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
        </div>

        {/* Rate Position - Glass Card */}
        <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-100 rounded-xl">
              <svg className="text-emerald-600 w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7h6v6M22 7l-8.5 8.5-5-5L2 17" />
              </svg>
            </div>
            <div className="flex items-baseline gap-2 flex-1">
              <div>
                <p className="text-xs font-medium tracking-wide text-gray-600">Rate Position</p>
                <p className="text-xl md:text-2xl font-semibold text-emerald-600">2°</p>
              </div>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">Up</span>
            </div>
            <div className="w-24 h-8">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rateSparkData.length > 0 ? rateSparkData : [{ day: "1", v: 0 }]} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                  <XAxis dataKey="day" hide />
                  <YAxis hide domain={[0, "dataMax"]} />
                  <Line type="monotone" dataKey="v" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
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
                {userHotelName ? `${userHotelName} - Historical Revenue` : "Historical Revenue"}
                {clickedRoomType && (
                  <span className="text-sm text-arkus-600 ml-2">({clickedRoomType})</span>
                )}
              </h3>
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
                if (historicalPrices.length === 0) {
                  const startDate = new Date("2025-07-31");
                  const endDate = new Date("2025-10-30");
                  const mockData: HistoricalPoint[] = [];
                  
                  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                    const dayIndex = Math.floor((d.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
                    const label = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(d);
                    const baseRevenue = 1200;
                    const seasonalFactor = 1 + 0.3 * Math.sin((dayIndex / 90) * Math.PI * 2);
                    const weeklyFactor = 1 + 0.2 * Math.sin((dayIndex / 7) * Math.PI * 2);
                    const noise = (Math.random() - 0.5) * 0.1;
                    const revenue = Math.round(baseRevenue * seasonalFactor * weeklyFactor * (1 + noise));
                    mockData.push({ day: label, revenue: Math.max(800, revenue) });
                  }
                  return mockData;
                }
                return visibleData;
              })()} margin={{ top: 8, right: 80, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff0000" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#ff0000" stopOpacity={0.01} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" opacity={0.6} />
                <XAxis dataKey="day" stroke="#6b7280" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis stroke="#6b7280" tickLine={false} axisLine={false} tickMargin={8} />
                <Tooltip content={<HistoricalRevenueTooltip />} />
                <ReferenceArea y1={targetMin} y2={targetMax} fill="#10b981" fillOpacity={0.08} stroke="#10b981" strokeOpacity={0.15} />
                <ReferenceLine y={averageHistorical} stroke="#94a3b8" strokeDasharray="6 6" label={{
                  value: `Avg ${currency.format(averageHistorical)}`,
                  position: "right",
                  fill: "#64748b",
                  fontSize: 10,
                }} />
                <Area type="monotone" dataKey="revenue" stroke="#ff0000" fill="url(#priceArea)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
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
                    return `${filteredData.length} filtered / ${supabaseData.length} total`;
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

                const roomTypeData = filteredData.reduce((acc: any, item: any) => {
                  const roomType = standardizeRoomType(item.room_type) || "Standard";
                  if (!acc[roomType]) {
                    acc[roomType] = { room_type: roomType, total_revenue: 0, count: 0 };
                  }
                  acc[roomType].total_revenue += item.price || 0;
                  acc[roomType].count += 1;
                  return acc;
                }, {});

                const aggregatedData = Object.values(roomTypeData).map((item: any) => ({
                  room_type: item.room_type,
                  total_revenue: item.total_revenue,
                  avg_price: Math.round(item.total_revenue / item.count),
                  count: item.count,
                }));

                return aggregatedData.sort((a: any, b: any) => b.total_revenue - a.total_revenue);
              })()} margin={{ top: 20, right: 12, left: 4, bottom: 8 }} barCategoryGap="15%" maxBarSize={100}>
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
                ]} labelFormatter={(label: string) => `Room Type: ${label}`} cursor={false} />
                <Bar dataKey="total_revenue" radius={[8, 8, 0, 0]} style={{ cursor: "pointer" }} onClick={handleBarClick}>
                  {(() => {
                    const chartData = supabaseData.length === 0 ? [
                      { room_type: "Suite", total_revenue: 3237422, avg_price: 2200, count: 2 },
                      { room_type: "Queen", total_revenue: 1530836, avg_price: 1500, count: 3 },
                      { room_type: "Standard", total_revenue: 497153, avg_price: 1200, count: 5 },
                      { room_type: "Business", total_revenue: 329344, avg_price: 1800, count: 4 },
                    ] : Object.values(supabaseData.reduce((acc: any, item: any) => {
                      const roomType = item.room_type || "Standard";
                      if (!acc[roomType]) {
                        acc[roomType] = { room_type: roomType, total_revenue: 0, count: 0 };
                      }
                      acc[roomType].total_revenue += item.price || 0;
                      acc[roomType].count += 1;
                      return acc;
                    }, {})).map((item: any) => ({
                      room_type: item.room_type,
                      total_revenue: item.total_revenue,
                      avg_price: Math.round(item.total_revenue / item.count),
                      count: item.count,
                    })).sort((a: any, b: any) => b.total_revenue - a.total_revenue);

                    const maxRevenue = Math.max(...chartData.map((item: any) => item.total_revenue));

                    return chartData.map((entry: any, index: number) => {
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

        {/* Revenue Performance - Glass Card */}
        <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">Revenue Performance</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenuePerformance} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGray" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor="#e5e7eb" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="#cbd5e1" stopOpacity={0.7} />
                  </linearGradient>
                  <linearGradient id="revRed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor="#ff0000" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#ff6666" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="hotel" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip content={<RevenuePerformanceTooltip />} />
                <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                  {revenuePerformance.map((d) => (
                    <Cell key={d.hotel} fill={d.hotel === "Ours" ? "url(#revRed)" : "url(#revGray)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Competitive Gap Analysis - Glass Card */}
        <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-300">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">Competitive Gap Analysis</h3>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={gapSeries} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorOurs" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="10%" stopColor="#ff0000" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#ff0000" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="day" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip wrapperClassName="!rounded-lg !border !border-gray-200 !bg-white" formatter={(v: number, name: string) => [currency.format(v), name]} />
                <Legend onClick={(e: any) => {
                  if (e.dataKey === "ours") setShowOurs((s) => !s);
                  if (e.dataKey === "marketAvg") setShowMarket((s) => !s);
                }} />
                {showMarket && (
                  <Line type="monotone" dataKey="marketAvg" name="marketAvg" stroke="#94a3b8" strokeDasharray="6 6" strokeWidth={2} dot={false} />
                )}
                {showOurs && (
                  <Area type="monotone" dataKey="ours" name="ours" stroke="#ff0000" fill="url(#colorOurs)" strokeWidth={3} />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
