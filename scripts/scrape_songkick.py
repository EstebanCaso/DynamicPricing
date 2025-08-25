import sys
import asyncio
import json
import re
from bs4 import BeautifulSoup
from geopy.distance import geodesic
from playwright.async_api import async_playwright
import subprocess
import os
import time

# Configuración de timeouts y reintentos
MAX_RETRIES = 3
BROWSER_LAUNCH_TIMEOUT = 60  # segundos (aumentado de 30)
PAGE_LOAD_TIMEOUT = 60  # segundos (aumentado de 30)
SELECTOR_TIMEOUT = 30  # segundos (aumentado de 20)

def ensure_playwright_browsers():
    """Instalar Playwright browsers solo si es necesario"""
    try:
        import playwright
        print("Verificando instalación de Playwright browsers...", file=sys.stderr)
        
        # Verificar si ya están instalados de forma síncrona
        try:
            # Verificar si playwright está disponible sin crear event loop
            import playwright.async_api
            print("Playwright browsers ya están instalados y funcionando", file=sys.stderr)
            return
                
        except Exception as e:
            print(f"Browsers no disponibles, instalando... Error: {e}", file=sys.stderr)
        
        # Solo instalar si es necesario
        print("Instalando Playwright browsers...", file=sys.stderr)
        result = subprocess.run([
            sys.executable, "-m", "playwright", "install", "--with-deps", "chromium"
        ], capture_output=True, text=True, timeout=120)  # 2 minutos timeout
        
        if result.returncode == 0:
            print("Playwright browsers instalados exitosamente", file=sys.stderr)
        else:
            print(f"Error instalando browsers: {result.stderr}", file=sys.stderr)
            # Continuar de todas formas, puede que funcione
            
    except Exception as e:
        print(f"Error en ensure_playwright_browsers: {e}", file=sys.stderr)
        # Continuar de todas formas

# Configurar encoding de stdout
try:
    sys.stdout.reconfigure(encoding='utf-8')
except AttributeError:
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

async def scrape_songkick_events():
    """Función principal de scraping con mejor manejo de errores"""
    # Argumentos: latitud, longitud, radio_km
    if len(sys.argv) < 4:
        print(json.dumps([]))
        return

    try:
        hotel_lat = float(sys.argv[1])
        hotel_lon = float(sys.argv[2])
        radius_km = float(sys.argv[3])
    except (ValueError, IndexError) as e:
        print(f"Error en argumentos: {e}", file=sys.stderr)
        print(json.dumps([]))
        return

    BASE_URL = "https://www.songkick.com"
    
    # Construir URL dinámica basada en coordenadas del usuario
    # Para México, usar la búsqueda por ubicación
    if hotel_lat and hotel_lon:
        # Usar la búsqueda de eventos por ubicación geográfica
        # Songkick tiene mejor soporte para búsquedas por ciudad que por coordenadas exactas
        if hotel_lat > 19.0 and hotel_lat < 33.0 and hotel_lon > -118.0 and hotel_lon < -86.0:
            # Estamos en México, usar ciudades principales
            if hotel_lat > 32.0:  # Norte de México
                URL = "https://www.songkick.com/es/metro-areas/31097-mexico-tijuana"
                print("Usando URL para Tijuana (Norte de México)", file=sys.stderr)
            elif hotel_lat > 25.0:  # Centro-Norte de México
                URL = "https://www.songkick.com/es/metro-areas/31098-mexico-monterrey"
                print("Usando URL para Monterrey (Centro-Norte de México)", file=sys.stderr)
            elif hotel_lat > 20.0:  # Centro de México
                URL = "https://www.songkick.com/es/metro-areas/31099-mexico-guadalajara"
                print("Usando URL para Guadalajara (Centro de México)", file=sys.stderr)
            else:  # Sur de México
                URL = "https://www.songkick.com/es/metro-areas/31100-mexico-mexico-city"
                print("Usando URL para Ciudad de México (Sur de México)", file=sys.stderr)
        else:
            # Fuera de México, usar búsqueda por coordenadas
            URL = f"https://www.songkick.com/search?query=&location={hotel_lat},{hotel_lon}&radius={radius_km}"
            print(f"Usando URL dinámica para coordenadas: {hotel_lat}, {hotel_lon}", file=sys.stderr)
    else:
        # Fallback a Tijuana si no hay coordenadas
        URL = "https://www.songkick.com/es/metro-areas/31097-mexico-tijuana"
        print("Usando URL fallback para Tijuana", file=sys.stderr)

    # Asegurar browsers antes de empezar
    ensure_playwright_browsers()

    browser = None
    try:
        async with async_playwright() as p:
            # Configuraciones de lanzamiento con mejor manejo de errores
            launch_options = [
                {"headless": True, "timeout": BROWSER_LAUNCH_TIMEOUT * 1000, "args": [
                    "--no-sandbox", 
                    "--disable-setuid-sandbox",
                    "--disable-blink-features=AutomationControlled",
                    "--disable-web-security",
                    "--disable-features=VizDisplayCompositor"
                ]},
                {"headless": True, "timeout": BROWSER_LAUNCH_TIMEOUT * 1000, "args": [
                    "--no-sandbox", 
                    "--disable-setuid-sandbox", 
                    "--disable-dev-shm-usage",
                    "--disable-blink-features=AutomationControlled"
                ]},
                {"headless": True, "timeout": BROWSER_LAUNCH_TIMEOUT * 1000, "args": [
                    "--no-sandbox", 
                    "--disable-setuid-sandbox", 
                    "--disable-dev-shm-usage",
                    "--disable-blink-features=AutomationControlled",
                    "--disable-web-security"
                ]}
            ]
            
            # Intentar lanzar browser con timeout
            for i, options in enumerate(launch_options):
                try:
                    print(f"Intento {i+1} de lanzar browser para Songkick", file=sys.stderr)
                    browser = await asyncio.wait_for(
                        p.chromium.launch(**options),
                        timeout=BROWSER_LAUNCH_TIMEOUT
                    )
                    print("Browser lanzado exitosamente para Songkick", file=sys.stderr)
                    break
                except asyncio.TimeoutError:
                    print(f"Timeout en intento {i+1} de lanzar browser", file=sys.stderr)
                    continue
                except Exception as e:
                    print(f"Error en intento {i+1} de lanzar browser: {e}", file=sys.stderr)
                    if i == len(launch_options) - 1:
                        raise Exception(f"Todos los intentos de lanzar browser fallaron. Último error: {e}")
                    continue
            
            if not browser:
                raise Exception("No se pudo lanzar el browser con ninguna configuración")

            page = await browser.new_page()
            
            # Ocultar que es un bot
            await page.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => undefined,
                });
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5],
                });
                Object.defineProperty(navigator, 'languages', {
                    get: () => ['en-US', 'en'],
                });
            """)
            
            # Configurar timeouts y headers
            page.set_default_timeout(PAGE_LOAD_TIMEOUT * 1000)
            
            # User agents más realistas para evitar detección
            user_agents = [
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
                "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
            ]
            
            await page.set_extra_http_headers({
                "user-agent": user_agents[0],
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "accept-language": "en-US,en;q=0.5",
                "accept-encoding": "gzip, deflate",
                "dnt": "1",
                "connection": "keep-alive",
                "upgrade-insecure-requests": "1"
            })

            print(f"Navegando a Songkick URL: {URL}", file=sys.stderr)
            
            # Navegar con timeout
            try:
                print(f"Navegando a: {URL}", file=sys.stderr)
                await asyncio.wait_for(
                    page.goto(URL, wait_until='domcontentloaded'),
                    timeout=PAGE_LOAD_TIMEOUT
                )
                
                # Simular comportamiento humano - esperar un poco
                await asyncio.sleep(3)
                print("✓ Página cargada, esperando 3 segundos...", file=sys.stderr)
                
            except asyncio.TimeoutError:
                print("❌ Timeout navegando a Songkick", file=sys.stderr)
                await browser.close()
                print(json.dumps([]))
                return
            except Exception as e:
                print(f"❌ Error navegando a Songkick: {e}", file=sys.stderr)
                await browser.close()
                print(json.dumps([]))
                return
            
            # Esperar eventos con timeout - usar múltiples selectores
            eventos_encontrados = False
            selectores = [
                "li.event-listings-element",
                ".event-listings li",
                ".event-listings .event",
                "[data-testid='event-item']",
                ".event-item"
            ]
            
            for selector in selectores:
                try:
                    print(f"Intentando selector: {selector}", file=sys.stderr)
                    await asyncio.wait_for(
                        page.wait_for_selector(selector, timeout=10000),  # 10 segundos por selector
                        timeout=10000
                    )
                    print(f"✓ Selector encontrado: {selector}", file=sys.stderr)
                    eventos_encontrados = True
                    break
                except asyncio.TimeoutError:
                    print(f"Timeout con selector: {selector}", file=sys.stderr)
                    continue
                except Exception as e:
                    print(f"Error con selector {selector}: {e}", file=sys.stderr)
                    continue
            
            if not eventos_encontrados:
                print("⚠ No se encontraron eventos con ningún selector, intentando obtener contenido de todas formas", file=sys.stderr)
            
            # Intentar obtener contenido de todas formas
            html = await page.content()
            print(f"Longitud del contenido: {len(html)}", file=sys.stderr)
            
            # Verificar si la página está bloqueada o vacía
            if len(html) < 1000:
                print("❌ Página demasiado pequeña, posiblemente bloqueada", file=sys.stderr)
                await browser.close()
                print(json.dumps([]))
                return
            
            # Verificar contenido problemático (pero ser más permisivo)
            contenido_bloqueado = ["captcha", "access denied", "forbidden", "blocked"]
            for problema in contenido_bloqueado:
                if problema in html.lower():
                    print(f"❌ Página contiene '{problema}', bloqueada", file=sys.stderr)
                    await browser.close()
                    print(json.dumps([]))
                    return
            
            # Para "robot" y "bot", solo mostrar advertencia pero continuar
            if "robot" in html.lower() or "bot" in html.lower():
                print("⚠ Página contiene palabras relacionadas con bot, pero continuando...", file=sys.stderr)
            
            print("✓ Página cargada correctamente, procediendo con scraping", file=sys.stderr)

            # Obtener contenido HTML
            try:
                html = await asyncio.wait_for(page.content(), timeout=10)
            except asyncio.TimeoutError:
                print("Timeout obteniendo contenido HTML", file=sys.stderr)
                await browser.close()
                print(json.dumps([]))
                return
            except Exception as e:
                print(f"Error obteniendo contenido HTML: {e}", file=sys.stderr)
                await browser.close()
                print(json.dumps([]))
                return
            finally:
                await browser.close()

    except Exception as e:
        print(f"Error en Playwright scraping para Songkick: {e}", file=sys.stderr)
        if browser:
            try:
                await browser.close()
            except:
                pass
        print(json.dumps([]))
        return

    # Procesar HTML con BeautifulSoup
    try:
        soup = BeautifulSoup(html, "html.parser")
    except Exception as e:
        print(f"Error parseando HTML con BeautifulSoup: {e}", file=sys.stderr)
        print(json.dumps([]))
        return

    # Buscar todos los eventos con múltiples selectores
    eventos_encontrados = []
    selectores_html = [
        ("li", {"class_": "event-listings-element"}),
        ("li", {"class_": "event"}),
        ("div", {"class_": "event-listings-element"}),
        ("div", {"class_": "event"}),
        ("article", {"class_": "event"}),
        ("div", {"data-testid": "event-item"}),
        ("li", {"class_": "event-item"})
    ]
    
    for tag, attrs in selectores_html:
        encontrados = soup.find_all(tag, attrs)
        if encontrados:
            print(f"✓ Encontrados {len(encontrados)} eventos con selector {tag}.{attrs}", file=sys.stderr)
            eventos_encontrados = encontrados
            break
    
    if not eventos_encontrados:
        # Último recurso: buscar cualquier elemento que contenga "event" en la clase
        eventos_encontrados = soup.find_all(attrs={"class": lambda x: x and "event" in x.lower()})
        if eventos_encontrados:
            print(f"⚠ Encontrados {len(eventos_encontrados)} eventos con búsqueda genérica", file=sys.stderr)
    
    print(f"Total de eventos encontrados: {len(eventos_encontrados)}", file=sys.stderr)
    eventos = []

    for li in eventos_encontrados:
        try:
            # Fecha
            time_tag = li.find("time")
            fecha = time_tag["datetime"] if time_tag and time_tag.has_attr("datetime") else li.get("title", "")
            # Limpiar fecha: solo los primeros 10 caracteres (YYYY-MM-DD)
            if len(fecha) > 10:
                fecha = fecha[:10]

            # Nombre del artista/evento
            strong = li.find("strong")
            nombre = strong.get_text(strip=True) if strong else ""

            # Lugar
            venue = li.find("a", class_="venue-link")
            lugar = venue.get_text(strip=True) if venue else ""

            # Enlace
            event_link = li.find("a", class_="event-link")
            enlace = BASE_URL + event_link["href"] if event_link and event_link.has_attr("href") else ""

            # Coordenadas (del JSON embebido)
            lat, lon = None, None
            microformat = li.find("div", class_="microformat")
            if microformat:
                script_tag = microformat.find("script", type="application/ld+json")
                if script_tag:
                    try:
                        data = json.loads(script_tag.string)
                        if isinstance(data, list):
                            data = data[0]
                        geo = data.get("location", {}).get("geo", {})
                        lat = geo.get("latitude")
                        lon = geo.get("longitude")
                    except Exception:
                        pass
            if lat is None or lon is None:
                continue

            # Calcular distancia
            distance = geodesic((hotel_lat, hotel_lon), (lat, lon)).kilometers
            if distance > radius_km:
                continue

            eventos.append({
                "nombre": nombre,
                "fecha": fecha,
                "lugar": lugar,
                "enlace": enlace,
                "latitude": lat,
                "longitude": lon,
                "distance_km": round(distance, 2)
            })
        except Exception as e:
            print(f"Error procesando evento: {e}", file=sys.stderr)
            continue

    print(f"Total de eventos finales: {len(eventos)}", file=sys.stderr)
    # Solo imprimir el JSON en stdout, sin debug
    try:
        json_output = json.dumps(eventos, ensure_ascii=False)
        # Verificar que el JSON sea válido antes de imprimirlo
        json.loads(json_output)  # Test de validación
        print(json_output)
    except Exception as e:
        print("[]")
        print(f"Error generando JSON válido: {e}", file=sys.stderr)

# Ejecutar la función async
if __name__ == "__main__":
    try:
        # Configurar timeout global para toda la ejecución
        asyncio.run(asyncio.wait_for(scrape_songkick_events(), timeout=120))  # 2 minutos máximo
    except asyncio.TimeoutError:
        print("[]")
        print("Timeout en scraping de Songkick", file=sys.stderr)
    except Exception as e:
        print("[]")
        print(f"Error en scraping de Songkick: {e}", file=sys.stderr)
    finally:
        sys.stdout.flush()
        sys.stderr.flush() 

        