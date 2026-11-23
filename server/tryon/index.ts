// Cloutfit try-on proxy (Supabase Edge Function). Keeps the FASHN key on the server.
// Deploy:  supabase functions deploy tryon --no-verify-jwt   and   supabase secrets set FASHN_API_KEY=fa-...
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const key = Deno.env.get('FASHN_API_KEY'); if (!key) return json({ error: 'Server is missing FASHN_API_KEY' }, 500);
  let body: any; try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
  const { model_image, garment_image, category } = body || {};
  if (typeof model_image !== 'string' || typeof garment_image !== 'string') return json({ error: 'model_image and garment_image are required' }, 400);
  if (model_image.length > 6e6 || garment_image.length > 6e6) return json({ error: 'Images too large' }, 413);
  const H = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
  const run = await fetch('https://api.fashn.ai/v1/run', { method: 'POST', headers: H, body: JSON.stringify({ model_name: 'tryon-v1.6', inputs: { model_image, garment_image, category: ['tops', 'bottoms', 'one-pieces'].includes(category) ? category : 'auto', garment_photo_type: 'flat-lay', mode: 'balanced', output_format: 'jpeg', return_base64: true } }) });
  const r = await run.json().catch(() => ({}));
  if (!run.ok || !r.id) return json({ error: r?.error?.message || r?.error || `FASHN error ${run.status}` }, 502);
  const t0 = Date.now();
  while (Date.now() - t0 < 140000) {
    await new Promise((ok) => setTimeout(ok, 2500));
    const s = await fetch(`https://api.fashn.ai/v1/status/${r.id}`, { headers: H }).then((x) => x.json()).catch(() => ({}));
    if (s.status === 'completed') { const o = s.output?.[0]; return json({ image: o?.startsWith('data:') || o?.startsWith('http') ? o : `data:image/jpeg;base64,${o}` }); }
    if (s.status === 'failed' || s.status === 'canceled') return json({ error: s.error?.message || 'Try-on failed' }, 502);
  }
  return json({ error: 'Timed out' }, 504);
});
