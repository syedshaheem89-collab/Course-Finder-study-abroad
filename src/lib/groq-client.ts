let cachedActiveModel: string | null = null;
let cachedAt = 0;

function isUsableKey(val: string | undefined, mustStartWith?: string): string | null {
  const k = val?.trim() || '';
  if (k.length < 20) return null;
  const lower = k.toLowerCase();
  if (lower.includes('your_') || lower.includes('placeholder') || lower.includes('changeme')) {
    return null;
  }
  if (mustStartWith && !k.startsWith(mustStartWith)) return null;
  return k;
}

async function tryGeminiJson(prompt: string): Promise<string | null> {
  const geminiKey = isUsableKey(process.env.GEMINI_API_KEY);
  if (!geminiKey) return null;

  const models = ['gemini-2.5-flash', 'gemini-2.0-flash'];
  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(geminiKey)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(7000),
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Return strictly valid JSON only.\n\n${prompt}` }] }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json',
            },
          }),
        }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const trimmed = text.trim();
      if (trimmed) {
        JSON.parse(trimmed);
        return trimmed;
      }
    } catch {
      // Try next Gemini model or provider
    }
  }
  return null;
}

async function tryOpenAiJson(prompt: string): Promise<string | null> {
  const openAiKey = isUsableKey(process.env.OPENAI_API_KEY, 'sk-');
  if (!openAiKey) return null;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiKey}`,
      },
      signal: AbortSignal.timeout(7000),
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Return strictly valid JSON only.' },
          { role: 'user', content: prompt },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content || null;
    if (content) {
      JSON.parse(content);
      return content;
    }
  } catch {
    return null;
  }
  return null;
}

export async function callGroqFreeJson(prompt: string): Promise<string | null> {
  const groqKey = isUsableKey(process.env.GROQ_API_KEY);

  if (groqKey) {
    try {
      // Use cached active model for 1 hour to avoid an extra /models round-trip on every request
      const now = Date.now();
      const candidateModels: string[] =
        cachedActiveModel && now - cachedAt < 3600_000
          ? [cachedActiveModel]
          : ['llama-3.3-70b-versatile', 'meta-llama/llama-4-scout-17b-16e-instruct'];

      const tryComplete = async (model: string): Promise<{ ok: boolean; status: number; content: string | null }> => {
        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey}`,
          },
          signal: AbortSignal.timeout(7000),
          body: JSON.stringify({
            model,
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: 'Return strictly valid JSON only.' },
              { role: 'user', content: prompt },
            ],
          }),
        });
        if (!res.ok) return { ok: false, status: res.status, content: null };
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content || null;
        return { ok: Boolean(content), status: res.status, content };
      };

      for (const model of candidateModels) {
        const result = await tryComplete(model);
        if (result.ok && result.content) {
          cachedActiveModel = model;
          cachedAt = now;
          return result.content;
        }
      }

      // Only query /models if fast-path candidates failed (e.g. model ID retired)
      const modelsRes = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { Authorization: `Bearer ${groqKey}` },
        signal: AbortSignal.timeout(7000),
      });
      if (modelsRes.ok) {
        const modelsJson = await modelsRes.json();
        const activeIds: string[] = (modelsJson?.data || [])
          .map((m: any) => String(m.id || ''))
          .filter(
            (id: string) =>
              id &&
              !id.includes('whisper') &&
              !id.includes('guard') &&
              !id.includes('tts') &&
              !id.includes('safeguard')
          );

        const preferred = activeIds.filter(
          (id) =>
            id.includes('llama-4') ||
            id.includes('llama-3.3') ||
            id.includes('gpt-oss') ||
            id.includes('qwen') ||
            id.includes('llama')
        );
        const fallbackList = (preferred.length > 0 ? preferred : activeIds).slice(0, 3);
        for (const model of fallbackList) {
          const result = await tryComplete(model);
          if (result.ok && result.content) {
            cachedActiveModel = model;
            cachedAt = Date.now();
            return result.content;
          }
        }
      }
    } catch {
      // Fall through to secondary AI providers
    }
  }

  // Fallback 2: Google Gemini JSON API
  const geminiResult = await tryGeminiJson(prompt);
  if (geminiResult) return geminiResult;

  // Fallback 3: OpenAI JSON API
  const openAiResult = await tryOpenAiJson(prompt);
  if (openAiResult) return openAiResult;

  return null;
}
