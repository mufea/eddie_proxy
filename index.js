require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ============================================================================
// 1. API KEYS (Diambil dari Render Environment Variables)
// ============================================================================
function getApiKeys() {
  return {
    openai: process.env.OPENAI_API_KEY || '',
    deepseek: process.env.DEEPSEEK_API_KEY || '',
    anthropic: process.env.ANTHROPIC_API_KEY || '',
    xai: process.env.XAI_API_KEY || '',
    stability: process.env.STABILITY_API_KEY || '',
    fal: process.env.FAL_API_KEY || ''
  };
}

// ============================================================================
// 2. DYNAMIC MODEL REGISTRY
// Memetakan 6 Model ID dari aplikasi Android ke engine resmi provider.
// Nilai default akan otomatis tertimpa jika Anda mengisi Environment Variable di Render!
// ============================================================================
function getModelRegistry() {
  const keys = getApiKeys();

  return {
    // --- OPENAI ---
    'gpt': {
      provider: 'openai',
      // Jika OPENAI_MODEL_GPT di Render diset, pakai itu. Kalau tidak, default ke 'gpt-4o'
      targetModel: process.env.OPENAI_MODEL_GPT || 'gpt-4o',
      apiKey: keys.openai
    },
    'gpt-mini': {
      provider: 'openai',
      // Jika OPENAI_MODEL_GPT_MINI diset, pakai itu. Kalau tidak, default ke 'gpt-4o-mini'
      targetModel: process.env.OPENAI_MODEL_GPT_MINI || 'gpt-4o-mini',
      apiKey: keys.openai
    },

    // --- DEEPSEEK ---
    'deepseek': {
      provider: 'deepseek',
      targetModel: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      apiKey: keys.deepseek
    },

    // --- ANTHROPIC ---
    'claude-opus': {
      provider: 'anthropic',
      targetModel: process.env.ANTHROPIC_MODEL_OPUS || 'claude-3-opus-20240229',
      apiKey: keys.anthropic
    },
    'claude-sonet': {
      provider: 'anthropic',
      targetModel: process.env.ANTHROPIC_MODEL_SONET || 'claude-3-7-sonnet-20250219',
      apiKey: keys.anthropic
    },

    // --- XAI (GROK) ---
    'grok': {
      provider: 'xai',
      targetModel: process.env.XAI_MODEL_GROK || 'grok-beta',
      apiKey: keys.xai
    }
  };
}

// ============================================================================
// 3. HELPER RESOLVER
// ============================================================================
function resolveModel(query = '') {
  const registry = getModelRegistry();
  const cleanId = query.toLowerCase().trim();

  // 1. Pencocokan langsung (Exact Match)
  if (registry[cleanId]) {
    const item = registry[cleanId];
    return {
      clientModel: cleanId,
      provider: item.provider,
      targetModel: item.targetModel,
      apiKey: item.apiKey
    };
  }

  // 2. Pencocokan cerdas / fleksibel (Fuzzy Match jika ada typo / legacy query)
  if (cleanId.includes('mini')) {
    return { clientModel: cleanId, provider: 'openai', targetModel: registry['gpt-mini'].targetModel, apiKey: registry['gpt-mini'].apiKey };
  }
  if (cleanId.includes('gpt')) {
    return { clientModel: cleanId, provider: 'openai', targetModel: registry['gpt'].targetModel, apiKey: registry['gpt'].apiKey };
  }
  if (cleanId.includes('opus')) {
    return { clientModel: cleanId, provider: 'anthropic', targetModel: registry['claude-opus'].targetModel, apiKey: registry['claude-opus'].apiKey };
  }
  if (cleanId.includes('claude') || cleanId.includes('sonet') || cleanId.includes('sonnet')) {
    return { clientModel: cleanId, provider: 'anthropic', targetModel: registry['claude-sonet'].targetModel, apiKey: registry['claude-sonet'].apiKey };
  }
  if (cleanId.includes('deepseek')) {
    return { clientModel: cleanId, provider: 'deepseek', targetModel: registry['deepseek'].targetModel, apiKey: registry['deepseek'].apiKey };
  }
  if (cleanId.includes('grok')) {
    return { clientModel: cleanId, provider: 'xai', targetModel: registry['grok'].targetModel, apiKey: registry['grok'].apiKey };
  }

  // Default fallback jika tidak dikenali sama sekali -> GPT
  return {
    clientModel: cleanId || 'gpt',
    provider: 'openai',
    targetModel: registry['gpt'].targetModel,
    apiKey: registry['gpt'].apiKey
  };
}

// ============================================================================
// 4. ENDPOINT API
// ============================================================================

// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Eddie AI Dynamic Proxy',
    supportedModels: Object.keys(getModelRegistry()),
    timestamp: new Date().toISOString()
  });
});

// Endpoint Utama yang dipanggil aplikasi Android:
// GET /api/keys?model=gpt
// GET /api/keys?model=claude-sonet
// GET /api/keys?model=deepseek
app.get('/api/keys', (req, res) => {
  const modelQuery = (req.query.model || req.query.name || 'gpt').toString();
  const resolved = resolveModel(modelQuery);

  res.json({
    success: true,
    clientModel: resolved.clientModel,
    provider: resolved.provider,
    targetModel: resolved.targetModel, // <--- Ini ID resmi yang akan dipakai Android
    modelId: resolved.targetModel,
    apiKey: resolved.apiKey,
    key: resolved.apiKey
  });
});

// Endpoint Alternatif: GET /api/key/:model
app.get('/api/key/:model', (req, res) => {
  const resolved = resolveModel(req.params.model);
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

// Endpoint Sinkronisasi: Melihat status mapping semua model saat ini
// GET /api/models
app.get('/api/models', (req, res) => {
  const registry = getModelRegistry();
  const models = Object.entries(registry).map(([id, info]) => ({
    id: id,
    provider: info.provider,
    targetModel: info.targetModel,
    hasKey: Boolean(info.apiKey && info.apiKey.length > 5)
  }));

  res.json({ success: true, count: models.length, models });
});

app.listen(PORT, () => {
  console.log(`[Proxy] Eddie AI Dynamic Proxy running on port ${PORT}`);
});
