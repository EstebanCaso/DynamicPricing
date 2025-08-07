import os
import sys
import json
from dotenv import load_dotenv
from datetime import datetime, timedelta
from scrapeo_geo import EventsFetcher, get_hotel_coordinates
from pathlib import Path
import requests
import subprocess
import re
import time

# Cargar .env desde la raíz del proyecto
load_dotenv(dotenv_path=Path(__file__).parent.parent / '.env')

API_KEY = os.getenv('TICKETMASTER_API_KEY')
if not API_KEY:
    print("ERROR: TICKETMASTER_API_KEY no encontrada en variables de entorno", file=sys.stderr)
    print(json.dumps({"mx": [], "us": []}))
    sys.exit(1)

print("sys.argv:", sys.argv, file=sys.stderr)

def is_float(val):
    try:
        float(val)
        return True
    except:
        return False

# Configuración de timeouts
SUBPROCESS_TIMEOUT = 300  # 5 minutos para subprocess
REQUEST_TIMEOUT = 30  # 30 segundos para requests

# Argumentos esperados:
#   lat lon radio user_uuid  (preferido)
#   hotel_name radio user_uuid (legacy)
try:
    if len(sys.argv) == 5 and is_float(sys.argv[1]) and is_float(sys.argv[2]):
        lat = float(sys.argv[1])
        lon = float(sys.argv[2])
        radius_km = int(sys.argv[3])
        user_uuid = sys.argv[4]
        hotel_name = "Hotel"  # Valor por defecto
    elif len(sys.argv) == 4:
        hotel_name = sys.argv[1]
        radius_km = int(sys.argv[2])
        user_uuid = sys.argv[3]
        lat, lon = get_hotel_coordinates(hotel_name)
    else:
        print("ERROR: Argumentos incorrectos. Debes proporcionar: lat lon radio user_uuid o hotel_name radio user_uuid", file=sys.stderr)
        print(json.dumps({"mx": [], "us": []}))
        sys.exit(1)
except (ValueError, IndexError) as e:
    print(f"ERROR: Error procesando argumentos: {e}", file=sys.stderr)
    print(json.dumps({"mx": [], "us": []}))
    sys.exit(1)

print(f"Hotel seleccionado: {hotel_name}", file=sys.stderr)
print(f"Coordenadas: {lat}, {lon}", file=sys.stderr)
print(f"UUID de usuario: {user_uuid}", file=sys.stderr)

# Parámetros fijos para Ticketmaster
DIAS = 90
LIMITE = 40
TIPO_EVENTO = "concert"

# Inicializar eventos como listas vacías
eventos_us = []
eventos_mx = []

# Buscar eventos en Ticketmaster (solo conciertos)
try:
    print("Iniciando búsqueda de eventos en Ticketmaster...", file=sys.stderr)
    fetcher = EventsFetcher(api_key=API_KEY)
    
    # Buscar eventos en Ticketmaster con timeout
    eventos_us_raw = fetcher.get_events(
        days_ahead=DIAS,
        limit=LIMITE,
        latitude=lat,
        longitude=lon,
        radius=radius_km,
        country_code="US"
    )
    # Mostrar todos los eventos sin filtrar por género
    eventos_us = eventos_us_raw
    print(f"Eventos de Ticketmaster encontrados: {len(eventos_us)}", file=sys.stderr)
    
except Exception as e:
    print(f"ERROR: Error obteniendo eventos de Ticketmaster: {e}", file=sys.stderr)
    eventos_us = []

# Llamar a scrape_songkick.py para eventos de Songkick (Tijuana)
try:
    print("Ejecutando scraping de Songkick...", file=sys.stderr)
    
    # Configurar timeout para subprocess
    result = subprocess.run([
        'python', 'python_scripts/scrape_songkick.py',
        str(lat), str(lon), str(radius_km)
    ], capture_output=True, text=True, check=False, encoding='utf-8', errors='replace', timeout=SUBPROCESS_TIMEOUT)
    
    print(f"Songkick return code: {result.returncode}", file=sys.stderr)
    print(f"Songkick stdout length: {len(result.stdout)}", file=sys.stderr)
    print(f"Songkick stderr: {result.stderr}", file=sys.stderr)
    
    # Debug: mostrar los primeros y últimos caracteres del stdout
    if result.stdout.strip():
        stdout_preview = result.stdout.strip()
        print(f"Songkick stdout preview (primeros 100 chars): {stdout_preview[:100]}", file=sys.stderr)
        print(f"Songkick stdout preview (últimos 100 chars): {stdout_preview[-100:] if len(stdout_preview) > 100 else stdout_preview}", file=sys.stderr)
        print(f"Songkick stdout starts with '[': {stdout_preview.startswith('[')}", file=sys.stderr)
        print(f"Songkick stdout ends with ']': {stdout_preview.endswith(']')}", file=sys.stderr)
    
    if result.returncode == 0 and result.stdout.strip():
        try:
            # Limpiar el stdout antes de parsear
            stdout_clean = result.stdout.strip()
            
            # Intentar parsear directamente
            try:
                eventos_mx = json.loads(stdout_clean)
                print(f"Eventos de Songkick parseados exitosamente: {len(eventos_mx)}", file=sys.stderr)
            except json.JSONDecodeError as e:
                print(f"ERROR: Error parseando JSON de Songkick: {e}", file=sys.stderr)
                print(f"Raw output: {result.stdout[:200]}...", file=sys.stderr)
                
                # Intentar limpiar el JSON si hay caracteres extra
                try:
                    # Buscar el inicio del JSON (primer '[')
                    start_idx = stdout_clean.find('[')
                    end_idx = stdout_clean.rfind(']')
                    
                    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
                        json_str = stdout_clean[start_idx:end_idx + 1]
                        eventos_mx = json.loads(json_str)
                        print(f"Eventos de Songkick parseados después de limpieza: {len(eventos_mx)}", file=sys.stderr)
                    else:
                        print("No se encontró estructura JSON válida en la salida", file=sys.stderr)
                        eventos_mx = []
                        
                except json.JSONDecodeError as e2:
                    print(f"ERROR: Falló también la limpieza del JSON: {e2}", file=sys.stderr)
                    print(f"JSON limpio intentado: {json_str[:200] if 'json_str' in locals() else 'N/A'}...", file=sys.stderr)
                    eventos_mx = []
                except Exception as e3:
                    print(f"ERROR: Error inesperado en limpieza de JSON: {e3}", file=sys.stderr)
                    eventos_mx = []
        except Exception as e:
            print(f"ERROR: Error general parseando JSON de Songkick: {e}", file=sys.stderr)
            eventos_mx = []
    else:
        print("Songkick returned empty output or error", file=sys.stderr)
        eventos_mx = []
        
except subprocess.TimeoutExpired:
    print(f"ERROR: Timeout ejecutando scrape_songkick.py después de {SUBPROCESS_TIMEOUT} segundos", file=sys.stderr)
    eventos_mx = []
except subprocess.CalledProcessError as e:
    print(f"ERROR: Error ejecutando scrape_songkick.py (CalledProcessError): {e}", file=sys.stderr)
    print(f"Return code: {e.returncode}", file=sys.stderr)
    print(f"stdout: {e.stdout}", file=sys.stderr)
    print(f"stderr: {e.stderr}", file=sys.stderr)
    eventos_mx = []
except Exception as e:
    print(f"ERROR: Error ejecutando scrape_songkick.py: {e}", file=sys.stderr)
    eventos_mx = []

print(f"\n=== EVENTOS EN MEXICO (Songkick) ===\n", file=sys.stderr)
for evento in eventos_mx:
    print(f"Evento: {evento['nombre']}", file=sys.stderr)
    print(f"Fecha: {evento['fecha']}", file=sys.stderr)
    print(f"Lugar: {evento['lugar']}", file=sys.stderr)
    print(f"URL: {evento['enlace']}", file=sys.stderr)
    print("---", file=sys.stderr)

print(f"\n=== EVENTOS EN ESTADOS UNIDOS (Ticketmaster) ===\n", file=sys.stderr)
for evento in eventos_us:
    print(f"Evento: {evento['name']}", file=sys.stderr)
    print(f"Fecha: {evento['date']}", file=sys.stderr)
    print(f"Lugar: {evento['venue']}", file=sys.stderr)
    print(f"Precio: {evento.get('price_range', '')}", file=sys.stderr)
    print(f"URL: {evento['url']}", file=sys.stderr)
    print("---", file=sys.stderr)

# Guardar resultados en un archivo para el backend/UI
print(f"eventos_mx: {len(eventos_mx)} eventos", file=sys.stderr)
print(f"eventos_us: {len(eventos_us)} eventos", file=sys.stderr)

try:
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "resultados")
    os.makedirs(output_dir, exist_ok=True)
    output_file = os.path.join(output_dir, "eventos_cercanos.json")
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump({"mx": eventos_mx, "us": eventos_us}, f, ensure_ascii=False, indent=2)
    
    print(f"Guardando eventos en: {output_file}", file=sys.stderr)
    print(f"{len(eventos_mx)} eventos en MX y {len(eventos_us)} en US guardados en {output_file}", file=sys.stderr)
    
except Exception as e:
    print(f"ERROR: Error guardando archivo de eventos: {e}", file=sys.stderr)

                        # -----SUPABASE----- #
                        # -----SUPABASE----- #
                        # -----SUPABASE----- #
                        # -----SUPABASE----- #

# Subir eventos a Supabase (MX y US) - SIEMPRE al final, aunque uno de los dos scrapings falle
def subir_a_supabase(eventos, hotel_name, supabase_url, supabase_key, pais, user_uuid):
    if not eventos:
        print(f"No hay eventos para subir a Supabase para {pais}.", file=sys.stderr)
        return
    
    user_jwt = os.getenv('USER_JWT')
    headers = {
        "apikey": supabase_key,
        "Authorization": f"Bearer {user_jwt if user_jwt else supabase_key}",
        "Content-Type": "application/json"
    }
    
    eventos_exitosos = 0
    eventos_fallidos = 0
    
    for event in eventos:
        try:
            if pais == 'MX':
                data = {
                    "nombre": event["nombre"],
                    "fecha": event["fecha"],
                    "lugar": event["lugar"],
                    "enlace": event["enlace"],
                    "hotel_referencia": hotel_name,
                    "created_by": user_uuid
                }
            else:
                data = {
                    "nombre": event.get("nombre") or event.get("name"),
                    "fecha": event.get("fecha") or event.get("date"),
                    "lugar": event.get("lugar") or event.get("venue"),
                    "enlace": event.get("enlace") or event.get("url"),
                    "hotel_referencia": hotel_name,
                    "created_by": user_uuid
                }
            
            print(f"Intentando guardar en Supabase: {data['nombre']}", file=sys.stderr)
            url = f"{supabase_url}/rest/v1/events?on_conflict=nombre,fecha,created_by"
            headers_upsert = headers.copy()
            headers_upsert["Prefer"] = "resolution=merge-duplicates"
            
            # Usar timeout para requests
            r = requests.post(url, headers=headers_upsert, json=data, timeout=REQUEST_TIMEOUT)
            
            if r.status_code in (200, 201):
                print(f"✓ Guardado en Supabase: {data['nombre']}", file=sys.stderr)
                eventos_exitosos += 1
            else:
                print(f"✗ Error guardando evento en Supabase: {r.status_code} - {r.text}", file=sys.stderr)
                eventos_fallidos += 1
                
        except requests.exceptions.Timeout:
            print(f"✗ Timeout guardando evento: {event.get('nombre', 'Unknown')}", file=sys.stderr)
            eventos_fallidos += 1
        except Exception as e:
            print(f"✗ Excepción al guardar en Supabase: {e}", file=sys.stderr)
            eventos_fallidos += 1
    
    print(f"Resumen {pais}: {eventos_exitosos} exitosos, {eventos_fallidos} fallidos", file=sys.stderr)

# Intentar subir a Supabase solo si las variables están configuradas
SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY')

if SUPABASE_URL and SUPABASE_ANON_KEY:
    try:
        print("\nGuardando eventos en Supabase...", file=sys.stderr)
        user_jwt = os.getenv('USER_JWT')
        headers = {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {user_jwt if user_jwt else SUPABASE_ANON_KEY}",
            "Content-Type": "application/json"
        }
        
        # Limpiar eventos anteriores del usuario
        try:
            delete_resp = requests.delete(
                f"{SUPABASE_URL}/rest/v1/events?created_by=eq.{user_uuid}",
                headers=headers,
                timeout=REQUEST_TIMEOUT
            )
            print(f"DELETE status: {delete_resp.status_code}", file=sys.stderr)
        except Exception as e:
            print(f"Error limpiando eventos anteriores: {e}", file=sys.stderr)
        
        # Subir eventos de México y Estados Unidos
        subir_a_supabase(eventos_mx, hotel_name, SUPABASE_URL, SUPABASE_ANON_KEY, 'MX', user_uuid)
        subir_a_supabase(eventos_us, hotel_name, SUPABASE_URL, SUPABASE_ANON_KEY, 'US', user_uuid)
        
    except Exception as e:
        print(f"ERROR: Error general en Supabase: {e}", file=sys.stderr)
else:
    print("No se encontró SUPABASE_URL o SUPABASE_ANON_KEY en el entorno.", file=sys.stderr)

# Imprimir resultado final en stdout (para el backend)
print(json.dumps({"mx": eventos_mx, "us": eventos_us}, ensure_ascii=False))

