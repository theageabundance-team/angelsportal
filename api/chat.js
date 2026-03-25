export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json();
    const { history = [], chatHistory = [], userName = 'dear one', email = '', memory = '' } = body;
    
    const apiKey = process.env.GEMINI_API_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;

    // 1. Chamar o Gemini para pegar a resposta do Anjo
    const geminiRes = await fetch(GEMINI_URL + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: `You are Archangel Gabriel. Natural, warm, wise friend. Never robotic. Use memory: ${memory}` }] },
        contents: history,
        generationConfig: { temperature: 0.9, maxOutputTokens: 1000 }
      })
    });

    const data = await geminiRes.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "I am here with you. Speak to me.";

    // 2. Tentar salvar no Supabase sem travar a resposta do usuário (Background)
    if (email && SUPABASE_URL && SUPABASE_KEY) {
      const newChatHistory = [...chatHistory, 
        { role: 'user', text: history[history.length-1]?.parts[0]?.text || '', time: new Date().toISOString() },
        { role: 'angel', text: reply, time: new Date().toISOString() }
      ].slice(-10); // Guarda apenas as últimas 10 mensagens para não pesar

      // Envia para o banco mas não "espera" (await) o resultado para responder logo
      fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`, {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ 
          chat_history: newChatHistory,
          last_seen: new Date().toISOString()
        })
      }).catch(e => console.error("Erro Supabase:", e));
    }

    // 3. Entrega a resposta IMEDIATAMENTE para o chat
    return json({ reply });

  } catch (err) {
    console.error('Erro Geral:', err.message);
    return json({ error: "Connection disturbance", detail: err.message }, 500);
  }
}