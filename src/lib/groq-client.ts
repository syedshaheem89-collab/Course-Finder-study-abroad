export async function callGroqFreeJson(prompt: string): Promise<string | null> {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (!groqKey) return null;

  try {
    // Dynamically fetch currently active models so deprecated model IDs never 404
    let candidateModels: string[] = ['llama-3.3-70b-versatile', 'meta-llama/llama-4-scout-17b-16e-instruct'];
    try {
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
        if (preferred.length > 0) {
          candidateModels = preferred.slice(0, 3);
        } else if (activeIds.length > 0) {
          candidateModels = activeIds.slice(0, 3);
        }
      }
    } catch {
      // Fall back to default candidates
    }

    for (const model of candidateModels) {
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

      if (res.ok) {
        const data = await res.json();
        const content = data?.choices?.[0]?.message?.content;
        if (content) return content;
      }
    }
  } catch {
    return null;
  }

  return null;
}
