/**
 * Test script for multi-source search integration
 */

const { UnifiedSearchService } = require('./lib/services/unified-search.service');

async function testMultiSourceSearch() {
  console.log('🔍 Testing Multi-Source Search Integration...\n');
  
  try {
    const searchService = new UnifiedSearchService();
    
    // Test 1: Check available services
    console.log('📋 Available Search Services:');
    const availableServices = searchService.getAvailableServices();
    availableServices.forEach(service => {
      console.log(`  ✓ ${service}`);
    });
    console.log();
    
    // Test 2: Test service availability
    console.log('🔧 Testing Service Availability:');
    const serviceStatus = await searchService.testServices();
    Object.entries(serviceStatus).forEach(([service, available]) => {
      console.log(`  ${available ? '✅' : '❌'} ${service}: ${available ? 'Available' : 'Unavailable'}`);
    });
    console.log();
    
    // Test 3: Basic web search
    console.log('🌐 Testing Basic Web Search:');
    const webResults = await searchService.search('artificial intelligence', {
      maxResults: 3,
      combineStrategy: 'weighted'
    });
    
    console.log(`Found ${webResults.length} results:`);
    webResults.slice(0, 2).forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title}`);
      console.log(`     Source: ${result.source} | Score: ${result.relevanceScore?.toFixed(2) || 'N/A'}`);
      console.log(`     URL: ${result.url}`);
      console.log();
    });
    
    // Test 4: Documentation search
    console.log('📚 Testing Documentation Search:');
    const docResults = await searchService.searchDocumentation('React hooks', 'react', {
      maxResults: 2
    });
    
    console.log(`Found ${docResults.length} documentation results:`);
    docResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title}`);
      console.log(`     Source: ${result.source}`);
      console.log(`     URL: ${result.url}`);
      console.log();
    });
    
    // Test 5: Scholar search
    console.log('🎓 Testing Scholar Search:');
    const scholarResults = await searchService.searchScholar('machine learning algorithms', {
      maxResults: 2
    });
    
    console.log(`Found ${scholarResults.length} scholar results:`);
    scholarResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title}`);
      console.log(`     Source: ${result.source}`);
      console.log(`     URL: ${result.url}`);
      console.log();
    });
    
    console.log('✅ Multi-source search integration test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
if (require.main === module) {
  testMultiSourceSearch();
}

module.exports = { testMultiSourceSearch };
