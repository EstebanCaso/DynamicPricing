'use client'

import { useState } from 'react'

export default function ScrapingCard() {
  const [isRunning, setIsRunning] = useState(false)
  const [selectedScript, setSelectedScript] = useState('')

  const scripts = [
    { id: 'songkick-scraper', name: 'Songkick Scraper', description: 'Scrape data from Songkick' },
    { id: 'eventos-scraper', name: 'Eventos Scraper', description: 'Scrape event data' },
    { id: 'hotel-scraper', name: 'Hotel Scraper', description: 'Scrape hotel information' },
    { id: 'hotels-parallel', name: 'Hotels Parallel', description: 'Parallel hotel scraping' },
    { id: 'geo-scraper', name: 'Geo Scraper', description: 'Geographic data scraping' },
    { id: 'amadeus-hotels', name: 'Amadeus Hotels', description: 'Amadeus hotel data' },
  ]

  const handleRunScript = async () => {
    if (!selectedScript) return
    
    setIsRunning(true)
    try {
      // This will be connected to your Python scripts
      const response = await fetch('/api/python/run-script', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ script: selectedScript }),
      })
      
      const result = await response.json()
      console.log('Script result:', result)
    } catch (error) {
      console.error('Error running script:', error)
    } finally {
      setIsRunning(false)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Python Scraping Tools</h3>
        <div className="p-2 bg-primary-100 rounded-lg">
          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="script-select" className="block text-sm font-medium text-gray-700 mb-2">
            Select Script
          </label>
          <select
            id="script-select"
            value={selectedScript}
            onChange={(e) => setSelectedScript(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Choose a script...</option>
            {scripts.map((script) => (
              <option key={script.id} value={script.id}>
                {script.name}
              </option>
            ))}
          </select>
        </div>

        {selectedScript && (
          <div className="bg-gray-50 rounded-md p-3">
            <p className="text-sm text-gray-600">
              {scripts.find(s => s.id === selectedScript)?.description}
            </p>
          </div>
        )}

        <button
          onClick={handleRunScript}
          disabled={!selectedScript || isRunning}
          className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isRunning ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Running...
            </div>
          ) : (
            'Run Script'
          )}
        </button>

        <div className="text-xs text-gray-500">
          Scripts will be executed via Python integration
        </div>
      </div>
    </div>
  )
}
