import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

function parsePrice(price: string): number {
  return parseFloat(price.replace(/[^0-9.-]+/g, ''));
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

    const { competitorNames } = await request.json(); // Changed from competitorName to competitorNames

    if (!Array.isArray(competitorNames) || competitorNames.length === 0) {
      return NextResponse.json({ error: 'competitorNames must be a non-empty array' }, { status: 400 });
    }
    
    // Function to fetch data for a single competitor
    const getCompetitorHistoricalData = async (competitorName: string) => {
      const { data: competitorScrape, error: competitorError } = await supabase
        .from('hoteles_parallel')
        .select('rooms_jsonb')
        .eq('nombre', competitorName)
        .order('fecha_scrape', { ascending: false })
        .limit(1)
        .single();

      if (competitorError) {
        console.error(`Supabase error fetching competitor scrape for ${competitorName}:`, competitorError);
        // Return null or empty data instead of throwing to not fail the whole batch
        return { name: competitorName, data: [] };
      }

      if (!competitorScrape || !competitorScrape.rooms_jsonb) {
        return { name: competitorName, data: [] };
      }

      const competitorData = Object.entries(competitorScrape.rooms_jsonb).map(([date, rooms]) => {
        const prices = (rooms as any[]).map(room => parsePrice(room.price)).filter(p => !isNaN(p));
        const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
        return { date, avgPrice };
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      return { name: competitorName, data: competitorData };
    };

    // Fetch data for all competitors in parallel
    const competitorsData = await Promise.all(
      competitorNames.map(name => getCompetitorHistoricalData(name))
    );

    // 2. Fetch user's hotel data for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoISO = thirtyDaysAgo.toISOString().slice(0, 10);
    
    const { data: userHotelDataRaw, error: userHotelError } = await supabase
      .from('hotel_usuario')
      .select('price, checkin_date, hotel_name')
      .eq('user_id', user.id)
      .gte('checkin_date', thirtyDaysAgoISO)
      .order('checkin_date', { ascending: true });

    if (userHotelError) throw userHotelError;
    
    let userHotelData: Array<{ date: string; avgPrice: number; hotel_name: string }> = [];
    if(userHotelDataRaw) {
      const dailyPrices: { [key: string]: number[] } = {};
      userHotelDataRaw.forEach(item => {
        const date = item.checkin_date;
        if (!dailyPrices[date]) {
          dailyPrices[date] = [];
        }
        dailyPrices[date].push(parsePrice(item.price));
      });
      
      userHotelData = Object.entries(dailyPrices).map(([date, prices]) => {
        const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
        return { date, avgPrice, hotel_name: userHotelDataRaw[0].hotel_name };
      });
    }

    return NextResponse.json({ success: true, competitorsData, userHotelData });

  } catch (error) {
    console.error('Error fetching historical data:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch historical data' }, { status: 500 });
  }
}
