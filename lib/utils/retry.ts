// Generic retry helper with exponential backoff and jitter
// --------------------------------------------------------
// Usage:
//   const response = await fetchWithRetry(url, {}, 3)
// --------------------------------------------------------

export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  maxRetries = 3,
  baseDelayMs = 1000
): Promise<Response> {
  let attempt = 0
  while (true) {
    try {
      const res = await fetch(url, init)
      // If not rate-limited (429) or server error (5xx) just return
      if (res.status !== 429 && res.status < 500) return res

      // Handle 429 / 5xx with retry
      if (attempt >= maxRetries) return res
    } catch (err) {
      // Network error – retry
      if (attempt >= maxRetries) throw err
    }

    // Backoff with jitter
    const delay = baseDelayMs * 2 ** attempt + Math.random() * 200
    await new Promise(r => setTimeout(r, delay))
    attempt++
  }
}
