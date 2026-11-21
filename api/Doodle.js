// Doodle board: GET returns the latest doodles, POST adds one.
// Needs three settings on the Vercel project: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DOODLE_SALT.
// The table is created by supabase/doodles.sql.
const crypto = require('crypto');

const COLORS = new Set(['ink', '#3a6bd6', '#d9473b', '#2f9e6a']);
const MAX_STROKES = 300, MAX_POINTS = 15000, MAX_PER_HOUR = 5, LIST_LIMIT = 150;

function clean(input) {
  if (!Array.isArray(input) || !input.length || input.length > MAX_STROKES) return null;
  let points = 0;
  const out = [];
  for (const s of input) {
    if (!s || !COLORS.has(s.c) || !Array.isArray(s.p) || s.p.length < 2 || s.p.length % 2) return null;
    const w = Number(s.w);
    if (!Number.isFinite(w) || w < 1 || w > 40) return null;
    points += s.p.length / 2;
    if (points > MAX_POINTS) return null;
    const p = [];
    for (let i = 0; i < s.p.length; i += 2) {
      const x = Number(s.p[i]), y = Number(s.p[i + 1]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      p.push(Math.round(Math.min(1005, Math.max(-5, x)) * 10) / 10, Math.round(Math.min(630, Math.max(-5, y)) * 10) / 10);
    }
    out.push({ c: s.c, w: Math.round(w * 10) / 10, p });
  }
  return out;
}

module.exports = async (req, res) => {
  const url = process.env.SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  res.setHeader('Content-Type', 'application/json');
  if (!url || !key) { res.setHeader('Cache-Control', 'no-store'); return res.status(503).end(JSON.stringify({ error: 'The doodle board is not set up yet.' })); }
  const H = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
  try {
    if (req.method === 'GET') {
      const r = await fetch(`${url}/rest/v1/doodles?select=id,created_at,strokes&hidden=eq.false&order=created_at.desc&limit=${LIST_LIMIT}`, { headers: H });
      if (!r.ok) throw new Error('read ' + r.status);
      res.setHeader('Cache-Control', 'public, s-maxage=20, stale-while-revalidate=120');
      return res.status(200).end(JSON.stringify({ doodles: await r.json() }));
    }
    if (req.method === 'POST') {
      res.setHeader('Cache-Control', 'no-store');
      let body = req.body;
