import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 8787;

const FOOTBALL_API_BASE = process.env.FOOTBALL_API_BASE || 'https://api-football-v1.p.rapidapi.com/v3';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

if (!RAPIDAPI_KEY) {
  console.warn('[WARN] RAPIDAPI_KEY is not set. Set it in .env.server for local dev or your host env.');
}

app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

async function forward(pathWithQuery) {
  const url = `${FOOTBALL_API_BASE}${pathWithQuery}`;
  const res = await fetch(url, {
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY || '',
      'x-rapidapi-host': 'api-football-v1.p.rapidapi.com',
    },
  });
  const data = await res.json();
  return { status: res.status, data };
}

// Specific endpoints
app.get('/api/fixtures/live', async (req, res) => {
  try {
    const { status, data } = await forward('/fixtures?live=all');
    res.status(status).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/fixtures/by-date', async (req, res) => {
  const date = req.query.date;
  if (!date) return res.status(400).json({ error: 'Missing ?date=YYYY-MM-DD' });
  try {
    const { status, data } = await forward(`/fixtures?date=${encodeURIComponent(date)}`);
    res.status(status).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Optional: generic pass-through for other endpoints under /api/raw?path=/fixtures&query=...
app.get('/api/raw', async (req, res) => {
  const path = req.query.path || '';
  const qs = req.query.qs || '';
  const pathWithQuery = `${path}${qs ? ('?' + qs) : ''}`;
  try {
    const { status, data } = await forward(pathWithQuery);
    res.status(status).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
