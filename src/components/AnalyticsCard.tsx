'use client'

import { useState } from 'react'

export default function AnalyticsCard() {
  const [selectedMetric, setSelectedMetric] = useState('')
  const [dataPoints, setDataPoints] = useState<number | null>(null)
  const [accuracy, setAccuracy] = useState<number | null>(null)

  const metrics = [
    { id: 'price-trends', name: 'Price Trends', description: 'Track price changes over time' },
    { id: 'competitor-analysis', name: 'Competitor Analysis', description: 'Compare with competitors' },
    { id: 'market-share', name: 'Market Share', description: 'Analyze market position' },
    { id: 'revenue-impact', name: 'Revenue Impact', description: 'Measure pricing impact on revenue' },
  ]

  const handleViewAnalytics = async () => {
    try {
      const response = await fetch('/api/analytics/view', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          metric: selectedMetric,
        }),
      })
      
      const result = await response.json()
      console.log('Analytics result:', result)
      const rows = Array.isArray(result?.data?.rows) ? result.data.rows : []
      setDataPoints(rows.length)
      // Placeholder: set a mock accuracy based on volume; replace when you have a real metric
      setAccuracy(rows.length ? Math.min(99.9, 60 + Math.round((rows.length % 40))) : null)
    } catch (error) {
      console.error('Error viewing analytics:', error)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Data Analytics</h3>
        <div className="p-2 bg-blue-100 rounded-lg">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Analytics Metric
          </label>
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Choose metric...</option>
            {metrics.map((metric) => (
              <option key={metric.id} value={metric.id}>
                {metric.name}
              </option>
            ))}
          </select>
        </div>

        {selectedMetric && (
          <div className="bg-gray-50 rounded-md p-3">
            <p className="text-sm text-gray-600">
              {metrics.find(m => m.id === selectedMetric)?.description}
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-blue-50 rounded-md p-3">
            <p className="text-blue-600 font-medium">Data Points</p>
            <p className="text-2xl font-bold text-blue-900">{dataPoints ?? '-'}</p>
          </div>
          <div className="bg-green-50 rounded-md p-3">
            <p className="text-green-600 font-medium">Accuracy</p>
            <p className="text-2xl font-bold text-green-900">{accuracy != null ? `${accuracy}%` : '-'}</p>
          </div>
        </div>

        <button
          onClick={handleViewAnalytics}
          disabled={!selectedMetric}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          View Analytics
        </button>

        <div className="text-xs text-gray-500">
          Analytics powered by scraped data and machine learning
        </div>
      </div>
    </div>
  )
}
