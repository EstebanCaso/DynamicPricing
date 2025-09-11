import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function pickRoomsForDate(
  dict: Record<string, Array<{ price: string }>> | null | undefined,
  targetDate: string
) {
  if (!dict) return undefined;

  // 1. Try direct match
  if (Object.prototype.hasOwnProperty.call(dict, targetDate)) {
    return dict[targetDate];
  }

  // 2. Try normalizing keys
  for (const key in dict) {
    if (Object.prototype.hasOwnProperty.call(dict, key)) {
      try {
        const normalizedKey = new Date(key).toISOString().slice(0, 10);
        if (normalizedKey === targetDate) {
          return dict[key];
        }
      } catch (e) {
        // Invalid date key, ignore
      }
    }
  }

  return undefined;
}


export async function POST(request: NextRequest) {
  const response = NextResponse.next();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => request.cookies.get(name)?.value,
        set: (name: string, value: string, options: any) => {
          response.cookies.set({ name, value, ...options });
        },
        remove: (name: string, options: any) => {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { competitorName, checkinDate } = await request.json();
    if (!checkinDate) {
      return NextResponse.json({ success: false, error: 'checkinDate is required' }, { status: 400 });
    }

    const endDate = new Date(checkinDate);
    const fortyDaysAgo = new Date(endDate);
    fortyDaysAgo.setDate(endDate.getDate() - 40);
    
    const fortyDaysAgoISO = fortyDaysAgo.toISOString().slice(0, 10);

            // 1. Fetch all scrapes for the competitor in the last ~40 days.
            const { data: competitorScrapes, error: competitorError } = await supabase
              .from('hoteles_parallel')
              .select('rooms_jsonb, fecha_scrape')
              .eq('nombre', competitorName)
              .gte('fecha_scrape', fortyDaysAgoISO)
              .order('fecha_scrape', { ascending: true });

            if (competitorError) {
                console.error("Supabase error fetching competitor scrapes:", competitorError);
                throw competitorError;
            }

            // 2. Process the scrapes to find prices for the specific checkinDate.
            const historicalPrices = competitorScrapes.map(scrape => {
                const roomsForDay = pickRoomsForDate(scrape.rooms_jsonb as any, checkinDate);
                if (!roomsForDay || roomsForDay.length === 0) {
            return null;
        }
        const prices = roomsForDay
            .map(room => room.price ? parseFloat(room.price.replace(/[^0-9.-]+/g, '')) : NaN)
            .filter(p => !isNaN(p));
        if (prices.length === 0) {
            return null;
        }
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        return {
            fecha_scrape: scrape.fecha_scrape,
            avgPrice: avgPrice
        };
    }).filter(Boolean);


    console.log(`Found ${historicalPrices.length} historical price points for competitor: ${competitorName} for check-in ${checkinDate}`);

    // 3. Fetch user's hotel data for the same check-in date across different scrape dates.
    // This assumes 'checkin_date' in hotel_usuario corresponds to the competitor's check-in date, 
    // and 'scrape_date' corresponds to competitor's 'fecha_scrape'.
    const { data: userHotelData, error: userHotelError } = await supabase
      .from('hotel_usuario')
      .select('price, checkin_date, hotel_name, scrape_date')
      .eq('user_id', user.id)
      .eq('checkin_date', checkinDate) 
      .gte('scrape_date', fortyDaysAgoISO)
      .order('scrape_date', { ascending: true });

    if (userHotelError) throw userHotelError;

    console.log(`Found ${userHotelData?.length || 0} historical records for the user's hotel for check-in ${checkinDate}.`);

    // The 'competitorData' sent to the client is now the processed historical prices.
    return NextResponse.json({ success: true, competitorData: historicalPrices, userHotelData });

  } catch (error) {
    console.error('Error fetching historical data:', error); // Log detallado en el servidor
    return NextResponse.json({ success: false, error: 'Failed to fetch historical data' }, { status: 500 });
  }
}
