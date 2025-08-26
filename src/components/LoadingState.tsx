interface LoadingStateProps {
  loading: boolean;
  error: string | null;
  children: React.ReactNode;
  onRetry?: () => void;
}

export default function LoadingState({ 
  loading, 
  error, 
  children, 
  onRetry 
}: LoadingStateProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-arkus-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading analysis data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-800 font-medium mb-2">Error loading data</p>
        <p className="text-red-600 text-sm mb-4">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return <>{children}</>;
}

