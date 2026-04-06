const PROVIDERS = {
    gemini: {
        defaultModel: 'gemini-2.5-flash',
        // Gemini puts key in URL query param
        url: (model, key) => `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        headers: () => ({ 'content-type': 'application/json' }),
        buildBody: (system, user) => ({
            system_instruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: user }] }],
            generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        }),
        parseResponse: (json) => {
            const j = json;
            return j.candidates[0].content.parts[0].text;
        },
    },
    anthropic: {
        defaultModel: 'claude-haiku-4-5-20251001',
        url: () => 'https://api.anthropic.com/v1/messages',
        headers: (key) => ({
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        }),
        buildBody: (system, user, model) => ({
            model,
            max_tokens: 1024,
            system,
            messages: [{ role: 'user', content: user }],
        }),
        parseResponse: (json) => {
            const j = json;
            return j.content[0].text;
        },
    },
    openai: {
        defaultModel: 'gpt-4o-mini',
        url: () => 'https://api.openai.com/v1/chat/completions',
        headers: (key) => ({
            Authorization: `Bearer ${key}`,
            'content-type': 'application/json',
        }),
        buildBody: (system, user, model) => ({
            model,
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: user },
            ],
        }),
        parseResponse: (json) => {
            const j = json;
            return j.choices[0].message.content;
        },
    },
};
export async function callAI(config, systemPrompt, userMessage) {
    const p = PROVIDERS[config.provider];
    const model = config.model ?? p.defaultModel;
    const url = p.url(model, config.key);
    const headers = p.headers(config.key);
    const body = p.buildBody(systemPrompt, userMessage, model);
    const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`AI error ${res.status}: ${err.slice(0, 200)}`);
    }
    const json = await res.json();
    return p.parseResponse(json);
}
// Extract JSON object from LLM response (handles markdown fences and extra text)
export function extractJSON(text) {
    // First check for markdown code fences
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence)
        return fence[1].trim();
    // Find the last complete JSON object using brace matching
    const lastBrace = text.lastIndexOf('}');
    if (lastBrace !== -1) {
        let depth = 0;
        for (let i = lastBrace; i >= 0; i--) {
            if (text[i] === '}')
                depth++;
            else if (text[i] === '{') {
                depth--;
                if (depth === 0)
                    return text.slice(i, lastBrace + 1);
            }
        }
    }
    return text.trim();
}
