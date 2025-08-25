import { BaseSearchService, SearchResult, SearchOptions } from './base-search.service';

export interface LangSearchConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
}

export class LangSearchService extends BaseSearchService {
  private apiKey: string;
  private baseUrl: string;

  constructor(config?: LangSearchConfig) {
    super('LangSearch');
    this.apiKey = config?.apiKey || process.env.LANGSEARCH_API_KEY || '';
    this.baseUrl = config?.baseUrl || 'https://api.langsearch.io/v1';
  }

  /**
   * Perform a search using LangSearch API
   */
  protected async performSearch(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    try {
      const searchType = options.type || 'web';
      const maxResults = options.maxResults || 10;

      // LangSearch supports different search types
      const endpoint = this.getEndpoint(searchType);
      
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          query,
          max_results: maxResults,
          include_metadata: true,
          search_depth: 'comprehensive',
          language: options.metadata?.language || 'en'
        }),
        signal: options.signal
      });

      if (!response.ok) {
        throw new Error(`LangSearch API error: ${response.statusText}`);
      }

      const data = await response.json();
      return this.formatResults(data.results || [], searchType);
    } catch (error) {
      console.error('LangSearch error:', error);
      return [];
    }
  }

  /**
   * Get the appropriate endpoint based on search type
   */
  private getEndpoint(searchType: string): string {
    switch (searchType) {
      case 'scholar':
        return '/search/academic';
      case 'news':
        return '/search/news';
      case 'code':
        return '/search/code';
      case 'documentation':
        return '/search/docs';
      default:
        return '/search/web';
    }
  }

  /**
   * Format LangSearch results to our standard format
   */
  private formatResults(results: any[], searchType: string): SearchResult[] {
    return results.map(result => ({
      title: result.title || 'Untitled',
      url: result.url || '',
      snippet: result.snippet || result.description || '',
      source: 'LangSearch',
      relevanceScore: result.relevance_score || result.score || 0.5,
      metadata: {
        searchType,
        language: result.language,
        publishDate: result.published_date,
        author: result.author,
        citations: result.citations,
        codeLanguage: result.code_language,
        repository: result.repository
      }
    }));
  }

  /**
   * Search for code repositories and examples
   */
  async searchCode(query: string, language?: string): Promise<SearchResult[]> {
    return this.search(query, {
      type: 'code',
      metadata: { language, codeLanguage: language }
    });
  }

  /**
   * Search academic papers and research
   */
  async searchAcademic(query: string): Promise<SearchResult[]> {
    return this.search(query, { type: 'scholar' });
  }

  /**
   * Search technical documentation
   */
  async searchDocumentation(query: string, framework?: string): Promise<SearchResult[]> {
    return this.search(query, {
      type: 'documentation',
      metadata: { framework }
    });
  }

  /**
   * Perform semantic search with embedding support
   */
  async semanticSearch(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    try {
      const response = await fetch(`${this.baseUrl}/search/semantic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`
        },
        body: JSON.stringify({
          query,
          use_embeddings: true,
          similarity_threshold: 0.7,
          max_results: options.maxResults || 10
        }),
        signal: options.signal
      });

      if (!response.ok) {
        throw new Error(`LangSearch semantic search error: ${response.statusText}`);
      }

      const data = await response.json();
      return this.formatResults(data.results || [], 'semantic');
    } catch (error) {
      console.error('LangSearch semantic search error:', error);
      return [];
    }
  }

  /**
   * Check if service is available
   */
  isAvailable(): boolean {
    return !!this.apiKey;
  }
}

export default LangSearchService;
