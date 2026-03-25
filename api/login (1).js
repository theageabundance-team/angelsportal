export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    const body = await req.json();
    const email = body.email || '';
    const name = body.name || '';

    if (!email || !name) {
      return new Response(JSON.stringify({ error: 'Email and name required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;

    // Check if user exists
    const checkRes = await fetch(
      SUPABASE_URL + '/rest/v1/users?email=eq.' + encodeURIComponent(email) + '&select=*',
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY
        }
      }
    );

    const existing = await checkRes.json();

    if (existing && existing.length > 0) {
      const user = existing[0];
      return new Response(JSON.stringify({ user, isNew: false }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Create new user
    const createRes = await fetch(
      SUPABASE_URL + '/rest/v1/users',
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          email,
          name,
          angel: 'gabriel',
          memory: '',
          prayers_done: {},
          rituals_done: {},
          streak: 0,
          last_seen: new Date().toISOString().split('T')[0]
        })
      }
    );

    const created = await createRes.json();
    const user = Array.isArray(created) ? created[0] : created;

    return new Response(JSON.stringify({ user, isNew: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
