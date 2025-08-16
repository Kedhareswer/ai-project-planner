import { apiCache } from '@/lib/services/cache.service'
import { fetchWithRetry } from '@/lib/utils/retry'
import { supabase } from '@/integrations/supabase/client'

interface SemanticScholarPaper {
  paperId: string
  title: string
  abstract?: string
  year?: number
  authors: { name: string }[]
  url?: string
  doi?: string
  citationCount?: number
  referenceCount?: number
  journal?: { name: string }
  venue?: string
  // any other fields
}

const BASE_URL = 'https://api.semanticscholar.org/graph/v1/paper'
const FIELDS = [
  'title',
  'abstract',
  'year',
  'authors',
  'url',
  'doi',
  'citationCount',
  'referenceCount',
  'journal',
  'venue'
].join(',')

// 30 days TTL
const TTL = 30 * 24 * 60 * 60 * 1000

export class SemanticScholarService {
  static async getPaper(idOrDOI: string): Promise<SemanticScholarPaper | null> {
    const cacheKey = `ss_${idOrDOI}`

    return apiCache.getOrFetch(cacheKey, async () => {
      // 1. Check Supabase remote cache first
      try {
        const { data: remoteData } = await supabase
          .from('papers_cache')
          .select('data')
          .eq('id', idOrDOI)
          .single()

        if (remoteData?.data) {
          return remoteData.data as SemanticScholarPaper
        }
      } catch (error) {
        // Not fatal; log and continue
        console.warn('Supabase cache fetch failed', error)
      }

      // 2. Fetch from Semantic Scholar API with retry/backoff
      const url = `${BASE_URL}/${encodeURIComponent(idOrDOI)}?fields=${FIELDS}`
      const res = await fetchWithRetry(url, {
        headers: {
          'User-Agent': 'ai-project-planner/1.0',
          ...(process.env.NEXT_PUBLIC_SS_API_KEY && {
            'x-api-key': process.env.NEXT_PUBLIC_SS_API_KEY
          })
        }
      })

      if (!res.ok) {
        console.error('Semantic Scholar API error', res.status, await res.text())
        throw new Error(`Semantic Scholar responded ${res.status}`)
      }

      const paper = (await res.json()) as SemanticScholarPaper

      // 3. Store in Supabase (fire & forget)
      try {
        await supabase.from('papers_cache').upsert({ id: idOrDOI, data: paper })
      } catch (error) {
        console.warn('Supabase upsert failed', error)
      }

      return paper
    }, TTL)
  }
}
