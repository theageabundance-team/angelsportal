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

  // Sem email, retorna vazio sem erro
  if (!email) {
    return new Response(JSON.stringify({ memory: '', chatHistory: [] }), { status: 200, headers: CORS });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_KEY;

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return new Response(JSON.stringify({ memory: '', chatHistory: [] }), { status: 200, headers: CORS });
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=memory,chat_history,name`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    if (!res.ok) {
      console.error('Supabase error:', res.status);
      return new Response(JSON.stringify({ memory: '', chatHistory: [] }), { status: 200, headers: CORS });
    }

    const users = await res.json();

    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ memory: '', chatHistory: [] }), { status: 200, headers: CORS });
    }

    const user = users[0];
    const memory = user.memory || '';

    // Parse chat_history com segurança
    let chatHistory = [];
    try {
      const raw = user.chat_history;
      if (Array.isArray(raw)) {
        chatHistory = raw;
      } else if (typeof raw === 'string' && raw.length > 0) {
        chatHistory = JSON.parse(raw);
      }
      // Garante que cada item tem os campos esperados
      chatHistory = chatHistory.filter(m => m && m.role && m.text);
    } catch (e) {
      console.error('Error parsing chat_history:', e);
      chatHistory = [];
    }

    return new Response(JSON.stringify({ memory, chatHistory }), { status: 200, headers: CORS });

  } catch (e) {
    console.error('Memory fetch error:', e);
    return new Response(JSON.stringify({ memory: '', chatHistory: [] }), { status: 200, headers: CORS });
  }
}
