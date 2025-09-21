#!/usr/bin/env node

/**
 * Script de automatización diaria para análisis de pricing con IA
 * 
 * Este script se ejecuta automáticamente cada día para:
 * 1. Analizar eventos del día
 * 2. Generar recomendaciones de pricing
 * 3. Aplicar ajustes automáticos (opcional)
 * 4. Enviar notificaciones
 * 
 * Uso:
 * node scripts/daily-ai-automation.js [--auto-apply] [--email=notifications@hotel.com]
 */

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

interface AutomationConfig {
  autoApply: boolean;
  notificationEmail?: string;
  targetDate?: string;
  baseUrl: string;
}

interface AutomationResult {
  success: boolean;
  data?: {
    analysisDate: string;
    hotelsAnalyzed: number;
    recommendationsGenerated: number;
    recommendationsApplied: number;
    errors: string[];
  };
  error?: string;
}

class DailyAIAutomation {
  private config: AutomationConfig;

  constructor(config: AutomationConfig) {
    this.config = config;
  }

  async run(): Promise<void> {
    console.log('🤖 Iniciando automatización diaria de IA...');
    console.log(`📅 Fecha objetivo: ${this.config.targetDate || 'hoy'}`);
    console.log(`🚀 Auto-aplicar: ${this.config.autoApply ? 'SÍ' : 'NO'}`);
    
    if (this.config.notificationEmail) {
      console.log(`📧 Notificaciones: ${this.config.notificationEmail}`);
    }

    try {
      const response = await fetch(`${this.config.baseUrl}/api/ai/daily-automation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          targetDate: this.config.targetDate,
          autoApply: this.config.autoApply,
          notificationEmail: this.config.notificationEmail
        }),
      });

      const result: AutomationResult = await response.json() as AutomationResult;

      if (!result.success) {
        throw new Error(result.error || 'Error desconocido en automatización');
      }

      if (result.data) {
        console.log('\n✅ Automatización completada exitosamente:');
        console.log(`   📊 Hoteles analizados: ${result.data.hotelsAnalyzed}`);
        console.log(`   💡 Recomendaciones generadas: ${result.data.recommendationsGenerated}`);
        console.log(`   🚀 Recomendaciones aplicadas: ${result.data.recommendationsApplied}`);
        
        if (result.data.errors.length > 0) {
          console.log(`   ⚠️  Errores encontrados: ${result.data.errors.length}`);
          result.data.errors.forEach((error, index) => {
            console.log(`      ${index + 1}. ${error}`);
          });
        }

        // Calcular métricas de éxito
        const successRate = result.data.hotelsAnalyzed > 0 
          ? (result.data.recommendationsGenerated / result.data.hotelsAnalyzed) * 100 
          : 0;
        
        const applicationRate = result.data.recommendationsGenerated > 0
          ? (result.data.recommendationsApplied / result.data.recommendationsGenerated) * 100
          : 0;

        console.log(`\n📈 Métricas de rendimiento:`);
        console.log(`   🎯 Tasa de éxito: ${successRate.toFixed(1)}%`);
        console.log(`   🚀 Tasa de aplicación: ${applicationRate.toFixed(1)}%`);
      }

    } catch (error) {
      console.error('❌ Error en automatización:', error);
      process.exit(1);
    }
  }

  async getStats(): Promise<void> {
    console.log('📊 Obteniendo estadísticas de automatización...');

    try {
      const response = await fetch(`${this.config.baseUrl}/api/ai/daily-automation`, {
        method: 'GET',
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Error obteniendo estadísticas');
      }

      if (result.data) {
        console.log('\n📈 Estadísticas de automatización:');
        console.log(`   📊 Total de análisis: ${result.data.stats.totalAnalyses}`);
        console.log(`   🚀 Total de aplicaciones: ${result.data.stats.totalApplications}`);
        console.log(`   🎯 Confianza promedio: ${result.data.stats.averageConfidence.toFixed(1)}%`);
        console.log(`   📈 Cambio de precio promedio: ${result.data.stats.averagePriceChange.toFixed(1)}%`);
        console.log(`   ✅ Tasa de éxito: ${result.data.stats.successRate.toFixed(1)}%`);
      }

    } catch (error) {
      console.error('❌ Error obteniendo estadísticas:', error);
    }
  }
}

// Función principal
async function main() {
  const args = process.argv.slice(2);
  
  // Parsear argumentos
  const config: AutomationConfig = {
    autoApply: args.includes('--auto-apply'),
    baseUrl: process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  };

  // Buscar email en argumentos
  const emailArg = args.find(arg => arg.startsWith('--email='));
  if (emailArg) {
    config.notificationEmail = emailArg.split('=')[1];
  }

  // Buscar fecha en argumentos
  const dateArg = args.find(arg => arg.startsWith('--date='));
  if (dateArg) {
    config.targetDate = dateArg.split('=')[1];
  }

  // Verificar si es comando de estadísticas
  if (args.includes('--stats')) {
    const automation = new DailyAIAutomation(config);
    await automation.getStats();
    return;
  }

  // Ejecutar automatización
  const automation = new DailyAIAutomation(config);
  await automation.run();
}

// Manejar errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Error no manejado:', reason);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Excepción no capturada:', error);
  process.exit(1);
});

// Ejecutar si es el archivo principal
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Error en ejecución:', error);
    process.exit(1);
  });
}

export { DailyAIAutomation };
