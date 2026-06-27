import { createClient } from '@supabase/supabase-js';

const TOP_N = 200;

function getClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
}

export default async function handler(req, res) {
  const supabase = getClient();
  const debug = req.query?.debug === '1';

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('ranking')
      .select('id, name, score, ts')
      .order('score', { ascending: false })
      .limit(TOP_N);
    if (error) {
      console.error('ranking GET error:', error);
      return res.status(500).json({ error: 'failed to load ranking', detail: debug ? error.message : undefined });
    }
    return res.status(200).json({ list: data });
  }

  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const name = String(body.name || '').trim().slice(0, 20) || 'Anónimo';
    const score = Number(body.score);
    if (!Number.isFinite(score) || score < 0 || score > 1000) {
      return res.status(400).json({ error: 'invalid score' });
    }

    const { data, error } = await supabase
      .from('ranking')
      .insert({ name, score, ts: Date.now() })
      .select('id, name, score, ts')
      .single();
    if (error) {
      console.error('ranking POST error:', error);
      return res.status(500).json({ error: 'failed to save score', detail: debug ? error.message : undefined });
    }

    const { count, error: countError } = await supabase
      .from('ranking')
      .select('*', { count: 'exact', head: true })
      .gt('score', score);
    const position = countError ? null : (count ?? 0) + 1;

    return res.status(200).json({ entry: data, position });
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'method not allowed' });
}
