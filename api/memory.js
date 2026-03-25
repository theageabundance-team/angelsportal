export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const url = new URL(req.url);
  const email = url.searchParams.get('email');

  if (!email) {
    return new Response(JSON.stringify({ memory: '' }), { status: 200, headers: CORS });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response(JSON.stringify({ memory: '' }), { status: 200, headers: CORS });
  }

  try {
    const res = await fetch(
      SUPABASE_URL + '/rest/v1/users?email=eq.' + encodeURIComponent(email) + '&select=memory',
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } }
    );
    const users = await res.json();
    const memory = users?.[0]?.memory || '';
    return new Response(JSON.stringify({ memory }), { status: 200, headers: CORS });
  } catch (e) {
    return new Response(JSON.stringify({ memory: '' }), { status: 200, headers: CORS });
  }
}
