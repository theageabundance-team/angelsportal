export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS });
  }

  try {
    const body = await req.json();
    const { email, prayers_done, rituals_done } = body;

    if (!email) {
      return new Response(JSON.stringify({ error: 'Email required' }), { status: 400, headers: CORS });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return new Response(JSON.stringify({ error: 'Server config missing' }), { status: 500, headers: CORS });
    }

    // Monta apenas os campos enviados
    const patch = {};
    if (prayers_done !== undefined) patch.prayers_done = prayers_done;
    if (rituals_done !== undefined) patch.rituals_done = rituals_done;

    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(patch)
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('Supabase progress PATCH failed:', res.status, err);
      return new Response(JSON.stringify({ error: 'Save failed' }), { status: 500, headers: CORS });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });

  } catch (err) {
    console.error('Progress error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS });
  }
}
