import { NextRequest, NextResponse } from 'next/server';
import { runDailyPricingAnalysis } from '@/lib/ai/IntelligentPricingAI';
import { supabaseServer } from '@/lib/supabaseServer';

/**
 * API endpoint para automatización diaria de pricing
 * POST /api/ai/daily-automation
 * 
 * Este endpoint se ejecuta automáticamente cada día para:
 * 1. Analizar eventos del día
 * 2. Generar recomendaciones de pricing
 * 3. Aplicar ajustes automáticos (opcional)
 * 4. Enviar notificaciones
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      targetDate, 
      autoApply = false, // Si debe aplicar automáticamente las recomendaciones
      notificationEmail = null // Email para notificaciones
    } = body;

    // Si no se proporciona fecha, usar hoy
    const analysisDate = targetDate || new Date().toISOString().split('T')[0];

    console.log(`🤖 Iniciando automatización diaria para ${analysisDate}`);

    // Obtener todos los hoteles activos
    const { data: hotels, error: hotelsError } = await supabaseServer
      .from('hotel_usuario')
      .select('DISTINCT user_id, hotel_name')
      .not('user_id', 'is', null);

    if (hotelsError) {
      throw hotelsError;
    }

    if (!hotels || hotels.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No hay hoteles activos para analizar',
        data: {
          analysisDate,
          hotelsAnalyzed: 0,
          recommendationsGenerated: 0,
          recommendationsApplied: 0
        }
      });
    }

    console.log(`📊 Analizando ${hotels.length} hoteles`);

    const results = {
      analysisDate,
      hotelsAnalyzed: 0,
      recommendationsGenerated: 0,
      recommendationsApplied: 0,
      errors: [] as string[],
      recommendations: [] as any[]
    };

    // Obtener API keys
    const apiKeys = {
      openai: process.env.OPENAI_API_KEY,
      googleSearch: process.env.GOOGLE_SEARCH_API_KEY,
      eventbrite: process.env.EVENTBRITE_API_KEY
    };

    // Analizar cada hotel
    for (const hotel of hotels) {
      try {
        console.log(`🏨 Analizando hotel: ${hotel.hotel_name}`);
        
        // Ejecutar análisis de IA
        const recommendation = await runDailyPricingAnalysis(
          analysisDate,
          hotel.user_id,
          apiKeys
        );

        results.hotelsAnalyzed++;
        results.recommendationsGenerated++;
        results.recommendations.push({
          hotelId: hotel.user_id,
          hotelName: hotel.hotel_name,
          recommendation
        });

        // Guardar análisis en base de datos
        await saveAnalysisToDatabase(hotel.user_id, analysisDate, recommendation);

        // Aplicar automáticamente si está habilitado
        if (autoApply && recommendation.confidence >= 80) {
          try {
            await applyRecommendation(hotel.user_id, analysisDate, recommendation);
            results.recommendationsApplied++;
            console.log(`✅ Recomendación aplicada para ${hotel.hotel_name}`);
          } catch (applyError) {
            results.errors.push(`Error aplicando recomendación para ${hotel.hotel_name}: ${applyError}`);
          }
        }

        // Pequeña pausa entre análisis para no sobrecargar
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (error) {
        const errorMessage = `Error analizando ${hotel.hotel_name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        results.errors.push(errorMessage);
        console.error(`❌ ${errorMessage}`);
      }
    }

    // Enviar notificación por email si está configurado
    if (notificationEmail) {
      try {
        await sendNotificationEmail(notificationEmail, results);
      } catch (emailError) {
        console.error('Error enviando notificación:', emailError);
      }
    }

    console.log(`✅ Automatización completada:`, results);

    return NextResponse.json({
      success: true,
      message: 'Automatización diaria completada',
      data: results
    });

  } catch (error) {
    console.error('❌ Error en automatización diaria:', error);
    
    return NextResponse.json({
      success: false,
      error: `Error en automatización: ${error instanceof Error ? error.message : 'Unknown error'}`,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Guarda el análisis en la base de datos
 */
async function saveAnalysisToDatabase(
  hotelId: string,
  analysisDate: string,
  recommendation: any
) {
  try {
    const { error } = await supabaseServer
      .from('ai_pricing_analysis')
      .insert({
        hotel_id: hotelId,
        analysis_date: analysisDate,
        current_price: recommendation.currentPrice,
        recommended_price: recommendation.recommendedPrice,
        price_change: recommendation.priceChange,
        price_change_percent: recommendation.priceChangePercent,
        confidence: recommendation.confidence,
        reasoning: recommendation.reasoning,
        expected_outcomes: recommendation.expectedOutcomes,
        risk_factors: recommendation.riskFactors,
        alternative_prices: recommendation.alternativePrices,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error('Error guardando análisis:', error);
    }
  } catch (error) {
    console.error('Error guardando análisis:', error);
  }
}

/**
 * Aplica la recomendación actualizando el precio en la base de datos
 */
async function applyRecommendation(
  hotelId: string,
  targetDate: string,
  recommendation: any
) {
  try {
    // Actualizar precio en hotel_usuario
    const { error } = await supabaseServer
      .from('hotel_usuario')
      .update({
        price: recommendation.recommendedPrice.toString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', hotelId)
      .eq('checkin_date', targetDate);

    if (error) {
      throw error;
    }

    // Registrar la aplicación en el historial
    await supabaseServer
      .from('ai_pricing_applications')
      .insert({
        hotel_id: hotelId,
        analysis_date: targetDate,
        applied_price: recommendation.recommendedPrice,
        previous_price: recommendation.currentPrice,
        price_change: recommendation.priceChange,
        confidence: recommendation.confidence,
        applied_at: new Date().toISOString()
      });

  } catch (error) {
    console.error('Error aplicando recomendación:', error);
    throw error;
  }
}

/**
 * Envía notificación por email con los resultados
 */
async function sendNotificationEmail(email: string, results: any) {
  // Implementar envío de email
  // Por ahora solo log
  console.log(`📧 Enviando notificación a ${email}:`, {
    hotelsAnalyzed: results.hotelsAnalyzed,
    recommendationsGenerated: results.recommendationsGenerated,
    recommendationsApplied: results.recommendationsApplied,
    errors: results.errors.length
  });
}

/**
 * GET endpoint para obtener estadísticas de automatización
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    // Obtener estadísticas de análisis
    let query = supabaseServer
      .from('ai_pricing_analysis')
      .select('*')
      .order('analysis_date', { ascending: false });

    if (startDate) {
      query = query.gte('analysis_date', startDate);
    }

    if (endDate) {
      query = query.lte('analysis_date', endDate);
    }

    const { data: analyses, error: analysesError } = await query.limit(100);

    if (analysesError) {
      throw analysesError;
    }

    // Obtener estadísticas de aplicaciones
    let applicationsQuery = supabaseServer
      .from('ai_pricing_applications')
      .select('*')
      .order('applied_at', { ascending: false });

    if (startDate) {
      applicationsQuery = applicationsQuery.gte('analysis_date', startDate);
    }

    if (endDate) {
      applicationsQuery = applicationsQuery.lte('analysis_date', endDate);
    }

    const { data: applications, error: applicationsError } = await applicationsQuery.limit(100);

    if (applicationsError) {
      throw applicationsError;
    }

    // Calcular estadísticas
    const stats = {
      totalAnalyses: analyses?.length || 0,
      totalApplications: applications?.length || 0,
      averageConfidence: analyses?.length > 0 
        ? analyses.reduce((sum, analysis) => sum + analysis.confidence, 0) / analyses.length 
        : 0,
      averagePriceChange: analyses?.length > 0
        ? analyses.reduce((sum, analysis) => sum + analysis.price_change_percent, 0) / analyses.length
        : 0,
      successRate: analyses?.length > 0 && applications?.length > 0
        ? (applications.length / analyses.length) * 100
        : 0
    };

    return NextResponse.json({
      success: true,
      data: {
        stats,
        analyses: analyses || [],
        applications: applications || [],
        startDate,
        endDate
      }
    });

  } catch (error) {
    console.error('❌ Error obteniendo estadísticas:', error);
    
    return NextResponse.json({
      success: false,
      error: `Error obteniendo estadísticas: ${error instanceof Error ? error.message : 'Unknown error'}`
    }, { status: 500 });
  }
}
