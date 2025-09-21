import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabaseServer'

export async function POST(request: NextRequest) {
  try {
    const { date } = await request.json()

    if (!date) {
      return NextResponse.json({ 
        success: false, 
        error: 'Date is required' 
      }, { status: 400 })
    }

    // Fetch AI-updated prices from room_types table
    const { data: aiPrices, error } = await supabase
      .from('room_types')
      .select('nombre, final_price, standardized_type, fecha')
      .eq('fecha', date)
      .not('final_price', 'is', null)

    if (error) {
      console.error('Error fetching AI prices:', error)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to fetch AI prices' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: aiPrices || []
    })

  } catch (error) {
    console.error('Error in AI prices API:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
