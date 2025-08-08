'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">A</span>
              </div>
              <span className="text-xl font-bold text-gray-900">Arkus Dynamic Pricing</span>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link href="/dashboard" className="text-gray-700 hover:text-primary-600 transition-colors">
              Dashboard
            </Link>
            <Link href="/dashboard?tab=analysis" className="text-gray-700 hover:text-primary-600 transition-colors">
              Analysis
            </Link>
            <Link href="/scraping" className="text-gray-700 hover:text-primary-600 transition-colors">
              Scraping Tools
            </Link>
            <Link href="/pricing" className="text-gray-700 hover:text-primary-600 transition-colors">
              Pricing Analysis
            </Link>
            <Link href="/reports" className="text-gray-700 hover:text-primary-600 transition-colors">
              Reports
            </Link>
          </nav>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-700 hover:text-primary-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 border-t border-gray-200">
            <nav className="flex flex-col space-y-4">
              <Link href="/dashboard" className="text-gray-700 hover:text-primary-600 transition-colors">
                Dashboard
              </Link>
              <Link href="/dashboard?tab=analysis" className="text-gray-700 hover:text-primary-600 transition-colors">
                Analysis
              </Link>
              <Link href="/scraping" className="text-gray-700 hover:text-primary-600 transition-colors">
                Scraping Tools
              </Link>
              <Link href="/pricing" className="text-gray-700 hover:text-primary-600 transition-colors">
                Pricing Analysis
              </Link>
              <Link href="/reports" className="text-gray-700 hover:text-primary-600 transition-colors">
                Reports
              </Link>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
