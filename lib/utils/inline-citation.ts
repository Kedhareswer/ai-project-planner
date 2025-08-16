// Utility to convert numeric citation markers [1], [2]... into superscript links
// -----------------------------------------------------------------------------
// Example input: "This is referenced [1] and also [2]."
// Output:       "This is referenced <sup id=\"ref1\"><a href=\"#cite-1\">[1]</a></sup> and also <sup id=\"ref2\"><a href=\"#cite-2\">[2]</a></sup>."

export function transformInlineCitations(text: string) {
  return text.replace(/\[(\d+)\]/g, (_, num) => `<sup id="ref${num}"><a href="#cite-${num}">[${num}]</a></sup>`)
}

export function extractCitationNumbers(text: string): number[] {
  const nums = [...new Set((text.match(/\[(\d+)\]/g) || []).map(m => parseInt(m.replace(/[^0-9]/g, ''), 10)))]
  return nums.sort((a, b) => a - b)
}

export interface ReferencePaper {
  title: string
  authors: string[]
  year?: number | string
  doi?: string
  url?: string
}

export function buildReferenceBlock(numbers: number[], papers: ReferencePaper[]): string {
  if (numbers.length === 0) return ''
  let block = `\n\n### References\n`
  numbers.forEach(n => {
    const p = papers[n - 1] // assume 1-indexed correspondence
    if (!p) return
    const authors = p.authors.join(', ')
    const year = p.year || ''
    const link = p.doi ? `https://doi.org/${p.doi}` : p.url || ''
    block += `${n}. <span id="cite-${n}">${authors} (${year}). ${p.title}.${link ? ` <a href="${link}" target="_blank">link</a>` : ''} <a href="#ref${n}">↩︎</a></span>\n`
  })
  return block
}
