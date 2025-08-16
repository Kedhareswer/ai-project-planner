"use client"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { EmptyState } from "@/components/ui/empty-state"
import { buildWritingPrompt } from "@/lib/prompt-builder"
import { useToast } from "@/hooks/use-toast"
import { useResearchSession } from "@/components/research-session-provider"
import { AI_PROVIDERS, type AIProvider } from "@/lib/ai-providers"
import { Label } from "@/components/ui/label"
import { FileProcessor, type FileProcessingResult } from "@/lib/file-processors"
import { transformInlineCitations, extractCitationNumbers, buildReferenceBlock } from "@/lib/utils/inline-citation"
import { getPreset } from "@/lib/config/model-presets"
import { runGuardrails } from "@/lib/services/guardrails.service"
import { supabase } from "@/lib/supabase"
import MinimalAIProviderSelector from "@/components/ai-provider-selector-minimal"
import { searchSemanticScholar, getCitationData, transformSemanticScholarPaper } from "@/app/explorer/semantic-scholar"
import {
  Sparkles,
  ChevronUp,
  ChevronDown,
  Settings,
  AlertTriangle,
  Loader2,
  CheckCircle,
  Copy,
  Download,
  PenLine,
  ArrowRight,
  Lightbulb,
  MessageSquare
} from "lucide-react"

interface AIWritingAssistantProps {
  selectedProvider: string
  selectedModel: string
  onInsertText: (text: string) => void
  documentTemplate: string
  currentDocumentContent?: string // Add current document content for better context
  isAuthenticated?: boolean // Add authentication state
  onProviderChange?: (provider: AIProvider | undefined) => void
  onModelChange?: (model: string | undefined) => void
}

export function AIWritingAssistant({
  selectedProvider,
  selectedModel,
  onInsertText,
  documentTemplate,
  currentDocumentContent = "",
  isAuthenticated = false,
  onProviderChange,
  onModelChange
}: AIWritingAssistantProps) {
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const preset = getPreset(selectedProvider, selectedModel)
  const [temperature, setTemperature] = useState(preset?.defaultTemperature ?? 0.5)
  const [generatedText, setGeneratedText] = useState('')
  const [writingTask, setWritingTask] = useState<string>('continue')
  const [showSettings, setShowSettings] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<string>('')
  const [ragEnabled, setRagEnabled] = useState<boolean>(true)
  const [uploadedSources, setUploadedSources] = useState<Array<{ content: string; metadata: FileProcessingResult['metadata']; name: string }>>([])
  const [ragIndex, setRagIndex] = useState<{
    chunks: Array<{ text: string; terms: Map<string, number> }>
    idf: Map<string, number>
    totalDocs: number
  } | null>(null)

  const { toast } = useToast()
  const { session, getSelectedPapers } = useResearchSession()

  // Writing task options
  const writingTasks = [
    { id: 'continue', name: 'Continue Writing', description: 'Continue from where you left off' },
    { id: 'introduction', name: 'Introduction', description: 'Write an introduction for your document' },
    { id: 'abstract', name: 'Abstract', description: 'Generate a concise abstract' },
    { id: 'literature_review', name: 'Literature Review', description: 'Review and synthesize related work' },
    { id: 'custom', name: 'Custom', description: 'Write based on custom instructions' },
    { id: 'analyze', name: 'Analyze & Improve', description: 'Analyze current content and suggest improvements' },
  ]

  // Get available models for the selected provider
  const getAvailableModels = (provider: AIProvider) => {
    const providerConfig = AI_PROVIDERS[provider]
    return providerConfig?.models || ['gpt-4']
  }

  // Template-specific writing styles
  const getTemplateStyle = () => {
    switch (documentTemplate) {
      case 'ieee':
        return 'IEEE format with technical precision and third-person formal academic style';
      case 'acm':
        return 'ACM format with clear technical descriptions and formal academic style';
      case 'springer':
        return 'Springer format with concise, formal academic writing';
      case 'elsevier':
        return 'Elsevier format with structured academic writing and formal tone';
      default:
        return 'standard academic style';
    }
  }

  // -------- RAG utilities (lightweight, client-side) --------
  const normalizeText = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()

  const tokenize = (text: string): string[] => {
    const stopwords = new Set([
      'the', 'is', 'a', 'an', 'and', 'or', 'of', 'to', 'in', 'for', 'on', 'with', 'as', 'by', 'at', 'from', 'that', 'this', 'it', 'be', 'are', 'was', 'were', 'has', 'have', 'had', 'but', 'not', 'if', 'than', 'then', 'into', 'we', 'our', 'their', 'its'
    ])
    return normalizeText(text)
      .split(' ')
      .filter((t) => t && !stopwords.has(t))
  }

  const chunkText = (text: string, targetChars = 1200): string[] => {
    const paragraphs = text
      .replace(/\r\n/g, "\n")
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean)

    const chunks: string[] = []
    let buffer = ''
    for (const p of paragraphs) {
      if ((buffer + '\n\n' + p).length > targetChars && buffer) {
        chunks.push(buffer)
        buffer = p
      } else {
        buffer = buffer ? buffer + '\n\n' + p : p
      }
    }
    if (buffer) chunks.push(buffer)

    // Fallback to sentence-based split if still too large
    const final: string[] = []
    for (const c of chunks) {
      if (c.length <= targetChars * 1.5) {
        final.push(c)
      } else {
        const sentences = c.split(/(?<=[.!?])\s+/)
        let sBuf = ''
        for (const s of sentences) {
          if ((sBuf + ' ' + s).length > targetChars && sBuf) {
            final.push(sBuf)
            sBuf = s
          } else {
            sBuf = sBuf ? sBuf + ' ' + s : s
          }
        }
        if (sBuf) final.push(sBuf)
      }
    }
    return final
  }

  const buildRagIndex = (texts: string[]) => {
    const chunks: Array<{ text: string; terms: Map<string, number> }> = []
    const df = new Map<string, number>()
    const addDoc = (doc: string) => {
      const terms = new Map<string, number>()
      const seen = new Set<string>()
      for (const tok of tokenize(doc)) {
        terms.set(tok, (terms.get(tok) || 0) + 1)
        if (!seen.has(tok)) {
          df.set(tok, (df.get(tok) || 0) + 1)
          seen.add(tok)
        }
      }
      chunks.push({ text: doc, terms })
    }
    texts.forEach(addDoc)
    const totalDocs = chunks.length || 1
    const idf = new Map<string, number>()
    for (const [term, count] of df.entries()) {
      idf.set(term, Math.log((totalDocs + 1) / (count + 1)) + 1)
    }
    setRagIndex({ chunks, idf, totalDocs })
  }

  const cosineSimilarity = (a: Map<string, number>, b: Map<string, number>) => {
    let dot = 0
    let aNorm = 0
    let bNorm = 0
    const keys = new Set([...a.keys(), ...b.keys()])
    for (const k of keys) {
      const av = a.get(k) || 0
      const bv = b.get(k) || 0
      dot += av * bv
      aNorm += av * av
      bNorm += bv * bv
    }
    if (aNorm === 0 || bNorm === 0) return 0
    return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm))
  }

  const makeTfIdf = (terms: Map<string, number>, idf: Map<string, number>) => {
    const vec = new Map<string, number>()
    for (const [t, f] of terms.entries()) {
      vec.set(t, f * (idf.get(t) || 0))
    }
    return vec
  }

  const retrieveTopK = (query: string, k = 8) => {
    if (!ragEnabled || !ragIndex) return [] as string[]
    const qTerms = new Map<string, number>()
    for (const t of tokenize(query)) qTerms.set(t, (qTerms.get(t) || 0) + 1)
    const qVec = makeTfIdf(qTerms, ragIndex.idf)
    const scored = ragIndex.chunks.map((c) => ({
      text: c.text,
      score: cosineSimilarity(qVec, makeTfIdf(c.terms, ragIndex.idf)),
    }))
    scored.sort((x, y) => y.score - x.score)
    return scored.slice(0, k).map((s) => s.text)
  }

  const handleFileInput = async (file: File) => {
    try {
      // Validate supported types
      if (!FileProcessor.getSupportedTypes().includes(file.type)) {
        throw new Error(`Unsupported type: ${file.type}`)
      }
      const result = await FileProcessor.processFile(file)
      setUploadedSources((prev) => [
        ...prev,
        { content: result.content, metadata: result.metadata, name: file.name }
      ])
      // Build/refresh RAG index
      const allTexts = [result.content, ...uploadedSources.map((s) => s.content)]
      const allChunks = allTexts.flatMap((t) => chunkText(t))
      buildRagIndex(allChunks)
      toast({ title: "Source added", description: `${file.name} • ${result.metadata.wordCount} words` })
    } catch (err) {
      toast({ title: "File processing failed", description: err instanceof Error ? err.message : String(err), variant: "destructive" })
    }
  }

  // Enrich paper data with semantic scholar information
  const enrichPaperData = async (papers: any[]) => {
    const enrichedPapers = []
    
    for (const paper of papers) {
      try {
        // Try to get enhanced data from Semantic Scholar
        let enhancedData = null
        
        // First try by DOI if available
        if (paper.doi) {
          enhancedData = await getCitationData(paper.doi, 'doi')
        }
        
        // If no DOI or DOI lookup failed, try by title
        if (!enhancedData && paper.title) {
          const searchResults = await searchSemanticScholar(paper.title, 1)
          if (searchResults.length > 0) {
            enhancedData = searchResults[0]
          }
        }
        
        // Combine original paper data with enhanced data
        if (enhancedData) {
          const transformed = transformSemanticScholarPaper(enhancedData)
          enrichedPapers.push({
            ...paper,
            ...transformed,
            // Keep original data if enhanced is missing
            title: paper.title || transformed.title,
            authors: paper.authors?.length ? paper.authors : transformed.authors,
            year: paper.year || transformed.year,
            abstract: transformed.abstract || paper.abstract || 'Abstract not available',
            journal: transformed.journal || paper.journal || paper.venue,
            doi: paper.doi || transformed.doi,
            citationCount: transformed.cited_by_count || 0,
            methodology: extractMethodologyFromAbstract(transformed.abstract || paper.abstract || ''),
            keyFindings: extractKeyFindingsFromAbstract(transformed.abstract || paper.abstract || ''),
            enhanced: true
          })
        } else {
          // Keep original paper but mark as not enhanced
          enrichedPapers.push({
            ...paper,
            enhanced: false,
            methodology: extractMethodologyFromAbstract(paper.abstract || ''),
            keyFindings: extractKeyFindingsFromAbstract(paper.abstract || '')
          })
        }
      } catch (error) {
        console.warn(`Failed to enrich paper: ${paper.title}`, error)
        enrichedPapers.push({ ...paper, enhanced: false })
      }
    }
    
    return enrichedPapers
  }
  
  // Extract methodology hints from abstract
  const extractMethodologyFromAbstract = (abstract: string): string => {
    if (!abstract) return 'Not specified'
    
    const methodKeywords = [
      'machine learning', 'deep learning', 'neural network', 'cnn', 'rnn', 'lstm',
      'regression', 'classification', 'clustering', 'survey', 'review', 'analysis',
      'experimental', 'empirical', 'simulation', 'case study', 'dataset', 'algorithm'
    ]
    
    const foundMethods = methodKeywords.filter(keyword => 
      abstract.toLowerCase().includes(keyword.toLowerCase())
    )
    
    return foundMethods.length > 0 ? foundMethods.slice(0, 3).join(', ') : 'Literature analysis'
  }
  
  // Extract key findings from abstract
  const extractKeyFindingsFromAbstract = (abstract: string): string => {
    if (!abstract) return 'Not specified'
    
    // Look for result indicators
    const resultPatterns = [
      /results?\s+(?:show|indicate|demonstrate|reveal)[^.]*\./gi,
      /found\s+that[^.]*\./gi,
      /achieved[^.]*\./gi,
      /improved?[^.]*\./gi,
      /accuracy[^.]*\./gi,
      /performance[^.]*\./gi
    ]
    
    for (const pattern of resultPatterns) {
      const matches = abstract.match(pattern)
      if (matches && matches[0]) {
        return matches[0].trim().slice(0, 100) + (matches[0].length > 100 ? '...' : '')
      }
    }
    
    // Fallback: return first sentence that might contain findings
    const sentences = abstract.split(/[.!?]+/)
    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes('show') || 
          sentence.toLowerCase().includes('found') ||
          sentence.toLowerCase().includes('result')) {
        return sentence.trim().slice(0, 100) + (sentence.length > 100 ? '...' : '')
      }
    }
    
    return 'Key contributions in ' + abstract.slice(0, 50) + '...'
  }

  // Get research context for AI prompt
  const getResearchContext = async () => {
    let context = 'Research Context:\n'

    // Add session data if available
    if (session?.currentTopic) {
      context += `Current Topic: ${session.currentTopic}\n`
    }

    if (session?.selectedPapers?.length > 0) {
      // Enrich papers with semantic scholar data for literature review
      let papersToUse = session.selectedPapers
      
      if (writingTask === 'literature_review') {
        toast({
          title: "Enriching paper data",
          description: "Fetching detailed information from academic databases..."
        })
        
        try {
          papersToUse = await enrichPaperData(session.selectedPapers.slice(0, 8))
        } catch (error) {
          console.warn('Failed to enrich papers:', error)
          toast({
            title: "Using basic paper data", 
            description: "Could not fetch enhanced data, using available information."
          })
        }
      }
      
      context += `\n=== SELECTED PAPERS FOR LITERATURE REVIEW ===\n`
      context += `Total Papers: ${papersToUse.length}\n\n`
      
      papersToUse.forEach((paper: any, index: number) => {
        const authors = paper.authors?.slice(0, 3).join(', ') || 'Authors not specified'
        const year = paper.year || paper.publication_year || paper.date?.slice(0, 4) || 'Year not specified'
        const journal = paper.journal || paper.venue || paper.source || ''
        const doi = paper.doi || ''
        const methodology = paper.methodology || 'Not specified'
        const keyFindings = paper.keyFindings || 'Not specified'
        const citationCount = paper.citationCount || paper.cited_by_count || 0
        
        context += `PAPER ${index + 1}${paper.enhanced ? ' (Enhanced)' : ''}:\n`
        context += `Title: ${paper.title || 'Title not specified'}\n`
        context += `Authors: ${authors}\n`
        context += `Year: ${year}\n`
        if (journal) context += `Journal/Venue: ${journal}\n`
        if (doi) context += `DOI: ${doi}\n`
        context += `Citation Count: ${citationCount}\n`
        context += `Methodology: ${methodology}\n`
        context += `Key Findings: ${keyFindings}\n`
        if (paper.abstract) {
          context += `Abstract: ${paper.abstract}\n`
        }
        if (paper.keywords) {
          context += `Keywords: ${Array.isArray(paper.keywords) ? paper.keywords.join(', ') : paper.keywords}\n`
        }
        if (paper.tldr) {
          context += `TL;DR: ${paper.tldr}\n`
        }
        context += `\n---\n\n`
      })
    }

    if (session?.selectedIdeas?.length > 0) {
      context += `Selected Ideas: ${session.selectedIdeas.length} ideas\n`
      session.selectedIdeas.slice(0, 3).forEach((idea: any, index: number) => {
        context += `  ${index + 1}. ${idea.title || 'Untitled'}\n`
      })
    }

    // Add current document content for context
    if (currentDocumentContent && currentDocumentContent.trim()) {
      const contentPreview = currentDocumentContent.slice(0, 500) // First 500 characters
      context += `\nCurrent Document Content (preview):\n${contentPreview}${currentDocumentContent.length > 500 ? '...' : ''}\n`
    }

    // Add RAG retrieved context from uploaded sources
    if (ragEnabled && ragIndex && uploadedSources.length > 0) {
      const queryHints = [writingTask, prompt, session?.currentTopic, documentTemplate]
        .filter(Boolean)
        .join(' | ')
      const top = retrieveTopK(queryHints, 8)
      const joined = top
        .map((t, i) => `RETRIEVED SOURCE ${i + 1}:\n${t.substring(0, 800)}`)
        .join("\n\n---\n\n")
      if (joined) {
        context += `\n=== RETRIEVED CONTEXT FROM UPLOADED SOURCES ===\n${joined}\n\n`
      }
    }

    context += `Using: ${selectedProvider} with ${selectedModel}\n`
    context += `Template: ${documentTemplate || 'Standard Academic'}\n`

    return context
  }

  // Generate AI writing based on task and context
  const generateText = async () => {
    if (isGenerating) return

    // Check if user is authenticated
    if (!isAuthenticated) {
      toast({
        title: "Authentication required",
        description: "Please log in to use the AI Writing Assistant. Your API keys are stored securely in your account.",
        variant: "destructive",
      })
      return
    }

    try {
      setIsGenerating(true)

      // Get current Supabase session
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        throw new Error("No valid session found")
      }

      const templateStyle = getTemplateStyle()
      const researchContext = await getResearchContext()

      const fullPrompt = buildWritingPrompt({
        templateStyle,
        researchContext,
        writingTask,
        ragEnabled,
        uploadedSourceCount: uploadedSources.length,
        systemPromptAddon: preset?.systemPromptAddon,
      })

      // Call the AI generation API with authentication
      const response = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          prompt: fullPrompt,
          provider: selectedProvider,
          model: selectedModel,
          maxTokens: 1200,
          temperature,
          metadata: {
            ragEnabled,
            uploadedSourceCount: uploadedSources.length,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to generate content')
      }

      if (!response.body) throw new Error('No response stream')

      // For now, handle as regular JSON response (streaming can be implemented later with SSE)
      const data = await response.json()
      
      if (!data.success || !data.response) {
        throw new Error(data.error || 'No content generated')
      }
      
      // Extract the actual content from the JSON response
      // Transform numeric citation markers into superscript links
            const generatedContentRaw = data.response || data.content
      const citationNumbers = extractCitationNumbers(generatedContentRaw)
      // Build reference block using selected papers from Research Session (if any)
      const refPapers = getSelectedPapers()
      const referenceBlock = buildReferenceBlock(citationNumbers, refPapers)
      const contentWithRefs = generatedContentRaw + referenceBlock
      const generatedContent = transformInlineCitations(contentWithRefs)
      // Run guardrails validation
      const guard = await runGuardrails(generatedContent)
      if (!guard.ok) {
        toast({
          title: "Quality issues detected",
          description: guard.issues.join("; "),
          variant: "destructive"
        })
      }

      setGeneratedText(generatedContent)

      // Extract citations (DOIs) from the generated text
      const doiRegex = /(10\.\d{4,9}\/[-._;()\/:A-Z0-9]+)/gi
      const dois = [...new Set((generatedContent.match(doiRegex) || []))]
      if (dois.length > 0) {
        toast({ 
          title: "Citations detected", 
          description: `${dois.length} DOI(s) extracted and sent to Citation Manager.` 
        })
        // TODO: integrate with citation manager context/state
      }

      toast({
        title: "Content generated",
        description: `AI writing assistant generated ${writingTask} content using ${selectedProvider}.`,
      })
    } catch (error) {
      console.error("Error generating text:", error)
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "There was an error generating the content. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  // Insert the generated text into the editor
  const handleInsert = () => {
    if (!generatedText) return

    // Add a newline before insertion if the document already has content
    const insertText = currentDocumentContent && currentDocumentContent.trim()
      ? `\n\n${generatedText}`
      : generatedText

    onInsertText(insertText)
    setGeneratedText('') // Clear the generated text after insertion
    toast({
      title: "Text inserted",
      description: "Generated text has been inserted into your document.",
    })
  }

  return (
    <div className="space-y-4">
      {/* Show EmptyState when no content and not authenticated */}
      {!isAuthenticated && (
        <EmptyState
          title="AI Writing Assistant"
          description="Log in to access AI-powered writing assistance and get intelligent suggestions for your documents."
          icons={[Lightbulb, MessageSquare]}
          action={{
            label: "Go to Login",
            onClick: () => window.location.href = '/login'
          }}
        />
      )}

      {/* Show EmptyState when authenticated but no content */}
      {isAuthenticated && !currentDocumentContent.trim() && (
        <EmptyState
          title="No Content to Work With"
          description="Start writing in the editor above to get AI-powered suggestions and improvements."
          icons={[PenLine, Lightbulb]}
          action={{
            label: "Start Writing",
            onClick: () => {
              // Focus the editor (this would need to be passed as a prop)
              const editor = document.querySelector('[contenteditable="true"]') as HTMLElement
              if (editor) editor.focus()
            }
          }}
        />
      )}

      {/* Settings Toggle */}
      <div className="flex justify-between items-center">
        <div className="flex flex-wrap gap-2 items-center">
          {writingTasks.map(task => (
            <Badge
              key={task.id}
              variant={writingTask === task.id ? "default" : "outline"}
              className="cursor-pointer hover:bg-primary/10"
              onClick={() => setWritingTask(task.id)}
            >
              {task.name}
            </Badge>
          ))}
          <div className="flex items-center gap-2 ml-2">
            <Label className="text-xs">RAG</Label>
            <input
              type="checkbox"
              checked={ragEnabled}
              onChange={(e) => setRagEnabled(e.target.checked)}
              className="h-4 w-4"
              aria-label="Toggle retrieval augmented generation"
            />
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowSettings(!showSettings)}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* AI Provider Settings */}
      {showSettings && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-4">
              <MinimalAIProviderSelector
                selectedProvider={selectedProvider as AIProvider}
                selectedModel={selectedModel}
                onProviderChange={onProviderChange || (() => { })}
                onModelChange={onModelChange || (() => { })}
                variant="compact"
                showModelSelector={true}
                showConfigLink={false}
              />
            </CardContent>
          </Card>
          <div className="flex items-center gap-4">
            <Label className="text-xs w-24">Creativity</Label>
            <Slider
              min={0}
              max={1}
              step={0.1}
              value={[temperature]}
              onValueChange={(v)=>setTemperature(v[0])}
              className="w-full"
            />
            <span className="text-xs w-10 text-right">{temperature.toFixed(1)}</span>
          </div>
        </div>
      )}

      {writingTask === 'custom' && (
        <div className="space-y-2">
          <Textarea
            placeholder="Describe what you want the AI to write about..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[100px]"
          />
          <div className="flex items-center gap-2">
            <Input type="file" accept={FileProcessor.getSupportedTypes().join(",")} onChange={(e) => e.target.files && handleFileInput(e.target.files[0])} />
            <Label className="text-xs text-muted-foreground">Add .docx/.pdf/.txt as context</Label>
          </div>
          {uploadedSources.length > 0 && (
            <div className="text-xs text-muted-foreground">
              {uploadedSources.length} source(s) added for context
            </div>
          )}
        </div>
      )}

      <div className="flex gap-2">
        <Button
          onClick={generateText}
          disabled={isGenerating || !isAuthenticated}
          className="w-full bg-black hover:bg-gray-800 text-white"
        >
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : !isAuthenticated ? (
            <>
              <AlertTriangle className="mr-2 h-4 w-4" />
              Login Required
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate
            </>
          )}
        </Button>

        {generatedText && writingTask !== 'analyze' && (
          <Button variant="outline" onClick={handleInsert}>
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {generatedText && (
        <Card>
          <CardContent className="pt-4">
            <div className="text-sm mb-2 flex items-center gap-1 text-muted-foreground">
              <PenLine className="h-3 w-3" />
              <span>{writingTask === 'analyze' ? 'Document Analysis' : 'AI Generated Content'}</span>
            </div>
            <div className="text-sm whitespace-pre-wrap leading-relaxed">
              {generatedText}
            </div>
            {writingTask !== 'analyze' && (
              <div className="mt-3 flex justify-end">
                <Button size="sm" variant="ghost" onClick={handleInsert}>
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Insert
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <div className="text-xs text-muted-foreground mt-2">
        {isAuthenticated ? (
          <>
            Using {AI_PROVIDERS[selectedProvider as AIProvider]?.name || selectedProvider} / {selectedModel} with {documentTemplate || 'standard'} template style
          </>
        ) : (
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-3 w-3" />
            <span>Please log in to use AI features. Your API keys are stored securely in your account.</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default AIWritingAssistant
