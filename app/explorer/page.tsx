"use client"

import { useState } from "react"
import { BookOpen, Brain, Lightbulb, MessageCircle, Search } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { useAsync } from "@/lib/hooks/useAsync"
import { useToast } from "@/hooks/use-toast"
import { ResearchService } from "@/lib/services/research.service"
import { FormField, TextareaField } from "@/components/forms/FormField"
import { SearchInput } from "@/components/common/SearchInput"
import { LoadingSpinner } from "@/components/common/LoadingSpinner"
import { EmptyState } from "@/components/common/EmptyState"
import { SkeletonCard, SkeletonList } from "@/components/common/SkeletonCard"
import { ErrorBoundary } from "@/components/common/ErrorBoundary"
import { ResearchChatbot } from "@/components/research-chatbot"

export default function ResearchExplorer() {
  const { toast } = useToast()

  // Topic exploration state
  const [topic, setTopic] = useState("")
  const [depth, setDepth] = useState(3)
  const topicExploration = useAsync(ResearchService.exploreTopics)

  // Literature search state
  const [searchType, setSearchType] = useState("keyword")
  const paperSearch = useAsync(ResearchService.searchPapers)

  // Idea generation state
  const [ideaTopic, setIdeaTopic] = useState("")
  const [ideaContext, setIdeaContext] = useState("")
  const [ideaCount, setIdeaCount] = useState(5)
  const ideaGeneration = useAsync(ResearchService.generateIdeas)

  const handleTopicExploration = async () => {
    if (!topic.trim()) {
      toast({
        title: "Missing Topic",
        description: "Please enter a research topic to explore.",
        variant: "destructive",
      })
      return
    }

    try {
      await topicExploration.execute(topic, depth)
      toast({
        title: "Topic Explored",
        description: "Research overview generated successfully.",
      })
    } catch (error) {
      toast({
        title: "Exploration Failed",
        description: "Failed to explore topic. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handlePaperSearch = async (query: string) => {
    if (!query.trim()) return

    try {
      await paperSearch.execute(query, searchType)
    } catch (error) {
      toast({
        title: "Search Failed",
        description: "Failed to search papers. Please try again.",
        variant: "destructive",
      })
    }
  }

  const handleIdeaGeneration = async () => {
    if (!ideaTopic.trim()) {
      toast({
        title: "Missing Topic",
        description: "Please enter a topic for idea generation.",
        variant: "destructive",
      })
      return
    }

    try {
      await ideaGeneration.execute(ideaTopic, ideaContext, ideaCount)
      toast({
        title: "Ideas Generated",
        description: `Generated ${ideaCount} research ideas successfully.`,
      })
    } catch (error) {
      toast({
        title: "Generation Failed",
        description: "Failed to generate ideas. Please try again.",
        variant: "destructive",
      })
    }
  }

  const renderFormattedContent = (content: string) => {
    return content.split("\n").map((line, i) => {
      // Clean up asterisks and format text properly
      const cleanLine = line
        .replace(/\*\*([^*]+)\*\*/g, "$1") // Remove bold asterisks
        .replace(/\*([^*]+)\*/g, "$1") // Remove italic asterisks
        .trim()

      // Check if line is a numbered heading (e.g., "1. Key Concepts")
      if (/^\d+\.\s+[A-Z]/.test(cleanLine)) {
        return (
          <h2 key={i} className="font-bold text-xl mt-6 mb-3 text-blue-800 border-b pb-1 border-gray-200">
            {cleanLine}
          </h2>
        )
      }
      // Check if line should be a heading (starts with capital and ends with colon or is all caps)
      else if (cleanLine.match(/^[A-Z][^.]*:?$/) && cleanLine.length < 60) {
        return (
          <h3 key={i} className="font-bold text-lg mt-5 mb-3 text-gray-800">
            {cleanLine.replace(/:$/, "")}
          </h3>
        )
      }
      // Check if line is a numbered list item
      else if (/^\d+\.\s/.test(cleanLine)) {
        const [number, ...rest] = cleanLine.split(". ")
        const content = rest.join(". ")
        // Extract and format any terms that should be bold
        const formattedContent = content.replace(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g, "<strong>$1</strong>")
        return (
          <div key={i} className="flex mb-3 ml-2">
            <span className="font-bold text-blue-700 mr-3 min-w-[20px]">{number}.</span>
            <span className="text-gray-700" dangerouslySetInnerHTML={{ __html: formattedContent }} />
          </div>
        )
      }
      // Check if line starts with a bullet point
      else if (cleanLine.trim().startsWith("•") || cleanLine.trim().match(/^[-*]\s/)) {
        const bulletContent = cleanLine.replace(/^[-*•]\s*/, "").trim()
        // Format key terms in bullet points
        const formattedContent = bulletContent.replace(/^([^:]+):/g, "<strong>$1:</strong>")
        return (
          <div key={i} className="flex mb-2 ml-4">
            <span className="text-blue-600 mr-2 mt-1">•</span>
            <span className="text-gray-700" dangerouslySetInnerHTML={{ __html: formattedContent }} />
          </div>
        )
      }
      // Regular paragraph
      else if (cleanLine.trim()) {
        // Format any key terms that appear in paragraphs
        const formattedContent = cleanLine.replace(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g, (match) => {
          // Only bold if it looks like a technical term or proper noun
          if (
            match.match(
              /^(Machine Learning|Combat Systems|Autonomy|Human-machine Interface|Autonomous Systems|Sensor Fusion|Communication Networks|Decision Support Systems|Cybersecurity)$/i,
            )
          ) {
            return `<strong>${match}</strong>`
          }
          return match
        })

        return (
          <p
            key={i}
            className="mb-3 text-gray-700 leading-relaxed"
            dangerouslySetInnerHTML={{ __html: formattedContent }}
          ></p>
        )
      }
      // Empty line - use smaller spacing
      return <div key={i} className="h-1"></div>
    })
  }

  return (
    <ErrorBoundary>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <Tabs defaultValue="explore" className="space-y-8">
          <TabsList className="grid w-full grid-cols-4 bg-gray-50">
            <TabsTrigger value="explore" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              Topic Explorer
            </TabsTrigger>
            <TabsTrigger value="search" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Literature Search
            </TabsTrigger>
            <TabsTrigger value="ideas" className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4" />
              Idea Generator
            </TabsTrigger>
            <TabsTrigger value="assistant" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Research Assistant
            </TabsTrigger>
          </TabsList>

          <TabsContent value="explore" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="h-5 w-5" />
                  Research Topic Explorer
                </CardTitle>
                <CardDescription>
                  Get comprehensive insights into any research topic including key concepts, trends, and leading
                  researchers.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  label="Research Topic"
                  value={topic}
                  onChange={setTopic}
                  placeholder="e.g., Machine Learning in Healthcare"
                  required
                />

                <div className="space-y-3">
                  <Label>Exploration Depth</Label>
                  <Slider
                    value={[depth]}
                    onValueChange={(value) => setDepth(value[0])}
                    max={5}
                    min={1}
                    step={1}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>Basic</span>
                    <span>Comprehensive</span>
                  </div>
                </div>

                <Button onClick={handleTopicExploration} disabled={topicExploration.loading} className="w-full">
                  {topicExploration.loading ? (
                    <LoadingSpinner size="sm" text="Exploring..." />
                  ) : (
                    <>
                      <Search className="mr-2 h-4 w-4" />
                      Explore Topic
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {topicExploration.loading && <SkeletonCard lines={6} />}

            {topicExploration.data && (
              <Card>
                <CardHeader>
                  <CardTitle>Exploration Results</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose max-w-none">
                    {(() => {
                      // Extract content from response
                      let content = ""

                      if (typeof topicExploration.data === "string") {
                        content = topicExploration.data
                      } else if (topicExploration.data && typeof topicExploration.data === "object") {
                        if ("content" in topicExploration.data) {
                          content = topicExploration.data.content as string
                        } else if ("data" in topicExploration.data) {
                          content = topicExploration.data.data as string
                        } else {
                          content = JSON.stringify(topicExploration.data, null, 2)
                        }
                      }

                      // Try to extract content from JSON if it's a JSON string
                      try {
                        const parsedContent = JSON.parse(content)
                        if (typeof parsedContent === "object" && parsedContent !== null && "content" in parsedContent) {
                          content = parsedContent.content
                        }
                      } catch (e) {
                        // Not JSON, use as is
                      }

                      return (
                        <div className="markdown-content bg-white p-6 rounded-lg shadow-sm">
                          {renderFormattedContent(content)}
                        </div>
                      )
                    })()}
                  </div>
                </CardContent>
              </Card>
            )}

            {topicExploration.error && (
              <Card className="border-red-200">
                <CardContent className="pt-6">
                  <p className="text-red-600">{topicExploration.error}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="search" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5" />
                  Literature Search
                </CardTitle>
                <CardDescription>Find relevant research papers and articles on your topic of interest.</CardDescription>
              </CardHeader>
              <CardContent>
                <SearchInput
                  placeholder="Search for papers, authors, or keywords..."
                  onSearch={handlePaperSearch}
                  className="w-full"
                  showButton={true}
                  buttonText="Search Literature"
                />
              </CardContent>
            </Card>

            {paperSearch.loading && <SkeletonList count={3} />}

            {paperSearch.data && paperSearch.data.data && paperSearch.data.data.data && paperSearch.data.data.data.length > 0 ? (
              <div className="space-y-4">
                <div className="text-sm text-gray-600 mb-4">
                  Found {paperSearch.data.data.count || paperSearch.data.data.data.length} papers
                </div>
                {paperSearch.data.data.data.map((paper: any, index: number) => (
                  <Card key={paper.id || index}>
                    <CardHeader>
                      <CardTitle className="text-lg leading-tight">{paper.title || "Untitled Paper"}</CardTitle>
                      <CardDescription className="flex flex-wrap items-center gap-2 text-sm">
                        {paper.authors && paper.authors.length > 0 && (
                          <span>
                            {paper.authors.slice(0, 3).join(", ")}
                            {paper.authors.length > 3 ? " et al." : ""}
                          </span>
                        )}
                        {paper.year && (
                          <>
                            <span>•</span>
                            <span>{paper.year}</span>
                          </>
                        )}
                        {paper.journal && (
                          <>
                            <span>•</span>
                            <span className="italic">{paper.journal}</span>
                          </>
                        )}
                        {paper.citations !== undefined && paper.citations > 0 && (
                          <>
                            <span>•</span>
                            <span>{paper.citations} citations</span>
                          </>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {paper.abstract && <p className="text-sm text-gray-600 mb-4 line-clamp-3">{paper.abstract}</p>}
                      <div className="flex gap-2">
                        {paper.url && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={paper.url} target="_blank" rel="noopener noreferrer">
                              View Paper
                            </a>
                          </Button>
                        )}
                        {paper.pdf_url && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={paper.pdf_url} target="_blank" rel="noopener noreferrer">
                              PDF
                            </a>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              paperSearch.data && (
                <EmptyState
                  icon={BookOpen}
                  title="No papers found"
                  description="Try adjusting your search terms or exploring different keywords."
                />
              )
            )}

            {paperSearch.error && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="pt-6">
                  <div className="text-red-600">
                    <p className="font-medium">Search Error</p>
                    <p className="text-sm mt-1">{paperSearch.error}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="ideas" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5" />
                  Research Idea Generator
                </CardTitle>
                <CardDescription>
                  Generate innovative research ideas and questions based on your interests.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  label="Research Area"
                  value={ideaTopic}
                  onChange={setIdeaTopic}
                  placeholder="e.g., Quantum Computing"
                  required
                />

                <TextareaField
                  label="Additional Context"
                  value={ideaContext}
                  onChange={setIdeaContext}
                  placeholder="Provide any specific focus areas, constraints, or interests..."
                  description="Optional: Help us generate more targeted ideas"
                />

                <div className="space-y-3">
                  <Label>Number of Ideas: {ideaCount}</Label>
                  <Slider
                    value={[ideaCount]}
                    onValueChange={(value) => setIdeaCount(value[0])}
                    max={10}
                    min={3}
                    step={1}
                    className="w-full"
                  />
                </div>

                <Button onClick={handleIdeaGeneration} disabled={ideaGeneration.loading} className="w-full">
                  {ideaGeneration.loading ? (
                    <LoadingSpinner size="sm" text="Generating..." />
                  ) : (
                    <>
                      <Lightbulb className="mr-2 h-4 w-4" />
                      Generate Ideas
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {ideaGeneration.loading && <SkeletonCard lines={8} />}

            {ideaGeneration.data && (
              <Card>
                <CardHeader>
                  <CardTitle>Generated Ideas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose max-w-none">
                    {(() => {
                      const ideaRaw = ideaGeneration.data
                      let content = ""

                      // Extract content using the same logic
                      const extractContent = (data: any): string => {
                        if (typeof data === "string") {
                          return data
                        }
                        if (data && typeof data === "object" && "content" in data && typeof data.content === "string") {
                          return data.content
                        }
                        if (Array.isArray(data)) {
                          return data
                            .map((item) => {
                              if (typeof item === "object") {
                                if (item.question || item.methodology || item.impact || item.challenges) {
                                  return (
                                    `Research Question: ${item.question || ""}\n` +
                                    `Methodology: ${item.methodology || ""}\n` +
                                    `Impact: ${item.impact || ""}\n` +
                                    `Challenges: ${item.challenges || ""}\n---`
                                  )
                                }
                                return JSON.stringify(item, null, 2)
                              }
                              return String(item)
                            })
                            .join("\n\n")
                        }
                        if (data && typeof data === "object") {
                          if ("data" in data) {
                            return extractContent(data.data)
                          }
                          try {
                            return JSON.stringify(data, null, 2)
                          } catch (e) {
                            return String(data)
                          }
                        }
                        return String(data)
                      }

                      content = extractContent(ideaRaw)

                      return (
                        <div className="markdown-content bg-white p-6 rounded-lg shadow-sm">
                          {renderFormattedContent(content)}
                        </div>
                      )
                    })()}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="assistant" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5" />
                  Research Assistant
                </CardTitle>
                <CardDescription>
                  Chat with an AI research assistant to ask questions about your topic, generated ideas, or found
                  papers.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResearchChatbot
                  topic={topic || ideaTopic}
                  papers={
                    // Extract and transform papers to ensure correct type
                    paperSearch.data && 
                    paperSearch.data.data && 
                    paperSearch.data.data.data ? 
                    (paperSearch.data.data.data as any)?.data || [] : []
                  }
                  ideas={ideaGeneration.data ? String(ideaGeneration.data) : undefined}
                  context={topicExploration.data ? String(topicExploration.data) : undefined}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </ErrorBoundary>
  )
}
