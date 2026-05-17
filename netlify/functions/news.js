// =============================================================
// REAMAL Trade — Live News Function (v3)
// Zero npm packages — built-in fetch + manual RSS parser
// Uses diverse, reliable sources with fallback handling
// =============================================================

exports.handler = async function(event) {

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors(), body: "" };
  }

  // Mix of RSS sources — different domains for reliability
  var sources = [
    { name: "ForexLive",       url: "https://www.forexlive.com/feed/news",                               timeout: 6000 },
    { name: "Reuters",         url: "https://feeds.reuters.com/reuters/businessNews",                     timeout: 6000 },
    { name: "MarketWatch",     url: "https://feeds.marketwatch.com/marketwatch/realtimeheadlines/",       timeout: 6000 },
    { name: "CNBC",            url: "https://www.cnbc.com/id/10000664/device/rss/rss.html",               timeout: 6000 },
    { name: "Nasdaq",          url: "https://www.nasdaq.com/feed/rssoutbound?category=Currencies",        timeout: 6000 },
    { name: "Yahoo Finance",   url: "https://finance.yahoo.com/rss/topstories",                           timeout: 6000 },
    { name: "Investing.com",   url: "https://www.investing.com/rss/news_25.rss",                          timeout: 6000 },
    { name: "FXStreet",        url: "https://www.fxstreet.com/rss/news",                                  timeout: 6000 }
  ];

  var keywords = [
    "eur","usd","dollar","euro","ecb","fed","federal reserve",
    "european central bank","interest rate","inflation","cpi","gdp",
    "non-farm","nfp","unemployment","fomc","powell","lagarde",
    "forex","eurusd","eur/usd","hawkish","dovish","rate hike",
    "rate cut","monetary policy","currency","fx market","forex market",
    "treasury","bond yield","trade balance","retail sales","pmi","ism"
  ];

  var bullishWords = [
    "euro rises","euro gains","euro rally","eur higher","eur/usd rises",
    "dollar weakens","dollar drops","dollar falls","usd weaker",
    "fed dovish","rate cut","weaker dollar","dollar selling"
  ];
  var bearishWords = [
    "euro falls","euro drops","euro weakens","eur lower","eur/usd falls",
    "dollar rises","dollar gains","dollar strengthens","usd stronger",
    "fed hawkish","rate hike","stronger dollar","dollar buying"
  ];

  // Fetch all sources in parallel — failures are silently skipped
  var results = await Promise.allSettled(
    sources.map(function(s) { return fetchRSS(s); })
  );

  var allArticles = [];
  var successCount = 0;
  results.forEach(function(r) {
    if (r.status === "fulfilled" && r.value.length > 0) {
      allArticles = allArticles.concat(r.value);
      successCount++;
    }
  });

  // Filter to EUR/USD relevant only
  var relevant = allArticles.filter(function(a) {
    return isRelevant((a.title + " " + a.summary).toLowerCase(), keywords);
  });

  // If fewer than 3 relevant articles, relax filter and use all articles
  if (relevant.length < 3) {
    relevant = allArticles;
  }

  // Deduplicate by title similarity
  var seen = {};
  var unique = relevant.filter(function(a) {
    var key = a.title.slice(0, 55).toLowerCase().replace(/\s+/g, "");
    if (seen[key]) return false;
    seen[key] = true;
    return true;
  });

  // Sort newest first
  unique.sort(function(a, b) {
    return new Date(b.publishedAt) - new Date(a.publishedAt);
  });

  // Tag sentiment on each article
  unique.forEach(function(a) {
    a.sentiment = getSentiment((a.title + " " + a.summary).toLowerCase(), bullishWords, bearishWords);
  });

  // Calculate overall sentiment
  var total     = unique.length || 1;
  var bullCount = unique.filter(function(a) { return a.sentiment === "Bullish EUR"; }).length;
  var bearCount = unique.filter(function(a) { return a.sentiment === "Bearish EUR"; }).length;
  var bullPct   = Math.round((bullCount / total) * 100);
  var bearPct   = Math.round((bearCount / total) * 100);
  var overall   = "Neutral";
  if (bullCount > bearCount + 1) overall = "Bullish EUR";
  if (bearCount > bullCount + 1) overall = "Bearish EUR";

  var sentiment = {
    overall:    overall,
    bullishPct: bullPct,
    bearishPct: bearPct,
    neutralPct: Math.max(0, 100 - bullPct - bearPct)
  };

  // Format top 8 for AI context
  var top8 = unique.slice(0, 8);
  var aiContext = top8.length > 0
    ? "OVERALL MARKET SENTIMENT: " + overall + " (" + bullPct + "% Bullish | " + bearPct + "% Bearish)\n\n"
      + "LATEST MARKET NEWS:\n"
      + top8.map(function(a, i) {
          return (i + 1) + ". [" + a.source + "] [" + a.sentiment + "] " + a.title
            + (a.summary ? "\n   " + a.summary.slice(0, 150) + "..." : "");
        }).join("\n\n")
    : "No relevant news available at this time. Base analysis on chart only.";

  return {
    statusCode: 200,
    headers: cors(),
    body: JSON.stringify({
      success:   true,
      articles:  unique.slice(0, 20),
      sentiment: sentiment,
      aiContext: aiContext,
      meta: {
        total:            unique.length,
        sourcesQueried:   sources.length,
        sourcesSucceeded: successCount,
        fetchedAt:        new Date().toISOString()
      }
    })
  };
};

// ── Fetch one RSS source ────────────────────────────────────

async function fetchRSS(source) {
  try {
    var controller = new AbortController();
    var timer = setTimeout(function() { controller.abort(); }, source.timeout || 6000);

    var res = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; REAMAL-Trade-Bot/1.0; +https://reamal-trade.netlify.app)",
        "Accept":     "application/rss+xml, application/xml, text/xml, */*"
      }
    });

    clearTimeout(timer);
    if (!res.ok) return [];

    var text = await res.text();
    return parseRSS(text, source.name);

  } catch(e) {
    console.log("Skipped " + source.name + ": " + e.message);
    return [];
  }
}

// ── RSS/Atom XML parser (no libraries) ─────────────────────

function parseRSS(xml, sourceName) {
  var items = [];

  // Try RSS <item> tags first, then Atom <entry> tags
  var itemRegex   = /<item[\s\S]*?<\/item>/gi;
  var entryRegex  = /<entry[\s\S]*?<\/entry>/gi;
  var matches     = xml.match(itemRegex) || xml.match(entryRegex) || [];

  matches.slice(0, 12).forEach(function(block) {
    var title   = getText(block, "title");
    var link    = getLink(block);
    var desc    = getText(block, "description") || getText(block, "summary") || getText(block, "content");
    var pubDate = getText(block, "pubDate") || getText(block, "published") || getText(block, "updated") || "";

    title = clean(title);
    if (!title || title.length < 5) return;

    items.push({
      title:       title,
      summary:     clean(desc).slice(0, 250),
      url:         link || "",
      source:      sourceName,
      publishedAt: safeDate(pubDate)
    });
  });

  return items;
}

// ── XML helpers ─────────────────────────────────────────────

function getText(block, tag) {
  // Try CDATA first
  var cd = block.match(new RegExp("<" + tag + "[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/" + tag + ">", "i"));
  if (cd) return cd[1];
  // Then plain content
  var pl = block.match(new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)<\\/" + tag + ">", "i"));
  if (pl) return pl[1];
  return "";
}

function getLink(block) {
  // <link>url</link>
  var m = block.match(/<link>([^<]+)<\/link>/i);
  if (m) return m[1].trim();
  // <link href="url" />
  var h = block.match(/<link[^>]+href=["']([^"']+)["']/i);
  if (h) return h[1].trim();
  // Plain URL in link tag
  var u = block.match(/<link[^>]*>\s*(https?:\/\/[^\s<]+)/i);
  if (u) return u[1].trim();
  return "";
}

function clean(s) {
  return (s || "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]*>/g,           " ")
    .replace(/&amp;/g,   "&")
    .replace(/&lt;/g,    "<")
    .replace(/&gt;/g,    ">")
    .replace(/&quot;/g,  '"')
    .replace(/&#39;/g,   "'")
    .replace(/&nbsp;/g,  " ")
    .replace(/&#\d+;/g,  "")
    .replace(/\s+/g,     " ")
    .trim();
}

function safeDate(s) {
  if (!s) return new Date().toISOString();
  try { var d = new Date(s.trim()); return isNaN(d) ? new Date().toISOString() : d.toISOString(); }
  catch(e) { return new Date().toISOString(); }
}

// ── Relevance & Sentiment ───────────────────────────────────

function isRelevant(text, keywords) {
  return keywords.some(function(k) { return text.indexOf(k) !== -1; });
}

function getSentiment(text, bullish, bearish) {
  var b = bullish.filter(function(k) { return text.indexOf(k) !== -1; }).length;
  var r = bearish.filter(function(k) { return text.indexOf(k) !== -1; }).length;
  if (b > r) return "Bullish EUR";
  if (r > b) return "Bearish EUR";
  return "Neutral";
}

function cors() {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Content-Type":                 "application/json"
  };
}
