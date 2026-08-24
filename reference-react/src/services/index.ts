/**
 * 외부 연동 서비스 레이어.
 * 각 기능은 "실제 구현 → 실패 시 Mock"으로 자동 전환되며,
 * 호출 결과에 mock 여부를 담아 화면에서 연결 상태를 표시할 수 있게 한다.
 * 실제 키가 필요한 항목은 EXTERNAL_SETUP.md 참고.
 */
export { readDocument, type OcrResult } from "./ocr";
export { translateForEmployer, askAssistant } from "./ai";
export { lawRef, LAW_SOURCES } from "./law";
