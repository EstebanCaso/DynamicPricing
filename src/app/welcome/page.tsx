'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { supabase } from '@/lib/supabaseClient'

interface ScrapingProgress {
  hotel: number
}

export default function WelcomePage() {
  const [progress, setProgress] = useState<ScrapingProgress>({
    hotel: 0
  })
  const [status, setStatus] = useState('Iniciando scripts de scraping...')
  const [isComplete, setIsComplete] = useState(false)
  const router = useRouter()
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const runScrapingScripts = async () => {
      try {
        // Obtener datos del usuario actual
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          throw new Error('Usuario no autenticado')
        }

        // Obtener metadatos del usuario + token
        const [{ data: { user: userData } }, { data: sessionData }] = await Promise.all([
          supabase.auth.getUser(),
          supabase.auth.getSession()
        ])
        const hotelInfo = userData?.user_metadata?.hotel_info
        const accessToken = sessionData?.session?.access_token
        
        if (!hotelInfo) {
          throw new Error('Información del hotel no encontrada')
        }

        // No usar Amadeus en el proceso de onboarding

        setStatus('Iniciando scraping de precios de hoteles...')
        
        console.log('Iniciando scraping de hoteles con datos:', {
          hotelName: hotelInfo.name,
          userUuid: user.id
        })
        
        // Ejecutar scraping de hoteles usando nueva API route
        const hotelPromise = fetch('/api/scraping/hotel', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
          },
          body: JSON.stringify({ 
            userData: {
              hotelName: hotelInfo.name,
              userUuid: user.id,
              days: 90,
              concurrency: 5,
              headless: true
            }
          })
        }).then(async (response) => {
          if (!response.ok) throw new Error('Error en scraping de hoteles')
          const result = await response.json()
          console.log('Resultado scraping hoteles:', result)
          return result
        })

        // Ejecutar Songkick usando nueva API route (solo si hay coordenadas)
        const songkickPromise = (hotelInfo.latitude && hotelInfo.longitude) ? fetch('/api/scraping/songkick', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
          },
          body: JSON.stringify({
            userData: {
              latitude: hotelInfo.latitude,
              longitude: hotelInfo.longitude,
              radius: 50,
              userUuid: user.id,
              hotelName: hotelInfo.name
            }
          })
        }).then(async (response) => {
          if (!response.ok) {
            console.warn('⚠️ Error en scraping de Songkick')
            return { success: false }
          }
          const result = await response.json()
          console.log('Resultado scraping Songkick:', result)
          return result
        }) : Promise.resolve({ success: false, skipped: true })

        // Ejecutar Ticketmaster usando nueva API route (solo si hay coordenadas)
        const ticketmasterPromise = (hotelInfo.latitude && hotelInfo.longitude) ? fetch('/api/scraping/ticketmaster', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
          },
          body: JSON.stringify({
            userData: {
              latitude: hotelInfo.latitude,
              longitude: hotelInfo.longitude,
              radius: 10, // 10 km como solicitado
              userUuid: user.id,
              hotelName: hotelInfo.name
            }
          })
        }).then(async (response) => {
          if (!response.ok) {
            console.warn('⚠️ Error en scraping de Ticketmaster')
            return { success: false }
          }
          const result = await response.json()
          console.log('Resultado scraping Ticketmaster:', result)
          return result
        }) : Promise.resolve({ success: false, skipped: true })

        // Simular progreso más realista basado en tiempo estimado para los scripts ejecutados
        const startTime = Date.now()
        const estimatedHotelTime = 540000    // 9 minutos estimados para hoteles
        const estimatedEventsTime = 60000   // 1 minuto estimado para eventos (Songkick + Ticketmaster)
        
        progressIntervalRef.current = setInterval(() => {
          const elapsed = Date.now() - startTime
          
          // Progreso basado en tiempo para hoteles (más lento)
          const hotelProgress = Math.min(Math.round((elapsed / estimatedHotelTime) * 100), 95)
          // Progreso basado en tiempo para eventos (más rápido)
          const eventsProgress = Math.min(Math.round((elapsed / estimatedEventsTime) * 100), 95)
          
          // Progreso general como promedio ponderado (Hotel 80%, Eventos 20%)
          const overallProgress = Math.round((hotelProgress * 0.8) + (eventsProgress * 0.2))
          
          // Actualizar mensajes de estado basados en el progreso
          if (overallProgress < 20) {
            setStatus('Initializing hotel search and scraping...')
          } else if (overallProgress < 40) {
            setStatus('Searching for competitor hotels...')
          } else if (overallProgress < 60) {
            setStatus('Collecting hotel prices...')
          } else if (overallProgress < 80) {
            setStatus('Analyzing price data...')
          } else if (overallProgress < 95) {
            setStatus('Processing and organizing information...')
          }
          
          setProgress({
            hotel: overallProgress
            
          })
        }, 1000)

        // Esperar a que todos los scripts terminen
        await Promise.all([
          hotelPromise,
          songkickPromise,
          ticketmasterPromise
        ])

        // Limpiar el intervalo de progreso
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
          progressIntervalRef.current = null
        }
        
        console.log('Scripts completados, actualizando progreso final...')
        
        // Completar progreso
        setProgress({
          hotel: 100
        })

        setStatus('¡Scraping completado exitosamente!')
        setIsComplete(true)

        console.log('Redirigiendo al dashboard en 2 segundos...')
        
        // Redirigir al dashboard después de 2 segundos
        setTimeout(() => {
          console.log('Ejecutando redirección al dashboard...')
          router.replace('/dashboard')
        }, 2000)

      } catch (error) {
        console.error('Error ejecutando scripts:', error)
        
        // Limpiar el intervalo de progreso en caso de error
        if (progressIntervalRef.current) {
          clearInterval(progressIntervalRef.current)
          progressIntervalRef.current = null
        }
        
        setStatus(`Error en la ejecución: ${error instanceof Error ? error.message : 'Error desconocido'}. Redirigiendo...`)
        
        console.log('Error detectado, redirigiendo al dashboard en 3 segundos...')
        
        // Redirigir al dashboard incluso si hay error
        setTimeout(() => {
          console.log('Ejecutando redirección por error...')
          router.replace('/dashboard')
        }, 3000)
      }
    }

    runScrapingScripts()
    
    // Cleanup function para limpiar el intervalo si el componente se desmonta
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current)
      }
    }
  }, [router])

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
        
        {/* Welcome Text - Centered */}
        <div className="relative z-10 h-full flex items-center justify-center">
          <div className="text-left max-w-lg">
            <h1 className="text-6xl font-bold text-white leading-tight">
              Welcome to<br />
              Arkus Dynamic<br />
              Pricing!
            </h1>
            <p className="text-xl text-white mt-6 opacity-90">
              We are preparing your personalized experience...
            </p>
          </div>
        </div>
      </div>

      {/* Right Section - Progress */}
      <div className="w-1/2 bg-white flex items-center justify-center p-8">
        <div className="w-full max-w-lg">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4">
              <Image
                src="/assets/logos/logo.png"
                alt="Arkus Dynamic Pricing Logo"
                width={80}
                height={80}
                className="w-full h-full object-contain"
              />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Configuring your account
            </h2>
            <p className="text-gray-600">
              {status}
            </p>
          </div>

          {/* Progress Bars */}
          <div className="space-y-6">
            {/* Hotel Scraping Progress */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Setting everything up...</span>
                <span className="text-sm font-medium text-red-600">{progress.hotel}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-red-600 h-3 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progress.hotel}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Status Messages */}
          <div className="mt-8 text-center">
            {isComplete ? (
              <div className="text-green-600 font-medium">
                <div className="flex items-center justify-center mb-2">
                  <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Configuration completed!
                </div>
                <p className="text-sm text-gray-600">Redirecting to dashboard...</p>
              </div>
            ) : (
              <div className="text-gray-600">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-red-600 mx-auto mb-2"></div>
                <p className="text-sm">Processing data...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
