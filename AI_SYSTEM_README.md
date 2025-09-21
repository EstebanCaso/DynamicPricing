# 🤖 Sistema de IA Inteligente para Pricing Dinámico

Este sistema implementa **Inteligencia Artificial verdaderamente inteligente** que analiza eventos, competencia y mercado para ajustar precios automáticamente cada día.

## ✨ Características Principales

### 🧠 **IA Verdaderamente Inteligente**
- **Análisis de eventos en tiempo real** - Busca información de eventos en internet
- **Identificación automática de competidores** - Usa IA para encontrar competidores directos
- **Razonamiento inteligente** - Genera explicaciones detalladas de cada decisión
- **Aprendizaje continuo** - Mejora con cada análisis y resultado

### 🎯 **Análisis Automático Diario**
- **Cada día analiza** eventos del día
- **Busca información** en internet sobre cada evento
- **Identifica competidores** directos automáticamente
- **Razona** sobre pricing sin reglas hardcodeadas
- **Ajusta precios** automáticamente
- **Aprende** de los resultados

### 📊 **Datos que Analiza la IA**
- **Eventos**: Tipo, asistencia esperada, audiencia objetivo, buzz en redes sociales
- **Competencia**: Precios actuales, tendencias, estrategias, amenazas
- **Mercado**: Demanda, oferta, oportunidades, volatilidad
- **Histórico**: Performance pasada, patrones de éxito/fracaso

## 🚀 Cómo Funciona

### 1. **Análisis de Eventos**
```typescript
// La IA analiza cada evento automáticamente
const eventAnalysis = await ai.analyzeEvent(event);
// Resultado: tipo, audiencia, demanda esperada, impacto en precio
```

### 2. **Identificación de Competidores**
```typescript
// La IA identifica competidores directos automáticamente
const competitors = await ai.identifyCompetitors(event, ourHotel);
// Resultado: competidores directos, amenazas, oportunidades
```

### 3. **Razonamiento Inteligente**
```typescript
// La IA razona sobre pricing sin reglas hardcodeadas
const reasoning = await ai.reasonAboutPricing(context);
// Resultado: precio óptimo, explicación detallada, confianza
```

### 4. **Aplicación Automática**
```typescript
// La IA aplica recomendaciones automáticamente
await ai.applyRecommendation(recommendation);
// Resultado: precio actualizado, aprendizaje del resultado
```

## 📁 Estructura del Sistema

```
src/
├── lib/ai/
│   └── IntelligentPricingAI.ts          # Motor principal de IA
├── app/api/ai/
│   ├── pricing-analysis/route.ts        # API para análisis de IA
│   └── daily-automation/route.ts       # API para automatización diaria
├── components/
│   ├── IntelligentPricingCard.tsx      # Componente de IA para frontend
│   └── CalendarTab.tsx                 # Integración con calendario
└── scripts/
    ├── daily-ai-automation.js           # Script de automatización
    └── cron-config.txt                  # Configuración de cron jobs
```

## 🔧 Configuración

### Variables de Entorno Requeridas
```bash
# APIs de IA (opcionales para funcionalidad básica)
OPENAI_API_KEY=tu-api-key
GOOGLE_SEARCH_API_KEY=tu-api-key
EVENTBRITE_API_KEY=tu-api-key

# URL base de la aplicación
NEXT_PUBLIC_BASE_URL=https://tu-dominio.com
```

### Instalación
1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Configurar variables de entorno**:
   ```bash
   cp .env.example .env.local
   # Editar .env.local con tus API keys
   ```

3. **Ejecutar en desarrollo**:
   ```bash
   npm run dev
   ```

## 🤖 Uso del Sistema de IA

### **Uso Manual**
1. Ve al **Calendar Tab**
2. Selecciona una fecha
3. Haz clic en **"Análisis Inteligente de IA"**
4. La IA analizará eventos y competencia
5. Revisa las recomendaciones
6. Aplica las recomendaciones

### **Uso Automático**
1. **Configurar cron job**:
   ```bash
   # Editar crontab
   crontab -e
   
   # Agregar línea para ejecutar diariamente a las 6 AM
   0 6 * * * cd /path/to/DynamicPricing && node scripts/daily-ai-automation.js --auto-apply
   ```

2. **El sistema ejecutará automáticamente**:
   - Análisis de eventos del día
   - Identificación de competidores
   - Generación de recomendaciones
   - Aplicación automática (si está habilitado)
   - Envío de notificaciones

## 📊 APIs Disponibles

### **Análisis de IA**
```bash
POST /api/ai/pricing-analysis
{
  "targetDate": "2024-01-15",
  "hotelId": "hotel-uuid",
  "mode": "single" // o "multi"
}
```

### **Automatización Diaria**
```bash
POST /api/ai/daily-automation
{
  "targetDate": "2024-01-15",
  "autoApply": true,
  "notificationEmail": "admin@hotel.com"
}
```

### **Estadísticas**
```bash
GET /api/ai/daily-automation?startDate=2024-01-01&endDate=2024-01-31
```

## 🧠 Tipos de Análisis que Realiza la IA

### **1. Análisis de Eventos**
- **Tipo de evento**: Concierto, conferencia, deporte, festival, etc.
- **Audiencia objetivo**: Jóvenes, profesionales, familias, etc.
- **Demanda esperada**: Basada en asistencia, buzz, histórico
- **Impacto en precio**: Multiplicador calculado por IA

### **2. Análisis de Competencia**
- **Competidores directos**: Identificados automáticamente por IA
- **Estrategias de pricing**: Premium, competitivo, budget, dinámico
- **Amenazas**: Nivel de amenaza calculado por IA
- **Oportunidades**: Gaps de mercado identificados

### **3. Análisis de Mercado**
- **Demanda del mercado**: Baja, media, alta, extrema
- **Disponibilidad de oferta**: Abundante, moderada, limitada, escasa
- **Tendencias de precios**: Decreciente, estable, creciente, volátil
- **Oportunidad de mercado**: Calculada por IA (0-1)

## 🎯 Ejemplo de Razonamiento de la IA

```typescript
const reasoning = {
  eventAnalysis: {
    type: "Concierto de Bad Bunny",
    expectedAttendance: 50000,
    targetAudience: ["jóvenes", "adultos"],
    socialMediaBuzz: "Alto (trending en Twitter)",
    historicalSimilarEvents: "Aumento promedio de 40% en precios"
  },
  
  competitorAnalysis: {
    directCompetitors: [
      { name: "Hotel Marriott", distance: "2km", currentPrice: "$180", strategy: "Premium" },
      { name: "Hotel Holiday Inn", distance: "3km", currentPrice: "$120", strategy: "Competitive" }
    ],
    competitiveThreat: "Medium",
    marketDynamics: "Demanda alta, oferta limitada"
  },
  
  intelligentReasoning: {
    optimalPrice: "$220",
    confidence: 87,
    explanation: [
      "El evento de Bad Bunny tiene alta demanda (50k asistentes) y público con alto poder adquisitivo",
      "Los competidores directos están en rango $120-180, pero el evento justifica precio premium",
      "El buzz en redes sociales indica alta demanda anticipada",
      "Eventos similares históricamente han aumentado precios 40% en promedio",
      "La distancia del hotel (1.5km) es ventajosa vs competencia",
      "Recomiendo precio $220 para maximizar revenue sin perder competitividad"
    ],
    expectedOutcomes: {
      revenue: "+35%",
      occupancy: "+25%",
      competitiveness: "Maintain"
    }
  }
};
```

## 🔄 Sistema de Aprendizaje

La IA aprende continuamente de:

1. **Resultados de recomendaciones**: Compara predicciones vs resultados reales
2. **Patrones de éxito/fracaso**: Identifica qué funciona y qué no
3. **Cambios en el mercado**: Adapta estrategias según condiciones
4. **Feedback del usuario**: Mejora basada en acciones del usuario

## 📈 Monitoreo y Alertas

### **Métricas que Monitorea**
- **Tasa de éxito**: % de recomendaciones que generan resultados positivos
- **Confianza promedio**: Nivel de confianza de las recomendaciones
- **Precisión de predicciones**: Qué tan acertadas son las predicciones
- **Impacto en revenue**: Mejora en ingresos por recomendaciones

### **Alertas Automáticas**
- **Baja confianza**: Cuando la IA no está segura de sus recomendaciones
- **Errores en análisis**: Cuando hay problemas técnicos
- **Cambios drásticos**: Cuando detecta cambios inusuales en el mercado
- **Oportunidades perdidas**: Cuando identifica oportunidades no aprovechadas

## 🛠️ Troubleshooting

### **Problemas Comunes**

1. **La IA no encuentra eventos**:
   - Verificar que la tabla `events` tiene datos
   - Verificar que las fechas están en formato correcto

2. **La IA no identifica competidores**:
   - Verificar que la tabla `hoteles_parallel` tiene datos
   - Verificar que los datos de competidores están actualizados

3. **Recomendaciones con baja confianza**:
   - La IA necesita más datos históricos
   - Verificar que los datos de eventos son completos

4. **Cron job no funciona**:
   - Verificar permisos del script
   - Verificar variables de entorno
   - Verificar que la API está funcionando

### **Logs y Debugging**
```bash
# Ver logs del sistema
tail -f /var/log/cron

# Ejecutar análisis manual para debug
node scripts/daily-ai-automation.js --date=2024-01-15

# Verificar API
curl -X POST https://tu-dominio.com/api/ai/pricing-analysis \
  -H "Content-Type: application/json" \
  -d '{"targetDate":"2024-01-15","hotelId":"test"}'
```

## 🚀 Próximas Mejoras

### **Fase 2: IA Avanzada**
- **Integración con APIs externas** (Google Search, Eventbrite, etc.)
- **Análisis de sentimientos** en redes sociales
- **Predicción de demanda** más precisa
- **Optimización multi-objetivo** avanzada

### **Fase 3: Machine Learning**
- **Modelos de ML** para predicciones más precisas
- **Aprendizaje profundo** para patrones complejos
- **Optimización automática** de hiperparámetros
- **Predicción de series temporales** para tendencias

## 📞 Soporte

Si tienes problemas o preguntas sobre el sistema de IA:

1. **Revisar logs** para identificar errores
2. **Verificar configuración** de variables de entorno
3. **Ejecutar análisis manual** para debug
4. **Consultar documentación** de APIs externas

---

**¡El sistema de IA está listo para analizar eventos y ajustar precios automáticamente cada día!** 🎉
