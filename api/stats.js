export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const KV_REST_API_URL = process.env.KV_REST_API_URL;
  const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN;
  if (!KV_REST_API_URL || !KV_REST_API_TOKEN) {
    return res.status(503).json({ error: 'KV not configured. Set KV_REST_API_URL and KV_REST_API_TOKEN.' });
  }

  let body = req.body;
  try {
    if (typeof body === 'string') body = JSON.parse(body);
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const updates = Array.isArray(body?.updates) ? body.updates : null;
  if (!updates || updates.length === 0) {
    return res.status(400).json({ error: 'updates array required' });
  }

  // Build pipeline commands for Upstash/VerceI KV REST API
  const pipeline = [];
  for (const u of updates) {
    const id = u?.id;
    const attemptsDelta = Number(u?.attemptsDelta || 0);
    const correctDelta = Number(u?.correctDelta || 0);
    if (!id || (!attemptsDelta && !correctDelta)) continue;
    if (attemptsDelta) {
      pipeline.push(['INCRBY', `q:${id}:attempts`, attemptsDelta]);
    }
    if (correctDelta) {
      pipeline.push(['INCRBY', `q:${id}:correct`, correctDelta]);
    }
  }

  if (pipeline.length === 0) {
    return res.status(400).json({ error: 'no valid increments in updates' });
  }

  try {
    const r = await fetch(`${KV_REST_API_URL}/pipeline`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${KV_REST_API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pipeline)
    });
    if (!r.ok) {
      const text = await r.text();
      return res.status(502).json({ error: 'KV pipeline failed', detail: text });
    }
    const data = await r.json();
    return res.status(200).json({ ok: true, results: data });
  } catch (err) {
    return res.status(500).json({ error: 'KV request failed' });
  }
}


