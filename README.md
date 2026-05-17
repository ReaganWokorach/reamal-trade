# REAMAL Trade

> AI-powered EUR/USD Forex Analysis Website — Upload your chart, get real-time AI analysis, live news, and trade signals. Hosted 100% free on Netlify.

---

## Features

- 📸 **Chart Image Analysis** — Upload or paste screenshots from TradingView, Exness, MT5, and more
- 📰 **Live Forex News** — Auto-fetches EUR/USD news from FXStreet, DailyFX, and Reuters
- 🤖 **AI Trade Signals** — Entry, Take Profit, Stop Loss, and Risk/Reward powered by Claude AI
- 📊 **Multi-Strategy Algorithms** — EMA crossover, RSI, Support/Resistance, Candlestick patterns
- 📓 **Trade Journal** — Log, track, and review every trade you make
- ⚠️  **Risk Manager** — Auto-calculates safe lot sizes based on your account balance
- 🌐 **15-Minute Timeframe Optimized** — Built specifically for short-term EUR/USD trading

---

## Project Structure

```
reamal-trade/
├── README.md
├── .env.example                        # API key template
├── netlify.toml                        # Netlify configuration
├── package.json                        # Node.js dependencies for functions
│
├── netlify/functions/                  # Serverless backend functions
│   ├── analyze.js                      # Claude AI chart + news analysis
│   └── news.js                         # Live forex news fetcher (RSS)
│
└── public/                             # Static website files
    ├── index.html                      # Main HTML page
    ├── css/
    │   └── style.css                   # All styling
    └── js/
        ├── app.js                      # Main app logic & initialization
        ├── uploader.js                 # Chart image drag & drop / paste
        ├── analysis.js                 # AI result display
        ├── news.js                     # News panel logic
        └── journal.js                  # Trade journal logic
```

---

## ⚙️ Requirements

- A free [Netlify account](https://netlify.com)
- A free [Anthropic API key](https://console.anthropic.com) — free credits given to new accounts
- A free [GitHub account](https://github.com) — to connect with Netlify for deployment

---

## Setup Instructions

### 1. Clone or Download the Repository
```bash
git clone https://github.com/YOUR_USERNAME/reamal-trade.git
cd reamal-trade
```

### 2. Install Dependencies (for Netlify Functions)
```bash
npm install
```

### 3. Add Your API Key
```bash
cp .env.example .env
# Open .env and paste your ANTHROPIC_API_KEY
```

### 4. Run Locally (Optional)
```bash
npm install -g netlify-cli
netlify dev
```
Visit: [http://localhost:8888](http://localhost:8888)

---

## Deploy to Netlify (Free)

### Option A — Deploy via GitHub (Recommended)
1. Push your project to a GitHub repository
2. Go to [netlify.com](https://netlify.com) → **Add new site** → **Import from Git**
3. Select your repository
4. Set **Publish directory** to `public`
5. Go to **Site settings → Environment variables**
6. Add: `ANTHROPIC_API_KEY` = your key
7. Click **Deploy** — your site will be live in seconds!

### Option B — Drag & Drop Deploy
1. Go to [netlify.com](https://netlify.com)
2. Drag your `reamal-trade` folder onto the Netlify dashboard
3. Add your API key in Site settings → Environment variables

---

## How to Use

1. **Open your REAMAL Trade website**
2. **Check the News Panel** — review the latest EUR/USD news and market sentiment
3. **Set your account balance** in the Risk Manager
4. **Take a screenshot** of your chart from TradingView, Exness, or MT5 (use 15M timeframe)
5. **Upload or paste the chart image** into the upload area
6. **Click Analyze** — AI reads chart + news and produces a trade signal
7. **Review the signal** — Entry price, Take Profit, Stop Loss, Risk/Reward ratio
8. **Log your trade** in the Trade Journal to track your results

---

## Risk Disclaimer

> REAMAL Trade is an **educational and analytical tool only**. It does **not** guarantee profits. Forex trading involves significant risk of loss. Always use a **demo account** first, never risk money you cannot afford to lose, and apply proper risk management (max 1–2% of account per trade). Past performance does not guarantee future results.

---

## 🛠️ Built With

- **HTML, CSS, JavaScript** — Pure frontend, no frameworks
- **Netlify Functions (Node.js)** — Secure serverless backend
- **Claude AI (Anthropic)** — Chart image analysis engine
- **RSS Feeds** — Live forex news (no paid API needed)

---

## Author

**REAMAL Trade (Reagan & Maloyo) ** — Built for EUR/USD 15-minute forex analysis

---

## License

MIT License — Free to use, modify, and distribute.
