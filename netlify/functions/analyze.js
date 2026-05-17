// =============================================================
// REAMAL Trade — AI Analysis Function (v3)
// Zero npm packages — uses built-in fetch only
// =============================================================

exports.handler = async function(event) {

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors(), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: "Method not allowed" }) };
  }

  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500, headers: cors(),
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY is missing. Add it in Netlify → Site Settings → Environment Variables." })
    };
  }

  var body;
  try { body = JSON.parse(event.body || "{}"); }
  catch(e) { return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: "Invalid request body" }) }; }

  var imageBase64  = body.imageBase64;
  var imageType    = body.imageType    || "image/jpeg";
  var newsContext  = body.newsContext  || "No live news available. Base analysis on chart only.";
  var balance      = parseFloat(body.accountBalance) || 100;
  var riskPct      = parseFloat(body.riskPercent)    || 2;
  var maxLoss      = ((balance * riskPct) / 100).toFixed(2);

  if (!imageBase64) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: "No chart image provided. Please upload a chart." }) };
  }

  // Normalize media type — Anthropic only accepts these 4
  var validTypes = { "image/jpeg": 1, "image/png": 1, "image/gif": 1, "image/webp": 1 };
  if (imageType === "image/jpg") imageType = "image/jpeg";
  if (!validTypes[imageType])    imageType = "image/jpeg";

  // Strip data URL prefix if present
  var cleanB64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/i, "").trim();

  // Build the analysis prompt
  var prompt = [
    "You are REAMAL, an expert professional forex trader and technical analyst with 20+ years experience,",
    "specializing in the EUR/USD currency pair on the 15-minute timeframe.",
    "",
    "Analyze the provided EUR/USD 15-minute chart image and the latest market news below,",
    "then produce a complete, structured trade signal.",
    "",
    "--- LATEST EUR/USD MARKET NEWS ---",
    newsContext,
    "---",
    "",
    "ACCOUNT: Balance $" + balance + " | Risk Per Trade: " + riskPct + "% | Max Loss: $" + maxLoss,
    "",
    "ANALYZE ALL OF THE FOLLOWING IN YOUR RESPONSE:",
    "1. TREND — Overall direction (Bullish/Bearish/Sideways), structure of highs and lows",
    "2. EMA — EMA 9 vs EMA 21: position, crossover, slope and momentum",
    "3. RSI — Reading, zone (overbought >70 / oversold <30 / neutral), any divergence",
    "4. SUPPORT & RESISTANCE — At least 2 key support and 2 resistance levels",
    "5. CANDLESTICK PATTERNS — Pin bar, engulfing, doji, hammer, shooting star etc.",
    "6. CHART PATTERNS — Head & shoulders, double top/bottom, triangle, flag, wedge etc.",
    "7. MARKET STRUCTURE — Break of structure (BOS), change of character (CHoCH), order blocks",
    "8. NEWS SENTIMENT IMPACT — How current news affects this setup",
    "9. CONFLUENCE SCORE — How many signals agree (out of 10). Only recommend trading if 6/10 or higher.",
    "",
    "RESPOND IN EXACTLY THIS FORMAT (use these exact headers):",
    "",
    "## 🔍 MARKET OVERVIEW",
    "[2-3 sentences on current market conditions]",
    "",
    "## 📊 TECHNICAL ANALYSIS",
    "**Trend:** [Bullish/Bearish/Sideways] — [explanation]",
    "**EMA Signal:** [Bullish/Bearish/Neutral] — [EMA 9 vs EMA 21 details]",
    "**RSI:** [estimated value or zone] — [Overbought/Oversold/Neutral]",
    "**Key Support:** [level 1] | [level 2]",
    "**Key Resistance:** [level 1] | [level 2]",
    "**Candlestick Pattern:** [pattern name or None identified]",
    "**Chart Pattern:** [pattern name or None identified]",
    "",
    "## 📰 NEWS IMPACT",
    "[How current news affects the trade — 2 to 3 sentences]",
    "",
    "## 🎯 TRADE SIGNAL",
    "**Direction:** [BUY / SELL / NO TRADE]",
    "**Confidence:** [High / Medium / Low]",
    "**Confluence Score:** [X/10]",
    "",
    "**Entry:** [price level]",
    "**Take Profit 1 (TP1):** [price level] ([X] pips)",
    "**Take Profit 2 (TP2):** [price level] ([X] pips)",
    "**Stop Loss (SL):** [price level] ([X] pips)",
    "**Risk/Reward Ratio:** [1:X]",
    "",
    "## 💰 POSITION SIZE",
    "**Recommended Lot Size:** [X micro lots]",
    "**Max Risk:** $[amount]",
    "**Potential Profit TP1:** $[amount]",
    "**Potential Profit TP2:** $[amount]",
    "",
    "## ⚠️ TRADE MANAGEMENT",
    "1. [Specific rule for this setup]",
    "2. [When to move SL to breakeven]",
    "3. [When to take partial profits at TP1]",
    "",
    "## 🚦 FINAL VERDICT",
    "[One clear paragraph: should you take this trade, wait, or avoid it? Give specific reasoning.]",
    "",
    "RULES: If confluence score is below 6/10, the Direction MUST be NO TRADE.",
    "Always prioritize protecting capital over chasing profits."
  ].join("\n");

  try {
    var response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":    "application/json",
        "x-api-key":       apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model:      "claude-sonnet-4-20250514",
        max_tokens: 1500,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type:       "base64",
                media_type: imageType,
                data:       cleanB64
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

    var data = await response.json();

    if (!response.ok) {
      var msg = (data && data.error && data.error.message) || "API error " + response.status;
      console.error("Anthropic error:", response.status, msg);
      if (response.status === 401) msg = "Invalid API key. Go to Netlify → Environment Variables and check your ANTHROPIC_API_KEY.";
      if (response.status === 429) msg = "API rate limit reached. Please wait 30 seconds and try again.";
      if (response.status === 400) msg = "The chart image could not be processed. Please try taking a new screenshot.";
      return { statusCode: response.status, headers: cors(), body: JSON.stringify({ error: msg }) };
    }

    var analysis = (data.content || [])
      .filter(function(b) { return b.type === "text"; })
      .map(function(b) { return b.text; })
      .join("\n");

    return {
      statusCode: 200,
      headers: cors(),
      body: JSON.stringify({
        success:   true,
        analysis:  analysis,
        signal:    extractSignal(analysis),
        timestamp: new Date().toISOString()
      })
    };

  } catch(err) {
    console.error("Analyze function error:", err.message);
    return {
      statusCode: 500, headers: cors(),
      body: JSON.stringify({ error: "Server error: " + err.message })
    };
  }
};

function extractSignal(text) {
  var s = { direction:"UNKNOWN", confidence:"Unknown", confluenceScore:"N/A",
            entry:"See analysis", tp1:"See analysis", tp2:"See analysis",
            sl:"See analysis", riskReward:"See analysis" };
  try {
    var m;
    m = text.match(/\*\*Direction:\*\*\s*(BUY|SELL|NO TRADE)/i); if(m) s.direction = m[1].toUpperCase();
    m = text.match(/\*\*Confidence:\*\*\s*(High|Medium|Low)/i);  if(m) s.confidence = m[1];
    m = text.match(/\*\*Confluence Score:\*\*\s*(\d+\/\d+)/i);   if(m) s.confluenceScore = m[1];
    m = text.match(/\*\*Entry:\*\*\s*([^\n]+)/i);                if(m) s.entry = m[1].trim();
    m = text.match(/\*\*Take Profit 1[^:]*:\*\*\s*([^\n]+)/i);  if(m) s.tp1 = m[1].trim();
    m = text.match(/\*\*Take Profit 2[^:]*:\*\*\s*([^\n]+)/i);  if(m) s.tp2 = m[1].trim();
    m = text.match(/\*\*Stop Loss[^:]*:\*\*\s*([^\n]+)/i);       if(m) s.sl = m[1].trim();
    m = text.match(/\*\*Risk\/Reward Ratio:\*\*\s*([^\n]+)/i);   if(m) s.riskReward = m[1].trim();
  } catch(e) {}
  return s;
}

function cors() {
  return {
    "Access-Control-Allow-Origin":  "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type":                 "application/json"
  };
}
