import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { question, context, locale = "ko" } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.OPENAI_API_KEY;

    const languageNames: Record<string, string> = {
      ko: "한국어 (Korean)",
      en: "English",
      vi: "Tiếng Việt (Vietnamese)",
      zh: "中文 (Chinese)",
    };

    const targetLang = languageNames[locale] || locale;

    if (apiKey) {
      try {
        const prompt = `
당신은 한국에서 근무하는 외국인 근로자를 위한 AI 금융권리 어시스턴트 'PayCycle AI'입니다.
근로기준법, 세무, 출국만기보험, 퇴직금, 체류자격 규정을 바탕으로 명확하고 친절하게 답변하세요.

[사용자 데이터 컨텍스트]
${context || "컨텍스트 없음"}

[질문]
${question}

[답변 작성 필수 규칙]
1. [언어]: 반드시 사용자의 선택 언어인 "${targetLang}"로만 답변을 작성하세요. (다른 언어로 답변하지 마세요)
2. 사실에 기반하여 구체적인 수치(원화)와 필요한 행동을 답변하세요.
3. 법적 분쟁을 조장하지 않고 사실 확인 및 서면 증빙 수집을 안내하세요.
4. 외국인 근로자가 이해하기 쉽게 간결하고 명확한 문단으로 답변하세요.
`;

        if (apiKey.startsWith("AIza") || process.env.GEMINI_API_KEY) {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
          const geminiRes = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
            }),
          });

          if (geminiRes.ok) {
            const geminiJson = await geminiRes.json();
            const text = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              return NextResponse.json({ ok: true, isMock: false, text });
            }
          }
        }
      } catch (err) {
        console.warn("Chat LLM API call error:", err);
      }
    }

    return NextResponse.json({ ok: false, isMock: true, text: null });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to process chat" },
      { status: 500 }
    );
  }
}
