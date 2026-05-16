// =============================================================
// REAMAL Trade — Analysis Display Module
// File: public/js/analysis.js
// =============================================================
// Calls the Netlify AI function, animates loading steps,
// parses the response, and renders the full trade signal
// including Direction, Entry, TP1, TP2, SL, R:R ratio,
// confluence score, and the complete AI analysis text.
// =============================================================

// =============================================================
// STATE
// =============================================================

const AnalysisState = {
  lastAnalysis:  null,   // Full analysis text from AI
  lastSignal:    null,   // Extracted signal object
  lastTimestamp: null,   // When analysis was run
  isRunning:     false,  // Prevent duplicate requests
};

// =============================================================
// API ENDPOINT
// =============================================================

const ANALYZE_ENDPOINT = "/api/analyze";
const NEWS_ENDPOINT    = "/api/news";

// =============================================================
// LOADING STEP ANIMATOR
// =============================================================

const LOADING_STEPS = ["step1", "step2", "step3", "step4"];
let stepTimer = null;

function startLoadingAnimation() {
  let currentStep = 0;

  // Reset all steps
  LOADING_STEPS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.remove("active", "done");
    }
  });

  // Activate first step immediately
  const firstStep = document.getElementById(LOADING_STEPS[0]);
  if (firstStep) firstStep.classList.add("active");

  // Progress through steps
  stepTimer = setInterval(() => {
    // Mark current as done
    const current = document.getElementById(LOADING_STEPS[currentStep]);
    if (current) {
      current.classList.remove("active");
      current.classList.add("done");
    }

    currentStep++;

    if (currentStep < LOADING_STEPS.length) {
      // Activate next step
      const next = document.getElementById(LOADING_STEPS[currentStep]);
      if (next) next.classList.add("active");
    } else {
      // All steps done — stop timer
      clearInterval(stepTimer);
    }
  }, 3000); // Each step takes ~3 seconds
}

function stopLoadingAnimation() {
  if (stepTimer) {
    clearInterval(stepTimer);
    stepTimer = null;
  }
}

// =============================================================
// SHOW / HIDE STATES
// =============================================================

function showEmpty() {
  document.getElementById("analysisEmpty")?.classList.remove("hidden");
  document.getElementById("analysisLoading")?.classList.add("hidden");
  document.getElementById("signalSummary")?.classList.add("hidden");
  document.getElementById("tradeLevels")?.classList.add("hidden");
  document.getElementById("analysisFull")?.classList.add("hidden");
  document.getElementById("logTradeBtn")?.classList.add("hidden");
  document.getElementById("analysisTimestamp")?.classList.add("hidden");
}

function showLoading() {
  document.getElementById("analysisEmpty")?.classList.add("hidden");
  document.getElementById("analysisLoading")?.classList.remove("hidden");
  document.getElementById("signalSummary")?.classList.add("hidden");
  document.getElementById("tradeLevels")?.classList.add("hidden");
  document.getElementById("analysisFull")?.classList.add("hidden");
  document.getElementById("logTradeBtn")?.classList.add("hidden");
}

function showResults() {
  document.getElementById("analysisEmpty")?.classList.add("hidden");
  document.getElementById("analysisLoading")?.classList.add("hidden");
  document.getElementById("signalSummary")?.classList.remove("hidden");
  document.getElementById("tradeLevels")?.classList.remove("hidden");
  document.getElementById("analysisFull")?.classList.remove("hidden");
  document.getElementById("logTradeBtn")?.classList.remove("hidden");
  document.getElementById("analysisTimestamp")?.classList.remove("hidden");
}

// =============================================================
// RENDER SIGNAL SUMMARY CARDS
// =============================================================

function renderSignalSummary(signal) {
  // Direction
  const dirEl  = document.getElementById("signalDirectionVal");
  const dirCard = document.getElementById("signalDirection");
  if (dirEl) {
    dirEl.textContent  = signal.direction;
    dirEl.className    = "signal-value";
    if (signal.direction === "BUY")      dirEl.classList.add("buy");
    else if (signal.direction === "SELL") dirEl.classList.add("sell");
    else                                  dirEl.classList.add("notrade");
  }

  // Add color border to direction card
  if (dirCard) {
    dirCard.style.borderColor = "";
    if (signal.direction === "BUY")       dirCard.style.borderColor = "var(--green)";
    else if (signal.direction === "SELL") dirCard.style.borderColor = "var(--red)";
    else                                  dirCard.style.borderColor = "var(--yellow)";
  }

  // Confidence
  const confEl = document.getElementById("signalConfidence");
  if (confEl) {
    confEl.textContent = signal.confidence;
    confEl.className   = "signal-value";
    if (signal.confidence === "High")        confEl.classList.add("high");
    else if (signal.confidence === "Medium") confEl.classList.add("medium");
    else                                     confEl.classList.add("low");
  }

  // Confluence score
  const scoreEl = document.getElementById("signalConfluence");
  if (scoreEl) {
    scoreEl.textContent = signal.confluenceScore;
    scoreEl.className   = "signal-value";
    const score = parseInt(signal.confluenceScore);
    if (score >= 7)      scoreEl.classList.add("high");
    else if (score >= 5) scoreEl.classList.add("medium");
    else                 scoreEl.classList.add("low");
  }

  // Risk/Reward
  const rrEl = document.getElementById("signalRR");
  if (rrEl) {
    rrEl.textContent = signal.riskReward;
    rrEl.className   = "signal-value";
  }
}

// =============================================================
// RENDER TRADE LEVELS
// =============================================================

function renderTradeLevels(signal) {
  const entryEl = document.getElementById("levelEntry");
  const tp1El   = document.getElementById("levelTP1");
  const tp2El   = document.getElementById("levelTP2");
  const slEl    = document.getElementById("levelSL");

  if (entryEl) entryEl.textContent = signal.entry    || "See analysis";
  if (tp1El)   tp1El.textContent   = signal.tp1      || "See analysis";
  if (tp2El)   tp2El.textContent   = signal.tp2      || "See analysis";
  if (slEl)    slEl.textContent    = signal.sl        || "See analysis";
}

// =============================================================
// RENDER FULL ANALYSIS TEXT
// Converts markdown-style formatting to HTML
// =============================================================

function renderFullAnalysis(text) {
  const bodyEl = document.getElementById("analysisBody");
  if (!bodyEl) return;

  // Convert markdown-style text to readable HTML
  let html = text
    // Headers ## → <h2>
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    // Bold **text** → <strong>
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    // Line breaks
    .replace(/\n/g, "<br>")
    // Horizontal rules ---
    .replace(/(<br>)?---(<br>)?/g, '<hr style="border-color:var(--border);margin:10px 0">')
    // Remove excessive <br> after <h2>
    .replace(/<\/h2><br>/g, "</h2>");

  bodyEl.innerHTML = html;
}

// =============================================================
// RENDER TIMESTAMP
// =============================================================

function renderTimestamp(isoString) {
  const el = document.getElementById("analysisTimestamp");
  if (!el) return;
  const date = new Date(isoString);
  el.textContent = `Analyzed at ${date.toUTCString().slice(0, 25)} UTC`;
}

// =============================================================
// POPULATE JOURNAL FORM FROM SIGNAL
// Auto-fills the trade journal form with signal values
// =============================================================

function prefillJournalForm(signal) {
  if (!signal) return;

  // Direction
  const dirSelect = document.getElementById("jDirection");
  if (dirSelect && (signal.direction === "BUY" || signal.direction === "SELL")) {
    dirSelect.value = signal.direction;
  }

  // Extract numeric price from strings like "1.08500 (20 pips)"
  const extractPrice = (str) => {
    if (!str) return "";
    const match = str.match(/[\d.]{4,9}/);
    return match ? match[0] : "";
  };

  const entryEl = document.getElementById("jEntry");
  const tpEl    = document.getElementById("jTP");
  const slEl    = document.getElementById("jSL");

  if (entryEl) entryEl.value = extractPrice(signal.entry);
  if (tpEl)    tpEl.value    = extractPrice(signal.tp1);
  if (slEl)    slEl.value    = extractPrice(signal.sl);

  // Add note
  const notesEl = document.getElementById("jNotes");
  if (notesEl) {
    notesEl.value = `AI Signal — Confluence: ${signal.confluenceScore} | Confidence: ${signal.confidence}`;
  }
}

// =============================================================
// TOGGLE FULL ANALYSIS PANEL
// =============================================================

function initAnalysisToggle() {
  const toggle = document.getElementById("analysisToggle");
  const body   = document.getElementById("analysisBody");
  const arrow  = toggle?.querySelector(".toggle-arrow");

  toggle?.addEventListener("click", () => {
    const isOpen = body?.classList.contains("open");
    if (isOpen) {
      body?.classList.remove("open");
      if (arrow) arrow.classList.remove("open");
    } else {
      body?.classList.add("open");
      if (arrow) arrow.classList.add("open");
    }
  });
}

// =============================================================
// LOG TRADE BUTTON
// =============================================================

function initLogTradeButton() {
  document.getElementById("logTradeBtn")?.addEventListener("click", () => {
    if (AnalysisState.lastSignal) {
      prefillJournalForm(AnalysisState.lastSignal);
      // Scroll to journal
      document.getElementById("journalCard")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      showToast("📓 Journal form pre-filled with signal data. Review and save.", "success");
    }
  });
}

// =============================================================
// MAIN ANALYSIS RUNNER
// =============================================================

async function runAnalysis() {
  // Prevent duplicate runs
  if (AnalysisState.isRunning) {
    showToast("⏳ Analysis already in progress...", "info");
    return;
  }

  // Check image is loaded
  if (!window.UploaderState?.imageBase64) {
    showToast("⚠️ Please upload a chart image first.", "error");
    return;
  }

  AnalysisState.isRunning = true;

  // Show loading UI
  showLoading();
  startLoadingAnimation();
  setAnalyzeLoading(true);

  try {
    // ── Step 1: Fetch live news ──────────────────────────────
    let newsContext = "";
    let newsArticles = [];

    try {
      const newsRes = await fetch(NEWS_ENDPOINT);
      if (newsRes.ok) {
        const newsData = await newsRes.json();
        newsContext  = newsData.aiContext  || "";
        newsArticles = newsData.articles   || [];

        // Update sentiment banner with fresh data
        if (newsData.sentiment && typeof updateSentimentBanner === "function") {
          updateSentimentBanner(newsData.sentiment);
        }
      }
    } catch (newsErr) {
      console.warn("News fetch failed, proceeding without news:", newsErr.message);
    }

    // ── Step 2-4: Call AI analysis ───────────────────────────
    const riskSettings = window.getRiskSettings?.() || {
      accountBalance: 100,
      riskPercent: 2,
    };

    const response = await fetch(ANALYZE_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64:    window.UploaderState.imageBase64,
        imageType:      window.UploaderState.imageType || "image/png",
        newsContext,
        accountBalance: riskSettings.accountBalance,
        riskPercent:    riskSettings.riskPercent,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Analysis failed. Please try again.");
    }

    // ── Save to state ────────────────────────────────────────
    AnalysisState.lastAnalysis  = data.analysis;
    AnalysisState.lastSignal    = data.signal;
    AnalysisState.lastTimestamp = data.timestamp;

    // ── Stop loading animation ───────────────────────────────
    stopLoadingAnimation();

    // ── Render results ───────────────────────────────────────
    renderSignalSummary(data.signal);
    renderTradeLevels(data.signal);
    renderFullAnalysis(data.analysis);
    renderTimestamp(data.timestamp);

    // Show results
    showResults();

    // Auto-open full analysis
    const analysisBody = document.getElementById("analysisBody");
    const arrow = document.querySelector(".toggle-arrow");
    analysisBody?.classList.add("open");
    if (arrow) arrow.classList.add("open");

    // Signal-specific toast
    const dir = data.signal?.direction;
    if (dir === "BUY") {
      showToast("🟢 BUY signal detected! Review levels before entering.", "success", 5000);
    } else if (dir === "SELL") {
      showToast("🔴 SELL signal detected! Review levels before entering.", "error", 5000);
    } else {
      showToast("⚠️ NO TRADE signal — conditions not ideal. Stay patient.", "info", 5000);
    }

    // Scroll to results on mobile
    if (typeof scrollToAnalysis === "function") scrollToAnalysis();

  } catch (err) {
    console.error("Analysis error:", err);
    stopLoadingAnimation();
    showEmpty();
    showToast(`❌ ${err.message}`, "error", 6000);
  } finally {
    AnalysisState.isRunning = false;
    setAnalyzeLoading(false);
  }
}

// Make runAnalysis globally accessible (called by uploader)
window.runAnalysis = runAnalysis;

// =============================================================
// INITIALIZE
// =============================================================

document.addEventListener("DOMContentLoaded", () => {
  showEmpty();
  initAnalysisToggle();
  initLogTradeButton();
  console.log("🎯 Analysis module ready");
});
