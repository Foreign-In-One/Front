import type { UiLocale } from "./dict";

export const VISA_CODES = ["E-9", "E-7", "H-2", "F-2", "F-4", "D-2"] as const;
export type VisaCode = (typeof VISA_CODES)[number];

/** 체류자격 선택에 필요한 최소한의 설명. 길게 쓰지 않는다. */
const INFO: Record<UiLocale, Record<VisaCode, string>> = {
  ko: {
    "E-9": "비전문취업 비자입니다. 제조업·건설업·농축산업 등에서 일할 때 주로 사용하는 체류자격입니다.",
    "E-7": "특정활동 비자입니다. 전문 기술·지식이 필요한 직무로 초청받아 일할 때 사용합니다.",
    "H-2": "방문취업 비자입니다. 중국·구소련 지역 동포가 지정된 업종에서 일할 때 사용합니다.",
    "F-2": "거주 비자입니다. 장기 체류가 인정된 경우로, 취업 제한이 비교적 적습니다.",
    "F-4": "재외동포 비자입니다. 단순노무 등 일부 직종에는 제한이 있습니다.",
    "D-2": "유학 비자입니다. 일하려면 별도의 시간제 취업 허가가 필요합니다.",
  },
  en: {
    "E-9": "Non-professional employment visa, mainly used in manufacturing, construction and farming.",
    "E-7": "Specific-activity visa for jobs that require professional skills or knowledge.",
    "H-2": "Work-and-visit visa for ethnic Koreans from China and CIS countries, limited to listed industries.",
    "F-2": "Residence visa for long-term residents, with relatively few work restrictions.",
    "F-4": "Overseas Korean visa; some simple-labour jobs are restricted.",
    "D-2": "Student visa. A separate part-time work permit is required to work.",
  },
  vi: {
    "E-9": "Visa lao động phổ thông, thường dùng trong sản xuất, xây dựng, nông nghiệp.",
    "E-7": "Visa hoạt động đặc định cho công việc cần kỹ năng, chuyên môn.",
    "H-2": "Visa thăm thân lao động dành cho đồng bào Hàn ở Trung Quốc và SNG, giới hạn ngành nghề.",
    "F-2": "Visa cư trú dài hạn, ít hạn chế về việc làm.",
    "F-4": "Visa kiều bào; một số công việc lao động giản đơn bị hạn chế.",
    "D-2": "Visa du học. Muốn làm thêm phải xin phép riêng.",
  },
  zh: {
    "E-9": "非专业就业签证，多用于制造业、建筑业、农畜产业。",
    "E-7": "特定活动签证，用于需要专业技术或知识的岗位。",
    "H-2": "访问就业签证，面向中国及独联体地区同胞，限定行业。",
    "F-2": "居住签证，长期居留者使用，就业限制较少。",
    "F-4": "在外同胞签证，部分简单劳务岗位受限。",
    "D-2": "留学签证，打工需另外申请时间制就业许可。",
  },
};

export function visaInfo(locale: UiLocale, code: string): string {
  const table = INFO[locale] ?? INFO.ko;
  return table[code as VisaCode] ?? "";
}
