export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  relevanceScore?: number;
  metadata?: Record<string, any>;
}

export interface SearchOptions {
  maxResults?: number;
  timeout?: number;
  signal?: AbortSignal;
  type?: string;
  metadata?: Record<string, any>;
  dateRestrict?: string;
  siteSearch?: string;
  fileType?: string;
  imageSize?: string;
  language?: string;
  includeAnswer?: boolean;
  offset?: number;
}

export abstract class BaseSearchService {
  protected serviceName: string;
  protected defaultTimeout = 10000; // 10 seconds

  constructor(serviceName: string) {
    this.serviceName = serviceName;
  }

  async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const controller = new AbortController();
    const timeout = options.timeout || this.defaultTimeout;
    
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const results = await this.performSearch(query, {
        ...options,
        signal: options.signal || controller.signal
      });
      
      clearTimeout(timeoutId);
      return this.deduplicateResults(results);
    } catch (error: any) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        console.warn(`${this.serviceName} search timed out after ${timeout}ms`);
        return [];
      }
      
      console.error(`${this.serviceName} search error:`, error);
      throw error;
    }
  }

  protected abstract performSearch(query: string, options: SearchOptions): Promise<SearchResult[]>;

  protected deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      const normalized = result.url.toLowerCase().replace(/\/$/, '');
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
  }

  protected normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.href;
    } catch {
      return url;
    }
  }

  protected extractDomain(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.hostname;
    } catch {
      return '';
    }
  }

  isAvailable(): boolean {
    return true;
  }

  getServiceName(): string {
    return this.serviceName;
  }
}

export default BaseSearchService;
