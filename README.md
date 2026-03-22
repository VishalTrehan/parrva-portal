# CarePaRRVA Trade Submission Portal

A web-based portal for Research Analysts and Investment Advisers to submit
trade recommendations to PARRVA (CarePaRRVA / NSE PDC) — no local software required.

## What it does
- Encrypts credentials using PARRVA RSA-OAEP-256 public key → generates auth token
- Encrypts trade payload using PDC RSA public key → submits to correct PDC endpoint
- Supports: Intraday, Single Stock, Derivative, Strategy, Algo Input APIs
- Auto-routes iainput vs rainput based on enrolment ID prefix (IA vs RA)

## Files
```
parrva_app/
├── server.js          ← Node.js backend (handles encryption + proxy)
├── package.json       ← Dependencies
├── render.yaml        ← Render.com deployment config
└── public/
    └── index.html     ← Complete frontend UI
```

---

## Deploy for FREE on Render.com (Recommended)

**Step 1:** Create a free account at https://render.com

**Step 2:** Upload these files to a GitHub repository
- Go to https://github.com → New repository → Upload all files from this folder

**Step 3:** Connect to Render
- In Render dashboard → "New +" → "Web Service"
- Connect your GitHub repository
- Render auto-detects `render.yaml` and configures everything
- Click "Create Web Service"

**Step 4:** Your portal is live!
- Render gives you a free URL like: `https://parrva-portal.onrender.com`
- Share this URL with your clients — no installation needed anywhere

---

## Alternative: Deploy on Railway.app

**Step 1:** Go to https://railway.app → New Project → Deploy from GitHub
**Step 2:** Connect your repository
**Step 3:** Railway auto-detects Node.js and deploys
**Step 4:** Get your public URL from the Railway dashboard

---

## For Subscription / Multi-user SaaS

To offer this as a subscription service to other Research Analysts:
1. Deploy on Render/Railway (free tier works for pilot)
2. Each RA/IA uses their own PARRVA credentials — no shared login needed
3. For paid plans, add login middleware (ask developer to add auth)

---

## Dependencies
- express: Web server framework
- node-jose: JWE encryption (RSA-OAEP-256 + A256GCM)
- node-fetch: HTTP requests to PARRVA servers

All installed automatically on deployment via `npm install`.
