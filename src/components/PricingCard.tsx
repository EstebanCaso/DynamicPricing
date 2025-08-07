'use client'

import { useState } from 'react'

export default function PricingCard() {
  const [priceRange, setPriceRange] = useState({ min: '', max: '' })
  const [analysisType, setAnalysisType] = useState('')

  const analysisTypes = [
    { id: 'competitor', name: 'Competitor Analysis', description: 'Analyze competitor pricing' },
    { id: 'market', name: 'Market Trends', description: 'Track market price trends' },
    { id: 'optimization', name: 'Price Optimization', description: 'Optimize pricing strategy' },
  ]

  const handleAnalyze = async () => {
    try {
      const response = await fetch('/api/pricing/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceRange,
          analysisType,
        }),
      })
      
      const result = await response.json()
      console.log('Analysis result:', result)
    } catch (error) {
      console.error('Error running analysis:', error)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Pricing Analysis</h3>
        <div className="p-2 bg-green-100 rounded-lg">
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
          </svg>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Analysis Type
          </label>
          <select
            value={analysisType}
            onChange={(e) => setAnalysisType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Choose analysis type...</option>
            {analysisTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Min Price
            </label>
            <input
              type="number"
              value={priceRange.min}
              onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
              placeholder="0.00"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Price
            </label>
            <input
              type="number"
              value={priceRange.max}
              onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
              placeholder="999.99"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
        </div>

        {analysisType && (
          <div className="bg-gray-50 rounded-md p-3">
            <p className="text-sm text-gray-600">
              {analysisTypes.find(t => t.id === analysisType)?.description}
            </p>
          </div>
        )}

        <button
          onClick={handleAnalyze}
          disabled={!analysisType}
          className="w-full bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Run Analysis
        </button>

        <div className="text-xs text-gray-500">
          Analysis will use scraped data from Python scripts
        </div>
      </div>
    </div>
  )
}
