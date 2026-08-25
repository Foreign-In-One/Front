import type {
  CalendarEvent,
  DocFields,
  DocKind,
  EmploymentProfile,
  PayRecord,
  UserProfile,
} from "@/lib/paycycle/types";
import { emptyFields } from "@/lib/paycycle/types";
import { payDayIso } from "@/lib/paycycle/format";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

/** Spring Boot 백엔드 REST API DTO 응답 규격 */
export interface UserProfileDto {
  userId: string;
  nickname: string;
  nationality: string;
  visa: string;
  entryDate: string | null;
  visaExpiryDate: string | null;
}

export interface EmploymentProfileDto {
  status: string;
  entryDate: string | null;
  workStartDate: string | null;
  currentWorkplaceStartDate: string | null;
  exitDate: string | null;
  payDay: number | null;
  workplace: string;
  previousWorkplace: string;
}

export interface CalendarEventDto {
  id: string;
  title: string;
  type: string;
  date: string;
  description?: string;
  sourceType?: string;
  sourceId?: string;
}

export interface OcrRequestDto {
  kind: DocKind;
  dataUrl?: string;
  period: string;
}

export interface OcrResponseDto {
  ok: boolean;
  mock: boolean;
  confidence: "high" | "low";
  message: string;
  fields: DocFields;
}

export interface AiTranslateRequestDto {
  korean: string;
  targetLanguage: string;
}

export interface AiTranslateResponseDto {
  ok: boolean;
  mock: boolean;
  text: string;
}

/** 
 * API 호출 헬퍼: 백엔드 접속 가능 시 Spring Boot API 사용, 
 * 미실행/실패 시 DTO와 100% 동일한 Mock 데이터 반환
 */
export async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit,
  fallbackData?: T
): Promise<{ data: T; isMock: boolean }> {
  try {
    const res = await fetch(`${BASE_URL}${endpoint}`, {
      headers: { "Content-Type": "application/json", ...options?.headers },
      ...options,
    });
    if (res.ok) {
      const data = await res.json();
      return { data, isMock: false };
    }
  } catch {
    /* 백엔드 미실행 시 Fallback 처리 */
  }

  if (fallbackData !== undefined) {
    return { data: fallbackData, isMock: true };
  }
  throw new Error(`API call failed to ${endpoint} and no fallback provided.`);
}

/** 프로필 및 근로 정보 백엔드 조회 */
export async function getProfileApi(): Promise<{
  profile: UserProfileDto;
  employment: EmploymentProfileDto;
  isMock: boolean;
}> {
  const fallbackProfile: UserProfileDto = {
    userId: "demo-user-1",
    nickname: "Nguyen",
    nationality: "Vietnam",
    visa: "E-9",
    entryDate: "2023-04-15",
    visaExpiryDate: "2026-04-15",
  };
  const fallbackEmployment: EmploymentProfileDto = {
    status: "EMPLOYED",
    entryDate: "2023-04-15",
    workStartDate: "2023-05-01",
    currentWorkplaceStartDate: "2023-05-01",
    exitDate: "2026-04-15",
    payDay: 25,
    workplace: "한국정밀(주)",
    previousWorkplace: "",
  };

  const res = await fetchApi<{ profile: UserProfileDto; employment: EmploymentProfileDto }>(
    "/api/v1/profile",
    { method: "GET" },
    { profile: fallbackProfile, employment: fallbackEmployment }
  );

  return {
    profile: res.data.profile,
    employment: res.data.employment,
    isMock: res.isMock,
  };
}

/** 프로필 및 근로 정보 백엔드 저장/수정 */
export async function updateProfileApi(payload: {
  profile: UserProfileDto;
  employment: EmploymentProfileDto;
}): Promise<{ success: boolean; isMock: boolean }> {
  const res = await fetchApi<{ success: boolean }>(
    "/api/v1/profile",
    { method: "PUT", body: JSON.stringify(payload) },
    { success: true }
  );
  return { success: res.data.success, isMock: res.isMock };
}

/** 캘린더 이벤트 백엔드 조회 */
export async function getCalendarEventsApi(): Promise<{
  events: CalendarEventDto[];
  isMock: boolean;
}> {
  const fallbackEvents: CalendarEventDto[] = [
    {
      id: "evt-1",
      title: "정기 급여일",
      type: "PAYDAY",
      date: "2026-08-25",
      description: "월급 입금 예정일",
    },
    {
      id: "evt-2",
      title: "비자 만료 및 예상 출국",
      type: "EXIT",
      date: "2026-04-15",
      description: "체류 기간 만료 예정",
    },
  ];

  const res = await fetchApi<CalendarEventDto[]>(
    "/api/v1/calendar/events",
    { method: "GET" },
    fallbackEvents
  );

  return { events: res.data, isMock: res.isMock };
}

/** OCR 판독 API 서비스 */
export async function readDocumentOcrApi(req: OcrRequestDto): Promise<OcrResponseDto> {
  const base = emptyFields(req.period);
  let mockFields: DocFields = base;

  if (req.kind === "contract") {
    mockFields = { ...base, basePay: 2_200_000, allowances: 0, payDay: 25 };
  } else if (req.kind === "statement") {
    mockFields = {
      ...base,
      basePay: 2_200_000,
      allowances: 380_000,
      deductions: 200_000,
      netPay: 2_380_000,
      payDate: payDayIso(req.period, 25),
    };
  } else {
    mockFields = { ...base, netPay: 2_260_000, payDate: payDayIso(req.period, 27) };
  }

  const fallbackOcr: OcrResponseDto = {
    ok: true,
    mock: true,
    confidence: "low",
    message: "샘플 판독 값입니다. 실제 자료의 값으로 수정해 주세요.",
    fields: mockFields,
  };

  const res = await fetchApi<OcrResponseDto>(
    "/api/v1/paycheck/ocr",
    { method: "POST", body: JSON.stringify(req) },
    fallbackOcr
  );

  return res.data;
}

/** AI 번역 API 서비스 */
export async function translateAiApi(req: AiTranslateRequestDto): Promise<AiTranslateResponseDto> {
  const fallbackResponse: AiTranslateResponseDto = {
    ok: true,
    mock: true,
    text: req.korean,
  };

  const res = await fetchApi<AiTranslateResponseDto>(
    "/api/v1/paycheck/ai/translate",
    { method: "POST", body: JSON.stringify(req) },
    fallbackResponse
  );

  return res.data;
}
