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

    try {
      const response = await AIProviderService.generateResponse(
        prompt,
        this.config.provider as any,
        this.config.model
      )

      const result = JSON.parse(response.content)
      return result as ResearchBrief
    } catch (error) {
      // Fallback research brief
      return {
        research_brief: `Research Brief: ${state.messages[0].content}\n\nObjective: Conduct comprehensive research on the requested topic.\nScope: Gather current information, analyze trends, and provide actionable insights.`,
        key_questions: [
          "What is the current state of this topic?",
          "What are the key trends and developments?",
          "What are the practical implications?"
        ],
        research_scope: "General research covering current state, trends, and practical applications"
      }
    }
  }

  /**
   * Step 3: Conduct multi-agent research
   */
  private async conductMultiAgentResearch(state: ResearchState): Promise<{ notes: string[], raw_notes: string[] }> {
    const supervisorPrompt = `You are a lead researcher coordinating a team of research agents. 

Research Brief: ${state.research_brief}
Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}

Your role is to:
1. Break down the research into specific topics for parallel investigation
2. Coordinate multiple research agents
3. Decide when sufficient research has been gathered

Available tools:
- conduct_research: Delegate research on a specific topic to a sub-agent
- think: Reflect on current progress and plan next steps
- research_complete: Indicate research is complete

Maximum concurrent research units: ${this.config.max_concurrent_agents}
Maximum iterations: ${this.config.max_iterations}

Start by identifying 2-3 specific research topics that need investigation, then use conduct_research to delegate them.`

    const supervisorMessages: ResearchMessage[] = [
      { role: 'system', content: supervisorPrompt }
    ]

    const allNotes: string[] = []
    const allRawNotes: string[] = []
    let iterations = 0

    while (iterations < this.config.max_iterations) {
      // Get supervisor decision
      const supervisorResponse = await this.callAIWithTools(supervisorMessages)
      supervisorMessages.push(supervisorResponse)

      // Process tool calls
      if (supervisorResponse.tool_calls && supervisorResponse.tool_calls.length > 0) {
        const toolResults = await this.executeToolCalls(supervisorResponse.tool_calls)
        
        for (const result of toolResults) {
          supervisorMessages.push(result)
          
          if (result.name === 'conduct_research' && result.content) {
            allNotes.push(result.content)
            allRawNotes.push(`Research on: ${result.content}`)
          }
          
          if (result.name === 'research_complete') {
            return { notes: allNotes, raw_notes: allRawNotes }
          }
        }
      } else {
        // No tool calls, research complete
        break
      }

      iterations++
    }

    return { notes: allNotes, raw_notes: allRawNotes }
  }

  /**
   * Execute individual research agent
   */
  private async executeResearchAgent(topic: string): Promise<string> {
    const agentPrompt = `You are a specialized research agent focused on: ${topic}

Your task is to:
1. Search for current, relevant information on this topic
2. Analyze and synthesize the findings
3. Provide a comprehensive summary

Available tools:
- web_search: Search the web for information
- scholar_search: Search academic papers and research
- news_search: Search latest news and current events
- doc_search: Search technical documentation
- think: Reflect on findings and plan next steps

Conduct thorough research and provide a detailed summary of your findings.`

    const agentMessages: ResearchMessage[] = [
      { role: 'system', content: agentPrompt },
      { role: 'user', content: `Research topic: ${topic}` }
    ]

    let agentIterations = 0
    const maxAgentIterations = 3

    while (agentIterations < maxAgentIterations) {
      const response = await this.callAIWithTools(agentMessages)
      agentMessages.push(response)

      if (response.tool_calls && response.tool_calls.length > 0) {
        const toolResults = await this.executeToolCalls(response.tool_calls)
        agentMessages.push(...toolResults)
      } else {
        // Agent provided final summary
        return response.content
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
      return `No ${type.toLowerCase()} search results found.`
    }

    const formatted = results.slice(0, 5).map((result, index) => {
      return `${index + 1}. **${result.title}**
   URL: ${result.url}
   ${result.snippet}
   ${result.relevanceScore ? `Relevance: ${(result.relevanceScore * 100).toFixed(0)}%` : ''}`
    }).join('\n\n')

    return `## ${type} Search Results\n\n${formatted}\n\nFound ${results.length} total results.`
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
    const toolCalls: ToolCall[] = []
    const toolCallRegex = /USE_TOOL:\s*(\w+)\((.*?)\)/g
    let match

    while ((match = toolCallRegex.exec(content)) !== null) {
      const [, toolName, argsString] = match
      
      try {
        // Parse arguments - handle both string and object formats
        let args: any = {}
        if (argsString.trim()) {
          if (argsString.startsWith('"') && argsString.endsWith('"')) {
            // Simple string argument
            const paramName = toolName.includes('search') ? 'query' : 'thoughts'
            args = { [paramName]: argsString.slice(1, -1) }
          } else {
            // Try to parse as JSON-like arguments
            args = this.parseToolArguments(argsString)
          }
        }

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

    return toolCalls
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

    for (const toolCall of toolCalls) {
      try {
        const args = JSON.parse(toolCall.function.arguments)
        let result: string

        switch (toolCall.function.name) {
          case 'web_search':
            const webResults = await this.searchService.search(args.query, {
              maxResults: args.max_results || 5,
              sources: ['google', 'duckduckgo', 'tavily', 'langsearch'],
              combineStrategy: 'weighted'
            })
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
            result = await this.executeResearchAgent(args.research_topic)
            break

          case 'research_complete':
            result = `Research completed: ${args.summary}`
            break

          default:
            result = `Unknown tool: ${toolCall.function.name}`
        }

        results.push({
          role: 'tool',
          content: result,
          tool_call_id: toolCall.id,
          name: toolCall.function.name
        })

      } catch (error) {
        results.push({
          role: 'tool',
          content: `Error executing ${toolCall.function.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          tool_call_id: toolCall.id,
          name: toolCall.function.name
        })
      }
    }

    return results
  }
}
