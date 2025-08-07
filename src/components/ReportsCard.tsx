'use client'

import { useState } from 'react'

export default function ReportsCard() {
  const [selectedReport, setSelectedReport] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  const reports = [
    { id: 'daily', name: 'Daily Summary', description: 'Daily pricing and scraping summary' },
    { id: 'weekly', name: 'Weekly Analysis', description: 'Weekly market analysis report' },
    { id: 'monthly', name: 'Monthly Report', description: 'Comprehensive monthly report' },
    { id: 'custom', name: 'Custom Report', description: 'Generate custom report' },
  ]

  const handleGenerateReport = async () => {
    try {
      const response = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reportType: selectedReport,
          dateRange,
        }),
      })
      
      const result = await response.json()
      console.log('Report result:', result)
    } catch (error) {
      console.error('Error generating report:', error)
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Reports & Analytics</h3>
        <div className="p-2 bg-purple-100 rounded-lg">
          <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Report Type
          </label>
          <select
            value={selectedReport}
            onChange={(e) => setSelectedReport(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Choose report type...</option>
            {reports.map((report) => (
              <option key={report.id} value={report.id}>
                {report.name}
              </option>
            ))}
          </select>
        </div>

        {selectedReport === 'custom' && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        )}

        {selectedReport && (
          <div className="bg-gray-50 rounded-md p-3">
            <p className="text-sm text-gray-600">
              {reports.find(r => r.id === selectedReport)?.description}
            </p>
          </div>
        )}

        <button
          onClick={handleGenerateReport}
          disabled={!selectedReport}
          className="w-full bg-purple-600 text-white py-2 px-4 rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Generate Report
        </button>

        <div className="text-xs text-gray-500">
          Reports include data from all scraping activities
        </div>
      </div>
    </div>
  )
}
