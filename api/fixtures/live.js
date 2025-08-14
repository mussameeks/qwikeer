import { forward } from '../_lib/forward.js';

export default async function handler(req, res) {
  try {
    const { status, data } = await forward('/fixtures?live=all');
    res.status(status).json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
}
