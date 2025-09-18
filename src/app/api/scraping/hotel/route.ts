import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4, validate as uuidValidate } from 'uuid'

// Ensure this route runs on the Node.js runtime
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

// --- User Agents ---
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0"
];

function getRandomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// --- Scraper principal ---
async function scrapeBookingPrices(hotelName: string, { locale = 'en-us', currency = 'MXN', headless = false } = {}) {
  const userAgent = getRandomUA();
  
  const browser = await chromium.launch({ headless });
  const page = await browser.newPage({ userAgent });

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const checkin = today.toISOString().split('T')[0];
  const checkout = tomorrow.toISOString().split('T')[0];

  // Construir URL directa con el hotel
  const encodedHotelName = encodeURIComponent(hotelName);
  const url = `https://www.booking.com/searchresults.html?lang=${locale}&selected_currency=${currency}&checkin=${checkin}&checkout=${checkout}&ss=${encodedHotelName}`;
  
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  } catch (error) {
    console.log('⚠️  Timeout al cargar página de resultados, intentando con timeout más largo...');
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    } catch (error2) {
      console.log('❌ Error al cargar página de resultados:', error2.message);
      await browser.close();
      return [];
    }
  }
  
  // Esperar a que aparezcan los resultados
  try {
    await page.waitForSelector('[data-testid*="property"], .sr_property_block, .sr_item', { timeout: 10000 });
  } catch (e) {
    console.log('⚠️  No se encontraron selectores específicos, esperando carga general...');
    await page.waitForLoadState("networkidle");
  }
  
  // Seleccionar el mejor match por nombre (evita saltar a otra ciudad)
  try {
    const targetName = hotelName.toLowerCase().replace(/\s+/g, ' ').trim();
    const candidates = await page.evaluate(() => {
      const out: any[] = [];
      const cards = document.querySelectorAll('[data-testid="property-card"]');
      cards.forEach((card) => {
        const titleEl = card.querySelector('[data-testid="title"], .fcab3ed991, h3, h2, a');
        const linkEl = card.querySelector('a[href*="/hotel/"]') || card.querySelector('a');
        const title = titleEl?.textContent?.trim() || '';
        const href = linkEl?.href || '';
        if (href) out.push({ title, href });
      });
      if (out.length === 0) {
        document.querySelectorAll('a[href*="/hotel/"]').forEach((a) => {
          const title = a.textContent?.trim() || '';
          const href = a.href || '';
          if (href) out.push({ title, href });
        })
      }
      return out;
    });

    let best = null;
    let bestScore = -1;
    for (const c of candidates) {
      const title = (c.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
      let score = 0;
      if (title.includes(targetName)) score += 100; // match completo
      // sumar puntos por palabras compartidas
      const words = targetName.split(' ').filter(w => w.length > 2);
      for (const w of words) if (title.includes(w)) score += 2;
      // penalizar si el href aparenta otra ciudad con pistas comunes
      if (/sandiego|san-diego|usa|united-states/i.test(c.href)) score -= 5;
      if (score > bestScore) { bestScore = score; best = c; }
    }

    const chosenHref = (best && bestScore >= 0) ? best.href : (candidates[0]?.href || null);
    if (!chosenHref) {
      console.log('❌ No se pudo localizar un resultado válido');
      await browser.close();
      return [];
    }

    console.log('➡️  Abriendo:', chosenHref, '| score:', bestScore);
    await page.goto(chosenHref, { waitUntil: 'domcontentloaded', timeout: 90000 });
    console.log('✅ Página del hotel cargada');
  } catch (error2) {
    console.log('❌ Error al abrir el primer resultado:', error2.message);
    await browser.close();
    return [];
  }
  
  // Asegurar que la URL del hotel tenga fechas y 1 adulto (para obtener precio de 1 persona)
  try {
    const targetUrl = await page.url();
    const hasDates = /[?&]checkin=/.test(targetUrl) && /[?&]checkout=/.test(targetUrl);
    if (!hasDates) {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(today.getDate() + 1);
      const checkinParam = today.toISOString().split('T')[0];
      const checkoutParam = tomorrow.toISOString().split('T')[0];
      const u = new URL(targetUrl);
      u.searchParams.set('checkin', checkinParam);
      u.searchParams.set('checkout', checkoutParam);
      u.searchParams.set('group_adults', '1');
      u.searchParams.set('req_adults', '1');
      u.searchParams.set('no_rooms', '1');
      await page.goto(u.toString(), { waitUntil: 'domcontentloaded', timeout: 60000 });
      console.log('🔁 Recargado con fechas y 1 adulto');
    }
  } catch {}

  // Si Booking requiere "Ver disponibilidad" / "See availability"
  try {
    const seeSelectors = [
      'button:has-text("Ver disponibilidad")',
      'button:has-text("See availability")',
      'a:has-text("Ver disponibilidad")',
      'a:has-text("See availability")',
      '[data-testid="availability-cta"]',
      '[data-component="hotel/new-rooms-table/SeeAvailabilityButton"]'
    ];
    for (const sel of seeSelectors) {
      const el = await page.$(sel);
      if (el) {
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {}),
          el.click({ button: 'left' })
        ]);
        console.log('👉 Click en botón de disponibilidad');
        break;
      }
    }
  } catch {}

  // Intentar cerrar cookies/popups
  try {
    const cookieSelectors = [
      '#onetrust-accept-btn-handler',
      'button#onetrust-accept-btn-handler',
      'button[aria-label="Accept"]',
      'button[data-testid="accept-cookies"]',
      'button:has-text("Accept")',
      'button:has-text("Aceptar")'
    ];
    for (const sel of cookieSelectors) {
      const btn = await page.$(sel);
      if (btn) { await btn.click().catch(() => {}); break; }
    }
  } catch {}
  
  // Extraer tipos de habitaciones y precios específicos
  console.log('🔍 Extrayendo tipos de habitaciones y precios específicos...');
  
  // Esperar (si existe) a tabla o precios para evitar quedar colgado
  try { await Promise.race([
    page.waitForSelector('#hprt-table, .hprt-table', { timeout: 10000 }),
    page.waitForSelector('[data-testid*="RoomRow"], .bui-price-display__value', { timeout: 10000 })
  ]); } catch {}

  let roomData = await page.evaluate(() => {
    const results: any[] = [];
    const seenTypes = new Set();
    
    // Enfocarse específicamente en la tabla hprt-table
    const hprtTable = document.querySelector('#hprt-table, .hprt-table');
    
    if (hprtTable) {
      console.log('✅ Tabla hprt-table encontrada');
      
      // Buscar filas de habitaciones en la tabla
      const rows = hprtTable.querySelectorAll('tr');
      
      rows.forEach(row => {
        const cells = row.querySelectorAll('td, th');
        
        if (cells.length >= 2) {
          // Extraer nombre real del tipo de habitación dentro de la primera celda
          const roomTypeCell = cells[0];
          const nameSelectors = [
            '.hprt-roomtype-icon-link',
            '.hprt-roomtype-name',
            'span.hprt-roomtype-room',
            'a.hprt-roomtype-link',
            'strong',
            'h3', 'h2'
          ];
          let roomTypeRaw = '';
          for (const sel of nameSelectors) {
            const el = roomTypeCell.querySelector(sel);
            const txt = el?.textContent?.trim();
            if (txt && txt.length > 3) { roomTypeRaw = txt; break; }
          }
          if (!roomTypeRaw) {
            roomTypeRaw = roomTypeCell?.textContent?.trim() || ''
          }
          // Limpiar textos de capacidad (Max. people, Only for x guest, etc.) y normalizar
          let roomType = roomTypeRaw
            .split('\n')
            .map(s => s.trim())
            .filter(s => s && !/^(max\.|máx\.|max|solo|only|capacidad|occupancy)/i.test(s) && !/(people|personas|guests?)/i.test(s))
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (!roomType || roomType.length <= 3) return;
          
          if (seenTypes.has(roomType)) return; // ya tomamos el primer precio de este tipo
          
          // Buscar precio prioritariamente en '.prco-valign-middle-helper' dentro de la fila
          let price = null;
          const priceEl = row.querySelector('.prco-valign-middle-helper');
          if (priceEl && priceEl.textContent) {
            const m = priceEl.textContent.trim().match(/(MXN\s*\$?|\$|USD|EUR)\s*[\d.,]+/);
            if (m) price = m[0];
          }
          // Fallback: buscar hacia el final de la fila
          if (!price) {
            for (let i = cells.length - 1; i >= 0; i--) {
              const cellText = cells[i]?.textContent?.trim();
              if (cellText) {
                const priceMatch = cellText.match(/(MXN\s*\$?|\$|USD|EUR)\s*[\d.,]+/);
                if (priceMatch) { price = priceMatch[0]; break; }
              }
            }
          }
          
          if (price) {
            results.push({ room_type: roomType, price, source: 'hprt-table' });
            seenTypes.add(roomType);
          }
        }
      });
      
      console.log(`📊 Primer precio por tipo de habitación (hprt-table): ${results.length}`);
    } else {
      console.log('⚠️ Tabla hprt-table no encontrada');
    }
    
    return results;
  });
  
  // Fallback genérico si no se encontraron resultados en hprt-table
  if (roomData.length === 0) {
    try {
      roomData = await page.evaluate(() => {
        const results: any[] = []

        const getRoomTypeNear = (el: any) => {
          // Buscar arriba en jerarquía por candidatos comunes
          const container = el.closest('tr, .hprt-table, .room, .sr_item, section, article, div') || document
          const selectors = [
            '.hprt-roomtype-icon-link',
            '.hprt-roomtype-name',
            'span.hprt-roomtype-room',
            '[data-room-name]',
            '.sr-room__name',
            '.roomName',
            'h3',
            'h2',
            'th',
            'td'
          ]
          for (const sel of selectors) {
            const cand = container.querySelector(sel)
            const txt = cand?.textContent?.trim()
            if (txt && txt.length > 3) {
              const cleaned = txt
                .split('\n')
                .map(s => s.trim())
                .filter(s => s && !/^(max\.|máx\.|max|solo|only|capacidad|occupancy)/i.test(s) && !/(people|personas|guests?)/i.test(s))
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();
              if (cleaned && cleaned.length > 3) return cleaned
            }
          }
          // Intentar fila previa (primer celda como nombre)
          const row = el.closest('tr')
          if (row && row.children && row.children.length > 0) {
            const txt = row.children[0]?.textContent?.trim()
            if (txt && txt.length > 3) {
              const cleaned = txt
                .split('\n')
                .map(s => s.trim())
                .filter(s => s && !/^(max\.|máx\.|max|solo|only|capacidad|occupancy)/i.test(s) && !/(people|personas|guests?)/i.test(s))
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();
              if (cleaned && cleaned.length > 3) return cleaned
            }
          }
          return ''
        }

        const candidates = document.querySelectorAll('[data-testid*="RoomRow"], [data-testid*="price"], .bui-price-display__value, .prco-valign-middle-helper')
        candidates.forEach((el) => {
          const priceText = el.textContent?.trim() || ''
          const m = priceText.match(/(MXN\s*\$?|\$|USD|EUR)\s*[\d.,]+/)
          if (!m) return
          let roomType = getRoomTypeNear(el)
          if (!roomType) return
          if (!results.some(r => r.room_type === roomType && r.price === m[0])) {
            results.push({ room_type: roomType, price: m[0], source: 'generic' })
          }
        })
        return results
      })
    } catch {}
  }
  
  // Dedupe: conservar solo el primer precio por tipo de habitación
  const firstPriceByType: any[] = [];
  const seen = new Set();
  for (const r of roomData) {
    const key = (r.room_type || '').trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    firstPriceByType.push(r);
  }

  console.log(`🏠 Tipos únicos encontrados: ${firstPriceByType.length}`);
  firstPriceByType.forEach(room => {
    console.log(`   🏨 ${room.room_type}: ${room.price}`);
  });
  
  if (firstPriceByType.length > 0) {
    await browser.close();
    return [{ date: checkin, rooms: firstPriceByType }];
  }
  
  console.log('⚠️  Sin disponibilidad para hoy. Reintentando con fechas futuras...');
  // Reintentar hasta 5 días hacia adelante buscando disponibilidad
  for (let add = 1; add <= 5; add++) {
    try {
      const ci = new Date(today.getTime() + add*86400000)
        .toISOString().split('T')[0]
      const co = new Date(new Date(today.getTime() + add*86400000).getTime() + 86400000)
        .toISOString().split('T')[0]
      const u2 = new URL(page.url())
      u2.searchParams.set('checkin', ci)
      u2.searchParams.set('checkout', co)
      u2.searchParams.set('group_adults', '1')
      u2.searchParams.set('req_adults', '1')
      u2.searchParams.set('no_rooms', '1')
      await page.goto(u2.toString(), { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForSelector('#hprt-table, .hprt-table, [data-testid*="RoomRow"], .bui-price-display__value', { timeout: 15000 }).catch(() => {})

      let retryData = await page.evaluate(() => {
        const out: any[] = []
        const seen = new Set()
        const table = document.querySelector('#hprt-table, .hprt-table')
        if (table) {
          table.querySelectorAll('tr').forEach((row) => {
            const cells = row.querySelectorAll('td, th')
            if (cells.length < 2) return
            const nameRaw = cells[0]?.textContent?.trim() || ''
            const name = nameRaw.replace(/\s+/g, ' ').trim()
            if (!name || seen.has(name)) return
            let price = null
            for (let i = cells.length-1; i>=0; i--) {
              const t = cells[i]?.textContent?.trim() || ''
              const m = t.match(/(MXN\s*\$?|\$|USD|EUR)\s*[\d.,]+/)
              if (m) { price = m[0]; break }
            }
            if (price) { seen.add(name); out.push({ room_type: name, price }) }
          })
        }
        if (out.length === 0) {
          const getRoomTypeNear = (el: any) => {
            const container = el.closest('tr, .hprt-table, .room, .sr_item, section, article, div') || document
            const sels = ['.hprt-roomtype-icon-link','.hprt-roomtype-name','span.hprt-roomtype-room','[data-room-name]','.sr-room__name','.roomName','h3','h2','th','td']
            for (const s of sels) { const c = container.querySelector(s); const tx = c?.textContent?.trim(); if (tx && tx.length>3) return tx.replace(/\s+/g,' ').trim() }
            const row = el.closest('tr'); if (row && row.children?.length>0) { const tx = row.children[0]?.textContent?.trim(); if (tx && tx.length>3) return tx.replace(/\s+/g,' ').trim() }
            return ''
          }
          document.querySelectorAll('[data-testid*="RoomRow"], [data-testid*="price"], .bui-price-display__value, .prco-valign-middle-helper').forEach((el)=>{
            const t = el.textContent?.trim() || ''
            const m = t.match(/(MXN\s*\$?|\$|USD|EUR)\s*[\d.,]+/)
            if (!m) return
            const name = getRoomTypeNear(el)
            if (!name || seen.has(name)) return
            seen.add(name); out.push({ room_type: name, price: m[0] })
          })
        }
        return out
      })

      const unique: any[] = []
      const used = new Set()
      for (const r of retryData) { const k = (r.room_type||'').trim(); if (!k || used.has(k)) continue; used.add(k); unique.push(r) }
      console.log(`🔁 ${ci}: tipos únicos ${unique.length}`)
      if (unique.length > 0) {
        await browser.close()
        return [{ date: ci, rooms: unique }]
      }
    } catch {}
  }

  console.log('❌ No se encontraron tipos de habitaciones tras reintentos')
  await browser.close();
  return [];
}

// --- Insertar en Supabase ---
async function insertUserHotelPrices(userId: string, hotelName: string, results: any[], jwt = null) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('⚠️  Variables de Supabase no encontradas. Saltando inserción en base de datos.');
    return;
  }

  if (!uuidValidate(userId)) {
    console.error("❌ user_id inválido");
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    global: jwt
      ? { headers: { Authorization: `Bearer ${jwt}` } }
      : undefined
  });

  let totalInserted = 0;
  for (const day of results) {
    for (const room of day.rooms) {
      // Use upsert to handle duplicates
      const { error } = await supabase
        .from("hotel_usuario")
        .upsert([{
          user_id: userId,
          hotel_name: hotelName,
          scrape_date: new Date().toISOString().split("T")[0],
          checkin_date: day.date,
          room_type: room.room_type,
          price: room.price
        }], {
          onConflict: 'user_id,hotel_name,checkin_date,room_type'
        });

      if (error) {
        console.error("❌ Error upsertando:", error.message);
      } else {
        totalInserted++;
        console.log(`✅ ${day.date} - ${room.room_type} - ${room.price}`);
      }
    }
  }

  console.log(`📊 Total procesados: ${totalInserted} (insertados/actualizados)`);
}

export async function POST(request: NextRequest) {
  try {
    const { userData } = await request.json()
    const { hotelName, userUuid, days = 90, concurrency = 5, headless = true } = userData

    if (!hotelName || !userUuid) {
      return NextResponse.json(
        { error: 'Missing required parameters: hotelName and userUuid' },
        { status: 400 }
      )
    }

    console.log('Executing hotel scraping with parameters:', {
      hotelName,
      userUuid,
      days,
      concurrency,
      headless
    })

    try {
      // For now, just scrape single day (can be extended to multiple days later)
      const prices = await scrapeBookingPrices(hotelName, { headless });
      await insertUserHotelPrices(userUuid, hotelName, prices, request.headers.get('Authorization')?.replace(/^Bearer\s+/i, ''));
      
      return NextResponse.json({
        success: true,
        message: 'Hotel scraping completed successfully',
        data: prices
      })
    } catch (error) {
      console.error('❌ Error:', error.message);
      return NextResponse.json({
        success: false,
        message: 'Hotel scraping failed',
        error: error.message
      }, { status: 500 })
    }
  } catch (error) {
    console.error('Error in hotel scraping endpoint:', error)
    return NextResponse.json(
      { 
        success: false,
        message: 'Internal server error',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
