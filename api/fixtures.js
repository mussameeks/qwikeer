import { forward } from './_lib/forward.js';

export default async function handler(req, res) {
  try {
    const { date, live } = req.query || {};
    if (live) {
      const { status, data } = await forward('/fixtures?live=all');
      res.status(status).json(data);
      return;
    }
    if (date) {
      const { status, data } = await forward(`/fixtures?date=${encodeURIComponent(date)}`);
      res.status(status).json(data);
      return;
    }
    res.status(400).json({ error: 'Specify ?live=1 or ?date=YYYY-MM-DD' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
