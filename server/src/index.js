import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { systemPrompt } from './prompt.js';

const PORT = Number(process.env.PORT ?? 3000);
const RATE_LIMIT = Number(process.env.RATE_LIMIT ?? 20);
const RATE_WINDOW_MS = 10 * 60 * 1000;
const MAX_MESSAGES = 20;
const MAX_CHARS = 1000;

const app = express();
const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

// Hosts like Render sit behind a proxy; trust it so req.ip is the visitor's real IP.
app.set('trust proxy', 1);
app.use(express.json({ limit: '50kb' }));

// Simple in-memory rate limit per IP, so a public endpoint can't drain the API budget.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > RATE_LIMIT;
}
// Forget visitors whose window has expired, so the map doesn't grow forever.
setInterval(() => {
  const now = Date.now();
  for (const [ip, times] of hits) {
    if (times.every((t) => now - t >= RATE_WINDOW_MS)) hits.delete(ip);
  }
}, RATE_WINDOW_MS).unref();

// Returns an error string, or null if the conversation is valid.
function validate(messages) {
  if (!Array.isArray(messages) || messages.length === 0) return 'messages must be a non-empty array';
  if (messages.length > MAX_MESSAGES) return 'Conversation is too long. Please refresh to start over.';
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const expectedRole = i % 2 === 0 ? 'user' : 'assistant';
    if (m?.role !== expectedRole || typeof m.content !== 'string' || !m.content.trim()) {
      return 'Invalid message format';
    }
    if (m.content.length > MAX_CHARS) return `Messages are limited to ${MAX_CHARS} characters`;
  }
  if (messages.at(-1).role !== 'user') return 'Last message must be from the user';
  return null;
}

// The single API endpoint: streams Claude's answer back as plain text.
app.post('/api/chat', async (req, res) => {
  const messages = req.body?.messages;
  const error = validate(messages);
  if (error) return res.status(400).json({ error });
  if (rateLimited(req.ip)) {
    return res.status(429).json({ error: 'Too many questions. Please try again in a few minutes.' });
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');

  try {
    const stream = anthropic.beta.messages.stream({
      model: 'claude-opus-5-5',
      max_tokens: 4000,
      output_config: { effort: 'low' }, // short Q&A doesn't need deep reasoning
      // If a safety classifier declines, the API retries on a suitable fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
      messages: messages.map(({ role, content }) => ({ role, content })),
    });

    // Stop paying for tokens if the visitor leaves mid-answer. Must listen on `res`:
    // `req` emits 'close' as soon as the request body has been read.
    res.on('close', () => {
      if (!res.writableFinished) stream.abort();
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(event.delta.text);
      }
    }

    const final = await stream.finalMessage();
    if (final.stop_reason === 'refusal') {
      res.write("Sorry, I can't help with that. Try asking about the stack or experience.");
    }
    res.end();
  } catch (err) {
    if (err instanceof Anthropic.APIUserAbortError) return res.end(); // visitor closed the tab
    console.error('Claude API error:', err);
    if (!res.headersSent) {
      res.status(502).json({ error: 'The assistant is unavailable right now.' });
    } else {
      res.end('\n[The assistant is unavailable right now.]');
    }
  }
});

// In production, serve the built Angular app from the same server.
const clientDist = fileURLToPath(new URL('../../client/dist/client/browser', import.meta.url));
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('/{*path}', (_req, res) => res.sendFile('index.html', { root: clientDist }));
}

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
