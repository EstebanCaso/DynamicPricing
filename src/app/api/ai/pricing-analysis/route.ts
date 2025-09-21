import { NextRequest, NextResponse } from 'next/server';
import { runDailyPricingAnalysis, runMultiDayAnalysis } from '@/lib/ai/IntelligentPricingAI';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * API endpoint para análisis automático de pricing con IA
 * POST /api/ai/pricing-analysis
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      targetDate, 
      endDate, 
      hotelId, 
      mode = 'single' // 'single' o 'multi'
    } = body;

    // Validar parámetros requeridos
    if (!targetDate || !hotelId) {
      return NextResponse.json({
        success: false,
        error: 'targetDate y hotelId son requeridos'
      }, { status: 400 });
    }

    // Validar formato de fecha
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(targetDate)) {
      return NextResponse.json({
        success: false,
        error: 'Formato de fecha inválido. Use YYYY-MM-DD'
      }, { status: 400 });
    }

    // Obtener API keys del entorno
    const apiKeys = {
      openai: process.env.OPENAI_API_KEY,
      googleSearch: process.env.GOOGLE_SEARCH_API_KEY,
      eventbrite: process.env.EVENTBRITE_API_KEY
    };

    console.log(`🤖 Iniciando análisis de IA para ${targetDate}`);

    let recommendations;

    if (mode === 'multi' && endDate) {
      // Análisis multi-día
      if (!dateRegex.test(endDate)) {
        return NextResponse.json({
          success: false,
          error: 'Formato de endDate inválido. Use YYYY-MM-DD'
        }, { status: 400 });
      }

      recommendations = await runMultiDayAnalysis(targetDate, endDate, hotelId, apiKeys);
    } else {
      // Análisis de un solo día
      recommendations = await runDailyPricingAnalysis(targetDate, hotelId, apiKeys);
    }

    console.log(`✅ Análisis completado. Recomendaciones: ${Array.isArray(recommendations) ? recommendations.length : 1}`);

    return NextResponse.json({
      success: true,
      data: {
        mode,
        targetDate,
        endDate: mode === 'multi' ? endDate : undefined,
        hotelId,
        recommendations: Array.isArray(recommendations) ? recommendations : [recommendations],
        timestamp: new Date().toISOString(),
        aiVersion: '1.0.0'
      }
    });

  } catch (error) {
    console.error('❌ Error en análisis de IA:', error);
    
    return NextResponse.json({
      success: false,
      error: `Error en análisis de IA: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * API endpoint para obtener historial de análisis de IA
 * GET /api/ai/pricing-analysis?hotelId=xxx&startDate=xxx&endDate=xxx
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hotelId = searchParams.get('hotelId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (!hotelId) {
      return NextResponse.json({
        success: false,
        error: 'hotelId es requerido'
      }, { status: 400 });
    }

    // Construir query para obtener historial de análisis
    let query = supabaseServer
      .from('ai_pricing_analysis')
      .select('*')
      .eq('hotel_id', hotelId)
      .order('analysis_date', { ascending: false });

    if (startDate) {
      query = query.gte('analysis_date', startDate);
    }

    if (endDate) {
      query = query.lte('analysis_date', endDate);
    }

    const { data, error } = await query.limit(100);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      data: {
        analyses: data || [],
        count: data?.length || 0,
        hotelId,
        startDate,
        endDate
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo historial de análisis:', error);
    
    return NextResponse.json({
      success: false,
      error: `Error obteniendo historial: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}
