import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export async function POST(request: NextRequest) {
  try {
    const { priceRange, analysisType } = await request.json()
    // Placeholder: filter events by date as proxy; extend with real pricing fields when available
    const { data, error } = await supabaseServer
      .from('events')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(100)
    if (error) throw error
    return NextResponse.json({ success: true, data: { analysisType, priceRange, rows: data } })

  } catch (error) {
    console.error('Error in pricing analysis:', error)
    return NextResponse.json(
      { error: 'Analysis failed' },
      { status: 500 }
    )
  }
}
