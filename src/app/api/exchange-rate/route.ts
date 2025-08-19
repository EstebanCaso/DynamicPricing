import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    if (!from || !to) {
      return NextResponse.json(
        { error: 'Missing from or to currency parameters' },
        { status: 400 }
      );
    }

    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    const baseUrl = process.env.EXCHANGE_RATE_API_BASE_URL || 'https://v6.exchangerate-api.com/v6';

    if (!apiKey) {
      console.warn('Exchange rate API key not configured, using fallback rate');
      // Return fallback rate for MXN to USD
      if (from === 'MXN' && to === 'USD') {
        return NextResponse.json({
          rate: 18.5, // Fallback rate
          from: 'MXN',
          to: 'USD',
          lastUpdated: new Date().toISOString(),
          fallback: true
        });
      }
      
      return NextResponse.json(
        { error: 'Exchange rate API key not configured' },
        { status: 500 }
      );
    }

    const response = await fetch(`${baseUrl}/${apiKey}/pair/${from}/${to}`);
    
    if (!response.ok) {
      throw new Error(`Exchange rate API responded with status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.result === 'success') {
      return NextResponse.json({
        rate: data.conversion_rate,
        from: data.base_code,
        to: data.target_code,
        lastUpdated: new Date().toISOString()
      });
    } else {
      throw new Error(`Exchange rate API error: ${data.error_type || 'Unknown error'}`);
    }

  } catch (error) {
    console.error('Error fetching exchange rate:', error);
    
    // Return fallback rate for MXN to USD
    if (from === 'MXN' && to === 'USD') {
      return NextResponse.json({
        rate: 18.5, // Fallback rate
        from: 'MXN',
        to: 'USD',
        lastUpdated: new Date().toISOString(),
        fallback: true
      });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch exchange rate' },
      { status: 500 }
    );
  }
}
