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

async function tryGeminiJson(prompt: string): Promise<{ model: string; content: string } | null> {
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
          signal: AbortSignal.timeout(8000),
          body: JSON.stringify({
            contents: [{ parts: [{ text: `Return strictly valid JSON only.\n\n${prompt}` }] }],
            generationConfig: {
              temperature: 0.15,
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
        return { model, content: trimmed };
      }
    } catch {
      // Try next Gemini model or provider
    }
  }
  return null;
}

async function tryOpenAiJson(prompt: string): Promise<{ model: string; content: string } | null> {
  const openAiKey = isUsableKey(process.env.OPENAI_API_KEY, 'sk-');
  if (!openAiKey) return null;

  try {
    const model = 'gpt-4o-mini';
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiKey}`,
      },
      signal: AbortSignal.timeout(8000),
      body: JSON.stringify({
        model,
        temperature: 0.15,
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
      return { model, content };
    }
  } catch {
    return null;
  }
  return null;
}

export async function callGroqOnlyJson(
  prompt: string
): Promise<{ provider: 'groq'; model: string; content: string } | null> {
  const groqKey = isUsableKey(process.env.GROQ_API_KEY);
  if (!groqKey) return null;

  try {
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
        signal: AbortSignal.timeout(8000),
        body: JSON.stringify({
          model,
          temperature: 0.15,
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
        return { provider: 'groq', model, content: result.content };
      }
    }

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
          return { provider: 'groq', model, content: result.content };
        }
      }
    }
  } catch {
    return null;
  }
  return null;
}

export async function callGeminiOnlyJson(
  prompt: string
): Promise<{ provider: 'gemini'; model: string; content: string } | null> {
  const res = await tryGeminiJson(prompt);
  return res ? { provider: 'gemini', model: res.model, content: res.content } : null;
}

export async function callOpenAiOnlyJson(
  prompt: string
): Promise<{ provider: 'openai'; model: string; content: string } | null> {
  const res = await tryOpenAiJson(prompt);
  return res ? { provider: 'openai', model: res.model, content: res.content } : null;
}

export async function callGroqFreeJson(prompt: string): Promise<string | null> {
  const groqOnly = await callGroqOnlyJson(prompt);
  if (groqOnly?.content) return groqOnly.content;

  // Fallback 2: Google Gemini JSON API
  const geminiResult = await tryGeminiJson(prompt);
  if (geminiResult?.content) return geminiResult.content;

  // Fallback 3: OpenAI JSON API
  const openAiResult = await tryOpenAiJson(prompt);
  if (openAiResult?.content) return openAiResult.content;

  return null;
}

export interface GroundingSourceLink {
  uri: string;
  title: string;
  domain: string;
}

function sanitizeBasicHttpUrl(raw: string): string | null {
  const trimmed = String(raw || '').trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function resolveGroundingRedirectUrl(rawUrl: string): Promise<string | null> {
  const safe = sanitizeBasicHttpUrl(rawUrl);
  if (!safe) return null;

  const isRedirectWrapper =
    safe.includes('vertexaisearch.cloud.google.com') || safe.includes('google.com/url');
  if (!isRedirectWrapper) {
    return safe;
  }

  const readRedirectLocation = async (method: 'HEAD' | 'GET'): Promise<string | null> => {
    try {
      const res = await fetch(safe, {
        method,
        redirect: 'manual',
        signal: AbortSignal.timeout(2500),
        headers: { 'User-Agent': 'Orbis/2026' },
        cache: 'no-store',
      });
      const loc = res.headers.get('location');
      if (!loc) return null;
      const resolved = new URL(loc, safe).toString();
      const valid = sanitizeBasicHttpUrl(resolved);
      if (
        !valid ||
        valid.includes('vertexaisearch.cloud.google.com') ||
        valid.includes('google.com')
      ) {
        return null;
      }
      return valid;
    } catch {
      return null;
    }
  };

  return (await readRedirectLocation('HEAD')) || (await readRedirectLocation('GET'));
}

export function extractJsonObjectFromText(rawText: string): string | null {
  const stripped = String(rawText || '')
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();
  if (!stripped) return null;

  const firstBrace = stripped.indexOf('{');
  const lastBrace = stripped.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace <= firstBrace) return null;

  const candidate = stripped.slice(firstBrace, lastBrace + 1);
  try {
    JSON.parse(candidate);
    return candidate;
  } catch {
    return null;
  }
}

export async function callGeminiSearchGroundedJson(
  prompt: string,
  options?: { timeoutMs?: number; maxGroundingLinks?: number }
): Promise<{
  provider: 'gemini-grounding';
  model: string;
  content: string;
  groundingLinks: GroundingSourceLink[];
} | null> {
  const geminiKey = isUsableKey(process.env.GEMINI_API_KEY);
  if (!geminiKey) return null;

  const timeoutMs = options?.timeoutMs ?? 12000;
  const maxGroundingLinks = options?.maxGroundingLinks ?? 12;
  const models = ['gemini-2.5-flash', 'gemini-2.5-flash-lite', 'gemini-2.0-flash'];

  for (const model of models) {
    try {
      const generationConfig: Record<string, any> = { temperature: 0.15 };
      if (model.startsWith('gemini-2.5')) {
        generationConfig.thinkingConfig = { thinkingBudget: 0 };
      }
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(
          geminiKey
        )}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: AbortSignal.timeout(timeoutMs),
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: `${prompt}\n\nReturn ONLY one strictly valid raw JSON object (no prose before or after, no markdown fences).`,
                  },
                ],
              },
            ],
            tools: [{ google_search: {} }],
            generationConfig,
          }),
          cache: 'no-store',
        }
      );
      if (!res.ok) continue;

      const data = await res.json();
      const parts: any[] = Array.isArray(data?.candidates?.[0]?.content?.parts)
        ? data.candidates[0].content.parts
        : [];
      const joinedText = parts.map((p) => String(p?.text || '')).join('\n');
      const content = extractJsonObjectFromText(joinedText);
      if (!content) continue;

      const rawChunks: any[] = Array.isArray(
        data?.candidates?.[0]?.groundingMetadata?.groundingChunks
      )
        ? data.candidates[0].groundingMetadata.groundingChunks
        : [];

      const rawLinks = rawChunks
        .slice(0, maxGroundingLinks)
        .map((ch) => ({
          uri: String(ch?.web?.uri || '').trim(),
          title: String(ch?.web?.title || '').trim(),
        }))
        .filter((item) => Boolean(item.uri));

      const resolvedUris = await Promise.all(
        rawLinks.map((item) => resolveGroundingRedirectUrl(item.uri))
      );

      const groundingLinks: GroundingSourceLink[] = [];
      const seenUris = new Set<string>();
      for (let i = 0; i < resolvedUris.length; i++) {
        const uri = resolvedUris[i];
        if (!uri || seenUris.has(uri)) continue;
        seenUris.add(uri);
        let domain = '';
        try {
          domain = new URL(uri).hostname.replace(/^www\./i, '').toLowerCase();
        } catch {
          domain = '';
        }
        groundingLinks.push({
          uri,
          title: rawLinks[i].title || domain,
          domain,
        });
      }

      return {
        provider: 'gemini-grounding',
        model,
        content,
        groundingLinks,
      };
    } catch {
      // Try next Gemini model cleanly
    }
  }

  return null;
}
