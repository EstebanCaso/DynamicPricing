import asyncio
import os
import re
import sys
import json
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client
from playwright.async_api import async_playwright
import uuid
import requests
import random
import logging
from typing import List, Dict, Any, Optional
from tenacity import retry, stop_after_attempt, wait_fixed

load_dotenv()
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Faltan variables SUPABASE_URL o SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Configuración de logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')
logger = logging.getLogger(__name__)

# =============================
# Scraper de hoteles Booking.com paralelo
# - Extrae nombre, estrellas, ubicación, tipos de cuarto y precios por 15 días
# - Guarda un registro por hotel en Supabase
# =============================

# Utilidad para validar UUID

def is_valid_uuid(val):
    try:
        uuid.UUID(str(val))
        return True
    except ValueError:
        return False

# Lista de user-agents modernos para rotación y evitar bloqueos
USER_AGENTS = [
    # Chrome Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    # Chrome Mac
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    # Firefox Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
    # Edge Windows
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
    # Chrome Linux
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    # Safari Mac
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
]

def get_random_user_agent():
    """Devuelve un user-agent aleatorio de la lista."""
    return random.choice(USER_AGENTS)

# =============================
# Scraping de un solo hotel (en su propia pestaña)
# =============================
@retry(stop=stop_after_attempt(3), wait=wait_fixed(2))
async def safe_goto(page, url: str):
    await page.goto(url)

async def scrape_hotel_details(page, hotel_url: str, dias: int = 15) -> Dict[str, Any]:
    """
    Extrae la información de un hotel:
    - Nombre: h2[data-testid="title"] o h2
    - Estrellas: button[data-testid="quality-rating"] (aria-label, ej: "4 estrellas de 5")
    - Ubicación: [data-testid="address"]
    - Tipos de cuarto y precios: tabla #hprt-table, para los próximos 'dias' días
    """
    await safe_goto(page, hotel_url)
    await page.wait_for_timeout(1000)
    # --- Nombre del hotel ---
    nombre = ""
    try:
        # Selector principal de nombre
        nombre = await page.inner_text('h2[data-testid="title"]')
    except Exception:
        try:
            # Fallback: cualquier h2
            nombre = await page.inner_text('h2')
        except Exception:
            nombre = ""
    # --- Estrellas del hotel ---
    estrellas = None  # IMPORTANTE: Solo se asigna aquí, no se debe reasignar después
    try:
        # Espera a que el botón de estrellas esté visible
        await page.wait_for_selector('button[data-testid="quality-rating"]', timeout=5000, state='visible')
        estrellas_btn = await page.query_selector('button[data-testid="quality-rating"]')
        if estrellas_btn:
            estrellas_span = await estrellas_btn.query_selector('span[data-testid="rating-stars"]')
            if estrellas_span:
                estrellas_label = await estrellas_span.get_attribute('aria-label')
                logger.info(f"[Estrellas] aria-label encontrado: {estrellas_label} en {hotel_url}")
                match = re.search(r"(\d+) de 5 estrellas", estrellas_label or "")
                if match:
                    estrellas = int(match.group(1))
                else:
                    estrellas = None
            else:
                logger.warning(f"No se encontró el span de estrellas dentro del botón en {hotel_url}")
        else:
            logger.warning(f"No se encontró el botón de estrellas en {hotel_url}")
    except Exception as e:
        logger.warning(f"No se pudieron extraer las estrellas: {e} en {hotel_url}")
        estrellas = None
    # --- Ubicación del hotel ---
    ubicacion = ""
    try:
        ubicacion = await page.inner_text('[data-testid="address"]')
    except Exception:
        # Fallback: buscar el primer div hijo de button.de576f5064
        try:
            button = await page.query_selector('button.de576f5064')
            if button:
                divs = await button.query_selector_all('div')
                if divs:
                    ubicacion = (await divs[0].inner_text()).strip()
        except Exception:
            ubicacion = ""
    # --- Tipos de cuarto y precios por día ---
    today = datetime.today()
    rooms_by_date = {}
    # NOTA: No reasignar 'estrellas' dentro de este bucle ni después
    for offset in range(dias):
        checkin = (today + timedelta(days=offset)).strftime("%Y-%m-%d")
        checkout = (today + timedelta(days=offset+1)).strftime("%Y-%m-%d")
        # Modifica la URL con las nuevas fechas
        new_url = re.sub(r"checkin=\d{4}-\d{2}-\d{2}", f"checkin={checkin}", hotel_url)
        new_url = re.sub(r"checkout=\d{4}-\d{2}-\d{2}", f"checkout={checkout}", new_url)
        await safe_goto(page, new_url)
        await asyncio.sleep(1.5)
        try:
            # Espera a que la tabla de habitaciones esté visible
            await page.wait_for_selector("#hprt-table", timeout=50000, state='visible')
        except Exception:
            continue
        rows = await page.query_selector_all("#hprt-table tr")
        day_rooms = []
        for row in rows:
            try:
                # Tipo de cuarto: th span.hprt-roomtype-icon-link
                room_type_el = await row.query_selector("th span.hprt-roomtype-icon-link")
                price_el = None
                tds = await row.query_selector_all("td")
                for td in tds:
                    # Precio: span.js-average-per-night-price o span.prc-no-css
                    price_candidate = await td.query_selector("span.js-average-per-night-price")
                    if not price_candidate:
                        price_candidate = await td.query_selector("span.prc-no-css")
                    if not price_candidate:
                        price_candidate = await td.query_selector("div.bui-price-display__value span.prco-valign-middle-helper")
                    if price_candidate:
                        price_el = price_candidate
                        break
                if room_type_el and price_el:
                    room_text = (await room_type_el.inner_text()).strip()
                    price_text = (await price_el.inner_text()).strip()
                    # Guarda el tipo de cuarto y el precio como texto
                    day_rooms.append({"room_type": room_text, "price": price_text})
            except Exception:
                continue
        if day_rooms:
            rooms_by_date[checkin] = day_rooms
        else:
            logger.warning(f"No se encontraron cuartos para {checkin} en {hotel_url}")
            table = await page.query_selector("#hprt-table")
            if table:
                table_html = await table.inner_html()
                with open(f"debug_table_{checkin}.html", "w", encoding="utf-8") as f:
                    f.write(table_html)
                logger.info(f"HTML de la tabla guardado en debug_table_{checkin}.html")
            else:
                page_html = await page.content()
                with open(f"debug_page_{checkin}.html", "w", encoding="utf-8") as f:
                    f.write(page_html)
                logger.info(f"HTML de la página guardado en debug_page_{checkin}.html")
    # Devuelve toda la info estructurada
    return {
        "nombre": nombre,           # Nombre del hotel
        "estrellas": estrellas,     # Número de estrellas (int)
        "url": hotel_url,           # URL del hotel
        "ubicacion": ubicacion,     # Dirección/ubicación
        "fecha_scrape": today.strftime("%Y-%m-%d"),
        "rooms_jsonb": rooms_by_date # Diccionario: fecha -> lista de cuartos/precios
    }

# =============================
# Scraping de la lista de hoteles y procesamiento paralelo
# =============================
async def scrape_hotels_parallel(ciudad: str, dias: int = 15, headless: bool = False, concurrencia: int = 10) -> List[Dict[str, Any]]:
    """
    Busca hoteles en la ciudad dada, abre cada uno en paralelo y extrae su información.
    - ciudad: ciudad a buscar (ej: Tijuana)
    - dias: días a scrapear (default 15)
    - headless: modo headless o visible
    """
    async with async_playwright() as p:
        launch_args = {
            "headless": headless,
            "args": [
                "--disable-blink-features=AutomationControlled",
                "--disable-infobars",
                "--window-size=1920,1080"
            ]
        }
        browser = await p.chromium.launch(**launch_args)
        # Contexto con user-agent y viewport para camuflaje
        context = await browser.new_context(
            viewport={"width": 1920, "height": 1080},
            user_agent=get_random_user_agent()
        )
        page = await context.new_page()
        # Inyectar script para ocultar webdriver
        await page.add_init_script("""
Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
""")
        # Construir URL de búsqueda de hoteles para la ciudad
        today = datetime.today()
        tomorrow = today + timedelta(days=1)
        checkin = today.strftime("%Y-%m-%d")
        checkout = tomorrow.strftime("%Y-%m-%d")
        url = f"https://www.booking.com/searchresults.html?ss={ciudad}&checkin={checkin}&checkout={checkout}&group_adults=1&no_rooms=1&group_children=0"
        await page.goto(url)
        await page.wait_for_timeout(5000)
        # --- Obtener enlaces de hoteles de la primera página ---
        hotel_links = []
        cards = await page.query_selector_all("a[data-testid='property-card-desktop-single-image']")
        for card in cards:
            try:
                href = await card.get_attribute("href")
                if href:
                    # Booking links pueden ser relativos
                    if href.startswith("/"):
                        href = "https://www.booking.com" + href
                    # Añadir fechas a la url si no están
                    if "checkin=" not in href:
                        href += f"?checkin={checkin}&checkout={checkout}"
                    hotel_links.append(href)
            except Exception:
                continue
        logger.info(f"Encontrados {len(hotel_links)} hoteles en la primera página de {ciudad}.")
        # --- Abrir cada hotel en una nueva pestaña y scrapear en paralelo ---
        results = []
        sem = asyncio.Semaphore(concurrencia)  # Limitar concurrencia configurable USAR 9
        processed_count = 0
        async def process_hotel(hotel_url: str):
            hotel_page = None
            try:
                async with sem:
                    hotel_page = await context.new_page()
                    await hotel_page.set_extra_http_headers({"user-agent": get_random_user_agent()})
                    await hotel_page.add_init_script("""
Object.defineProperty(navigator, 'webdriver', {get: () => undefined});
""")
                    data = await scrape_hotel_details(hotel_page, hotel_url, dias=dias)
                    results.append(data)
                    nonlocal processed_count
                    processed_count += 1
                    logger.info(f"Hoteles procesados: {processed_count}/{len(hotel_links)}")
            except Exception as e:
                logger.error(f"Error en hotel {hotel_url}: {e}")
            finally:
                if hotel_page:
                    try:
                        await hotel_page.close()
                    except Exception as close_err:
                        logger.warning(f"No se pudo cerrar la página de {hotel_url}: {close_err}")
        # Ejecuta el scraping en paralelo para los primeros 3 hoteles
        await asyncio.gather(*(process_hotel(url) for url in hotel_links))
        await browser.close()
        return results

# =============================
# Inserción en Supabase
# =============================
@retry(stop=stop_after_attempt(3), wait=wait_fixed(2))
def post_hotel(session: requests.Session, url: str, headers: dict, data: dict):
    r = session.post(url, headers=headers, json=data)
    return r

def insert_hotels_supabase(hotels: List[Dict[str, Any]], ciudad: str):
    """
    Inserta cada hotel (un registro por hotel) en la tabla hoteles_parallel de Supabase.
    """
    url = f"{SUPABASE_URL}/rest/v1/hoteles_parallel"
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    with requests.Session() as session:
        for hotel in hotels:
            data = {
                "nombre": hotel["nombre"],
                "estrellas": hotel["estrellas"],
                "url": hotel["url"],
                "ubicacion": hotel["ubicacion"],
                "fecha_scrape": hotel["fecha_scrape"],
                "rooms_jsonb": hotel["rooms_jsonb"],
                "ciudad": ciudad
            }
            logger.info(f"[INSERT] Se va a guardar hotel: {hotel['nombre']} con estrellas: {hotel['estrellas']} y url: {hotel['url']} en ciudad: {ciudad}")
            try:
                r = post_hotel(session, url, headers, data)
                logger.info(f"Status: {r.status_code}, Response: {r.text}")
            except Exception as e:
                logger.error(f"Error upserting: {data}")
                logger.error(f"Exception: {e}")

# =============================
# CLI principal
# =============================
def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('ciudad', help='Ciudad a buscar (ej. Tijuana)')
    parser.add_argument('--headless', help='Ejecutar en modo headless (true/false)', default='false')
    parser.add_argument('--concurrencia', help='Número de hoteles a scrapear en paralelo', type=int, default=10)
    args = parser.parse_args()
    ciudad = args.ciudad
    headless = args.headless.lower() == 'true'
    concurrencia = args.concurrencia
    logger.info(f"Scrapeando hoteles en {ciudad} ...")
    try:
        hotels = asyncio.run(scrape_hotels_parallel(ciudad, dias=7, headless=headless, concurrencia=concurrencia))
        logger.info(f"Total hoteles scrapeados: {len(hotels)}")
        insert_hotels_supabase(hotels, ciudad)
        logger.info("¡Listo!")
    except Exception as e:
        logger.error(f"Error general en el scraping: {e}")

if __name__ == "__main__":
    main() 