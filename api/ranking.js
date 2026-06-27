import { kv } from '@vercel/kv';

const SET_KEY = 'flagrush:ranking';
const TOP_N = 200;
const MAX_ENTRIES = 1000;

export default async function handler(req, res) {
  if (req.method === 'GET') {
    try {
      const raw = await kv.zrange(SET_KEY, 0, TOP_N - 1, { rev: true, withScores: true });
      const list = [];
      for (let i = 0; i < raw.length; i += 2) {
        try { list.push(JSON.parse(raw[i])); } catch {}
      }
      return res.status(200).json({ list });
    } catch (err) {
      return res.status(500).json({ error: 'failed to load ranking' });
    }
  }

  if (req.method === 'POST') {
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      const name = String(body.name || '').trim().slice(0, 20) || 'Anónimo';
      const score = Number(body.score);
      if (!Number.isFinite(score) || score < 0 || score > 1000) {
        return res.status(400).json({ error: 'invalid score' });
      }

      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name,
        score,
        ts: Date.now()
      };
      const member = JSON.stringify(entry);
      await kv.zadd(SET_KEY, { score, member });

      const count = await kv.zcard(SET_KEY);
      if (count > MAX_ENTRIES) {
        const overflow = await kv.zrange(SET_KEY, 0, count - MAX_ENTRIES - 1);
        if (overflow.length) await kv.zrem(SET_KEY, ...overflow);
      }

      const rank = await kv.zrevrank(SET_KEY, member);
      return res.status(200).json({ entry, position: rank != null ? rank + 1 : null });
    } catch (err) {
      return res.status(500).json({ error: 'failed to save score' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}
