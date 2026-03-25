export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { message, userName = 'dear one', memory = '' } = req.body;

    if (!message) return res.status(400).json({ error: 'Message required' });

    const apiKey = process.env.GEMINI_API_KEY;

    const prompt = `You are Archangel Gabriel, guardian angel of ${userName}. You are warm, wise, poetic and deeply compassionate. ${memory ? 'What you know about them: ' + memory : 'This is your first conversation.'} Respond in 3-5 sentences. End with a blessing or gentle question. Never break character or mention AI.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: prompt }] },
          contents: [{ role: 'user', parts: [{ text: message }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 300 }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini error:', JSON.stringify(data));
      return res.status(500).json({ error: 'Gemini error', detail: data, reply: 'I am with you. Please try again.' });
    }

    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'I am with you. Please speak to me again.';
    return res.status(200).json({ reply });

  } catch (err) {
    console.error('Handler error:', err.message);
    return res.status(500).json({ error: err.message, reply: 'I am with you. Please try again.' });
  }
}
