const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// The provider's secret key saved in Render Environment Variables
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'online', provider: 'OpenAI Proxy' });
});

// Proxy route for chat completions (OpenAI format)
app.post(['/v1/chat/completions', '/api/chat'], async (req, res) => {
  try {
    // 1. Use the client header if sent, otherwise use the proxy's server key
    const clientAuth = req.headers['authorization'];
    const apiKey = (clientAuth && !clientAuth.includes('proxy_active'))
      ? clientAuth.replace('Bearer ', '').trim()
      : OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(401).json({
        error: { message: "No API key configured on the Render proxy server." }
      });
    }

    // 2. Prepare payload for OpenAI
    const model = req.body.model || 'gpt-4o-mini';
    const messages = req.body.messages || [
      { role: 'user', content: req.body.prompt || 'Hello' }
    ];

    // 3. Forward the request to OpenAI (or DeepSeek: https://api.deepseek.com/v1/chat/completions)
    const upstreamResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: req.body.temperature || 0.7
      })
    });

    const data = await upstreamResponse.json();
    return res.status(upstreamResponse.status).json(data);
  } catch (err) {
    return res.status(500).json({
      error: { message: `Proxy Error: ${err.message}` }
    });
  }
});

app.listen(PORT, () => {
  console.log(`OpenAI Proxy running on port ${PORT}`);
});