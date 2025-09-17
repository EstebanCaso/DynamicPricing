import { memo, useState } from 'react';
import { downloadCSV, shareAnalytics, copyToClipboard, type AnalyticsExportData } from '@/lib/exportUtils';

interface AnalysisControlsProps {
  selectedCurrency: "MXN" | "USD";
  setSelectedCurrency: (currency: "MXN" | "USD") => void;
  selectedRoomType: string;
  setSelectedRoomType: (type: string) => void;
  uniqueRoomTypes: string[];
  range: 1 | 7 | 30 | 90;
  setRange: (range: 1 | 7 | 30 | 90) => void;
  clickedRoomType: string | null;
  setClickedRoomType: (type: string | null) => void;
  // New props for expanded functionality
  totalDataPoints?: number;
  competitorCount?: number;
  dateRange?: string;
  lastUpdate?: string;
  loading?: boolean;
  // Export data props
  userHotelName?: string;
  marketPosition?: {
    rank: number;
    totalHotels: number;
    priceVsMarket: number;
    yourPrice: number;
    marketAverage: number;
  };
  historicalData?: Array<{
    date: string;
    price: number;
    count: number;
  }>;
}

const AnalysisControls = memo(({
  selectedCurrency,
  setSelectedCurrency,
  selectedRoomType,
  setSelectedRoomType,
  uniqueRoomTypes,
  range,
  setRange,
  clickedRoomType,
  setClickedRoomType,
  totalDataPoints = 0,
  competitorCount = 0,
  dateRange = '',
  lastUpdate = '',
  loading = false,
  userHotelName = '',
  marketPosition,
  historicalData = []
}: AnalysisControlsProps) => {
  const [exportLoading, setExportLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string>('');

  // Prepare export data
  const prepareExportData = (): AnalyticsExportData => ({
    userHotelName,
    dateRange,
    currency: selectedCurrency,
    totalDataPoints,
    competitorCount,
    marketPosition,
    historicalData,
    filters: {
      roomType: selectedRoomType,
      range
    }
  });

  // Handle export functionality
  const handleExport = async () => {
    if (exportLoading) return;
    
    setExportLoading(true);
    setActionFeedback('');
    
    try {
      const exportData = prepareExportData();
      
      if (exportData.historicalData.length === 0) {
        setActionFeedback('⚠️ No data to export');
        return;
      }
      
      downloadCSV(exportData);
      setActionFeedback('✅ Report downloaded!');
      
      // Clear feedback after 3 seconds
      setTimeout(() => setActionFeedback(''), 3000);
      
    } catch (error) {
      console.error('Export failed:', error);
      setActionFeedback('❌ Export failed');
      setTimeout(() => setActionFeedback(''), 3000);
    } finally {
      setExportLoading(false);
    }
  };

  // Handle share functionality
  const handleShare = async () => {
    if (shareLoading) return;
    
    setShareLoading(true);
    setActionFeedback('');
    
    try {
      const exportData = prepareExportData();
      
      if (exportData.totalDataPoints === 0) {
        setActionFeedback('⚠️ No data to share');
        return;
      }
      
      const shareSuccess = await shareAnalytics(exportData);
      
      if (shareSuccess) {
        setActionFeedback('✅ Link copied to clipboard!');
      } else {
        // Fallback: copy summary to clipboard
        const copySuccess = await copyToClipboard(exportData);
        if (copySuccess) {
          setActionFeedback('✅ Summary copied to clipboard!');
        } else {
          setActionFeedback('❌ Share failed');
        }
      }
      
      // Clear feedback after 3 seconds
      setTimeout(() => setActionFeedback(''), 3000);
      
    } catch (error) {
      console.error('Share failed:', error);
      setActionFeedback('❌ Share failed');
      setTimeout(() => setActionFeedback(''), 3000);
    } finally {
      setShareLoading(false);
    }
  };

  return (
    <div className="backdrop-blur-xl bg-glass-100 border border-glass-200 rounded-2xl shadow-xl p-6 hover:shadow-2xl transition-all duration-200 ease-out h-full relative">

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

      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Analysis Controls</h3>
      </div>

      {/* Filters Section */}
      <div className="space-y-4 mb-6">
        {/* Room Type Selection */}
        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-600">Room Type</label>
          <select
            id="roomType"
            name="roomType"
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
            {([1, 7, 30, 90] as const).map((r) => (
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

      {/* Divider */}
      <div className="border-t border-gray-200 mb-4"></div>

      {/* Quick Stats Section */}
      <div className="space-y-3 mb-4">
        <h4 className="text-sm font-medium text-gray-700">Quick Stats</h4>
        
        {loading ? (
          <div className="space-y-2">
            <div className="animate-pulse h-4 bg-gray-200 rounded"></div>
            <div className="animate-pulse h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="animate-pulse h-4 bg-gray-200 rounded w-1/2"></div>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Data Points:</span>
              <span className="text-xs font-medium text-gray-800">{totalDataPoints.toLocaleString()}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Competitors:</span>
              <span className="text-xs font-medium text-gray-800">{competitorCount}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-600">Period:</span>
              <span className="text-xs font-medium text-gray-800">{dateRange || `${range} days`}</span>
            </div>
            
            {lastUpdate && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-600">Last Update:</span>
                <span className="text-xs font-medium text-gray-800">{lastUpdate}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-200 mb-4"></div>

      {/* Actions Section */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-gray-700">Actions</h4>
        
        {/* Action Feedback */}
        {actionFeedback && (
          <div className="text-xs text-center py-1 px-2 rounded bg-blue-50 text-blue-700 border border-blue-200">
            {actionFeedback}
          </div>
        )}
        
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleExport}
            disabled={exportLoading || loading || totalDataPoints === 0}
            className={`px-3 py-2 text-xs rounded-lg transition-all duration-150 ease-out border ${
              exportLoading || loading || totalDataPoints === 0
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-arkus-100 text-arkus-700 border-arkus-200 hover:bg-arkus-200 hover:scale-105'
            }`}
          >
            {exportLoading ? '⏳ Exporting...' : '📊 Export CSV'}
          </button>
          
          <button
            onClick={handleShare}
            disabled={shareLoading || loading || totalDataPoints === 0}
            className={`px-3 py-2 text-xs rounded-lg transition-all duration-150 ease-out border ${
              shareLoading || loading || totalDataPoints === 0
                ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 hover:scale-105'
            }`}
          >
            {shareLoading ? '⏳ Sharing...' : '📤 Share'}
          </button>
        </div>
        
        {/* Action Descriptions */}
        <div className="text-xs text-gray-500 space-y-1">
          <div>📊 Export: Download detailed CSV report</div>
          <div>📤 Share: Copy link or summary to clipboard</div>
        </div>
      </div>


    </div>
  );
});

AnalysisControls.displayName = 'AnalysisControls';

export default AnalysisControls;
