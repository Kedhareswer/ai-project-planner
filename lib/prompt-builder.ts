export interface PromptBuilderOptions {
  templateStyle: string
  researchContext: string
  writingTask: string
  ragEnabled: boolean
  uploadedSourceCount: number
  systemPromptAddon?: string
}

export function getTaskPrompt(writingTask: string): string {
  switch (writingTask) {
    case 'continue':
      return 'Continue writing the document from where it left off. Maintain the same style, tone, and academic rigor.';
    case 'introduction':
      return 'Write a compelling introduction for this research document. Include background context, research question, and significance.';
    case 'abstract':
      return 'Write a concise abstract (150-250 words) that summarizes the research problem, methodology, key findings, and conclusions.';
    case 'literature_review':
      return `Write a rigorous Literature Review that critically synthesizes the studies listed in the Research Context section below. Focus on the Selected Papers provided in the context - these are the primary sources you must analyze and include in your review.\n\nStructure your review with:\n1. An overview paragraph summarizing the research landscape\n2. Thematic analysis of the provided papers\n3. Identification of gaps and future directions\n\nCRITICAL: Include a \"Comparison of Recent Studies\" table using ONLY the papers listed in the \"Selected Papers\" section of the Research Context. Extract the following details for each paper:\n- Author/Year: Use the authors and year provided\n- Focus: Derive from the title and abstract\n- Method/Dataset: Extract methodology information from abstracts if available\n- Key Findings: Summarize main contributions from abstracts\n- Limitations/Relevance: Note any limitations mentioned or relevance to the research topic\n\nDo NOT write \"unknown\" - use the specific paper details provided in the Research Context. If a detail is not provided in the context, write \"not specified in source.\"`;
    case 'analyze':
      return 'Analyze the current document content for structure, clarity, academic tone, and coherence. Provide specific suggestions for improvement.';
    default:
      return 'Continue writing the document in a professional academic style.';
  }
}

export function buildWritingPrompt(opts: PromptBuilderOptions): string {
  const { templateStyle, researchContext, writingTask, ragEnabled, uploadedSourceCount, systemPromptAddon } = opts;

  let systemPrompt = `You are a professional academic writer assisting with a research document in ${templateStyle}. ` +
    'Write in a clear, academic style appropriate for publication. Focus on producing coherent, well-structured text that would be suitable for a scholarly publication. ' +
    'Always maintain academic integrity and provide well-reasoned arguments.';

  if (systemPromptAddon) {
    systemPrompt += ' ' + systemPromptAddon
  }

  if (writingTask === 'literature_review') {
    systemPrompt += ' IMPORTANT: You must use the specific papers listed in the "Selected Papers" section of the Research Context below. Extract author names, years, titles, and abstract information directly from the provided context. Do NOT use placeholder values like "unknown" - use the actual data provided.';
  }

  if (ragEnabled) {
    systemPrompt += ' Use ONLY the provided Retrieved Context and Session Context for factual statements. If the context is insufficient, explicitly state "insufficient context" rather than inventing facts.';
  }

  const taskPrompt = getTaskPrompt(writingTask);

  let contextNote = uploadedSourceCount > 0 ? `The user has provided ${uploadedSourceCount} additional source file(s) that may include relevant quotes or data.` : '';

return `${systemPrompt}\n\n${contextNote}\n\n${researchContext}\n\nTask: ${taskPrompt}`.trim();
}
