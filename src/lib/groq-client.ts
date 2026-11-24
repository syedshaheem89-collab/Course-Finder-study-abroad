let cachedActiveModel: string | null = null;
let cachedAt = 0;

export async function callGroqFreeJson(prompt: string): Promise<string | null> {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (!groqKey) return null;

  try {
    // Use cached active model for 1 hour to avoid an extra /models round-trip on every request
    const now = Date.now();
    let candidateModels: string[] =
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
    return null;
  }

  return null;
}
