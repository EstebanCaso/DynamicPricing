# Configuración del Autocompletado de Hoteles

## Requisitos Previos

1. **Cuenta de Amadeus**: Necesitas una cuenta en [Amadeus for Developers](https://developers.amadeus.com/)
2. **API Key y Secret**: Obtén tus credenciales de la consola de desarrolladores de Amadeus

## Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto con las siguientes variables:

```bash
# Amadeus API Credentials
AMADEUS_API_KEY=tu_api_key_de_amadeus
AMADEUS_API_SECRET=tu_api_secret_de_amadeus

# Supabase Configuration (si no las tienes ya)
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_clave_anonima_de_supabase
SUPABASE_SERVICE_ROLE_KEY=tu_clave_de_servicio_de_supabase
```

## Funcionalidades Implementadas

### 1. Componente HotelAutocomplete
- **Ubicación automática**: Detecta la ubicación del usuario usando la API de geolocalización del navegador
- **Búsqueda en tiempo real**: Busca hoteles mientras el usuario escribe (mínimo 2 caracteres)
- **Radio de búsqueda**: 30km desde la ubicación del usuario
- **Filtrado inteligente**: Filtra hoteles por nombre mientras escribe
- **Interfaz intuitiva**: Muestra sugerencias con información del hotel y distancia

### 2. API Route para Búsqueda de Hoteles
- **Endpoint**: `/api/hotels/search`
- **Método**: POST
- **Parámetros**:
  - `latitude`: Latitud de la ubicación
  - `longitude`: Longitud de la ubicación
  - `radius`: Radio de búsqueda en km (por defecto 30)
  - `keyword`: Palabra clave para filtrar hoteles

### 3. Integración con Supabase
- **Metadatos del usuario**: La información del hotel seleccionado se guarda en los metadatos del usuario
- **Datos almacenados**:
  - Nombre del hotel
  - ID del hotel
  - Coordenadas (latitud/longitud)
  - Dirección completa
  - Distancia desde la ubicación del usuario

## Uso en el Formulario de Registro

El componente `HotelAutocomplete` se integra automáticamente en el formulario de registro:

1. **Campo de hotel**: Reemplaza el input de texto simple
2. **Búsqueda automática**: Comienza a buscar hoteles cuando el usuario escribe
3. **Selección**: El usuario puede hacer clic en una sugerencia para seleccionar el hotel
4. **Confirmación visual**: Muestra la información del hotel seleccionado
5. **Validación**: El hotel es requerido para completar el registro

## Estructura de Datos del Hotel

```typescript
interface Hotel {
  name: string           // Nombre del hotel
  hotelId: string        // ID único del hotel
  latitude: number       // Latitud
  longitude: number      // Longitud
  address: {
    cityName: string     // Nombre de la ciudad
    countryCode: string  // Código del país
    postalCode?: string  // Código postal (opcional)
    street?: string      // Calle (opcional)
  }
  distance?: number      // Distancia en km desde la ubicación del usuario
}
```

## Flujo de Funcionamiento

1. **Inicialización**: El componente obtiene la ubicación del usuario
2. **Búsqueda**: Cuando el usuario escribe, se envía una petición a la API de Amadeus
3. **Filtrado**: Los resultados se filtran por nombre y distancia
4. **Presentación**: Se muestran las sugerencias con información relevante
5. **Selección**: El usuario selecciona un hotel de la lista
6. **Almacenamiento**: La información del hotel se guarda en los metadatos del usuario

## Consideraciones de Rendimiento

- **Debounce**: La búsqueda se ejecuta solo después de que el usuario deje de escribir
- **Caché**: Los resultados se almacenan localmente para evitar búsquedas repetidas
- **Límites**: Radio máximo de 30km para optimizar los resultados
- **Filtrado**: Búsqueda por palabra clave para reducir resultados innecesarios

## Solución de Problemas

### Error de Geolocalización
Si el navegador no puede obtener la ubicación del usuario, se usa una ubicación por defecto (Madrid, España).

### Error de API de Amadeus
Verifica que las credenciales de la API estén correctamente configuradas en el archivo `.env`.

### Sin Resultados
- Asegúrate de que la ubicación del usuario sea correcta
- Verifica que haya hoteles en el radio de 30km
- Comprueba que la palabra clave de búsqueda sea válida

## Personalización

Puedes personalizar el componente modificando:

- **Radio de búsqueda**: Cambia el valor por defecto de 30km
- **Estilos**: Modifica las clases de Tailwind CSS
- **Ubicación por defecto**: Cambia las coordenadas de fallback
- **Filtros adicionales**: Agrega más criterios de búsqueda
