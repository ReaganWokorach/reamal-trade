// =============================================================
// REAMAL Trade — News Panel Module
// File: public/js/news.js
// =============================================================
// Fetches live EUR/USD news from the Netlify news function,
// renders each article with source, sentiment tag, time,
// headline and summary. Also updates the sentiment banner
// at the top of the page with bullish/bearish percentages.
// =============================================================

// =============================================================
// STATE
// =============================================================

const NewsState = {
  articles:    [],       // All fetched articles
  sentiment:   null,     // Overall sentiment object
  aiContext:   "",       // Pre-formatted text for AI
  isFetching:  false,    // Prevent duplicate fetches
  lastFetched: null,     // Timestamp of last successful fetch
};

// Make aiContext accessible to analysis module
window.NewsState = NewsState;

// =============================================================
// TIME FORMATTER
// Converts ISO timestamp to relative time e.g. "12 min ago"
// =============================================================

function timeAgo(isoString) {
  if (!isoString) return "just now";

  const now      = Date.now();
  const then     = new Date(isoString).getTime();
  const diffMs   = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs  = Math.floor(diffMins / 60);

  if (diffMins < 1)   return "just now";
  if (diffMins < 60)  return `${diffMins}m ago`;
  if (diffHrs  < 24)  return `${diffHrs}h ago`;
  return `${Math.floor(diffHrs / 24)}d ago`;
}

// =============================================================
// SENTIMENT TAG BUILDER
// =============================================================

function buildSentimentTag(sentiment) {
  const map = {
    "Bullish EUR": { cls: "bullish", label: "Bullish" },
    "Bearish EUR": { cls: "bearish", label: "Bearish" },
    "Neutral":     { cls: "neutral", label: "Neutral"  },
  };
  const s = map[sentiment] || map["Neutral"];
  return `<span class="news-sentiment-tag ${s.cls}">${s.label}</span>`;
}

// =============================================================
// RENDER SINGLE NEWS ARTICLE
// =============================================================

function renderArticle(article, index) {
  const title   = article.title   || "No title";
  const summary = article.summary || "";
  const source  = article.source  || "Unknown";
  const url     = article.url     || "#";
  const time    = timeAgo(article.publishedAt);
  const sentTag = buildSentimentTag(article.sentiment);

  return `
    <div class="news-item" style="animation-delay:${index * 0.04}s">
      <div class="news-item-header">
        <span class="news-source">${escapeHtml(source)}</span>
        ${sentTag}
        <span class="news-time">${time}</span>
      </div>
      <div class="news-title">
        <a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">
          ${escapeHtml(title)}
        </a>
      </div>
      ${summary
        ? `<div class="news-summary">${escapeHtml(summary.slice(0, 180))}${summary.length > 180 ? "…" : ""}</div>`
        : ""}
    </div>
  `;
}

// =============================================================
// RENDER NEWS LIST
// =============================================================

function renderNewsList(articles) {
  const listEl = document.getElementById("newsList");
  if (!listEl) return;

  if (!articles || articles.length === 0) {
    listEl.innerHTML = `
      <div class="news-empty">
        <p>📭 No EUR/USD news found right now.</p>
        <p style="margin-top:6px;font-size:0.7rem">Try refreshing in a few minutes.</p>
      </div>`;
    return;
  }

  listEl.innerHTML = articles
    .slice(0, 20)
    .map((article, i) => renderArticle(article, i))
    .join("");
}

// =============================================================
// UPDATE NEWS META LINE
// Shows source count, article count, last fetch time
// =============================================================

function renderNewsMeta(meta) {
  const metaEl = document.getElementById("newsMeta");
  if (!metaEl || !meta) return;

  const fetchedAt = meta.fetchedAt
    ? new Date(meta.fetchedAt).toUTCString().slice(0, 25)
    : "—";

  metaEl.textContent =
    `${meta.total || 0} articles · ${meta.sourcesSucceeded || 0}/${meta.sourcesQueried || 0} sources · ${fetchedAt} UTC`;
}

// =============================================================
// UPDATE SENTIMENT BANNER (top of page)
// =============================================================

function updateSentimentBanner(sentiment) {
  if (!sentiment) return;

  const valueEl = document.getElementById("sentimentValue");
  const bullEl  = document.getElementById("sentimentBull");
  const bearEl  = document.getElementById("sentimentBear");
  const pctEl   = document.getElementById("sentimentPct");

  if (valueEl) {
    valueEl.textContent = sentiment.overall || "Neutral";
    valueEl.className   = "sentiment-value";
    if (sentiment.overall === "Bullish EUR")      valueEl.classList.add("bullish");
    else if (sentiment.overall === "Bearish EUR") valueEl.classList.add("bearish");
    else                                          valueEl.classList.add("neutral");
  }

  if (bullEl) bullEl.style.width = `${sentiment.bullishPct || 0}%`;
  if (bearEl) bearEl.style.width = `${sentiment.bearishPct || 0}%`;

  if (pctEl) {
    pctEl.textContent =
      `${sentiment.bullishPct || 0}% Bull · ${sentiment.bearishPct || 0}% Bear · ${sentiment.neutralPct || 0}% Neutral`;
  }
}

// Make updateSentimentBanner accessible to analysis module
window.updateSentimentBanner = updateSentimentBanner;

// =============================================================
// SHOW LOADING STATE IN NEWS PANEL
// =============================================================

function showNewsLoading() {
  const listEl = document.getElementById("newsList");
  if (listEl) {
    listEl.innerHTML = `
      <div class="news-loading">
        <div class="loading-spinner sm"></div>
        <span>Fetching live news...</span>
      </div>`;
  }

  const metaEl = document.getElementById("newsMeta");
  if (metaEl) metaEl.textContent = "Connecting to news sources...";

  const sentVal = document.getElementById("sentimentValue");
  if (sentVal) sentVal.textContent = "Loading...";
}

// =============================================================
// SHOW ERROR STATE IN NEWS PANEL
// =============================================================

function showNewsError(message) {
  const listEl = document.getElementById("newsList");
  if (listEl) {
    listEl.innerHTML = `
      <div class="news-empty">
        <p>⚠️ ${escapeHtml(message)}</p>
        <p style="margin-top:8px">
          <button class="btn btn-outline btn-sm" onclick="loadNews()">↻ Try Again</button>
        </p>
      </div>`;
  }

  const sentVal = document.getElementById("sentimentValue");
  if (sentVal) {
    sentVal.textContent = "Unavailable";
    sentVal.className   = "sentiment-value neutral";
  }
}

// =============================================================
// MAIN NEWS LOADER
// =============================================================

async function loadNews() {
  // Prevent duplicate fetches
  if (NewsState.isFetching) return;
  NewsState.isFetching = true;

  // Show loading state
  showNewsLoading();

  // Animate refresh button
  const refreshBtn = document.getElementById("refreshNews");
  if (refreshBtn) {
    refreshBtn.disabled    = true;
    refreshBtn.textContent = "↻ Loading...";
  }

  try {
    const response = await fetch(NEWS_ENDPOINT, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`News server error (${response.status})`);
    }

    const data = await response.json();

    if (!data.success && !data.articles) {
      throw new Error(data.error || "Failed to load news");
    }

    // Save to state
    NewsState.articles    = data.articles   || [];
    NewsState.sentiment   = data.sentiment  || null;
    NewsState.aiContext   = data.aiContext   || "";
    NewsState.lastFetched = new Date().toISOString();

    // Render everything
    renderNewsList(NewsState.articles);
    renderNewsMeta(data.meta);
    updateSentimentBanner(NewsState.sentiment);

    // Show success toast only on manual refresh
    if (refreshBtn?.dataset.manual === "true") {
      showToast(`📰 News updated — ${NewsState.articles.length} articles loaded`, "success", 3000);
    }

  } catch (err) {
    console.error("News load error:", err);
    showNewsError("Could not load news. Analysis will use chart data only.");

    // Update sentiment banner with fallback
    updateSentimentBanner({
      overall:    "Unavailable",
      bullishPct: 0,
      bearishPct: 0,
      neutralPct: 100,
    });
  } finally {
    NewsState.isFetching = false;

    // Reset refresh button
    if (refreshBtn) {
      refreshBtn.disabled    = false;
      refreshBtn.textContent = "↻ Refresh";
      refreshBtn.dataset.manual = "false";
    }
  }
}

// Make loadNews globally accessible (called by app.js)
window.loadNews = loadNews;

// =============================================================
// MANUAL REFRESH BUTTON — flag as manual for toast display
// =============================================================

document.addEventListener("DOMContentLoaded", () => {
  const refreshBtn = document.getElementById("refreshNews");
  refreshBtn?.addEventListener("click", () => {
    refreshBtn.dataset.manual = "true";
    loadNews();
  });
});

// =============================================================
// NEWS ENDPOINT CONSTANT (matches netlify.toml redirect)
// =============================================================

const NEWS_ENDPOINT = "/api/news";

// =============================================================
// HTML ESCAPE HELPER — prevents XSS from news content
// =============================================================

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

console.log("📰 News module ready");
