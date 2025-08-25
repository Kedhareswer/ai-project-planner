"use client"

import { useState } from "react"
import { BookOpen, Brain, Lightbulb, MessageCircle, Database, Smile, Briefcase, Zap, AlertTriangle, Sparkles } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import type { AIProvider } from "@/lib/ai-providers"
import { ErrorBoundary } from "@/components/common/ErrorBoundary"
import { EnhancedLiteratureSearch } from "./components/EnhancedLiteratureSearch"
import { TopicExplorer } from "./components/TopicExplorer"
import { IdeaGenerator } from "./components/IdeaGenerator"
import { ResearchAssistant } from "./components/ResearchAssistant"
import { DeepResearch } from "./components/DeepResearch"
import { RouteGuard } from "@/components/route-guard"
import CompactAIProviderSelector from "@/components/compact-ai-provider-selector"
import { ResearchSessionProvider } from "@/components/research-session-provider"
import { ResearchSessionManager } from "@/components/research-session-manager"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const containerStyle = "container mx-auto px-4 py-8 max-w-6xl"
const sectionTitleStyle = "text-2xl font-semibold text-gray-900 mb-4"
const sectionDescriptionStyle = "text-gray-600"

const personalities = [
  {
    key: 'friendly',
    name: 'Friendly',
    description: 'Warm, supportive, and encouraging.',
    systemPrompt: 'You are a friendly, supportive research assistant. Use positive language and emojis.',
    icon: Smile,
    color: [34, 197, 94] as [number, number, number],
  },
  {
    key: 'formal',
    name: 'Formal',
    description: 'Professional, concise, and academic.',
    systemPrompt: 'You are a formal, academic research assistant. Use professional and concise language.',
    icon: Briefcase,
    color: [59, 130, 246] as [number, number, number],
  },
  {
    key: 'motivational',
    name: 'Motivational',
    description: 'Inspires and motivates you to keep going.',
    systemPrompt: 'You are a motivational coach. Encourage the user and celebrate their progress.',
    icon: Zap,
    color: [245, 158, 11] as [number, number, number],
  },
  {
    key: 'critical',
    name: 'Critical',
    description: 'Provides constructive criticism and challenges ideas.',
    systemPrompt: 'You are a critical thinker. Challenge assumptions and provide constructive feedback.',
    icon: AlertTriangle,
    color: [239, 68, 68] as [number, number, number],
  },
  {
    key: 'playful',
    name: 'Playful',
    description: 'Light-hearted, uses humor and playful language.',
    systemPrompt: 'You are a playful assistant. Use humor, jokes, and playful language.',
    icon: Sparkles,
    color: [168, 85, 247] as [number, number, number],
  },
]

export default function ResearchExplorer() {
  const { toast } = useToast()

  // State for research chatbot
  const [chatTopic, setChatTopic] = useState("")
  const [chatPapers, setChatPapers] = useState<any[]>([])
  const [chatIdeas, setChatIdeas] = useState("")

  const [selectedProvider, setSelectedProvider] = useState<AIProvider | undefined>(undefined)
  const [selectedModel, setSelectedModel] = useState<string | undefined>(undefined)
  const [selectedPersonality, setSelectedPersonality] = useState(personalities[0])

  return (
    <RouteGuard requireAuth={true}>
      <ResearchSessionProvider>
        <ErrorBoundary>
          <div className="min-h-screen bg-white text-gray-900">
            <div className={containerStyle}>
              <header className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Research Explorer</h1>
                <p className={sectionDescriptionStyle}>
                  AI-powered tools to discover research papers, generate ideas, and explore topics.
                </p>
              </header>

              <Tabs defaultValue="search" className="space-y-6">
                <TabsList className="grid w-full grid-cols-6 bg-gray-100 rounded-md">
                  <TabsTrigger value="search" className="data-[state=active]:bg-gray-200">
                    <BookOpen className="h-4 w-4 mr-2" />
                    Search
                  </TabsTrigger>
                  <TabsTrigger value="explore" className="data-[state=active]:bg-gray-200">
                    <Brain className="h-4 w-4 mr-2" />
                    Explore
                  </TabsTrigger>
                  <TabsTrigger value="ideas" className="data-[state=active]:bg-gray-200">
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Ideas
                  </TabsTrigger>
                  <TabsTrigger value="assistant" className="data-[state=active]:bg-gray-200">
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Assistant
                  </TabsTrigger>
                  <TabsTrigger value="session" className="data-[state=active]:bg-gray-200">
                    <Database className="h-4 w-4 mr-2" />
                    Session
                  </TabsTrigger>
                  <TabsTrigger value="deep-research" className="data-[state=active]:bg-gray-200">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Deep Research
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="search">
                  <EnhancedLiteratureSearch />
                </TabsContent>
                <TabsContent value="explore">
                  <TopicExplorer selectedProvider={selectedProvider} selectedModel={selectedModel} />
                </TabsContent>
                <TabsContent value="ideas">
                  <IdeaGenerator />
                </TabsContent>
                <TabsContent value="assistant">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="h-5 w-5" />
                      <h2 className="text-xl font-semibold">Research Assistant</h2>
                    </div>
                    <p className="text-sm text-gray-600">Get AI-powered assistance for your research questions.</p>
                    <ResearchAssistant 
                      personalities={personalities}
                      selectedPersonality={selectedPersonality}
                      onPersonalityChange={setSelectedPersonality}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="session">
                  <ResearchSessionManager />
                </TabsContent>
                <TabsContent value="deep-research">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5" />
                      <h2 className="text-xl font-semibold">Deep Research</h2>
                    </div>
                    <p className="text-sm text-gray-600">Run multi-agent deep research and get a structured report.</p>
                    <DeepResearch />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </ErrorBoundary>
      </ResearchSessionProvider>
    </RouteGuard>
  )
}

