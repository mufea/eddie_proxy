require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ============================================================================
// KONFIGURASI API KEYS DARI ENVIRONMENT VARIABLES
// Atur variabel-variabel ini di Dashboard Render -> Environment
// ============================================================================
const API_KEYS = {
  openai: process.env.OPENAI_API_KEY || '',
  deepseek: process.env.DEEPSEEK_API_KEY || '',
  anthropic: process.env.ANTHROPIC_API_KEY || '',
  xai: process.env.XAI_API_KEY || '',
  stability: process.env.STABILITY_API_KEY || '',
  fal: process.env.FAL_API_KEY || '',
  gemini: process.env.GEMINI_API_KEY || ''
};

// Helper: memetakan model ID ke API key yang sesuai
function getKeyForModel(modelName = '') {
  const name = modelName.toLowerCase();
  if (name.includes('gpt') || name.includes('openai')) {
    return API_KEYS.openai;
  }
  if (name.includes('deepseek')) {
    return API_KEYS.deepseek;
  }
  if (name.includes('claude') || name.includes('anthropic') || name.includes('sonnet') || name.includes('opus')) {
    return API_KEYS.anthropic;
  }
  if (name.includes('grok') || name.includes('xai')) {
    return API_KEYS.xai;
  }
  if (name.includes('stability')) {
    return API_KEYS.stability;
  }
  if (name.includes('fal')) {
    return API_KEYS.fal;
  }
  if (name.includes('gemini') || name.includes('google')) {
    return API_KEYS.gemini;
  }
  return API_KEYS.openai; // fallback default
}

// ============================================================================
// 1. HEALTH CHECK / ROOT
// ============================================================================
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Eddie AI Proxy',
    timestamp: new Date().toISOString()
  });
});

// ============================================================================
// 2. ENDPOINT PENGAMBILAN API KEYS (Dipanggil oleh Android App)
// ============================================================================

// Contoh: GET /api/keys?model=gpt-5.5
app.get('/api/keys', (req, res) => {
  const model = (req.query.model || req.query.name || '').toString();
  const requestedKey = getKeyForModel(model);

  res.json({
    success: true,
    model: model || 'default',
    apiKey: requestedKey,
    key: requestedKey,
    // Mengembalikan semua key jika client meminta bundle
    keys: {
      openai: API_KEYS.openai,
      deepseek: API_KEYS.deepseek,
      anthropic: API_KEYS.anthropic,
      xai: API_KEYS.xai,
      stability: API_KEYS.stability,
      fal: API_KEYS.fal,
      gemini: API_KEYS.gemini
    }
  });
});

// Contoh: GET /api/key/gpt-5.5 atau GET /api/key/openai
app.get('/api/key/:model', (req, res) => {
  const model = req.params.model || '';
  const key = getKeyForModel(model);

  res.json({
    success: true,
    model: model,
    apiKey: key,
    key: key
  });
});

// ============================================================================
// 3. ENDPOINT PROXY CHAT (Opsional: Hit langsung lewat server proxy)
// POST /api/chat
// ============================================================================
app.post('/api/chat', async (req, res) => {
  try {
    const { model, messages, message, apiKey } = req.body;
    const modelName = (model || 'gpt-5.5').toLowerCase();
    const effectiveKey = apiKey || getKeyForModel(modelName);

    // Siapkan list pesan
    let chatMessages = messages;
    if (!chatMessages || !Array.isArray(chatMessages)) {
      chatMessages = [{ role: 'user', content: message || 'Halo' }];
    }

    // A. JIKA MODEL OPENAI / DEEPSEEK / GROK (Format OpenAI Compatible)
    if (
      modelName.includes('gpt') ||
      modelName.includes('deepseek') ||
      modelName.includes('grok')
    ) {
      let targetUrl = 'https://api.openai.com/v1/chat/completions';
      let actualModelId = 'gpt-4o'; // atau gpt-4o-mini untuk gpt-5.5-mini

      if (modelName.includes('mini')) actualModelId = 'gpt-4o-mini';
      if (modelName.includes('deepseek')) {
        targetUrl = 'https://api.deepseek.com/chat/completions';
        actualModelId = 'deepseek-chat';
      }
      if (modelName.includes('grok')) {
        targetUrl = 'https://api.x.ai/v1/chat/completions';
        actualModelId = 'grok-beta';
      }

      const openAiResponse = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveKey}`
        },
        body: JSON.stringify({
          model: actualModelId,
          messages: chatMessages,
          temperature: 0.7
        })
      });

      const data = await openAiResponse.json();
      return res.status(openAiResponse.status).json(data);
    }

    // B. JIKA MODEL ANTHROPIC CLAUDE
    if (modelName.includes('claude') || modelName.includes('sonnet') || modelName.includes('opus')) {
      const claudeModel = modelName.includes('opus')
        ? 'claude-opus-5'
        : 'claude-sonnet-5';

      const userMessages = chatMessages.filter(m => m.role !== 'system');
      const systemMessage = chatMessages.find(m => m.role === 'system')?.content;

      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': effectiveKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: claudeModel,
          max_tokens: 2048,
          messages: userMessages,
          ...(systemMessage ? { system: systemMessage } : {})
        })
      });

      const data = await anthropicRes.json();
      return res.status(anthropicRes.status).json(data);
    }

    // Fallback error
    return res.status(400).json({
      error: `Model ${model} tidak dikenali atau belum dikonfigurasi.`
    });

  } catch (error) {
    console.error('Error handling chat request:', error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

// ============================================================================
// START SERVER
// ============================================================================
app.listen(PORT, () => {
  console.log(`Server proxy AI berjalan di port ${PORT}`);
});
