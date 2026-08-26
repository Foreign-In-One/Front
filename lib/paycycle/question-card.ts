import type { LanguageCode, PayFinding } from "./types";
import { won } from "./format";

export const LANGUAGES: { code: LanguageCode; label: string; native: string }[] = [
  { code: "vi", label: "베트남어", native: "Tiếng Việt" },
  { code: "km", label: "캄보디아어", native: "ភាសាខ្មែរ" },
  { code: "th", label: "태국어", native: "ภาษาไทย" },
  { code: "id", label: "인도네시아어", native: "Bahasa Indonesia" },
  { code: "ne", label: "네팔어", native: "नेपाली" },
  { code: "tl", label: "필리핀어", native: "Tagalog" },
  { code: "en", label: "영어", native: "English" },
];

export function languageLabel(code: LanguageCode): string {
  return LANGUAGES.find((l) => l.code === code)?.label ?? "영어";
}

export function languageNative(code: LanguageCode): string {
  return LANGUAGES.find((l) => l.code === code)?.native ?? "English";
}

/** AI 번역이 실패했을 때 사용하는 최소 안내 문장 */
const FALLBACK: Record<LanguageCode, string> = {
  vi: "Xin chào, tôi muốn hỏi về khoản chênh lệch trong lương tháng này. Anh/chị có thể kiểm tra giúp tôi được không ạ?",
  km: "សួស្តី! ខ្ញុំចង់សួរអំពីភាពខុសគ្នានៃប្រាក់ខែខែនេះ។ សូមជួយពិនិត្យផង។",
  th: "สวัสดีครับ/ค่ะ ผม/ดิฉันอยากสอบถามเกี่ยวกับส่วนต่างของเงินเดือนเดือนนี้ รบกวนช่วยตรวจสอบด้วยครับ/ค่ะ",
  id: "Halo, saya ingin menanyakan selisih pada gaji bulan ini. Mohon dibantu diperiksa.",
  ne: "नमस्ते, यस महिनाको तलबमा देखिएको फरकबारे सोध्न चाहन्छु। कृपया जाँच गरिदिनुहोस्।",
  tl: "Magandang araw po, nais ko pong itanong ang tungkol sa pagkakaiba sa sahod ngayong buwan. Maaari po bang pakisuri?",
  en: "Hello, I would like to ask about a difference in this month's pay. Could you please check it for me?",
};

export function fallbackTranslation(language: LanguageCode): string {
  return FALLBACK[language];
}

/** 확인된 사실만 담은 한국어 질문 문장 */
export function buildKoreanQuestion(finding: PayFinding): string {
  const amount = won(Math.abs(finding.difference));
  switch (finding.id) {
    case "base":
      return `안녕하세요. 근로계약서의 기본급은 ${won(finding.left.amount)}인데 이번 달 임금명세서 기본급은 ${won(
        finding.right.amount,
      )}로 ${amount} 차이가 있습니다. 어떤 기준으로 산정된 것인지 확인 부탁드립니다.`;
    case "net":
      return `안녕하세요. 이번 달 임금명세서의 실지급액은 ${won(finding.left.amount)}인데 통장에 입금된 금액은 ${won(
        finding.right.amount,
      )}로 ${amount} 차이가 있습니다. 차액이 어떤 항목인지 확인 부탁드립니다.`;
    case "deduction":
      return `안녕하세요. 이번 달 임금명세서의 공제 합계가 ${won(
        finding.left.amount,
      )}으로 확인됩니다. 공제 항목별 금액과 근거를 알려 주시면 감사하겠습니다.`;
    case "paydate":
      return `안녕하세요. 계약상 급여일은 매월 ${finding.left.amount}일인데 이번 달은 ${finding.difference}일 늦게 입금되었습니다. 지급일 기준을 확인 부탁드립니다.`;
    case "contract-deposit":
      return `안녕하세요. 계약 기준 예상 지급액은 ${won(finding.left.amount)}인데 실제 입금액은 ${won(
        finding.right.amount,
      )}입니다. 임금명세서를 받아볼 수 있을까요?`;
    case "minwage":
      return `안녕하세요. 이번 달 기본급과 소정근로시간 기준을 확인하고 싶습니다. 계약서상 소정근로시간과 기본급 산정 방식을 알려 주시면 감사하겠습니다.`;
    default:
      return `안녕하세요. 이번 달 급여 항목 중 ${finding.title}에 대해 확인 부탁드립니다.`;
  }
}
