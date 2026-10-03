import '../config/env';
import { config } from '../config/env';

async function main() {
  const key = config.GEMINI_API_KEY;
  const model = config.GEMINI_MODEL;
  if (!key) {
    console.error('❌ No GEMINI_API_KEY/GOOGLE_API_KEY found in the project-root .env file.');
    process.exit(1);
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: 'Reply with exactly: GEMINI_OK' }] }],
      generationConfig: { maxOutputTokens: 20 },
    }),
  });

  const raw = await response.text();
  let payload: any;
  try { payload = JSON.parse(raw); } catch { payload = raw; }

  if (!response.ok) {
    console.error(`❌ Gemini API failed: HTTP ${response.status}`);
    console.error(payload?.error?.message ?? payload);
    process.exit(1);
  }

  const text = payload?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? '').join('') ?? '';
  console.log(`✅ Gemini API works. Model: ${model}`);
  console.log(`Response: ${text}`);
}

main().catch((error) => {
  console.error('❌ Gemini test failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
