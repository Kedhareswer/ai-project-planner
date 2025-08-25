interface HeadProps {
  documentTitle?: string;
  documentType?: string;
  summaryStyle?: string;
  customDescription?: string;
}

export default function SummarizerSEOHead({ 
  documentTitle, 
  documentType, 
  summaryStyle, 
  customDescription 
}: HeadProps = {}) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://thesisflow-ai.vercel.app";
  const url = `${baseUrl}/summarizer`;
  
  // Dynamic title generation
  const dynamicTitle = documentTitle 
    ? `${documentTitle} - AI Summarizer | Thesis Flow AI`
    : summaryStyle 
    ? `${summaryStyle} Summary - AI Summarizer | Thesis Flow AI`
    : "AI Summarizer - Thesis Flow AI | Comprehensive Research Platform";
  
  // Dynamic description generation
  const dynamicDescription = customDescription || 
    (documentTitle 
      ? `AI-powered summary of "${documentTitle}" using Thesis Flow AI's advanced document analysis. ${documentType ? `Specialized ${documentType} processing` : 'Multi-format support'} with sentiment analysis and key insights extraction.`
      : "Advanced document summarization tool within Thesis Flow AI's comprehensive AI-powered research platform. Features multi-format support (PDF, DOCX, URLs), sentiment analysis, and multiple AI providers for academic and professional research workflows.");
  
  const title = dynamicTitle;
  const description = dynamicDescription;

  // Use existing placeholders until branded OG images are uploaded
  const ogImagePrimary = `${baseUrl}/placeholder-logo.png`;
  const ogImageSecondary = `${baseUrl}/placeholder.jpg`;
  const imageAltPrimary = "Thesis Flow AI — Research platform overview";
  const imageAltSecondary = "Thesis Flow AI — Document summarizer module";

  // Structured Data Objects
  const softwareApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Thesis Flow AI - AI Summarizer",
    alternateName: "Research Document Summarization Tool",
    description: "Part of Thesis Flow AI's comprehensive AI-powered research platform. Advanced document summarization with multi-format support, sentiment analysis, and integration with literature discovery, academic writing, and team collaboration features.",
    applicationCategory: "ResearchApplication",
    applicationSubCategory: "DocumentProcessing",
    operatingSystem: "All",
    browserRequirements: "Modern web browser with JavaScript enabled",
    softwareVersion: "1.0.14",
    author: {
      "@type": "Organization",
      name: "Thesis Flow AI",
      url: baseUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "Thesis Flow AI",
      url: baseUrl,
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      availability: "https://schema.org/InStock",
      category: "Free Tier Available",
    },
    featureList: [
      "Multi-format document processing (PDF, DOCX, TXT, URLs)",
      "Smart web search integration for content discovery",
      "Multiple AI providers (OpenAI GPT-4o, Google Gemini, Anthropic Claude, Groq, Mistral)",
      "Academic, executive, and bullet-point summary styles",
      "Sentiment analysis and key points extraction",
      "Export options (PDF, DOCX, Markdown)",
      "Integration with literature search and academic writing tools",
      "Real-time processing with progress tracking",
    ],
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      reviewCount: "127",
      bestRating: "5",
      worstRating: "1"
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${baseUrl}/summarizer?q={search_term_string}`
      },
      "query-input": "required name=search_term_string"
    },
    sameAs: [
      "https://github.com/Kedhareswer/thesisflow-ai",
      "https://twitter.com/thesisflow-ai",
      "https://linkedin.com/company/thesisflow-ai",
      "https://discord.gg/thesisflow-ai"
    ],
    url,
    screenshot: ogImagePrimary,
  };

  const webApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Thesis Flow AI - Document Summarizer",
    description: "Advanced document summarization module within Thesis Flow AI's comprehensive research platform. Integrates with literature discovery, academic writing, team collaboration, and AI-powered research tools for complete research workflow management.",
    applicationCategory: "AcademicApplication",
    audience: {
      "@type": "Audience",
      audienceType: ["Researchers", "Academics", "Students", "Professionals", "Research Teams"],
    },
    serviceType: "Research Platform - Document Analysis",
    areaServed: "Worldwide",
    availableLanguage: "English",
    isAccessibleForFree: true,
    url,
  };

  // FAQ Structured Data
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "What formats does the AI Summarizer support?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "It supports PDF, DOCX, TXT files and web URLs with automatic detection."
        }
      },
      {
        "@type": "Question",
        name: "Is Thesis Flow AI free to use?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, the AI Summarizer offers a free tier with generous limits."
        }
      }
    ]
  };

  // Breadcrumb Structured Data
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: baseUrl
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "AI Summarizer",
        item: url
      }
    ]
  };

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta
        name="keywords"
        content="AI summarizer, research platform, academic document summary, PDF summarizer, DOCX summarizer, URL content extraction, literature discovery, research collaboration, academic writing, Thesis Flow AI, GPT-4o, Gemini, Claude, research workflow, team collaboration, citation management"
      />
      <link rel="canonical" href={url} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="Thesis Flow AI" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImagePrimary} />
      <meta property="og:image:alt" content={imageAltPrimary} />
      <meta property="og:image" content={ogImageSecondary} />
      <meta property="og:image:alt" content={imageAltSecondary} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@BoltResearchHub" />
      <meta name="twitter:creator" content="@BoltResearchHub" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImagePrimary} />
      <meta name="twitter:image:alt" content={imageAltPrimary} />

      {/* International/Language Support */}
      <link rel="alternate" hrefLang="en" href={url} />
      <link rel="alternate" hrefLang="en-US" href={url} />
      <link rel="alternate" hrefLang="en-GB" href={url} />
      <link rel="alternate" hrefLang="x-default" href={url} />

      {/* Performance and Core Web Vitals */}
      <link rel="dns-prefetch" href="//api.openai.com" />
      <link rel="dns-prefetch" href="//api.anthropic.com" />
      <link rel="dns-prefetch" href="//generativelanguage.googleapis.com" />

      {/* Additional SEO Meta Tags */}
      <meta name="author" content="Thesis Flow AI" />
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
      <meta name="application-name" content="Thesis Flow AI" />
      <meta name="theme-color" content="#2563eb" />

      {/* Structured Data - Enhanced for Research Tool */}
      <script type="application/ld+json">
        {JSON.stringify(softwareApplicationSchema)}
      </script>

      {/* Research-specific Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(webApplicationSchema)}
      </script>

      {/* FAQ Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(faqSchema)}
      </script>

      {/* Breadcrumb Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(breadcrumbSchema)}
      </script>
    </>
  );
}
