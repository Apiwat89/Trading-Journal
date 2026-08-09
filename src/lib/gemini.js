// Thin client for the Gemini API (Google AI Studio key).
// Docs: https://ai.google.dev/api — REST generateContent endpoint.
//
// Uses import.meta.env.VITE_GEMINI_API_KEY (put it in your .env, same place
// as the Supabase keys). Model is configurable via VITE_GEMINI_MODEL and
// defaults to a fast, cheap model that's plenty for text analysis like this.

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const MODEL = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.5-flash'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`

export function hasGeminiKey() {
  return Boolean(API_KEY)
}

/**
 * Ask Gemini a text-only question and get plain text back.
 * @param {string} prompt
 * @param {{ system?: string, temperature?: number }} opts
 * @returns {Promise<string>}
 */
export async function askGemini(prompt, opts = {}) {
  if (!API_KEY) {
    throw new Error('ยังไม่ได้ตั้งค่า VITE_GEMINI_API_KEY ใน .env')
  }

  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.6,
    },
  }
  if (opts.system) {
    body.systemInstruction = { role: 'system', parts: [{ text: opts.system }] }
  }

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': API_KEY,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    let detail = ''
    try {
      const errJson = await res.json()
      detail = errJson?.error?.message || ''
    } catch {
      // ignore parse failure, fall through to generic message
    }
    if (res.status === 400 || res.status === 403) {
      throw new Error(`Gemini API key ไม่ถูกต้องหรือไม่มีสิทธิ์ใช้งาน ${detail ? `(${detail})` : ''}`)
    }
    if (res.status === 429) {
      throw new Error('เรียก Gemini API ถี่เกินไป (rate limit) ลองใหม่อีกครั้งสักครู่')
    }
    throw new Error(`Gemini API error ${res.status} ${detail}`)
  }

  const data = await res.json()
  const candidate = data?.candidates?.[0]

  if (!candidate) {
    const blockReason = data?.promptFeedback?.blockReason
    throw new Error(blockReason ? `คำขอถูกบล็อก: ${blockReason}` : 'ไม่ได้รับคำตอบจาก Gemini')
  }

  const text = (candidate.content?.parts || [])
    .map((p) => p.text || '')
    .join('')
    .trim()

  if (!text) {
    throw new Error('Gemini ไม่ได้ตอบข้อความกลับมา')
  }

  return text
}
