// =============================================================
// REAMAL Trade — AI Analysis Function
// Uses built-in fetch only — zero npm packages required
// =============================================================

exports.handler = async function(event) {

  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors(), body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: "Method not allowed" }) };
  }

  // Check API key first
  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500, headers: cors(),
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY is not set. Go to Netlify → Site Settings → Environment Variables and add it." })
    };
  }

  var body;
  try { body = JSON.parse(event.body || "{}"); }
  catch(e) { return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: "Invalid request body" }) }; }

  var imageBase64  = body.imageBase64;
  var imageType    = body.imageType    || "image/png";
  var newsContext  = body.newsContext  || "No news available.";
  var balance      = body.accountBalance || 100;
  var riskPct      = body.riskPercent    || 2;
  var maxLoss      = ((balance * riskPct) / 100).toFixed(2);

  if (!imageBase64) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: "No chart image provided" }) };
  }

  // Clean base64 string
  var cleanB64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");

  // Build prompt
  var prompt = "You are REAMAL, an expert professional forex trader specializing in EUR/USD on the 15-minute timeframe.\n\n"
    + "Analyze the provided EUR/USD 15-minute chart image and the latest market news, then produce a complete trade signal.\n\n"
    + "LATEST EUR/USD MARKET NEWS:\n" + newsContext + "\n\n"
    + "ACCOUNT: Balance $" + balance + " | Max Risk Per Trade: " + riskPct + "% | Max Loss: $" + maxLoss + "\n\n"
    + "ANALYZE ALL OF THE FOLLOWING:\n"
    + "1. TREND - Overall direction (Bullish/Bearish/Sideways), higher highs/lows\n"
    + "2. EMA - EMA 9 vs EMA 21 crossover signals and price position\n"
    + "3. RSI - Reading, zone (overbought >70 / oversold <30), divergence\n"
    + "4. SUPPORT & RESISTANCE - At least 2 key levels each\n"
    + "5. CANDLESTICK PATTERNS - Pin bar, engulfing, doji, hammer etc.\n"
    + "6. CHART PATTERNS - Head & shoulders, triangles, flags, wedges etc.\n"
    + "7. MARKET STRUCTURE - Break of structure, order blocks, supply/demand zones\n"
    + "8. NEWS IMPACT - How current news affects the setup\n"
    + "9. CONFLUENCE SCORE - Out of 10 (only trade if 6/10 or higher)\n\n"
    + "RESPOND IN EXACTLY THIS FORMAT:\n\n"
    + "## 🔍 MARKET OVERVIEW\n[2-3 sentences on current conditions]\n\n"
    + "## 📊 TECHNICAL ANALYSIS\n"
    + "**Trend:** [Bullish/Bearish/Sideways] — [explanation]\n"
    + "**EMA Signal:** [Bullish/Bearish/Neutral] — [EMA 9 vs 21 status]\n"
    + "**RSI:** [value/zone] — [Overbought/Oversold/Neutral]\n"
    + "**Key Support:** [level 1] | [level 2]\n"
    + "**Key Resistance:** [level 1] | [level 2]\n"
    + "**Candlestick Pattern:** [name or None identified]\n"
    + "**Chart Pattern:** [name or None identified]\n\n"
    + "## 📰 NEWS IMPACT\n[How news affects the trade]\n\n"
    + "## 🎯 TRADE SIGNAL\n"
    + "**Direction:** [BUY / SELL / NO TRADE]\n"
    + "**Confidence:** [High / Medium / Low]\n"
    + "**Confluence Score:** [X/10]\n\n"
    + "**Entry:** [price level]\n"
    + "**Take Profit 1 (TP1):** [price level] ([X] pips)\n"
    + "**Take Profit 2 (TP2):** [price level] ([X] pips)\n"
    + "**Stop Loss (SL):** [price level] ([X] pips)\n"
    + "**Risk/Reward Ratio:** [1:X]\n\n"
    + "## 💰 POSITION SIZE\n"
    + "**Recommended Lot Size:** [X micro lots]\n"
    + "**Max Risk:** $[amount]\n"
    + "**Potential Profit TP1:** $[amount]\n"
    + "**Potential Profit TP2:** $[amount]\n\n"
    + "## ⚠️ TRADE MANAGEMENT\n"
    + "1. [Rule for this setup]\n"
    + "2. [When to move SL to breakeven]\n"
    + "3. [When to take partial profits]\n\n"
    + "## 🚦 FINAL VERDICT\n"
    + "[One clear paragraph: should you take this trade, wait, or avoid?]\n\n"
    + "IMPORTANT: If confluence score < 6/10, signal MUST be NO TRADE.";

  try {
    // Call Anthropic API directly — no SDK needed
    var response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: imageType,
                data: cleanB64
              }
            },
            {
              type: "text",
              text: prompt
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      var errData = await response.json();
      var errMsg = (errData && errData.error && errData.error.message) || "Anthropic API error " + response.status;

      // Give helpful message for common errors
      if (response.status === 401) errMsg = "Invalid API key. Check your ANTHROPIC_API_KEY in Netlify environment variables.";
      if (response.status === 429) errMsg = "API rate limit reached. Please wait a moment and try again.";
      if (response.status === 400) errMsg = "Bad request to AI. The image may be too large or corrupted. Try a smaller screenshot.";

      return { statusCode: response.status, headers: cors(), body: JSON.stringify({ error: errMsg }) };
    }

    var data = await response.json();
    var analysis = data.content
      .filter(function(b) { return b.type === "text"; })
      .map(function(b) { return b.text; })
      .join("\n");

    // Extract key signal values from the analysis text
    var signal = extractSignal(analysis);

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({
        success: true,
        analysis: analysis,
        signal: signal,
        timestamp: new Date().toISOString()
      })
    };

  } catch(err) {
    console.error("Analysis error:", err.message);
    return {
      statusCode: 500,
      headers: cors(),
      body: JSON.stringify({ error: "Analysis failed: " + err.message })
    };
  }
};

function extractSignal(text) {
  var signal = {
    direction: "UNKNOWN", confidence: "Unknown",
    confluenceScore: "N/A", entry: "See analysis",
    tp1: "See analysis", tp2: "See analysis",
    sl: "See analysis", riskReward: "See analysis"
  };
  try {
    var dm = text.match(/\*\*Direction:\*\*\s*(BUY|SELL|NO TRADE)/i);
    if (dm) signal.direction = dm[1].toUpperCase();
    var cm = text.match(/\*\*Confidence:\*\*\s*(High|Medium|Low)/i);
    if (cm) signal.confidence = cm[1];
    var sm = text.match(/\*\*Confluence Score:\*\*\s*(\d+\/\d+)/i);
    if (sm) signal.confluenceScore = sm[1];
    var em = text.match(/\*\*Entry:\*\*\s*([^\n]+)/i);
    if (em) signal.entry = em[1].trim();
    var t1 = text.match(/\*\*Take Profit 1[^:]*:\*\*\s*([^\n]+)/i);
    if (t1) signal.tp1 = t1[1].trim();
    var t2 = text.match(/\*\*Take Profit 2[^:]*:\*\*\s*([^\n]+)/i);
    if (t2) signal.tp2 = t2[1].trim();
    var sl = text.match(/\*\*Stop Loss[^:]*:\*\*\s*([^\n]+)/i);
    if (sl) signal.sl = sl[1].trim();
    var rr = text.match(/\*\*Risk\/Reward Ratio:\*\*\s*([^\n]+)/i);
    if (rr) signal.riskReward = rr[1].trim();
  } catch(e) {}
  return signal;
}

function cors() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json"
  };
}
