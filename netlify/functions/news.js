// =============================================================
// REAMAL Trade — Live Forex News Function
// File: netlify/functions/news.js
// =============================================================
// This function fetches live EUR/USD news from multiple
// free RSS feeds: FXStreet, DailyFX, ForexLive, Reuters,
// and Investing.com — no paid API keys needed.
// Results are merged, deduplicated, sorted by time,
// and formatted for both display and AI analysis.
// =============================================================

import Parser from "rss-parser";

const parser = new Parser({
  timeout: 8000,
  headers: {
    "User-Agent": "REAMAL-Trade-Bot/1.0 (Forex News Aggregator)",
    Accept: "application/rss+xml, application/xml, text/xml",
  },
});

// =============================================================
// NEWS SOURCES — All free RSS feeds, no API keys needed
// =============================================================

const NEWS_SOURCES = [
  {
    name: "FXStreet",
    url: "https://www.fxstreet.com/rss/news",
    category: "Analysis",
    reliability: "High",
  },
  {
    name: "DailyFX",
    url: "https://www.dailyfx.com/feeds/all",
    category: "Analysis",
    reliability: "High",
  },
  {
    name: "ForexLive",
    url: "https://www.forexlive.com/feed/news",
    category: "Live News",
    reliability: "High",
  },
  {
    name: "Investing.com Forex",
    url: "https://www.investing.com/rss/news_25.rss",
    category: "Market News",
    reliability: "High",
  },
  {
    name: "Reuters Forex",
    url: "https://feeds.reuters.com/reuters/businessNews",
    category: "Business News",
    reliability: "High",
  },
];

// =============================================================
// EUR/USD KEYWORDS — Used to filter relevant news only
// =============================================================

const EURUSD_KEYWORDS = [
  "EUR/USD", "EURUSD", "euro", "EUR", "dollar", "USD",
  "ECB", "European Central Bank", "Federal Reserve", "Fed",
  "interest rate", "inflation", "CPI", "GDP", "NFP",
  "non-farm payroll", "unemployment", "retail sales",
  "PMI", "ISM", "FOMC", "lagarde", "powell",
  "eurozone", "euro zone", "europe", "forex", "fx",
  "currency", "monetary policy", "rate hike", "rate cut",
  "quantitative", "tapering", "hawkish", "dovish",
];

// =============================================================
// SENTIMENT KEYWORDS — Used to determine bullish/bearish bias
// =============================================================

const BULLISH_EUR_KEYWORDS = [
  "euro rises", "euro gains", "euro strengthens", "EUR higher",
  "ECB hawkish", "rate hike", "euro rally", "EUR/USD up",
  "dollar weakens", "USD falls", "dollar drops", "Fed dovish",
  "rate cut expected", "weaker dollar", "dollar selling",
];

const BEARISH_EUR_KEYWORDS = [
  "euro falls", "euro drops", "euro weakens", "EUR lower",
  "ECB dovish", "rate cut", "euro declines", "EUR/USD down",
  "dollar rises", "USD gains", "dollar strengthens", "Fed hawkish",
  "rate hike expected", "stronger dollar", "dollar buying",
];

// =============================================================
// FETCH NEWS FROM A SINGLE SOURCE
// =============================================================

async function fetchFromSource(source) {
  try {
    const feed = await parser.parseURL(source.url);
    const items = (feed.items || []).slice(0, 15); // Max 15 per source

    return items
      .filter((item) => isRelevant(item.title + " " + (item.contentSnippet || "")))
      .map((item) => ({
        title: cleanText(item.title || ""),
        summary: cleanText(item.contentSnippet || item.content || ""),
        url: item.link || "",
        source: source.name,
        category: source.category,
        reliability: source.reliability,
        publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        sentiment: detectSentiment(item.title + " " + (item.contentSnippet || "")),
      }));
  } catch (error) {
    console.warn(`Failed to fetch from ${source.name}:`, error.message);
    return []; // Return empty array on failure — don't crash the whole function
  }
}

// =============================================================
// RELEVANCE FILTER
// =============================================================

function isRelevant(text) {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return EURUSD_KEYWORDS.some((keyword) =>
    lowerText.includes(keyword.toLowerCase())
  );
}

// =============================================================
// SENTIMENT DETECTOR
// =============================================================

function detectSentiment(text) {
  if (!text) return "Neutral";
  const lowerText = text.toLowerCase();

  const bullishScore = BULLISH_EUR_KEYWORDS.filter((kw) =>
    lowerText.includes(kw.toLowerCase())
  ).length;

  const bearishScore = BEARISH_EUR_KEYWORDS.filter((kw) =>
    lowerText.includes(kw.toLowerCase())
  ).length;

  if (bullishScore > bearishScore) return "Bullish EUR";
  if (bearishScore > bullishScore) return "Bearish EUR";
  return "Neutral";
}

// =============================================================
// OVERALL SENTIMENT SUMMARY
// =============================================================

function calculateOverallSentiment(articles) {
  const counts = { "Bullish EUR": 0, "Bearish EUR": 0, Neutral: 0 };
  articles.forEach((a) => {
    counts[a.sentiment] = (counts[a.sentiment] || 0) + 1;
  });

  const total = articles.length || 1;
  const bullishPct = Math.round((counts["Bullish EUR"] / total) * 100);
  const bearishPct = Math.round((counts["Bearish EUR"] / total) * 100);

  let overall = "Neutral";
  if (counts["Bullish EUR"] > counts["Bearish EUR"] + 2) overall = "Bullish EUR";
  else if (counts["Bearish EUR"] > counts["Bullish EUR"] + 2) overall = "Bearish EUR";

  return {
    overall,
    bullishPct,
    bearishPct,
    neutralPct: 100 - bullishPct - bearishPct,
    counts,
  };
}

// =============================================================
// FORMAT NEWS FOR AI ANALYSIS PROMPT
// =============================================================

function formatForAI(articles, sentiment) {
  if (!articles.length) return "No relevant EUR/USD news found at this time.";

  const top = articles.slice(0, 8); // Send top 8 to AI
  const lines = top.map(
    (a, i) =>
      `${i + 1}. [${a.source}] [${a.sentiment}] ${a.title}\n   ${a.summary ? a.summary.slice(0, 150) + "..." : "No summary."}`
  );

  return `OVERALL MARKET SENTIMENT: ${sentiment.overall} (${sentiment.bullishPct}% Bullish | ${sentiment.bearishPct}% Bearish)

LATEST EUR/USD NEWS:
${lines.join("\n\n")}`;
}

// =============================================================
// CLEAN TEXT HELPER
// =============================================================

function cleanText(text) {
  return text
    .replace(/<[^>]*>/g, "")       // Remove HTML tags
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")          // Collapse whitespace
    .trim();
}

// =============================================================
// DEDUPLICATE ARTICLES
// =============================================================

function deduplicate(articles) {
  const seen = new Set();
  return articles.filter((a) => {
    const key = a.title.slice(0, 60).toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// =============================================================
// MAIN HANDLER
// =============================================================

export const handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Method not allowed. Use GET." }),
    };
  }

  try {
    // Fetch from all sources in parallel
    const results = await Promise.allSettled(
      NEWS_SOURCES.map((source) => fetchFromSource(source))
    );

    // Collect all successful results
    let allArticles = results
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => r.value);

    // Deduplicate and sort by newest first
    allArticles = deduplicate(allArticles).sort(
      (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)
    );

    // Calculate overall sentiment
    const sentiment = calculateOverallSentiment(allArticles);

    // Format for AI prompt
    const aiContext = formatForAI(allArticles, sentiment);

    // Count successful sources
    const successfulSources = results.filter(
      (r) => r.status === "fulfilled" && r.value.length > 0
    ).length;

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        success: true,
        articles: allArticles.slice(0, 20), // Return top 20 for display
        sentiment,
        aiContext,                           // Pre-formatted for AI analysis
        meta: {
          total: allArticles.length,
          sourcesQueried: NEWS_SOURCES.length,
          sourcesSucceeded: successfulSources,
          fetchedAt: new Date().toISOString(),
        },
      }),
    };
  } catch (error) {
    console.error("News fetch error:", error);
    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        error: "Failed to fetch news. Analysis will proceed without live news.",
        articles: [],
        sentiment: { overall: "Unknown", bullishPct: 0, bearishPct: 0 },
        aiContext: "News unavailable. Please base analysis on chart only.",
      }),
    };
  }
};

// =============================================================
// CORS HEADERS
// =============================================================

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type": "application/json",
  };
}
