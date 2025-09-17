'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [displayText, setDisplayText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const router = useRouter()

  const fullText = "Welcome to\nArkus Dynamic\nPricing."

  useEffect(() => {
    if (currentIndex < fullText.length) {
      const timeout = setTimeout(() => {
        const nextChar = fullText[currentIndex]
        setDisplayText(prev => prev + nextChar)
        setCurrentIndex(prev => prev + 1)
      }, 75) // Velocidad de escritura (100ms por carácter)

      return () => clearTimeout(timeout)
    }
  }, [currentIndex, fullText])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        alert(error.message)
        setIsLoading(false)
        return
      }
      // Force a user/session fetch to ensure cookies are set before redirect
      await supabase.auth.getSession()
      const redirect = new URLSearchParams(window.location.search).get('redirectTo') || '/dashboard'
      router.replace(redirect)
    } catch {
      alert('Login failed')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left Section - Red Background with Image */}
      <div className="w-1/2 relative">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: 'url(/assets/images/loginsignupimg.png)' }}
        ></div>
        {/* Red Overlay with 90% opacity */}
        <div className="absolute inset-0 bg-red-600 bg-opacity-90"></div>
        
        {/* Welcome Text - Centered with Typewriter Effect */}
        <div className="relative z-10 h-full flex items-center justify-center">
          <div className="text-left max-w-lg">
            <h1 className="text-6xl font-bold text-white leading-tight whitespace-pre-line">
              {displayText}
              <span className="animate-pulse">|</span>
            </h1>
          </div>
        </div>
      </div>

      {/* Right Section - Login Form */}
      <div className="w-1/2 bg-white flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4">
              <Image
                src="/assets/logos/logo.png"
                alt="Arkus Dynamic Pricing Logo"
                width={64}
                height={64}
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                placeholder="Email"
                required
              />
            </div>

            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                placeholder="Password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-red-600 text-white py-3 px-4 rounded-lg font-bold hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Signing in...
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Sign up link */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              You don&apos;t have an account?{' '}
              <Link href="/signup" className="text-red-600 underline font-medium hover:text-red-700">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
