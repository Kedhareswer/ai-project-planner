import { BaseSearchService, SearchResult, SearchOptions } from '@/lib/services/base-search.service';

interface GoogleSearchResponse {
  items?: Array<{
    title: string;
    link: string;
    snippet: string;
    pagemap?: {
      cse_thumbnail?: Array<{ src: string }>;
      metatags?: Array<{ [key: string]: string }>;
    };
  }>;
  searchInformation?: {
    totalResults: string;
    searchTime: number;
  };
}

export class GoogleSearchService extends BaseSearchService {
  public readonly apiKey: string;
  public readonly cseId: string;
  private readonly baseUrl = 'https://www.googleapis.com/customsearch/v1';

  constructor(apiKey?: string, cseId?: string) {
    super('Google');
    this.apiKey = apiKey || process.env.GOOGLE_SEARCH_API_KEY || '';
    this.cseId = cseId || process.env.GOOGLE_SEARCH_CSE_ID || '';
    
    if (!this.apiKey || !this.cseId) {
      console.warn('Google Search API credentials not configured');
    }
  }

  override isAvailable(): boolean {
    return !!(this.apiKey && this.cseId);
  }

  protected async performSearch(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    if (!this.apiKey || !this.cseId) {
      throw new Error('Google Search API credentials not configured');
    }

    const params = new URLSearchParams({
      key: this.apiKey,
      cx: this.cseId,
      q: query,
      num: String(options.maxResults || 10),
      start: String(options.offset || 1),
      safe: 'active',
      ...(options.language && { lr: `lang_${options.language}` }),
      ...(options.dateRestrict && { dateRestrict: options.dateRestrict }),
      ...(options.siteSearch && { siteSearch: options.siteSearch }),
      ...(options.fileType && { fileType: options.fileType })
    });

    const response = await fetch(`${this.baseUrl}?${params}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: options.signal
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Google Search API error: ${response.status} - ${error}`);
    }

    const data: GoogleSearchResponse = await response.json();
    
    if (!data.items) {
      return [];
    }

    return data.items.map(item => ({
      title: item.title,
      url: item.link,
      snippet: item.snippet,
      source: 'Google',
      relevanceScore: this.calculateRelevance(query, item.title, item.snippet),
      metadata: {
        thumbnail: item.pagemap?.cse_thumbnail?.[0]?.src,
        description: item.pagemap?.metatags?.[0]?.description || item.snippet,
        totalResults: data.searchInformation?.totalResults,
        searchTime: data.searchInformation?.searchTime
      }
    }));
  }

  async searchScholar(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    // Use Google Scholar search by adding site restriction
    const scholarOptions = {
      ...options,
      siteSearch: 'scholar.google.com'
    };
    
    try {
      return await this.performSearch(query, scholarOptions);
    } catch (error) {
      console.warn('Google Scholar search failed, falling back to regular search');
      return await this.performSearch(`scholarly article ${query}`, options);
    }
  }

  async searchNews(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    // Add news-specific parameters
    const newsParams = new URLSearchParams({
      key: this.apiKey,
      cx: this.cseId,
      q: query,
      num: String(options.maxResults || 10),
      tbm: 'nws', // News search
      sort: 'date', // Sort by date
    });

    try {
      const response = await fetch(`${this.baseUrl}?${newsParams}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: options.signal
      });

      if (!response.ok) {
        throw new Error(`News search failed: ${response.status}`);
      }

      const data: GoogleSearchResponse = await response.json();
      
      if (!data.items) {
        return [];
      }

      return data.items.map(item => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        source: 'Google News',
        relevanceScore: this.calculateRelevance(query, item.title, item.snippet),
        metadata: {
          isNews: true,
          ...item.pagemap?.metatags?.[0]
        }
      }));
    } catch (error) {
      console.warn('Google News search failed:', error);
      return [];
    }
  }

  async searchImages(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const imageParams = new URLSearchParams({
      key: this.apiKey,
      cx: this.cseId,
      q: query,
      num: String(options.maxResults || 10),
      searchType: 'image',
      imgSize: options.imageSize || 'large',
      safe: 'active'
    });

    try {
      const response = await fetch(`${this.baseUrl}?${imageParams}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        signal: options.signal
      });

      if (!response.ok) {
        throw new Error(`Image search failed: ${response.status}`);
      }

      const data: GoogleSearchResponse = await response.json();
      
      if (!data.items) {
        return [];
      }

      return data.items.map(item => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        source: 'Google Images',
        relevanceScore: this.calculateRelevance(query, item.title, item.snippet),
        metadata: {
          imageUrl: item.link,
          thumbnail: item.pagemap?.cse_thumbnail?.[0]?.src,
          isImage: true
        }
      }));
    } catch (error) {
      console.warn('Google Images search failed:', error);
      return [];
    }
  }

  private calculateRelevance(query: string, title: string, snippet: string): number {
    const queryLower = query.toLowerCase();
    const titleLower = title.toLowerCase();
    const snippetLower = snippet.toLowerCase();
    
    let score = 0;
    
    // Exact match in title
    if (titleLower.includes(queryLower)) {
      score += 0.5;
    }
    
    // Exact match in snippet
    if (snippetLower.includes(queryLower)) {
      score += 0.3;
    }
    
    // Word matches
    const queryWords = queryLower.split(/\s+/);
    const titleWords = titleLower.split(/\s+/);
    const snippetWords = snippetLower.split(/\s+/);
    
    queryWords.forEach(word => {
      if (titleWords.includes(word)) score += 0.1;
      if (snippetWords.includes(word)) score += 0.05;
    });
    
    return Math.min(score, 1);
  }
}

export default GoogleSearchService;
