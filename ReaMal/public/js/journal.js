// =============================================================
// REAMAL Trade — Trade Journal Module
// File: public/js/journal.js
// =============================================================
// Full trade journal with:
//   - Add, view, and delete trades
//   - Win/Loss/Breakeven tracking
//   - P&L calculations and win rate
//   - Persistent storage via localStorage
//   - CSV export for external analysis
//   - Auto pre-fill from AI signal via analysis.js
// =============================================================

// =============================================================
// STORAGE KEY
// =============================================================

const JOURNAL_KEY = "reamal_trade_journal";

// =============================================================
// STATE
// =============================================================

let trades = [];

// =============================================================
// LOAD & SAVE
// =============================================================

function loadTrades() {
  try {
    const saved = localStorage.getItem(JOURNAL_KEY);
    trades = saved ? JSON.parse(saved) : [];
  } catch (e) {
    console.error("Failed to load journal:", e);
    trades = [];
  }
}

function saveTrades() {
  try {
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(trades));
  } catch (e) {
    console.error("Failed to save journal:", e);
    showToast("⚠️ Could not save trade. Storage may be full.", "error");
  }
}

// =============================================================
// ADD TRADE
// =============================================================

function addTrade() {
  const direction = document.getElementById("jDirection")?.value?.trim();
  const entry     = parseFloat(document.getElementById("jEntry")?.value);
  const tp        = parseFloat(document.getElementById("jTP")?.value);
  const sl        = parseFloat(document.getElementById("jSL")?.value);
  const lot       = parseFloat(document.getElementById("jLot")?.value);
  const result    = document.getElementById("jResult")?.value?.trim();
  const pnl       = parseFloat(document.getElementById("jPnL")?.value) || 0;
  const notes     = document.getElementById("jNotes")?.value?.trim() || "";

  // Validation
  if (!direction) {
    showToast("⚠️ Please select a direction (BUY or SELL).", "error");
    return;
  }
  if (isNaN(entry) || entry <= 0) {
    showToast("⚠️ Please enter a valid entry price.", "error");
    document.getElementById("jEntry")?.focus();
    return;
  }

  const trade = {
    id:        Date.now(),
    date:      new Date().toISOString(),
    direction,
    entry:     entry  || 0,
    tp:        tp     || 0,
    sl:        sl     || 0,
    lot:       lot    || 0.01,
    result:    result || "OPEN",
    pnl,
    notes,
  };

  trades.unshift(trade); // Add to top
  saveTrades();
  renderJournalTable();
  renderJournalSummary();
  clearJournalForm();

  showToast("📓 Trade logged successfully!", "success");
}

// =============================================================
// DELETE TRADE
// =============================================================

function deleteTrade(id) {
  if (!confirm("Delete this trade from your journal?")) return;
  trades = trades.filter((t) => t.id !== id);
  saveTrades();
  renderJournalTable();
  renderJournalSummary();
  showToast("🗑 Trade removed.", "info", 2500);
}

// Make deleteTrade globally accessible (called from table HTML)
window.deleteTrade = deleteTrade;

// =============================================================
// CLEAR ALL TRADES
// =============================================================

function clearAllTrades() {
  if (trades.length === 0) {
    showToast("Journal is already empty.", "info", 2000);
    return;
  }
  if (!confirm(`Are you sure you want to delete ALL ${trades.length} trade(s)? This cannot be undone.`)) return;
  trades = [];
  saveTrades();
  renderJournalTable();
  renderJournalSummary();
  showToast("🗑 Journal cleared.", "info");
}

// =============================================================
// CLEAR FORM
// =============================================================

function clearJournalForm() {
  const ids = ["jEntry", "jTP", "jSL", "jLot", "jPnL", "jNotes"];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const dir = document.getElementById("jDirection");
  if (dir) dir.value = "BUY";
  const res = document.getElementById("jResult");
  if (res) res.value = "OPEN";
}

// =============================================================
// FORMAT HELPERS
// =============================================================

function fmtPrice(val) {
  if (!val || isNaN(val)) return "—";
  return parseFloat(val).toFixed(5);
}

function fmtLot(val) {
  if (!val || isNaN(val)) return "—";
  return parseFloat(val).toFixed(2);
}

function fmtPnL(val) {
  if (isNaN(val)) return "—";
  const sign = val >= 0 ? "+" : "";
  return `${sign}$${parseFloat(val).toFixed(2)}`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function resultBadge(result) {
  const map = {
    WIN:  { cls: "win",  label: "WIN"  },
    LOSS: { cls: "loss", label: "LOSS" },
    OPEN: { cls: "open", label: "OPEN" },
    BE:   { cls: "be",   label: "BE"   },
  };
  const r = map[result] || map["OPEN"];
  return `<span class="badge ${r.cls}">${r.label}</span>`;
}

function dirBadge(dir) {
  const cls = dir === "BUY" ? "buy" : "sell";
  return `<span class="badge ${cls}">${dir}</span>`;
}

// =============================================================
// RENDER TABLE
// =============================================================

function renderJournalTable() {
  const tbody     = document.getElementById("journalBody");
  const statsEl   = document.getElementById("journalStats");
  if (!tbody) return;

  if (trades.length === 0) {
    tbody.innerHTML = `
      <tr class="journal-empty-row">
        <td colspan="11">No trades logged yet. Add your first trade above!</td>
      </tr>`;
    if (statsEl) statsEl.textContent = "";
    document.getElementById("journalSummary").style.display = "none";
    return;
  }

  tbody.innerHTML = trades.map((t, i) => {
    const pnlClass = t.pnl > 0
      ? "pnl-positive"
      : t.pnl < 0
      ? "pnl-negative"
      : "";

    return `
      <tr>
        <td>${trades.length - i}</td>
        <td style="font-size:0.68rem;color:var(--text-3)">${fmtDate(t.date)}</td>
        <td>${dirBadge(t.direction)}</td>
        <td>${fmtPrice(t.entry)}</td>
        <td style="color:var(--green)">${fmtPrice(t.tp)}</td>
        <td style="color:var(--red)">${fmtPrice(t.sl)}</td>
        <td>${fmtLot(t.lot)}</td>
        <td>${resultBadge(t.result)}</td>
        <td class="${pnlClass}">${fmtPnL(t.pnl)}</td>
        <td style="color:var(--text-3);font-size:0.72rem;font-family:var(--font-body);max-width:180px;overflow:hidden;text-overflow:ellipsis" title="${escapeHtmlJournal(t.notes)}">${escapeHtmlJournal(t.notes) || "—"}</td>
        <td><button class="del-btn" onclick="deleteTrade(${t.id})" title="Delete trade">✕</button></td>
      </tr>`;
  }).join("");

  if (statsEl) statsEl.textContent = `${trades.length} trade${trades.length !== 1 ? "s" : ""}`;
}

// =============================================================
// RENDER SUMMARY STATS
// =============================================================

function renderJournalSummary() {
  const summaryEl = document.getElementById("journalSummary");
  if (!summaryEl) return;

  if (trades.length === 0) {
    summaryEl.style.display = "none";
    return;
  }

  summaryEl.style.display = "grid";

  const closed  = trades.filter((t) => t.result !== "OPEN");
  const wins    = trades.filter((t) => t.result === "WIN").length;
  const losses  = trades.filter((t) => t.result === "LOSS").length;
  const winRate = closed.length > 0
    ? ((wins / closed.length) * 100).toFixed(1)
    : "0.0";

  const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const pnlValues = trades.map((t) => t.pnl || 0);
  const bestTrade  = Math.max(...pnlValues, 0);
  const worstTrade = Math.min(...pnlValues, 0);

  // Update elements
  setText("sumTotal",   trades.length);
  setText("sumWins",    wins);
  setText("sumLosses",  losses);
  setText("sumWinRate", `${winRate}%`);

  const pnlEl = document.getElementById("sumPnL");
  if (pnlEl) {
    pnlEl.textContent = fmtPnL(totalPnL);
    pnlEl.className   = "summary-value " + (totalPnL >= 0 ? "success" : "danger");
  }

  const winRateEl = document.getElementById("sumWinRate");
  if (winRateEl) {
    const rate = parseFloat(winRate);
    winRateEl.className = "summary-value " +
      (rate >= 55 ? "success" : rate >= 45 ? "" : "danger");
  }

  setText("sumBest",  fmtPnL(bestTrade));
  setText("sumWorst", fmtPnL(worstTrade));
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

// =============================================================
// EXPORT TO CSV
// =============================================================

function exportToCSV() {
  if (trades.length === 0) {
    showToast("📭 No trades to export.", "info");
    return;
  }

  const headers = [
    "#", "Date", "Direction", "Entry", "Take Profit",
    "Stop Loss", "Lot Size", "Result", "P&L (USD)", "Notes"
  ];

  const rows = trades.map((t, i) => [
    trades.length - i,
    fmtDate(t.date),
    t.direction,
    fmtPrice(t.entry),
    fmtPrice(t.tp),
    fmtPrice(t.sl),
    fmtLot(t.lot),
    t.result,
    t.pnl?.toFixed(2) || "0.00",
    `"${(t.notes || "").replace(/"/g, '""')}"`,  // Escape quotes in notes
  ]);

  // Add summary row
  const totalPnL = trades.reduce((s, t) => s + (t.pnl || 0), 0);
  const wins     = trades.filter((t) => t.result === "WIN").length;
  const closed   = trades.filter((t) => t.result !== "OPEN").length;
  const winRate  = closed > 0 ? ((wins / closed) * 100).toFixed(1) : "0.0";

  rows.push([]); // Empty row
  rows.push(["SUMMARY"]);
  rows.push(["Total Trades", trades.length]);
  rows.push(["Wins", wins]);
  rows.push(["Losses", trades.filter((t) => t.result === "LOSS").length]);
  rows.push(["Win Rate", `${winRate}%`]);
  rows.push(["Total P&L", `$${totalPnL.toFixed(2)}`]);
  rows.push(["Exported", new Date().toUTCString()]);

  const csvContent =
    [headers, ...rows]
      .map((row) => row.join(","))
      .join("\n");

  // Create download
  const blob     = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url      = URL.createObjectURL(blob);
  const link     = document.createElement("a");
  const filename = `reamal-trade-journal-${new Date().toISOString().slice(0, 10)}.csv`;

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`⬇️ Exported ${trades.length} trades to ${filename}`, "success");
}

// =============================================================
// AUTO CALCULATE P&L FROM ENTRY/TP/SL WHEN RESULT CHANGES
// =============================================================

function autocalcPnL() {
  const direction = document.getElementById("jDirection")?.value;
  const entry     = parseFloat(document.getElementById("jEntry")?.value);
  const tp        = parseFloat(document.getElementById("jTP")?.value);
  const sl        = parseFloat(document.getElementById("jSL")?.value);
  const lot       = parseFloat(document.getElementById("jLot")?.value) || 0.01;
  const result    = document.getElementById("jResult")?.value;
  const pnlEl     = document.getElementById("jPnL");

  if (!pnlEl || isNaN(entry)) return;
  if (result === "OPEN" || result === "BE") {
    if (result === "BE") pnlEl.value = "0.00";
    return;
  }

  // EUR/USD: 1 pip = 0.0001
  // 1 micro lot (0.01) = $0.10/pip
  // pip value per lot = lot * 10000 (for USD pairs)
  const pipValue = lot * 10; // $ per pip for EUR/USD

  if (result === "WIN" && !isNaN(tp)) {
    const pips = direction === "BUY"
      ? (tp - entry) / 0.0001
      : (entry - tp) / 0.0001;
    pnlEl.value = (pips * pipValue).toFixed(2);
  } else if (result === "LOSS" && !isNaN(sl)) {
    const pips = direction === "BUY"
      ? (sl - entry) / 0.0001
      : (entry - sl) / 0.0001;
    pnlEl.value = (pips * pipValue).toFixed(2);
  }
}

// =============================================================
// HTML ESCAPE (local, for journal content)
// =============================================================

function escapeHtmlJournal(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// =============================================================
// INITIALIZE
// =============================================================

document.addEventListener("DOMContentLoaded", () => {
  // Load saved trades
  loadTrades();
  renderJournalTable();
  renderJournalSummary();

  // Add trade button
  document.getElementById("addTradeBtn")?.addEventListener("click", addTrade);

  // Clear all button
  document.getElementById("clearJournal")?.addEventListener("click", clearAllTrades);

  // Export CSV button
  document.getElementById("exportJournal")?.addEventListener("click", exportToCSV);

  // Auto-calc P&L when result or lot changes
  ["jResult", "jLot", "jEntry", "jTP", "jSL", "jDirection"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", autocalcPnL);
    document.getElementById(id)?.addEventListener("input",  autocalcPnL);
  });

  console.log(`📓 Journal ready — ${trades.length} trade(s) loaded`);
});
