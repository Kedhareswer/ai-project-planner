/**
 * Tavily Search Service
 * Provides web search capabilities using the Tavily API
 */

import { BaseSearchService, SearchResult, SearchOptions } from './base-search.service';

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

export class TavilySearchService extends BaseSearchService {
  private apiKey: string
  private baseUrl = 'https://api.tavily.com'

  constructor(apiKey?: string) {
    super('Tavily')
    this.apiKey = apiKey || process.env.TAVILY_API_KEY || ''
  }

  async searchTavily(query: string, options: TavilySearchOptions = {}): Promise<TavilySearchResponse> {
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
    const searches = queries.map(query => this.searchTavily(query, options))
    return Promise.all(searches)
  }

  /**
   * Extract key information from search results
   */
  extractKeyInfo(results: TavilySearchResult[]): string {
    const formatted = results.map(result => {
      const content = result.content || result.raw_content || ''
      return `**${result.title}**\nURL: ${result.url}\nContent: ${content.substring(0, 500)}...\n`
    })
    return formatted.join('\n\n')
  }

  /**
   * Implement the abstract performSearch method from BaseSearchService
   */
  protected async performSearch(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const tavilyOptions: TavilySearchOptions = {
      max_results: options.maxResults || 10,
      search_depth: 'advanced',
      include_answer: true,
      include_raw_content: true
    }

    try {
      const response = await this.searchTavily(query, tavilyOptions)
      
      return response.results.map(result => ({
        title: result.title,
        url: result.url,
        snippet: result.content,
        source: 'Tavily',
        relevanceScore: result.score,
        metadata: {
          publishedDate: result.published_date,
          rawContent: result.raw_content
        }
      }))
    } catch (error) {
      console.error('Tavily search error:', error)
      return []
    }
  }

  /**
   * Override isAvailable to check for API key
   */
  isAvailable(): boolean {
    return !!this.apiKey
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
