import os
import sys
import requests
import json
from dotenv import load_dotenv

load_dotenv()

AMADEUS_CLIENT_ID = os.getenv("AMADEUS_API_KEY")
AMADEUS_CLIENT_SECRET = os.getenv("AMADEUS_API_SECRET")

if not AMADEUS_CLIENT_ID or not AMADEUS_CLIENT_SECRET:
    print(json.dumps({"error": "Faltan las variables de entorno AMADEUS_CLIENT_ID o AMADEUS_CLIENT_SECRET"}))
    sys.exit(1)

def get_access_token():
    url = "https://test.api.amadeus.com/v1/security/oauth2/token"
    headers = {"Content-Type": "application/x-www-form-urlencoded"}
    data = {
        "grant_type": "client_credentials",
        "client_id": AMADEUS_CLIENT_ID,
        "client_secret": AMADEUS_CLIENT_SECRET
    }
    res = requests.post(url, headers=headers, data=data)
    if res.status_code != 200:
        print(json.dumps({"error": f"Error obteniendo token: {res.text}"}))
        sys.exit(1)
    return res.json().get("access_token")

def get_hotels_by_geocode(lat, lng, token=None, radius=30, keyword=None):
    url = f"https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-geocode"
    headers = {"Authorization": f"Bearer {token}"}
    params = {
        "latitude": lat,
        "longitude": lng,
        "radius": radius
    }
    res = requests.get(url, headers=headers, params=params)
    if res.status_code != 200:
        raise Exception(f"Error en la consulta de hoteles: {res.text}")
    data = res.json()
    if "data" not in data:
        raise Exception(f"Respuesta inesperada de Amadeus: {data}")
    hotels = data["data"]
    
    # Filtrar por palabra clave si se proporciona
    if keyword:
        hotels = [h for h in hotels if keyword.lower() in h.get("name", "").lower()]
    
    # Limitar resultados para evitar sobrecarga
    hotels = hotels[:50]
    
    # Agregar información de distancia si no está presente
    for hotel in hotels:
        if "geoCode" in hotel and "latitude" in hotel["geoCode"] and "longitude" in hotel["geoCode"]:
            # Calcular distancia aproximada si no está presente
            if "distance" not in hotel:
                distance = calculate_distance(
                    lat, lng, 
                    hotel["geoCode"]["latitude"], 
                    hotel["geoCode"]["longitude"]
                )
                # Solo asignar si la distancia es válida
                if distance > 0:
                    hotel["distance"] = distance
                else:
                    hotel["distance"] = 0.0
    
    return hotels

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calcula la distancia aproximada entre dos puntos usando la fórmula de Haversine"""
    import math
    
    try:
        # Validar que las coordenadas sean números válidos
        if not all(isinstance(coord, (int, float)) for coord in [lat1, lon1, lat2, lon2]):
            return 0.0
        
        # Convertir grados a radianes
        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
        
        # Diferencia de coordenadas
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        
        # Fórmula de Haversine
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        
        # Radio de la Tierra en kilómetros
        r = 6371
        
        distance = c * r
        
        # Asegurar que la distancia sea un número válido
        if math.isnan(distance) or math.isinf(distance):
            return 0.0
            
        return round(distance, 1)  # Redondear a 1 decimal
        
    except (ValueError, TypeError, ZeroDivisionError):
        return 0.0

# CLI Mode
if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Buscar hoteles con Amadeus API")
    parser.add_argument("--lat", required=True, help="Latitud")
    parser.add_argument("--lng", required=True, help="Longitud")
    parser.add_argument("--radius", required=False, default=20, type=int, help="Radio de búsqueda (km)")
    parser.add_argument("--keyword", required=False, help="Filtrar por nombre de hotel")
    args = parser.parse_args()
    try:
        token = get_access_token()
        hotels = get_hotels_by_geocode(args.lat, args.lng, token, args.radius, args.keyword)
        print(json.dumps(hotels, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"error": str(e)}))
        sys.exit(1)
