'use client'

import { useState } from 'react'
import Image from 'next/image'

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState('summary')

  const tabs = [
    { id: 'summary', name: 'Summary' },
    { id: 'calendar', name: 'Calendar' },
    { id: 'competence', name: 'Competence' },
    { id: 'analysis', name: 'Analysis' }
  ]

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#d9d9d9' }}>
      {/* Top Navigation Bar - Floating */}
      <div className="container mx-auto px-6 py-4">
        <div className="bg-white rounded-[25px] shadow-lg border border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <div className="flex items-center">
              <div className="w-8 h-8">
                <Image
                  src="/assets/logos/logo.png"
                  alt="Arkus Dynamic Pricing Logo"
                  width={32}
                  height={32}
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            
            {/* Navigation Tabs - Centered */}
            <div className="flex space-x-9">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </div>

            {/* User Icon */}
            <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-6 py-8">
        <div className="grid grid-cols-2 gap-8">
          {/* Left Column - KPIs and Calendar */}
          <div className="space-y-8">
                         {/* KPI Cards */}
             <div className="grid grid-cols-2 gap-6">
               {/* Performance Index */}
               <div className="bg-white rounded-[25px] p-6 border-l-4 border-orange-500 shadow-sm">
                 <h3 className="text-sm font-medium text-gray-600 mb-2">Performance index</h3>
                 <p className="text-3xl font-bold text-orange-500">60%</p>
               </div>

               {/* Average Rate */}
               <div className="bg-white rounded-[25px] p-6 border-l-4 border-red-500 shadow-sm">
                 <h3 className="text-sm font-medium text-gray-600 mb-2">Average rate</h3>
                 <p className="text-3xl font-bold text-gray-900">$126 dlls</p>
               </div>

               {/* Impact of Events */}
               <div className="bg-white rounded-[25px] p-6 border-l-4 border-green-500 shadow-sm">
                 <h3 className="text-sm font-medium text-gray-600 mb-2">Impact of events</h3>
                 <p className="text-3xl font-bold text-green-500">High</p>
               </div>

               {/* Price Position */}
               <div className="bg-white rounded-[25px] p-6 border-l-4 border-green-500 shadow-sm">
                 <h3 className="text-sm font-medium text-gray-600 mb-2">Price position</h3>
                 <p className="text-3xl font-bold text-green-500">3rd</p>
               </div>
             </div>

             {/* September Calendar */}
             <div className="bg-white rounded-[25px] p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">September</h3>
              <div className="grid grid-cols-7 gap-1">
                {/* Days of Week */}
                <div className="text-center text-sm font-medium text-gray-500 py-2">S</div>
                <div className="text-center text-sm font-medium text-gray-500 py-2">M</div>
                <div className="text-center text-sm font-medium text-gray-500 py-2">T</div>
                <div className="text-center text-sm font-medium text-gray-500 py-2">W</div>
                <div className="text-center text-sm font-medium text-gray-500 py-2">T</div>
                <div className="text-center text-sm font-medium text-gray-500 py-2">F</div>
                <div className="text-center text-sm font-medium text-gray-500 py-2">S</div>
                
                {/* Calendar Days */}
                {Array.from({ length: 30 }, (_, i) => (
                  <div key={i} className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-sm relative">
                    {i + 1}
                    {/* Red dots on specific days */}
                    {(i === 4 || i === 8 || i === 14 || i === 27) && (
                      <div className="absolute bottom-1 w-1 h-1 bg-red-500 rounded-full"></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

                     {/* Right Column - Hotels Table */}
           <div>
             <div className="bg-white rounded-[25px] p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Hotels Comparison</h3>
              <div className="space-y-4">
                {/* Header */}
                <div className="grid grid-cols-3 gap-4 text-base font-medium text-gray-600">
                  <div className="pl-8">Hotels</div>
                  <div className="text-center">Fee</div>
                  <div className="text-center">Diference</div>
                </div>

                {/* Hotels A */}
                <div className="grid grid-cols-3 gap-4 items-center py-3">
                  <div className="flex flex-col space-y-1 pl-8">
                    <span className="text-base">Hotels A</span>
                    <div className="flex space-x-1">
                      {Array.from({ length: 5 }, (_, i) => (
                        <svg key={i} className={`w-4 h-4 ${i < 4 ? 'text-red-500' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2L15.09 8.26L22 9L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9L8.91 8.26L12 2Z"/>
                        </svg>
                      ))}
                    </div>
                  </div>
                  <div className="text-base text-center">$123 dlls</div>
                  <div className="text-base text-green-600 text-center">+$23 dlls</div>
                </div>

                {/* Hotels B */}
                <div className="grid grid-cols-3 gap-4 items-center py-3">
                  <div className="flex flex-col space-y-1 pl-8">
                    <span className="text-base">Hotels B</span>
                    <div className="flex space-x-1">
                      {Array.from({ length: 5 }, (_, i) => (
                        <svg key={i} className={`w-4 h-4 ${i < 3 ? 'text-red-500' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2L15.09 8.26L22 9L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9L8.91 8.26L12 2Z"/>
                        </svg>
                      ))}
                    </div>
                  </div>
                  <div className="text-base text-center">$97 dlls</div>
                  <div className="text-base text-red-600 text-center">-$3 dlls</div>
                </div>

                {/* Hotels (ours) - Highlighted */}
                <div className="flex rounded-2xl overflow-hidden shadow-lg">
                  {/* Left section - White background (2/3) */}
                  <div className="flex-1 bg-white border-2 border-red-600 rounded-l-2xl px-4 py-3 flex items-center relative z-10">
                    <div className="flex flex-col space-y-1 flex-1 pl-8">
                      <span className="text-base font-bold text-gray-900">Hotels (ours)</span>
                      <div className="flex space-x-1">
                        {Array.from({ length: 5 }, (_, i) => (
                          <svg key={i} className={`w-4 h-4 ${i < 4 ? 'text-red-500' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2L15.09 8.26L22 9L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9L8.91 8.26L12 2Z"/>
                          </svg>
                        ))}
                      </div>
                    </div>
                    <div className="text-base font-bold text-red-600 text-center flex-1">$100 dlls</div>
                  </div>
                  
                  {/* Right section - Red background (1/3) */}
                  <div className="w-1/3 bg-red-600 rounded-r-2xl flex items-center justify-center px-4 py-3 relative -ml-2">
                    <span className="text-lg font-bold text-white">3rd</span>
                  </div>
                </div>

                {/* Repeat Hotels B */}
                <div className="grid grid-cols-3 gap-4 items-center py-3">
                  <div className="flex flex-col space-y-1 pl-8">
                    <span className="text-base">Hotels B</span>
                    <div className="flex space-x-1">
                      {Array.from({ length: 5 }, (_, i) => (
                        <svg key={i} className={`w-4 h-4 ${i < 3 ? 'text-red-500' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2L15.09 8.26L22 9L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9L8.91 8.26L12 2Z"/>
                        </svg>
                      ))}
                    </div>
                  </div>
                  <div className="text-base text-center">$97 dlls</div>
                  <div className="text-base text-red-600 text-center">-$3 dlls</div>
                </div>

                {/* Repeat Hotels A */}
                <div className="grid grid-cols-3 gap-4 items-center py-3">
                  <div className="flex flex-col space-y-1 pl-8">
                    <span className="text-base">Hotels A</span>
                    <div className="flex space-x-1">
                      {Array.from({ length: 5 }, (_, i) => (
                        <svg key={i} className={`w-4 h-4 ${i < 4 ? 'text-red-500' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2L15.09 8.26L22 9L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9L8.91 8.26L12 2Z"/>
                        </svg>
                      ))}
                    </div>
                  </div>
                  <div className="text-base text-center">$123 dlls</div>
                  <div className="text-base text-green-600 text-center">+$23 dlls</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
