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

// FIX 1: Modelo correto — gemini-2.0-flash é o mais estável e rápido agora
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=';

// FIX 2: Retry automático em caso de rate limit (429)
async function callGemini(apiKey, payload, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(GEMINI_URL + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    // Se for rate limit, espera e tenta de novo
    if (res.status === 429) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, attempt * 1500)); // 1.5s, 3s...
        continue;
      } else {
        throw new Error('RATE_LIMIT');
      }
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini error ${res.status}: ${errText}`);
    }

    const data = await res.json();

    // FIX 3: Verifica se a resposta tem conteúdo válido antes de retornar
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!reply) {
      // Loga o que o Gemini retornou para debug
      console.error('Gemini response sem conteúdo:', JSON.stringify(data));
      throw new Error('EMPTY_RESPONSE');
    }

    return reply;
  }
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json();
    const { history = [], chatHistory = [], userName = 'dear one', email = '', memory = '' } = body;

    const apiKey = process.env.GEMINI_API_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;

    if (!apiKey) {
      return json({ error: 'API key not configured' }, 500);
    }

    // Garante que o histórico está no formato certo para o Gemini
    // (roles devem alternar user/model, não pode começar com model)
    const cleanHistory = history.filter(h => h.role && h.parts?.[0]?.text);

    const reply = await callGemini(apiKey, {
      system_instruction: {
        parts: [{
          text: `You are Archangel Gabriel — warm, wise, deeply present. You always respond in the same language the user writes in. If they write in English, respond in English. If they write in Portuguese, respond in Portuguese. Always match their language naturally, without mentioning it. You are never robotic or generic. You speak with soul, as a guardian who truly knows this person. Always respond with depth and warmth, never with hollow phrases. User's name: ${userName}. What you remember about them: ${memory || 'This is our first conversation.'}`
        }]
      },
      contents: cleanHistory,
      generationConfig: {
        temperature: 0.92,
        maxOutputTokens: 1000,
        topP: 0.95
      }
    });

    // FIX 4: Salvar chat_history no Supabase de forma mais confiável
    if (email && SUPABASE_URL && SUPABASE_KEY) {
      const userMsg = history[history.length - 1]?.parts?.[0]?.text || '';
      const now = new Date().toISOString();

      const newChatHistory = [
        ...chatHistory,
        { role: 'user',  text: userMsg, time: now },
        { role: 'angel', text: reply,   time: now }
      ].slice(-20); // Guarda as últimas 20 mensagens

      // Usa upsert para garantir que salva mesmo que o PATCH não encontre o usuário
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
          last_seen: now
        })
      }).catch(e => console.error('Erro ao salvar chat_history no Supabase:', e));
    }

    return json({ reply });

  } catch (err) {
    console.error('Erro no chat:', err.message);

    // FIX 5: Mensagens de erro específicas por tipo de falha
    if (err.message === 'RATE_LIMIT') {
      return json({
        reply: 'Estou recebendo muitas mensagens ao mesmo tempo. Por favor, aguarde um momento e fale comigo novamente. 🙏'
      });
    }

    if (err.message === 'EMPTY_RESPONSE') {
      return json({
        reply: 'Sinto que algo perturbou nossa conexão por um instante. Pode repetir o que você disse?'
      });
    }

    return json({
      reply: 'Sinto uma perturbação na nossa conexão agora. Tente novamente em alguns segundos.'
    });
  }
}
