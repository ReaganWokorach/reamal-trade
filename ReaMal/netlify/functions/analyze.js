// =============================================================
// REAMAL Trade — AI Analysis Function
// File: netlify/functions/analyze.js
// =============================================================
// This function receives a chart image + news context,
// sends it to Claude AI with a powerful forex analysis prompt,
// and returns a full trade signal with Entry, TP, SL, and
// strategy breakdown.
// =============================================================

import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS || "1500");

// =============================================================
// MASTER FOREX ANALYSIS PROMPT
// =============================================================
// This prompt instructs Claude to act as a professional forex
// analyst and apply multiple strategies to the chart image.
// =============================================================

function buildAnalysisPrompt(newsContext, accountBalance, riskPercent) {
  return `You are REAMAL, an expert professional forex trader and technical analyst specializing in the EUR/USD currency pair on the 15-minute timeframe. You have 20+ years of experience and use a combination of technical analysis, price action, and market sentiment.

Analyze the provided EUR/USD 15-minute chart image and the latest market news below, then produce a complete, structured trade signal.

---
LATEST EUR/USD MARKET NEWS & SENTIMENT:
${newsContext || "No live news available at this time. Base analysis on chart only."}
---

ACCOUNT DETAILS FOR RISK MANAGEMENT:
- Account Balance: $${accountBalance || 100}
- Max Risk Per Trade: ${riskPercent || 2}%
- Max Loss Per Trade: $${(((accountBalance || 100) * (riskPercent || 2)) / 100).toFixed(2)}

---
YOUR ANALYSIS MUST COVER ALL OF THE FOLLOWING:

1. TREND ANALYSIS
   - Overall trend direction (Bullish / Bearish / Sideways)
   - Identify higher highs & higher lows OR lower highs & lower lows
   - Multi-timeframe bias if visible

2. EMA ANALYSIS
   - EMA 9 vs EMA 21 position and crossover signals
   - Price position relative to EMAs
   - EMA slope and momentum

3. RSI ANALYSIS
   - RSI reading and zone (Overbought >70 / Oversold <30 / Neutral)
   - RSI divergence (bullish or bearish) if present
   - RSI trend confirmation

4. SUPPORT & RESISTANCE
   - Identify key support levels (at least 2)
   - Identify key resistance levels (at least 2)
   - Note any recent breakouts or retests

5. CANDLESTICK PATTERNS
   - Identify any significant candlestick patterns visible
   - Examples: Pin Bar, Engulfing, Doji, Morning/Evening Star, Hammer, Shooting Star
   - Rate the pattern reliability (Strong / Moderate / Weak)

6. CHART PATTERNS
   - Identify any major chart patterns
   - Examples: Head & Shoulders, Double Top/Bottom, Triangle, Flag, Wedge, Channel
   - Note the pattern completion status

7. MARKET STRUCTURE
   - Break of Structure (BOS) or Change of Character (CHoCH) if visible
   - Order blocks or fair value gaps if identifiable
   - Supply and demand zones

8. NEWS SENTIMENT IMPACT
   - How does the current news affect this trade setup?
   - Any high-impact events to watch out for?
   - Overall fundamental bias (Bullish USD / Bearish USD / Neutral)

9. SIGNAL CONFLUENCE SCORE
   - Rate how many signals agree on the direction (out of 10)
   - Only recommend trading if score is 6/10 or higher

---
TRADE SIGNAL OUTPUT FORMAT (use exactly this format):

## 🔍 MARKET OVERVIEW
[2-3 sentences summarizing current market conditions]

## 📊 TECHNICAL ANALYSIS

**Trend:** [Bullish/Bearish/Sideways] — [brief explanation]
**EMA Signal:** [Bullish/Bearish/Neutral] — [EMA 9 vs EMA 21 status]
**RSI:** [value if visible, or estimated zone] — [Overbought/Oversold/Neutral]
**Key Support:** [level 1] | [level 2]
**Key Resistance:** [level 1] | [level 2]
**Candlestick Pattern:** [pattern name or "None identified"]
**Chart Pattern:** [pattern name or "None identified"]

## 📰 NEWS IMPACT
[How current news affects the trade — 2-3 sentences]

## 🎯 TRADE SIGNAL

**Direction:** [BUY / SELL / NO TRADE]
**Confidence:** [High / Medium / Low]
**Confluence Score:** [X/10]

**Entry:** [price level or "Wait for [condition]"]
**Take Profit 1 (TP1):** [price level] ([X] pips)
**Take Profit 2 (TP2):** [price level] ([X] pips)
**Stop Loss (SL):** [price level] ([X] pips)
**Risk/Reward Ratio:** [1:X]

## 💰 POSITION SIZE (Risk Management)
**Recommended Lot Size:** [X micro lots / X mini lots]
**Max Risk:** $[amount] ([X]% of account)
**Potential Profit TP1:** $[amount]
**Potential Profit TP2:** $[amount]

## ⚠️ TRADE MANAGEMENT RULES
1. [Specific rule for this trade setup]
2. [When to move SL to breakeven]
3. [When to take partial profits]

## 🚦 FINAL VERDICT
[One clear paragraph: should you take this trade, wait, or avoid? Give specific reasoning based on the confluence of signals and news.]

---
IMPORTANT RULES:
- If confluence score is below 6/10, signal must be NO TRADE
- Always prioritize capital protection over profit
- If news creates uncertainty, lower the confidence rating
- Be specific with price levels — use exact numbers where visible
- If the chart is unclear or low quality, say so and ask for a better screenshot`;
}

// =============================================================
// MAIN HANDLER
// =============================================================

export const handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ error: "Method not allowed. Use POST." }),
    };
  }

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: corsHeaders(), body: "" };
  }

  try {
    // Parse request body
    const body = JSON.parse(event.body || "{}");
    const { imageBase64, imageType, newsContext, accountBalance, riskPercent } = body;

    // Validate image is provided
    if (!imageBase64) {
      return {
        statusCode: 400,
        headers: corsHeaders(),
        body: JSON.stringify({
          error: "No chart image provided. Please upload a chart screenshot.",
        }),
      };
    }

    // Validate API key
    if (!process.env.ANTHROPIC_API_KEY) {
      return {
        statusCode: 500,
        headers: corsHeaders(),
        body: JSON.stringify({
          error: "API key not configured. Please add ANTHROPIC_API_KEY in Netlify environment variables.",
        }),
      };
    }

    // Clean base64 string (remove data URL prefix if present)
    const cleanBase64 = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
    const mediaType = imageType || "image/png";

    // Build the analysis prompt
    const prompt = buildAnalysisPrompt(newsContext, accountBalance, riskPercent);

    // Call Claude AI with the chart image
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: cleanBase64,
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    });

    // Extract the analysis text
    const analysis = response.content
      .filter((block) => block.type === "text")
      .map((block) => block.text)
      .join("\n");

    // Extract key signal data for structured display
    const signal = extractSignal(analysis);

    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: JSON.stringify({
        success: true,
        analysis,
        signal,
        timestamp: new Date().toISOString(),
        model: MODEL,
      }),
    };
  } catch (error) {
    console.error("Analysis error:", error);

    // Handle specific Anthropic errors
    if (error.status === 401) {
      return {
        statusCode: 401,
        headers: corsHeaders(),
        body: JSON.stringify({
          error: "Invalid API key. Please check your ANTHROPIC_API_KEY in Netlify settings.",
        }),
      };
    }

    if (error.status === 429) {
      return {
        statusCode: 429,
        headers: corsHeaders(),
        body: JSON.stringify({
          error: "API rate limit reached. Please wait a moment and try again.",
        }),
      };
    }

    return {
      statusCode: 500,
      headers: corsHeaders(),
      body: JSON.stringify({
        error: "Analysis failed. Please try again.",
        details: error.message,
      }),
    };
  }
};

// =============================================================
// SIGNAL EXTRACTOR
// Parses key values from AI response for structured display
// =============================================================

function extractSignal(analysis) {
  const signal = {
    direction: "UNKNOWN",
    confidence: "Unknown",
    confluenceScore: "N/A",
    entry: "See analysis",
    tp1: "See analysis",
    tp2: "See analysis",
    sl: "See analysis",
    riskReward: "See analysis",
  };

  try {
    // Extract direction
    const dirMatch = analysis.match(/\*\*Direction:\*\*\s*(BUY|SELL|NO TRADE)/i);
    if (dirMatch) signal.direction = dirMatch[1].toUpperCase();

    // Extract confidence
    const confMatch = analysis.match(/\*\*Confidence:\*\*\s*(High|Medium|Low)/i);
    if (confMatch) signal.confidence = confMatch[1];

    // Extract confluence score
    const scoreMatch = analysis.match(/\*\*Confluence Score:\*\*\s*(\d+\/\d+)/i);
    if (scoreMatch) signal.confluenceScore = scoreMatch[1];

    // Extract entry
    const entryMatch = analysis.match(/\*\*Entry:\*\*\s*([^\n]+)/i);
    if (entryMatch) signal.entry = entryMatch[1].trim();

    // Extract TP1
    const tp1Match = analysis.match(/\*\*Take Profit 1[^:]*:\*\*\s*([^\n]+)/i);
    if (tp1Match) signal.tp1 = tp1Match[1].trim();

    // Extract TP2
    const tp2Match = analysis.match(/\*\*Take Profit 2[^:]*:\*\*\s*([^\n]+)/i);
    if (tp2Match) signal.tp2 = tp2Match[1].trim();

    // Extract SL
    const slMatch = analysis.match(/\*\*Stop Loss[^:]*:\*\*\s*([^\n]+)/i);
    if (slMatch) signal.sl = slMatch[1].trim();

    // Extract R:R
    const rrMatch = analysis.match(/\*\*Risk\/Reward Ratio:\*\*\s*([^\n]+)/i);
    if (rrMatch) signal.riskReward = rrMatch[1].trim();
  } catch (e) {
    console.error("Signal extraction error:", e);
  }

  return signal;
}

// =============================================================
// CORS HEADERS
// =============================================================

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}
