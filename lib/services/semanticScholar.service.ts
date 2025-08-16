import { fetchWithRetry } from "@/lib/utils/retry"
import { supabase } from "@/lib/supabase"
import { get, set } from "idb-keyval"

interface Paper {
  paperId: string
  title: string
  abstract?: string
  authors?: { name: string }[]
  year?: number
  referenceCount?: number
  citationCount?: number
  url?: string
  references?: string[]
  citations?: string[]
  [k: string]: any
}

const S2_ENDPOINT = "https://api.semanticscholar.org/graph/v1/paper/"
const FIELDS = [
  "title",
  "abstract",
  "authors",
  "year",
  "url",
  "referenceCount",
  "citationCount",
  "references.paperId",
  "citations.paperId"
].join(",")

const COOLDOWN_KEY = "s2_cooldown_until"

/** Returns a paper either by id or query string. */
export async function getPaper(idOrQuery: string): Promise<Paper | null> {
  // 1. IndexedDB cache
  const localKey = `s2_${idOrQuery}`
  const local = await get<Paper>(localKey)
  if (local) return local

  // 2. Supabase cache
  const { data: row } = await supabase
    .from("papers_cache")
    .select("data")
    .eq("id", idOrQuery)
    .single()
  if (row?.data) {
    await set(localKey, row.data)
    return row.data as Paper
  }

  // Check cooldown to respect 429
  const cooldownUntil = (await get<number>(COOLDOWN_KEY)) || 0
  if (Date.now() < cooldownUntil) {
    console.warn("Semantic Scholar cooldown active")
    return null
  }

  // 3. Live fetch
  const url = idOrQuery.startsWith("10.")
    ? `${S2_ENDPOINT}DOI:${encodeURIComponent(idOrQuery)}?fields=${FIELDS}`
    : `${S2_ENDPOINT}${encodeURIComponent(idOrQuery)}?fields=${FIELDS}`

  const res = await fetchWithRetry(url, {}, 3)
  if (res.status === 429) {
    // backoff 10 minutes
    await set(COOLDOWN_KEY, Date.now() + 10 * 60 * 1000)
    return null
  }
  if (!res.ok) return null

  const data: Paper = await res.json()

  // Persist to caches (TTL handled server-side by column)
  await set(localKey, data)
  await supabase.from("papers_cache").upsert({ id: idOrQuery, data })

  return data
}
