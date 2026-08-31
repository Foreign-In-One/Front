import { NextResponse } from 'next/server';

const LANGUAGE_NAMES: Record<string, string> = {
  ko: '한국어 (Korean)',
  en: 'English',
  vi: 'Tiếng Việt (Vietnamese)',
  zh: '中文 (Chinese)',
};

/**
 * AI Agent Chat API 라우트
 * - GEMINI_API_KEY 또는 OPENAI_API_KEY 가 설정되어 있으면 실제 LLM API 호출
 * - API Key 부재 또는 실패 시 ok:false 를 반환해 클라이언트가 localAnswer() 규칙 엔진으로 폴백하게 한다.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { question, context, locale = 'ko' } = body;

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { ok: false, text: null, error: 'question is required' },
        { status: 400 },
      );
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ ok: false, text: null, error: null });
    }

    const targetLang = LANGUAGE_NAMES[locale] || locale;

    const prompt = `
당신은 한국에서 일하는 외국인 근로자를 돕는 금융권리 AI 어시스턴트입니다.

[사용자에 대해 실제로 확인된 정보]
${context || '없음'}

[사용자 질문]
${question}

[답변 지침 - 엄격 준수]
1. 위에 주어진 "실제로 확인된 정보"에 없는 사실은 절대로 지어내지 마세요. 모르는 내용은 모른다고 답하고, 어디서 확인할 수 있는지 안내하세요.
2. 반드시 "${targetLang}"로, 2~4문장 이내로 간결하게 답변하세요.
3. 친절하지만 전문적인 톤을 유지하고, 필요하면 다음 행동을 한 가지 제안하세요.
4. 순수 텍스트로만 답변하고, 마크다운이나 JSON 형식을 쓰지 마세요.
`.trim();

    try {
      if (apiKey.startsWith('AIza') || process.env.GEMINI_API_KEY) {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
        const geminiRes = await fetch(geminiUrl, {
          method: 'POST',
          signal: AbortSignal.timeout(10_000),
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        });

        if (geminiRes.ok) {
          const geminiJson = await geminiRes.json();
          const text: string | undefined =
            geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text?.trim()) {
            return NextResponse.json({
              ok: true,
              text: text.trim(),
              error: null,
            });
          }
        }
      }
    } catch (err) {
      console.warn(
        'Live LLM chat call failed, falling back to rule engine:',
        err,
      );
    }

    return NextResponse.json({ ok: false, text: null, error: null });
  } catch (err) {
    console.error('Chat agent route error:', err);
    return NextResponse.json(
      { ok: false, text: null, error: 'internal error' },
      { status: 500 },
    );
  }
}
