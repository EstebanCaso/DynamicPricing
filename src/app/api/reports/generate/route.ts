import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

export async function POST(request: NextRequest) {
  try {
    const { reportType, dateRange } = await request.json()
    const query = supabaseServer.from('events').select('*').order('fecha', { ascending: true }).limit(1000)
    if (reportType === 'custom' && dateRange?.start && dateRange?.end) {
      query.gte('fecha', dateRange.start).lte('fecha', dateRange.end)
    }
    const { data, error } = await query
    if (error) throw error
    return NextResponse.json({ success: true, data: { reportType, dateRange, rows: data } })

  } catch (error) {
    console.error('Error generating report:', error)
    return NextResponse.json(
      { error: 'Report generation failed' },
      { status: 500 }
    )
  }
}
