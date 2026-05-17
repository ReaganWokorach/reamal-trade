// =============================================================
// REAMAL Trade — AI Analysis Function (v4 - Final)
// =============================================================

exports.handler = async function(event) {

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: cors(), body: "" };
  }
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers: cors(), body: JSON.stringify({ error: "Method not allowed" }) };
  }

  var apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return {
      statusCode: 500, headers: cors(),
      body: JSON.stringify({ error: "ANTHROPIC_API_KEY is missing in Netlify environment variables." })
    };
  }

  var body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch(e) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: "Invalid JSON in request" }) };
  }

  var imageBase64  = (body.imageBase64 || "").trim();
  var imageType    = body.imageType    || "image/jpeg";
  var newsContext  = body.newsContext  || "No live news available. Base analysis on chart only.";
  var balance      = parseFloat(body.accountBalance) || 100;
  var riskPct      = parseFloat(body.riskPercent)    || 2;
  var maxLoss      = ((balance * riskPct) / 100).toFixed(2);

  if (!imageBase64) {
    return { statusCode: 400, headers: cors(), body: JSON.stringify({ error: "No chart image received by server." }) };
  }

  // Strip data URL prefix if accidentally included
  imageBase64 = imageBase64.replace(/^data:image\/[a-z+]+;base64,/i, "");
  // Remove any whitespace/newlines from base64 string
  imageBase64 = imageBase64.replace(/[\s\r\n]/g, "");

  // Normalize to a valid Anthropic media type
  if (imageType === "image/jpg")  imageType = "image/jpeg";
  if (imageType === "image/tiff") imageType = "image/jpeg";
  if (!["image/jpeg","image/png","image/gif","image/webp"].includes(imageType)) {
    imageType = "image/jpeg";
  }

  // Safety check — base64 length (rough byte estimate)
  // Anthropic limit is ~5MB decoded. base64 is ~1.33x the decoded size.
  // So max base64 length ≈ 5MB * 1.33 = ~6.6M chars. We limit to 4M to be safe.
  if (imageBase64.length > 4000000) {
    return {
      statusCode: 400, headers: cors(),
      body: JSON.stringify({ error: "Image is still too large after compression. Please take a smaller screenshot (crop to just the chart area)." })
    };
  }

  var prompt = [
    "You are REAMAL, an expert professional forex trader and technical analyst with 20+ years experience,",
    "specializing in EUR/USD on the 15-minute timeframe.",
    "",
    "Carefully analyze the provided EUR/USD chart image and the market news below.",
    "Produce a complete, structured trade signal.",
    "",
    "--- LATEST EUR/USD MARKET NEWS ---",
    newsContext,
    "---",
    "",
    "ACCOUNT: Balance $" + balance + " | Risk: " + riskPct + "% | Max Loss Per Trade: $" + maxLoss,
    "",
    "ANALYZE ALL OF THE FOLLOWING:",
    "1. TREND — Bullish / Bearish / Sideways. Higher highs/lows or lower highs/lows.",
    "2. EMA — EMA 9 vs EMA 21 crossover, position relative to price, slope.",
    "3. RSI — Reading and zone: Overbought (>70) / Oversold (<30) / Neutral. Any divergence.",
    "4. SUPPORT & RESISTANCE — At least 2 key support and 2 key resistance levels.",
    "5. CANDLESTICK PATTERNS — Pin bar, engulfing, doji, hammer, shooting star, etc.",
    "6. CHART PATTERNS — Triangle, flag, head & shoulders, double top/bottom, wedge, etc.",
    "7. MARKET STRUCTURE — Break of structure (BOS), change of character (CHoCH).",
    "8. NEWS IMPACT — How does current news affect this setup?",
    "9. CONFLUENCE SCORE — Out of 10. Only recommend trading if score is 6/10 or higher.",
    "",
    "USE EXACTLY THIS FORMAT (copy the headers precisely):",
    "",
    "## 🔍 MARKET OVERVIEW",
    "[2-3 sentences describing current market conditions]",
    "",
    "## 📊 TECHNICAL ANALYSIS",
    "**Trend:** [Bullish/Bearish/Sideways] — [brief explanation]",
    "**EMA Signal:** [Bullish/Bearish/Neutral] — [EMA 9 vs 21 details]",
    "**RSI:** [value or zone] — [Overbought/Oversold/Neutral + notes]",
    "**Key Support:** [level 1] | [level 2]",
    "**Key Resistance:** [level 1] | [level 2]",
    "**Candlestick Pattern:** [pattern name or None identified]",
    "**Chart Pattern:** [pattern name or None identified]",
    "",
    "## 📰 NEWS IMPACT",
    "[How current news affects this trade setup]",
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
    "1. [Entry rule for this setup]",
    "2. [When to move SL to breakeven]",
    "3. [When to take partial profits at TP1]",
    "",
    "## 🚦 FINAL VERDICT",
    "[Clear paragraph: take this trade, wait, or avoid? Give specific reasoning.]",
    "",
    "CRITICAL RULE: If confluence score is below 6/10, Direction MUST be NO TRADE."
  ].join("\n");

  try {
    var apiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         apiKey.trim(),
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model:      "claude-3-5-sonnet-20241022",
        max_tokens: 1500,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type:       "base64",
                media_type: imageType,
                data:       imageBase64
              }
            },
            { type: "text", text: prompt }
          ]
        }]
      })
    });

    var responseText = await apiResponse.text();
    var data;
    try { data = JSON.parse(responseText); }
    catch(e) {
      console.error("Non-JSON response from Anthropic:", responseText.slice(0, 300));
      return { statusCode: 502, headers: cors(), body: JSON.stringify({ error: "Unexpected response from AI server. Please try again." }) };
    }

    if (!apiResponse.ok) {
      var errMsg = (data && data.error && data.error.message) || ("API returned status " + apiResponse.status);
      console.error("Anthropic API error:", apiResponse.status, errMsg);

      // Human-readable messages for common errors
      if (apiResponse.status === 401) errMsg = "Invalid API key. Go to Netlify Site Settings → Environment Variables and re-enter your ANTHROPIC_API_KEY.";
      if (apiResponse.status === 429) errMsg = "You have hit the API rate limit. Wait 60 seconds and try again.";
      if (apiResponse.status === 400) errMsg = "The AI rejected the request (400). Details: " + errMsg;
      if (apiResponse.status === 529) errMsg = "Anthropic servers are overloaded. Try again in a moment.";

      return { statusCode: apiResponse.status, headers: cors(), body: JSON.stringify({ error: errMsg }) };
    }

    var analysis = (data.content || [])
      .filter(function(b) { return b.type === "text"; })
      .map(function(b) { return b.text; })
      .join("\n");

    if (!analysis) {
      return { statusCode: 500, headers: cors(), body: JSON.stringify({ error: "AI returned an empty response. Please try again." }) };
    }

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
    console.error("Function crash:", err.message);
    return {
      statusCode: 500, headers: cors(),
      body: JSON.stringify({ error: "Server error: " + err.message })
    };
  }
};

function extractSignal(text) {
  var s = {
    direction: "UNKNOWN", confidence: "Unknown", confluenceScore: "N/A",
    entry: "See analysis", tp1: "See analysis", tp2: "See analysis",
    sl: "See analysis", riskReward: "See analysis"
  };
  try {
    var m;
    m = text.match(/\*\*Direction:\*\*\s*(BUY|SELL|NO TRADE)/i);           if(m) s.direction      = m[1].toUpperCase();
    m = text.match(/\*\*Confidence:\*\*\s*(High|Medium|Low)/i);            if(m) s.confidence     = m[1];
    m = text.match(/\*\*Confluence Score:\*\*\s*(\d+\/\d+)/i);             if(m) s.confluenceScore= m[1];
    m = text.match(/\*\*Entry:\*\*\s*([^\n\r]+)/i);                        if(m) s.entry          = m[1].trim();
    m = text.match(/\*\*Take Profit 1[^:]*:\*\*\s*([^\n\r]+)/i);          if(m) s.tp1            = m[1].trim();
    m = text.match(/\*\*Take Profit 2[^:]*:\*\*\s*([^\n\r]+)/i);          if(m) s.tp2            = m[1].trim();
    m = text.match(/\*\*Stop Loss[^:]*:\*\*\s*([^\n\r]+)/i);              if(m) s.sl             = m[1].trim();
    m = text.match(/\*\*Risk\/Reward Ratio:\*\*\s*([^\n\r]+)/i);          if(m) s.riskReward     = m[1].trim();
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
