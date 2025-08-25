// Simple test to verify Deep Research enhancements
async function testDeepResearchFixes() {
  console.log('🧪 Testing Deep Research Fixes')
  console.log('='.repeat(40))
  
  try {
    // Test the API endpoint directly
    const response = await fetch('http://localhost:3000/api/deep-research', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'AI agent coordination methods',
        provider: 'groq',
        model: 'llama-3.1-70b-versatile',
        max_iterations: 2
      })
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const result = await response.json()
    
    console.log('✅ API Response received')
    console.log(`📄 Brief length: ${result.research_brief?.length || 0}`)
    console.log(`📊 Final report length: ${result.final_report?.length || 0}`)
    
    // Check if findings are present
    const hasFindings = result.final_report && 
                       result.final_report.includes('## Findings Summary') && 
                       !result.final_report.includes('No findings available')
    
    console.log(`🔍 Has actual findings: ${hasFindings}`)
    
    if (hasFindings) {
      console.log('🎉 SUCCESS: Deep Research generating real content!')
    } else {
      console.log('❌ ISSUE: Still empty findings - need more debugging')
    }
    
    return result
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    return null
  }
}

// For Node.js environment
if (typeof window === 'undefined') {
  const fetch = require('node-fetch')
  testDeepResearchFixes()
}
