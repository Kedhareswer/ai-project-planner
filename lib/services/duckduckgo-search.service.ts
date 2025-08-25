import { BaseSearchService, SearchResult, SearchOptions } from './base-search.service';

interface DuckDuckGoResult {
  title: string;
  link: string;
  snippet: string;
  next_page?: string;
}

export class DuckDuckGoSearchService extends BaseSearchService {
  private baseUrl = 'https://html.duckduckgo.com/html/';
  private apiUrl = 'https://api.duckduckgo.com/';

  constructor() {
    super('DuckDuckGo');
  }

  protected async performSearch(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    try {
      // Try instant answer API first for quick results
      const instantResults = await this.searchInstantAnswer(query, options);
      
      // If we got good instant results, return them
      if (instantResults.length > 0) {
        return instantResults;
      }
      
      // Fallback to HTML scraping for more comprehensive results
      return await this.searchHTML(query, options);
    } catch (error) {
      console.error('DuckDuckGo search error:', error);
      // Try alternative search method
      return await this.searchLite(query, options);
    }
  }

  private async searchInstantAnswer(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      no_redirect: '1',
      no_html: '1',
      skip_disambig: '1'
    });

    const response = await fetch(`${this.apiUrl}?${params}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: options.signal
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo API error: ${response.status}`);
    }

    const data = await response.json();
    const results: SearchResult[] = [];

    // Extract abstract if available
    if (data.AbstractText && data.AbstractURL) {
      results.push({
        title: data.Heading || query,
        url: data.AbstractURL,
        snippet: data.AbstractText,
        source: 'DuckDuckGo',
        relevanceScore: 0.9,
        metadata: {
          type: 'abstract',
          source: data.AbstractSource
        }
      });
    }

    // Extract related topics
    if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      data.RelatedTopics.forEach((topic: any) => {
        if (topic.FirstURL && topic.Text) {
          results.push({
            title: topic.Text.split(' - ')[0] || topic.Text,
            url: topic.FirstURL,
            snippet: topic.Text,
            source: 'DuckDuckGo',
            relevanceScore: 0.7,
            metadata: {
              type: 'related',
              icon: topic.Icon?.URL
            }
          });
        }
      });
    }

    // Extract answer if available
    if (data.Answer && data.AnswerType) {
      results.push({
        title: `Answer: ${data.AnswerType}`,
        url: data.AbstractURL || '#',
        snippet: data.Answer,
        source: 'DuckDuckGo',
        relevanceScore: 1.0,
        metadata: {
          type: 'answer',
          answerType: data.AnswerType
        }
      });
    }

    // Extract definition if available
    if (data.Definition && data.DefinitionURL) {
      results.push({
        title: 'Definition',
        url: data.DefinitionURL,
        snippet: data.Definition,
        source: 'DuckDuckGo',
        relevanceScore: 0.95,
        metadata: {
          type: 'definition',
          source: data.DefinitionSource
        }
      });
    }

    // Limit results based on options
    const maxResults = options.maxResults || 10;
    return results.slice(0, maxResults);
  }

  private async searchHTML(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    const formData = new FormData();
    formData.append('q', query);
    formData.append('kl', options.language || 'us-en');

    const response = await fetch(this.baseUrl, {
      method: 'POST',
      body: formData,
      signal: options.signal
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo HTML search error: ${response.status}`);
    }

    const html = await response.text();
    return this.parseHTMLResults(html, query, options);
  }

  private async searchLite(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    // Use DuckDuckGo Lite for simpler parsing
    const params = new URLSearchParams({
      q: query,
      kl: options.language || 'us-en',
      kp: '-2', // Safe search off
      kz: '-1', // No instant answers
      kav: '1', // Use HTTPS
      kaj: 'm' // Moderate safe search
    });

    const response = await fetch(`https://lite.duckduckgo.com/lite/?${params}`, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      signal: options.signal
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo Lite search error: ${response.status}`);
    }

    const html = await response.text();
    return this.parseLiteResults(html, query, options);
  }

  private parseHTMLResults(html: string, query: string, options: SearchOptions): SearchResult[] {
    const results: SearchResult[] = [];
    
    // Simple regex-based parsing for DuckDuckGo HTML results
    const resultPattern = /<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>[\s\S]*?<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([^<]+)<\/a>/g;
    
    let match;
    while ((match = resultPattern.exec(html)) !== null && results.length < (options.maxResults || 10)) {
      const [, url, title, snippet] = match;
      
      if (url && !url.startsWith('/') && !url.includes('duckduckgo.com')) {
        results.push({
          title: this.decodeHTML(title),
          url: this.decodeHTML(url),
          snippet: this.decodeHTML(snippet),
          source: 'DuckDuckGo',
          relevanceScore: this.calculateRelevance(query, title, snippet)
        });
      }
    }

    return results;
  }

  private parseLiteResults(html: string, query: string, options: SearchOptions): SearchResult[] {
    const results: SearchResult[] = [];
    
    // Parse DuckDuckGo Lite's simpler HTML structure
    const lines = html.split('\n');
    let currentResult: Partial<SearchResult> | null = null;
    
    for (const line of lines) {
      // Look for result links
      if (line.includes('class="result-link"')) {
        const urlMatch = line.match(/href="([^"]+)"/);
        const titleMatch = line.match(/>([^<]+)</);
        
        if (urlMatch && titleMatch) {
          if (currentResult) {
            results.push(currentResult as SearchResult);
          }
          
          currentResult = {
            url: this.decodeHTML(urlMatch[1]),
            title: this.decodeHTML(titleMatch[1]),
            source: 'DuckDuckGo'
          };
        }
      }
      
      // Look for snippets
      if (currentResult && line.includes('class="result-snippet"')) {
        const snippetMatch = line.match(/>([^<]+)</);
        if (snippetMatch) {
          currentResult.snippet = this.decodeHTML(snippetMatch[1]);
          currentResult.relevanceScore = this.calculateRelevance(
            query, 
            currentResult.title || '', 
            currentResult.snippet || ''
          );
        }
      }
      
      if (results.length >= (options.maxResults || 10)) {
        break;
      }
    }
    
    // Add the last result if exists
    if (currentResult && currentResult.snippet) {
      results.push(currentResult as SearchResult);
    }
    
    return results;
  }

  private decodeHTML(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .trim();
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
      if (word.length > 2) { // Skip very short words
        if (titleWords.includes(word)) score += 0.1;
        if (snippetWords.includes(word)) score += 0.05;
      }
    });
    
    return Math.min(score, 1);
  }

  async searchNews(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    // Add news-specific search
    const newsQuery = `${query} site:news.google.com OR site:reuters.com OR site:apnews.com OR site:bbc.com`;
    return this.performSearch(newsQuery, options);
  }

  async searchScholar(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
    // Add academic-specific search
    const scholarQuery = `${query} site:scholar.google.com OR site:arxiv.org OR site:pubmed.ncbi.nlm.nih.gov OR site:jstor.org`;
    return this.performSearch(scholarQuery, options);
  }
}

export default DuckDuckGoSearchService;
