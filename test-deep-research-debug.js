/**
 * Debug Deep Research - Test individual components
 */

const { UnifiedSearchService } = require('./lib/services/unified-search.service');

async function testSearchComponents() {
  console.log('🔍 Testing Deep Research Components...\n');
  
  try {
    // Test 1: Verify search services work
    console.log('1. Testing UnifiedSearchService...');
    const searchService = new UnifiedSearchService();
    
    const availableServices = searchService.getAvailableServices();
    console.log('Available services:', availableServices);
    
    if (availableServices.length === 0) {
      console.error('❌ No search services available - this explains placeholder responses!');
      return;
    }
    
    // Test 2: Try a basic search
    console.log('\n2. Testing basic search...');
    const searchResults = await searchService.search('artificial intelligence machine learning', {
      maxResults: 3,
      timeout: 15000
    });
    
    console.log(`Found ${searchResults.length} search results:`);
    searchResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.title} (${result.source})`);
      console.log(`     URL: ${result.url}`);
      console.log(`     Snippet: ${result.snippet.substring(0, 100)}...`);
    });
    
    if (searchResults.length === 0) {
      console.error('❌ Search returned no results - this could cause placeholder responses');
      
      // Test each service individually
      console.log('\n3. Testing individual search services...');
      for (const serviceName of availableServices) {
        try {
          const results = await searchService.search('test query', {
            maxResults: 1,
            sources: [serviceName],
            timeout: 10000
          });
          console.log(`  ${serviceName}: ${results.length > 0 ? '✅ Working' : '❌ No results'}`);
        } catch (error) {
          console.log(`  ${serviceName}: ❌ Error - ${error.message}`);
        }
      }
    } else {
      console.log('✅ Search functionality working properly');
    }
    
    // Test 3: Check environment variables
    console.log('\n4. Checking API keys...');
    const envChecks = {
      'GOOGLE_SEARCH_API_KEY': !!process.env.GOOGLE_SEARCH_API_KEY,
      'GOOGLE_SEARCH_CSE_ID': !!process.env.GOOGLE_SEARCH_CSE_ID,
      'TAVILY_API_KEY': !!process.env.TAVILY_API_KEY,
      'LANGSEARCH_API_KEY': !!process.env.LANGSEARCH_API_KEY,
      'GROQ_API_KEY': !!process.env.GROQ_API_KEY,
      'GEMINI_API_KEY': !!process.env.GEMINI_API_KEY,
      'OPENAI_API_KEY': !!process.env.OPENAI_API_KEY
    };
    
    Object.entries(envChecks).forEach(([key, exists]) => {
      console.log(`  ${key}: ${exists ? '✅ Set' : '❌ Missing'}`);
    });
    
    console.log('\n🎯 Debug Summary:');
    console.log(`- Available search services: ${availableServices.length}`);
    console.log(`- Search results found: ${searchResults.length}`);
    console.log(`- Google Search configured: ${envChecks.GOOGLE_SEARCH_API_KEY && envChecks.GOOGLE_SEARCH_CSE_ID}`);
    console.log(`- AI Provider configured: ${envChecks.GROQ_API_KEY || envChecks.GEMINI_API_KEY || envChecks.OPENAI_API_KEY}`);
    
    if (searchResults.length > 0 && (envChecks.GROQ_API_KEY || envChecks.GEMINI_API_KEY || envChecks.OPENAI_API_KEY)) {
      console.log('\n✅ Both search and AI services appear to be configured correctly.');
      console.log('The placeholder responses may be due to AI provider call failures or JSON parsing issues.');
    } else {
      console.log('\n❌ Missing required configuration. This explains the placeholder responses.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Test AI Provider directly
async function testAIProvider() {
  console.log('\n5. Testing AI Provider...');
  
  try {
    // Try to import and test AI provider
    const { AIProviderService } = require('./lib/ai-providers');
    
    const testResponse = await AIProviderService.generateResponse(
      'Respond with exactly: "AI Provider Test Successful"',
      'groq',
      'llama-3.1-8b-instant'
    );
    
    console.log('AI Provider Response:', testResponse.content);
    console.log('✅ AI Provider working correctly');
    
  } catch (error) {
    console.error('❌ AI Provider test failed:', error.message);
    console.log('This could explain why Deep Research falls back to placeholder responses');
  }
}

// Run tests
async function runAllTests() {
  await testSearchComponents();
  await testAIProvider();
}

if (require.main === module) {
  runAllTests();
}

module.exports = { testSearchComponents, testAIProvider };
