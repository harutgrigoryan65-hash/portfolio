# Harutyun Grigoryan Portfolio

Static engineering portfolio focused on production AI automation, backend systems, Computer Vision, Telegram bots, PostgreSQL services, and hardware-integrated R&D work.

Live site: https://harutgrigoryan65-hash.github.io/portfolio/

## About

This portfolio presents selected systems and demonstrations from my work as a Python/R&D engineer, including:

- AI automation services for live studio operations
- Computer Vision pipelines with OpenCV and OCR
- Local RAG knowledge-base workflows
- Telegram bots and backend services
- PostgreSQL-backed applications
- Arduino, relay, Raspberry Pi, Serial, and WebSocket integrations
- AI portfolio assistant for recruiter and visitor questions

## Structure

```text
.
├── index.html
├── api/
│   └── chat.js
├── assets/
│   ├── video-posters/
│   └── videos/
├── .env.example
├── .gitignore
├── .nojekyll
├── package.json
└── README.md
```

## AI Assistant

The site includes an AI chat widget that can answer visitor questions about Harutyun's experience, projects, stack, and contact details.

The frontend is in `index.html`; the secure serverless API is in `api/chat.js` and uses Google AI Studio / Gemini API.

Required environment variables:

```text
GEMINI_API_KEY=your-google-ai-studio-key-here
GEMINI_MODEL=gemini-2.5-flash
SITE_ORIGIN=https://your-public-site-url
```

## Local Run

Install dependencies:

```bash
npm install
```

Create local environment variables:

```bash
cp .env.example .env.local
```

Edit `.env.local` and add your Google AI Studio API key:

```text
GEMINI_API_KEY=your-real-key
GEMINI_MODEL=gemini-2.5-flash
SITE_ORIGIN=http://localhost:3000
```

Run the Vercel local server:

```bash
npx vercel dev --yes
```

If Vercel asks for a local project setup, choose the current project and keep the default settings.

Open:

```text
http://localhost:3000
```

## Deployment

This is a static site with an optional serverless AI endpoint.

GitHub Pages can host the static portfolio, but it cannot run `api/chat.js` or store `GEMINI_API_KEY`. For the real AI chat experience, deploy the repository on Vercel and add the environment variables above.

Recommended GitHub Pages settings for static hosting:

- Source: Deploy from a branch
- Branch: `main`
- Folder: `/root`

Recommended Vercel settings for AI chat:

- Framework Preset: Other
- Build Command: none
- Output Directory: none
- Environment Variables: `GEMINI_API_KEY`, `GEMINI_MODEL`, `SITE_ORIGIN`

Deploy to production:

```bash
npm run deploy
```

The entry point is `index.html`; all media assets are stored under `assets/`.
