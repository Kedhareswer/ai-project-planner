// Semantic Scholar API integration with caching & rate-limit protection
// -------------------------------------------------------------------
// Docs: https://api.semanticscholar.org/

import { apiCache } from '@/lib/services/cache.service'
import { fetchWithRetry } from '@/lib/utils/retry'

interface SemanticScholarPaper {
  paperId: string
  title: string
  abstract?: string
  venue?: string
  year?: number
  authors: Array<{
    authorId?: string
    name: string
  }>
  citationCount: number
  referenceCount: number
  influentialCitationCount: number
  isOpenAccess: boolean
  openAccessPdf?: {
    url: string
    status: string
  }
  fieldsOfStudy?: string[]
  s2FieldsOfStudy?: Array<{
    category: string
    source: string
  }>
  publicationTypes?: string[]
  publicationDate?: string
  journal?: {
    name: string
    pages?: string
    volume?: string
  }
  externalIds?: {
    DOI?: string
    ArXiv?: string
    MAG?: string
    PubMed?: string
  }
  url?: string
  tldr?: {
    model: string
    text: string
  }
}

interface SemanticScholarSearchResponse {
  total: number
  offset: number
  next?: number
  data: SemanticScholarPaper[]
}

const BASE_URL = 'https://api.semanticscholar.org/graph/v1'
const DEFAULT_USER_AGENT = 'ai-project-planner/1.0 (research@example.com)'
const CACHE_TTL = 30 * 24 * 60 * 60 * 1000 // 30 days

// ------------------------ Helper ------------------------
async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetchWithRetry(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': DEFAULT_USER_AGENT
    }
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

function cacheKey(prefix: string, ...parts: (string | number | undefined)[]) {
  return `${prefix}_${parts.map(p => encodeURIComponent(String(p))).join('_')}`
}

// ---------------------- API wrappers --------------------
export async function searchSemanticScholar(
  query: string,
  limit = 20,
  fields: string[] = [
    'paperId', 'title', 'abstract', 'venue', 'year', 'authors',
    'citationCount', 'referenceCount', 'influentialCitationCount',
    'isOpenAccess', 'openAccessPdf', 'fieldsOfStudy', 's2FieldsOfStudy',
    'publicationTypes', 'publicationDate', 'journal', 'externalIds', 'url', 'tldr'
  ]
): Promise<SemanticScholarPaper[]> {
  const encodedQuery = encodeURIComponent(query)
  const url = `${BASE_URL}/paper/search?query=${encodedQuery}&limit=${limit}&fields=${fields.join(',')}`
  const key = cacheKey('ss_search', query.toLowerCase(), limit)

  return apiCache.getOrFetch(key, async () => {
    try {
      const data: SemanticScholarSearchResponse = await fetchJSON(url)
      return data.data || []
    } catch (err) {
      console.warn('[SemanticScholar] Search failed', err)
      return []
    }
  }, CACHE_TTL)
}

export async function getCitationData(identifier: string, type: 'doi' | 'title' = 'doi') {
  const idClean = type === 'doi' ? identifier.replace(/^https?:\/\/(dx\.)?doi\.org\//, '') : identifier.trim()
  const key = cacheKey('ss_cite', type, idClean)

  return apiCache.getOrFetch(key, async () => {
    try {
      if (type === 'title') {
        const results = await searchSemanticScholar(idClean, 1)
        return results[0] || null
      }
      const url = `${BASE_URL}/paper/DOI:${encodeURIComponent(idClean)}?fields=paperId,title,citationCount,referenceCount,influentialCitationCount,isOpenAccess,openAccessPdf,fieldsOfStudy,publicationDate,journal,externalIds,tldr`
      return await fetchJSON<SemanticScholarPaper>(url)
    } catch (err) {
      console.debug('[SemanticScholar] Citation lookup error', err)
      return null
    }
  }, CACHE_TTL)
}

export async function getRecommendations(paperId: string, limit = 10) {
  const key = cacheKey('ss_rec', paperId, limit)

  return apiCache.getOrFetch(key, async () => {
    try {
      const fields = 'paperId,title,abstract,venue,year,authors,citationCount,isOpenAccess,fieldsOfStudy'
      const url = `${BASE_URL}/paper/${paperId}/recommendations?limit=${limit}&fields=${fields}`
      const data = await fetchJSON<{ recommendedPapers: SemanticScholarPaper[] }>(url)
      return data.recommendedPapers || []
    } catch (err) {
      console.warn('[SemanticScholar] Recommendation error', err)
      return []
    }
  }, CACHE_TTL)
}

// -------------------- Transform helpers -----------------
export function transformSemanticScholarPaper(paper: SemanticScholarPaper) {
  return {
    id: paper.paperId,
    title: paper.title,
    authors: paper.authors?.map(a => a.name) || [],
    abstract: paper.abstract || 'No abstract available',
    year: paper.year || new Date().getFullYear(),
    journal: paper.venue || paper.journal?.name || 'Unknown Journal',
    url: paper.url || (paper.externalIds?.DOI ? `https://doi.org/${paper.externalIds.DOI}` : ''),
    doi: paper.externalIds?.DOI || '',
    pdf_url: paper.openAccessPdf?.url || '',
    venue: paper.venue,
    venue_type: determineVenueType(paper),
    publication_date: paper.publicationDate,
    cited_by_count: paper.citationCount || 0,
    reference_count: paper.referenceCount || 0,
    open_access: {
      is_oa: paper.isOpenAccess || false,
      oa_url: paper.openAccessPdf?.url,
      any_repository_has_fulltext: !!paper.openAccessPdf
    },
    field_of_study: paper.fieldsOfStudy || [],
    tldr: paper.tldr?.text,
    source: 'semantic_scholar' as const,
    type: paper.publicationTypes?.[0] || 'article'
  }
}

function determineVenueType(paper: SemanticScholarPaper): 'journal' | 'conference' | 'book' | 'repository' | 'other' {
  const venue = (paper.venue || '').toLowerCase()
  const types = paper.publicationTypes?.map(t => t.toLowerCase()) || []
  if (types.includes('conference') || venue.includes('conference') || venue.includes('proceedings')) return 'conference'
  if (types.includes('journal') || venue.includes('journal')) return 'journal'
  if (types.includes('book') || venue.includes('book')) return 'book'
  if (venue.includes('arxiv') || venue.includes('preprint')) return 'repository'
  return 'other'
}

// Quick connectivity test
export async function testSemanticScholarAPI() {
  try {
    const res = await fetchWithRetry(`${BASE_URL}/paper/search?query=test&limit=1`)
    return res.ok
  } catch {
    return false
  }
}
