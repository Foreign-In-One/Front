import { NextResponse } from 'next/server';

const LANGUAGE_NAMES: Record<string, string> = {
  ko: '한국어 (Korean)',
  en: 'English',
  vi: 'Tiếng Việt (Vietnamese)',
  zh: '中文 (Chinese)',
};

/**
 * AI Agent Chat API 라우트 (Next.js 내부 폴백, 2단계)
 * - 1단계인 Spring Boot 백엔드(/api/agent/chat)가 응답하지 못했을 때만 여기로 온다.
 * - OPENAI_API_KEY 가 설정되어 있으면 실제 LLM API 호출 (백엔드와 동일한 OpenAI 사용으로 통일)
 * - API Key 부재 또는 호출 실패 시 ok:false 를 반환해 클라이언트가 localAnswer() 규칙 엔진으로 폴백하게 한다.
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

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, text: null, error: null });
    }

    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    const targetLang = LANGUAGE_NAMES[locale] || locale;

    const systemPrompt =
      '당신은 한국에서 일하는 외국인 근로자를 돕는 금융권리 AI 어시스턴트입니다.\n' +
      '규칙:\n' +
      '1. 아래 [실제로 확인된 정보]에 없는 사실은 절대로 지어내지 마세요. 모르는 내용은 모른다고 답하고, 어디서 확인할 수 있는지 안내하세요.\n' +
      `2. 반드시 "${targetLang}"로, 2~4문장 이내로 간결하게 답변하세요.\n` +
      '3. 친절하지만 전문적인 톤을 유지하고, 필요하면 다음 행동을 한 가지 제안하세요.\n' +
      '4. 순수 텍스트로만 답변하고, 마크다운이나 JSON 형식을 쓰지 마세요.';

    const userPrompt = `[실제로 확인된 정보]\n${context || '없음'}\n\n[질문]\n${question}`;

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        signal: AbortSignal.timeout(15_000),
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const text: string | undefined = json.choices?.[0]?.message?.content;
        if (text?.trim()) {
          return NextResponse.json({
            ok: true,
            text: text.trim(),
            error: null,
          });
        }
      } else {
        console.warn(
          'OpenAI chat call returned non-OK status:',
          res.status,
          await res.text(),
        );
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
