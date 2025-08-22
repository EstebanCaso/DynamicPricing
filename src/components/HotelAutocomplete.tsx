'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { Hotel } from '@/types/hotel'

interface HotelAutocompleteProps {
  value: string
  onChange: (value: string) => void
  onHotelSelect: (hotel: Hotel) => void
  placeholder?: string
  className?: string
}

// Función de utilidad para formatear la distancia de manera segura
const formatDistance = (distance: any): string => {
  if (typeof distance === 'number' && !isNaN(distance) && distance > 0) {
    return ` (${distance.toFixed(1)} km)`
  }
  return ''
}

export default function HotelAutocomplete({
  value,
  onChange,
  onHotelSelect,
  placeholder = "Search hotel...",
  className = ""
}: HotelAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<Hotel[]>([])
  const [allHotels, setAllHotels] = useState<Hotel[]>([]) // Todos los hoteles cargados
  const [isLoading, setIsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  // Obtener ubicación del usuario al montar el componente
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          }
          setUserLocation(location)
          // Hacer búsqueda inicial automática
          searchHotelsInitial(location)
        },
        (error) => {
          console.error('Error getting location:', error)
          // Fallback a una ubicación por defecto (ej: Madrid)
          const fallbackLocation = { lat: 40.4168, lng: -3.7038 }
          setUserLocation(fallbackLocation)
          // Hacer búsqueda inicial con ubicación por defecto
          searchHotelsInitial(fallbackLocation)
        }
      )
    } else {
      // Fallback a una ubicación por defecto
      const fallbackLocation = { lat: 40.4168, lng: -3.7038 }
      setUserLocation(fallbackLocation)
      // Hacer búsqueda inicial con ubicación por defecto
      searchHotelsInitial(fallbackLocation)
    }
  }, [])

  // Cerrar sugerencias al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const searchHotelsInitial = async (location: { lat: number; lng: number }) => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/hotels/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: location.lat,
          longitude: location.lng,
          radius: 30, // 30km como especificaste
          keyword: '' // Sin filtro para obtener todos los hoteles cercanos
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          const hotels = data.hotels || []
          setAllHotels(hotels) // Guardar todos los hoteles
          setSuggestions(hotels) // Mostrar todos inicialmente
        } else {
          console.error('Error from API:', data.error)
          setAllHotels([])
          setSuggestions([])
        }
      } else {
        console.error('Error searching hotels:', response.statusText)
        setAllHotels([])
        setSuggestions([])
      }
    } catch (error) {
      console.error('Error searching hotels:', error)
      setSuggestions([])
    } finally {
      setIsLoading(false)
    }
  }

  // Esta función ya no se usa para filtrado local, pero la mantenemos por si se necesita en el futuro
  const searchHotels = async (query: string) => {
    if (!userLocation || query.length < 2) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch('/api/hotels/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: userLocation.lat,
          longitude: userLocation.lng,
          radius: 30,
          keyword: query
        }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          const hotels = data.hotels || []
          setAllHotels(hotels)
          setSuggestions(hotels)
        }
      }
    } catch (error) {
      console.error('Error searching hotels:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filterHotelsLocally = (query: string) => {
    if (!query || query.length === 0) {
      // Si no hay query, mostrar todos los hoteles
      setSuggestions(allHotels)
      return
    }
    
    if (query.length >= 2) {
      // Filtrar hoteles localmente por nombre
      const filtered = allHotels.filter(hotel => 
        hotel.name.toLowerCase().includes(query.toLowerCase())
      )
      setSuggestions(filtered)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)
    
    // Filtrar localmente sin hacer nuevas peticiones a la API
    filterHotelsLocally(newValue)
    
    // Mostrar sugerencias si hay resultados
    if (newValue.length === 0 || newValue.length >= 2) {
      setShowSuggestions(true)
    } else {
      setShowSuggestions(false)
    }
  }

  const handleHotelSelect = (hotel: Hotel) => {
    onChange(hotel.name)
    onHotelSelect(hotel)
    setShowSuggestions(false)
    setSuggestions([])
  }

  const handleInputFocus = () => {
    // Mostrar sugerencias automáticamente al hacer focus si hay hoteles disponibles
    if (suggestions.length > 0) {
      setShowSuggestions(true)
    }
  }

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
             {!userLocation && (
         <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
           ⚠️ Getting location... If it cannot be detected, a default location will be used.
         </div>
       )}
      
      
      
      <input
        type="text"
        value={value}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        placeholder={userLocation ? (suggestions.length > 0 ? "Type to filter hotels..." : "Loading hotels...") : "Waiting for location..."}
        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
        autoComplete="off"
        disabled={!userLocation}
      />
      
      

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((hotel, index) => (
            <div
              key={`${hotel.hotelId}-${index}`}
              onClick={() => handleHotelSelect(hotel)}
              className="px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"
            >
              <div className="font-medium text-gray-900">{hotel.name}</div>
                             <div className="text-sm text-gray-600">
                 {hotel.address.street && `${hotel.address.street}, `}
                 {hotel.address.cityName}, {hotel.address.countryCode}
                 {formatDistance(hotel.distance)}
               </div>
            </div>
          ))}
        </div>
      )}

      {showSuggestions && suggestions.length === 0 && !isLoading && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg">
                   <div className="px-4 py-3 text-gray-500 text-center">
           {value.length >= 2 ? "No hotels found with that name" : "No hotels available in this area"}
         </div>
        </div>
      )}
    </div>
  )
}
