import { LAW } from "@/lib/paycycle/law";
import type { EvidenceSource } from "@/lib/paycycle/types";

/**
 * 법령 근거는 AI가 생성하지 않는다.
 * 조문 이름과 공식 링크를 고정 데이터로 관리하고, 화면에는 요약 한 줄과 링크만 보여준다.
 * 국가법령정보센터 Open API를 붙일 경우에도 이 레이어의 반환 타입은 그대로 유지한다.
 */
export const LAW_SOURCES = LAW;

export function lawRef(key: keyof typeof LAW): EvidenceSource {
  return LAW[key];
}
