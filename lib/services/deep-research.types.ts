/**
 * Deep Research Types and Interfaces
 * Defines all types used in the Deep Research system
 */

export interface ResearchMessage {
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  tool_calls?: ToolCall[]
  tool_call_id?: string
  name?: string
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface ResearchState {
  messages: ResearchMessage[]
  research_brief?: string
  notes: string[]
  raw_notes: string[]
  final_report?: string
  supervisor_messages: ResearchMessage[]
  research_iterations: number
}

export interface ResearchAgent {
  id: string
  topic: string
  messages: ResearchMessage[]
  completed: boolean
  compressed_research?: string
}

export interface ClarificationResult {
  need_clarification: boolean
  question?: string
  verification?: string
}

export interface ResearchBrief {
  research_brief: string
  key_questions: string[]
  research_scope: string
}

export interface SearchQuery {
  query: string
  context: string
  priority: number
}

export interface ResearchNote {
  source: string
  content: string
  relevance_score: number
  timestamp: string
}

export interface DeepResearchConfig {
  provider: string
  model: string
  max_iterations: number
  max_concurrent_agents: number
  search_depth: 'basic' | 'advanced'
  timeout_ms: number
}

export interface DeepResearchResult {
  success: boolean
  research_brief?: string
  final_report?: string
  notes?: string[]
  raw_notes?: string[]
  error?: string
  details?: string
  config?: DeepResearchConfig
}

export interface ToolFunction {
  name: string
  description: string
  parameters: {
    type: string
    properties: Record<string, any>
    required: string[]
  }
}

export const RESEARCH_TOOLS: ToolFunction[] = [
  {
    name: 'tavily_search',
    description: 'Search the web for information using Tavily API',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query to execute'
        },
        max_results: {
          type: 'number',
          description: 'Maximum number of search results to return',
          default: 5
        }
      },
      required: ['query']
    }
  },
  {
    name: 'think',
    description: 'Think through the current research progress and plan next steps',
    parameters: {
      type: 'object',
      properties: {
        thoughts: {
          type: 'string',
          description: 'Your thoughts about the current research progress'
        }
      },
      required: ['thoughts']
    }
  },
  {
    name: 'conduct_research',
    description: 'Delegate research on a specific topic to a sub-agent',
    parameters: {
      type: 'object',
      properties: {
        research_topic: {
          type: 'string',
          description: 'The specific research topic to investigate'
        }
      },
      required: ['research_topic']
    }
  },
  {
    name: 'research_complete',
    description: 'Indicate that research is complete and ready for final report',
    parameters: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'Brief summary of completed research'
        }
      },
      required: ['summary']
    }
  }
]
