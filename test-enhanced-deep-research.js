const { DeepResearchService } = require('./lib/services/deep-research.service.ts')

async function testEnhancedDeepResearch() {
  console.log('🧪 Testing Enhanced Deep Research System')
  console.log('='.repeat(50))
  
  try {
    // Test configuration
    const config = {
      provider: 'groq',
      model: 'llama-3.1-70b-versatile',
      max_iterations: 2,
      max_agent_iterations: 3
    }
    
    const deepResearch = new DeepResearchService(config)
    
    // Test query
    const query = "Latest developments in AI agent coordination and multi-agent systems"
    
    console.log(`🔍 Testing query: "${query}"`)
    console.log('\n📋 Expected improvements:')
    console.log('- Enhanced tool call parsing')
    console.log('- Forced research fallbacks')  
    console.log('- Mandatory search execution')
    console.log('- Comprehensive error handling')
    
    const startTime = Date.now()
    
    // Run deep research
    const result = await deepResearch.conductDeepResearch(query)
    
    const duration = Date.now() - startTime
    
    console.log('\n🎯 Results Analysis:')
    console.log(`⏱️  Duration: ${duration}ms`)
    console.log(`📄 Brief length: ${result.research_brief?.length || 0} characters`)
    console.log(`📊 Final report length: ${result.final_report?.length || 0} characters`)
    
    // Check for improvements
    const hasFindings = result.final_report && 
                       result.final_report.includes('Findings Summary') && 
                       !result.final_report.includes('No findings available')
    
    console.log(`✅ Has actual findings: ${hasFindings}`)
    
    if (hasFindings) {
      console.log('\n🎉 SUCCESS: Enhanced Deep Research working!')
      console.log('📈 Research now generates actual content instead of placeholders')
    } else {
      console.log('\n❌ ISSUE: Still generating empty findings')
      console.log('🔧 Further debugging needed')
    }
    
    // Show sample of results
    console.log('\n📖 Sample Output:')
    console.log('Research Brief:', result.research_brief?.substring(0, 200) + '...')
    console.log('Final Report:', result.final_report?.substring(0, 300) + '...')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    console.error('🔍 Stack trace:', error.stack)
  }
}

// Run test
testEnhancedDeepResearch()
