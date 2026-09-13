const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'EventPulse AI proxy' });
});

app.post('/api/assistant', async (req, res) => {
  try {
    const { prompt, topic = 'navigation' } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        error: 'GEMINI_API_KEY is missing. Add it to your .env file.'
      });
    }

    if (!prompt || !String(prompt).trim()) {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `
                  You are a trusted event navigation assistant for a conference or expo.
                  Use approved event information only.
                  Topic: ${topic}

                  User request: ${prompt}

                  Rules:
                  - Keep answers short and practical.
                  - Give 3 steps max.
                  - For emergencies, tell the user to seek help immediately and contact staff or use SOS.
                  - For accessibility, prioritize step-free routes and quiet-room support.
                  - For navigation, reference current anchor/pillar language when relevant.
                  - Do not invent hidden locations or fake emergency instructions.
                  - Be helpful, clear, and calm.
                  `
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      const message = data?.error?.message || 'Gemini API request failed';
      throw new Error(message);
    }

    const answer = data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      'I am unable to generate an answer right now.';

    return res.json({ answer });
  } catch (error) {
    console.error('Assistant error:', error.message);
    return res.status(500).json({
      answer: 'I could not access the AI service right now. Please use the built-in safety instructions or tap SOS for staff help.'
    });
  }
});

app.listen(PORT, () => {
  console.log(`EventPulse AI proxy running on http://localhost:${PORT}`);
});
