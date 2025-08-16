// Dynamic passive voice detection utilities are loaded only when needed to avoid upfront bundle size.
// We use `unified` with `retext-english` + `retext-passive` to count passive-voice suggestions.


export interface GuardrailResult {
  ok: boolean
  issues: string[]
}

export async function runGuardrails(
  text: string,
  expectedCitationIds: string[] = [],
  maxWords = 1500,
  maxPassivePct = 15
): Promise<GuardrailResult> {
  const issues: string[] = []

  // Word count check
  const words = text.split(/\s+/).length
  if (words > maxWords) {
    issues.push(`Word count ${words} exceeds limit of ${maxWords}.`)
  }

  // Passive voice ratio – computed via `retext-passive` suggestions
  let passivePct = 0
  try {
    const [{ unified }, englishModule, passiveModule] = await Promise.all([
      import('unified'),
      import('retext-english'),
      import('retext-passive')
    ])
    const english: any = (englishModule as any).default || englishModule
    const passive: any = (passiveModule as any).default || passiveModule

    const file = await (unified as any)()
      .use(english)
      .use(passive)
      .process(text)

    const passiveCount = (file.messages || []).length
    const sentenceCount = text.split(/[.!?]+/).filter(Boolean).length || 1
    passivePct = (passiveCount / sentenceCount) * 100

    if (passivePct > maxPassivePct) {
      issues.push(`Passive voice ratio ${passivePct.toFixed(1)}% exceeds ${maxPassivePct}%.`)
    }
  } catch {
    // Optional dependency might be missing; silently ignore
  }

  // Citation consistency — ensure every [n] appears in expectedCitationIds & vice-versa
  if (expectedCitationIds.length > 0) {
    const foundIds = Array.from(text.matchAll(/\[([0-9]+)\]/g)).map(m => m[1])
    const missing = expectedCitationIds.filter(id => !foundIds.includes(id))
    const extra = foundIds.filter(id => !expectedCitationIds.includes(id))
    if (missing.length) issues.push(`Missing citation markers for ids: ${missing.join(', ')}`)
    if (extra.length) issues.push(`Unexpected citation markers present: ${extra.join(', ')}`)
  }

  return { ok: issues.length === 0, issues }
}
