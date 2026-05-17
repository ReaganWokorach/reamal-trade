// =============================================================
// REAMAL Trade — Live News Function
// Uses built-in fetch only — zero npm packages required
// =============================================================

exports.handler = async function(event) {

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors(), body: "" };
  }

  // RSS feed sources — all free, no API keys needed
  var sources = [
    { name: "ForexLive",     url: "https://www.forexlive.com/feed/news" },
    { name: "FXStreet",      url: "https://www.fxstreet.com/rss/news" },
    { name: "Investing.com", url: "https://www.investing.com/rss/news_25.rss" },
    { name: "DailyFX",       url: "https://www.dailyfx.com/feeds/all" }
  ];

  // Keywords to filter EUR/USD relevant news
  var keywords = ["eur","usd","dollar","euro","ecb","fed","federal reserve",
    "european central bank","interest rate","inflation","cpi","gdp","nfp",
    "non-farm","unemployment","fomc","powell","lagarde","forex","eurusd",
    "eur/usd","hawkish","dovish","rate hike","rate cut","monetary policy"];

  var bullishWords = ["euro rises","euro gains","eur higher","dollar weakens",
    "usd falls","dollar drops","fed dovish","rate cut expected","weaker dollar"];
  var bearishWords = ["euro falls","euro drops","eur lower","dollar rises",
    "usd gains","dollar strengthens","fed hawkish","rate hike expected","stronger dollar"];

  // Fetch all sources in parallel
  var results = await Promise.allSettled(
    sources.map(function(s) { return fetchRSS(s); })
  );

  var allArticles = [];
  results.forEach(function(r) {
    if (r.status === "fulfilled") allArticles = allArticles.concat(r.value);
  });

  // Filter relevant, deduplicate, sort newest first
  var seen = {};
  var filtered = allArticles
    .filter(function(a) { return isRelevant(a.title + " " + a.summary, keywords); })
    .filter(function(a) {
      var key = a.title.slice(0, 50).toLowerCase();
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    })
    .sort(function(a, b) { return new Date(b.publishedAt) - new Date(a.publishedAt); });

  // Tag sentiment
  filtered.forEach(function(a) {
    a.sentiment = getSentiment(a.title + " " + a.summary, bullishWords, bearishWords);
  });

  // Overall sentiment
  var bullCount = filtered.filter(function(a) { return a.sentiment === "Bullish EUR"; }).length;
  var bearCount = filtered.filter(function(a) { return a.sentiment === "Bearish EUR"; }).length;
  var total     = filtered.length || 1;
  var bullPct   = Math.round((bullCount / total) * 100);
  var bearPct   = Math.round((bearCount / total) * 100);
  var overall   = bullCount > bearCount + 2 ? "Bullish EUR" : bearCount > bullCount + 2 ? "Bearish EUR" : "Neutral";

  var sentiment = { overall: overall, bullishPct: bullPct, bearishPct: bearPct, neutralPct: 100 - bullPct - bearPct };

  // Format for AI
  var top = filtered.slice(0, 8);
  var aiContext = "OVERALL SENTIMENT: " + overall + " (" + bullPct + "% Bullish | " + bearPct + "% Bearish)\n\n"
    + "LATEST EUR/USD NEWS:\n"
    + top.map(function(a, i) {
        return (i+1) + ". [" + a.source + "] [" + a.sentiment + "] " + a.title
          + (a.summary ? "\n   " + a.summary.slice(0, 120) + "..." : "");
      }).join("\n\n");

  return {
    statusCode: 200,
    headers: cors(),
    body: JSON.stringify({
      success:   true,
      articles:  filtered.slice(0, 20),
      sentiment: sentiment,
      aiContext: aiContext,
      meta: {
        total:            filtered.length,
        sourcesQueried:   sources.length,
        sourcesSucceeded: results.filter(function(r) { return r.status === "fulfilled"; }).length,
        fetchedAt:        new Date().toISOString()
      }
    })
  };
};

// ── Fetch and parse a single RSS feed ──────────────────────

async function fetchRSS(source) {
  try {
    var res = await fetch(source.url, {
      headers: { "User-Agent": "REAMAL-Trade-NewsBot/1.0" },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return [];
    var xml = await res.text();
    return parseRSS(xml, source.name);
  } catch(e) {
    console.warn("Failed to fetch " + source.name + ":", e.message);
    return [];
  }
}

// ── Simple RSS XML parser (no libraries needed) ─────────────

function parseRSS(xml, sourceName) {
  var items = [];
  var itemMatches = xml.match(/<item[\s\S]*?<\/item>/gi) || [];

  itemMatches.slice(0, 15).forEach(function(item) {
    var title   = stripTags(getTag(item, "title"))   || "";
    var link    = stripTags(getTag(item, "link"))    || "";
    var desc    = stripTags(getTag(item, "description")) || "";
    var pubDate = stripTags(getTag(item, "pubDate")) || new Date().toISOString();
    if (!title) return;
    items.push({
      title:       cleanText(title),
      summary:     cleanText(desc).slice(0, 200),
      url:         link.trim(),
      source:      sourceName,
      publishedAt: safeDate(pubDate)
    });
  });
  return items;
}

function getTag(xml, tag) {
  var m = xml.match(new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)<\\/" + tag + ">", "i"));
  if (m) return m[1];
  // Try CDATA
  var c = xml.match(new RegExp("<" + tag + "[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>", "i"));
  return c ? c[1] : "";
}

function stripTags(s) {
  return (s || "").replace(/<[^>]*>/g, "");
}

function cleanText(s) {
  return (s || "")
    .replace(/&amp;/g,  "&")
    .replace(/&lt;/g,   "<")
    .replace(/&gt;/g,   ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g,  "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g,    " ")
    .trim();
}

function safeDate(dateStr) {
  try { var d = new Date(dateStr); return isNaN(d) ? new Date().toISOString() : d.toISOString(); }
  catch(e) { return new Date().toISOString(); }
}

function isRelevant(text, keywords) {
  var low = (text || "").toLowerCase();
  return keywords.some(function(k) { return low.indexOf(k) !== -1; });
}

function getSentiment(text, bullish, bearish) {
  var low = (text || "").toLowerCase();
  var b = bullish.filter(function(k) { return low.indexOf(k) !== -1; }).length;
  var r = bearish.filter(function(k) { return low.indexOf(k) !== -1; }).length;
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
