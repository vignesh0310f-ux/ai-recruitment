# AI Recruitment Intelligence Platform

## Deploy to Vercel (get live URL in 3 minutes)

### Option A — Drag & Drop (easiest)
1. Go to https://vercel.com/new
2. Click "Browse" and upload this entire folder as a zip
3. Click Deploy → get your URL like `ai-recruitment.vercel.app`

### Option B — GitHub (recommended)
1. Go to github.com → New repository → name it `ai-recruitment`
2. Upload all these files
3. Go to vercel.com → Import Git Repository → select `ai-recruitment`
4. Click Deploy → done ✅

## Environment Variable (REQUIRED)
In Vercel dashboard → Settings → Environment Variables:
- Name: `VITE_ANTHROPIC_API_KEY`
- Value: your Anthropic API key from console.anthropic.com

Then add this line to `src/App.jsx` in the `callClaude` function headers:
```
"x-api-key": import.meta.env.VITE_ANTHROPIC_API_KEY,
"anthropic-version": "2023-06-01",
"anthropic-dangerous-direct-browser-access": "true",
```

## Share test links
Once deployed, share:
`https://your-app.vercel.app`

Candidates open it, enter their name, take the test — results go to your dashboard.
