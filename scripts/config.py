"""
Configuración centralizada para scripts de scraping
"""
import os
import logging
from pathlib import Path
from typing import Dict, Any
from dotenv import load_dotenv

# ─── Configuración de logging ─────────────────────────────────────────────
def setup_logging(level: str = "INFO") -> logging.Logger:
    """Configura el sistema de logging"""
    # Configurar el nivel de logging
    log_level = getattr(logging, level.upper())
    
    # Configurar el logging básico
    logging.basicConfig(
        level=log_level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(),
            logging.FileHandler('scraping.log', encoding='utf-8')
        ],
        force=True  # Forzar la reconfiguración
    )
    
    # Obtener el logger y configurar su nivel
    logger = logging.getLogger(__name__)
    logger.setLevel(log_level)
    
    return logger

# ─── Configuración de entorno ─────────────────────────────────────────────
def load_environment() -> Dict[str, str]:
    """Carga las variables de entorno necesarias"""
    # Cargar .env desde la raíz del proyecto
    env_path = Path(__file__).parent.parent / '.env'
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
    
    required_vars = {
        "SUPABASE_URL": os.getenv("SUPABASE_URL"),
        "SUPABASE_KEY": os.getenv("SUPABASE_KEY"),
        "SUPABASE_ANON_KEY": os.getenv("SUPABASE_ANON_KEY"),
    }
    
    missing_vars = [var for var, value in required_vars.items() if not value]
    if missing_vars:
        raise ValueError(f"Variables de entorno faltantes: {missing_vars}")
    
    return required_vars

# ─── Configuración de Playwright ──────────────────────────────────────────
PLAYWRIGHT_CONFIG = {
    "headless": True,
    "args": [
        "--no-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--disable-web-security",
        "--disable-features=VizDisplayCompositor",
        "--disable-extensions",
        "--disable-plugins",
        "--disable-images",
        "--disable-javascript",
        "--no-first-run",
        "--disable-default-apps"
    ],
    "timeout": 30000,
    "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
}

# ─── Configuración de retry ───────────────────────────────────────────────
RETRY_CONFIG = {
    "stop_after_attempt": 3,
    "wait_multiplier": 1,
    "wait_min": 4,
    "wait_max": 10
}

# ─── Configuración de validación ──────────────────────────────────────────
VALIDATION_CONFIG = {
    "max_radius_km": 1000,
    "min_radius_km": 0.1,
    "max_timeout_seconds": 60,
    "min_timeout_seconds": 5
}

# ─── Funciones de utilidad ────────────────────────────────────────────────
def validate_uuid(user_id: str) -> bool:
    """Valida que el user_id sea un UUID válido"""
    import uuid
    try:
        uuid.UUID(str(user_id))
        return True
    except ValueError:
        return False

def validate_radius(radius_km: float) -> bool:
    """Valida que el radio sea un valor razonable"""
    return VALIDATION_CONFIG["min_radius_km"] <= radius_km <= VALIDATION_CONFIG["max_radius_km"]

def validate_timeout(timeout_seconds: int) -> bool:
    """Valida que el timeout sea un valor razonable"""
    return VALIDATION_CONFIG["min_timeout_seconds"] <= timeout_seconds <= VALIDATION_CONFIG["max_timeout_seconds"]

def normalize_city_name(nombre: str) -> str:
    """Normaliza el nombre de la ciudad para búsqueda"""
    import unicodedata
    nombre = nombre.upper()
    nombre = unicodedata.normalize('NFKD', nombre)
    return ''.join(c for c in nombre if not unicodedata.combining(c))

# ─── Configuración de ciudades soportadas ─────────────────────────────────
SUPPORTED_CITIES = {
    "CIUDAD DE MEXICO": "https://www.songkick.com/es/metro-areas/34385-mexico-mexico-city",
    "GUADALAJARA":       "https://www.songkick.com/es/metro-areas/31015-mexico-guadalajara",
    "MONTERREY":         "https://www.songkick.com/es/metro-areas/31051-mexico-monterrey",
    "CANCUN":            "https://www.songkick.com/es/metro-areas/69001-mexico-cancun",
    "TIJUANA":           "https://www.songkick.com/es/metro-areas/31097-mexico-tijuana",
    "ACAPULCO":          "https://www.songkick.com/es/metro-areas/30967-mexico-acapulco",
    "QUERETARO":         "https://www.songkick.com/es/metro-areas/69091-mexico-queretaro",
    "PUEBLA":            "https://www.songkick.com/es/metro-areas/31066-mexico-puebla",
    "SAN LUIS POTOSI":   "https://www.songkick.com/es/metro-areas/69136-mexico-san-luis-potosi",
    "MERIDA":            "https://www.songkick.com/es/metro-areas/31044-mexico-merida",
    "NUEVO LEON":        "https://www.songkick.com/es/metro-areas/171484-mexico-nuevo-leon"
}

# ─── Configuración de errores ─────────────────────────────────────────────
ERROR_MESSAGES = {
    "missing_env_vars": "🔴 Faltan variables de entorno de Supabase",
    "invalid_user_id": "❌ user_id inválido",
    "invalid_radius": "❌ Radio inválido",
    "unsupported_city": "⚠️ Ciudad no soportada",
    "playwright_error": "❌ Error en Playwright",
    "scraping_error": "❌ Error en scraping",
    "interrupted": "⏹️ Scraping interrumpido por el usuario"
}

# ─── Configuración de salida ─────────────────────────────────────────────
OUTPUT_CONFIG = {
    "ensure_ascii": False,
    "indent": 2,
    "default_empty": "[]"
} 