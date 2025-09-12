/**
 * Custom hook for Analytics export and share functionality
 */

import { useState, useCallback } from 'react';
import { downloadCSV, shareAnalytics, copyToClipboard, type AnalyticsExportData } from '@/lib/exportUtils';

interface UseAnalyticsActionsReturn {
  exportLoading: boolean;
  shareLoading: boolean;
  actionFeedback: string;
  handleExport: () => Promise<void>;
  handleShare: () => Promise<void>;
  clearFeedback: () => void;
}

export function useAnalyticsActions(
  exportData: AnalyticsExportData | null
): UseAnalyticsActionsReturn {
  const [exportLoading, setExportLoading] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string>('');

  const clearFeedback = useCallback(() => {
    setActionFeedback('');
  }, []);

  const showFeedback = useCallback((message: string, duration = 3000) => {
    setActionFeedback(message);
    if (duration > 0) {
      setTimeout(() => setActionFeedback(''), duration);
    }
  }, []);

  const handleExport = useCallback(async () => {
    if (exportLoading || !exportData) return;

    setExportLoading(true);
    setActionFeedback('');

    try {
      if (exportData.historicalData.length === 0) {
        showFeedback('⚠️ No data to export');
        return;
      }

      console.log('🚀 Starting CSV export...', exportData);
      downloadCSV(exportData);
      showFeedback('✅ Report downloaded successfully!');
      
      // Analytics tracking
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'export_analytics', {
          event_category: 'analytics',
          event_label: exportData.userHotelName,
          custom_parameters: {
            data_points: exportData.totalDataPoints,
            room_type: exportData.filters.roomType,
            date_range: exportData.filters.range
          }
        });
      }

    } catch (error) {
      console.error('❌ Export failed:', error);
      showFeedback('❌ Export failed. Please try again.');
    } finally {
      setExportLoading(false);
    }
  }, [exportData, exportLoading, showFeedback]);

  const handleShare = useCallback(async () => {
    if (shareLoading || !exportData) return;

    setShareLoading(true);
    setActionFeedback('');

    try {
      if (exportData.totalDataPoints === 0) {
        showFeedback('⚠️ No data to share');
        return;
      }

      console.log('🚀 Starting share process...', exportData);

      // Try sharing URL first
      const shareSuccess = await shareAnalytics(exportData);

      if (shareSuccess) {
        showFeedback('✅ Shareable link copied to clipboard!');
      } else {
        // Fallback: copy summary to clipboard
        const copySuccess = await copyToClipboard(exportData);
        if (copySuccess) {
          showFeedback('✅ Analysis summary copied to clipboard!');
        } else {
          throw new Error('All share methods failed');
        }
      }

      // Analytics tracking
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'share_analytics', {
          event_category: 'analytics',
          event_label: exportData.userHotelName,
          custom_parameters: {
            share_method: shareSuccess ? 'url' : 'summary',
            data_points: exportData.totalDataPoints
          }
        });
      }

    } catch (error) {
      console.error('❌ Share failed:', error);
      showFeedback('❌ Share failed. Please try again.');
    } finally {
      setShareLoading(false);
    }
  }, [exportData, shareLoading, showFeedback]);

  return {
    exportLoading,
    shareLoading,
    actionFeedback,
    handleExport,
    handleShare,
    clearFeedback
  };
}
