import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'

function formatDate(date: Date): string {
  // Returns YYYY-MM-DD
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function GET() {
  try {
    const now = new Date()
    const today = formatDate(now)

    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const sevenDaysAgoStr = formatDate(sevenDaysAgo)

    const fourteenDaysAgo = new Date(now)
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    const fourteenDaysAgoStr = formatDate(fourteenDaysAgo)

    const [totalRes, last7Res, prev7Res, todayRes] = await Promise.all([
      supabaseServer.from('events').select('*', { count: 'exact', head: true }),
      supabaseServer.from('events').select('*', { count: 'exact', head: true }).gte('fecha', sevenDaysAgoStr).lte('fecha', today),
      supabaseServer.from('events').select('*', { count: 'exact', head: true }).gte('fecha', fourteenDaysAgoStr).lt('fecha', sevenDaysAgoStr),
      supabaseServer.from('events').select('*', { count: 'exact', head: true }).eq('fecha', today),
    ])

    if (totalRes.error) throw totalRes.error
    if (last7Res.error) throw last7Res.error
    if (prev7Res.error) throw prev7Res.error
    if (todayRes.error) throw todayRes.error

    const totalEvents = totalRes.count || 0
    const eventsLast7Days = last7Res.count || 0
    const eventsPrev7Days = prev7Res.count || 0
    const eventsToday = todayRes.count || 0

    const growthPercent = eventsPrev7Days === 0
      ? (eventsLast7Days > 0 ? 100 : 0)
      : Math.round(((eventsLast7Days - eventsPrev7Days) / eventsPrev7Days) * 1000) / 10

    return NextResponse.json({
      success: true,
      data: {
        totalEvents,
        eventsLast7Days,
        eventsPrev7Days,
        growthPercent,
        eventsToday,
      },
    })
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error generating overview stats:', error)
    return NextResponse.json({ success: false, error: 'Failed to load stats' }, { status: 500 })
  }
}


