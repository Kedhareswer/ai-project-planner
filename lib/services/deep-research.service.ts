/**
 * Deep Research Service
 * Complete TypeScript implementation of multi-agent deep research system
 */

import { AIProviderService } from '@/lib/ai-providers'
import { UnifiedSearchService } from './unified-search.service'
import type { 
  ResearchState, 
  ResearchMessage, 
  ClarificationResult, 
  ResearchBrief, 
  DeepResearchResult, 
  DeepResearchConfig,
  ResearchAgent,
  ToolCall,
  SearchQuery
} from './deep-research.types'

export class DeepResearchService {
  private searchService: UnifiedSearchService
  private config: DeepResearchConfig

  constructor(config: DeepResearchConfig) {
    this.config = config
    this.searchService = new UnifiedSearchService()
  }

  /**
   * Main entry point for deep research
   */
  async conductDeepResearch(query: string): Promise<DeepResearchResult> {
    try {
      const state: ResearchState = {
        messages: [{ role: 'user', content: query }],
        notes: [],
        raw_notes: [],
        supervisor_messages: [],
        research_iterations: 0
      }

      // Step 1: Clarify user intent
      const clarification = await this.clarifyUserIntent(state)
      if (clarification.need_clarification) {
        return {
          success: false,
          error: 'Clarification needed',
          details: clarification.question
        }
      }

      // Step 2: Generate research brief
      const brief = await this.generateResearchBrief(state)
      state.research_brief = brief.research_brief

      // Step 3: Conduct multi-agent research
      const researchResults = await this.conductMultiAgentResearch(state)
      state.notes = researchResults.notes
      state.raw_notes = researchResults.raw_notes

      // Step 4: Generate final report
      const finalReport = await this.generateFinalReport(state)

      return {
        success: true,
        research_brief: state.research_brief,
        final_report: finalReport,
        notes: state.notes,
        raw_notes: state.raw_notes,
        config: this.config
      }

    } catch (error) {
      console.error('Deep research error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        config: this.config
      }
    }
  }

  /**
   * Step 1: Clarify user intent
   */
  private async clarifyUserIntent(state: ResearchState): Promise<ClarificationResult> {
    const prompt = `You are an expert research coordinator. Analyze this user request and determine if it contains sufficient information to proceed with comprehensive research.

User request: "${state.messages[0].content}"

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}

Respond with a JSON object containing:
- "need_clarification": boolean (true if the request is too vague or needs more context)
- "question": string (if clarification needed, what specific question to ask)
- "verification": string (if no clarification needed, confirm what you understand)

The request should be specific enough to conduct meaningful research. Look for:
- Clear research topic or question
- Sufficient context about what type of information is needed
- Reasonable scope (not too broad or too narrow)

Examples that need clarification:
- "Tell me about AI" (too broad)
- "Research this" (no topic specified)
- "What's new?" (no context)

Examples that are sufficient:
- "Analyze current techniques for few-shot text-to-SQL with practical recommendations"
- "Research the impact of remote work on software development productivity"
- "Investigate recent advances in quantum computing applications for cryptography"`

    try {
      const response = await AIProviderService.generateResponse(
        prompt,
        this.config.provider as any,
        this.config.model
      )

      const result = JSON.parse(response.content)
      return result as ClarificationResult
    } catch (error) {
      // Fallback: assume no clarification needed
      return {
        need_clarification: false,
        verification: "Proceeding with research based on the provided query."
      }
    }
  }

  /**
   * Step 2: Generate research brief
   */
  private async generateResearchBrief(state: ResearchState): Promise<ResearchBrief> {
    const prompt = `You are an expert research planner. Transform this user request into a comprehensive research brief.

User request: "${state.messages[0].content}"
Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}

Create a detailed research brief that includes:

1. **Research Objective**: Clear statement of what needs to be researched
2. **Key Questions**: 3-5 specific questions that need to be answered
3. **Research Scope**: What areas/topics should be covered
4. **Expected Deliverables**: What the final report should contain

Respond with a JSON object containing:
- "research_brief": string (comprehensive brief covering all above points)
- "key_questions": string[] (array of specific research questions)
- "research_scope": string (scope definition)

Make the brief detailed enough to guide multiple research agents working in parallel.`

    console.log('Generating research brief for:', state.messages[0].content)
    
    try {
      const response = await AIProviderService.generateResponse(
        prompt,
        this.config.provider as any,
        this.config.model
      )

      console.log('AI response for research brief:', response.content.substring(0, 200) + '...')
      
      // Try to parse JSON response
      let result: ResearchBrief
      try {
        result = JSON.parse(response.content)
      } catch (parseError) {
        console.warn('Failed to parse JSON, extracting content manually')
        // Extract content manually if JSON parsing fails
        result = {
          research_brief: response.content,
          key_questions: this.extractQuestionsFromText(response.content),
          research_scope: "General research covering current state, trends, and practical applications"
        }
      }
      
      console.log('Generated research brief successfully')
      return result as ResearchBrief
    } catch (error) {
      console.error('Error generating research brief:', error)
      // Fallback research brief
      return {
        research_brief: `Research Brief: ${state.messages[0].content}\n\nObjective: Conduct comprehensive research on the requested topic.\nScope: Gather current information, analyze trends, and provide actionable insights.\nDeliverables: Structured report with findings, analysis, and recommendations.`,
        key_questions: [
          `What are the current developments in ${state.messages[0].content}?`,
          `What are the key challenges and opportunities?`,
          `What are the practical implications and recommendations?`
        ],
        research_scope: "General research covering current state, trends, and practical applications"
      }
    }
  }

  /**
   * Step 3: Conduct multi-agent research
   */
  private async conductMultiAgentResearch(state: ResearchState): Promise<{ notes: string[], raw_notes: string[] }> {
    console.log('Starting multi-agent research coordination')
    
    const supervisorPrompt = `You are the Deep Research Supervisor coordinating multiple research agents. Your job is to break down the research brief into specific research tasks and delegate them to specialized agents.

Research Brief:
${state.research_brief}

Key Questions to Answer:
${state.research_brief ? JSON.stringify((state.research_brief as any).key_questions) : 'Not available'}

Your role:
1. Analyze the research brief and identify 2-4 specific research subtopics
2. Use the conduct_research tool to delegate each subtopic to a research agent
3. Monitor progress and ensure comprehensive coverage
4. When all research is complete, use research_complete tool

Available tools:
- conduct_research(research_topic: string): Delegate research on a specific topic
- research_complete(summary: string): Mark research as complete
- think(thoughts: string): Reflect on progress and next steps

Maximum concurrent research units: ${this.config.max_concurrent_agents}
Maximum iterations: ${this.config.max_iterations}

Start by identifying the key research areas and delegating them to agents. Be specific and actionable in your research topics.`

    const supervisorMessages: ResearchMessage[] = [
      { role: 'system', content: supervisorPrompt }
    ]

    const allNotes: string[] = []
    const allRawNotes: string[] = []
    let iterations = 0

    while (iterations < this.config.max_iterations) {
      console.log(`Supervisor iteration ${iterations + 1}/${this.config.max_iterations}`)
      
      // Get supervisor decision
      const supervisorResponse = await this.callAIWithTools(supervisorMessages)
      supervisorMessages.push(supervisorResponse)

      // Process tool calls
      if (supervisorResponse.tool_calls && supervisorResponse.tool_calls.length > 0) {
        console.log(`Supervisor generated ${supervisorResponse.tool_calls.length} tool calls`)
        const toolResults = await this.executeToolCalls(supervisorResponse.tool_calls)
        
        for (const result of toolResults) {
          supervisorMessages.push(result)
          
          if (result.name === 'conduct_research' && result.content) {
            allNotes.push(result.content)
            allRawNotes.push(`Research on: ${result.content}`)
          }
          
          if (result.name === 'research_complete') {
            console.log('Research marked complete by supervisor')
            return { notes: allNotes, raw_notes: allRawNotes }
          }
        }
      } else {
        console.warn('Supervisor generated no tool calls, forcing research')
        
        // Force research if supervisor isn't delegating properly
        if (iterations === 0 && allNotes.length === 0) {
          console.log('Forcing direct research since supervisor failed to delegate')
          const forcedResearchTopics = this.generateForcedResearchTopics(state)
          
          for (const topic of forcedResearchTopics) {
            console.log(`Forcing research on: ${topic}`)
            const research = await this.executeResearchAgent(topic)
            allNotes.push(research)
            allRawNotes.push(`Forced research on: ${topic}`)
          }
          
          // If we got results from forced research, break
          if (allNotes.length > 0) {
            break
          }
        }
        
        // No tool calls and no forced research worked, break
        break
      }

      iterations++
    }

    console.log(`Multi-agent research completed with ${allNotes.length} notes`)
    return { notes: allNotes, raw_notes: allRawNotes }
  }

  /**
   * Generate forced research topics when supervisor fails
   */
  private generateForcedResearchTopics(state: ResearchState): string[] {
    const originalQuery = state.messages[0].content
    console.log('Generating forced research topics for:', originalQuery)
    
    // Extract key terms from the original query
    const words = originalQuery.toLowerCase().split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !['the', 'and', 'with', 'for', 'are', 'this', 'that'].includes(word))
    
    const topics = []
    
    // Main topic research
    if (words.length > 0) {
      topics.push(`Current developments in ${words.slice(0, 3).join(' ')}`)
    }
    
    // Technical aspects
    if (originalQuery.toLowerCase().includes('ai') || originalQuery.toLowerCase().includes('artificial intelligence')) {
      topics.push('AI implementation techniques and best practices')
    }
    
    if (originalQuery.toLowerCase().includes('deep learning') || originalQuery.toLowerCase().includes('machine learning')) {
      topics.push('Latest deep learning research and applications')
    }
    
    // Applications and trends
    topics.push(`Practical applications and future trends in ${words.slice(0, 2).join(' ')}`)
    
    return topics.slice(0, 3) // Limit to 3 topics
  }

  /**
   * Execute individual research agent
   */
  private async executeResearchAgent(topic: string): Promise<string> {
    console.log(`Starting research agent for topic: ${topic}`)
    
    const agentPrompt = `You are a specialized research agent focused on: ${topic}

Your task is to:
1. Search for current, relevant information on this topic using multiple search methods
2. Analyze and synthesize the findings
3. Provide a comprehensive summary with actionable insights

Available tools:
- web_search(query: string, max_results?: number): Search the web for information
- scholar_search(query: string, max_results?: number): Search academic papers and research
- news_search(query: string, max_results?: number): Search latest news and current events
- doc_search(query: string, library?: string, max_results?: number): Search technical documentation
- think(thoughts: string): Reflect on findings and plan next steps

IMPORTANT: You MUST use multiple search tools to gather comprehensive information. Start with web_search, then use scholar_search for academic insights, and news_search for recent developments. Provide detailed analysis and actionable insights.

Conduct thorough research and provide a detailed summary of your findings.`

    const agentMessages: ResearchMessage[] = [
      { role: 'system', content: agentPrompt },
      { role: 'user', content: `Research topic: ${topic}` }
    ]

    let agentIterations = 0
    const maxAgentIterations = 5 // Increased iterations for more thorough research
    let hasSearchedWeb = false
    let hasSearchedScholar = false
    let hasSearchedNews = false

    while (agentIterations < maxAgentIterations) {
      console.log(`Research agent iteration ${agentIterations + 1}/${maxAgentIterations} for: ${topic}`)
      
      const response = await this.callAIWithTools(agentMessages)
      agentMessages.push(response)

      if (response.tool_calls && response.tool_calls.length > 0) {
        console.log(`Agent making ${response.tool_calls.length} tool calls`)
        
        // Track which search types have been used
        for (const toolCall of response.tool_calls) {
          if (toolCall.function.name === 'web_search') hasSearchedWeb = true
          if (toolCall.function.name === 'scholar_search') hasSearchedScholar = true
          if (toolCall.function.name === 'news_search') hasSearchedNews = true
        }
        
        const toolResults = await this.executeToolCalls(response.tool_calls)
        agentMessages.push(...toolResults)
        
        // Check if we need to encourage more comprehensive searching
        if (agentIterations === 2 && (!hasSearchedWeb || !hasSearchedScholar)) {
          agentMessages.push({
            role: 'user',
            content: 'Please ensure you use both web_search and scholar_search to get comprehensive information from different sources.'
          })
        }
      } else {
        // Agent provided final summary - but only accept if adequate research was done
        if (hasSearchedWeb || hasSearchedScholar || agentIterations >= 2) {
          console.log(`Research agent completed for ${topic} after ${agentIterations + 1} iterations`)
          return response.content
        } else {
          // Force at least one search if agent isn't searching
          console.log('Agent not conducting searches, forcing web search')
          const forcedSearchResult = await this.searchService.search(topic, {
            maxResults: 5,
            sources: ['duckduckgo'], // Use DuckDuckGo as fallback since it needs no API key
            combineStrategy: 'weighted'
          })
          
          const searchSummary = this.formatSearchResults(forcedSearchResult)
          agentMessages.push({
            role: 'tool',
            content: searchSummary,
            tool_call_id: 'forced_search',
            name: 'web_search'
          })
          
          agentMessages.push({
            role: 'user',
            content: 'Based on the search results above, provide a comprehensive summary with analysis and insights.'
          })
        }
      }

      agentIterations++
    }

    // Compress research findings
    return this.compressResearchFindings(agentMessages, topic)
  }

  /**
   * Compress research findings into summary
   */
  private async compressResearchFindings(messages: ResearchMessage[], topic: string): Promise<string> {
    const prompt = `Compress the following research conversation into a concise summary for the topic: ${topic}

Research conversation:
${messages.map(m => `${m.role}: ${m.content}`).join('\n\n')}

Provide a structured summary covering:
- Key findings
- Important data points
- Relevant insights
- Sources referenced

Keep it concise but comprehensive.`

    try {
      const response = await AIProviderService.generateResponse(
        prompt,
        this.config.provider as any,
        this.config.model
      )
      return response.content
    } catch (error) {
      return `Research summary for ${topic}: Unable to compress findings due to processing error.`
    }
  }

  /**
   * Step 4: Generate final report
   */
  private async generateFinalReport(state: ResearchState): Promise<string> {
    const prompt = `You are an expert research writer. Create a comprehensive final report based on the research conducted.

Research Brief: ${state.research_brief}

Research Findings:
${state.notes.join('\n\n')}

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}

Create a well-structured final report that includes:

1. **Executive Summary**: Brief overview of key findings
2. **Detailed Analysis**: Comprehensive analysis of the research topic
3. **Key Insights**: Most important discoveries and insights
4. **Practical Recommendations**: Actionable recommendations based on findings
5. **Conclusion**: Summary and future outlook

Format the report professionally with clear headings and well-organized content.`

    try {
      const response = await AIProviderService.generateResponse(
        prompt,
        this.config.provider as any,
        this.config.model
      )
      return response.content
    } catch (error) {
      return `# Research Report

## Executive Summary
Research was conducted on the requested topic. Due to processing limitations, a detailed report could not be generated.

## Findings Summary
${state.notes.join('\n\n')}

## Conclusion
Research completed with available findings documented above.`
    }
  }

  /**
   * Format search results into readable text
   */
  private formatSearchResults(results: any[], type: string = 'Web'): string {
    if (!results || results.length === 0) {
      console.warn(`No ${type.toLowerCase()} search results found`)
      return `No ${type.toLowerCase()} search results found. This may indicate an issue with the search service or query.`
    }

    console.log(`Formatting ${results.length} ${type.toLowerCase()} search results`)
    
    const formatted = results.slice(0, 8).map((result, index) => {
      const snippet = result.snippet || 'No snippet available'
      const relevanceInfo = result.relevanceScore ? 
        `Relevance: ${(result.relevanceScore * 100).toFixed(0)}%` : 
        'Relevance: Not scored'
      
      return `${index + 1}. **${result.title}**
   URL: ${result.url}
   Source: ${result.source || 'Unknown'}
   ${snippet}
   ${relevanceInfo}`
    }).join('\n\n')

    return `## ${type} Search Results (${results.length} found)\n\n${formatted}\n\n---\nNote: These are the top ${Math.min(results.length, 8)} results from ${results.length} total results found.`
  }

  /**
   * Call AI with tool support
   */
  private async callAIWithTools(messages: ResearchMessage[]): Promise<ResearchMessage> {
    const toolsDescription = `Available tools:
- web_search(query: string, max_results?: number): Search the web for information
- scholar_search(query: string, max_results?: number): Search academic papers and research
- news_search(query: string, max_results?: number): Search latest news and current events
- doc_search(query: string, library?: string, max_results?: number): Search technical documentation
- think(thoughts: string): Reflect on current progress and plan next steps  
- conduct_research(research_topic: string): Delegate research on a specific topic to a sub-agent
- research_complete(summary: string): Indicate that research is complete

To use a tool, respond with: USE_TOOL: tool_name(arguments)
For example: USE_TOOL: web_search("machine learning trends 2024")
Or: USE_TOOL: scholar_search("deep learning papers 2024")

If you don't need to use any tools, provide your response directly.`

    const prompt = `${messages.map(m => `${m.role}: ${m.content}`).join('\n\n')}

${toolsDescription}`

    try {
      const response = await AIProviderService.generateResponse(
        prompt,
        this.config.provider as any,
        this.config.model
      )

      // Parse tool calls from response
      const toolCalls = this.parseToolCalls(response.content)
      
      return {
        role: 'assistant',
        content: response.content,
        tool_calls: toolCalls
      }
    } catch (error) {
      return {
        role: 'assistant',
        content: `Error in AI response: ${error instanceof Error ? error.message : 'Unknown error'}`
      }
    }
  }

  /**
   * Parse tool calls from AI response
   */
  private parseToolCalls(content: string): ToolCall[] {
    console.log('Parsing AI response for tool calls:', content.substring(0, 500) + '...')
    const toolCalls: ToolCall[] = []
    
    // Multiple regex patterns to catch different formats
    const patterns = [
      /USE_TOOL:\s*(\w+)\((.*?)\)/g,
      /(\w+_search|conduct_research|research_complete|think)\s*\((.*?)\)/g,
      /\b(web_search|scholar_search|news_search|doc_search|conduct_research|research_complete|think)\s*:\s*([^\n]+)/g
    ]
    
    for (const regex of patterns) {
      let match
      while ((match = regex.exec(content)) !== null) {
        const [, toolName, argsString] = match
        
        try {
          // Parse arguments - handle both string and object formats
          let args: any = {}
          if (argsString && argsString.trim()) {
            if (argsString.startsWith('"') && argsString.endsWith('"')) {
              // Simple string argument
              const paramName = toolName.includes('search') ? 'query' : 
                               toolName === 'conduct_research' ? 'research_topic' :
                               toolName === 'research_complete' ? 'summary' : 'thoughts'
              args = { [paramName]: argsString.slice(1, -1) }
            } else {
              // Try to parse as JSON-like arguments
              args = this.parseToolArguments(argsString)
            }
          }

          console.log(`Parsed tool: ${toolName} with args:`, args)
          
          toolCalls.push({
            id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'function',
            function: {
              name: toolName,
              arguments: JSON.stringify(args)
            }
          })
        } catch (error) {
          console.error('Error parsing tool call:', error)
        }
      }
    }
    
    console.log(`Found ${toolCalls.length} tool calls`)
    
    // If no tool calls found but this looks like a research response, force some research
    if (toolCalls.length === 0 && (content.toLowerCase().includes('research') || content.toLowerCase().includes('search'))) {
      console.log('No tool calls found, forcing basic research')
      // Force at least one search based on the content
      const query = this.extractQueryFromContent(content)
      if (query) {
        toolCalls.push({
          id: `call_forced_${Date.now()}`,
          type: 'function',
          function: {
            name: 'web_search',
            arguments: JSON.stringify({ query, max_results: 5 })
          }
        })
      }
    }

    return toolCalls
  }

  /**
   * Extract search query from content when no tool calls found
   */
  private extractQueryFromContent(content: string): string | null {
    // Try to extract meaningful search terms from the AI response
    const lines = content.split('\n')
    for (const line of lines) {
      if (line.toLowerCase().includes('research') || line.toLowerCase().includes('search')) {
        // Extract key terms
        const words = line.split(' ').filter(word => 
          word.length > 3 && 
          !['research', 'search', 'find', 'look', 'into', 'about', 'this', 'that', 'will', 'should'].includes(word.toLowerCase())
        )
        if (words.length > 0) {
          return words.slice(0, 3).join(' ')
        }
      }
    }
    return null
  }

  /**
   * Parse tool arguments from string
   */
  private parseToolArguments(argsString: string): any {
    try {
      // Try JSON parse first
      return JSON.parse(`{${argsString}}`)
    } catch {
      // Fallback: treat as simple string
      return { query: argsString.replace(/['"]/g, '') }
    }
  }

  /**
   * Execute tool calls
   */
  private async executeToolCalls(toolCalls: ToolCall[]): Promise<ResearchMessage[]> {
    const results: ResearchMessage[] = []
    console.log(`Executing ${toolCalls.length} tool calls`)

    for (const toolCall of toolCalls) {
      try {
        const args = JSON.parse(toolCall.function.arguments)
        let result: string
        console.log(`Executing tool: ${toolCall.function.name} with args:`, args)

        switch (toolCall.function.name) {
          case 'web_search':
            console.log('Performing web search for:', args.query)
            const webResults = await this.searchService.search(args.query, {
              maxResults: args.max_results || 5,
              sources: ['google', 'duckduckgo', 'tavily', 'langsearch'],
              combineStrategy: 'weighted'
            })
            console.log(`Found ${webResults.length} web search results`)
            result = this.formatSearchResults(webResults)
            break

          case 'scholar_search':
            const scholarResults = await this.searchService.searchScholar(args.query, {
              maxResults: args.max_results || 5
            })
            result = this.formatSearchResults(scholarResults, 'Scholar')
            break

          case 'news_search':
            const newsResults = await this.searchService.searchNews(args.query, {
              maxResults: args.max_results || 5
            })
            result = this.formatSearchResults(newsResults, 'News')
            break

          case 'doc_search':
            const docResults = await this.searchService.searchDocumentation(
              args.query,
              args.library,
              { maxResults: args.max_results || 5 }
            )
            result = this.formatSearchResults(docResults, 'Documentation')
            break

          case 'think':
            result = `Thinking: ${args.thoughts}`
            break

          case 'conduct_research':
            console.log('Delegating research on:', args.research_topic)
            result = await this.executeResearchAgent(args.research_topic)
            console.log('Research agent completed for:', args.research_topic)
            break

          case 'research_complete':
            console.log('Research marked as complete')
            result = `Research completed: ${args.summary}`
            break

          default:
            console.warn('Unknown tool:', toolCall.function.name)
            result = `Unknown tool: ${toolCall.function.name}`
        }

        console.log(`Tool execution result length: ${result.length} characters`)
        results.push({
          role: 'tool',
          content: result,
          tool_call_id: toolCall.id,
          name: toolCall.function.name
        })

      } catch (error) {
        console.error(`Error executing ${toolCall.function.name}:`, error)
        results.push({
          role: 'tool',
          content: `Error executing ${toolCall.function.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          tool_call_id: toolCall.id,
          name: toolCall.function.name
        })
      }
    }

    console.log(`Completed ${results.length} tool executions`)
    return results
  }

  /**
   * Extract questions from text when JSON parsing fails
   */
  private extractQuestionsFromText(text: string): string[] {
    const questions: string[] = []
    const lines = text.split('\n')
    
    for (const line of lines) {
      if (line.includes('?') && (line.includes('What') || line.includes('How') || line.includes('Why') || line.includes('When') || line.includes('Where'))) {
        questions.push(line.trim())
      }
    }
    
    // If no questions found, generate default ones
    if (questions.length === 0) {
      return [
        'What are the key aspects of this topic?',
        'What are the current trends and developments?',
        'What are the practical implications?'
      ]
    }
    
    return questions.slice(0, 5) // Limit to 5 questions
  }
}
