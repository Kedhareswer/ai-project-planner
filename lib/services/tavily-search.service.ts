/**
 * Tavily Search Service
 * Provides web search capabilities using the Tavily API
 */

export interface TavilySearchResult {
  title: string
  url: string
  content: string
  score: number
  published_date?: string
  raw_content?: string
}

export interface TavilySearchResponse {
  query: string
  follow_up_questions?: string[]
  answer?: string
  images?: string[]
  results: TavilySearchResult[]
  response_time: number
}

export interface TavilySearchOptions {
  search_depth?: 'basic' | 'advanced'
  topic?: 'general' | 'news' | 'finance'
  max_results?: number
  include_answer?: boolean
  include_raw_content?: boolean
  include_images?: boolean
  include_domains?: string[]
  exclude_domains?: string[]
}

export class TavilySearchService {
  private apiKey: string
  private baseUrl = 'https://api.tavily.com'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async search(query: string, options: TavilySearchOptions = {}): Promise<TavilySearchResponse> {
    const {
      search_depth = 'basic',
      topic = 'general',
      max_results = 5,
      include_answer = false,
      include_raw_content = true,
      include_images = false,
      include_domains = [],
      exclude_domains = []
    } = options

    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          api_key: this.apiKey,
          query,
          search_depth,
          topic,
          max_results,
          include_answer,
          include_raw_content,
          include_images,
          include_domains,
          exclude_domains
        })
      })

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('Tavily search error:', error)
      throw new Error(`Failed to perform Tavily search: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  async searchMultiple(queries: string[], options: TavilySearchOptions = {}): Promise<TavilySearchResponse[]> {
    const searchPromises = queries.map(query => this.search(query, options))
    return Promise.all(searchPromises)
  }

  /**
   * Extract key information from search results
   */
  extractKeyInfo(results: TavilySearchResult[]): string {
    return results.map(result => {
      const content = result.content || result.raw_content || ''
      return `**${result.title}**\nURL: ${result.url}\nContent: ${content.substring(0, 500)}...\n`
    }).join('\n---\n')
  }

  /**
   * Summarize search results into key points
   */
  summarizeResults(results: TavilySearchResult[]): string[] {
    return results.map(result => {
      const content = result.content || result.raw_content || ''
      return `${result.title}: ${content.substring(0, 200)}...`
    })
  }
}
