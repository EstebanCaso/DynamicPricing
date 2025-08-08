import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export async function POST(request: NextRequest) {
  try {
    const { metric } = await request.json()
    // Example: simple analytics based on events table
    if (metric === 'price-trends' || metric === 'competitor-analysis' || metric === 'market-share' || metric === 'revenue-impact') {
      const { data, error } = await supabaseServer
        .from('events')
        .select('fecha', { count: 'exact' })
        .order('fecha', { ascending: true })
        .limit(2000)
      if (error) throw error
      return NextResponse.json({ success: true, data: { metric, rows: data } })
    }
    return NextResponse.json({ success: true, data: { metric, rows: [] } })

  } catch (error) {
    console.error('Error viewing analytics:', error)
    return NextResponse.json(
      { error: 'Analytics failed' },
      { status: 500 }
    )
  }
}
