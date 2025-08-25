'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'
import HotelAutocomplete from '@/components/HotelAutocomplete'
import { Hotel } from '@/types/hotel'

// Función de utilidad para formatear la distancia de manera segura
const formatDistance = (distance: any): string => {
  if (typeof distance === 'number' && !isNaN(distance) && distance > 0) {
    return ` (${distance.toFixed(1)} km)`
  }
  return ''
}

export default function SignupPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    hotel: ''
  })
  const [selectedHotel, setSelectedHotel] = useState<Hotel | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [displayText, setDisplayText] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const router = useRouter()

  const fullText = "Join to \nArkus Dynamic \nPricing."

  useEffect(() => {
    if (currentIndex < fullText.length) {
      const timeout = setTimeout(() => {
        const nextChar = fullText[currentIndex]
        setDisplayText(prev => prev + nextChar)
        setCurrentIndex(prev => prev + 1)
      }, 75) // Velocidad de escritura (75ms por carácter)

      return () => clearTimeout(timeout)
    }
  }, [currentIndex, fullText])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })
  }

  const handleHotelSelect = (hotel: Hotel) => {
    setSelectedHotel(hotel)
    setFormData({
      ...formData,
      hotel: hotel.name
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const { email, password, name, phone } = formData
      
      // Crear el usuario
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          data: {
            name,
            phone,
            hotel_info: selectedHotel ? {
              name: selectedHotel.name,
              hotelId: selectedHotel.hotelId,
              latitude: selectedHotel.latitude,
              longitude: selectedHotel.longitude,
              address: selectedHotel.address,
              distance: selectedHotel.distance
            } : null
          }
        }
      })
      
      if (error) {
        alert(error.message)
        setIsLoading(false)
        return
      }

      // Si el usuario se creó exitosamente, actualizar los metadatos
      if (data.user) {
        const { error: updateError } = await supabase.auth.updateUser({
          data: {
            name,
            phone,
            hotel_info: selectedHotel ? {
              name: selectedHotel.name,
              hotelId: selectedHotel.hotelId,
              latitude: selectedHotel.latitude,
              longitude: selectedHotel.longitude,
              address: selectedHotel.address,
              distance: selectedHotel.distance
            } : null
          }
        })

        if (updateError) {
          console.error('Error updating user metadata:', updateError)
        }
      }

      await supabase.auth.getSession()
      // Redirigir a la página de bienvenida para ejecutar los scripts de scraping
      router.replace('/welcome')
    } catch (err) {
      alert('Signup failed')
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

      {/* Right Section - Signup Form */}
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

          {/* Signup Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                placeholder="Name"
                required
              />
            </div>

            <div>
                <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                placeholder="email@example.com"
                required
              />
            </div>

            <div>
                <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                placeholder="+XXXXXXXXXXX"
                required
              />
            </div>

            <div>
              <input
                type="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                placeholder="Password"
                required
              />
            </div>

            <div>
              <HotelAutocomplete
                value={formData.hotel}
                onChange={(value) => setFormData({ ...formData, hotel: value })}
                onHotelSelect={handleHotelSelect}
                placeholder="Write your Hotel Name"
                className="w-full"
              />
                             <p className="mt-1 text-xs text-gray-500">
                 Nearby hotels are automatically loaded. Instant filtering by name.
               </p>
              {selectedHotel && (
                <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="text-sm text-green-800">
                    <strong>Selected Hotel:</strong> {selectedHotel.name}
                    <br />
                                         <span className="text-green-600">
                       {selectedHotel.address.street && `${selectedHotel.address.street}, `}
                       {selectedHotel.address.cityName}, {selectedHotel.address.countryCode}
                       {formatDistance(selectedHotel.distance)}
                     </span>
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-red-600 text-white py-3 px-4 rounded-lg font-bold hover:bg-red-700 focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Creating account...
                </div>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Login link */}
          <div className="mt-6 text-center">
                      <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/login" className="text-red-600 underline font-medium hover:text-red-700">
              Login
            </Link>
          </p>
          </div>
        </div>
      </div>
    </div>
  )
}
