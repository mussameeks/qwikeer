import { forward } from '../_lib/forward.js';

export default async function handler(req, res) {
  try {
    const date = req.query?.date;
    if (!date) return res.status(400).json({ error: 'Missing ?date=YYYY-MM-DD' });
    const { status, data } = await forward(`/fixtures?date=${encodeURIComponent(date)}`);
    res.status(status).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
