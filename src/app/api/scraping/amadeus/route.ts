import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4, validate as uuidValidate } from 'uuid'

// Ensure this route runs on the Node.js runtime
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// --- Configuración Amadeus ---
const AMADEUS_CLIENT_ID = process.env.AMADEUS_API_KEY;
const AMADEUS_CLIENT_SECRET = process.env.AMADEUS_API_SECRET;

// Variable global para controlar si Amadeus está disponible
const AMADEUS_AVAILABLE = !!(AMADEUS_CLIENT_ID && AMADEUS_CLIENT_SECRET);

if (!AMADEUS_AVAILABLE) {
  console.error('❌ Faltan las variables de entorno AMADEUS_API_KEY o AMADEUS_API_SECRET');
  console.log('⚠️ Continuando sin búsqueda de hoteles competidores...');
}

// --- Función para obtener token de acceso ---
async function getAccessToken() {
  const url = "https://test.api.amadeus.com/v1/security/oauth2/token";
  const headers = { "Content-Type": "application/x-www-form-urlencoded" };
  const data = new URLSearchParams({
    "grant_type": "client_credentials",
    "client_id": AMADEUS_CLIENT_ID!,
    "client_secret": AMADEUS_CLIENT_SECRET!
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: data
    });

    if (!response.ok) {
      throw new Error(`Error obteniendo token: ${await response.text()}`);
    }

    const result = await response.json();
    return result.access_token;
  } catch (error) {
    console.error('❌ Error obteniendo token:', (error as Error).message);
    throw error;
  }
}

// --- Función para calcular distancia ---
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  try {
    // Validar que las coordenadas sean números válidos
    if (![lat1, lon1, lat2, lon2].every(coord => typeof coord === 'number' && !isNaN(coord))) {
      return 0.0;
    }

    // Convertir grados a radianes
    const toRadians = (degrees: number) => degrees * (Math.PI / 180);
    const lat1Rad = toRadians(lat1);
    const lon1Rad = toRadians(lon1);
    const lat2Rad = toRadians(lat2);
    const lon2Rad = toRadians(lon2);

    // Diferencia de coordenadas
    const dlat = lat2Rad - lat1Rad;
    const dlon = lon2Rad - lon1Rad;

    // Fórmula de Haversine
    const a = Math.sin(dlat/2)**2 + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dlon/2)**2;
    const c = 2 * Math.asin(Math.sqrt(a));

    // Radio de la Tierra en kilómetros
    const r = 6371;

    const distance = c * r;

    // Asegurar que la distancia sea un número válido
    if (isNaN(distance) || !isFinite(distance)) {
      return 0.0;
    }

    return Math.round(distance * 10) / 10; // Redondear a 1 decimal
  } catch (error) {
    return 0.0;
  }
}

// --- Función para obtener hoteles por geocódigo ---
async function getHotelsByGeocode(lat: number, lng: number, token: string | null = null, radius = 30, keyword: string | null = null) {
  // Si Amadeus no está disponible, devolver array vacío
  if (!AMADEUS_AVAILABLE) {
    return [];
  }
  
  const accessToken = token || await getAccessToken();
  const url = "https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-geocode";
  
  const params = new URLSearchParams({
    latitude: lat.toString(),
    longitude: lng.toString(),
    radius: radius.toString()
  });

  try {
    const response = await fetch(`${url}?${params}`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Error en la consulta de hoteles: ${await response.text()}`);
    }

    const data = await response.json();
    
    if (!data.data) {
      throw new Error(`Respuesta inesperada de Amadeus: ${JSON.stringify(data)}`);
    }

    let hotels = data.data;

    // Filtrar por palabra clave si se proporciona
    if (keyword) {
      hotels = hotels.filter((hotel: any) => 
        hotel.name && hotel.name.toLowerCase().includes(keyword.toLowerCase())
      );
    }

    // Limitar resultados para evitar sobrecarga
    hotels = hotels.slice(0, 50);

    // Agregar información de distancia si no está presente
    for (const hotel of hotels) {
      if (hotel.geoCode && hotel.geoCode.latitude && hotel.geoCode.longitude) {
        // Calcular distancia aproximada si no está presente
        if (!hotel.distance) {
          const distance = calculateDistance(
            lat, lng,
            hotel.geoCode.latitude,
            hotel.geoCode.longitude
          );
          // Solo asignar si la distancia es válida
          if (distance > 0) {
            hotel.distance = distance;
          } else {
            hotel.distance = 0.0;
          }
        }
      }
    }

    return hotels;
  } catch (error) {
    console.error('❌ Error obteniendo hoteles:', (error as Error).message);
    throw error;
  }
}

// --- Función para guardar hoteles en Supabase ---
async function saveHotelsToSupabase(hotels: any[], userId: string) {
  if (!uuidValidate(userId)) {
    console.error("❌ user_id inválido");
    return;
  }

  // Importar Supabase solo si está disponible
  let supabase = null;
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
    
    if (SUPABASE_URL && SUPABASE_KEY) {
      supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    }
  } catch (error) {
    console.log('⚠️ Supabase no disponible, saltando guardado en base de datos');
  }

  if (!supabase) {
    console.log('⚠️ Supabase no configurado. Saltando guardado en base de datos.');
    return;
  }

  let totalInserted = 0;
  const today = new Date().toISOString().split('T')[0];

  for (const hotel of hotels) {
    try {
      // Try primary table first
      let { error } = await supabase
        .from('hotels_parallel')
        .upsert([
          {
            id: uuidv4(),
            nombre: hotel.name || 'Hotel sin nombre',
            estrellas: hotel.rating || null,
            ubicacion: hotel.address
              ? {
                  cityName: hotel.address.cityName,
                  countryCode: hotel.address.countryCode,
                  postalCode: hotel.address.postalCode,
                  street: hotel.address.lines?.[0] || ''
                }
              : null,
            url: hotel.hotelId ? `https://www.booking.com/hotel/${hotel.hotelId}.html` : null,
            fecha_scrape: today,
            rooms_jsonb: {},
            created_at: new Date().toISOString(),
            ciudad: hotel.address?.cityName || 'Ciudad desconocida',
            distancia: hotel.distance || 0.0
          }
        ], { onConflict: 'nombre,ciudad' })

      // Fallback to legacy table if needed
      if (error) {
        ;({ error } = await supabase
          .from('hoteles_parallel')
          .upsert([
            {
              id: uuidv4(),
              nombre: hotel.name || 'Hotel sin nombre',
              estrellas: hotel.rating || null,
              ubicacion: hotel.address
                ? {
                    cityName: hotel.address.cityName,
                    countryCode: hotel.address.countryCode,
                    postalCode: hotel.address.postalCode,
                    street: hotel.address.lines?.[0] || ''
                  }
                : null,
              url: hotel.hotelId ? `https://www.booking.com/hotel/${hotel.hotelId}.html` : null,
              fecha_scrape: today,
              rooms_jsonb: {},
              created_at: new Date().toISOString(),
              ciudad: hotel.address?.cityName || 'Ciudad desconocida',
              distancia: hotel.distance || 0.0
            }
          ], { onConflict: 'nombre,ciudad' }))
      }

      if (error) {
        console.error("❌ Error guardando hotel:", error.message);
      } else {
        totalInserted++;
        console.log(`✅ ${hotel.name} - ${hotel.address?.cityName || 'N/A'}`);
      }
    } catch (error) {
      console.error(`❌ Error procesando hotel ${hotel.name}:`, (error as Error).message);
    }
  }

  console.log(`📊 Total procesados: ${totalInserted} hoteles`);
}

export async function POST(request: NextRequest) {
  try {
    const { userData } = await request.json()
    const { latitude, longitude, radius = 30, keyword = null, userUuid, saveToDb = false } = userData || {}

    if (!latitude || !longitude) {
      return NextResponse.json({ error: 'Missing latitude/longitude' }, { status: 400 })
    }

    console.log('[amadeus-api] Starting scraping with params:', { latitude, longitude, radius, keyword, userUuid, saveToDb })

    try {
      console.log('[amadeus-api] Searching for hotels...');
      
      const hotels = await getHotelsByGeocode(latitude, longitude, null, radius, keyword);
      
      console.log(`[amadeus-api] Found ${hotels.length} hotels`);

      if (saveToDb && userUuid) {
        console.log('[amadeus-api] Saving hotels to database...');
        await saveHotelsToSupabase(hotels, userUuid);
      }

      return NextResponse.json({
        success: true,
        message: 'Amadeus hotel search completed successfully',
        data: hotels,
        count: hotels.length
      })

    } catch (error) {
      console.error('[amadeus-api] Error:', (error as Error).message);
      return NextResponse.json({
        success: false,
        message: 'Amadeus hotel search failed',
        error: (error as Error).message
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('Error in amadeus-api:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
