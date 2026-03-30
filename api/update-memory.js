export const config = { runtime: 'edge' };

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json'
};

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=';

export default async function handler(req) {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: CORS });

  try {
    const body = await req.json();
    const { email, userName, recentMessages } = body;

    if (!email || !recentMessages?.length) {
      return new Response(JSON.stringify({ ok: false }), { status: 200, headers: CORS });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY = process.env.SUPABASE_KEY;

    if (!apiKey || !SUPABASE_URL || !SUPABASE_KEY) {
      return new Response(JSON.stringify({ ok: false }), { status: 200, headers: CORS });
    }

    // Busca memória atual do Supabase
    const fetchRes = await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}&select=memory`,
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
    );

    let currentMemory = '';
    if (fetchRes.ok) {
      const users = await fetchRes.json();
      if (users?.length > 0) currentMemory = users[0].memory || '';
    }

    // Gera memória atualizada
    const conversationText = recentMessages
      .map(m => `${m.role === 'user' ? userName : 'Gabriel'}: ${m.text}`)
      .join('\n');

    const prompt = `You are analyzing a conversation between a person named ${userName} and their guardian angel Gabriel.

Current memory profile of ${userName}:
${currentMemory || '(no previous memory)'}

Recent conversation:
${conversationText}

Based on this conversation, update the memory profile of ${userName}. Extract and synthesize:
- Recurring emotions (loneliness, anxiety, fear, joy, etc.)
- Life situation (family, work, relationships, health)
- Important themes that came up
- Any specific struggles or joys mentioned
- What seems to matter most to this person

Write the updated memory profile in the SAME LANGUAGE as the conversation above.
Be concise but rich — this is a living profile that will help Gabriel be a better companion.
Format as a short paragraph or two, written as notes Gabriel carries in his heart about this person.
Do NOT include anything that wasn't actually mentioned. Do NOT invent details.`;

    const geminiRes = await fetch(GEMINI_URL + apiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 400 }
      })
    });

    if (!geminiRes.ok) {
      console.error('updateMemory Gemini error:', geminiRes.status);
      return new Response(JSON.stringify({ ok: false }), { status: 200, headers: CORS });
    }

    const geminiData = await geminiRes.json();
    const newMemory = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!newMemory) {
      console.error('updateMemory empty response');
      return new Response(JSON.stringify({ ok: false }), { status: 200, headers: CORS });
    }

    // Salva no Supabase
    await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify({ memory: newMemory })
      }
    );

    console.log(`Memory updated for ${email}, length: ${newMemory.length}`);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: CORS });

  } catch (e) {
    console.error('update-memory error:', e.message);
    return new Response(JSON.stringify({ ok: false }), { status: 200, headers: CORS });
  }
}
