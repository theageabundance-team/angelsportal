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
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { email, name } = await req.json();

    if (!email || !name) {
      return new Response(JSON.stringify({ error: 'Email and name required' }), { status: 400 });
    }

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;

    // Check if user exists
    const checkRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=*`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    const existing = await checkRes.json();

    if (existing && existing.length > 0) {
      // User exists — return their profile
      const user = existing[0];
      return new Response(JSON.stringify({
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          angel: user.angel,
          memory: user.memory,
          streak: user.streak,
          prayers_done: user.prayers_done,
          rituals_done: user.rituals_done,
          created_at: user.created_at
        },
        isNew: false
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // New user — create profile
    const createRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users`,
      {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
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

    const newUser = await createRes.json();
    const user = Array.isArray(newUser) ? newUser[0] : newUser;

    return new Response(JSON.stringify({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        angel: user.angel,
        memory: user.memory,
        streak: user.streak,
        prayers_done: user.prayers_done,
        rituals_done: user.rituals_done,
        created_at: user.created_at
      },
      isNew: true
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}
