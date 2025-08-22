import type React from "react"
import "./globals.css"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { MainNav } from "@/components/main-nav"
import { SupabaseAuthProvider } from "@/components/supabase-auth-provider"
import { AuthErrorBoundary } from "@/components/auth-error-boundary"
import { ResearchSessionProvider } from "@/components/research-session-provider"
import { Toaster } from "@/components/ui/toaster"
import { Analytics } from "@vercel/analytics/react"
import { AuthDebug } from "@/components/auth-debug"
import { CookiePanel } from "@/components/ui/cookie-banner-1"

const inter = Inter({ subsets: ["latin"] })

// Base site URL for absolute metadata links
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://thesisflow-ai.vercel.app"

export const metadata: Metadata = {
  title: "AI Research Platform — Discover, Summarize & Collaborate Smarter | Thesis Flow AI",
  description: "Thesis Flow AI is an AI research hub where you can explore papers, generate instant summaries, organize projects, and collaborate with teams — all in one place.",
  keywords: [
    "AI research platform",
    "academic summarizer",
    "research collaboration tool",
    "AI paper summarizer",
    "thesis assistant",
    "research assistant",
    "research productivity software"
  ],
  generator: 'v0.dev',
  metadataBase: new URL(baseUrl),
  alternates: {
    canonical: baseUrl
  },
  openGraph: {
    type: "website",
    siteName: "Thesis Flow AI",
    title: "AI Research Platform — Discover, Summarize & Collaborate Smarter | Thesis Flow AI",
    description: "Thesis Flow AI is an AI research hub where you can explore papers, generate instant summaries, organize projects, and collaborate with teams — all in one place.",
    url: baseUrl,
    locale: "en_US",
    images: [
      {
        url: "/placeholder-logo.png",
        alt: "Thesis Flow AI — Research platform overview"
      },
      {
        url: "/placeholder.jpg",
        alt: "Thesis Flow AI — Application preview"
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    site: "@BoltResearchHub",
    creator: "@BoltResearchHub",
    title: "AI Research Platform — Discover, Summarize & Collaborate Smarter | Thesis Flow AI",
    description: "Thesis Flow AI is an AI research hub where you can explore papers, generate instant summaries, organize projects, and collaborate with teams — all in one place.",
    images: [
      {
        url: "/placeholder-logo.png",
        alt: "Thesis Flow AI — Research platform overview"
      }
    ]
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <AuthErrorBoundary>
            <SupabaseAuthProvider>
              <ResearchSessionProvider>
                <div className="min-h-screen bg-gray-50">
                  <MainNav />
                  <main className="flex-1">{children}</main>
                </div>
                <Toaster />
                <AuthDebug />
                <Analytics />
                {/* Global Cookie Consent Banner */}
                <CookiePanel />
              </ResearchSessionProvider>
            </SupabaseAuthProvider>
          </AuthErrorBoundary>
        </ThemeProvider>
      </body>
    </html>
  )
}
