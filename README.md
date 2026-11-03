# My Website

Personal CV site: an Angular single-page app plus a small Node.js server with one endpoint that lets visitors ask Claude about my stack.

```
profile.json   ← your CV data. Edit this; both the page and the assistant read it.
client/        ← Angular 22 single-page app
server/        ← Node.js + Express, single endpoint POST /api/chat
```

## Setup

1. `npm run install:all`
2. Copy `server/.env.example` to `server/.env` and set `ANTHROPIC_API_KEY` (from https://console.anthropic.com).
3. Edit `profile.json` with your details.

## Develop

```
npm run dev
```

- Site: http://localhost:4200 (Angular dev server, proxies `/api` to the Node server)
- API: http://localhost:3000

## Production

```
npm run build   # builds Angular into client/dist
npm start       # Node serves the built site and /api/chat on one port
```

Deploy the whole folder to any Node host (Render, Railway, Fly.io, a VPS…) with `ANTHROPIC_API_KEY` set as an environment variable.

## The endpoint

`POST /api/chat`

```json
{ "messages": [{ "role": "user", "content": "What is the main tech stack?" }] }
```

Streams the answer back as plain text. Send the full conversation (alternating `user` / `assistant`) for follow-up questions.

Guards for a public endpoint: max 20 messages per conversation, 1000 characters per message, and a per-IP rate limit (`RATE_LIMIT` per 10 minutes, default 20). The assistant only answers from `profile.json`; put anything you want it to know but not show on the page in `extraNotesForAssistant`.

Model: `claude-opus-5-5` at low effort, with server-side refusal fallbacks enabled. Change these in `server/src/index.js`.
