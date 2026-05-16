// =============================================================
// REAMAL Trade — Main Application Controller
// File: public/js/app.js
// =============================================================
// Initializes the app, manages the UTC clock, detects active
// forex market sessions, coordinates all modules, and handles
// the risk manager calculations.
// =============================================================

// =============================================================
// FOREX MARKET SESSIONS (all times in UTC)
// =============================================================
const SESSIONS = [
  {
    name: "Sydney",
    open: 21,   // 21:00 UTC (prev day)
    close: 6,   // 06:00 UTC
    overnight: true,
    color: "#4a90d9",
  },
  {
    name: "Tokyo",
    open: 0,    // 00:00 UTC
    close: 9,   // 09:00 UTC
    overnight: false,
    color: "#ffd32a",
  },
  {
    name: "London",
    open: 8,    // 08:00 UTC
    close: 17,  // 17:00 UTC
    overnight: false,
    color: "#00d4aa",
  },
  {
    name: "New York",
    open: 13,   // 13:00 UTC
    close: 22,  // 22:00 UTC
    overnight: false,
    color: "#ff4757",
  },
];

// London + NY overlap (13:00–17:00 UTC) is highest volatility
const HIGH_VOLATILITY_START = 13;
const HIGH_VOLATILITY_END   = 17;

// =============================================================
// CLOCK & MARKET SESSION
// =============================================================

function updateClock() {
  const now      = new Date();
  const utcHours = now.getUTCHours();
  const utcMins  = String(now.getUTCMinutes()).padStart(2, "0");
  const utcSecs  = String(now.getUTCSeconds()).padStart(2, "0");

  // Update clock display
  const clockEl = document.getElementById("currentTime");
  if (clockEl) {
    clockEl.textContent = `${String(utcHours).padStart(2, "0")}:${utcMins}:${utcSecs} UTC`;
  }

  // Detect active sessions
  const activeSessions = SESSIONS.filter((s) => {
    if (s.overnight) {
      return utcHours >= s.open || utcHours < s.close;
    }
    return utcHours >= s.open && utcHours < s.close;
  });

  // Update market status badge
  const statusEl    = document.getElementById("marketStatus");
  const statusText  = document.getElementById("marketStatusText");
  const pulse       = statusEl?.querySelector(".pulse");

  if (activeSessions.length === 0) {
    // Market closed (rare — between NY close 22:00 and Sydney open 21:00)
    if (statusText) statusText.textContent = "Market Closed";
    if (pulse)      pulse.classList.add("red");
  } else {
    const isHighVol = utcHours >= HIGH_VOLATILITY_START && utcHours < HIGH_VOLATILITY_END;
    const names     = activeSessions.map((s) => s.name).join(" + ");
    if (statusText) {
      statusText.textContent = isHighVol
        ? `⚡ ${names} — High Volatility`
        : `🟢 ${names} Session`;
    }
    if (pulse) pulse.classList.remove("red");
  }
}

// =============================================================
// RISK MANAGER
// =============================================================

function updateRiskManager() {
  const balance     = parseFloat(document.getElementById("accountBalance")?.value) || 100;
  const riskPct     = parseFloat(document.getElementById("riskPercent")?.value)    || 2;

  const maxLoss     = (balance * riskPct) / 100;
  const dailyTarget = (balance * 2) / 100; // 2% daily target is realistic

  // Calculate safe lot size
  // For EUR/USD: 1 micro lot (0.01) = ~$0.10/pip
  // With a 20-pip SL: risk = pips × pip_value × lots
  // lots = maxLoss / (20 pips × $0.10) = maxLoss / 2
  const avgStopLossPips = 20;
  const pipValuePerMicroLot = 0.10; // USD per pip per 0.01 lot
  const safeLots = maxLoss / (avgStopLossPips * pipValuePerMicroLot * 100);
  const safeLotDisplay = Math.max(0.01, parseFloat(safeLots.toFixed(2)));

  // Update display
  const maxLossEl     = document.getElementById("maxLoss");
  const safeLotEl     = document.getElementById("safeLot");
  const dailyTargetEl = document.getElementById("dailyTarget");

  if (maxLossEl)     maxLossEl.textContent     = `$${maxLoss.toFixed(2)}`;
  if (safeLotEl)     safeLotEl.textContent     = `${safeLotDisplay} lot`;
  if (dailyTargetEl) dailyTargetEl.textContent = `$${dailyTarget.toFixed(2)}`;

  // Color code max loss (danger if >5%)
  if (maxLossEl) {
    maxLossEl.className = "risk-stat-value";
    if (riskPct > 5) maxLossEl.classList.add("danger");
    else if (riskPct > 3) maxLossEl.classList.add("warning");
    else maxLossEl.classList.add("danger"); // always show red for awareness
  }
}

// =============================================================
// TOAST NOTIFICATIONS
// =============================================================

let toastTimer = null;

function showToast(message, type = "info", duration = 3500) {
  const toast   = document.getElementById("toast");
  const toastMsg = document.getElementById("toastMsg");
  if (!toast || !toastMsg) return;

  toastMsg.textContent = message;
  toast.className      = `toast ${type}`;

  // Clear any existing timer
  if (toastTimer) clearTimeout(toastTimer);

  // Hide after duration
  toastTimer = setTimeout(() => {
    toast.classList.add("hidden");
  }, duration);
}

// Make showToast globally accessible to other modules
window.showToast = showToast;

// =============================================================
// KEYBOARD SHORTCUTS
// =============================================================

function initKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // Ctrl/Cmd + Enter → Analyze
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      const analyzeBtn = document.getElementById("analyzeBtn");
      if (analyzeBtn && !analyzeBtn.disabled) {
        analyzeBtn.click();
      }
    }

    // Ctrl/Cmd + R → Refresh news (prevent page reload)
    if ((e.ctrlKey || e.metaKey) && e.key === "r" && e.shiftKey) {
      e.preventDefault();
      const refreshBtn = document.getElementById("refreshNews");
      if (refreshBtn) refreshBtn.click();
    }
  });
}

// =============================================================
// SMOOTH SCROLL FOR ANALYSIS
// =============================================================

function scrollToAnalysis() {
  const analysisCard = document.getElementById("analysisCard");
  if (analysisCard && window.innerWidth <= 768) {
    // On mobile, scroll to analysis after result appears
    setTimeout(() => {
      analysisCard.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 300);
  }
}

window.scrollToAnalysis = scrollToAnalysis;

// =============================================================
// ACCOUNT BALANCE — SAVE TO LOCALSTORAGE
// =============================================================

function initPersistentSettings() {
  const balanceEl = document.getElementById("accountBalance");
  const riskEl    = document.getElementById("riskPercent");

  // Load saved values
  const savedBalance = localStorage.getItem("reamal_balance");
  const savedRisk    = localStorage.getItem("reamal_risk");

  if (savedBalance && balanceEl) balanceEl.value = savedBalance;
  if (savedRisk    && riskEl)    riskEl.value    = savedRisk;

  // Save on change
  balanceEl?.addEventListener("input", () => {
    localStorage.setItem("reamal_balance", balanceEl.value);
    updateRiskManager();
  });

  riskEl?.addEventListener("input", () => {
    localStorage.setItem("reamal_risk", riskEl.value);
    updateRiskManager();
  });
}

// =============================================================
// GET CURRENT RISK SETTINGS (used by analysis module)
// =============================================================

function getRiskSettings() {
  return {
    accountBalance: parseFloat(document.getElementById("accountBalance")?.value) || 100,
    riskPercent:    parseFloat(document.getElementById("riskPercent")?.value)    || 2,
  };
}

window.getRiskSettings = getRiskSettings;

// =============================================================
// INITIALIZE APP
// =============================================================

document.addEventListener("DOMContentLoaded", () => {
  console.log("📈 REAMAL Trade — Initializing...");

  // 1. Start clock (updates every second)
  updateClock();
  setInterval(updateClock, 1000);

  // 2. Init persistent settings & risk manager
  initPersistentSettings();
  updateRiskManager();

  // 3. Init keyboard shortcuts
  initKeyboardShortcuts();

  // 4. Load live news on startup
  if (typeof loadNews === "function") {
    loadNews();
  }

  // 5. Refresh news button
  document.getElementById("refreshNews")?.addEventListener("click", () => {
    if (typeof loadNews === "function") loadNews();
  });

  // 6. Auto-refresh news every 5 minutes
  setInterval(() => {
    if (typeof loadNews === "function") loadNews();
  }, 5 * 60 * 1000);

  console.log("✅ REAMAL Trade — Ready!");
  showToast("REAMAL Trade is ready. Upload a chart to begin.", "info", 4000);
});
