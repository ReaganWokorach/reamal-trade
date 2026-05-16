// =============================================================
// REAMAL Trade — Analysis Display Module
// File: public/js/analysis.js
// =============================================================

// =============================================================
// STATE
// =============================================================

var AnalysisState = {
  lastAnalysis:  null,
  lastSignal:    null,
  lastTimestamp: null,
  isRunning:     false,
};

// =============================================================
// LOADING STEP ANIMATOR
// =============================================================

var loadingStepIds = ["step1", "step2", "step3", "step4"];
var stepTimer = null;

function startLoadingAnimation() {
  var currentStep = 0;
  loadingStepIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.classList.remove("active", "done");
  });
  var first = document.getElementById(loadingStepIds[0]);
  if (first) first.classList.add("active");

  stepTimer = setInterval(function() {
    var current = document.getElementById(loadingStepIds[currentStep]);
    if (current) {
      current.classList.remove("active");
      current.classList.add("done");
    }
    currentStep++;
    if (currentStep < loadingStepIds.length) {
      var next = document.getElementById(loadingStepIds[currentStep]);
      if (next) next.classList.add("active");
    } else {
      clearInterval(stepTimer);
    }
  }, 3000);
}

function stopLoadingAnimation() {
  if (stepTimer) { clearInterval(stepTimer); stepTimer = null; }
}

// =============================================================
// SHOW / HIDE STATES
// =============================================================

function showEmpty() {
  document.getElementById("analysisEmpty")    && document.getElementById("analysisEmpty").classList.remove("hidden");
  document.getElementById("analysisLoading")  && document.getElementById("analysisLoading").classList.add("hidden");
  document.getElementById("signalSummary")    && document.getElementById("signalSummary").classList.add("hidden");
  document.getElementById("tradeLevels")      && document.getElementById("tradeLevels").classList.add("hidden");
  document.getElementById("analysisFull")     && document.getElementById("analysisFull").classList.add("hidden");
  document.getElementById("logTradeBtn")      && document.getElementById("logTradeBtn").classList.add("hidden");
  document.getElementById("analysisTimestamp")&& document.getElementById("analysisTimestamp").classList.add("hidden");
}

function showLoading() {
  document.getElementById("analysisEmpty")   && document.getElementById("analysisEmpty").classList.add("hidden");
  document.getElementById("analysisLoading") && document.getElementById("analysisLoading").classList.remove("hidden");
  document.getElementById("signalSummary")   && document.getElementById("signalSummary").classList.add("hidden");
  document.getElementById("tradeLevels")     && document.getElementById("tradeLevels").classList.add("hidden");
  document.getElementById("analysisFull")    && document.getElementById("analysisFull").classList.add("hidden");
  document.getElementById("logTradeBtn")     && document.getElementById("logTradeBtn").classList.add("hidden");
}

function showResults() {
  document.getElementById("analysisEmpty")    && document.getElementById("analysisEmpty").classList.add("hidden");
  document.getElementById("analysisLoading")  && document.getElementById("analysisLoading").classList.add("hidden");
  document.getElementById("signalSummary")    && document.getElementById("signalSummary").classList.remove("hidden");
  document.getElementById("tradeLevels")      && document.getElementById("tradeLevels").classList.remove("hidden");
  document.getElementById("analysisFull")     && document.getElementById("analysisFull").classList.remove("hidden");
  document.getElementById("logTradeBtn")      && document.getElementById("logTradeBtn").classList.remove("hidden");
  document.getElementById("analysisTimestamp")&& document.getElementById("analysisTimestamp").classList.remove("hidden");
}

// =============================================================
// RENDER SIGNAL SUMMARY
// =============================================================

function renderSignalSummary(signal) {
  var dirEl   = document.getElementById("signalDirectionVal");
  var dirCard = document.getElementById("signalDirection");
  if (dirEl) {
    dirEl.textContent = signal.direction;
    dirEl.className   = "signal-value";
    if (signal.direction === "BUY")       dirEl.classList.add("buy");
    else if (signal.direction === "SELL") dirEl.classList.add("sell");
    else                                  dirEl.classList.add("notrade");
  }
  if (dirCard) {
    dirCard.style.borderColor =
      signal.direction === "BUY"  ? "var(--green)" :
      signal.direction === "SELL" ? "var(--red)"   : "var(--yellow)";
  }
  var confEl = document.getElementById("signalConfidence");
  if (confEl) {
    confEl.textContent = signal.confidence;
    confEl.className   = "signal-value";
    if (signal.confidence === "High")        confEl.classList.add("high");
    else if (signal.confidence === "Medium") confEl.classList.add("medium");
    else                                     confEl.classList.add("low");
  }
  var scoreEl = document.getElementById("signalConfluence");
  if (scoreEl) {
    scoreEl.textContent = signal.confluenceScore;
    scoreEl.className   = "signal-value";
    var score = parseInt(signal.confluenceScore);
    if (score >= 7)      scoreEl.classList.add("high");
    else if (score >= 5) scoreEl.classList.add("medium");
    else                 scoreEl.classList.add("low");
  }
  var rrEl = document.getElementById("signalRR");
  if (rrEl) { rrEl.textContent = signal.riskReward; rrEl.className = "signal-value"; }
}

// =============================================================
// RENDER TRADE LEVELS
// =============================================================

function renderTradeLevels(signal) {
  var entryEl = document.getElementById("levelEntry");
  var tp1El   = document.getElementById("levelTP1");
  var tp2El   = document.getElementById("levelTP2");
  var slEl    = document.getElementById("levelSL");
  if (entryEl) entryEl.textContent = signal.entry || "See analysis";
  if (tp1El)   tp1El.textContent   = signal.tp1   || "See analysis";
  if (tp2El)   tp2El.textContent   = signal.tp2   || "See analysis";
  if (slEl)    slEl.textContent    = signal.sl     || "See analysis";
}

// =============================================================
// RENDER FULL ANALYSIS TEXT
// =============================================================

function renderFullAnalysis(text) {
  var bodyEl = document.getElementById("analysisBody");
  if (!bodyEl) return;
  var html = text
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>")
    .replace(/(<br>)?---(<br>)?/g, '<hr style="border-color:var(--border);margin:10px 0">')
    .replace(/<\/h2><br>/g, "</h2>");
  bodyEl.innerHTML = html;
}

function renderTimestamp(isoString) {
  var el = document.getElementById("analysisTimestamp");
  if (!el) return;
  el.textContent = "Analyzed at " + new Date(isoString).toUTCString().slice(0, 25) + " UTC";
}

// =============================================================
// PREFILL JOURNAL FORM
// =============================================================

function prefillJournalForm(signal) {
  if (!signal) return;
  var dirSelect = document.getElementById("jDirection");
  if (dirSelect && (signal.direction === "BUY" || signal.direction === "SELL")) {
    dirSelect.value = signal.direction;
  }
  function extractPrice(str) {
    if (!str) return "";
    var match = str.match(/[\d.]{4,9}/);
    return match ? match[0] : "";
  }
  var entryEl = document.getElementById("jEntry");
  var tpEl    = document.getElementById("jTP");
  var slEl    = document.getElementById("jSL");
  if (entryEl) entryEl.value = extractPrice(signal.entry);
  if (tpEl)    tpEl.value    = extractPrice(signal.tp1);
  if (slEl)    slEl.value    = extractPrice(signal.sl);
  var notesEl = document.getElementById("jNotes");
  if (notesEl) notesEl.value = "AI Signal — Confluence: " + signal.confluenceScore + " | Confidence: " + signal.confidence;
}

// =============================================================
// TOGGLE FULL ANALYSIS PANEL
// =============================================================

function initAnalysisToggle() {
  var toggle = document.getElementById("analysisToggle");
  var body   = document.getElementById("analysisBody");
  var arrow  = toggle ? toggle.querySelector(".toggle-arrow") : null;
  if (!toggle) return;
  toggle.addEventListener("click", function() {
    var isOpen = body && body.classList.contains("open");
    if (isOpen) {
      body && body.classList.remove("open");
      arrow && arrow.classList.remove("open");
    } else {
      body && body.classList.add("open");
      arrow && arrow.classList.add("open");
    }
  });
}

// =============================================================
// LOG TRADE BUTTON
// =============================================================

function initLogTradeButton() {
  var btn = document.getElementById("logTradeBtn");
  if (!btn) return;
  btn.addEventListener("click", function() {
    if (AnalysisState.lastSignal) {
      prefillJournalForm(AnalysisState.lastSignal);
      var journalCard = document.getElementById("journalCard");
      if (journalCard) journalCard.scrollIntoView({ behavior: "smooth", block: "start" });
      if (typeof showToast === "function") showToast("📓 Journal form pre-filled. Review and save.", "success");
    }
  });
}

// =============================================================
// MAIN ANALYSIS RUNNER
// =============================================================

async function runAnalysis() {
  if (AnalysisState.isRunning) {
    if (typeof showToast === "function") showToast("⏳ Analysis already in progress...", "info");
    return;
  }
  if (!window.UploaderState || !window.UploaderState.imageBase64) {
    if (typeof showToast === "function") showToast("⚠️ Please upload a chart image first.", "error");
    return;
  }

  AnalysisState.isRunning = true;
  showLoading();
  startLoadingAnimation();
  if (typeof setAnalyzeLoading === "function") setAnalyzeLoading(true);

  try {
    // Step 1: Fetch live news
    var newsContext = "";
    try {
      var newsRes = await fetch("/api/news");
      if (newsRes.ok) {
        var newsData = await newsRes.json();
        newsContext = newsData.aiContext || "";
        if (newsData.sentiment && typeof updateSentimentBanner === "function") {
          updateSentimentBanner(newsData.sentiment);
        }
      }
    } catch (newsErr) {
      console.warn("News fetch failed, continuing without news:", newsErr.message);
    }

    // Step 2: Get risk settings
    var riskSettings = { accountBalance: 100, riskPercent: 2 };
    if (typeof getRiskSettings === "function") {
      riskSettings = getRiskSettings();
    } else if (window.getRiskSettings) {
      riskSettings = window.getRiskSettings();
    }

    // Step 3: Call AI analysis
    var response = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64:    window.UploaderState.imageBase64,
        imageType:      window.UploaderState.imageType || "image/png",
        newsContext:    newsContext,
        accountBalance: riskSettings.accountBalance,
        riskPercent:    riskSettings.riskPercent,
      }),
    });

    var data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(data.error || "Analysis failed. Please try again.");
    }

    // Save state
    AnalysisState.lastAnalysis  = data.analysis;
    AnalysisState.lastSignal    = data.signal;
    AnalysisState.lastTimestamp = data.timestamp;

    stopLoadingAnimation();

    // Render everything
    renderSignalSummary(data.signal);
    renderTradeLevels(data.signal);
    renderFullAnalysis(data.analysis);
    renderTimestamp(data.timestamp);
    showResults();

    // Auto-open analysis text
    var analysisBody = document.getElementById("analysisBody");
    var arrow = document.querySelector(".toggle-arrow");
    if (analysisBody) analysisBody.classList.add("open");
    if (arrow) arrow.classList.add("open");

    // Toast
    var dir = data.signal && data.signal.direction;
    if (typeof showToast === "function") {
      if (dir === "BUY")  showToast("🟢 BUY signal detected! Review levels before entering.", "success", 5000);
      else if (dir === "SELL") showToast("🔴 SELL signal detected! Review levels before entering.", "error", 5000);
      else showToast("⚠️ NO TRADE signal — conditions not ideal. Stay patient.", "info", 5000);
    }

    if (typeof scrollToAnalysis === "function") scrollToAnalysis();

  } catch (err) {
    console.error("Analysis error:", err);
    stopLoadingAnimation();
    showEmpty();
    if (typeof showToast === "function") showToast("❌ " + err.message, "error", 6000);
  } finally {
    AnalysisState.isRunning = false;
    if (typeof setAnalyzeLoading === "function") setAnalyzeLoading(false);
  }
}

// Expose globally — this is what uploader.js checks for
window.runAnalysis = runAnalysis;

// =============================================================
// INITIALIZE
// =============================================================

document.addEventListener("DOMContentLoaded", function() {
  showEmpty();
  initAnalysisToggle();
  initLogTradeButton();
  console.log("🎯 Analysis module ready — runAnalysis available:", typeof window.runAnalysis);
});
