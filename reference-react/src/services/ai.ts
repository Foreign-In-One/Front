import { answerWithContext, translateMessage } from "@/lib/paycycle/ai.functions";
import { QUESTION_LANGUAGE, type UiLocale } from "@/i18n/dict";

/** 사업주 질문카드 번역. 실패 시 안내 문구로 대체하고 절대 내용을 지어내지 않는다. */
export async function translateForEmployer(
  korean: string,
  locale: UiLocale,
): Promise<{ text: string; mock: boolean }> {
  if (locale === "ko") return { text: korean, mock: false };
  try {
    const result = await translateMessage({
      data: { korean, languageName: QUESTION_LANGUAGE[locale] },
    });
    if (result.ok && result.text) return { text: result.text, mock: false };
  } catch {
    /* 아래 대체 문구 사용 */
  }
  return {
    text: "번역을 불러오지 못했습니다. 위의 한국어 문장을 그대로 전달해 주세요.",
    mock: true,
  };
}

/** 저장된 데이터 요약만 컨텍스트로 사용하는 금융권리 도우미 답변. */
export async function askAssistant(
  question: string,
  context: string,
  locale: UiLocale,
): Promise<{ text: string | null; error: string | null }> {
  try {
    const result = await answerWithContext({
      data: {
        question,
        context: `${context}\n\n[답변 언어] ${QUESTION_LANGUAGE[locale]}로 답변하세요.`,
      },
    });
    if (result.ok && result.text) return { text: result.text, error: null };
    return { text: null, error: result.error };
  } catch {
    return { text: null, error: "지금은 답변을 불러오지 못했습니다." };
  }
}
