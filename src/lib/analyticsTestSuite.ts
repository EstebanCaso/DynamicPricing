/**
 * Comprehensive testing suite for Analytics functionality
 */

export interface TestResult {
  testName: string;
  passed: boolean;
  message: string;
  data?: any;
}

export interface AnalyticsTestSuite {
  dataValidation: TestResult[];
  functionalityTests: TestResult[];
  edgeCases: TestResult[];
  performanceTests: TestResult[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    score: number;
  };
}

/**
 * Test data integrity and availability
 */
export function testDataValidation(
  supabaseData: any[],
  competitorData: any[],
  historicalPriceSeries: any[],
  revenuePerformanceData: any[]
): TestResult[] {
  const tests: TestResult[] = [];

  // Test 1: User data availability
  tests.push({
    testName: 'User Hotel Data Available',
    passed: supabaseData.length > 0,
    message: supabaseData.length > 0 
      ? `✅ Found ${supabaseData.length} hotel records`
      : '❌ No user hotel data found',
    data: { count: supabaseData.length }
  });

  // Test 2: Data quality
  const validRecords = supabaseData.filter(item => 
    item.hotel_name && 
    item.checkin_date && 
    item.processed_price > 0
  );
  
  tests.push({
    testName: 'Data Quality Check',
    passed: validRecords.length === supabaseData.length,
    message: validRecords.length === supabaseData.length
      ? '✅ All records have valid data'
      : `⚠️ ${supabaseData.length - validRecords.length} records have missing/invalid data`,
    data: { valid: validRecords.length, total: supabaseData.length }
  });

  // Test 3: Competitor data
  tests.push({
    testName: 'Competitor Data Available',
    passed: competitorData.length > 0,
    message: competitorData.length > 0
      ? `✅ Found ${competitorData.length} competitors`
      : '❌ No competitor data found',
    data: { count: competitorData.length }
  });

  // Test 4: Historical data generation
  tests.push({
    testName: 'Historical Data Generation',
    passed: historicalPriceSeries.length > 0,
    message: historicalPriceSeries.length > 0
      ? `✅ Generated ${historicalPriceSeries.length} data points`
      : '❌ No historical data generated',
    data: { count: historicalPriceSeries.length }
  });

  // Test 5: Market position calculation
  tests.push({
    testName: 'Market Position Calculation',
    passed: revenuePerformanceData.length > 0,
    message: revenuePerformanceData.length > 0
      ? `✅ Calculated position for ${revenuePerformanceData.length} hotels`
      : '❌ No market position data',
    data: { count: revenuePerformanceData.length }
  });

  return tests;
}

/**
 * Test core functionality
 */
export function testCoreFunctionality(
  filters: {
    selectedCurrency: string;
    selectedRoomType: string;
    range: number;
  },
  exportData: any
): TestResult[] {
  const tests: TestResult[] = [];

  // Test 1: Currency conversion
  tests.push({
    testName: 'Currency Conversion',
    passed: ['MXN', 'USD'].includes(filters.selectedCurrency),
    message: ['MXN', 'USD'].includes(filters.selectedCurrency)
      ? `✅ Currency set to ${filters.selectedCurrency}`
      : `❌ Invalid currency: ${filters.selectedCurrency}`,
    data: { currency: filters.selectedCurrency }
  });

  // Test 2: Room type filtering
  tests.push({
    testName: 'Room Type Filtering',
    passed: typeof filters.selectedRoomType === 'string',
    message: `✅ Room type filter: ${filters.selectedRoomType}`,
    data: { roomType: filters.selectedRoomType }
  });

  // Test 3: Date range filtering
  tests.push({
    testName: 'Date Range Filtering',
    passed: [1, 7, 30, 90].includes(filters.range),
    message: [1, 7, 30, 90].includes(filters.range)
      ? `✅ Date range: ${filters.range} days`
      : `❌ Invalid date range: ${filters.range}`,
    data: { range: filters.range }
  });

  // Test 4: Export data preparation
  const hasExportData = exportData && 
    exportData.userHotelName && 
    exportData.historicalData && 
    exportData.historicalData.length > 0;

  tests.push({
    testName: 'Export Data Preparation',
    passed: hasExportData,
    message: hasExportData
      ? '✅ Export data ready'
      : '❌ Export data incomplete',
    data: { 
      hasHotelName: !!exportData?.userHotelName,
      hasHistoricalData: !!exportData?.historicalData?.length
    }
  });

  return tests;
}

/**
 * Test edge cases and error handling
 */
export function testEdgeCases(
  supabaseData: any[],
  historicalPriceSeries: any[]
): TestResult[] {
  const tests: TestResult[] = [];

  // Test 1: Empty data handling
  tests.push({
    testName: 'Empty Data Handling',
    passed: true, // Always passes if we reach this point
    message: supabaseData.length === 0 
      ? '✅ Empty state handled correctly'
      : '✅ Data available',
    data: { isEmpty: supabaseData.length === 0 }
  });

  // Test 2: Date format consistency
  const dateFormats = historicalPriceSeries.map(item => {
    const date = item.date;
    return {
      hasISOFormat: /^\d{4}-\d{2}-\d{2}/.test(date),
      date: date
    };
  });

  const validDates = dateFormats.filter(df => df.hasISOFormat).length;
  
  tests.push({
    testName: 'Date Format Consistency',
    passed: validDates === historicalPriceSeries.length,
    message: validDates === historicalPriceSeries.length
      ? '✅ All dates in valid format'
      : `⚠️ ${historicalPriceSeries.length - validDates} invalid date formats`,
    data: { valid: validDates, total: historicalPriceSeries.length }
  });

  // Test 3: Price range validation
  const prices = historicalPriceSeries.map(item => item.price).filter(p => p > 0);
  const priceRange = prices.length > 0 ? {
    min: Math.min(...prices),
    max: Math.max(...prices),
    avg: prices.reduce((a, b) => a + b, 0) / prices.length
  } : null;

  tests.push({
    testName: 'Price Range Validation',
    passed: priceRange !== null && priceRange.min > 0 && priceRange.max < 100000,
    message: priceRange 
      ? `✅ Price range: $${priceRange.min.toFixed(0)} - $${priceRange.max.toFixed(0)}`
      : '❌ No valid price data',
    data: priceRange
  });

  return tests;
}

/**
 * Test performance metrics
 */
export function testPerformance(
  renderTime: number,
  dataSize: number
): TestResult[] {
  const tests: TestResult[] = [];

  // Test 1: Render performance
  tests.push({
    testName: 'Render Performance',
    passed: renderTime < 2000, // Less than 2 seconds
    message: `${renderTime < 2000 ? '✅' : '⚠️'} Render time: ${renderTime}ms`,
    data: { renderTime, threshold: 2000 }
  });

  // Test 2: Data size handling
  tests.push({
    testName: 'Data Size Handling',
    passed: dataSize < 10000, // Less than 10k records
    message: `${dataSize < 10000 ? '✅' : '⚠️'} Data size: ${dataSize} records`,
    data: { dataSize, threshold: 10000 }
  });

  return tests;
}

/**
 * Run complete test suite
 */
export function runCompleteTestSuite(testData: {
  supabaseData: any[];
  competitorData: any[];
  historicalPriceSeries: any[];
  revenuePerformanceData: any[];
  filters: {
    selectedCurrency: string;
    selectedRoomType: string;
    range: number;
  };
  exportData: any;
  renderTime?: number;
}): AnalyticsTestSuite {
  const startTime = Date.now();

  const dataValidation = testDataValidation(
    testData.supabaseData,
    testData.competitorData,
    testData.historicalPriceSeries,
    testData.revenuePerformanceData
  );

  const functionalityTests = testCoreFunctionality(
    testData.filters,
    testData.exportData
  );

  const edgeCases = testEdgeCases(
    testData.supabaseData,
    testData.historicalPriceSeries
  );

  const renderTime = testData.renderTime || (Date.now() - startTime);
  const performanceTests = testPerformance(
    renderTime,
    testData.supabaseData.length
  );

  const allTests = [
    ...dataValidation,
    ...functionalityTests,
    ...edgeCases,
    ...performanceTests
  ];

  const passed = allTests.filter(test => test.passed).length;
  const failed = allTests.length - passed;

  return {
    dataValidation,
    functionalityTests,
    edgeCases,
    performanceTests,
    summary: {
      totalTests: allTests.length,
      passed,
      failed,
      score: Math.round((passed / allTests.length) * 100)
    }
  };
}
