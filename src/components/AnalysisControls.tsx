import { memo } from 'react';

interface AnalysisControlsProps {
  selectedCurrency: "MXN" | "USD";
  setSelectedCurrency: (currency: "MXN" | "USD") => void;
  selectedRoomType: string;
  setSelectedRoomType: (type: string) => void;
  uniqueRoomTypes: string[];
  range: 7 | 30 | 90;
  setRange: (range: 7 | 30 | 90) => void;
  targetMin: number;
  setTargetMin: (min: number) => void;
  targetMax: number;
  setTargetMax: (max: number) => void;
  events: string[];
  setEvents: (events: string[]) => void;
  clickedRoomType: string | null;
  setClickedRoomType: (type: string | null) => void;
}

const AnalysisControls = memo(({
  selectedCurrency,
  setSelectedCurrency,
  selectedRoomType,
  setSelectedRoomType,
  uniqueRoomTypes,
  range,
  setRange,
  targetMin,
  setTargetMin,
  targetMax,
  setTargetMax,
  events,
  setEvents,
  clickedRoomType,
  setClickedRoomType
}: AnalysisControlsProps) => {
  return (
    <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-4 hover:shadow-2xl transition-all duration-200 ease-out h-full relative">

      {/* Clear Filters Button - Positioned in top right corner */}
      <div className={`absolute top-2 right-2 transition-all duration-200 ease-out ${
        ((selectedRoomType !== "all" && selectedRoomType !== "") || clickedRoomType) 
          ? "opacity-100 scale-100" 
          : "opacity-0 scale-95 pointer-events-none"
      }`}>
        <button
          onClick={() => {
            setSelectedRoomType("all");
            setClickedRoomType(null);
          }}
          className="text-xs bg-arkus-100 text-arkus-700 px-2 py-1 rounded-lg hover:bg-arkus-200 hover:scale-110 transition-all duration-150 ease-out backdrop-blur-sm border border-arkus-200 z-10"
          title="Clear Filters"
        >
          ✕
        </button>
      </div>

      {/* Content Section - Fixed height with grid */}
      <div className="h-24 grid grid-cols-1 gap-2">
        {/* Room Type Selection */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600">Room Type</label>
                  <select
          value={selectedRoomType}
          onChange={(e) => setSelectedRoomType(e.target.value)}
          className="w-full text-sm px-3 py-2 border border-glass-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-arkus-500 bg-glass-50 backdrop-blur-sm transition-all duration-150 ease-out"
        >
            <option value="all">All Room Types</option>
            {uniqueRoomTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>

        {/* Date Range Selection */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600">Date Range</label>
          <div className="inline-flex rounded-lg border border-glass-300 bg-glass-50 p-1 backdrop-blur-sm">
            {([7, 30, 90] as const).map((r) => (
                          <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 rounded text-sm transition-all duration-150 ease-out ${
                range === r
                  ? "bg-arkus-600 text-white shadow-lg scale-105"
                  : "text-gray-700 hover:bg-glass-200 hover:scale-102"
              }`}
            >
                {r}d
              </button>
            ))}
          </div>
        </div>

        {/* Currency Selection */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600">Currency</label>
          <div className="inline-flex rounded-lg border border-glass-300 bg-glass-50 p-1 backdrop-blur-sm">
            <button
              onClick={() => setSelectedCurrency("MXN")}
              className={`px-3 py-1 rounded-l text-sm transition-all duration-150 ease-out ${
                selectedCurrency === "MXN"
                  ? "bg-arkus-600 text-white shadow-lg scale-105"
                  : "text-gray-700 hover:bg-glass-200 hover:scale-102"
              }`}
            >
              MXN
            </button>
            <button
              onClick={() => setSelectedCurrency("USD")}
              className={`px-3 py-1 rounded-r text-sm transition-all duration-150 ease-out ${
                selectedCurrency === "USD"
                  ? "bg-arkus-600 text-white shadow-lg scale-105"
                  : "text-gray-700 hover:bg-glass-200 hover:scale-102"
              }`}
            >
              USD
            </button>
          </div>
        </div>
      </div>


    </div>
  );
});

AnalysisControls.displayName = 'AnalysisControls';

export default AnalysisControls;
