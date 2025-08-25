import { BaseSearchService, SearchResult, SearchOptions } from './base-search.service';
import { GoogleSearchService } from './google-search.service';
import { DuckDuckGoSearchService } from './duckduckgo-search.service';
import { TavilySearchService } from './tavily-search.service';
import { Context7SearchService } from './context7-search.service';
import { LangSearchService } from './langsearch.service';

export interface UnifiedSearchOptions extends SearchOptions {
  sources?: string[];
  combineStrategy?: 'merge' | 'interleave' | 'weighted';
  weights?: Record<string, number>;
  deduplicate?: boolean;
  maxResultsPerSource?: number;
}

export class UnifiedSearchService {
  private searchServices: Map<string, BaseSearchService>;
  private defaultWeights: Record<string, number> = {
    google: 1.2,
    duckduckgo: 1.0,
    tavily: 1.1,
    context7: 1.3,
    langsearch: 1.15
  };

  constructor() {
    this.searchServices = new Map();
    this.initializeServices();
  }

  private addService(name: string, service: BaseSearchService): void {
    this.searchServices.set(name, service);
    console.log(`✓ ${name} service initialized`);
  }

  private initializeServices() {
    // Initialize Google Search if credentials exist
    try {
      if (process.env.GOOGLE_SEARCH_API_KEY && process.env.GOOGLE_SEARCH_CSE_ID) {
        this.addService('google', new GoogleSearchService());
      }
    } catch (error) {
      console.warn('Google service initialization failed:', error);
    }

    // DuckDuckGo doesn't require API key
    try {
      this.addService('duckduckgo', new DuckDuckGoSearchService());
    } catch (error) {
      console.warn('DuckDuckGo service initialization failed:', error);
    }

    // Initialize Tavily if API key exists
    try {
      if (process.env.TAVILY_API_KEY) {
        this.addService('tavily', new TavilySearchService());
      }
    } catch (error) {
      console.warn('Tavily service initialization failed:', error);
    }

    // Initialize Context7 MCP (always available)
    try {
      this.addService('context7', new Context7SearchService());
    } catch (error) {
      console.warn('Context7 service initialization failed:', error);
    }

    // Initialize LangSearch if API key exists
    try {
      if (process.env.LANGSEARCH_API_KEY) {
        this.addService('langsearch', new LangSearchService());
      }
    } catch (error) {
      console.warn('LangSearch service initialization failed:', error);
    }
  }

  async search(query: string, options: UnifiedSearchOptions = {}): Promise<SearchResult[]> {
    const {
      sources = Array.from(this.searchServices.keys()),
      combineStrategy = 'weighted',
      weights = this.defaultWeights,
      deduplicate = true,
      maxResultsPerSource = 10,
      ...searchOptions
    } = options;

    // Filter to only available sources
    const availableSources = sources.filter(source => this.searchServices.has(source));
    
    if (availableSources.length === 0) {
      console.warn('No search services available');
      return [];
    }

    console.log(`Searching with ${availableSources.length} sources:`, availableSources);

    // Perform parallel searches
    const searchPromises = availableSources.map(async source => {
      const service = this.searchServices.get(source)!;
      try {
        const results = await service.search(query, {
          ...searchOptions,
          maxResults: maxResultsPerSource
        });
        
        // Add source weight to results
        return results.map(result => ({
          ...result,
          source: source,
          weight: weights[source] || 1.0
        }));
      } catch (error) {
        console.error(`Search failed for ${source}:`, error);
        return [];
      }
    });

    // Wait for all searches to complete
    const allResults = await Promise.all(searchPromises);
    const flatResults = allResults.flat();

    // Combine results based on strategy
    let combinedResults: SearchResult[];
    switch (combineStrategy) {
      case 'merge':
        combinedResults = this.mergeResults(flatResults);
        break;
      case 'interleave':
        combinedResults = this.interleaveResults(allResults);
        break;
      case 'weighted':
      default:
        combinedResults = this.weightedCombine(flatResults);
        break;
    }

    // Deduplicate if requested
    if (deduplicate) {
      combinedResults = this.deduplicateResults(combinedResults);
    }

    // Limit total results
    const maxResults = options.maxResults || 20;
    return combinedResults.slice(0, maxResults);
  }

  private mergeResults(results: Array<SearchResult & { weight?: number }>): SearchResult[] {
    // Simple merge - concatenate all results
    return results.sort((a, b) => {
      const scoreA = (a.relevanceScore || 0) * (a.weight || 1);
      const scoreB = (b.relevanceScore || 0) * (b.weight || 1);
      return scoreB - scoreA;
    });
  }

  private interleaveResults(resultSets: SearchResult[][]): SearchResult[] {
    // Round-robin interleaving
    const interleaved: SearchResult[] = [];
    const maxLength = Math.max(...resultSets.map(set => set.length));
    
    for (let i = 0; i < maxLength; i++) {
      for (const resultSet of resultSets) {
        if (i < resultSet.length) {
          interleaved.push(resultSet[i]);
        }
      }
    }
    
    return interleaved;
  }

  private weightedCombine(results: Array<SearchResult & { weight?: number }>): SearchResult[] {
    // Group results by URL
    const urlGroups = new Map<string, Array<SearchResult & { weight?: number }>>();
    
    for (const result of results) {
      const normalizedUrl = this.normalizeUrl(result.url);
      if (!urlGroups.has(normalizedUrl)) {
        urlGroups.set(normalizedUrl, []);
      }
      urlGroups.get(normalizedUrl)!.push(result);
    }

    // Combine scores for duplicate URLs
    const combinedResults: SearchResult[] = [];
    
    for (const [url, group] of urlGroups) {
      // Calculate combined score
      let totalScore = 0;
      let totalWeight = 0;
      let bestResult = group[0];
      
      for (const result of group) {
        const weight = result.weight || 1.0;
        const score = result.relevanceScore || 0.5;
        totalScore += score * weight;
        totalWeight += weight;
        
        // Keep the result with the best snippet
        if (result.snippet && result.snippet.length > bestResult.snippet.length) {
          bestResult = result;
        }
      }
      
      const finalScore = totalWeight > 0 ? totalScore / totalWeight : 0;
      
      combinedResults.push({
        ...bestResult,
        relevanceScore: finalScore,
        source: group.length > 1 ? 
          `Multiple (${group.map(r => r.source).join(', ')})` : 
          bestResult.source,
        metadata: {
          ...bestResult.metadata,
          sourceCount: group.length,
          sources: group.map(r => r.source)
        }
      });
    }

    // Sort by combined score
    return combinedResults.sort((a, b) => 
      (b.relevanceScore || 0) - (a.relevanceScore || 0)
    );
  }

  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Set<string>();
    const deduplicated: SearchResult[] = [];
    
    for (const result of results) {
      const normalizedUrl = this.normalizeUrl(result.url);
      if (!seen.has(normalizedUrl)) {
        seen.add(normalizedUrl);
        deduplicated.push(result);
      } else {
        // If we've seen this URL, potentially update the existing entry
        const existingIndex = deduplicated.findIndex(
          r => this.normalizeUrl(r.url) === normalizedUrl
        );
        
        if (existingIndex !== -1) {
          const existing = deduplicated[existingIndex];
          // Update if this has a better score or more complete snippet
          if ((result.relevanceScore || 0) > (existing.relevanceScore || 0) ||
              (result.snippet && result.snippet.length > existing.snippet.length)) {
            deduplicated[existingIndex] = {
              ...result,
              metadata: {
                ...existing.metadata,
                ...result.metadata,
                merged: true
              }
            };
          }
        }
      }
    }
    
    return deduplicated;
  }

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Remove trailing slashes, fragments, and normalize
      return parsed.origin + parsed.pathname.replace(/\/$/, '') + parsed.search;
    } catch {
      return url.toLowerCase().replace(/\/$/, '');
    }
  }

  async searchScholar(query: string, options: UnifiedSearchOptions = {}): Promise<SearchResult[]> {
    const scholarPromises: Promise<SearchResult[]>[] = [];
    
    // Use Google Scholar if available
    const googleService = this.searchServices.get('google');
    if (googleService && 'searchScholar' in googleService) {
      scholarPromises.push((googleService as any).searchScholar(query, options));
    }
    
    // Use DuckDuckGo Scholar search
    const duckService = this.searchServices.get('duckduckgo');
    if (duckService && 'searchScholar' in duckService) {
      scholarPromises.push((duckService as any).searchScholar(query, options));
    }
    
    // Use Tavily with academic focus
    const tavilyService = this.searchServices.get('tavily');
    if (tavilyService) {
      scholarPromises.push(tavilyService.search(
        `academic research paper ${query}`,
        { ...options, includeAnswer: false }
      ));
    }
    
    // Use LangSearch for academic search
    const langSearchService = this.searchServices.get('langsearch');
    if (langSearchService) {
      scholarPromises.push(langSearchService.search(query, {
        ...options,
        type: 'scholar'
      }));
    }
    
    const allResults = await Promise.all(scholarPromises);
    return this.weightedCombine(allResults.flat());
  }

  async searchNews(query: string, options: UnifiedSearchOptions = {}): Promise<SearchResult[]> {
    const newsPromises: Promise<SearchResult[]>[] = [];
    
    // Use Google News if available
    const googleService = this.searchServices.get('google');
    if (googleService && 'searchNews' in googleService) {
      newsPromises.push((googleService as any).searchNews(query, options));
    }
    
    // Use DuckDuckGo News search
    const duckService = this.searchServices.get('duckduckgo');
    if (duckService && 'searchNews' in duckService) {
      newsPromises.push((duckService as any).searchNews(query, options));
    }
    
    // Use Tavily with news focus
    const tavilyService = this.searchServices.get('tavily');
    if (tavilyService) {
      newsPromises.push(tavilyService.search(
        `latest news ${query}`,
        { ...options, includeAnswer: false }
      ));
    }
    
    // Use LangSearch for news search
    const langSearchService = this.searchServices.get('langsearch');
    if (langSearchService) {
      newsPromises.push(langSearchService.search(query, {
        ...options,
        type: 'news'
      }));
    }
    
    const allResults = await Promise.all(newsPromises);
    return this.weightedCombine(allResults.flat());
  }

  async searchDocumentation(query: string, library?: string, options: UnifiedSearchOptions = {}): Promise<SearchResult[]> {
    const docPromises: Promise<SearchResult[]>[] = [];
    
    // Use Context7 MCP for documentation if available
    const context7Service = this.searchServices.get('context7');
    if (context7Service && library) {
      docPromises.push(context7Service.search(`${library} ${query}`, options));
    }
    
    // Use LangSearch for documentation
    const langSearchService = this.searchServices.get('langsearch');
    if (langSearchService) {
      docPromises.push(langSearchService.search(query, {
        ...options,
        type: 'documentation',
        metadata: { library }
      }));
    }
    
    // Fallback to web search with documentation-focused queries
    const docQuery = library ? 
      `${library} documentation ${query}` : 
      `programming documentation ${query}`;
    
    const webPromise = this.search(docQuery, {
      ...options,
      maxResultsPerSource: 5,
      sources: ['google', 'duckduckgo', 'tavily']
    });
    
    docPromises.push(webPromise);
    
    // Wait for all documentation searches
    const allResults = await Promise.all(docPromises);
    const flatResults = allResults.flat();
    
    // Filter for documentation sites
    const docSites = [
      'docs.', 'documentation.', 'developer.', 'api.',
      'github.com', 'stackoverflow.com', 'npmjs.com',
      'pypi.org', 'rubygems.org', 'crates.io'
    ];
    
    // Prioritize documentation-specific results
    const docResults = flatResults.filter(result => 
      docSites.some(site => result.url.includes(site)) ||
      result.source === 'context7' ||
      (result.source === 'langsearch' && result.metadata?.type === 'documentation')
    );
    
    // If we have doc results, prioritize them
    if (docResults.length > 0) {
      return this.deduplicateResults(docResults).slice(0, options.maxResults || 20);
    }
    
    // Otherwise return general results
    return this.deduplicateResults(flatResults).slice(0, options.maxResults || 20);
  }

  getAvailableServices(): string[] {
    return Array.from(this.searchServices.keys());
  }

  hasService(serviceName: string): boolean {
    return this.searchServices.has(serviceName);
  }

  async testServices(): Promise<Record<string, boolean>> {
    const testQuery = 'test query';
    const status: Record<string, boolean> = {};
    
    for (const [name, service] of this.searchServices) {
      try {
        const results = await service.search(testQuery, { maxResults: 1, timeout: 5000 });
        status[name] = results.length > 0;
      } catch {
        status[name] = false;
      }
    }
    
    return status;
  }
}

export default UnifiedSearchService;
