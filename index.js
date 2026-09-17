require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ============================================================================
// 1. API KEYS (Diatur di Dashboard Render -> Environment Variables)
// ============================================================================
const API_KEYS = {
  openai: process.env.OPENAI_API_KEY || '',
  deepseek: process.env.DEEPSEEK_API_KEY || '',
  anthropic: process.env.ANTHROPIC_API_KEY || '',
  xai: process.env.XAI_API_KEY || '',
  gemini: process.env.GEMINI_API_KEY || ''
};

// ============================================================================
// 2. DYNAMIC MODEL MAPPING
// Jika ada rilis model versi baru, Anda cukup update nilai di bawah ini
// ATAU set Environment Variable di Render tanpa menyentuh kode sama sekali!
// ============================================================================
const MODEL_MAPPING = {
  // --- OPENAI ---
  'gpt': {
    provider: 'openai',
    targetModel: process.env.MODEL_OPENAI_FLAGSHIP || 'gpt-5-nano-2025-08-07', // Ubah ke gpt-5 bila sudah rilis
    getKey: () => API_KEYS.openai
  },
  'gpt-mini': {
    provider: 'openai',
    targetModel: process.env.MODEL_OPENAI_MINI || 'gpt-5-mini-2025-08-07',
    getKey: () => API_KEYS.openai
  },

  // --- ANTHROPIC CLAUDE ---
  'claude-sonet': {
    provider: 'anthropic',
    targetModel: process.env.MODEL_CLAUDE_SONNET || 'claude-4-6-sonnet', // Update ke sonnet terbaru
    getKey: () => API_KEYS.anthropic
  },
  'claude-opus': {
    provider: 'anthropic',
    targetModel: process.env.MODEL_CLAUDE_OPUS || 'claude-4-7-opus', // Update ke opus terbaru
    getKey: () => API_KEYS.anthropic
  },

  // --- DEEPSEEK ---
  'deepseek': {
    provider: 'deepseek',
    targetModel: process.env.MODEL_DEEPSEEK || 'deepseek-chat', // Update ke deepseek-v3 / deepseek-r1
    getKey: () => API_KEYS.deepseek
  },

  // --- XAI (GROK) ---
  'grok': {
    provider: 'xai',
    targetModel: process.env.MODEL_GROK || 'grok-3', // Update ke grok-2 / grok-3
    getKey: () => API_KEYS.xai
  },

  // --- GOOGLE GEMINI ---
  'gemini': {
    provider: 'gemini',
    targetModel: process.env.MODEL_GEMINI || 'gemini-2.5-flash',
    getKey: () => API_KEYS.gemini
  }
};

// Helper: Menemukan konfigurasi model berdasarkan parameter dari Android
function resolveModelConfig(clientModelId = '') {
  const query = clientModelId.toLowerCase().trim();

  // 1. Exact match
  if (MODEL_MAPPING[query]) {
    const item = MODEL_MAPPING[query];
    return {
      clientModel: query,
      provider: item.provider,
      targetModel: item.targetModel,
      apiKey: item.getKey()
    };
  }

  // 2. Fuzzy / Keyword match
  if (query.includes('opus')) {
    return {
      clientModel: query,
      provider: 'anthropic',
      targetModel: MODEL_MAPPING['claude-opus'].targetModel,
      apiKey: API_KEYS.anthropic
    };
  }
  if (query.includes('claude') || query.includes('sonet') || query.includes('sonnet')) {
    return {
      clientModel: query,
      provider: 'anthropic',
      targetModel: MODEL_MAPPING['claude-sonet'].targetModel,
      apiKey: API_KEYS.anthropic
    };
  }
  if (query.includes('mini')) {
    return {
      clientModel: query,
      provider: 'openai',
      targetModel: MODEL_MAPPING['gpt-mini'].targetModel,
      apiKey: API_KEYS.openai
    };
  }
  if (query.includes('gpt')) {
    return {
      clientModel: query,
      provider: 'openai',
      targetModel: MODEL_MAPPING['gpt'].targetModel,
      apiKey: API_KEYS.openai
    };
  }
  if (query.includes('deepseek')) {
    return {
      clientModel: query,
      provider: 'deepseek',
      targetModel: MODEL_MAPPING['deepseek'].targetModel,
      apiKey: API_KEYS.deepseek
    };
  }
  if (query.includes('grok')) {
    return {
      clientModel: query,
      provider: 'xai',
      targetModel: MODEL_MAPPING['grok'].targetModel,
      apiKey: API_KEYS.xai
    };
  }

  // Default fallback
  return {
    clientModel: query,
    provider: 'openai',
    targetModel: MODEL_MAPPING['gpt'].targetModel,
    apiKey: API_KEYS.openai
  };
}

// ============================================================================
// 3. ENDPOINT API UNTUK APLIKASI ANDROID
// ============================================================================

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Eddie AI Dynamic Proxy',
    timestamp: new Date().toISOString()
  });
});

// Endpoint Utama: GET /api/keys?model={modelId}
// Contoh: /api/keys?model=claude-sonet-5
app.get('/api/keys', (req, res) => {
  const modelQuery = (req.query.model || req.query.name || 'gpt').toString();
  const resolved = resolveModelConfig(modelQuery);

  res.json({
    success: true,
    clientModel: resolved.clientModel,
    provider: resolved.provider,
    targetModel: resolved.targetModel, // <--- Ini ID model resmi (gpt-4o, claude-3-7-..., dll.)
    modelId: resolved.targetModel,
    apiKey: resolved.apiKey,
    key: resolved.apiKey
  });
});

// Endpoint Alternatif: GET /api/key/:model
app.get('/api/key/:model', (req, res) => {
  const resolved = resolveModelConfig(req.params.model);
  res.json({
    success: true,
    clientModel: resolved.clientModel,
    provider: resolved.provider,
    targetModel: resolved.targetModel,
    modelId: resolved.targetModel,
    apiKey: resolved.apiKey,
    key: resolved.apiKey
  });
});

// Endpoint Sinkronisasi: GET /api/models
app.get('/api/models', (req, res) => {
  const models = Object.keys(MODEL_MAPPING).map(key => ({
    id: key,
    provider: MODEL_MAPPING[key].provider,
    targetModel: MODEL_MAPPING[key].targetModel
  }));

  res.json({ success: true, models });
});

app.listen(PORT, () => {
  console.log(`Eddie AI Dynamic Proxy running on port ${PORT}`);
});
