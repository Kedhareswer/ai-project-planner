"use client"

import { useState, useEffect } from "react"
import { Brain, Play, Loader2, AlertCircle, FileText, ListTree, CheckCircle2, Settings } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { AIProviderDetector } from "@/lib/ai-provider-detector"
import { AI_PROVIDERS, type AIProvider } from "@/lib/ai-providers"

interface DeepResearchResult {
  success: boolean
  final_report?: string
  research_brief?: string
  notes?: string[]
  raw_notes?: string[]
  error?: string
  details?: string
}

export function DeepResearch() {
  const { toast } = useToast()
  const [query, setQuery] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<DeepResearchResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [availableProviders, setAvailableProviders] = useState<AIProvider[]>([])
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | "">("")
  const [selectedModel, setSelectedModel] = useState<string>("")
  const [showSettings, setShowSettings] = useState(false)

  // Load available providers on component mount
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const providers = await AIProviderDetector.getClientAvailableProviders()
        setAvailableProviders(providers)
        if (providers.length > 0) {
          setSelectedProvider(providers[0])
          setSelectedModel(AI_PROVIDERS[providers[0] as AIProvider].models[0])
        }
      } catch (error) {
        console.error('Failed to load AI providers:', error)
      }
    }
    loadProviders()
  }, [])

  // Update model when provider changes
  useEffect(() => {
    if (selectedProvider && AI_PROVIDERS[selectedProvider as AIProvider]) {
      setSelectedModel(AI_PROVIDERS[selectedProvider as AIProvider].models[0])
    }
  }, [selectedProvider])

  const runDeepResearch = async () => {
    if (!query.trim()) return
    if (!selectedProvider || !selectedModel) {
      toast({ title: "Configuration required", description: "Please select an AI provider and model", variant: "destructive" })
      return
    }
    
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch("/api/deep-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          query: query.trim(),
          provider: selectedProvider,
          model: selectedModel
        })
      })

      const data: DeepResearchResult = await res.json()
      if (!res.ok || data.success === false) {
        const msg = data.error || `Request failed with status ${res.status}`
        setError(msg)
        toast({ title: "Deep research failed", description: msg, variant: "destructive" })
      } else {
        setResult(data)
        toast({ title: "Deep research complete", description: "Report generated successfully" })
      }
    } catch (e: any) {
      const msg = e?.message || String(e)
      setError(msg)
      toast({ title: "Unexpected error", description: msg, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <Brain className="w-4 h-4 text-white" />
            </div>
            <CardTitle>Deep Research</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="h-8"
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Badge variant="secondary">Experimental</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter a complex research question. The system will clarify intent, create a research brief, run a supervised multi-agent research loop, and produce a final report.
          </p>
          
          {showSettings && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="space-y-2">
                <label className="text-sm font-medium">AI Provider</label>
                <Select value={selectedProvider} onValueChange={(value: AIProvider) => setSelectedProvider(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableProviders.map((provider) => (
                      <SelectItem key={provider} value={provider}>
                        {AI_PROVIDERS[provider as AIProvider].name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Model</label>
                <Select value={selectedModel} onValueChange={setSelectedModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedProvider && AI_PROVIDERS[selectedProvider as AIProvider].models.map((model: string) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="flex items-start gap-3">
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g., Provide a literature-backed analysis of current state-of-the-art techniques for few-shot text-to-SQL with citations and practical recommendations"
              className="min-h-[110px] text-sm"
              disabled={loading}
            />
            <Button 
              onClick={runDeepResearch} 
              disabled={!query.trim() || loading || !selectedProvider || !selectedModel} 
              className="shrink-0"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Run
                </>
              )}
            </Button>
          </div>
          {availableProviders.length === 0 && (
            <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              <div>
                <div className="font-medium">No AI providers configured</div>
                <div>Please configure at least one AI provider (API key) to use Deep Research.</div>
              </div>
            </div>
          )}
          
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              <div>
                <div className="font-medium">Unable to complete deep research</div>
                <div>{error}</div>
                {result?.details && (
                  <pre className="mt-2 whitespace-pre-wrap text-xs text-red-800">{result.details}</pre>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {result && result.success && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-blue-100 flex items-center justify-center">
                  <ListTree className="w-4 h-4 text-blue-700" />
                </div>
                <CardTitle className="text-base">Research Brief</CardTitle>
              </div>
              <Badge>Generated with {selectedProvider}</Badge>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[220px]">
                <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                  {result.research_brief || "No brief generated"}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-md bg-emerald-100 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                </div>
                <CardTitle className="text-base">Final Report</CardTitle>
              </div>
              <Badge variant="secondary">Generated with {selectedModel}</Badge>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[220px]">
                <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                  {result.final_report || "No report generated"}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Notes section spans full width */}
          {(result.notes?.length || result.raw_notes?.length) && (
            <Card className="lg:col-span-2">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-md bg-purple-100 flex items-center justify-center">
                    <FileText className="w-4 h-4 text-purple-700" />
                  </div>
                  <CardTitle className="text-base">Research Notes</CardTitle>
                </div>
                <Badge variant="outline">Internal</Badge>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {result.notes?.length ? (
                    <div>
                      <div className="text-sm font-medium mb-2">Processed Notes</div>
                      <ScrollArea className="h-[200px]">
                        <ul className="text-sm list-disc ml-4 space-y-2">
                          {result.notes.map((n, i) => (
                            <li key={`n-${i}`} className="whitespace-pre-wrap">{n}</li>
                          ))}
                        </ul>
                      </ScrollArea>
                    </div>
                  ) : null}

                  {result.raw_notes?.length ? (
                    <div>
                      <div className="text-sm font-medium mb-2">Raw Notes</div>
                      <ScrollArea className="h-[200px]">
                        <ul className="text-sm list-disc ml-4 space-y-2">
                          {result.raw_notes.map((n, i) => (
                            <li key={`rn-${i}`} className="whitespace-pre-wrap">{n}</li>
                          ))}
                        </ul>
                      </ScrollArea>
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}
